require('dotenv').config();
const { pool } = require('../config/db');

async function ensureSchema() {
  const createAssignments = `
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
    )
  `;

  const createMessages = `
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
    )
  `;

  await pool.query(createAssignments);
  await pool.query(createMessages);

  const [assignmentColumns] = await pool.query('SHOW COLUMNS FROM assignments');
  const assignmentColumnNames = new Set(assignmentColumns.map((column) => column.Field));

  if (!assignmentColumnNames.has('fileData')) {
    await pool.query('ALTER TABLE assignments ADD COLUMN fileData LONGBLOB NULL AFTER fileName');
  }

  if (!assignmentColumnNames.has('fileType')) {
    await pool.query('ALTER TABLE assignments ADD COLUMN fileType VARCHAR(100) NULL AFTER fileData');
  }

  if (!assignmentColumnNames.has('fileSize')) {
    await pool.query('ALTER TABLE assignments ADD COLUMN fileSize INT NULL AFTER fileType');
  }

  if (!assignmentColumnNames.has('deadline')) {
    await pool.query('ALTER TABLE assignments ADD COLUMN deadline DATETIME NULL AFTER uploadedAt');
  }

  await pool.query('ALTER TABLE assignments MODIFY COLUMN title VARCHAR(200) NOT NULL');

  try {
    await pool.query('CREATE INDEX idx_assignments_project_date ON assignments(projectID, uploadedAt)');
  } catch (error) {
    if (!String(error.message || '').includes('Duplicate key name')) {
      throw error;
    }
  }

  try {
    await pool.query('CREATE INDEX idx_messages_project_date ON messages(projectID, sentAt)');
  } catch (error) {
    if (!String(error.message || '').includes('Duplicate key name')) {
      throw error;
    }
  }

  console.log('Collaboration schema is ready.');
}

ensureSchema()
  .catch((error) => {
    console.error('Failed to apply collaboration schema:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_error) {
      // Ignore pool close errors during shutdown.
    }
  });
