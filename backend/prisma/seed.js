const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // Create default school
  const school = await prisma.school.upsert({
    where: { code: 'QMJS' },
    update: {},
    create: {
      name: 'QUEEN MOTHER JUNIOR SCHOOL',
      code: 'QMJS',
      address: 'Namasuba Kikajjo, Kampala, Uganda',
      phone: '0200 939 322',
      email: 'info@queenmotherschool.com',
      poBox: 'P.O Box 600819',
      motto: 'Excellence in Education'
    }
  });
  console.log('✅ School created:', school.name);

  // Hash passwords
  const saltRounds = 12;
  const adminPassword = await bcrypt.hash('admin123', saltRounds);
  const bursarPassword = await bcrypt.hash('shadia123', saltRounds);
  const directorPassword = await bcrypt.hash('james123', saltRounds);

  // Create users
  const admin = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: 'admin' } },
    update: { passwordHash: adminPassword },
    create: {
      schoolId: school.id,
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'System Administrator',
      role: 'super_admin',
      permissions: { all: true }
    }
  });

  const bursar = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: 'shadia' } },
    update: { passwordHash: bursarPassword },
    create: {
      schoolId: school.id,
      username: 'shadia',
      passwordHash: bursarPassword,
      fullName: 'Ms. SHADIA',
      role: 'bursar',
      permissions: {
        income: { create: true, read: true, update: true },
        expense: { create: true, read: true, update: true },
        reports: { create: true, read: true },
        students: { create: true, read: true, update: true }
      }
    }
  });

  const director = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: 'princess' } },
    update: { passwordHash: directorPassword },
    create: {
      schoolId: school.id,
      username: 'princess',
      passwordHash: directorPassword,
      fullName: 'Madam PRINCESS',
      role: 'director',
      permissions: {
        income: { read: true },
        expense: { read: true },
        reports: { read: true },
        users: { create: true, read: true, update: true }
      }
    }
  });
  console.log('✅ Users created: admin, shadia, princess');

  // Create academic year
  const currentYear = new Date().getFullYear();
  const academicYear = await prisma.academicYear.upsert({
    where: { schoolId_year: { schoolId: school.id, year: currentYear } },
    update: { isCurrent: true },
    create: {
      schoolId: school.id,
      year: currentYear,
      name: `Academic Year ${currentYear}`,
      startDate: new Date(`${currentYear}-02-01`),
      endDate: new Date(`${currentYear}-11-30`),
      isCurrent: true
    }
  });
  console.log('✅ Academic year created:', academicYear.name);

  // Create terms
  const terms = [
    { num: 1, name: 'Term 1', start: `${currentYear}-02-01`, end: `${currentYear}-04-30` },
    { num: 2, name: 'Term 2', start: `${currentYear}-05-15`, end: `${currentYear}-08-15` },
    { num: 3, name: 'Term 3', start: `${currentYear}-09-01`, end: `${currentYear}-11-30` }
  ];

  const today = new Date();
  let currentTermNum = 1;
  for (const term of terms) {
    if (today <= new Date(term.end)) {
      currentTermNum = term.num;
      break;
    }
  }

  for (const term of terms) {
    await prisma.academicTerm.upsert({
      where: { academicYearId_termNumber: { academicYearId: academicYear.id, termNumber: term.num } },
      update: { isCurrent: term.num === currentTermNum },
      create: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        name: term.name,
        termNumber: term.num,
        startDate: new Date(term.start),
        endDate: new Date(term.end),
        isCurrent: term.num === currentTermNum
      }
    });
  }
  console.log('✅ Terms created: Term 1, Term 2, Term 3');

  // Create classes (using findFirst + create pattern to handle nullable section)
  const classes = [
    { name: 'Baby Class', level: 1 },
    { name: 'Middle Class', level: 2 },
    { name: 'Top Class', level: 3 },
    { name: 'Primary 1', level: 4 },
    { name: 'Primary 2', level: 5 },
    { name: 'Primary 3', level: 6 },
    { name: 'Primary 4', level: 7 },
    { name: 'Primary 5', level: 8 },
    { name: 'Primary 6', level: 9 },
    { name: 'Primary 7', level: 10 }
  ];

  for (const cls of classes) {
    // Check if class exists
    const existing = await prisma.class.findFirst({
      where: {
        schoolId: school.id,
        name: cls.name,
        section: null
      }
    });

    if (!existing) {
      await prisma.class.create({
        data: {
          schoolId: school.id,
          name: cls.name,
          level: cls.level,
          section: null
        }
      });
    }
  }
  console.log('✅ Classes created:', classes.map(c => c.name).join(', '));

  // Create income categories
  const incomeCategories = [
    { name: 'School Fees', isFeeRelated: true, color: '#10B981', sortOrder: 1 },
    { name: 'Old Balance', isFeeRelated: true, color: '#6366F1', sortOrder: 2 },
    { name: 'Uniform', isFeeRelated: true, color: '#8B5CF6', sortOrder: 3 },
    { name: 'Swimming', isFeeRelated: true, color: '#06B6D4', sortOrder: 4 },
    { name: 'School Van', isFeeRelated: true, color: '#F59E0B', sortOrder: 5 },
    { name: 'School Tour', isFeeRelated: true, color: '#EC4899', sortOrder: 6 },
    { name: 'Extras', isFeeRelated: false, color: '#84CC16', sortOrder: 7 },
    { name: 'Donations', isFeeRelated: false, color: '#14B8A6', sortOrder: 8 },
    { name: 'Others', isFeeRelated: false, color: '#6B7280', sortOrder: 9 }
  ];

  for (const cat of incomeCategories) {
    await prisma.incomeCategory.upsert({
      where: { schoolId_name: { schoolId: school.id, name: cat.name } },
      update: {},
      create: {
        schoolId: school.id,
        name: cat.name,
        isFeeRelated: cat.isFeeRelated,
        color: cat.color,
        sortOrder: cat.sortOrder
      }
    });
  }
  console.log('✅ Income categories created');

  // Create expense categories
  const expenseCategories = [
    { name: 'Salaries', color: '#EF4444', sortOrder: 1 },
    { name: 'Food & Supplies', color: '#F97316', sortOrder: 2 },
    { name: 'Utilities', color: '#EAB308', sortOrder: 3 },
    { name: 'Weekly Allowances', color: '#22C55E', sortOrder: 4 },
    { name: 'Transport', color: '#3B82F6', sortOrder: 5 },
    { name: 'Stationery & Supplies', color: '#8B5CF6', sortOrder: 6 },
    { name: 'Labor', color: '#EC4899', sortOrder: 7 },
    { name: 'Furniture', color: '#14B8A6', sortOrder: 8 },
    { name: 'Banking', color: '#6366F1', sortOrder: 9 },
    { name: 'Maintenance', color: '#F59E0B', sortOrder: 10 },
    { name: 'Other', color: '#6B7280', sortOrder: 11 }
  ];

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { schoolId_name: { schoolId: school.id, name: cat.name } },
      update: {},
      create: {
        schoolId: school.id,
        name: cat.name,
        color: cat.color,
        sortOrder: cat.sortOrder
      }
    });
  }
  console.log('✅ Expense categories created');

  // Initialize receipt counter
  await prisma.setting.upsert({
    where: { schoolId_key: { schoolId: school.id, key: 'receipt_counter' } },
    update: {},
    create: {
      schoolId: school.id,
      key: 'receipt_counter',
      value: '1'
    }
  });
  console.log('✅ Settings initialized');

  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('═══════════════════════════════════════════');
  console.log('  Default Login Credentials:');
  console.log('═══════════════════════════════════════════');
  console.log('  Admin:    admin / admin123');
  console.log('  Bursar:   shadia / shadia123');
  console.log('  Director: princess / james123');
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });