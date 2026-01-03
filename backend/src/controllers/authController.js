const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Generate JWT token
const generateToken = (userId, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
};

// Generate refresh token
const generateRefreshToken = async (userId) => {
  const token = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });
  
  return token;
};

// Login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user with school AND role
    const user = await prisma.user.findFirst({
      where: {
        username: username.toLowerCase(),
        school: { isActive: true }
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            code: true,
            logoPath: true
          }
        },
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Account locked. Try again in ${remainingMinutes} minutes.`
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Contact administrator.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      // Increment login attempts
      const newAttempts = (user.loginAttempts || 0) + 1;
      let lockedUntil = null;

      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
        logger.warn(`Account locked due to failed attempts: ${username}`);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil
        }
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Reset login attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date()
      }
    });

    // Generate tokens
    const accessToken = generateToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    // Create audit log
    await createAuditLog({
      schoolId: user.schoolId,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role?.name || user.userRole,
      action: 'LOGIN',
      entityType: 'auth',
      description: 'User logged in successfully',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          userRole: user.userRole,
          roleName: user.role?.name || null,
          roleId: user.role?.id || null,
          permissions: user.role?.permissions || user.permissions || {},
          mustChangePassword: user.mustChangePassword
        },
        school: {
          id: user.school.id,
          name: user.school.name,
          code: user.school.code,
          logo: user.school.logoPath
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify token exists in database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() }
      }
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Verify JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const accessToken = generateToken(decoded.userId);

      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn: JWT_EXPIRES_IN
        }
      });
    } catch (jwtError) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }

    // Delete all expired tokens (cleanup)
    await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role?.name || req.user.userRole,
      action: 'LOGOUT',
      entityType: 'auth',
      description: 'User logged out',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during logout'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true }
    });

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false
      }
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.id }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role?.name || req.user.userRole,
      action: 'UPDATE',
      entityType: 'auth',
      description: 'Password changed',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        userRole: true,
        permissions: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true,
            logoPath: true,
            address: true,
            phone: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          userRole: user.userRole,
          roleName: user.role?.name || null,
          roleId: user.role?.id || null,
          permissions: user.role?.permissions || user.permissions || {}
        },
        school: {
          id: user.school.id,
          name: user.school.name,
          code: user.school.code,
          logo: user.school.logoPath,
          address: user.school.address,
          phone: user.school.phone
        }
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred'
    });
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  changePassword,
  getProfile,
  JWT_SECRET
};