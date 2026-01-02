const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');
const incomeController = require('../controllers/incomeController');
const expenseController = require('../controllers/expenseController');
const studentController = require('../controllers/studentController');
const reportController = require('../controllers/reportController');
const smsController = require('../controllers/smsController');
const { getAuditLogs } = require('../middleware/audit');

// Import middleware
const { authenticate, authorize, checkPermission, rateLimit } = require('../middleware/auth');
const { loginValidation, incomeValidation, expenseValidation, studentValidation, passwordValidation } = require('../middleware/validation');

// Import Prisma for dashboard
const prisma = require('../config/prisma');

// ==================== AUTH ROUTES ====================
router.post('/auth/login', 
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many login attempts' }),
  loginValidation, 
  authController.login
);
router.post('/auth/refresh', authController.refreshToken);
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/change-password', authenticate, passwordValidation, authController.changePassword);
router.get('/auth/profile', authenticate, authController.getProfile);

// ==================== INCOME ROUTES ====================
router.get('/income', authenticate, checkPermission('income', 'read'), incomeController.getAll);
router.get('/income/summary', authenticate, checkPermission('income', 'read'), incomeController.getSummary);
router.get('/income/categories', authenticate, incomeController.getCategories);
router.get('/income/:id', authenticate, checkPermission('income', 'read'), incomeController.getById);
router.post('/income', authenticate, checkPermission('income', 'create'), incomeValidation, incomeController.create);
router.put('/income/:id', authenticate, checkPermission('income', 'update'), incomeValidation, incomeController.update);
router.post('/income/:id/void', authenticate, authorize('super_admin'), incomeController.voidEntry);

// ==================== EXPENSE ROUTES ====================
router.get('/expenses', authenticate, checkPermission('expense', 'read'), expenseController.getAll);
router.get('/expenses/summary', authenticate, checkPermission('expense', 'read'), expenseController.getSummary);
router.get('/expenses/categories', authenticate, expenseController.getCategories);
router.get('/expenses/:id', authenticate, checkPermission('expense', 'read'), expenseController.getById);
router.post('/expenses', authenticate, checkPermission('expense', 'create'), expenseValidation, expenseController.create);
router.put('/expenses/:id', authenticate, checkPermission('expense', 'update'), expenseValidation, expenseController.update);
router.post('/expenses/:id/void', authenticate, authorize('super_admin'), expenseController.voidEntry);

// ==================== STUDENT ROUTES ====================
router.get('/students', authenticate, checkPermission('students', 'read'), studentController.getAll);
router.get('/students/search', authenticate, studentController.search);
router.get('/students/balances', authenticate, checkPermission('students', 'read'), studentController.getAllWithBalances);
router.get('/students/classes', authenticate, studentController.getClasses);
router.get('/students/:id', authenticate, checkPermission('students', 'read'), studentController.getById);
router.get('/students/:id/balance', authenticate, checkPermission('students', 'read'), studentController.getBalance);
router.get('/students/:id/payments', authenticate, checkPermission('students', 'read'), studentController.getPayments);
router.post('/students/:id/payments', authenticate, checkPermission('income', 'create'), studentController.recordPayment);
router.post('/students', authenticate, checkPermission('students', 'create'), studentValidation, studentController.create);
router.put('/students/:id', authenticate, checkPermission('students', 'update'), studentValidation, studentController.update);
router.post('/students/promote', authenticate, authorize('super_admin', 'director'), studentController.promoteStudents);

// ==================== FEES ROUTES ====================
router.get('/fees/payments/recent', authenticate, async (req, res) => {
  try {
    const payments = await prisma.income.findMany({
      where: { 
        schoolId: req.user.schoolId, 
        isVoided: false,
        studentId: { not: null }
      },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        category: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      data: payments.map(p => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        date: p.date,
        amount: parseFloat(p.amount),
        paymentMethod: p.paymentMethod,
        description: p.description,
        student: p.student,
        categoryName: p.category?.name
      }))
    });
  } catch (error) {
    console.error('Recent payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent payments' });
  }
});

// ==================== SMS ROUTES ====================
router.post('/sms/send', authenticate, checkPermission('income', 'create'), smsController.sendSms);
router.post('/sms/send-bulk', authenticate, checkPermission('income', 'create'), smsController.sendBulkSms);
router.get('/sms/history', authenticate, smsController.getHistory);
router.get('/sms/stats', authenticate, smsController.getStats);
router.get('/sms/defaulters', authenticate, smsController.getDefaulters);

// ==================== REPORT ROUTES ====================
router.get('/reports', authenticate, checkPermission('reports', 'read'), reportController.getAll);
router.get('/reports/daily', authenticate, checkPermission('reports', 'create'), reportController.generateDaily);
router.get('/reports/monthly', authenticate, checkPermission('reports', 'create'), reportController.generateMonthly);
router.get('/reports/range', authenticate, checkPermission('reports', 'create'), reportController.generateRange);
router.delete('/reports/:id', authenticate, authorize('super_admin'), reportController.deleteReport);

// ==================== DASHBOARD ROUTES ====================
router.get('/dashboard/summary', authenticate, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's income
    const todayIncome = await prisma.income.aggregate({
      where: { schoolId, isVoided: false, date: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
      _count: true
    });

    // Today's expenses
    const todayExpense = await prisma.expense.aggregate({
      where: { schoolId, isVoided: false, date: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
      _count: true
    });

    // Overall totals
    const totalIncome = await prisma.income.aggregate({
      where: { schoolId, isVoided: false },
      _sum: { amount: true }
    });

    const totalExpense = await prisma.expense.aggregate({
      where: { schoolId, isVoided: false },
      _sum: { amount: true }
    });

    // Student counts
    const studentStats = await prisma.student.aggregate({
      where: { schoolId },
      _count: true
    });

    const activeStudents = await prisma.student.count({
      where: { schoolId, isActive: true }
    });

    // Recent transactions
    const recentIncome = await prisma.income.findMany({
      where: { schoolId, isVoided: false },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentExpenses = await prisma.expense.findMany({
      where: { schoolId, isVoided: false },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: {
        today: {
          income: parseFloat(todayIncome._sum.amount || 0),
          incomeCount: todayIncome._count || 0,
          expense: parseFloat(todayExpense._sum.amount || 0),
          expenseCount: todayExpense._count || 0,
          net: parseFloat(todayIncome._sum.amount || 0) - parseFloat(todayExpense._sum.amount || 0)
        },
        overall: {
          totalIncome: parseFloat(totalIncome._sum.amount || 0),
          totalExpense: parseFloat(totalExpense._sum.amount || 0),
          balance: parseFloat(totalIncome._sum.amount || 0) - parseFloat(totalExpense._sum.amount || 0)
        },
        students: {
          total: studentStats._count || 0,
          active: activeStudents
        },
        recentTransactions: {
          income: recentIncome.map(i => ({
            id: i.id,
            receiptNumber: i.receiptNumber,
            date: i.date,
            description: i.description,
            amount: parseFloat(i.amount),
            categoryName: i.category?.name
          })),
          expenses: recentExpenses.map(e => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: parseFloat(e.amount),
            categoryName: e.category?.name
          }))
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

// ==================== SETTINGS ROUTES ====================
router.get('/settings', authenticate, async (req, res) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.user.schoolId }
    });

    const settings = await prisma.setting.findMany({
      where: { schoolId: req.user.schoolId }
    });

    res.json({
      success: true,
      data: {
        school,
        settings: settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.get('/terms', authenticate, async (req, res) => {
  try {
    const terms = await prisma.academicTerm.findMany({
      where: { schoolId: req.user.schoolId },
      include: { academicYear: { select: { year: true, name: true } } },
      orderBy: [{ academicYear: { year: 'desc' } }, { termNumber: 'asc' }]
    });

    res.json({
      success: true,
      data: terms.map(t => ({
        ...t,
        yearName: t.academicYear?.name
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch terms' });
  }
});

router.get('/terms/current', authenticate, async (req, res) => {
  try {
    const term = await prisma.academicTerm.findFirst({
      where: { schoolId: req.user.schoolId, isCurrent: true },
      include: { academicYear: { select: { year: true, name: true } } }
    });

    if (!term) {
      return res.status(404).json({ success: false, message: 'No current term found' });
    }

    res.json({
      success: true,
      data: { ...term, yearName: term.academicYear?.name }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch current term' });
  }
});

// ==================== AUDIT ROUTES ====================
router.get('/audit-logs', authenticate, authorize('super_admin', 'director'), getAuditLogs);

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

module.exports = router;