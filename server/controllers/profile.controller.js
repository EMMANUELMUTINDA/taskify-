const { pool } = require('../config/db');

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const updateProfile = async (req, res) => {
  try {
    const userId = Number(req.user?.userID || 0);
    const role = req.user?.role;

    if (role === 'Supervisor') {
      return res.status(400).json({ message: 'Supervisors do not require profile setup' });
    }

    const course = String(req.body.course || req.body.courseName || '').trim();
    const yearOfStudy = toPositiveInt(req.body.yearOfStudy ?? req.body.studyYear);
    const classGroup = String(req.body.classGroup || '').trim();

    if (!course || !yearOfStudy || !classGroup) {
      return res.status(400).json({ message: 'course, yearOfStudy, and classGroup are required' });
    }

    const groupName = `${course} | Year ${yearOfStudy} | ${classGroup}`;

    await pool.query(
      `UPDATE users
       SET course = ?,
           courseName = ?,
           yearOfStudy = ?,
           studyYear = ?,
           classGroup = ?,
           groupName = ?,
           profileComplete = 1
       WHERE userID = ?`,
      [course, course, yearOfStudy, yearOfStudy, classGroup, groupName, userId]
    );

    const [rows] = await pool.query(
      `SELECT userID, name, email, role, groupName, courseName, course, studyYear, yearOfStudy, classGroup, unitCode, profileComplete
       FROM users
       WHERE userID = ?
       LIMIT 1`,
      [userId]
    );

    return res.json({
      message: 'Profile updated',
      user: rows[0]
        ? {
            ...rows[0],
            role: rows[0].role === 'Admin' ? 'Supervisor' : rows[0].role,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

module.exports = {
  updateProfile,
};
