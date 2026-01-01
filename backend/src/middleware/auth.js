const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';

// Authenticate JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        schoolId: true,
        username: true,
        fullName: true,
        role: true,
        permissions: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Authorize by role
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check specific permission
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    const permissions = req.user.permissions || {};
    
    // Check if user has the specific permission
    if (permissions.all === true) {
      return next();
    }

    const resourcePerms = permissions[resource] || {};
    
    if (resourcePerms[action] === true) {
      return next();
    }

    // Role-based fallback permissions
    const rolePermissions = {
      director: {
        income: { read: true },
        expense: { read: true },
        reports: { read: true },
        students: { read: true },
        users: { read: true, create: true, update: true }
      },
      bursar: {
        income: { create: true, read: true, update: true },
        expense: { create: true, read: true, update: true },
        reports: { create: true, read: true },
        students: { create: true, read: true, update: true }
      },
      accountant: {
        income: { create: true, read: true, update: true },
        expense: { create: true, read: true, update: true },
        reports: { read: true }
      },
      teacher: {
        students: { read: true },
        income: { read: true }
      },
      viewer: {
        income: { read: true },
        expense: { read: true },
        reports: { read: true },
        students: { read: true }
      }
    };

    const rolePerms = rolePermissions[req.user.role]?.[resource]?.[action];
    
    if (rolePerms === true) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Permission denied: ${action} ${resource}`
    });
  };
};

// Rate limiting (simple in-memory)
const rateLimitStore = new Map();

const rateLimit = (options = {}) => {
  const { windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests' } = options;

  return (req, res, next) => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = rateLimitStore.get(key);

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({
        success: false,
        message
      });
    }

    record.count++;
    next();
  };
};

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

module.exports = {
  authenticate,
  authorize,
  checkPermission,
  rateLimit
};
