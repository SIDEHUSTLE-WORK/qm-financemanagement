const prisma = require('../config/prisma');

// Get all payment plan templates
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

    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get payment plans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create payment plan template
const createPaymentPlan = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { name, totalAmount, installments, termId } = req.body;

    if (!name || !totalAmount || !installments) {
      return res.status(400).json({ success: false, message: 'Name, total amount, and installments required' });
    }

    const plan = await prisma.paymentPlan.create({
      data: {
        schoolId,
        name,
        totalAmount: parseFloat(totalAmount),
        installments: parseInt(installments),
        termId: termId || null
      }
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Create payment plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete payment plan
const deletePaymentPlan = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    // Check if students are enrolled
    const enrolledCount = await prisma.studentPaymentPlan.count({
      where: { paymentPlanId: id }
    });

    if (enrolledCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete: ${enrolledCount} students enrolled in this plan` 
      });
    }

    await prisma.paymentPlan.delete({
      where: { id, schoolId }
    });

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
    const { studentId, paymentPlanId, customAmount, dueDates } = req.body;

    if (!studentId || !paymentPlanId || !dueDates || dueDates.length === 0) {
      return res.status(400).json({ success: false, message: 'Student, plan, and due dates required' });
    }

    // Get the plan
    const plan = await prisma.paymentPlan.findFirst({
      where: { id: paymentPlanId, schoolId }
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Payment plan not found' });
    }

    const totalAmount = customAmount ? parseFloat(customAmount) : parseFloat(plan.totalAmount);
    const installmentAmount = totalAmount / dueDates.length;

    // Create student payment plan
    const studentPlan = await prisma.studentPaymentPlan.create({
      data: {
        schoolId,
        studentId,
        paymentPlanId,
        totalAmount,
        status: 'active'
      }
    });

    // Create installments
    const installments = dueDates.map((dueDate, index) => ({
      schoolId,
      studentPaymentPlanId: studentPlan.id,
      installmentNumber: index + 1,
      amount: installmentAmount,
      dueDate: new Date(dueDate),
      status: 'pending',
      paidAmount: 0
    }));

    await prisma.installment.createMany({ data: installments });

    res.json({ success: true, data: studentPlan, message: 'Plan assigned successfully' });
  } catch (error) {
    console.error('Assign plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student's payment plans
const getStudentPaymentPlans = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;

    const plans = await prisma.studentPaymentPlan.findMany({
      where: { studentId, schoolId },
      include: {
        paymentPlan: true,
        installments: { orderBy: { installmentNumber: 'asc' } }
      }
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get student plans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all installments with filters
const getAllInstallments = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { status, overdue, upcoming } = req.query;

    const where = { schoolId };
    
    if (status) where.status = status;
    
    if (overdue === 'true') {
      where.status = { in: ['pending', 'partial'] };
      where.dueDate = { lt: new Date() };
    }
    
    if (upcoming === 'true') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      where.status = { in: ['pending', 'partial'] };
      where.dueDate = { gte: new Date(), lte: nextWeek };
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

    // Format response
    const formatted = installments.map(inst => ({
      id: inst.id,
      installmentNumber: inst.installmentNumber,
      amount: parseFloat(inst.amount),
      paidAmount: parseFloat(inst.paidAmount),
      dueDate: inst.dueDate,
      status: inst.status,
      reminderSent: inst.reminderSent,
      studentName: `${inst.studentPaymentPlan.student.firstName} ${inst.studentPaymentPlan.student.lastName}`,
      studentNumber: inst.studentPaymentPlan.student.studentNumber,
      className: inst.studentPaymentPlan.student.class?.name || 'N/A',
      phone: inst.studentPaymentPlan.student.parentPhone,
      planName: inst.studentPaymentPlan.paymentPlan.name
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get installments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Record installment payment
const recordInstallmentPayment = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const installment = await prisma.installment.findFirst({
      where: { id, schoolId },
      include: { studentPaymentPlan: true }
    });

    if (!installment) {
      return res.status(404).json({ success: false, message: 'Installment not found' });
    }

    const newPaidAmount = parseFloat(installment.paidAmount) + parseFloat(amount);
    const remaining = parseFloat(installment.amount) - newPaidAmount;
    
    let newStatus = 'partial';
    if (remaining <= 0) newStatus = 'paid';

    // Update installment
    await prisma.installment.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        paidAt: newStatus === 'paid' ? new Date() : null
      }
    });

    // Check if all installments paid - update plan status
    const allInstallments = await prisma.installment.findMany({
      where: { studentPaymentPlanId: installment.studentPaymentPlanId }
    });

    const allPaid = allInstallments.every(i => 
      i.id === id ? newStatus === 'paid' : i.status === 'paid'
    );

    if (allPaid) {
      await prisma.studentPaymentPlan.update({
        where: { id: installment.studentPaymentPlanId },
        data: { status: 'completed', completedAt: new Date() }
      });
    }

    res.json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Record installment payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment plan summary/dashboard
const getPaymentPlanSummary = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const activePlans = await prisma.studentPaymentPlan.count({
      where: { schoolId, status: 'active' }
    });

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const overdueInstallments = await prisma.installment.count({
      where: {
        schoolId,
        status: { in: ['pending', 'partial'] },
        dueDate: { lt: now }
      }
    });

    const upcomingInstallments = await prisma.installment.count({
      where: {
        schoolId,
        status: { in: ['pending', 'partial'] },
        dueDate: { gte: now, lte: nextWeek }
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
    console.error('Get plan summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send installment reminder via SMS
const sendInstallmentReminder = async (req, res) => {
  try {
    const { schoolId, fullName } = req.user;
    const { id } = req.params;

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
      return res.status(400).json({ success: false, message: 'No phone number for this student' });
    }

    const studentName = `${installment.studentPaymentPlan.student.firstName} ${installment.studentPaymentPlan.student.lastName}`;
    const remaining = parseFloat(installment.amount) - parseFloat(installment.paidAmount);
    const dueDate = new Date(installment.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

    const message = `QMJS: Reminder - ${studentName}'s installment #${installment.installmentNumber} of UGX ${remaining.toLocaleString()} is due ${dueDate}. Kindly pay. Thank you!`;

    // Get SMS settings
    const settings = await prisma.setting.findMany({
      where: { schoolId, key: { in: ['sms_api_key', 'sms_sender_id'] } }
    });
    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    if (!config.sms_api_key) {
      return res.status(400).json({ success: false, message: 'SMS not configured' });
    }

    // Send via EgoSMS
    const smsResponse = await fetch('https://www.egosms.co/api/v1/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'SendSms',
        userdata: {
          username: config.sms_api_key.split(':')[0],
          password: config.sms_api_key.split(':')[1],
          msg: message,
          sender_id: config.sms_sender_id || 'QMJS',
          contacts: phone.replace(/^0/, '256')
        }
      })
    });

    // Log SMS
    await prisma.smsLog.create({
      data: {
        schoolId,
        phone,
        message,
        studentId: installment.studentPaymentPlan.student.id,
        studentName,
        status: 'sent',
        cost: 25,
        sentBy: fullName
      }
    });

    // Mark reminder sent
    await prisma.installment.update({
      where: { id },
      data: { reminderSent: true }
    });

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update overdue statuses (can be called via cron)
const updateOverdueStatuses = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const result = await prisma.installment.updateMany({
      where: {
        schoolId,
        status: 'pending',
        dueDate: { lt: new Date() }
      },
      data: { status: 'overdue' }
    });

    res.json({ success: true, message: `Updated ${result.count} installments to overdue` });
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