const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

// CSV exports (Admin only)
router.get('/reservations', authenticate, authorize('admin'), reportController.exportReservationsCSV);
router.get('/payments', authenticate, authorize('admin'), reportController.exportPaymentsCSV);
router.get('/users', authenticate, authorize('admin'), reportController.exportUsersCSV);

module.exports = router;
