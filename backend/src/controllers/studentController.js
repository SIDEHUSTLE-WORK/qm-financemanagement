const prisma = require('../config/prisma');
const { createAuditLog } = require('../middleware/audit');
const logger = require('../utils/logger');

// Generate student number
const generateStudentNumber = async (schoolId) => {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { code: true }
  });
  
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { schoolId } });
  
  return `${school?.code || 'STU'}${year}${String(count + 1).padStart(3, '0')}`;
};

// Get all students
const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, classId, search, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      schoolId: req.user.schoolId,
      ...(classId && { classId }),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'inactive' && { isActive: false }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { studentNumber: { contains: search, mode: 'insensitive' } },
          { parentPhone: { contains: search } }
        ]
      })
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: { select: { name: true, level: true } }
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: parseInt(limit)
      }),
      prisma.student.count({ where })
    ]);

    const transformed = students.map(s => ({
      ...s,
      className: s.class?.name,
      classLevel: s.class?.level,
      fullName: `${s.firstName} ${s.lastName}`
    }));

    res.json({
      success: true,
      data: {
        students: transformed,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
};

// Search students (typeahead)
const search = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const students = await prisma.student.findMany({
      where: {
        schoolId: req.user.schoolId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { studentNumber: { contains: q, mode: 'insensitive' } }
        ]
      },
      include: {
        class: { select: { name: true } }
      },
      take: 10,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    const transformed = students.map(s => ({
      id: s.id,
      studentNumber: s.studentNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      className: s.class?.name,
      classId: s.classId
    }));

    res.json({ success: true, data: transformed });
  } catch (error) {
    logger.error('Search students error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

// Get single student
const getById = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, schoolId: req.user.schoolId },
      include: {
        class: { select: { name: true, level: true } },
        balances: {
          include: { term: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        income: {
          where: { isVoided: false },
          include: { category: { select: { name: true } } },
          orderBy: { date: 'desc' },
          take: 10
        }
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const balances = student.balances.map(b => ({
      ...b,
      totalFees: parseFloat(b.totalFees),
      amountPaid: parseFloat(b.amountPaid),
      previousBalance: parseFloat(b.previousBalance),
      balance: parseFloat(b.totalFees) + parseFloat(b.previousBalance) - parseFloat(b.amountPaid),
      termName: b.term?.name
    }));

    const payments = student.income.map(i => ({
      id: i.id,
      date: i.date,
      receiptNumber: i.receiptNumber,
      amount: parseFloat(i.amount),
      categoryName: i.category?.name,
      description: i.description
    }));

    res.json({
      success: true,
      data: {
        ...student,
        className: student.class?.name,
        balances,
        recentPayments: payments
      }
    });
  } catch (error) {
    logger.error('Get student by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student' });
  }
};

// Get student balance
const getBalance = async (req, res) => {
  try {
    const { id } = req.params;
    let { termId } = req.query;

    // Get current term if not specified
    if (!termId) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { schoolId: req.user.schoolId, isCurrent: true }
      });
      termId = currentTerm?.id;
    }

    if (!termId) {
      return res.status(400).json({ success: false, message: 'No active term found' });
    }

    const balance = await prisma.studentBalance.findUnique({
      where: { studentId_termId: { studentId: id, termId } },
      include: { term: { select: { name: true } } }
    });

    if (!balance) {
      // Return zero balance if not found
      return res.json({
        success: true,
        data: {
          studentId: id,
          termId,
          totalFees: 0,
          amountPaid: 0,
          previousBalance: 0,
          balance: 0
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...balance,
        totalFees: parseFloat(balance.totalFees),
        amountPaid: parseFloat(balance.amountPaid),
        previousBalance: parseFloat(balance.previousBalance),
        balance: parseFloat(balance.totalFees) + parseFloat(balance.previousBalance) - parseFloat(balance.amountPaid),
        termName: balance.term?.name
      }
    });
  } catch (error) {
    logger.error('Get student balance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch balance' });
  }
};

// Get all students with balances
const getAllWithBalances = async (req, res) => {
  try {
    const { classId, termId, hasBalance } = req.query;
    const schoolId = req.user.schoolId;

    // Get current term if not specified
    let term = termId;
    if (!term) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { schoolId, isCurrent: true }
      });
      term = currentTerm?.id;
    }

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(classId && { classId })
      },
      include: {
        class: { select: { name: true, level: true } },
        balances: term ? {
          where: { termId: term }
        } : undefined
      },
      orderBy: [
        { class: { level: 'asc' } },
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    });

    let result = students.map(s => {
      const bal = s.balances?.[0];
      const totalFees = parseFloat(bal?.totalFees || 0);
      const amountPaid = parseFloat(bal?.amountPaid || 0);
      const previousBalance = parseFloat(bal?.previousBalance || 0);
      const balance = totalFees + previousBalance - amountPaid;

      return {
        id: s.id,
        studentNumber: s.studentNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.firstName} ${s.lastName}`,
        className: s.class?.name,
        classLevel: s.class?.level,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        totalFees,
        amountPaid,
        previousBalance,
        balance
      };
    });

    // Filter by balance if requested
    if (hasBalance === 'true') {
      result = result.filter(s => s.balance > 0);
    }

    // Calculate totals
    const totals = result.reduce((acc, s) => ({
      totalFees: acc.totalFees + s.totalFees,
      totalPaid: acc.totalPaid + s.amountPaid,
      totalBalance: acc.totalBalance + s.balance,
      studentsWithBalance: acc.studentsWithBalance + (s.balance > 0 ? 1 : 0)
    }), { totalFees: 0, totalPaid: 0, totalBalance: 0, studentsWithBalance: 0 });

    res.json({
      success: true,
      data: {
        students: result,
        summary: totals,
        count: result.length
      }
    });
  } catch (error) {
    logger.error('Get all balances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch balances' });
  }
};

// Create student
const create = async (req, res) => {
  try {
    const studentNumber = await generateStudentNumber(req.user.schoolId);
    const schoolId = req.user.schoolId;

    const student = await prisma.student.create({
      data: {
        schoolId,
        studentNumber,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        otherNames: req.body.otherNames || null,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        gender: req.body.gender || null,
        classId: req.body.classId || null,
        parentName: req.body.guardianName || req.body.parentName || null,
        parentPhone: req.body.guardianPhone || req.body.parentPhone || null,
        parentPhoneAlt: req.body.parentPhoneAlt || null,
        parentEmail: req.body.guardianEmail || req.body.parentEmail || null,
        address: req.body.address || null,
        previousSchool: req.body.previousSchool || null,
        medicalInfo: req.body.medicalInfo || null,
        notes: req.body.notes || null
      }
    });

    // Create StudentBalance with totalFees if provided
    if (req.body.totalFees && parseFloat(req.body.totalFees) > 0) {
      // Get current term
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { schoolId, isCurrent: true }
      });

      if (currentTerm) {
        await prisma.studentBalance.create({
          data: {
            studentId: student.id,
            termId: currentTerm.id,
            totalFees: parseFloat(req.body.totalFees),
            amountPaid: 0,
            previousBalance: 0
          }
        });
      }
    }

    await createAuditLog({
      schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'CREATE',
      entityType: 'student',
      entityId: student.id,
      description: `Created student: ${student.firstName} ${student.lastName} (${studentNumber})${req.body.totalFees ? ` with fees: ${req.body.totalFees}` : ''}`,
      newValues: student,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student
    });
  } catch (error) {
    logger.error('Create student error:', error);
    res.status(500).json({ success: false, message: 'Failed to create student' });
  }
};

// Update student
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const existing = await prisma.student.findFirst({
      where: { id, schoolId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        otherNames: req.body.otherNames,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
        gender: req.body.gender,
        classId: req.body.classId || null,
        parentName: req.body.guardianName || req.body.parentName,
        parentPhone: req.body.guardianPhone || req.body.parentPhone,
        parentPhoneAlt: req.body.parentPhoneAlt,
        parentEmail: req.body.guardianEmail || req.body.parentEmail,
        address: req.body.address,
        medicalInfo: req.body.medicalInfo,
        notes: req.body.notes,
        isActive: req.body.isActive
      }
    });

    // Update StudentBalance totalFees if provided
    if (req.body.totalFees !== undefined) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { schoolId, isCurrent: true }
      });

      if (currentTerm) {
        await prisma.studentBalance.upsert({
          where: {
            studentId_termId: { studentId: id, termId: currentTerm.id }
          },
          update: {
            totalFees: parseFloat(req.body.totalFees)
          },
          create: {
            studentId: id,
            termId: currentTerm.id,
            totalFees: parseFloat(req.body.totalFees),
            amountPaid: 0,
            previousBalance: 0
          }
        });
      }
    }

    await createAuditLog({
      schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'UPDATE',
      entityType: 'student',
      entityId: id,
      description: `Updated student: ${updated.firstName} ${updated.lastName}${req.body.totalFees ? ` (Fees: ${req.body.totalFees})` : ''}`,
      oldValues: existing,
      newValues: updated,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updated
    });
  } catch (error) {
    logger.error('Update student error:', error);
    res.status(500).json({ success: false, message: 'Failed to update student' });
  }
};

// Get classes with student counts
const getClasses = async (req, res) => {
  try {
    const classes = await prisma.class.findMany({
      where: { schoolId: req.user.schoolId, isActive: true },
      include: {
        _count: { select: { students: { where: { isActive: true } } } }
      },
      orderBy: { level: 'asc' }
    });

    const result = classes.map(c => ({
      id: c.id,
      name: c.name,
      level: c.level,
      section: c.section,
      capacity: c.capacity,
      studentCount: c._count.students
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch classes' });
  }
};

// Get student payment history
const getPayments = async (req, res) => {
  try {
    const { id } = req.params;
    
    const payments = await prisma.income.findMany({
      where: {
        studentId: id,
        isVoided: false
      },
      include: {
        category: { select: { name: true } },
        term: { select: { name: true } }
      },
      orderBy: { date: 'desc' },
      take: 50
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
        categoryName: p.category?.name,
        term: p.term
      }))
    });
  } catch (error) {
    logger.error('Get student payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
};

// Generate receipt number
const generateReceiptNumber = async (schoolId) => {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { code: true }
  });
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const count = await prisma.income.count({
    where: {
      schoolId,
      createdAt: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
        lt: new Date(today.setHours(23, 59, 59, 999))
      }
    }
  });
  
  return `${school?.code || 'RCP'}${dateStr}${String(count + 1).padStart(3, '0')}`;
};

// Record student fee payment
const recordPayment = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const { amount, paymentMethod, termId, description } = req.body;
    const schoolId = req.user.schoolId;

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: { class: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get School Fees category
    let category = await prisma.incomeCategory.findFirst({
      where: { schoolId, name: 'School Fees' }
    });

    if (!category) {
      category = await prisma.incomeCategory.create({
        data: {
          schoolId,
          name: 'School Fees',
          isFeeRelated: true,
          color: '#10B981'
        }
      });
    }

    // Get current term if not provided
    let activeTermId = termId;
    if (!activeTermId) {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { schoolId, isCurrent: true }
      });
      activeTermId = currentTerm?.id;
    }

    // Generate receipt number
    const receiptNumber = await generateReceiptNumber(schoolId);

    // Create income record
    const income = await prisma.income.create({
      data: {
        schoolId,
        receiptNumber,
        date: new Date(),
        categoryId: category.id,
        studentId,
        termId: activeTermId || null,
        description: description || `School fees payment - ${student.firstName} ${student.lastName}`,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'cash',
        receivedById: req.user.id
      },
      include: {
        category: { select: { name: true } },
        student: { select: { firstName: true, lastName: true, studentNumber: true } }
      }
    });

    // Update student balance if term exists
    let updatedBalance = null;
    if (activeTermId) {
      updatedBalance = await prisma.studentBalance.upsert({
        where: {
          studentId_termId: { studentId, termId: activeTermId }
        },
        update: {
          amountPaid: { increment: parseFloat(amount) }
        },
        create: {
          studentId,
          termId: activeTermId,
          totalFees: 0,
          amountPaid: parseFloat(amount),
          previousBalance: 0
        }
      });
    }

    // Calculate remaining balance
    const remainingBalance = updatedBalance 
      ? parseFloat(updatedBalance.totalFees) + parseFloat(updatedBalance.previousBalance) - parseFloat(updatedBalance.amountPaid)
      : 0;

    // Audit log
    await createAuditLog({
      schoolId,
      userId: req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'CREATE',
      entityType: 'fee_payment',
      entityId: income.id,
      description: `Fee payment: ${receiptNumber} - ${student.firstName} ${student.lastName} - ${amount}`,
      newValues: { receiptNumber, amount, studentId, studentName: `${student.firstName} ${student.lastName}` },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        id: income.id,
        receiptNumber: income.receiptNumber,
        date: income.date,
        amount: parseFloat(income.amount),
        paymentMethod: income.paymentMethod,
        student: income.student,
        category: income.category,
        balance: {
          totalFees: updatedBalance ? parseFloat(updatedBalance.totalFees) : 0,
          amountPaid: updatedBalance ? parseFloat(updatedBalance.amountPaid) : parseFloat(amount),
          previousBalance: updatedBalance ? parseFloat(updatedBalance.previousBalance) : 0,
          remaining: remainingBalance
        }
      }
    });
  } catch (error) {
    logger.error('Record payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
};

module.exports = {
  getAll,
  search,
  getById,
  getBalance,
  getAllWithBalances,
  create,
  update,
  getClasses,
  getPayments,
  recordPayment
};