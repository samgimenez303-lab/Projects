const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// Dashboard endpoints for administrators
router.get('/overview', authenticate, authorize('admin'), dashboardController.getDashboardOverview);
router.get('/stats', authenticate, authorize('admin'), dashboardController.getDashboardStats);
router.get('/charts', authenticate, authorize('admin'), dashboardController.getDashboardCharts);

module.exports = router;
