const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// Import controllers
const authController = require('../controllers/authController');
const incomeController = require('../controllers/incomeController');
const expenseController = require('../controllers/expenseController');
const studentController = require('../controllers/studentController');
const reportController = require('../controllers/reportController');
const smsController = require('../controllers/smsController');
const budgetController = require('../controllers/budgetController');
const paymentPlanController = require('../controllers/paymentPlanController');
const permissionController = require('../controllers/permissionController');
const emailController = require('../controllers/emailController');
const { getAuditLogs } = require('../middleware/audit');

// Import middleware
const { authenticate, authorize, checkPermission, rateLimit } = require('../middleware/auth');
const { loginValidation, incomeValidation, expenseValidation, studentValidation, passwordValidation } = require('../middleware/validation');

// Import Prisma for dashboard
const prisma = require('../config/prisma');

// Receipts directory
const receiptsDir = path.join(__dirname, '../public/receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

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

// ==================== WHATSAPP ROUTES ====================

// Generate PDF Receipt and return URL
router.post('/whatsapp/generate-receipt-pdf/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const schoolId = req.user.schoolId;

    // Get payment with student info
    const payment = await prisma.income.findFirst({
      where: { id: paymentId, schoolId },
      include: {
        student: {
          include: { class: true }
        },
        category: true
      }
    });

    if (!payment) {
      return res.json({ success: false, message: 'Payment not found' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    // Generate unique filename
    const safeReceiptNumber = payment.receiptNumber.replace(/[\/\\:*?"<>|]/g, '-');
    const filename = `receipt_${safeReceiptNumber}_${Date.now()}.pdf`;
    const filepath = path.join(receiptsDir, filename);
    const baseUrl = process.env.BASE_URL || 'https://qm-financemanagement-production.up.railway.app';
    const publicUrl = `${baseUrl}/receipts/${filename}`;

    // Create PDF
    const doc = new PDFDocument({ size: 'A6', margin: 20 });
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(14).font('Helvetica-Bold')
       .text(school?.name || 'QUEEN MOTHER JUNIOR SCHOOL', { align: 'center' });
    doc.fontSize(8).font('Helvetica')
       .text(school?.address || 'Namasuba Kikajjo, Kampala, Uganda', { align: 'center' })
       .text(`Tel: ${school?.phone || '0200 939 322'}`, { align: 'center' });
    
    doc.moveDown(0.5);
    
    // Receipt Title
    doc.fontSize(12).font('Helvetica-Bold')
       .fillColor('#059669')
       .text('PAYMENT RECEIPT', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fillColor('#000000');

    // Receipt Details
    doc.fontSize(9).font('Helvetica-Bold').text('Receipt No: ', { continued: true })
       .font('Helvetica').text(payment.receiptNumber);
    
    doc.font('Helvetica-Bold').text('Date: ', { continued: true })
       .font('Helvetica').text(new Date(payment.date || payment.createdAt).toLocaleDateString('en-GB'));
    
    doc.moveDown(0.3);
    
    if (payment.student) {
      doc.font('Helvetica-Bold').text('Student: ', { continued: true })
         .font('Helvetica').text(`${payment.student.firstName} ${payment.student.lastName}`);
      
      doc.font('Helvetica-Bold').text('Class: ', { continued: true })
         .font('Helvetica').text(payment.student.class?.name || 'N/A');
      
      doc.font('Helvetica-Bold').text('Student No: ', { continued: true })
         .font('Helvetica').text(payment.student.studentNumber || 'N/A');
    }

    if (payment.category) {
      doc.font('Helvetica-Bold').text('Category: ', { continued: true })
         .font('Helvetica').text(payment.category.name);
    }

    doc.moveDown(0.5);

    // Amount Box
    const amountBoxY = doc.y;
    doc.rect(20, amountBoxY, doc.page.width - 40, 40).fill('#059669');
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
       .text('AMOUNT PAID', 20, amountBoxY + 5, { align: 'center' });
    doc.fontSize(16)
       .text(`UGX ${Number(payment.amount).toLocaleString()}`, 20, amountBoxY + 20, { align: 'center' });
    
    doc.fillColor('#000000');
    doc.y = amountBoxY + 50;

    // Payment Method
    doc.fontSize(9).font('Helvetica-Bold').text('Payment Method: ', { continued: true })
       .font('Helvetica').text((payment.paymentMethod || 'CASH').replace('_', ' ').toUpperCase());

    // Description
    if (payment.description) {
      doc.font('Helvetica-Bold').text('Description: ', { continued: true })
         .font('Helvetica').text(payment.description);
    }

    doc.moveDown(0.5);

    // QR Code for verification
    const verifyUrl = `${baseUrl}/api/verify/${encodeURIComponent(payment.receiptNumber)}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1 });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrBuffer, (doc.page.width - 60) / 2, doc.y, { width: 60 });
      doc.moveDown(4);
      doc.fontSize(6).text('Scan to verify receipt', { align: 'center' });
    } catch (qrError) {
      console.error('QR generation error:', qrError);
    }

    // Footer
    doc.moveDown(0.5);
    doc.fontSize(7).font('Helvetica')
       .text('Thank you for your payment!', { align: 'center' })
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();

    // Wait for PDF to finish writing
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Get parent phone
    const phone = payment.student?.parentPhone || payment.student?.parentPhoneAlt || null;

    res.json({
      success: true,
      data: {
        url: publicUrl,
        filename,
        receiptNumber: payment.receiptNumber,
        studentName: payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'N/A',
        amount: payment.amount,
        phone
      }
    });

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Get WhatsApp link for receipt
router.get('/whatsapp/receipt-link/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const schoolId = req.user.schoolId;

    const payment = await prisma.income.findFirst({
      where: { id: paymentId, schoolId },
      include: {
        student: { include: { class: true } }
      }
    });

    if (!payment) {
      return res.json({ success: false, message: 'Payment not found' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const studentName = payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'N/A';
    const phone = payment.student?.parentPhone || payment.student?.parentPhoneAlt;
    const formattedPhone = phone ? phone.replace(/^0/, '256').replace(/[^0-9]/g, '') : null;

    // Generate message
    const message = `🏫 *${school?.name || 'QUEEN MOTHER JUNIOR SCHOOL'}*\n\n` +
      `✅ *PAYMENT RECEIPT*\n\n` +
      `📄 Receipt No: ${payment.receiptNumber}\n` +
      `👤 Student: ${studentName}\n` +
      `📚 Class: ${payment.student?.class?.name || 'N/A'}\n` +
      `💰 Amount: UGX ${Number(payment.amount).toLocaleString()}\n` +
      `📅 Date: ${new Date(payment.date || payment.createdAt).toLocaleDateString('en-GB')}\n\n` +
      `Thank you for your payment! 🙏`;

    const whatsappUrl = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    res.json({
      success: true,
      data: {
        whatsappUrl,
        message,
        phone: formattedPhone,
        studentName,
        receiptNumber: payment.receiptNumber
      }
    });

  } catch (error) {
    console.error('WhatsApp link error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Get WhatsApp reminder link for student
router.post('/whatsapp/reminder-link', authenticate, async (req, res) => {
  try {
    const { studentId, customMessage } = req.body;
    const schoolId = req.user.schoolId;

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: { class: true }
    });

    if (!student) {
      return res.json({ success: false, message: 'Student not found' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    // Calculate balance
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { classId: student.classId, isActive: true }
    });
    const totalFees = feeStructure ? Number(feeStructure.amount) : 0;
    
    const payments = await prisma.income.aggregate({
      where: { studentId, schoolId, isVoided: false },
      _sum: { amount: true }
    });
    const totalPaid = payments._sum.amount ? Number(payments._sum.amount) : 0;
    const balance = totalFees - totalPaid;

    const phone = student.parentPhone || student.parentPhoneAlt;
    const formattedPhone = phone ? phone.replace(/^0/, '256').replace(/[^0-9]/g, '') : null;
    const studentName = `${student.firstName} ${student.lastName}`;
    
    // Default or custom message
    const message = customMessage || 
      `🏫 *${school?.name || 'QUEEN MOTHER JUNIOR SCHOOL'}*\n\n` +
      `Dear Parent/Guardian,\n\n` +
      `This is a friendly reminder regarding school fees for:\n\n` +
      `👤 Student: ${studentName}\n` +
      `📚 Class: ${student.class?.name || 'N/A'}\n` +
      `💰 Outstanding Balance: *UGX ${balance.toLocaleString()}*\n\n` +
      `Kindly clear the balance at your earliest convenience.\n\n` +
      `For inquiries, contact: ${school?.phone || '0200 939 322'}\n\n` +
      `Thank you! 🙏`;

    const whatsappUrl = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    res.json({
      success: true,
      data: {
        whatsappUrl,
        message,
        phone: formattedPhone,
        studentName,
        balance
      }
    });

  } catch (error) {
    console.error('WhatsApp reminder error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Bulk WhatsApp reminders (returns list of links)
router.post('/whatsapp/bulk-reminder-links', authenticate, async (req, res) => {
  try {
    const { studentIds, customMessage } = req.body;
    const schoolId = req.user.schoolId;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.json({ success: false, message: 'No students selected' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId },
      include: { class: true }
    });

    const links = [];

    for (const student of students) {
      // Calculate balance
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { classId: student.classId, isActive: true }
      });
      const totalFees = feeStructure ? Number(feeStructure.amount) : 0;
      
      const payments = await prisma.income.aggregate({
        where: { studentId: student.id, schoolId, isVoided: false },
        _sum: { amount: true }
      });
      const totalPaid = payments._sum.amount ? Number(payments._sum.amount) : 0;
      const balance = totalFees - totalPaid;

      const phone = student.parentPhone || student.parentPhoneAlt;
      if (!phone) continue;

      const formattedPhone = phone.replace(/^0/, '256').replace(/[^0-9]/g, '');
      const studentName = `${student.firstName} ${student.lastName}`;

      const message = customMessage
        ? customMessage
            .replace(/{student}/g, studentName)
            .replace(/{balance}/g, `UGX ${balance.toLocaleString()}`)
            .replace(/{class}/g, student.class?.name || 'N/A')
        : `🏫 ${school?.name || 'QMJS'}: Dear Parent, ${studentName} has an outstanding balance of UGX ${balance.toLocaleString()}. Kindly clear fees. Contact: ${school?.phone || '0200939322'}`;

      links.push({
        studentId: student.id,
        studentName,
        phone: formattedPhone,
        balance,
        whatsappUrl: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`,
        message
      });
    }

    res.json({
      success: true,
      data: links,
      count: links.length
    });

  } catch (error) {
    console.error('Bulk WhatsApp error:', error);
    res.json({ success: false, message: error.message });
  }
});

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

// ==================== BUDGET ROUTES ====================
router.get('/budgets', authenticate, budgetController.getBudgets);
router.post('/budgets', authenticate, budgetController.upsertBudget);
router.post('/budgets/bulk', authenticate, budgetController.setBulkBudgets);
router.delete('/budgets/:id', authenticate, budgetController.deleteBudget);
router.get('/budgets/summary', authenticate, budgetController.getBudgetSummary);

// ==================== PERMISSION & ROLE ROUTES ====================
router.get('/roles', authenticate, permissionController.getRoles);
router.post('/roles', authenticate, permissionController.createRole);
router.put('/roles/:id', authenticate, permissionController.updateRole);
router.delete('/roles/:id', authenticate, permissionController.deleteRole);
router.get('/permissions/templates', authenticate, permissionController.getPermissionTemplates);
router.post('/roles/initialize', authenticate, permissionController.initializeDefaultRoles);
router.post('/roles/assign', authenticate, permissionController.assignRoleToUser);
router.get('/users/with-roles', authenticate, permissionController.getUsersWithRoles);
router.get('/permissions/me', authenticate, permissionController.getMyPermissions);

// ==================== PAYMENT PLAN ROUTES ====================
router.get('/payment-plans', authenticate, paymentPlanController.getPaymentPlans);
router.post('/payment-plans', authenticate, paymentPlanController.createPaymentPlan);
router.delete('/payment-plans/:id', authenticate, paymentPlanController.deletePaymentPlan);
router.post('/payment-plans/assign', authenticate, paymentPlanController.assignPlanToStudent);
router.get('/payment-plans/summary', authenticate, paymentPlanController.getPaymentPlanSummary);
router.get('/payment-plans/student/:studentId', authenticate, paymentPlanController.getStudentPaymentPlans);
router.get('/installments', authenticate, paymentPlanController.getAllInstallments);
router.post('/installments/:id/pay', authenticate, paymentPlanController.recordInstallmentPayment);
router.post('/installments/:id/remind', authenticate, paymentPlanController.sendInstallmentReminder);
router.post('/installments/update-overdue', authenticate, paymentPlanController.updateOverdueStatuses);

// ==================== RECEIPT VERIFICATION ====================
// Public route - no auth needed (for parents to verify)
router.get('/verify/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    
    const income = await prisma.income.findFirst({
      where: { receiptNumber },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        school: { select: { name: true, phone: true } },
        category: { select: { name: true } }
      }
    });

    if (!income) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'Receipt not found. This may be a fraudulent receipt.'
      });
    }

    if (income.isVoided) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'This receipt has been VOIDED and is no longer valid.',
        voidedAt: income.voidedAt,
        voidReason: income.voidReason
      });
    }

    res.json({
      success: true,
      verified: true,
      message: 'Receipt verified successfully!',
      data: {
        receiptNumber: income.receiptNumber,
        date: income.date,
        amount: parseFloat(income.amount),
        description: income.description,
        paymentMethod: income.paymentMethod,
        studentName: income.student ? `${income.student.firstName} ${income.student.lastName}` : null,
        studentNumber: income.student?.studentNumber,
        category: income.category?.name,
        schoolName: income.school?.name,
        schoolPhone: income.school?.phone
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'Verification failed. Please contact the school.'
    });
  }
});

// ==================== EMAIL ROUTES ====================
router.post('/email/send-receipt', authenticate, emailController.sendReceiptEmail);
router.post('/email/send-reminder', authenticate, emailController.sendFeeReminderEmail);
router.post('/email/test', authenticate, emailController.testEmailConfig);
router.get('/email/settings', authenticate, emailController.getEmailSettings);
router.post('/email/settings', authenticate, emailController.saveEmailSettings);

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

module.exports = router;