const prisma = require('../config/prisma');

// Get all payment plans
const getPaymentPlans = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const plans = await prisma.paymentPlan.findMany({
      where: { schoolId },
      include: {
        _count: { select: { studentPlans: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true, 
      data: plans.map(p => ({
        ...p,
        totalAmount: parseFloat(p.totalAmount),
        studentsEnrolled: p._count.studentPlans
      }))
    });
  } catch (error) {
    console.error('Get payment plans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create payment plan template
const createPaymentPlan = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { name, totalAmount, installments, termId } = req.body;

    if (!name || !totalAmount || !installments) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, total amount, and number of installments are required' 
      });
    }

    const plan = await prisma.paymentPlan.create({
      data: {
        name,
        totalAmount: parseFloat(totalAmount),
        installments: parseInt(installments),
        termId: termId || null,
        schoolId,
        createdBy: userId
      }
    });

    res.json({ 
      success: true, 
      data: { ...plan, totalAmount: parseFloat(plan.totalAmount) }
    });
  } catch (error) {
    console.error('Create payment plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete payment plan
const deletePaymentPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    // Check if plan has student enrollments
    const plan = await prisma.paymentPlan.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { studentPlans: true } } }
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Payment plan not found' });
    }

    if (plan._count.studentPlans > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete. ${plan._count.studentPlans} student(s) are enrolled in this plan.` 
      });
    }

    await prisma.paymentPlan.delete({ where: { id } });
    res.json({ success: true, message: 'Payment plan deleted' });
  } catch (error) {
    console.error('Delete payment plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign plan to student
const assignPlanToStudent = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { studentId, paymentPlanId, totalAmount, dueDates } = req.body;

    if (!studentId || !paymentPlanId || !dueDates || !Array.isArray(dueDates)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student ID, payment plan ID, and due dates array are required' 
      });
    }

    // Get the plan
    const plan = await prisma.paymentPlan.findFirst({
      where: { id: paymentPlanId, schoolId }
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Payment plan not found' });
    }

    // Check if student exists
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check if already assigned
    const existing = await prisma.studentPaymentPlan.findFirst({
      where: { studentId, paymentPlanId }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student is already enrolled in this payment plan' 
      });
    }

    const finalAmount = totalAmount ? parseFloat(totalAmount) : parseFloat(plan.totalAmount);
    const installmentAmount = finalAmount / dueDates.length;

    // Create student payment plan with installments
    const studentPlan = await prisma.studentPaymentPlan.create({
      data: {
        studentId,
        paymentPlanId,
        totalAmount: finalAmount,
        status: 'active',
        installments: {
          create: dueDates.map((dueDate, index) => ({
            installmentNumber: index + 1,
            amount: installmentAmount,
            dueDate: new Date(dueDate),
            status: 'pending',
            schoolId
          }))
        }
      },
      include: {
        installments: true,
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        paymentPlan: { select: { name: true } }
      }
    });

    res.json({ success: true, data: studentPlan });
  } catch (error) {
    console.error('Assign plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student's payment plans
const getStudentPaymentPlans = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schoolId } = req.user;

    const plans = await prisma.studentPaymentPlan.findMany({
      where: { 
        studentId,
        student: { schoolId }
      },
      include: {
        paymentPlan: { select: { name: true, installments: true } },
        installments: { orderBy: { installmentNumber: 'asc' } }
      }
    });

    res.json({ 
      success: true, 
      data: plans.map(p => ({
        ...p,
        totalAmount: parseFloat(p.totalAmount),
        installments: p.installments.map(i => ({
          ...i,
          amount: parseFloat(i.amount),
          paidAmount: parseFloat(i.paidAmount)
        }))
      }))
    });
  } catch (error) {
    console.error('Get student plans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all installments with filters
const getAllInstallments = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { status, upcoming, overdue } = req.query;

    let where = { schoolId };
    
    if (status) {
      where.status = status;
    }
    
    if (upcoming === 'true') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      where.dueDate = { lte: nextWeek, gte: new Date() };
      where.status = { in: ['pending', 'partial'] };
    }
    
    if (overdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { in: ['pending', 'partial', 'overdue'] };
    }

    const installments = await prisma.installment.findMany({
      where,
      include: {
        studentPaymentPlan: {
          include: {
            student: { 
              select: { 
                id: true,
                firstName: true, 
                lastName: true, 
                studentNumber: true,
                parentPhone: true,
                class: { select: { name: true } }
              } 
            },
            paymentPlan: { select: { name: true } }
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json({ 
      success: true, 
      data: installments.map(i => ({
        ...i,
        amount: parseFloat(i.amount),
        paidAmount: parseFloat(i.paidAmount),
        studentName: `${i.studentPaymentPlan.student.firstName} ${i.studentPaymentPlan.student.lastName}`,
        studentNumber: i.studentPaymentPlan.student.studentNumber,
        studentPhone: i.studentPaymentPlan.student.parentPhone,
        className: i.studentPaymentPlan.student.class?.name,
        planName: i.studentPaymentPlan.paymentPlan.name
      }))
    });
  } catch (error) {
    console.error('Get installments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Record installment payment
const recordInstallmentPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount required' });
    }

    const installment = await prisma.installment.findFirst({
      where: { id, schoolId }
    });

    if (!installment) {
      return res.status(404).json({ success: false, message: 'Installment not found' });
    }

    const newPaidAmount = parseFloat(installment.paidAmount) + parseFloat(amount);
    const installmentAmount = parseFloat(installment.amount);
    
    let newStatus = 'partial';
    if (newPaidAmount >= installmentAmount) {
      newStatus = 'paid';
    }

    const updated = await prisma.installment.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        paidDate: newStatus === 'paid' ? new Date() : installment.paidDate,
        status: newStatus
      }
    });

    // Check if all installments are paid, update student plan status
    const allInstallments = await prisma.installment.findMany({
      where: { studentPaymentPlanId: installment.studentPaymentPlanId }
    });

    const allPaid = allInstallments.every(i => 
      i.id === id ? newStatus === 'paid' : i.status === 'paid'
    );

    if (allPaid) {
      await prisma.studentPaymentPlan.update({
        where: { id: installment.studentPaymentPlanId },
        data: { status: 'completed' }
      });
    }

    res.json({ 
      success: true, 
      data: { ...updated, amount: parseFloat(updated.amount), paidAmount: parseFloat(updated.paidAmount) },
      message: newStatus === 'paid' ? 'Installment fully paid!' : 'Payment recorded'
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment plan summary
const getPaymentPlanSummary = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const activePlans = await prisma.studentPaymentPlan.count({
      where: { 
        status: 'active',
        student: { schoolId }
      }
    });

    const overdueInstallments = await prisma.installment.count({
      where: {
        schoolId,
        status: { in: ['pending', 'partial', 'overdue'] },
        dueDate: { lt: new Date() }
      }
    });

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingInstallments = await prisma.installment.count({
      where: {
        schoolId,
        status: { in: ['pending', 'partial'] },
        dueDate: { gte: new Date(), lte: nextWeek }
      }
    });

    const totalExpected = await prisma.installment.aggregate({
      where: { schoolId },
      _sum: { amount: true }
    });

    const totalCollected = await prisma.installment.aggregate({
      where: { schoolId },
      _sum: { paidAmount: true }
    });

    res.json({
      success: true,
      data: {
        activePlans,
        overdueInstallments,
        upcomingInstallments,
        totalExpected: parseFloat(totalExpected._sum.amount || 0),
        totalCollected: parseFloat(totalCollected._sum.paidAmount || 0)
      }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send installment reminder
const sendInstallmentReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, id: userId, fullName } = req.user;

    const installment = await prisma.installment.findFirst({
      where: { id, schoolId },
      include: {
        studentPaymentPlan: {
          include: {
            student: { select: { firstName: true, lastName: true, parentPhone: true } },
            paymentPlan: { select: { name: true } }
          }
        }
      }
    });

    if (!installment) {
      return res.status(404).json({ success: false, message: 'Installment not found' });
    }

    const phone = installment.studentPaymentPlan.student.parentPhone;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'No parent phone number available' });
    }

    const studentName = `${installment.studentPaymentPlan.student.firstName} ${installment.studentPaymentPlan.student.lastName}`;
    const planName = installment.studentPaymentPlan.paymentPlan.name;
    const amount = parseFloat(installment.amount) - parseFloat(installment.paidAmount);
    const dueDate = new Date(installment.dueDate).toLocaleDateString();

    const message = `Dear Parent, this is a reminder that ${studentName}'s installment #${installment.installmentNumber} of ${planName} (UGX ${amount.toLocaleString()}) is due on ${dueDate}. Please ensure payment. Thank you.`;

    // Get school's EgoSMS settings
    const settings = await prisma.setting.findMany({
      where: { schoolId, key: { in: ['egosms_username', 'egosms_password', 'egosms_sender_id'] } }
    });
    
    const smsConfig = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    if (!smsConfig.egosms_username || !smsConfig.egosms_password) {
      return res.status(400).json({ success: false, message: 'SMS not configured. Please set up EgoSMS in settings.' });
    }

    // Send SMS via EgoSMS
    const axios = require('axios');
    const smsResponse = await axios.get('https://www.egosms.co/api/v1/plain/', {
      params: {
        username: smsConfig.egosms_username,
        password: smsConfig.egosms_password,
        sender: smsConfig.egosms_sender_id || 'SCHOOL',
        number: phone.replace(/^\+/, ''),
        message: message
      }
    });

    // Log SMS
    await prisma.smsLog.create({
      data: {
        phone,
        message,
        studentName,
        status: smsResponse.data.includes('OK') ? 'sent' : 'failed',
        response: smsResponse.data,
        sentBy: fullName,
        schoolId
      }
    });

    // Mark reminder sent
    await prisma.installment.update({
      where: { id },
      data: { 
        reminderSent: true, 
        reminderSentAt: new Date() 
      }
    });

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update overdue statuses
const updateOverdueStatuses = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const result = await prisma.installment.updateMany({
      where: {
        schoolId,
        status: { in: ['pending', 'partial'] },
        dueDate: { lt: new Date() }
      },
      data: { status: 'overdue' }
    });

    res.json({ 
      success: true, 
      message: `${result.count} installments marked as overdue` 
    });
  } catch (error) {
    console.error('Update overdue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPaymentPlans,
  createPaymentPlan,
  deletePaymentPlan,
  assignPlanToStudent,
  getStudentPaymentPlans,
  getAllInstallments,
  recordInstallmentPayment,
  getPaymentPlanSummary,
  sendInstallmentReminder,
  updateOverdueStatuses
};