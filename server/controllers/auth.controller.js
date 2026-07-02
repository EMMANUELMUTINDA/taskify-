const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

const normalizeRole = (role) => (role === 'Admin' ? 'Supervisor' : role);
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

const smtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
};

const sendPasswordResetEmail = async ({ email, name, token }) => {
  if (!smtpConfigured()) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl.replace(/\/$/, '')}/login`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Taskify password reset token',
    text:
      `Hello ${name},\n\n` +
      `Use this reset token to change your password: ${token}\n\n` +
      `Open ${resetUrl}, choose "Forgot password", and submit the token within 30 minutes.\n\n` +
      'If you did not request this, please ignore this email.',
    html:
      `<p>Hello ${name},</p>` +
      `<p>Use this reset token to change your password:</p>` +
      `<p><strong>${token}</strong></p>` +
      `<p>Open <a href="${resetUrl}">${resetUrl}</a>, choose <strong>Forgot password</strong>, and submit the token within 30 minutes.</p>` +
      '<p>If you did not request this, please ignore this email.</p>',
  });

  return true;
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (!PASSWORD_POLICY_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include at least one uppercase letter and one number',
      });
    }

    const [existing] = await pool.query(
      `SELECT userID FROM users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const requestedRole = isSupervisorEmail(normalizedEmail)
      ? 'Supervisor'
      : isStudentEmail(normalizedEmail)
      ? 'Member'
      : null;

    if (!requestedRole) {
      return res.status(400).json({
        message:
          'Email must be a Strathmore address with valid format: student first.second@strathmore.edu or supervisor nodot@strathmore.edu',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, passwordHash, role, isActive)
       VALUES (?, ?, ?, ?, 1)`,
      [name, normalizedEmail, passwordHash, requestedRole]
    );

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        userID: Number(result.insertId),
        name,
        email: normalizedEmail,
        role: requestedRole,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create account' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT userID, name, email, passwordHash, role, isActive
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const role = normalizeRole(user.role);
    if (user.role === 'Admin') {
      await pool.query(
        `UPDATE users SET role = 'Supervisor' WHERE userID = ?`,
        [user.userID]
      );
    }

    await pool.query(
      `UPDATE users SET lastLogin = NOW() WHERE userID = ?`,
      [user.userID]
    );

    const token = jwt.sign(
      {
        userID: user.userID,
        email: user.email,
        name: user.name,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        userID: Number(user.userID),
        name: user.name,
        email: user.email,
        role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to authenticate user' });
  }
};

const me = async (req, res) => {
  try {
    const { userID } = req.user;

    const [rows] = await pool.query(
      `SELECT userID, name, email, role, isActive
       FROM users
       WHERE userID = ?
       LIMIT 1`,
      [userID]
    );

    if (rows.length === 0 || !rows[0].isActive) {
      return res.status(401).json({ message: 'User session is invalid' });
    }

    const user = rows[0];
    const role = normalizeRole(user.role);

    if (user.role === 'Admin') {
      await pool.query(
        `UPDATE users SET role = 'Supervisor' WHERE userID = ?`,
        [user.userID]
      );
    }

    return res.json({
      user: {
        userID: Number(user.userID),
        name: user.name,
        email: user.email,
        role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load user profile' });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const [rows] = await pool.query(
      `SELECT userID, name, email, isActive FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0 || !rows[0].isActive) {
      return res.json({
        message: 'If this email is registered, a reset token has been generated.',
      });
    }

    const userId = Number(rows[0].userID);
    const userName = rows[0].name;
    const userEmail = rows[0].email;
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await pool.query(
      `UPDATE password_resets SET usedAt = NOW() WHERE userID = ? AND usedAt IS NULL`,
      [userId]
    );

    await pool.query(
      `INSERT INTO password_resets (userID, tokenHash, expiresAt)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [userId, tokenHash]
    );

    const sentByEmail = await sendPasswordResetEmail({
      email: userEmail,
      name: userName,
      token: rawToken,
    });

    if (sentByEmail) {
      return res.json({
        message: 'A password reset token has been sent to your email.',
        expiresInMinutes: 30,
      });
    }

    return res.json({
      message:
        'Reset token generated. SMTP is not configured, so the token is returned in the response for local development.',
      resetToken: rawToken,
      expiresInMinutes: 30,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create reset token' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!token) {
      return res.status(400).json({ message: 'Reset token is required' });
    }

    if (!PASSWORD_POLICY_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include at least one uppercase letter and one number',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await pool.query(
      `SELECT resetID, userID
       FROM password_resets
       WHERE tokenHash = ?
         AND usedAt IS NULL
         AND expiresAt > NOW()
       ORDER BY createdAt DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Reset token is invalid or expired' });
    }

    const resetId = Number(rows[0].resetID);
    const userId = Number(rows[0].userID);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(`UPDATE users SET passwordHash = ? WHERE userID = ?`, [passwordHash, userId]);
    await pool.query(`UPDATE password_resets SET usedAt = NOW() WHERE resetID = ?`, [resetId]);

    return res.json({ message: 'Password reset successful. You can now sign in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password' });
  }
};

module.exports = {
  register,
  login,
  me,
  requestPasswordReset,
  resetPassword,
};
