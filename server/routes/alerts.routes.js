const express = require('express');
const { listActiveAlerts, resolveAlert } = require('../controllers/alerts.controller');

const router = express.Router();

router.get('/', listActiveAlerts);
router.patch('/:alertId/resolve', resolveAlert);

module.exports = router;
