const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');

// Create reusable transporter
const createTransporter = async (schoolId) => {
  // Get school's email settings
  const settings = await prisma.setting.findMany({
    where: { 
      schoolId, 
      key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name'] } 
    }
  });
  
  const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port) || 587,
    secure: parseInt(config.smtp_port) === 465,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass
    }
  });
};

// Generate receipt HTML
const generateReceiptHTML = (receipt, school) => {
  const paymentMethodLabels = {
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    school_pay: 'School Pay'
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
    .school-info { color: #666; font-size: 12px; margin-top: 5px; }
    .receipt-title { background: #2563eb; color: white; padding: 10px; text-align: center; font-size: 18px; margin: 20px 0; }
    .receipt-number { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .details-table td:first-child { font-weight: bold; color: #666; width: 40%; }
    .amount-box { background: #f0f9ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .amount { font-size: 32px; font-weight: bold; color: #2563eb; }
    .amount-label { color: #666; font-size: 12px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    .verified { background: #dcfce7; color: #166534; padding: 10px; border-radius: 5px; text-align: center; margin: 20px 0; }
    .qr-note { text-align: center; font-size: 11px; color: #999; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${school.name}</div>
    <div class="school-info">
      ${school.address || ''}<br>
      ${school.phone ? `Tel: ${school.phone}` : ''} ${school.email ? `| Email: ${school.email}` : ''}
    </div>
  </div>

  <div class="receipt-title">OFFICIAL RECEIPT</div>
  <div class="receipt-number">Receipt No: <strong>${receipt.receiptNumber}</strong></div>

  <table class="details-table">
    <tr>
      <td>Date:</td>
      <td>${new Date(receipt.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
    </tr>
    ${receipt.student ? `
    <tr>
      <td>Student Name:</td>
      <td>${receipt.student.firstName} ${receipt.student.lastName}</td>
    </tr>
    <tr>
      <td>Student Number:</td>
      <td>${receipt.student.studentNumber}</td>
    </tr>
    ` : ''}
    <tr>
      <td>Description:</td>
      <td>${receipt.description}</td>
    </tr>
    <tr>
      <td>Category:</td>
      <td>${receipt.category?.name || 'General Income'}</td>
    </tr>
    <tr>
      <td>Payment Method:</td>
      <td>${paymentMethodLabels[receipt.paymentMethod] || receipt.paymentMethod}</td>
    </tr>
    ${receipt.mobileMoneyRef ? `
    <tr>
      <td>Mobile Money Ref:</td>
      <td>${receipt.mobileMoneyRef}</td>
    </tr>
    ` : ''}
    ${receipt.bankRef ? `
    <tr>
      <td>Bank Reference:</td>
      <td>${receipt.bankRef}</td>
    </tr>
    ` : ''}
    ${receipt.chequeNumber ? `
    <tr>
      <td>Cheque Number:</td>
      <td>${receipt.chequeNumber}</td>
    </tr>
    ` : ''}
  </table>

  <div class="amount-box">
    <div class="amount-label">AMOUNT PAID</div>
    <div class="amount">UGX ${parseFloat(receipt.amount).toLocaleString()}</div>
  </div>

  <div class="verified">
    ✓ This is a verified electronic receipt
  </div>

  <div class="qr-note">
    To verify this receipt, visit: ${process.env.FRONTEND_URL || 'https://your-app.com'}/verify/${receipt.receiptNumber}
  </div>

  <div class="footer">
    <p>Thank you for your payment!</p>
    <p>${school.name} | Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
  `;
};

// Send receipt via email
const sendReceiptEmail = async (req, res) => {
  try {
    const { receiptId, email } = req.body;
    const { schoolId, fullName } = req.user;

    if (!receiptId || !email) {
      return res.status(400).json({ success: false, message: 'Receipt ID and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Get receipt with all details
    const receipt = await prisma.income.findFirst({
      where: { id: receiptId, schoolId },
      include: {
        student: { select: { firstName: true, lastName: true, studentNumber: true } },
        category: { select: { name: true } }
      }
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.isVoided) {
      return res.status(400).json({ success: false, message: 'Cannot email a voided receipt' });
    }

    // Get school details
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, address: true, phone: true, email: true }
    });

    // Create transporter
    const transporter = await createTransporter(schoolId);
    
    if (!transporter) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email not configured. Please set up SMTP settings first.' 
      });
    }

    // Get from settings
    const fromSettings = await prisma.setting.findMany({
      where: { schoolId, key: { in: ['smtp_from', 'smtp_from_name'] } }
    });
    const fromConfig = fromSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    // Generate HTML
    const html = generateReceiptHTML(receipt, school);

    // Send email
    const info = await transporter.sendMail({
      from: `"${fromConfig.smtp_from_name || school.name}" <${fromConfig.smtp_from}>`,
      to: email,
      subject: `Receipt ${receipt.receiptNumber} - ${school.name}`,
      html: html
    });

    // Log the email send (optional - could add EmailLog model)
    console.log(`Receipt email sent: ${info.messageId} to ${email} by ${fullName}`);

    res.json({ 
      success: true, 
      message: `Receipt sent to ${email}`,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Send receipt email error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send email' });
  }
};

// Send bulk fee reminder emails
const sendFeeReminderEmail = async (req, res) => {
  try {
    const { studentIds, subject, message } = req.body;
    const { schoolId, fullName } = req.user;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Student IDs required' });
    }

    // Get students with email
    const students = await prisma.student.findMany({
      where: { 
        id: { in: studentIds },
        schoolId,
        parentEmail: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        parentEmail: true,
        parentName: true,
        balances: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { totalFees: true, amountPaid: true }
        }
      }
    });

    if (students.length === 0) {
      return res.status(400).json({ success: false, message: 'No students with email addresses found' });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, phone: true }
    });

    const transporter = await createTransporter(schoolId);
    if (!transporter) {
      return res.status(400).json({ success: false, message: 'Email not configured' });
    }

    const fromSettings = await prisma.setting.findMany({
      where: { schoolId, key: { in: ['smtp_from', 'smtp_from_name'] } }
    });
    const fromConfig = fromSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const student of students) {
      try {
        const balance = student.balances[0];
        const outstanding = balance ? parseFloat(balance.totalFees) - parseFloat(balance.amountPaid) : 0;

        const personalizedMessage = message
          .replace(/{studentName}/g, `${student.firstName} ${student.lastName}`)
          .replace(/{parentName}/g, student.parentName || 'Parent')
          .replace(/{balance}/g, `UGX ${outstanding.toLocaleString()}`)
          .replace(/{schoolName}/g, school.name);

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">${school.name}</h2>
            <div style="margin: 20px 0; line-height: 1.6;">
              ${personalizedMessage.replace(/\n/g, '<br>')}
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
              <p>Contact us: ${school.phone || 'N/A'}</p>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"${fromConfig.smtp_from_name || school.name}" <${fromConfig.smtp_from}>`,
          to: student.parentEmail,
          subject: subject || `Fee Reminder - ${school.name}`,
          html
        });

        sent++;
      } catch (err) {
        failed++;
        errors.push({ student: `${student.firstName} ${student.lastName}`, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Emails sent: ${sent}, Failed: ${failed}`,
      data: { sent, failed, errors: errors.slice(0, 5) }
    });
  } catch (error) {
    console.error('Send reminder email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Test email configuration
const testEmailConfig = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ success: false, message: 'Test email address required' });
    }

    const transporter = await createTransporter(schoolId);
    if (!transporter) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email not configured. Please set SMTP settings first.' 
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true }
    });

    const fromSettings = await prisma.setting.findMany({
      where: { schoolId, key: { in: ['smtp_from', 'smtp_from_name'] } }
    });
    const fromConfig = fromSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    await transporter.sendMail({
      from: `"${fromConfig.smtp_from_name || school.name}" <${fromConfig.smtp_from}>`,
      to: testEmail,
      subject: `Test Email - ${school.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2 style="color: #22c55e;">✓ Email Configuration Successful!</h2>
          <p>Your email settings for <strong>${school.name}</strong> are working correctly.</p>
          <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: `Email test failed: ${error.message}` });
  }
};

// Get email settings
const getEmailSettings = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const settings = await prisma.setting.findMany({
      where: { 
        schoolId, 
        key: { startsWith: 'smtp_' }
      }
    });

    // Don't expose password
    const config = settings.reduce((acc, s) => {
      if (s.key === 'smtp_pass') {
        acc[s.key] = s.value ? '********' : '';
      } else {
        acc[s.key] = s.value;
      }
      return acc;
    }, {});

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save email settings
const saveEmailSettings = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_from_name } = req.body;

    const settingsToSave = [
      { key: 'smtp_host', value: smtp_host || '' },
      { key: 'smtp_port', value: smtp_port || '587' },
      { key: 'smtp_user', value: smtp_user || '' },
      { key: 'smtp_from', value: smtp_from || '' },
      { key: 'smtp_from_name', value: smtp_from_name || '' }
    ];

    // Only update password if provided and not masked
    if (smtp_pass && smtp_pass !== '********') {
      settingsToSave.push({ key: 'smtp_pass', value: smtp_pass });
    }

    for (const setting of settingsToSave) {
      await prisma.setting.upsert({
        where: { schoolId_key: { schoolId, key: setting.key } },
        update: { value: setting.value },
        create: { schoolId, key: setting.key, value: setting.value }
      });
    }

    res.json({ success: true, message: 'Email settings saved' });
  } catch (error) {
    console.error('Save email settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  sendReceiptEmail,
  sendFeeReminderEmail,
  testEmailConfig,
  getEmailSettings,
  saveEmailSettings
};