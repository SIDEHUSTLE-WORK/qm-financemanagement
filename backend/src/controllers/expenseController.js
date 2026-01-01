const prisma = require('../config/prisma');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

// Get all expenses
const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, categoryId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      schoolId: req.user.schoolId,
      isVoided: false,
      ...(startDate && endDate && {
        date: { gte: new Date(startDate), lte: new Date(endDate) }
      }),
      ...(categoryId && { categoryId })
    };

    const [entries, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { name: true, color: true } },
          paidBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit)
      }),
      prisma.expense.count({ where })
    ]);

    const transformed = entries.map(e => ({
      ...e,
      amount: parseFloat(e.amount),
      categoryName: e.category?.name,
      categoryColor: e.category?.color,
      paidByName: e.paidBy?.fullName,
      approvedByName: e.approvedBy?.fullName
    }));

    res.json({
      success: true,
      data: {
        entries: transformed,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
  }
};

// Get single expense
const getById = async (req, res) => {
  try {
    const entry = await prisma.expense.findFirst({
      where: { id: req.params.id, schoolId: req.user.schoolId },
      include: {
        category: { select: { name: true, color: true } },
        paidBy: { select: { fullName: true } }
      }
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({
      success: true,
      data: { ...entry, amount: parseFloat(entry.amount) }
    });
  } catch (error) {
    logger.error('Get expense by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expense' });
  }
};

// Create expense
const create = async (req, res) => {
  try {
    const { date, categoryId, description, amount, vendor, paymentMethod, referenceNumber, notes } = req.body;

    const expense = await prisma.expense.create({
      data: {
        schoolId: req.user.schoolId,
        date: new Date(date),
        categoryId: categoryId || null,
        description,
        amount: parseFloat(amount),
        vendor: vendor || null,
        paymentMethod: paymentMethod || null,
        referenceNumber: referenceNumber || null,
        paidById: req.user.id,
        notes: notes || null
      }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'CREATE',
      entityType: 'expense',
      entityId: expense.id,
      description: `Created expense: ${description} - ${amount}`,
      newValues: expense,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: { ...expense, amount: parseFloat(expense.amount) }
    });
  } catch (error) {
    logger.error('Create expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to create expense' });
  }
};

// Update expense
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, categoryId, description, amount, vendor, notes } = req.body;

    const existing = await prisma.expense.findFirst({
      where: { id, schoolId: req.user.schoolId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (existing.isVoided) {
      return res.status(400).json({ success: false, message: 'Cannot update voided entry' });
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        date: new Date(date),
        categoryId,
        description,
        amount: parseFloat(amount),
        vendor,
        notes
      }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'UPDATE',
      entityType: 'expense',
      entityId: id,
      description: `Updated expense: ${description}`,
      oldValues: existing,
      newValues: updated,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: { ...updated, amount: parseFloat(updated.amount) }
    });
  } catch (error) {
    logger.error('Update expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to update expense' });
  }
};

// Void expense
const voidEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Void reason required' });
    }

    const existing = await prisma.expense.findFirst({
      where: { id, schoolId: req.user.schoolId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    await prisma.expense.update({
      where: { id },
      data: {
        isVoided: true,
        voidedById: req.user.id,
        voidedAt: new Date(),
        voidReason: reason
      }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'VOID',
      entityType: 'expense',
      entityId: id,
      description: `Voided expense: ${existing.description} - Reason: ${reason}`,
      oldValues: existing,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, message: 'Expense voided successfully' });
  } catch (error) {
    logger.error('Void expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to void expense' });
  }
};

// Get expense summary
const getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const schoolId = req.user.schoolId;

    const dateFilter = startDate && endDate ? {
      date: { gte: new Date(startDate), lte: new Date(endDate) }
    } : {};

    const totalResult = await prisma.expense.aggregate({
      where: { schoolId, isVoided: false, ...dateFilter },
      _sum: { amount: true }
    });

    const byCategory = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: { schoolId, isVoided: false, ...dateFilter },
      _sum: { amount: true },
      _count: true
    });

    const categoryIds = byCategory.map(c => c.categoryId).filter(Boolean);
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayResult = await prisma.expense.aggregate({
      where: { schoolId, isVoided: false, date: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
      _count: true
    });

    res.json({
      success: true,
      data: {
        total: parseFloat(totalResult._sum.amount || 0),
        today: {
          total: parseFloat(todayResult._sum.amount || 0),
          count: todayResult._count || 0
        },
        byCategory: byCategory.map(item => ({
          name: categoryMap.get(item.categoryId)?.name || 'Uncategorized',
          color: categoryMap.get(item.categoryId)?.color || '#6B7280',
          total: parseFloat(item._sum.amount || 0),
          count: item._count
        }))
      }
    });
  } catch (error) {
    logger.error('Get expense summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
};

// Get expense categories
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { schoolId: req.user.schoolId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Get expense categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  voidEntry,
  getSummary,
  getCategories
};
