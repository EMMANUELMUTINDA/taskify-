const express = require('express');
const {
	listUsers,
	registerUser,
	createClassGroup,
	listClassGroups,
	updateMyAcademicProfile,
} = require('../controllers/users.controller');
const { requireSupervisor } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', requireSupervisor, registerUser);
router.get('/', listUsers);
router.post('/class-groups', requireSupervisor, createClassGroup);
router.get('/class-groups', listClassGroups);
router.patch('/me/academic-profile', updateMyAcademicProfile);

module.exports = router;
