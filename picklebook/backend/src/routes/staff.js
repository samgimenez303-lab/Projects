const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const counterBookingController = require('../controllers/counterBookingController');
const { authenticate, authorize } = require('../middleware/auth');

// Front desk staff operations
router.get('/daily', authenticate, authorize('staff', 'admin'), staffController.getDailySchedule);
router.post('/check-in/:id', authenticate, authorize('staff', 'admin'), staffController.checkInReservation);
router.get('/quick-stats', authenticate, authorize('staff', 'admin'), staffController.getQuickStats);
router.post('/cash-payment', authenticate, authorize('staff', 'admin'), staffController.markCashPaymentCollected);
router.get('/customers', authenticate, authorize('staff', 'admin'), counterBookingController.searchCustomers);
router.post('/walk-in-reservations', authenticate, authorize('staff', 'admin'), counterBookingController.createWalkInReservation);

module.exports = router;
