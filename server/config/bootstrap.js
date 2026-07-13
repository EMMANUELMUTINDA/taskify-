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
  const configuredEmail = String(process.env.DEFAULT_SUPERVISOR_EMAIL || '').trim().toLowerCase();
  const email = configuredEmail.endsWith('@strathmore.edu') && !configuredEmail.split('@')[0].includes('.')
    ? configuredEmail
    : 'supervisor@strathmore.edu';
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
      attemptCount INT NOT NULL DEFAULT 0,
      maxAttempts INT NOT NULL DEFAULT 5,
      lockedUntil DATETIME,
      createdAt DATETIME DEFAULT NOW(),
      FOREIGN KEY (userID) REFERENCES users(userID),
      INDEX idx_password_resets_user (userID),
      INDEX idx_password_resets_expiry (expiresAt)
    )`
  );

  const [attemptCountCol] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'password_resets'
       AND COLUMN_NAME = 'attemptCount'
     LIMIT 1`
  );
  if (attemptCountCol.length === 0) {
    await pool.query(`ALTER TABLE password_resets ADD COLUMN attemptCount INT NOT NULL DEFAULT 0 AFTER usedAt`);
  }

  const [maxAttemptsCol] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'password_resets'
       AND COLUMN_NAME = 'maxAttempts'
     LIMIT 1`
  );
  if (maxAttemptsCol.length === 0) {
    await pool.query(`ALTER TABLE password_resets ADD COLUMN maxAttempts INT NOT NULL DEFAULT 5 AFTER attemptCount`);
  }

  const [lockedUntilCol] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'password_resets'
       AND COLUMN_NAME = 'lockedUntil'
     LIMIT 1`
  );
  if (lockedUntilCol.length === 0) {
    await pool.query(`ALTER TABLE password_resets ADD COLUMN lockedUntil DATETIME NULL AFTER maxAttempts`);
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_notifications (
      notificationID INT AUTO_INCREMENT PRIMARY KEY,
      userID INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      isRead BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT NOW(),
      readAt DATETIME,
      INDEX idx_user_notifications_user_created (userID, createdAt),
      CONSTRAINT fk_user_notifications_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
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
       IF LOWER(NEW.email) <> LOWER(OLD.email) OR NEW.role <> OLD.role THEN
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
       END IF;
     END`
  );
};

const ensureUserGroupingSupport = async () => {
  const [groupColumn] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'groupName'
     LIMIT 1`
  );

  if (groupColumn.length === 0) {
    await pool.query(`ALTER TABLE users ADD COLUMN groupName VARCHAR(80) NULL AFTER role`);
  }
};

const ensureUserAcademicProfileSupport = async () => {
  const ensureColumn = async (columnName, columnDefinition) => {
    const [rows] = await pool.query(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [columnName]
    );

    if (rows.length === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${columnDefinition}`);
    }
  };

  await ensureColumn('courseName', 'courseName VARCHAR(120) NULL AFTER groupName');
  await ensureColumn('studyYear', 'studyYear INT NULL AFTER courseName');
  await ensureColumn('classGroup', 'classGroup VARCHAR(40) NULL AFTER studyYear');
  await ensureColumn('unitCode', 'unitCode VARCHAR(40) NULL AFTER classGroup');
  await ensureColumn('course', 'course VARCHAR(100) NULL AFTER courseName');
  await ensureColumn('yearOfStudy', 'yearOfStudy INT NULL AFTER studyYear');
  await ensureColumn('profileComplete', 'profileComplete BOOLEAN DEFAULT 0 AFTER unitCode');

  await pool.query(
    `UPDATE users
     SET course = COALESCE(course, courseName),
         yearOfStudy = COALESCE(yearOfStudy, studyYear)`
  );

  await pool.query(
    `UPDATE users
     SET profileComplete = 1
     WHERE profileComplete = 0
       AND COALESCE(NULLIF(TRIM(course), ''), NULLIF(TRIM(courseName), '')) IS NOT NULL
       AND COALESCE(yearOfStudy, studyYear) IS NOT NULL
       AND NULLIF(TRIM(classGroup), '') IS NOT NULL`
  );
};

const ensureUnitRoomSupport = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS unit_rooms (
      roomID INT AUTO_INCREMENT PRIMARY KEY,
      supervisorID INT NOT NULL,
      unitCode VARCHAR(20) NOT NULL,
      unitName VARCHAR(150) NOT NULL,
      courseName VARCHAR(100) NOT NULL,
      yearOfStudy INT NOT NULL,
      availableGroups VARCHAR(50) NOT NULL,
      createdAt DATETIME DEFAULT NOW(),
      INDEX idx_unit_rooms_supervisor (supervisorID),
      INDEX idx_unit_rooms_course_year_unit (courseName, yearOfStudy, unitCode),
      CONSTRAINT fk_unit_rooms_supervisor
        FOREIGN KEY (supervisorID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_members (
      membershipID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      userID INT NOT NULL,
      classGroup VARCHAR(10) NOT NULL,
      joinedAt DATETIME DEFAULT NOW(),
      UNIQUE KEY unique_membership (roomID, userID),
      INDEX idx_room_members_user (userID),
      CONSTRAINT fk_room_members_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_members_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_messages (
      messageID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      userID INT NOT NULL,
      message TEXT NOT NULL,
      sentAt DATETIME DEFAULT NOW(),
      INDEX idx_room_messages_room_sent (roomID, sentAt),
      CONSTRAINT fk_room_messages_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_messages_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_group_slots (
      slotID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      slotLabel VARCHAR(80) NOT NULL,
      createdBy INT NOT NULL,
      createdAt DATETIME DEFAULT NOW(),
      INDEX idx_room_group_slots_room (roomID),
      CONSTRAINT fk_room_group_slots_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_group_slots_user
        FOREIGN KEY (createdBy) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_slot_members (
      slotMemberID INT AUTO_INCREMENT PRIMARY KEY,
      slotID INT NOT NULL,
      roomID INT NOT NULL,
      userID INT NOT NULL,
      joinedAt DATETIME DEFAULT NOW(),
      UNIQUE KEY uq_room_slot_member (slotID, userID),
      UNIQUE KEY uq_room_member_single_slot (roomID, userID),
      INDEX idx_room_slot_members_room (roomID),
      CONSTRAINT fk_room_slot_members_slot
        FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_members_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_members_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_work_items (
      workID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      uploadedBy INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      fileName VARCHAR(255) NOT NULL,
      filePath VARCHAR(500) NOT NULL,
      uploadedAt DATETIME DEFAULT NOW(),
      INDEX idx_room_work_items_room (roomID, uploadedAt),
      CONSTRAINT fk_room_work_items_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_work_items_user
        FOREIGN KEY (uploadedBy) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_slot_messages (
      messageID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      slotID INT NOT NULL,
      userID INT NOT NULL,
      message TEXT NOT NULL,
      sentAt DATETIME DEFAULT NOW(),
      INDEX idx_room_slot_messages_slot_sent (slotID, sentAt),
      CONSTRAINT fk_room_slot_messages_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_messages_slot
        FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_messages_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_slot_paragraphs (
      paragraphID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      slotID INT NOT NULL,
      userID INT NOT NULL,
      content TEXT NOT NULL,
      wordCount INT NOT NULL DEFAULT 0,
      contributionScore DECIMAL(6,2) NOT NULL DEFAULT 0,
      submittedAt DATETIME DEFAULT NOW(),
      INDEX idx_room_slot_paragraphs_slot_submitted (slotID, submittedAt),
      CONSTRAINT fk_room_slot_paragraphs_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_paragraphs_slot
        FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_paragraphs_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_slot_final_files (
      finalFileID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      slotID INT NOT NULL,
      uploadedBy INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      notes TEXT,
      fileName VARCHAR(255) NOT NULL,
      filePath VARCHAR(500) NOT NULL,
      markStatus ENUM('Submitted', 'Marked') DEFAULT 'Submitted',
      markerComment TEXT,
      markedBy INT,
      markedAt DATETIME,
      uploadedAt DATETIME DEFAULT NOW(),
      INDEX idx_room_slot_final_files_slot_uploaded (slotID, uploadedAt),
      CONSTRAINT fk_room_slot_final_files_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_final_files_slot
        FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_final_files_user
        FOREIGN KEY (uploadedBy) REFERENCES users(userID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_final_files_marker
        FOREIGN KEY (markedBy) REFERENCES users(userID)
        ON DELETE SET NULL
    )`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS room_slot_peer_reviews (
      slotReviewID INT AUTO_INCREMENT PRIMARY KEY,
      roomID INT NOT NULL,
      slotID INT NOT NULL,
      reviewerID INT NOT NULL,
      reviewedUserID INT NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT,
      submittedAt DATETIME DEFAULT NOW(),
      UNIQUE KEY uq_room_slot_review (roomID, slotID, reviewerID, reviewedUserID),
      INDEX idx_room_slot_peer_reviews_slot (slotID, submittedAt),
      CONSTRAINT fk_room_slot_peer_reviews_room
        FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_peer_reviews_slot
        FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_peer_reviews_reviewer
        FOREIGN KEY (reviewerID) REFERENCES users(userID)
        ON DELETE CASCADE,
      CONSTRAINT fk_room_slot_peer_reviews_reviewed
        FOREIGN KEY (reviewedUserID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );
};

const ensureClassGroupSupport = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS class_groups (
      groupID INT AUTO_INCREMENT PRIMARY KEY,
      createdBy INT NOT NULL,
      courseName VARCHAR(120) NOT NULL,
      studyYear INT NOT NULL,
      unitCode VARCHAR(40) NOT NULL,
      classGroup VARCHAR(40) NOT NULL,
      groupName VARCHAR(220) NOT NULL,
      createdAt DATETIME DEFAULT NOW(),
      UNIQUE KEY uq_supervisor_group (createdBy, courseName, studyYear, unitCode, classGroup),
      INDEX idx_class_groups_group_name (groupName),
      CONSTRAINT fk_class_groups_supervisor
        FOREIGN KEY (createdBy) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );
};

const ensureProjectMembershipSupport = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS project_members (
      projectMemberID INT AUTO_INCREMENT PRIMARY KEY,
      projectID INT NOT NULL,
      userID INT NOT NULL,
      roleInProject ENUM('Leader','Member') DEFAULT 'Member',
      joinedAt DATETIME DEFAULT NOW(),
      UNIQUE KEY uq_project_user (projectID, userID),
      INDEX idx_project_members_user (userID),
      CONSTRAINT fk_project_members_project
        FOREIGN KEY (projectID) REFERENCES projects(projectID)
        ON DELETE CASCADE,
      CONSTRAINT fk_project_members_user
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE CASCADE
    )`
  );

  await pool.query(
    `INSERT INTO project_members (projectID, userID, roleInProject)
     SELECT p.projectID, p.createdBy, 'Leader'
     FROM projects p
     ON DUPLICATE KEY UPDATE roleInProject = roleInProject`
  );
};

module.exports = {
  normalizeLegacyRoles,
  ensureDefaultSupervisor,
  ensurePasswordResetTable,
  ensureRoleEmailTriggers,
  ensureUserGroupingSupport,
  ensureUserAcademicProfileSupport,
  ensureClassGroupSupport,
  ensureProjectMembershipSupport,
  ensureUnitRoomSupport,
};
