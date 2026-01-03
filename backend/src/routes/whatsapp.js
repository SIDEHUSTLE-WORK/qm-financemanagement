// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '../public/receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// Generate PDF Receipt and return URL
router.post('/generate-receipt-pdf/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const schoolId = req.user.schoolId;

    // Get payment with student and school info
    const payment = await prisma.feePayment.findFirst({
      where: { id: paymentId },
      include: {
        student: {
          include: { class: true }
        }
      }
    });

    if (!payment) {
      return res.json({ success: false, message: 'Payment not found' });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    // Generate unique filename
    const filename = `receipt_${payment.receiptNumber.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filepath = path.join(receiptsDir, filename);
    const publicUrl = `${process.env.BASE_URL || 'https://qm-financemanagement-production.up.railway.app'}/receipts/${filename}`;

    // Create PDF
    const doc = new PDFDocument({ size: 'A6', margin: 20 });
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(14).font('Helvetica-Bold')
       .text(school?.name || 'QUEEN MOTHER JUNIOR SCHOOL', { align: 'center' });
    doc.fontSize(8).font('Helvetica')
       .text('Namasuba Kikajjo, Kampala, Uganda', { align: 'center' })
       .text('Tel: 0200 939 322', { align: 'center' });
    
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
       .font('Helvetica').text(new Date(payment.createdAt).toLocaleDateString('en-GB'));
    
    doc.moveDown(0.3);
    
    doc.font('Helvetica-Bold').text('Student: ', { continued: true })
       .font('Helvetica').text(`${payment.student.firstName} ${payment.student.lastName}`);
    
    doc.font('Helvetica-Bold').text('Class: ', { continued: true })
       .font('Helvetica').text(payment.student.class?.name || 'N/A');
    
    doc.font('Helvetica-Bold').text('Student No: ', { continued: true })
       .font('Helvetica').text(payment.student.studentNumber);

    doc.moveDown(0.5);

    // Amount Box
    doc.rect(20, doc.y, doc.page.width - 40, 40).fill('#059669');
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
       .text('AMOUNT PAID', 20, doc.y - 35, { align: 'center' });
    doc.fontSize(16)
       .text(`UGX ${Number(payment.amount).toLocaleString()}`, { align: 'center' });
    
    doc.fillColor('#000000');
    doc.moveDown(2);

    // Payment Method
    doc.fontSize(9).font('Helvetica-Bold').text('Payment Method: ', { continued: true })
       .font('Helvetica').text(payment.paymentMethod?.replace('_', ' ').toUpperCase() || 'CASH');

    // Description
    if (payment.description) {
      doc.font('Helvetica-Bold').text('Description: ', { continued: true })
         .font('Helvetica').text(payment.description);
    }

    doc.moveDown(0.5);

    // QR Code for verification
    const verifyUrl = `${process.env.BASE_URL || 'https://qm-financemanagement-production.up.railway.app'}/api/verify/${payment.receiptNumber}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, (doc.page.width - 60) / 2, doc.y, { width: 60 });
    
    doc.moveDown(4);
    doc.fontSize(6).text('Scan to verify receipt', { align: 'center' });

    // Footer
    doc.moveDown(0.5);
    doc.fontSize(7).font('Helvetica')
       .text('Thank you for your payment!', { align: 'center' })
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();

    // Wait for PDF to finish writing
    await new Promise((resolve) => writeStream.on('finish', resolve));

    // Save URL to database for tracking
    await prisma.feePayment.update({
      where: { id: paymentId },
      data: { pdfUrl: publicUrl }
    });

    res.json({
      success: true,
      data: {
        url: publicUrl,
        filename,
        receiptNumber: payment.receiptNumber,
        studentName: `${payment.student.firstName} ${payment.student.lastName}`,
        amount: payment.amount,
        phone: payment.student.parentPhone || payment.student.parentPhoneAlt
      }
    });

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Get WhatsApp link for receipt
router.get('/receipt-link/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.feePayment.findFirst({
      where: { id: paymentId },
      include: {
        student: { include: { class: true } }
      }
    });

    if (!payment) {
      return res.json({ success: false, message: 'Payment not found' });
    }

    const studentName = `${payment.student.firstName} ${payment.student.lastName}`;
    const phone = payment.student.parentPhone || payment.student.parentPhoneAlt;
    const formattedPhone = phone ? phone.replace(/^0/, '256').replace(/[^0-9]/g, '') : null;

    // Generate message
    const message = `🏫 *QUEEN MOTHER JUNIOR SCHOOL*\n\n` +
      `✅ *PAYMENT RECEIPT*\n\n` +
      `📄 Receipt No: ${payment.receiptNumber}\n` +
      `👤 Student: ${studentName}\n` +
      `📚 Class: ${payment.student.class?.name || 'N/A'}\n` +
      `💰 Amount: UGX ${Number(payment.amount).toLocaleString()}\n` +
      `📅 Date: ${new Date(payment.createdAt).toLocaleDateString('en-GB')}\n\n` +
      `📥 Download Receipt:\n${payment.pdfUrl || 'PDF will be generated'}\n\n` +
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

// Get WhatsApp reminder link for defaulter
router.post('/reminder-link', async (req, res) => {
  try {
    const { studentId, customMessage } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true }
    });

    if (!student) {
      return res.json({ success: false, message: 'Student not found' });
    }

    // Calculate balance
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { classId: student.classId, isActive: true }
    });
    const totalFees = feeStructure ? Number(feeStructure.amount) : 0;
    
    const payments = await prisma.feePayment.aggregate({
      where: { studentId, status: 'completed' },
      _sum: { amount: true }
    });
    const totalPaid = payments._sum.amount ? Number(payments._sum.amount) : 0;
    const balance = totalFees - totalPaid;

    const phone = student.parentPhone || student.parentPhoneAlt;
    const formattedPhone = phone ? phone.replace(/^0/, '256').replace(/[^0-9]/g, '') : null;

    const studentName = `${student.firstName} ${student.lastName}`;
    
    // Default or custom message
    const message = customMessage || 
      `🏫 *QUEEN MOTHER JUNIOR SCHOOL*\n\n` +
      `Dear Parent/Guardian,\n\n` +
      `This is a friendly reminder regarding school fees for:\n\n` +
      `👤 Student: ${studentName}\n` +
      `📚 Class: ${student.class?.name || 'N/A'}\n` +
      `💰 Outstanding Balance: *UGX ${balance.toLocaleString()}*\n\n` +
      `Kindly clear the balance at your earliest convenience.\n\n` +
      `For inquiries, contact: 0200 939 322\n\n` +
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
router.post('/bulk-reminder-links', async (req, res) => {
  try {
    const { studentIds, customMessage } = req.body;

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      include: { class: true }
    });

    const links = [];

    for (const student of students) {
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { classId: student.classId, isActive: true }
      });
      const totalFees = feeStructure ? Number(feeStructure.amount) : 0;
      
      const payments = await prisma.feePayment.aggregate({
        where: { studentId: student.id, status: 'completed' },
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
            .replace('{student}', studentName)
            .replace('{balance}', `UGX ${balance.toLocaleString()}`)
            .replace('{class}', student.class?.name || 'N/A')
        : `🏫 QMJS: Dear Parent, ${studentName} has an outstanding balance of UGX ${balance.toLocaleString()}. Kindly clear fees. Contact: 0200939322`;

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

module.exports = router;