const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
const { authRateLimit } = require('./middleware/rateLimit.middleware');

const app = express();

const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS policy'));
    },
  })
);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRateLimit, authRoutes);
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
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing. Configure a strong secret in server/.env before starting the server.');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.JWT_SECRET === 'taskify_secret_key_2025'
    ) {
      throw new Error('JWT_SECRET uses an insecure default value. Set a strong random secret for production.');
    }

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