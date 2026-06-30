const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const normalizeLegacyRoles = async () => {
  await pool.query(`UPDATE users SET role = 'Supervisor' WHERE role = 'Admin'`);
};

const ensureDefaultSupervisor = async () => {
  const [rows] = await pool.query(
    `SELECT userID FROM users WHERE role = 'Supervisor' LIMIT 1`
  );

  if (rows.length > 0) {
    return;
  }

  const name = process.env.DEFAULT_SUPERVISOR_NAME || 'System Supervisor';
  const email = process.env.DEFAULT_SUPERVISOR_EMAIL || 'supervisor@taskify.local';
  const password = process.env.DEFAULT_SUPERVISOR_PASSWORD || 'Supervisor123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (name, email, passwordHash, role, isActive)
     VALUES (?, ?, ?, 'Supervisor', 1)`,
    [name, email, passwordHash]
  );

  // Intentional startup hint so operators can rotate immediately after first login.
  console.log(`Default supervisor account created: ${email}`);
};

const ensurePasswordResetTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS password_resets (
      resetID INT AUTO_INCREMENT PRIMARY KEY,
      userID INT NOT NULL,
      tokenHash VARCHAR(255) NOT NULL,
      expiresAt DATETIME NOT NULL,
      usedAt DATETIME,
      createdAt DATETIME DEFAULT NOW(),
      FOREIGN KEY (userID) REFERENCES users(userID),
      INDEX idx_password_resets_user (userID),
      INDEX idx_password_resets_expiry (expiresAt)
    )`
  );
};

const ensureRoleEmailTriggers = async () => {
  await pool.query(`DROP TRIGGER IF EXISTS users_role_email_guard_before_insert`);
  await pool.query(`DROP TRIGGER IF EXISTS users_role_email_guard_before_update`);

  await pool.query(
    `CREATE TRIGGER users_role_email_guard_before_insert
     BEFORE INSERT ON users
     FOR EACH ROW
     BEGIN
       IF LOWER(NEW.email) NOT LIKE '%@strathmore.edu' THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Email must use @strathmore.edu domain';
       END IF;

       IF NEW.role = 'Supervisor' AND LOCATE('.', SUBSTRING_INDEX(LOWER(NEW.email), '@', 1)) > 0 THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Supervisor email must not contain a dot before @strathmore.edu';
       END IF;

       IF NEW.role IN ('Member', 'GroupLeader') AND LOCATE('.', SUBSTRING_INDEX(LOWER(NEW.email), '@', 1)) = 0 THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Member and GroupLeader emails must contain a dot before @strathmore.edu';
       END IF;
     END`
  );

  await pool.query(
    `CREATE TRIGGER users_role_email_guard_before_update
     BEFORE UPDATE ON users
     FOR EACH ROW
     BEGIN
       IF LOWER(NEW.email) NOT LIKE '%@strathmore.edu' THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Email must use @strathmore.edu domain';
       END IF;

       IF NEW.role = 'Supervisor' AND LOCATE('.', SUBSTRING_INDEX(LOWER(NEW.email), '@', 1)) > 0 THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Supervisor email must not contain a dot before @strathmore.edu';
       END IF;

       IF NEW.role IN ('Member', 'GroupLeader') AND LOCATE('.', SUBSTRING_INDEX(LOWER(NEW.email), '@', 1)) = 0 THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = 'Member and GroupLeader emails must contain a dot before @strathmore.edu';
       END IF;
     END`
  );
};

module.exports = {
  normalizeLegacyRoles,
  ensureDefaultSupervisor,
  ensurePasswordResetTable,
  ensureRoleEmailTriggers,
};
