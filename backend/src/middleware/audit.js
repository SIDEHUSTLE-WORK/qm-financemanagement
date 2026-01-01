const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * Create an audit log entry
 */
const createAuditLog = async ({
  schoolId,
  userId,
  userName,
  userRole,
  action,
  entityType,
  entityId = null,
  description = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId,
        userId,
        userName,
        userRole,
        action,
        entityType,
        entityId,
        description,
        oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};

/**
 * Get audit logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entityType, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      schoolId: req.user.schoolId,
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs
};
