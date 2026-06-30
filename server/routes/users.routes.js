const express = require('express');
const { listUsers, registerUser } = require('../controllers/users.controller');
const { requireSupervisor } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', requireSupervisor, registerUser);
router.get('/', listUsers);

module.exports = router;
