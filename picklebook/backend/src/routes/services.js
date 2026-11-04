const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { serviceCreateValidation, serviceUpdateValidation } = require('../middleware/validate');

// Public endpoints
router.get('/', optionalAuth, serviceController.getAllServices);
router.get('/:id', optionalAuth, serviceController.getServiceById);

// Admin service management
router.post('/', authenticate, authorize('admin'), serviceCreateValidation, serviceController.createService);
router.put('/:id', authenticate, authorize('admin'), serviceUpdateValidation, serviceController.updateService);
router.delete('/:id', authenticate, authorize('admin'), serviceController.deleteService);

module.exports = router;
