const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  paymentCreateValidation,
  paymentGcashValidation,
  paymentVerifyValidation
} = require('../middleware/validate');

// Customer payment endpoints
router.get('/instructions', paymentController.getPaymentInstructions);
router.post('/gcash', authenticate, paymentGcashValidation, paymentController.submitGcashReference);
router.post('/', authenticate, paymentCreateValidation, paymentController.createPayment);
router.get('/reservation/:reservationId', authenticate, paymentController.getReservationPayments);

// Payment details
router.get('/:id', authenticate, paymentController.getPaymentById);

// Admin / Staff payment management
router.get('/', authenticate, authorize('admin', 'staff'), paymentController.getAllPayments);
router.put('/:id/verify', authenticate, authorize('admin', 'staff'), paymentVerifyValidation, paymentController.verifyPayment);

module.exports = router;
