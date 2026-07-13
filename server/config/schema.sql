CREATE DATABASE IF NOT EXISTS taskify;
USE taskify;

CREATE TABLE IF NOT EXISTS users (
  userID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  role ENUM('Supervisor','Member','GroupLeader') NOT NULL,
  groupName VARCHAR(80),
  courseName VARCHAR(120),
  course VARCHAR(100),
  studyYear INT,
  yearOfStudy INT,
  classGroup VARCHAR(40),
  unitCode VARCHAR(40),
  profileComplete BOOLEAN DEFAULT 0,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT NOW(),
  lastLogin DATETIME
);

CREATE TABLE IF NOT EXISTS class_groups (
  groupID INT AUTO_INCREMENT PRIMARY KEY,
  createdBy INT NOT NULL,
  courseName VARCHAR(120) NOT NULL,
  studyYear INT NOT NULL,
  unitCode VARCHAR(40) NOT NULL,
  classGroup VARCHAR(40) NOT NULL,
  groupName VARCHAR(220) NOT NULL,
  createdAt DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_supervisor_group (createdBy, courseName, studyYear, unitCode, classGroup),
  FOREIGN KEY (createdBy) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS unit_rooms (
  roomID INT AUTO_INCREMENT PRIMARY KEY,
  supervisorID INT NOT NULL,
  unitCode VARCHAR(20) NOT NULL,
  unitName VARCHAR(150) NOT NULL,
  courseName VARCHAR(100) NOT NULL,
  yearOfStudy INT NOT NULL,
  availableGroups VARCHAR(50) NOT NULL,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (supervisorID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_members (
  membershipID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  userID INT NOT NULL,
  classGroup VARCHAR(10) NOT NULL,
  joinedAt DATETIME DEFAULT NOW(),
  UNIQUE KEY unique_membership (roomID, userID),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_messages (
  messageID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  userID INT NOT NULL,
  message TEXT NOT NULL,
  sentAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_group_slots (
  slotID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  slotLabel VARCHAR(80) NOT NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (createdBy) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_slot_members (
  slotMemberID INT AUTO_INCREMENT PRIMARY KEY,
  slotID INT NOT NULL,
  roomID INT NOT NULL,
  userID INT NOT NULL,
  joinedAt DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_room_slot_member (slotID, userID),
  UNIQUE KEY uq_room_member_single_slot (roomID, userID),
  FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_work_items (
  workID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  uploadedBy INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  fileName VARCHAR(255) NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  uploadedAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (uploadedBy) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_slot_messages (
  messageID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  slotID INT NOT NULL,
  userID INT NOT NULL,
  message TEXT NOT NULL,
  sentAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_slot_paragraphs (
  paragraphID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  slotID INT NOT NULL,
  userID INT NOT NULL,
  content TEXT NOT NULL,
  wordCount INT NOT NULL DEFAULT 0,
  contributionScore DECIMAL(6,2) NOT NULL DEFAULT 0,
  submittedAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_slot_final_files (
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
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID),
  FOREIGN KEY (uploadedBy) REFERENCES users(userID),
  FOREIGN KEY (markedBy) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS room_slot_peer_reviews (
  slotReviewID INT AUTO_INCREMENT PRIMARY KEY,
  roomID INT NOT NULL,
  slotID INT NOT NULL,
  reviewerID INT NOT NULL,
  reviewedUserID INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  submittedAt DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_room_slot_review (roomID, slotID, reviewerID, reviewedUserID),
  FOREIGN KEY (roomID) REFERENCES unit_rooms(roomID),
  FOREIGN KEY (slotID) REFERENCES room_group_slots(slotID),
  FOREIGN KEY (reviewerID) REFERENCES users(userID),
  FOREIGN KEY (reviewedUserID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS password_resets (
  resetID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  tokenHash VARCHAR(255) NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME,
  attemptCount INT NOT NULL DEFAULT 0,
  maxAttempts INT NOT NULL DEFAULT 5,
  lockedUntil DATETIME,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS user_notifications (
  notificationID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  isRead BOOLEAN DEFAULT 0,
  createdAt DATETIME DEFAULT NOW(),
  readAt DATETIME,
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS projects (
  projectID INT AUTO_INCREMENT PRIMARY KEY,
  createdBy INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  status ENUM('Active','Completed','Archived') DEFAULT 'Active',
  deadline DATE,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (createdBy) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS tasks (
  taskID INT AUTO_INCREMENT PRIMARY KEY,
  projectID INT NOT NULL,
  assignedTo INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  status ENUM('Todo','InProgress','Done','Backlog') DEFAULT 'Todo',
  progressPct TINYINT DEFAULT 0,
  deadline DATE,
  createdAt DATETIME DEFAULT NOW(),
  updatedAt DATETIME ON UPDATE NOW(),
  FOREIGN KEY (projectID) REFERENCES projects(projectID),
  FOREIGN KEY (assignedTo) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS project_members (
  projectMemberID INT AUTO_INCREMENT PRIMARY KEY,
  projectID INT NOT NULL,
  userID INT NOT NULL,
  roleInProject ENUM('Leader','Member') DEFAULT 'Member',
  joinedAt DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_project_user (projectID, userID),
  FOREIGN KEY (projectID) REFERENCES projects(projectID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS task_updates (
  updateID INT AUTO_INCREMENT PRIMARY KEY,
  taskID INT NOT NULL,
  userID INT NOT NULL,
  updateType ENUM('Comment','Progress','StatusChange','Blocker','Attachment') NOT NULL,
  note TEXT,
  progressDelta TINYINT DEFAULT 0,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (taskID) REFERENCES tasks(taskID),
  FOREIGN KEY (userID) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS activity_events (
  eventID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  projectID INT NOT NULL,
  eventType ENUM('TaskCreated','TaskUpdated','TaskCompleted','ReviewSubmitted','CommentAdded') NOT NULL,
  sourceID INT,
  scoreImpact DECIMAL(5,2) DEFAULT 0,
  createdAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (userID) REFERENCES users(userID),
  FOREIGN KEY (projectID) REFERENCES projects(projectID)
);

CREATE TABLE IF NOT EXISTS contribution_logs (
  logID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  taskID INT NOT NULL,
  actionType VARCHAR(50) NOT NULL,
  contributionScore DECIMAL(5,2) DEFAULT 0,
  isLoafingFlag BOOLEAN DEFAULT 0,
  notes TEXT,
  timestamp DATETIME DEFAULT NOW(),
  FOREIGN KEY (userID) REFERENCES users(userID),
  FOREIGN KEY (taskID) REFERENCES tasks(taskID)
);

CREATE TABLE IF NOT EXISTS peer_reviews (
  reviewID INT AUTO_INCREMENT PRIMARY KEY,
  reviewerID INT NOT NULL,
  reviewedUserID INT NOT NULL,
  projectID INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  isAnonymous BOOLEAN DEFAULT 1,
  submittedAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (reviewerID) REFERENCES users(userID),
  FOREIGN KEY (reviewedUserID) REFERENCES users(userID),
  FOREIGN KEY (projectID) REFERENCES projects(projectID)
);

CREATE TABLE IF NOT EXISTS loafing_alerts (
  alertID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  projectID INT NOT NULL,
  scoreAtTrigger DECIMAL(5,2) NOT NULL,
  threshold DECIMAL(5,2) DEFAULT 30.00,
  triggeredAt DATETIME DEFAULT NOW(),
  resolved BOOLEAN DEFAULT 0,
  resolvedAt DATETIME,
  FOREIGN KEY (userID) REFERENCES users(userID),
  FOREIGN KEY (projectID) REFERENCES projects(projectID)
);

CREATE TABLE IF NOT EXISTS assignments (
  assignmentID INT AUTO_INCREMENT PRIMARY KEY,
  projectID INT NOT NULL,
  uploadedBy INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  fileName VARCHAR(255) NOT NULL,
  fileData LONGBLOB NOT NULL,
  fileType VARCHAR(100) NOT NULL,
  fileSize INT NOT NULL,
  uploadedAt DATETIME DEFAULT NOW(),
  deadline DATETIME,
  FOREIGN KEY (projectID) REFERENCES projects(projectID),
  FOREIGN KEY (uploadedBy) REFERENCES users(userID)
);

CREATE TABLE IF NOT EXISTS messages (
  messageID INT AUTO_INCREMENT PRIMARY KEY,
  projectID INT NOT NULL,
  assignmentID INT,
  senderID INT NOT NULL,
  message TEXT NOT NULL,
  sentAt DATETIME DEFAULT NOW(),
  FOREIGN KEY (projectID) REFERENCES projects(projectID),
  FOREIGN KEY (assignmentID) REFERENCES assignments(assignmentID),
  FOREIGN KEY (senderID) REFERENCES users(userID)
);

CREATE INDEX idx_tasks_project_status ON tasks(projectID, status);
CREATE INDEX idx_updates_task_created ON task_updates(taskID, createdAt);
CREATE INDEX idx_events_project_user_date ON activity_events(projectID, userID, createdAt);
CREATE INDEX idx_peer_reviews_project_user ON peer_reviews(projectID, reviewedUserID);
CREATE INDEX idx_assignments_project_date ON assignments(projectID, uploadedAt);
CREATE INDEX idx_messages_project_date ON messages(projectID, sentAt);

DROP TRIGGER IF EXISTS users_role_email_guard_before_insert;
DROP TRIGGER IF EXISTS users_role_email_guard_before_update;

DELIMITER $$
CREATE TRIGGER users_role_email_guard_before_insert
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
END$$

CREATE TRIGGER users_role_email_guard_before_update
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
END$$
DELIMITER ;
