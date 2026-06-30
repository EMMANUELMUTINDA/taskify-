const express = require('express');
const {
	register,
	login,
	me,
	requestPasswordReset,
	resetPassword,
} = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, me);

module.exports = router;
