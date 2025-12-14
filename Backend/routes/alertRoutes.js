const express = require('express');
const router = express.Router();
const {
  getAlerts,
  acknowledgeAlert,
  getUnreadCount
} = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('doctor'), getAlerts);
router.put('/:id/acknowledge', protect, authorize('doctor'), acknowledgeAlert);
router.get('/unread-count', protect, authorize('doctor'), getUnreadCount);

module.exports = router;