CREATE DATABASE IF NOT EXISTS taskify;
USE taskify;

CREATE TABLE IF NOT EXISTS users (
  userID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  role ENUM('Supervisor','Member','GroupLeader') NOT NULL,
  isActive BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT NOW(),
  lastLogin DATETIME
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
