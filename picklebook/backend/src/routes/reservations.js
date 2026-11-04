const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  reservationCreateValidation,
  reservationCancelValidation
} = require('../middleware/validate');

// Customer endpoints
router.post('/', authenticate, reservationCreateValidation, reservationController.createReservation);
router.get('/my', authenticate, reservationController.getMyReservations);

// Admin / Staff query all reservations
router.get('/', authenticate, authorize('admin', 'staff'), reservationController.getAllReservations);

// Lookups by reference or ID
router.get('/ref/:reference', authenticate, reservationController.getReservationByReference);
router.get('/:id', authenticate, reservationController.getReservationById);

// Cancellation
router.post('/:id/cancel', authenticate, reservationCancelValidation, reservationController.cancelReservation);

// Status modification (Admin / Staff)
router.put('/:id/status', authenticate, authorize('admin', 'staff'), reservationController.updateStatus);

module.exports = router;
