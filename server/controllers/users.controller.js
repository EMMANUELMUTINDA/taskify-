const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d).{6,}$/;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseStrathmoreLocalPart = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized.endsWith('@strathmore.edu')) {
    return null;
  }

  return normalized.split('@')[0];
};

const isStudentEmail = (email) => {
  const localPart = parseStrathmoreLocalPart(email);
  return Boolean(localPart && localPart.includes('.'));
};

const isSupervisorEmail = (email) => {
  const localPart = parseStrathmoreLocalPart(email);
  return Boolean(localPart && !localPart.includes('.'));
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const requestedGroupName = String(req.body.groupName || '').trim();
    const requestedCourseName = String(req.body.courseName || '').trim();
    const requestedClassGroup = String(req.body.classGroup || '').trim();
    const requestedUnitCode = String(req.body.unitCode || '').trim();
    const requestedStudyYear = toPositiveInt(req.body.studyYear);
    const normalizedEmail = normalizeEmail(email);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, and role are required' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (!PASSWORD_POLICY_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include at least one uppercase letter and one number',
      });
    }

    const validRoles = ['Supervisor', 'Member', 'GroupLeader'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role provided' });
    }

    if (role === 'Supervisor' && !isSupervisorEmail(normalizedEmail)) {
      return res.status(400).json({
        message:
          'Supervisor email must use the Strathmore supervisor format (no dot in local part), for example bmonda@strathmore.edu',
      });
    }

    if ((role === 'Member' || role === 'GroupLeader') && !isStudentEmail(normalizedEmail)) {
      return res.status(400).json({
        message:
          'Student email must use the Strathmore student format (first.second@strathmore.edu), for example emmanuel.mutinda@strathmore.edu',
      });
    }

    const groupName = role === 'Supervisor' ? null : requestedGroupName || null;
    const courseName = role === 'Supervisor' ? null : requestedCourseName || null;
    const studyYear = role === 'Supervisor' ? null : requestedStudyYear;
    const classGroup = role === 'Supervisor' ? null : requestedClassGroup || null;
    const unitCode = role === 'Supervisor' ? null : requestedUnitCode || null;

    const [existing] = await pool.query(
      `SELECT userID FROM users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, passwordHash, role, groupName, courseName, studyYear, classGroup, unitCode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, normalizedEmail, passwordHash, role, groupName, courseName, studyYear, classGroup, unitCode]
    );

    return res.status(201).json({ userID: result.insertId, message: 'User registered successfully' });
  } catch (_error) {
    return res.status(500).json({ message: 'Failed to register user' });
  }
};

const listUsers = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT userID, name, email, role, groupName, courseName, studyYear, classGroup, unitCode, isActive, createdAt, lastLogin
       FROM users
       WHERE isActive = 1
       ORDER BY name ASC`
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ message: 'Failed to load users' });
  }
};

const createClassGroup = async (req, res) => {
  try {
    const createdBy = Number(req.user?.userID || 0);
    const courseName = String(req.body.courseName || '').trim();
    const unitCode = String(req.body.unitCode || '').trim().toUpperCase();
    const classGroup = String(req.body.classGroup || '').trim();
    const studyYear = toPositiveInt(req.body.studyYear);

    if (!courseName || !unitCode || !classGroup || !studyYear) {
      return res.status(400).json({ message: 'courseName, studyYear, unitCode, and classGroup are required' });
    }

    const groupName = `${courseName} | Year ${studyYear} | ${unitCode} | ${classGroup}`;

    const [result] = await pool.query(
      `INSERT INTO class_groups (createdBy, courseName, studyYear, unitCode, classGroup, groupName)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE groupName = VALUES(groupName)`,
      [createdBy, courseName, studyYear, unitCode, classGroup, groupName]
    );

    const [rows] = await pool.query(
      `SELECT groupID, createdBy, courseName, studyYear, unitCode, classGroup, groupName, createdAt
       FROM class_groups
       WHERE createdBy = ? AND courseName = ? AND studyYear = ? AND unitCode = ? AND classGroup = ?
       LIMIT 1`,
      [createdBy, courseName, studyYear, unitCode, classGroup]
    );

    return res.status(201).json({
      message: 'Class group saved successfully',
      created: result.affectedRows === 1,
      group: rows[0] || null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save class group', error: error.message });
  }
};

const listClassGroups = async (req, res) => {
  try {
    const requesterRole = req.user?.role;
    const requesterId = Number(req.user?.userID || 0);
    const courseName = String(req.query.courseName || '').trim();
    const unitCode = String(req.query.unitCode || '').trim().toUpperCase();
    const classGroup = String(req.query.classGroup || '').trim();
    const studyYear = toPositiveInt(req.query.studyYear);

    const whereClauses = [];
    const params = [];

    if (requesterRole === 'Supervisor') {
      whereClauses.push('createdBy = ?');
      params.push(requesterId);
    }

    if (courseName) {
      whereClauses.push('courseName LIKE ?');
      params.push(`%${courseName}%`);
    }

    if (unitCode) {
      whereClauses.push('unitCode LIKE ?');
      params.push(`%${unitCode}%`);
    }

    if (classGroup) {
      whereClauses.push('classGroup LIKE ?');
      params.push(`%${classGroup}%`);
    }

    if (studyYear) {
      whereClauses.push('studyYear = ?');
      params.push(studyYear);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT groupID, createdBy, courseName, studyYear, unitCode, classGroup, groupName, createdAt
       FROM class_groups
       ${whereSql}
       ORDER BY createdAt DESC`,
      params
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load class groups', error: error.message });
  }
};

const updateMyAcademicProfile = async (req, res) => {
  try {
    const userId = Number(req.user?.userID || 0);
    const role = req.user?.role;

    if (role === 'Supervisor') {
      return res.status(400).json({ message: 'Supervisors do not require student academic profile updates' });
    }

    const selectedGroupId = toPositiveInt(req.body.groupID);
    let courseName = String(req.body.courseName || '').trim();
    let unitCode = String(req.body.unitCode || '').trim().toUpperCase();
    let classGroup = String(req.body.classGroup || '').trim();
    let studyYear = toPositiveInt(req.body.studyYear);
    let groupName = '';

    if (selectedGroupId) {
      const [groups] = await pool.query(
        `SELECT groupID, courseName, studyYear, unitCode, classGroup, groupName
         FROM class_groups
         WHERE groupID = ?
         LIMIT 1`,
        [selectedGroupId]
      );

      if (groups.length === 0) {
        return res.status(404).json({ message: 'Selected class group was not found' });
      }

      const selectedGroup = groups[0];
      courseName = selectedGroup.courseName;
      studyYear = Number(selectedGroup.studyYear);
      unitCode = selectedGroup.unitCode;
      classGroup = selectedGroup.classGroup;
      groupName = selectedGroup.groupName;
    }

    if (!courseName || !studyYear || !classGroup) {
      return res.status(400).json({ message: 'courseName, studyYear, and classGroup are required' });
    }

    if (!groupName) {
      groupName = unitCode
        ? `${courseName} | Year ${studyYear} | ${unitCode} | ${classGroup}`
        : `${courseName} | Year ${studyYear} | ${classGroup}`;
    }

    await pool.query(
      `UPDATE users
       SET courseName = ?,
           course = ?,
           studyYear = ?,
           yearOfStudy = ?,
           classGroup = ?,
           unitCode = ?,
           groupName = ?,
           profileComplete = 1
       WHERE userID = ?`,
      [courseName, courseName, studyYear, studyYear, classGroup, unitCode || null, groupName, userId]
    );

    const [rows] = await pool.query(
      `SELECT userID, name, email, role, groupName, courseName, course, studyYear, yearOfStudy, classGroup, unitCode, profileComplete
       FROM users
       WHERE userID = ?
       LIMIT 1`,
      [userId]
    );

    return res.json({ message: 'Academic profile updated', user: rows[0] || null });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update academic profile', error: error.message });
  }
};

module.exports = {
  registerUser,
  listUsers,
  createClassGroup,
  listClassGroups,
  updateMyAcademicProfile,
};
