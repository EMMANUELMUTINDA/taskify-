const express = require('express');
const multer = require('multer');
const {
  uploadAssignmentFile,
  listAssignments,
  uploadAssignment,
  downloadAssignment,
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
router.get('/projects/:projectId/assignments/:assignmentId/download', downloadAssignment);

router.get('/projects/:projectId/messages', listMessages);
router.post('/projects/:projectId/messages', sendMessage);

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError || error?.message?.includes('Unsupported file type')) {
    return res.status(400).json({ message: error.message || 'Invalid upload request' });
  }

  return next(error);
});

module.exports = router;
