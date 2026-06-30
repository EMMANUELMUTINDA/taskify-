const express = require('express');
const {
  createProject,
  listProjects,
  getProjectById,
  addProjectMember,
  listProjectMembers,
} = require('../controllers/projects.controller');
const { requireSupervisor } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', requireSupervisor, createProject);
router.get('/', listProjects);
router.get('/:projectId', getProjectById);
router.post('/:projectId/members', requireSupervisor, addProjectMember);
router.get('/:projectId/members', listProjectMembers);

module.exports = router;
