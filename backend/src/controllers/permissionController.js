const prisma = require('../config/prisma');

// Default permission templates
const defaultPermissions = {
  admin: {
    dashboard: { view: true },
    income: { view: true, create: true, edit: true, delete: true },
    expenses: { view: true, create: true, edit: true, delete: true },
    fees: { view: true, create: true, edit: true, delete: true },
    students: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true, print: true },
    sms: { view: true, send: true },
    budgets: { view: true, create: true, edit: true, delete: true },
    plans: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, edit: true },
    users: { view: true, create: true, edit: true, delete: true }
  },
  bursar: {
    dashboard: { view: true },
    income: { view: true, create: true, edit: true, delete: false },
    expenses: { view: true, create: true, edit: true, delete: false },
    fees: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, export: true, print: true },
    sms: { view: true, send: true },
    budgets: { view: true, create: true, edit: false, delete: false },
    plans: { view: true, create: true, edit: true, delete: false },
    settings: { view: true, edit: false },
    users: { view: false, create: false, edit: false, delete: false }
  },
  director: {
    dashboard: { view: true },
    income: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: false, edit: false, delete: false },
    fees: { view: true, create: false, edit: false, delete: false },
    students: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: true, print: true },
    sms: { view: true, send: false },
    budgets: { view: true, create: false, edit: false, delete: false },
    plans: { view: true, create: false, edit: false, delete: false },
    settings: { view: true, edit: false },
    users: { view: true, create: false, edit: false, delete: false }
  },
  accountant: {
    dashboard: { view: true },
    income: { view: true, create: true, edit: false, delete: false },
    expenses: { view: true, create: true, edit: false, delete: false },
    fees: { view: true, create: true, edit: false, delete: false },
    students: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: true, print: true },
    sms: { view: false, send: false },
    budgets: { view: true, create: false, edit: false, delete: false },
    plans: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, edit: false },
    users: { view: false, create: false, edit: false, delete: false }
  },
  viewer: {
    dashboard: { view: true },
    income: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: false, edit: false, delete: false },
    fees: { view: true, create: false, edit: false, delete: false },
    students: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: false, print: false },
    sms: { view: false, send: false },
    budgets: { view: true, create: false, edit: false, delete: false },
    plans: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, edit: false },
    users: { view: false, create: false, edit: false, delete: false }
  }
};

// Get all roles
const getRoles = async (req, res) => {
  try {
    const { schoolId } = req.user;
    
    const roles = await prisma.role.findMany({
      where: { schoolId },
      include: {
        _count: { select: { users: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create role
const createRole = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    // Use default permissions if not provided
    const rolePermissions = permissions || defaultPermissions[name.toLowerCase()] || defaultPermissions.viewer;

    const role = await prisma.role.create({
      data: {
        name: name.toLowerCase(),
        description,
        permissions: rolePermissions,
        schoolId
      }
    });

    res.json({ success: true, data: role });
  } catch (error) {
    console.error('Create role error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Role name already exists for this school' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update role permissions
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    const { name, description, permissions } = req.body;

    // First check if role exists and belongs to school
    const existing = await prisma.role.findFirst({
      where: { id, schoolId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        ...(name && { name: name.toLowerCase() }),
        ...(description !== undefined && { description }),
        ...(permissions && { permissions })
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete role
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    // Check if role has users
    const role = await prisma.role.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { users: true } } }
    });

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role._count.users > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete role. ${role._count.users} user(s) are assigned to this role.` 
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get default permission templates
const getPermissionTemplates = async (req, res) => {
  res.json({ success: true, data: defaultPermissions });
};

// Initialize default roles for a school
const initializeDefaultRoles = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const rolesToCreate = ['admin', 'bursar', 'director', 'accountant', 'viewer'];
    const created = [];

    for (const roleName of rolesToCreate) {
      const existing = await prisma.role.findFirst({
        where: { name: roleName, schoolId }
      });

      if (!existing) {
        const role = await prisma.role.create({
          data: {
            name: roleName,
            description: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role`,
            permissions: defaultPermissions[roleName],
            schoolId
          }
        });
        created.push(role);
      }
    }

    res.json({ 
      success: true, 
      message: `${created.length} roles initialized`,
      data: created 
    });
  } catch (error) {
    console.error('Initialize roles error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign role to user
const assignRoleToUser = async (req, res) => {
  try {
    const { userId, roleId } = req.body;
    const { schoolId } = req.user;

    if (!userId || !roleId) {
      return res.status(400).json({ success: false, message: 'User ID and Role ID required' });
    }

    // Verify role belongs to school
    const role = await prisma.role.findFirst({
      where: { id: roleId, schoolId }
    });

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Verify user belongs to same school
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, schoolId }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all users with roles
const getUsersWithRoles = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const users = await prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        isActive: true,
        userRole: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        },
        createdAt: true,
        lastLogin: true
      },
      orderBy: { fullName: 'asc' }
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user's permissions
const getMyPermissions = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If no role, return admin permissions (for backwards compatibility)
    const permissions = user.role?.permissions || defaultPermissions.admin;

    res.json({ 
      success: true, 
      data: {
        role: user.role?.name || 'admin',
        permissions
      }
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getPermissionTemplates,
  initializeDefaultRoles,
  assignRoleToUser,
  getUsersWithRoles,
  getMyPermissions,
  defaultPermissions
};