const { pool } = require('../config/db');

const createProject = async (req, res) => {
  try {
    const { title, description, status, deadline } = req.body;
    const createdBy = req.user.userID;

    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO projects (createdBy, title, description, status, deadline)
       VALUES (?, ?, ?, ?, ?)`,
      [createdBy, title, description || null, status || 'Active', deadline || null]
    );

    return res.status(201).json({ projectID: result.insertId, message: 'Project created' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create project', error: error.message });
  }
};

const listProjects = async (req, res) => {
  try {
    const isSupervisor = req.user?.role === 'Supervisor';
    const userId = Number(req.user?.userID || 0);

    const [rows] = isSupervisor
      ? await pool.query(
          `SELECT projectID, createdBy, title, description, status, deadline, createdAt
           FROM projects
           WHERE createdBy = ?
           ORDER BY createdAt DESC`,
          [userId]
        )
      : await pool.query(
          `SELECT DISTINCT p.projectID, p.createdBy, p.title, p.description, p.status, p.deadline, p.createdAt
           FROM projects p
           JOIN project_members pm ON pm.projectID = p.projectID
           WHERE pm.userID = ?
           ORDER BY p.createdAt DESC`,
          [userId]
        );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load projects', error: error.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = Number(req.user?.userID || 0);
    const isSupervisor = req.user?.role === 'Supervisor';

    const [rows] = isSupervisor
      ? await pool.query(
          `SELECT projectID, createdBy, title, description, status, deadline, createdAt
           FROM projects
           WHERE projectID = ? AND createdBy = ?`,
          [projectId, userId]
        )
      : await pool.query(
          `SELECT p.projectID, p.createdBy, p.title, p.description, p.status, p.deadline, p.createdAt
           FROM projects p
           JOIN project_members pm ON pm.projectID = p.projectID
           WHERE p.projectID = ? AND pm.userID = ?
           LIMIT 1`,
          [projectId, userId]
        );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load project', error: error.message });
  }
};

const addProjectMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userID, roleInProject } = req.body;
    const supervisorId = Number(req.user?.userID || 0);

    if (!userID) {
      return res.status(400).json({ message: 'userID is required' });
    }

    const [ownedProject] = await pool.query(
      `SELECT projectID FROM projects WHERE projectID = ? AND createdBy = ? LIMIT 1`,
      [projectId, supervisorId]
    );

    if (ownedProject.length === 0) {
      return res.status(403).json({ message: 'You can only manage members for rooms you created' });
    }

    await pool.query(
      `INSERT INTO project_members (projectID, userID, roleInProject)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE roleInProject = VALUES(roleInProject)`,
      [projectId, userID, roleInProject || 'Member']
    );

    return res.status(201).json({ message: 'Member assigned to project' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to assign member', error: error.message });
  }
};

const allocateGroupToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const groupName = String(req.body.groupName || '').trim();
    const supervisorId = Number(req.user?.userID || 0);

    if (!groupName) {
      return res.status(400).json({ message: 'groupName is required' });
    }

    const [ownedProject] = await pool.query(
      `SELECT projectID FROM projects WHERE projectID = ? AND createdBy = ? LIMIT 1`,
      [projectId, supervisorId]
    );

    if (ownedProject.length === 0) {
      return res.status(403).json({ message: 'You can only allocate groups to rooms you created' });
    }

    const [groupMembers] = await pool.query(
      `SELECT userID
       FROM users
       WHERE isActive = 1
         AND groupName = ?
         AND role IN ('Member', 'GroupLeader')`,
      [groupName]
    );

    if (groupMembers.length === 0) {
      return res.status(404).json({ message: 'No active students found for this group' });
    }

    await Promise.all(
      groupMembers.map((row) =>
        pool.query(
          `INSERT INTO project_members (projectID, userID, roleInProject)
           VALUES (?, ?, 'Member')
           ON DUPLICATE KEY UPDATE roleInProject = roleInProject`,
          [projectId, row.userID]
        )
      )
    );

    return res.status(201).json({
      message: `Allocated ${groupMembers.length} students from group ${groupName} to room`,
      assignedCount: groupMembers.length,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to allocate group to room', error: error.message });
  }
};

const listProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = Number(req.user?.userID || 0);
    const isSupervisor = req.user?.role === 'Supervisor';

    const [canView] = isSupervisor
      ? await pool.query(
          `SELECT projectID FROM projects WHERE projectID = ? AND createdBy = ? LIMIT 1`,
          [projectId, userId]
        )
      : await pool.query(
          `SELECT projectID FROM project_members WHERE projectID = ? AND userID = ? LIMIT 1`,
          [projectId, userId]
        );

    if (canView.length === 0) {
      return res.status(403).json({ message: 'You are not allowed to view members for this room' });
    }

    const [rows] = await pool.query(
      `SELECT pm.projectMemberID, pm.projectID, pm.userID, pm.roleInProject, pm.joinedAt,
              u.name, u.email, u.role, u.groupName, u.isActive
       FROM project_members pm
       JOIN users u ON u.userID = pm.userID
       WHERE pm.projectID = ?
       ORDER BY pm.joinedAt ASC`,
      [projectId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load project members', error: error.message });
  }
};

module.exports = {
  createProject,
  listProjects,
  getProjectById,
  addProjectMember,
  allocateGroupToProject,
  listProjectMembers,
};
