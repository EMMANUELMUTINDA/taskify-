const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d).{6,}$/;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

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

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, and role are required' });
    }

    if (!EMAIL_REGEX.test(String(email).trim())) {
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

    if (role === 'Supervisor' && !isSupervisorEmail(email)) {
      return res.status(400).json({
        message:
          'Supervisor email must use the Strathmore supervisor format (no dot in local part), for example bmonda@strathmore.edu',
      });
    }

    if ((role === 'Member' || role === 'GroupLeader') && !isStudentEmail(email)) {
      return res.status(400).json({
        message:
          'Student email must use the Strathmore student format (first.second@strathmore.edu), for example emmanuel.mutinda@strathmore.edu',
      });
    }

    const [existing] = await pool.query(
      `SELECT userID FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, passwordHash, role)
       VALUES (?, ?, ?, ?)`,
      [name, email, passwordHash, role]
    );

    return res.status(201).json({ userID: result.insertId, message: 'User registered successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register user', error: error.message });
  }
};

const listUsers = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT userID, name, email, role, isActive, createdAt, lastLogin
       FROM users
       WHERE isActive = 1
       ORDER BY name ASC`
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load users', error: error.message });
  }
};

module.exports = {
  registerUser,
  listUsers,
};
