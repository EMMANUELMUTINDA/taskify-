const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { testDatabaseConnection } = require('./config/db');
const {
  normalizeLegacyRoles,
  ensureDefaultSupervisor,
  ensurePasswordResetTable,
  ensureRoleEmailTriggers,
} = require('./config/bootstrap');
const { authenticateToken } = require('./middleware/auth.middleware');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/projects.routes');
const taskRoutes = require('./routes/tasks.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const usersRoutes = require('./routes/users.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const alertsRoutes = require('./routes/alerts.routes');
const collabRoutes = require('./routes/collab.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/reviews', authenticateToken, reviewsRoutes);
app.use('/api/alerts', authenticateToken, alertsRoutes);
app.use('/api/collab', authenticateToken, collabRoutes);

// Routes will go here
app.get('/', (req, res) => {
  res.json({ message: 'Taskify server is running' });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await testDatabaseConnection();
    await normalizeLegacyRoles();
    await ensureDefaultSupervisor();
    await ensurePasswordResetTable();
    await ensureRoleEmailTriggers();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server because database connection was not established.');
    console.error(error.message);
    process.exit(1);
  }
};

startServer();