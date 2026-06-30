const { pool } = require('../config/db');

const getProjectMembership = async (projectId, userId) => {
  const [rows] = await pool.query(
    `SELECT roleInProject FROM project_members WHERE projectID = ? AND userID = ? LIMIT 1`,
    [projectId, userId]
  );

  return rows[0] || null;
};

const canManageTasks = (role, membership) => {
  return role === 'Supervisor' || role === 'GroupLeader' || membership?.roleInProject === 'Leader';
};

const createTask = async (req, res) => {
  try {
    const actorUserId = req.user.userID;
    const actorRole = req.user.role;
    const { projectID, assignedTo, title, status, progressPct, deadline } = req.body;

    if (!projectID || !assignedTo || !title) {
      return res.status(400).json({ message: 'projectID, assignedTo, and title are required' });
    }

    const actorMembership = await getProjectMembership(projectID, actorUserId);
    if (!canManageTasks(actorRole, actorMembership)) {
      return res.status(403).json({ message: 'Only supervisors or project leaders can create tasks' });
    }

    const assigneeMembership = await getProjectMembership(projectID, assignedTo);
    if (!assigneeMembership) {
      return res.status(400).json({ message: 'Assigned user must be a project member' });
    }

    const [result] = await pool.query(
      `INSERT INTO tasks (projectID, assignedTo, title, status, progressPct, deadline)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectID, assignedTo, title, status || 'Todo', progressPct || 0, deadline || null]
    );

    await pool.query(
      `INSERT INTO activity_events (userID, projectID, eventType, sourceID, scoreImpact)
       VALUES (?, ?, 'TaskCreated', ?, 2.00)`,
      [actorUserId, projectID, result.insertId]
    );

    return res.status(201).json({ taskID: result.insertId, message: 'Task created' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create task', error: error.message });
  }
};

const listTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    const actorUserId = req.user.userID;
    const actorRole = req.user.role;

    if (!projectId) {
      return res.status(400).json({ message: 'projectId query parameter is required' });
    }

    const actorMembership = await getProjectMembership(projectId, actorUserId);
    if (actorRole !== 'Supervisor' && !actorMembership) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const [rows] = await pool.query(
      `SELECT taskID, projectID, assignedTo, title, status, progressPct, deadline, createdAt, updatedAt
       FROM tasks
       WHERE projectID = ?
       ORDER BY createdAt DESC`,
      [projectId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load tasks', error: error.message });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const actorUserId = Number(req.user.userID);
    const actorRole = req.user.role;
    const { taskId } = req.params;
    const { status, progressPct } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }

    const [taskRows] = await pool.query(
      `SELECT taskID, projectID, assignedTo FROM tasks WHERE taskID = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskRows[0];
    const actorMembership = await getProjectMembership(task.projectID, actorUserId);
    if (actorRole !== 'Supervisor' && !actorMembership) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const actorCanManageAll = canManageTasks(actorRole, actorMembership);
    const isAssignedTask = Number(task.assignedTo) === actorUserId;
    if (!actorCanManageAll && !isAssignedTask) {
      return res.status(403).json({ message: 'You can only update tasks assigned to you' });
    }

    await pool.query(
      `UPDATE tasks
       SET status = ?, progressPct = COALESCE(?, progressPct)
       WHERE taskID = ?`,
      [status, progressPct ?? null, taskId]
    );

    const eventType = status === 'Done' ? 'TaskCompleted' : 'TaskUpdated';
    const scoreImpact = status === 'Done' ? 4.0 : 1.0;

    await pool.query(
      `INSERT INTO activity_events (userID, projectID, eventType, sourceID, scoreImpact)
       VALUES (?, ?, ?, ?, ?)`,
      [task.assignedTo, task.projectID, eventType, Number(taskId), scoreImpact]
    );

    return res.json({ message: 'Task status updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update task status', error: error.message });
  }
};

const addTaskUpdate = async (req, res) => {
  try {
    const actorUserId = req.user.userID;
    const { taskId } = req.params;
    const { updateType, note, progressDelta } = req.body;

    if (!updateType) {
      return res.status(400).json({ message: 'updateType is required' });
    }

    const [taskRows] = await pool.query(
      `SELECT taskID, projectID FROM tasks WHERE taskID = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const [result] = await pool.query(
      `INSERT INTO task_updates (taskID, userID, updateType, note, progressDelta)
       VALUES (?, ?, ?, ?, ?)`,
      [taskId, actorUserId, updateType, note || null, progressDelta || 0]
    );

    await pool.query(
      `INSERT INTO activity_events (userID, projectID, eventType, sourceID, scoreImpact)
       VALUES (?, ?, 'CommentAdded', ?, 1.00)`,
      [actorUserId, taskRows[0].projectID, result.insertId]
    );

    if (progressDelta) {
      await pool.query(
        `UPDATE tasks
         SET progressPct = LEAST(100, GREATEST(0, progressPct + ?))
         WHERE taskID = ?`,
        [progressDelta, taskId]
      );
    }

    return res.status(201).json({ updateID: result.insertId, message: 'Task update added' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add task update', error: error.message });
  }
};

const listTaskUpdates = async (req, res) => {
  try {
    const { taskId } = req.params;

    const [rows] = await pool.query(
      `SELECT tu.updateID, tu.taskID, tu.userID, tu.updateType, tu.note, tu.progressDelta, tu.createdAt,
              u.name
       FROM task_updates tu
       JOIN users u ON u.userID = tu.userID
       WHERE tu.taskID = ?
       ORDER BY tu.createdAt DESC`,
      [taskId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load task updates', error: error.message });
  }
};

module.exports = {
  createTask,
  listTasks,
  updateTaskStatus,
  addTaskUpdate,
  listTaskUpdates,
};
