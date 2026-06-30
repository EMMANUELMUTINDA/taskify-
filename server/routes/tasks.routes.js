const express = require('express');
const {
  createTask,
  listTasks,
  updateTaskStatus,
  addTaskUpdate,
  listTaskUpdates,
} = require('../controllers/tasks.controller');

const router = express.Router();

router.post('/', createTask);
router.get('/', listTasks);
router.patch('/:taskId/status', updateTaskStatus);
router.post('/:taskId/updates', addTaskUpdate);
router.get('/:taskId/updates', listTaskUpdates);

module.exports = router;
