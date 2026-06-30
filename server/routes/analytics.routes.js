const express = require('express');
const {
  getProjectOverview,
  getMemberAnalytics,
  listProjectAlerts,
} = require('../controllers/analytics.controller');

const router = express.Router();

router.get('/projects/:projectId/overview', getProjectOverview);
router.get('/projects/:projectId/members/:userId', getMemberAnalytics);
router.get('/projects/:projectId/alerts', listProjectAlerts);

module.exports = router;
