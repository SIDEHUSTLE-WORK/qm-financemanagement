const prisma = require('../config/prisma');

// EGO SMS Configuration
const EGOSMS_URL = 'https://www.egosms.co/api/v1/xml/';
const EGOSMS_USERNAME = process.env.EGOSMS_USERNAME;
const EGOSMS_PASSWORD = process.env.EGOSMS_PASSWORD;
const EGOSMS_SENDER_ID = process.env.EGOSMS_SENDER_ID || 'QMJS';
const SMS_COST = 25;

// Format phone number to Uganda format (256XXXXXXXXX)
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('+256')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('0')) {
    cleaned = '256' + cleaned.substring(1);
  } else if (!cleaned.startsWith('256')) {
    cleaned = '256' + cleaned;
  }
  
  return cleaned;
};

// Build XML request for EGO SMS
const buildSmsXml = (phone, message) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <method>SendSms</method>
  <userdata>
    <username>${EGOSMS_USERNAME}</username>
    <password>${EGOSMS_PASSWORD}</password>
  </userdata>
  <msgdata>
    <number>${phone}</number>
    <message>${message}</message>
    <senderid>${EGOSMS_SENDER_ID}</senderid>
    <priority>1</priority>
  </msgdata>
</Request>`;
};

// Build XML for multiple messages
const buildBulkSmsXml = (messages) => {
  const msgDataBlocks = messages.map(msg => `
  <msgdata>
    <number>${msg.phone}</number>
    <message>${msg.message}</message>
    <senderid>${EGOSMS_SENDER_ID}</senderid>
    <priority>1</priority>
  </msgdata>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <method>SendSms</method>
  <userdata>
    <username>${EGOSMS_USERNAME}</username>
    <password>${EGOSMS_PASSWORD}</password>
  </userdata>${msgDataBlocks}
</Request>`;
};

// Send single SMS
exports.sendSms = async (req, res) => {
  try {
    const { phone, message, studentId, studentName } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }

    if (message.length > 160) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message exceeds 160 characters' 
      });
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone || formattedPhone.length !== 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number format' 
      });
    }

    const xmlData = buildSmsXml(formattedPhone, message);

    // Send to EGO SMS API
    const response = await fetch(EGOSMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlData
    });

    const responseText = await response.text();
    const isSuccess = responseText.includes('<Status>OK</Status>');

    // Log SMS to database
    await prisma.smsLog.create({
      data: {
        phone: formattedPhone,
        message: message,
        studentId: studentId || null,
        studentName: studentName || null,
        status: isSuccess ? 'sent' : 'failed',
        cost: isSuccess ? SMS_COST : 0,
        response: responseText,
        sentBy: req.user.id,
        schoolId: req.user.schoolId
      }
    });

    if (isSuccess) {
      res.json({ 
        success: true, 
        message: 'SMS sent successfully',
        cost: SMS_COST
      });
    } else {
      const errorMatch = responseText.match(/<Message>(.*?)<\/Message>/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Failed to send SMS';
      
      res.status(400).json({ 
        success: false, 
        message: errorMsg 
      });
    }

  } catch (error) {
    console.error('SMS Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send SMS: ' + error.message 
    });
  }
};

// Send bulk SMS
exports.sendBulkSms = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Messages array is required' 
      });
    }

    // Validate and format all messages
    const formattedMessages = [];
    for (const msg of messages) {
      if (!msg.phone || !msg.message) continue;
      if (msg.message.length > 160) continue;
      
      const formattedPhone = formatPhoneNumber(msg.phone);
      if (!formattedPhone || formattedPhone.length !== 12) continue;
      
      formattedMessages.push({
        ...msg,
        phone: formattedPhone
      });
    }

    if (formattedMessages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid messages to send' 
      });
    }

    const xmlData = buildBulkSmsXml(formattedMessages);

    const response = await fetch(EGOSMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlData
    });

    const responseText = await response.text();
    const isSuccess = responseText.includes('<Status>OK</Status>');

    // Log all SMS to database
    for (const msg of formattedMessages) {
      await prisma.smsLog.create({
        data: {
          phone: msg.phone,
          message: msg.message,
          studentId: msg.studentId || null,
          studentName: msg.studentName || null,
          status: isSuccess ? 'sent' : 'failed',
          cost: isSuccess ? SMS_COST : 0,
          response: isSuccess ? 'Bulk send' : responseText,
          sentBy: req.user.id,
          schoolId: req.user.schoolId
        }
      });
    }

    if (isSuccess) {
      res.json({ 
        success: true, 
        message: `${formattedMessages.length} SMS sent successfully`,
        count: formattedMessages.length,
        totalCost: formattedMessages.length * SMS_COST
      });
    } else {
      const errorMatch = responseText.match(/<Message>(.*?)<\/Message>/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Failed to send SMS';
      
      res.status(400).json({ 
        success: false, 
        message: errorMsg 
      });
    }

  } catch (error) {
    console.error('Bulk SMS Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send bulk SMS: ' + error.message 
    });
  }
};

// Get SMS history
exports.getHistory = async (req, res) => {
  try {
    const logs = await prisma.smsLog.findMany({
      where: { schoolId: req.user.schoolId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('SMS History Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch SMS history' 
    });
  }
};

// Get SMS stats
exports.getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalSent, todaySent, totalCost, todayCost] = await Promise.all([
      prisma.smsLog.count({ 
        where: { schoolId: req.user.schoolId, status: 'sent' } 
      }),
      prisma.smsLog.count({ 
        where: { 
          schoolId: req.user.schoolId, 
          status: 'sent',
          createdAt: { gte: today }
        } 
      }),
      prisma.smsLog.aggregate({
        where: { schoolId: req.user.schoolId, status: 'sent' },
        _sum: { cost: true }
      }),
      prisma.smsLog.aggregate({
        where: { 
          schoolId: req.user.schoolId, 
          status: 'sent',
          createdAt: { gte: today }
        },
        _sum: { cost: true }
      })
    ]);

    res.json({ 
      success: true, 
      data: {
        totalSent,
        todaySent,
        totalCost: totalCost._sum.cost || 0,
        todayCost: todayCost._sum.cost || 0,
        costPerSms: SMS_COST
      }
    });
  } catch (error) {
    console.error('SMS Stats Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch SMS stats' 
    });
  }
};

// Get defaulters for SMS - FIXED VERSION
exports.getDefaulters = async (req, res) => {
  try {
    const { minBalance, classId } = req.query;

    // Build where clause
    const whereClause = {
      schoolId: req.user.schoolId,
      isActive: true
    };

    if (classId) {
      whereClause.classId = classId;
    }

    // Step 1: Get all active students with class info
    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        class: true
      }
    });

    // Step 2: Get all student IDs
    const studentIds = students.map(s => s.id);
    
    // Step 3: Fetch balances separately to avoid complex nested queries
    const balances = await prisma.studentBalance.findMany({
      where: {
        studentId: { in: studentIds }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Step 4: Create a map of student ID to their latest balance
    const balanceMap = {};
    for (const bal of balances) {
      if (!balanceMap[bal.studentId]) {
        balanceMap[bal.studentId] = bal;
      }
    }

    // Step 5: Calculate balance for each student and filter defaulters
    const defaulters = students
      .map(student => {
        const latestBalance = balanceMap[student.id];
        
        const totalFees = latestBalance ? Number(latestBalance.totalFees) : 0;
        const amountPaid = latestBalance ? Number(latestBalance.amountPaid) : 0;
        const previousBalance = latestBalance ? Number(latestBalance.previousBalance) : 0;
        const balance = totalFees + previousBalance - amountPaid;

        return {
          id: student.id,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.firstName} ${student.lastName}`,
          className: student.class?.name || 'N/A',
          classId: student.classId,
          parentName: student.parentName,
          phone: student.parentPhone || student.parentPhoneAlt || null,
          totalFees,
          amountPaid,
          previousBalance,
          balance
        };
      })
      // Filter: balance > minBalance AND has phone number
      .filter(student => {
        const minBal = minBalance ? parseFloat(minBalance) : 0;
        return student.balance > minBal && student.phone;
      })
      // Sort by highest balance first
      .sort((a, b) => b.balance - a.balance);

    res.json({ 
      success: true, 
      data: defaulters,
      count: defaulters.length,
      totalBalance: defaulters.reduce((sum, d) => sum + d.balance, 0)
    });

  } catch (error) {
    console.error('Defaulters Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch defaulters: ' + error.message 
    });
  }
};