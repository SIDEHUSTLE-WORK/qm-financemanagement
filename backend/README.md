# QM Finance Backend (Prisma)

School Financial Management System - Backend API with **Prisma ORM** 🚀

## Features

- ✅ **Prisma ORM** - Type-safe database access
- ✅ **JWT Authentication** with refresh tokens
- ✅ **Role-Based Access Control** (RBAC)
- ✅ **Password Hashing** with bcrypt
- ✅ **Audit Logging** for all operations
- ✅ **Input Validation** on all endpoints
- ✅ **Rate Limiting** to prevent abuse

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/qm_finance?schema=public"
JWT_SECRET=your_super_secret_key
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE qm_finance;
\q
```

### 4. Run Prisma Migrations

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (development)
npm run db:push

# OR run migrations (production)
npm run db:migrate
```

### 5. Seed Initial Data

```bash
npm run db:seed
```

This creates:
- Default school (Queen Mother Junior School)
- Default users (admin, shadia, princess)
- Academic year and terms
- Income/Expense categories
- Sample classes

### 6. Start the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

API available at: `http://localhost:5000`

## 🔑 Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Super Admin (full access) |
| `shadia` | `shadia123` | Bursar (add/edit, no delete) |
| `princess` | `james123` | Director (view only) |

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio (GUI) |
| `npm run db:reset` | Reset database |

## 📊 Prisma Studio

View and edit your data with a beautiful GUI:

```bash
npm run db:studio
```

Opens at: `http://localhost:5555`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/profile` - Get profile

### Income
- `GET /api/income` - List income
- `GET /api/income/:id` - Get single income
- `POST /api/income` - Create income
- `PUT /api/income/:id` - Update income
- `POST /api/income/:id/void` - Void income
- `GET /api/income/summary` - Get summary
- `GET /api/income/categories` - Get categories

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `POST /api/expenses/:id/void` - Void expense
- `GET /api/expenses/summary` - Get summary

### Students
- `GET /api/students` - List students
- `GET /api/students/search?q=` - Search students
- `GET /api/students/:id` - Get student
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `GET /api/students/:id/balance` - Get balance
- `GET /api/students/balances` - All balances

### Reports
- `GET /api/reports` - List reports
- `GET /api/reports/daily` - Daily report
- `GET /api/reports/monthly` - Monthly report
- `GET /api/reports/range` - Range report

### Dashboard
- `GET /api/dashboard/summary` - Dashboard data

## Project Structure

```
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.js          # Seed data
├── src/
│   ├── config/
│   │   └── prisma.js    # Prisma client singleton
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── incomeController.js
│   │   ├── expenseController.js
│   │   ├── studentController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   ├── auth.js      # JWT & permissions
│   │   ├── audit.js     # Audit logging
│   │   └── validation.js
│   ├── routes/
│   │   └── index.js     # All routes
│   ├── utils/
│   │   └── logger.js    # Winston logger
│   └── server.js        # Express app
├── logs/
├── .env
├── .env.example
└── package.json
```

## Role Permissions

| Role | Income | Expenses | Reports | Students | Users |
|------|--------|----------|---------|----------|-------|
| super_admin | Full | Full | Full | Full | Full |
| director | Read | Read | Read | Read | CRUD |
| bursar | CRUD | CRUD | CRUD | CRUD | - |
| accountant | CRUD | CRUD | Read | - | - |
| teacher | Read | - | - | Read | - |
| viewer | Read | Read | Read | Read | - |

## Security Features

1. **Password Hashing** - bcrypt with 12 rounds
2. **JWT Tokens** - Access + Refresh tokens
3. **Rate Limiting** - Prevents brute force
4. **Input Validation** - express-validator
5. **Audit Logging** - All actions tracked
6. **Account Lockout** - After 5 failed attempts

## License

MIT
