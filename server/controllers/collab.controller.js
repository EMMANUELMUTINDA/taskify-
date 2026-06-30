const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../config/db');

const ASSIGNMENTS_DIR = path.resolve(__dirname, '..', 'uploads', 'assignments');

if (!fs.existsSync(ASSIGNMENTS_DIR)) {
  fs.mkdirSync(ASSIGNMENTS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ASSIGNMENTS_DIR),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

const uploadAssignmentFile = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ensureProjectMembership = async (projectId, userId) => {
  const [rows] = await pool.query(
    `SELECT projectMemberID FROM project_members WHERE projectID = ? AND userID = ? LIMIT 1`,
    [projectId, userId]
  );

  return rows.length > 0;
};

const listAssignments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = Number(req.user.userID);
    const role = req.user.role;

    const hasAccess = role === 'Supervisor' || (await ensureProjectMembership(projectId, userId));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const [rows] = await pool.query(
      `SELECT a.assignmentID, a.projectID, a.title, a.description, a.fileName, a.filePath,
              a.uploadedAt, a.uploadedBy, u.name AS uploadedByName
       FROM assignments a
       JOIN users u ON u.userID = a.uploadedBy
       WHERE a.projectID = ?
       ORDER BY a.uploadedAt DESC`,
      [projectId]
    );

    const withUrls = rows.map((row) => ({
      ...row,
      downloadUrl: `/uploads/assignments/${path.basename(row.filePath)}`,
    }));

    return res.json(withUrls);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load assignments', error: error.message });
  }
};

const uploadAssignment = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description } = req.body;
    const uploadedBy = Number(req.user.userID);
    const role = req.user.role;

    const hasAccess = role === 'Supervisor' || (await ensureProjectMembership(projectId, uploadedBy));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Assignment file is required' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Assignment title is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO assignments (projectID, uploadedBy, title, description, fileName, filePath)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        uploadedBy,
        title.trim(),
        description ? description.trim() : null,
        req.file.originalname,
        req.file.path,
      ]
    );

    return res.status(201).json({ assignmentID: result.insertId, message: 'Assignment uploaded' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload assignment', error: error.message });
  }
};

const listMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = Number(req.user.userID);
    const role = req.user.role;

    const hasAccess = role === 'Supervisor' || (await ensureProjectMembership(projectId, userId));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const [rows] = await pool.query(
      `SELECT pm.messageID, pm.projectID, pm.userID, pm.message, pm.sentAt,
              u.name, u.role
       FROM project_messages pm
       JOIN users u ON u.userID = pm.userID
       WHERE pm.projectID = ?
       ORDER BY pm.sentAt ASC`,
      [projectId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load chat messages', error: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = Number(req.user.userID);
    const role = req.user.role;
    const message = String(req.body.message || '').trim();

    if (!message) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ message: 'Message must be 1000 characters or fewer' });
    }

    const hasAccess = role === 'Supervisor' || (await ensureProjectMembership(projectId, userId));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const [result] = await pool.query(
      `INSERT INTO project_messages (projectID, userID, message)
       VALUES (?, ?, ?)`,
      [projectId, userId, message]
    );

    return res.status(201).json({ messageID: result.insertId, message: 'Message sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

module.exports = {
  uploadAssignmentFile,
  listAssignments,
  uploadAssignment,
  listMessages,
  sendMessage,
};
