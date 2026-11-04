const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticate, authorize } = require('../middleware/auth');
const { contactCreateValidation } = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimiter');

// Public contact submission
router.post('/', contactLimiter, contactCreateValidation, contactController.submitInquiry);

// Staff / Admin contact inquiries management
router.get('/', authenticate, authorize('admin', 'staff'), contactController.getAllInquiries);
router.get('/:id', authenticate, authorize('admin', 'staff'), contactController.getInquiryById);
router.put('/:id', authenticate, authorize('admin', 'staff'), contactController.updateInquiryStatus);
router.delete('/:id', authenticate, authorize('admin'), contactController.deleteInquiry);

module.exports = router;
