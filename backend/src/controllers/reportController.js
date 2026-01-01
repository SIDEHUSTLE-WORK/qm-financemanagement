const prisma = require('../config/prisma');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

// Get all saved reports
const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, reportType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      schoolId: req.user.schoolId,
      ...(reportType && { reportType })
    };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: { generatedBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.report.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        reports: reports.map(r => ({
          ...r,
          generatedByName: r.generatedBy?.fullName
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

// Generate daily report
const generateDaily = async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date ? new Date(date) : new Date();
    reportDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const schoolId = req.user.schoolId;

    // Get income
    const income = await prisma.income.findMany({
      where: {
        schoolId,
        isVoided: false,
        date: { gte: reportDate, lt: nextDay }
      },
      include: {
        category: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: {
        schoolId,
        isVoided: false,
        date: { gte: reportDate, lt: nextDay }
      },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'asc' }
    });

    const totalIncome = income.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Group by category
    const incomeByCategory = {};
    income.forEach(i => {
      const cat = i.category?.name || 'Uncategorized';
      if (!incomeByCategory[cat]) incomeByCategory[cat] = { total: 0, count: 0 };
      incomeByCategory[cat].total += parseFloat(i.amount);
      incomeByCategory[cat].count++;
    });

    const expenseByCategory = {};
    expenses.forEach(e => {
      const cat = e.category?.name || 'Uncategorized';
      if (!expenseByCategory[cat]) expenseByCategory[cat] = { total: 0, count: 0 };
      expenseByCategory[cat].total += parseFloat(e.amount);
      expenseByCategory[cat].count++;
    });

    const summary = {
      date: reportDate.toISOString().split('T')[0],
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      incomeCount: income.length,
      expenseCount: expenses.length
    };

    // Save report
    const report = await prisma.report.create({
      data: {
        schoolId,
        reportType: 'daily',
        title: `Daily Report - ${reportDate.toISOString().split('T')[0]}`,
        dateFrom: reportDate,
        dateTo: reportDate,
        generatedById: req.user.id,
        parameters: { date: reportDate.toISOString().split('T')[0] },
        summary
      }
    });

    await createAuditLog({
      schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'CREATE',
      entityType: 'report',
      entityId: report.id,
      description: `Generated daily report for ${reportDate.toISOString().split('T')[0]}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        reportId: report.id,
        summary,
        income: {
          items: income.map(i => ({
            ...i,
            amount: parseFloat(i.amount),
            categoryName: i.category?.name,
            studentName: i.student ? `${i.student.firstName} ${i.student.lastName}` : null
          })),
          byCategory: incomeByCategory
        },
        expenses: {
          items: expenses.map(e => ({
            ...e,
            amount: parseFloat(e.amount),
            categoryName: e.category?.name
          })),
          byCategory: expenseByCategory
        }
      }
    });
  } catch (error) {
    logger.error('Generate daily report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// Generate monthly report
const generateMonthly = async (req, res) => {
  try {
    const { year, month } = req.query;
    const reportYear = parseInt(year) || new Date().getFullYear();
    const reportMonth = parseInt(month) || new Date().getMonth() + 1;

    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);
    const schoolId = req.user.schoolId;

    // Get income by day
    const income = await prisma.income.groupBy({
      by: ['date'],
      where: {
        schoolId,
        isVoided: false,
        date: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true },
      _count: true
    });

    // Get expense by day
    const expenses = await prisma.expense.groupBy({
      by: ['date'],
      where: {
        schoolId,
        isVoided: false,
        date: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true },
      _count: true
    });

    // Get by category
    const incomeByCategory = await prisma.income.groupBy({
      by: ['categoryId'],
      where: { schoolId, isVoided: false, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true
    });

    const expenseByCategory = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: { schoolId, isVoided: false, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true
    });

    // Get category names
    const incomeCatIds = incomeByCategory.map(c => c.categoryId).filter(Boolean);
    const expenseCatIds = expenseByCategory.map(c => c.categoryId).filter(Boolean);
    
    const [incomeCategories, expenseCategories] = await Promise.all([
      prisma.incomeCategory.findMany({ where: { id: { in: incomeCatIds } } }),
      prisma.expenseCategory.findMany({ where: { id: { in: expenseCatIds } } })
    ]);

    const incomeCatMap = new Map(incomeCategories.map(c => [c.id, c.name]));
    const expenseCatMap = new Map(expenseCategories.map(c => [c.id, c.name]));

    const totalIncome = incomeByCategory.reduce((sum, c) => sum + parseFloat(c._sum.amount || 0), 0);
    const totalExpense = expenseByCategory.reduce((sum, c) => sum + parseFloat(c._sum.amount || 0), 0);

    const monthName = new Date(reportYear, reportMonth - 1, 1).toLocaleString('default', { month: 'long' });

    const summary = {
      year: reportYear,
      month: reportMonth,
      monthName,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense
    };

    // Save report
    const report = await prisma.report.create({
      data: {
        schoolId,
        reportType: 'monthly',
        title: `Monthly Report - ${monthName} ${reportYear}`,
        dateFrom: startDate,
        dateTo: endDate,
        generatedById: req.user.id,
        parameters: { year: reportYear, month: reportMonth },
        summary
      }
    });

    res.json({
      success: true,
      data: {
        reportId: report.id,
        summary,
        dailyBreakdown: {
          income: income.map(i => ({ date: i.date, total: parseFloat(i._sum.amount || 0), count: i._count })),
          expenses: expenses.map(e => ({ date: e.date, total: parseFloat(e._sum.amount || 0), count: e._count }))
        },
        categoryBreakdown: {
          income: incomeByCategory.map(c => ({
            name: incomeCatMap.get(c.categoryId) || 'Uncategorized',
            total: parseFloat(c._sum.amount || 0),
            count: c._count
          })),
          expenses: expenseByCategory.map(c => ({
            name: expenseCatMap.get(c.categoryId) || 'Uncategorized',
            total: parseFloat(c._sum.amount || 0),
            count: c._count
          }))
        }
      }
    });
  } catch (error) {
    logger.error('Generate monthly report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// Generate range report
const generateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start and end date required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    const schoolId = req.user.schoolId;

    const [income, expenses] = await Promise.all([
      prisma.income.findMany({
        where: { schoolId, isVoided: false, date: { gte: start, lte: end } },
        include: {
          category: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
      }),
      prisma.expense.findMany({
        where: { schoolId, isVoided: false, date: { gte: start, lte: end } },
        include: { category: { select: { name: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
      })
    ]);

    const totalIncome = income.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const summary = {
      startDate: startDate,
      endDate: endDate,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      incomeCount: income.length,
      expenseCount: expenses.length
    };

    const report = await prisma.report.create({
      data: {
        schoolId,
        reportType: 'range',
        title: `Report: ${startDate} to ${endDate}`,
        dateFrom: start,
        dateTo: end,
        generatedById: req.user.id,
        parameters: { startDate, endDate },
        summary
      }
    });

    res.json({
      success: true,
      data: {
        reportId: report.id,
        summary,
        income: income.map(i => ({
          ...i,
          amount: parseFloat(i.amount),
          categoryName: i.category?.name,
          studentName: i.student ? `${i.student.firstName} ${i.student.lastName}` : null
        })),
        expenses: expenses.map(e => ({
          ...e,
          amount: parseFloat(e.amount),
          categoryName: e.category?.name
        }))
      }
    });
  } catch (error) {
    logger.error('Generate range report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// Delete report
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.report.findFirst({
      where: { id, schoolId: req.user.schoolId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await prisma.report.delete({ where: { id } });

    await createAuditLog({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'DELETE',
      entityType: 'report',
      entityId: id,
      description: `Deleted report: ${existing.title}`,
      oldValues: existing,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    logger.error('Delete report error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete report' });
  }
};

module.exports = {
  getAll,
  generateDaily,
  generateMonthly,
  generateRange,
  deleteReport
};
