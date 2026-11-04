const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/playerController');

const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
router.get('/', controller.getPlayers);
router.post('/', controller.addPlayer);
router.patch('/:id', controller.renamePlayer);
router.delete('/:id', controller.removePlayer);
router.post('/:id/timer', controller.controlTimer);

module.exports = router;
