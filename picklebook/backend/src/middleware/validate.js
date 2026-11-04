const { validationResult, body, param, query } = require('express-validator');
const { sendResponse } = require('../utils/helpers');

/**
 * Middleware to check validation results and return formatted 400 error
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendResponse(res, 400, {
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// =================== AUTH VALIDATIONS ===================
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters.'),
  validate
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
  validate
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  validate
];

const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required.'),
  body('password')
    .notEmpty()
    .withMessage('New password is required.')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  validate
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required.'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required.')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long.'),
  validate
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty.')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters.'),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone cannot exceed 20 characters.'),
  body('avatar_url')
    .optional({ nullable: true })
    .trim()
    .isURL()
    .withMessage('Avatar URL must be a valid URL.'),
  validate
];

// =================== COURT VALIDATIONS ===================
const courtCreateValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Court name is required.')
    .isLength({ max: 100 })
    .withMessage('Court name cannot exceed 100 characters.'),
  body('court_type')
    .notEmpty()
    .withMessage('Court type is required.')
    .isIn(['indoor', 'outdoor'])
    .withMessage('Court type must be indoor or outdoor.'),
  body('price_per_hour')
    .notEmpty()
    .withMessage('Price per hour is required.')
    .isFloat({ min: 0 })
    .withMessage('Price per hour must be a non-negative number.'),
  body('surface_type')
    .optional()
    .trim()
    .isLength({ max: 50 }),
  body('max_players')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Max players must be between 1 and 10.'),
  body('has_lighting')
    .optional()
    .isBoolean()
    .withMessage('has_lighting must be boolean.'),
  body('has_seating')
    .optional()
    .isBoolean()
    .withMessage('has_seating must be boolean.'),
  body('sort_order')
    .optional()
    .isInt(),
  validate
];

const courtUpdateValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid court ID is required.'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Court name cannot be empty.'),
  body('court_type')
    .optional()
    .isIn(['indoor', 'outdoor'])
    .withMessage('Court type must be indoor or outdoor.'),
  body('price_per_hour')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price per hour must be a non-negative number.'),
  body('is_active')
    .optional()
    .isBoolean(),
  validate
];

// =================== SERVICE VALIDATIONS ===================
const serviceCreateValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Service name is required.')
    .isLength({ max: 100 }),
  body('category')
    .notEmpty()
    .withMessage('Category is required.')
    .isIn(['indoor', 'outdoor'])
    .withMessage('Service category must be indoor or outdoor.'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('image_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('is_active').optional().isIn([0, 1, true, false]),
  body('sort_order').optional().isInt({ min: 0 }),
  validate
];

const serviceUpdateValidation = [
  param('id').isInt({ min: 1 }).withMessage('Valid service ID is required.'),
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('category').optional().isIn(['indoor', 'outdoor'])
    .withMessage('Service category must be indoor or outdoor.'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('image_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('is_active').optional().isIn([0, 1, true, false]),
  body('sort_order').optional().isInt({ min: 0 }),
  validate
];

// =================== RESERVATION VALIDATIONS ===================
const reservationCreateValidation = [
  body('court_id')
    .notEmpty()
    .withMessage('Court ID is required.')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a valid integer.'),
  body('reservation_date')
    .notEmpty()
    .withMessage('Reservation date is required.')
    .isISO8601()
    .withMessage('Reservation date must be a valid date in YYYY-MM-DD format.'),
  body('start_time')
    .notEmpty()
    .withMessage('Start time is required.')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/)
    .withMessage('Start time must be in HH:MM or HH:MM:SS format.'),
  body('end_time')
    .notEmpty()
    .withMessage('End time is required.')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/)
    .withMessage('End time must be in HH:MM or HH:MM:SS format.'),
  body('services')
    .optional()
    .isArray({ max: 0 })
    .withMessage('Bookings include one indoor or outdoor court. Additional services are unavailable.'),
  body('services.*.service_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Service ID must be an integer.'),
  body('services.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Service quantity must be at least 1.'),
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }),
  body('payment_method')
    .optional()
    .isIn(['cash', 'gcash'])
    .withMessage('Payment method must be cash or GCash.'),
  validate
];

const reservationCancelValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid reservation ID is required.'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason must not exceed 500 characters.'),
  validate
];

// =================== PAYMENT VALIDATIONS ===================
const paymentCreateValidation = [
  body('reservation_id')
    .notEmpty()
    .withMessage('Reservation ID is required.')
    .isInt({ min: 1 }),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0.')
    .matches(/^\d+(\.\d{1,2})?$/)
    .withMessage('Amount must have at most two decimal places.'),
  body('payment_method')
    .notEmpty()
    .withMessage('Payment method is required.')
    .isIn(['cash', 'gcash'])
    .withMessage('Invalid payment method.'),
  body('transaction_reference')
    .optional({ checkFalsy: true })
    .trim()
    .toUpperCase()
    .matches(/^[A-Z0-9-]{6,100}$/)
    .withMessage('Reference must contain 6 to 100 letters, digits or hyphens.'),
  body('notes').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  validate
];

const paymentGcashValidation = [
  body('reservation_id')
    .notEmpty()
    .withMessage('Reservation ID is required.')
    .isInt({ min: 1 }),
  body('transaction_reference')
    .trim()
    .notEmpty()
    .withMessage('GCash reference number is required.')
    .toUpperCase()
    .matches(/^[A-Z0-9-]{6,100}$/)
    .withMessage('GCash reference number is invalid.'),
  validate
];

const paymentVerifyValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid payment ID is required.'),
  body('action')
    .notEmpty()
    .withMessage('Action is required.')
    .isIn(['verified', 'rejected'])
    .withMessage('Action must be verified or rejected.'),
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }),
  validate
];

// =================== CONTACT INQUIRY VALIDATIONS ===================
const contactCreateValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 }),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required.')
    .isLength({ max: 255 }),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required.')
    .isLength({ min: 5, max: 2000 })
    .withMessage('Message must be between 5 and 2000 characters.'),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
  courtCreateValidation,
  courtUpdateValidation,
  serviceCreateValidation,
  serviceUpdateValidation,
  reservationCreateValidation,
  reservationCancelValidation,
  paymentCreateValidation,
  paymentGcashValidation,
  paymentVerifyValidation,
  contactCreateValidation
};
