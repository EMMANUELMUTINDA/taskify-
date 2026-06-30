const express = require('express');
const {
  uploadAssignmentFile,
  listAssignments,
  uploadAssignment,
  listMessages,
  sendMessage,
} = require('../controllers/collab.controller');

const router = express.Router();

router.get('/projects/:projectId/assignments', listAssignments);
router.post(
  '/projects/:projectId/assignments',
  uploadAssignmentFile.single('assignmentFile'),
  uploadAssignment
);

router.get('/projects/:projectId/messages', listMessages);
router.post('/projects/:projectId/messages', sendMessage);

module.exports = router;
