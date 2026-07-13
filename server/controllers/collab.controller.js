const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../config/db');

const ASSIGNMENTS_DIR = path.resolve(__dirname, '..', 'uploads', 'assignments');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.csv', '.zip']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]);

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
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const isAllowedExtension = ALLOWED_EXTENSIONS.has(extension);
    const isAllowedMimeType = ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase());

    if (!isAllowedExtension || !isAllowedMimeType) {
      return cb(new Error('Unsupported file type. Upload PDF, DOC, DOCX, TXT, PNG, JPG, CSV, or ZIP files only.'));
    }

    return cb(null, true);
  },
});

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const ensureProjectMembership = async (projectId, userId) => {
  const [rows] = await pool.query(
    `SELECT projectMemberID FROM project_members WHERE projectID = ? AND userID = ? LIMIT 1`,
    [projectId, userId]
  );

  return rows.length > 0;
};

const listAssignments = async (req, res) => {
  try {
    const projectId = parsePositiveInt(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

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
      downloadUrl: `/api/collab/projects/${projectId}/assignments/${row.assignmentID}/download`,
    }));

    return res.json(withUrls);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load assignments' });
  }
};

const uploadAssignment = async (req, res) => {
  try {
    const projectId = parsePositiveInt(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

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
    return res.status(500).json({ message: 'Failed to upload assignment' });
  }
};

const downloadAssignment = async (req, res) => {
  try {
    const projectId = parsePositiveInt(req.params.projectId);
    const assignmentId = parsePositiveInt(req.params.assignmentId);

    if (!projectId || !assignmentId) {
      return res.status(400).json({ message: 'Invalid project or assignment ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const hasAccess = role === 'Supervisor' || (await ensureProjectMembership(projectId, userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const [rows] = await pool.query(
      `SELECT assignmentID, filePath, fileName
       FROM assignments
       WHERE projectID = ? AND assignmentID = ?
       LIMIT 1`,
      [projectId, assignmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Assignment file not found' });
    }

    const record = rows[0];
    const absolutePath = path.resolve(record.filePath);

    if (!absolutePath.startsWith(ASSIGNMENTS_DIR) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Assignment file not found' });
    }

    return res.download(absolutePath, record.fileName || path.basename(absolutePath));
  } catch (_error) {
    return res.status(500).json({ message: 'Failed to download assignment' });
  }
};

const listMessages = async (req, res) => {
  try {
    const projectId = parsePositiveInt(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;

    const hasAccess = role === 'Supervisor' || (await ensureProjectMembership(projectId, userId));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    const [rows] = await pool.query(
      `SELECT pm.messageID, pm.projectID, pm.userID, pm.message, pm.sentAt,
              u.name, u.role,
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM activity_events ae
                  WHERE ae.projectID = pm.projectID
                    AND ae.userID = pm.userID
                    AND ae.eventType = 'CommentAdded'
                    AND ae.sourceID = pm.messageID
                  LIMIT 1
                ) THEN 1
                ELSE 0
              END AS isWorkUpdate
       FROM project_messages pm
       JOIN users u ON u.userID = pm.userID
       WHERE pm.projectID = ?
       ORDER BY pm.sentAt ASC`,
      [projectId]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load chat messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const projectId = parsePositiveInt(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const userId = Number(req.user.userID);
    const role = req.user.role;
    const message = String(req.body.message || '').trim();
    const isWorkUpdate = Boolean(req.body.isWorkUpdate);

    if (!message) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ message: 'Message must be 5000 characters or fewer' });
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

    const qualifiesAsContribution = isWorkUpdate || message.length >= 120;

    if (qualifiesAsContribution) {
      const scoreImpact = Math.max(2, Math.min(12, Math.round(message.length / 80)));
      await pool.query(
        `INSERT INTO activity_events (userID, projectID, eventType, sourceID, scoreImpact)
         VALUES (?, ?, 'CommentAdded', ?, ?)`,
        [userId, projectId, Number(result.insertId), scoreImpact]
      );
    }

    return res.status(201).json({
      messageID: result.insertId,
      message: qualifiesAsContribution
        ? 'Work update sent and counted toward contribution'
        : 'Message sent',
      countedAsContribution: qualifiesAsContribution,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send message' });
  }
};

module.exports = {
  uploadAssignmentFile,
  listAssignments,
  uploadAssignment,
  downloadAssignment,
  listMessages,
  sendMessage,
};
