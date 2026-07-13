const express = require('express');
const { updateProfile } = require('../controllers/profile.controller');

const router = express.Router();

router.put('/', updateProfile);

module.exports = router;
