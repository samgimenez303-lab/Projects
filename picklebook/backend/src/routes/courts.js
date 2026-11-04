const express = require('express');
const router = express.Router();
const courtController = require('../controllers/courtController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { courtCreateValidation, courtUpdateValidation } = require('../middleware/validate');

// Public endpoints
router.get('/', optionalAuth, courtController.getAllCourts);
router.get('/:id', courtController.getCourtById);
router.get('/:id/availability', courtController.getCourtAvailability);
router.get('/:id/hours', courtController.getOperatingHours);
router.get('/:id/closures', courtController.getClosures);

// Admin / Staff closure endpoints
router.post('/closures', authenticate, authorize('admin', 'staff'), courtController.addClosure);
router.delete('/closures/:closureId', authenticate, authorize('admin', 'staff'), courtController.deleteClosure);

// Admin court management endpoints
router.post('/', authenticate, authorize('admin'), courtCreateValidation, courtController.createCourt);
router.put('/:id', authenticate, authorize('admin'), courtUpdateValidation, courtController.updateCourt);
router.delete('/:id', authenticate, authorize('admin'), courtController.deleteCourt);
router.put('/:id/hours', authenticate, authorize('admin'), courtController.updateOperatingHours);

// Court images management
router.post('/:id/images', authenticate, authorize('admin'), courtController.addCourtImage);
router.delete('/:id/images/:imageId', authenticate, authorize('admin'), courtController.deleteCourtImage);
router.put('/:id/images/:imageId/primary', authenticate, authorize('admin'), courtController.setPrimaryCourtImage);

module.exports = router;
