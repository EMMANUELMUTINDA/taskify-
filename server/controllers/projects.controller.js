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

const listProjects = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT projectID, createdBy, title, description, status, deadline, createdAt
       FROM projects
       ORDER BY createdAt DESC`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load projects', error: error.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [rows] = await pool.query(
      `SELECT projectID, createdBy, title, description, status, deadline, createdAt
       FROM projects
       WHERE projectID = ?`,
      [projectId]
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

    if (!userID) {
      return res.status(400).json({ message: 'userID is required' });
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

const listProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [rows] = await pool.query(
      `SELECT pm.projectMemberID, pm.projectID, pm.userID, pm.roleInProject, pm.joinedAt,
              u.name, u.email, u.role, u.isActive
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
  listProjectMembers,
};
