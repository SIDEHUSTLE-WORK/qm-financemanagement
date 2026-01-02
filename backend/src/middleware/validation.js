const { body, validationResult } = require('express-validator');

// Handle validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Login validation
const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
];

// Income validation
const incomeValidation = [
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 500 }).withMessage('Description too long'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'mobile_money', 'school_pay', 'bank_transfer', 'cheque'])
    .withMessage('Invalid payment method'),
  validate
];

// Expense validation
const expenseValidation = [
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 500 }).withMessage('Description too long'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  validate
];

// Student validation
const studentValidation = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ max: 100 }).withMessage('First name too long'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ max: 100 }).withMessage('Last name too long'),
  body('parentPhone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[\d\s+()-]*$/).withMessage('Invalid phone number format'),
  body('guardianPhone')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[\d\s+()-]*$/).withMessage('Invalid phone number format'),
  body('parentEmail')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage('Invalid email format'),
  body('guardianEmail')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage('Invalid email format'),
  validate
];

// Password change validation
const passwordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain a number'),
  validate
];

module.exports = {
  validate,
  loginValidation,
  incomeValidation,
  expenseValidation,
  studentValidation,
  passwordValidation
};