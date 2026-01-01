const prisma = require('../config/prisma');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

// Get next receipt number
const getNextReceiptNumber = async (schoolId) => {
  const setting = await prisma.setting.findUnique({
    where: { schoolId_key: { schoolId, key: 'receipt_counter' } }
  });
  
  const counter = setting ? parseInt(setting.value) : 1;
  
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { code: true }
  });
  
  return `${school?.code || 'RCP'}${String(counter).padStart(4, '0')}`;
};

// Increment receipt counter
const incrementReceiptCounter = async (schoolId) => {
  await prisma.setting.upsert({
    where: { schoolId_key: { schoolId, key: 'receipt_counter' } },
    update: {
      value: { increment: 1 }.toString() // This won't work, need raw query
    },
    create: {
      schoolId,
      key: 'receipt_counter',
      value: '2'
    }
  });
  
  // Actually increment using raw update
  await prisma.$executeRaw`
    UPDATE settings 
    SET value = (CAST(value AS INTEGER) + 1)::TEXT, updated_at = NOW()
    WHERE school_id = ${schoolId} AND key = 'receipt_counter'
  `;
};

// Get all income entries
const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, categoryId, studentId, paymentMethod } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      schoolId: req.user.schoolId,
      isVoided: false,
      ...(startDate && { date: { gte: new Date(startDate) } }),
      ...(endDate && { date: { lte: new Date(endDate) } }),
      ...(categoryId && { categoryId }),
      ...(studentId && { studentId }),
      ...(paymentMethod && { paymentMethod })
    };

    const [entries, total] = await Promise.all([
      prisma.income.findMany({
        where,
        include: {
          category: { select: { name: true, color: true } },
          student: { 
            select: { 
              firstName: true, 
              lastName: true, 
              studentNumber: true,
              class: { select: { name: true } }
            } 
          },
          receivedBy: { select: { fullName: true } }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit)
      }),
      prisma.income.count({ where })
    ]);

    // Transform data for response
    const transformedEntries = entries.map(entry => ({
      ...entry,
      amount: parseFloat(entry.amount),
      categoryName: entry.category?.name,
      categoryColor: entry.category?.color,
      studentName: entry.student ? `${entry.student.firstName} ${entry.student.lastName}` : null,
      studentNumber: entry.student?.studentNumber,
      className: entry.student?.class?.name,
      receivedByName: entry.receivedBy?.fullName
    }));

    res.json({
      success: true,
      data: {
        entries: transformedEntries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income entries'
    });
  }
};

// Get single income entry
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await prisma.income.findFirst({
      where: { id, schoolId: req.user.schoolId },
      include: {
        category: { select: { name: true, color: true } },
        student: { 
          select: { 
            firstName: true, 
            lastName: true, 
            studentNumber: true,
            class: { select: { name: true } }
          } 
        },
        receivedBy: { select: { fullName: true } }
      }
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Income entry not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...entry,
        amount: parseFloat(entry.amount),
        categoryName: entry.category?.name,
        studentName: entry.student ? `${entry.student.firstName} ${entry.student.lastName}` : null
      }
    });
  } catch (error) {
    logger.error('Get income by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income entry'
    });
  }
};

// Create income entry
const create = async (req, res) => {
  try {
    const {
      date,
      categoryId,
      studentId,
      termId,
      description,
      amount,
      paymentMethod,
      mobileMoneyRef,
      bankRef,
      schoolPayRef,
      chequeNumber,
      notes
    } = req.body;

    const receiptNumber = await getNextReceiptNumber(req.user.schoolId);

    // Use transaction for data integrity
    const result = await prisma.$transaction(async (tx) => {
      // Create income entry
      const income = await tx.income.create({
        data: {
          schoolId: req.user.schoolId,
          receiptNumber,
          date: new Date(date),
          categoryId: categoryId || null,
          studentId: studentId || null,
          termId: termId || null,
          description,
          amount: parseFloat(amount),
          paymentMethod,
          mobileMoneyRef: mobileMoneyRef || null,
          bankRef: bankRef || null,
          schoolPayRef: schoolPayRef || null,
          chequeNumber: chequeNumber || null,
          receivedById: req.user.id,
          notes: notes || null
        }
      });

      // Increment receipt counter
      await tx.$executeRaw`
        UPDATE settings 
        SET value = (CAST(value AS INTEGER) + 1)::TEXT, updated_at = NOW()
        WHERE school_id = ${req.user.schoolId} AND key = 'receipt_counter'
      `;

      // Update student balance if student payment
      if (studentId && termId) {
        await tx.studentBalance.upsert({
          where: { studentId_termId: { studentId, termId } },
          update: {
            amountPaid: { increment: parseFloat(amount) }
          },
          create: {
            studentId,
            termId,
            totalFees: 0,
            amountPaid: parseFloat(amount),
            previousBalance: 0
          }
        });
      }

      return income;
    });

    // Create audit log
    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'CREATE',
      entityType: 'income',
      entityId: result.id,
      description: `Created income: ${description} - ${amount} (${receiptNumber})`,
      newValues: result,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Income entry created successfully',
      data: { ...result, amount: parseFloat(result.amount) }
    });
  } catch (error) {
    logger.error('Create income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create income entry'
    });
  }
};

// Update income entry
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, categoryId, description, amount, paymentMethod, notes } = req.body;

    const existing = await prisma.income.findFirst({
      where: { id, schoolId: req.user.schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Income entry not found'
      });
    }

    if (existing.isVoided) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a voided entry'
      });
    }

    const updated = await prisma.income.update({
      where: { id },
      data: {
        date: new Date(date),
        categoryId,
        description,
        amount: parseFloat(amount),
        paymentMethod,
        notes
      }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'UPDATE',
      entityType: 'income',
      entityId: id,
      description: `Updated income: ${description}`,
      oldValues: existing,
      newValues: updated,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Income entry updated successfully',
      data: { ...updated, amount: parseFloat(updated.amount) }
    });
  } catch (error) {
    logger.error('Update income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update income entry'
    });
  }
};

// Void income entry
const voidEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Void reason is required'
      });
    }

    const existing = await prisma.income.findFirst({
      where: { id, schoolId: req.user.schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Income entry not found'
      });
    }

    if (existing.isVoided) {
      return res.status(400).json({
        success: false,
        message: 'Entry is already voided'
      });
    }

    await prisma.$transaction(async (tx) => {
      // Void the entry
      await tx.income.update({
        where: { id },
        data: {
          isVoided: true,
          voidedById: req.user.id,
          voidedAt: new Date(),
          voidReason: reason
        }
      });

      // Reverse student balance if applicable
      if (existing.studentId && existing.termId) {
        await tx.studentBalance.update({
          where: { studentId_termId: { studentId: existing.studentId, termId: existing.termId } },
          data: {
            amountPaid: { decrement: parseFloat(existing.amount) }
          }
        });
      }
    });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'VOID',
      entityType: 'income',
      entityId: id,
      description: `Voided income: ${existing.receiptNumber} - Reason: ${reason}`,
      oldValues: existing,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Income entry voided successfully'
    });
  } catch (error) {
    logger.error('Void income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to void income entry'
    });
  }
};

// Get income summary
const getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const schoolId = req.user.schoolId;

    const dateFilter = {
      ...(startDate && { date: { gte: new Date(startDate) } }),
      ...(endDate && { date: { lte: new Date(endDate) } })
    };

    // Total income
    const totalResult = await prisma.income.aggregate({
      where: { schoolId, isVoided: false, ...dateFilter },
      _sum: { amount: true }
    });

    // Income by category
    const byCategory = await prisma.income.groupBy({
      by: ['categoryId'],
      where: { schoolId, isVoided: false, ...dateFilter },
      _sum: { amount: true },
      _count: true
    });

    // Get category names
    const categoryIds = byCategory.map(c => c.categoryId).filter(Boolean);
    const categories = await prisma.incomeCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const byCategoryWithNames = byCategory.map(item => ({
      name: categoryMap.get(item.categoryId)?.name || 'Uncategorized',
      color: categoryMap.get(item.categoryId)?.color || '#6B7280',
      total: parseFloat(item._sum.amount || 0),
      count: item._count
    }));

    // Income by payment method
    const byPaymentMethod = await prisma.income.groupBy({
      by: ['paymentMethod'],
      where: { schoolId, isVoided: false, ...dateFilter },
      _sum: { amount: true },
      _count: true
    });

    // Today's income
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayResult = await prisma.income.aggregate({
      where: {
        schoolId,
        isVoided: false,
        date: { gte: today, lt: tomorrow }
      },
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
        byCategory: byCategoryWithNames,
        byPaymentMethod: byPaymentMethod.map(item => ({
          paymentMethod: item.paymentMethod,
          total: parseFloat(item._sum.amount || 0),
          count: item._count
        }))
      }
    });
  } catch (error) {
    logger.error('Get income summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income summary'
    });
  }
};

// Get income categories
const getCategories = async (req, res) => {
  try {
    const categories = await prisma.incomeCategory.findMany({
      where: { schoolId: req.user.schoolId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Get income categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
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
