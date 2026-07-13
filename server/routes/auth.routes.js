const express = require('express');
const {
	register,
	login,
	me,
	requestPasswordReset,
	resetPassword,
	getMyNotifications,
	markNotificationRead,
} = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { resetVerifyRateLimit } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetVerifyRateLimit, resetPassword);
router.get('/me', authenticateToken, me);
router.get('/notifications', authenticateToken, getMyNotifications);
router.patch('/notifications/:id/read', authenticateToken, markNotificationRead);

module.exports = router;
