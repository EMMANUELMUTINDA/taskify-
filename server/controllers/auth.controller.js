const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

const normalizeRole = (role) => (role === 'Admin' ? 'Supervisor' : role);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d).{6,}$/;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const createResetHash = (userId, code) =>
  crypto.createHash('sha256').update(`${userId}:${String(code)}`).digest('hex');

const createInAppNotification = async ({ userId, type, title, body }) => {
  await pool.query(
    `INSERT INTO user_notifications (userID, type, title, body)
     VALUES (?, ?, ?, ?)`,
    [userId, type, title, body]
  );
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

const smtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
};

const sendPasswordResetEmail = async ({ email, name, code }) => {
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
    subject: 'Taskify password reset code',
    text:
      `Hello ${name},\n\n` +
      `Use this 4-digit reset code to change your password: ${code}\n\n` +
      `Open ${resetUrl}, choose "Forgot password", and submit the code within 10 minutes.\n\n` +
      'If you did not request this, please ignore this email.',
    html:
      `<p>Hello ${name},</p>` +
      `<p>Use this 4-digit reset code to change your password:</p>` +
      `<p><strong>${code}</strong></p>` +
      `<p>Open <a href="${resetUrl}">${resetUrl}</a>, choose <strong>Forgot password</strong>, and submit the code within 10 minutes.</p>` +
      '<p>If you did not request this, please ignore this email.</p>',
  });

  return true;
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const requestedGroupName = String(req.body.groupName || '').trim();
    const requestedCourseName = String(req.body.courseName || '').trim();
    const requestedClassGroup = String(req.body.classGroup || '').trim();
    const requestedUnitCode = String(req.body.unitCode || '').trim().toUpperCase();
    const requestedStudyYear = Number(req.body.studyYear);
    const studyYear = Number.isInteger(requestedStudyYear) && requestedStudyYear > 0
      ? requestedStudyYear
      : null;
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

    const groupName = requestedRole === 'Supervisor' ? null : requestedGroupName || null;
    const courseName = requestedRole === 'Supervisor' ? null : requestedCourseName || null;
    const classGroup = requestedRole === 'Supervisor' ? null : requestedClassGroup || null;
    const unitCode = requestedRole === 'Supervisor' ? null : requestedUnitCode || null;

    if (!requestedRole) {
      return res.status(400).json({
        message:
          'Email must be a Strathmore address with valid format: student first.second@strathmore.edu or supervisor nodot@strathmore.edu',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, passwordHash, role, groupName, courseName, studyYear, classGroup, unitCode, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name,
        normalizedEmail,
        passwordHash,
        requestedRole,
        groupName || null,
        courseName,
        studyYear,
        classGroup,
        unitCode,
      ]
    );

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        userID: Number(result.insertId),
        name,
        email: normalizedEmail,
        role: requestedRole,
        groupName,
        courseName,
        studyYear,
        classGroup,
        unitCode,
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
      `SELECT userID, name, email, passwordHash, role, groupName, courseName, course, studyYear, yearOfStudy,
              classGroup, unitCode, profileComplete, isActive
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
        groupName: user.groupName || null,
        courseName: user.courseName || null,
        course: user.course || user.courseName || null,
        studyYear: user.studyYear || null,
        yearOfStudy: user.yearOfStudy || user.studyYear || null,
        classGroup: user.classGroup || null,
        unitCode: user.unitCode || null,
        profileComplete: Boolean(user.profileComplete),
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
      `SELECT userID, name, email, role, groupName, courseName, course, studyYear, yearOfStudy,
              classGroup, unitCode, profileComplete, isActive
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
        groupName: user.groupName || null,
        courseName: user.courseName || null,
        course: user.course || user.courseName || null,
        studyYear: user.studyYear || null,
        yearOfStudy: user.yearOfStudy || user.studyYear || null,
        classGroup: user.classGroup || null,
        unitCode: user.unitCode || null,
        profileComplete: Boolean(user.profileComplete),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load user profile' });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
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
        message: 'If this email is registered, a reset code has been generated.',
      });
    }

    const userId = Number(rows[0].userID);
    const userName = rows[0].name;
    const userEmail = rows[0].email;
    const rawCode = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    const maxAttempts = Math.max(1, Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 5));
    const tokenHash = createResetHash(userId, rawCode);

    await pool.query(
      `UPDATE password_resets SET usedAt = NOW() WHERE userID = ? AND usedAt IS NULL`,
      [userId]
    );

    await pool.query(
      `INSERT INTO password_resets (userID, tokenHash, expiresAt)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [userId, tokenHash]
    );

    await pool.query(
      `UPDATE password_resets
       SET maxAttempts = ?
       WHERE userID = ? AND usedAt IS NULL
       ORDER BY createdAt DESC
       LIMIT 1`,
      [maxAttempts, userId]
    );

    await createInAppNotification({
      userId,
      type: 'password-reset',
      title: 'Password reset code',
      body: `Your Taskify reset code is ${rawCode}. It expires in 10 minutes.`,
    });

    const sentByEmail = await sendPasswordResetEmail({
      email: userEmail,
      name: userName,
      code: rawCode,
    });

    if (sentByEmail) {
      return res.json({
        message: 'A 4-digit password reset code has been sent to your in-app notifications and email.',
        expiresInMinutes: 10,
      });
    }

    if (!isProduction) {
      return res.json({
        message: 'Email is not configured. Your 4-digit reset code is shown below for local testing.',
        expiresInMinutes: 10,
        resetCode: rawCode,
      });
    }

    return res.json({
      message: 'A 4-digit password reset code has been sent to your in-app notifications.',
      expiresInMinutes: 10,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create reset code' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (!/^\d{4}$/.test(code)) {
      return res.status(400).json({ message: 'A valid 4-digit reset code is required' });
    }

    if (!PASSWORD_POLICY_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include at least one uppercase letter and one number',
      });
    }

    const [userRows] = await pool.query(
      `SELECT userID, isActive FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (userRows.length === 0 || !userRows[0].isActive) {
      return res.status(400).json({ message: 'Reset code is invalid or expired' });
    }

    const userId = Number(userRows[0].userID);
    const tokenHash = createResetHash(userId, code);

    const [rows] = await pool.query(
      `SELECT resetID, userID, tokenHash, attemptCount, maxAttempts, lockedUntil
       FROM password_resets
       WHERE userID = ?
         AND usedAt IS NULL
         AND expiresAt > NOW()
       ORDER BY createdAt DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Reset code is invalid or expired' });
    }

    const resetId = Number(rows[0].resetID);
    const resetRecord = rows[0];
    const lockMinutes = Math.max(1, Number(process.env.PASSWORD_RESET_LOCK_MINUTES || 15));

    if (resetRecord.lockedUntil && new Date(resetRecord.lockedUntil).getTime() > Date.now()) {
      return res.status(429).json({ message: 'Reset is temporarily locked due to too many failed attempts' });
    }

    if (String(resetRecord.tokenHash || '') !== String(tokenHash)) {
      const nextAttempts = Number(resetRecord.attemptCount || 0) + 1;
      const reachedLimit = nextAttempts >= Number(resetRecord.maxAttempts || 5);
      await pool.query(
        `UPDATE password_resets
         SET attemptCount = ?,
             lockedUntil = CASE
               WHEN ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
               ELSE lockedUntil
             END
         WHERE resetID = ?`,
        [nextAttempts, reachedLimit, lockMinutes, resetId]
      );

      return res.status(400).json({ message: 'Reset code is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(`UPDATE users SET passwordHash = ? WHERE userID = ?`, [passwordHash, userId]);
    await pool.query(`UPDATE password_resets SET usedAt = NOW() WHERE resetID = ?`, [resetId]);

    await createInAppNotification({
      userId,
      type: 'security',
      title: 'Password updated',
      body: 'Your password was reset successfully.',
    });

    return res.json({ message: 'Password reset successful. You can now sign in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset password' });
  }
};

const getMyNotifications = async (req, res) => {
  try {
    const userId = Number(req.user.userID);
    const [rows] = await pool.query(
      `SELECT notificationID, type, title, body, isRead, createdAt, readAt
       FROM user_notifications
       WHERE userID = ?
       ORDER BY createdAt DESC
       LIMIT 100`,
      [userId]
    );

    return res.json(rows);
  } catch (_error) {
    return res.status(500).json({ message: 'Failed to load notifications' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = Number(req.user.userID);
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const [result] = await pool.query(
      `UPDATE user_notifications
       SET isRead = 1, readAt = NOW()
       WHERE notificationID = ? AND userID = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.json({ message: 'Notification marked as read' });
  } catch (_error) {
    return res.status(500).json({ message: 'Failed to update notification' });
  }
};

module.exports = {
  register,
  login,
  me,
  requestPasswordReset,
  resetPassword,
  getMyNotifications,
  markNotificationRead,
};
