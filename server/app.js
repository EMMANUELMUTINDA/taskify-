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
  ensureUserGroupingSupport,
  ensureUserAcademicProfileSupport,
  ensureClassGroupSupport,
  ensureProjectMembershipSupport,
  ensureUnitRoomSupport,
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
const roomsRoutes = require('./routes/rooms.routes');
const profileRoutes = require('./routes/profile.routes');
const { authRateLimit } = require('./middleware/rateLimit.middleware');

const app = express();

const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';
const isLoopbackDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || '').trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin && !isProduction) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (!isProduction && isLoopbackDevOrigin(origin)) {
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
app.use('/api/rooms', authenticateToken, roomsRoutes);
app.use('/api/profile', authenticateToken, profileRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'Taskify server is running' });
});

let initializationPromise;

const initializeApp = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const jwtSecret = String(process.env.JWT_SECRET || '');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is missing. Configure a strong secret in server/.env before starting the server.');
    }

    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long.');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.JWT_SECRET === 'taskify_secret_key_2025'
    ) {
      throw new Error('JWT_SECRET uses an insecure default value. Set a strong random secret for production.');
    }

    if (isProduction && allowedOrigins.length === 0) {
      throw new Error('CORS_ORIGIN is required in production. Configure at least one allowed origin.');
    }

    await testDatabaseConnection();
    await normalizeLegacyRoles();
    await ensureDefaultSupervisor();
    await ensurePasswordResetTable();
    await ensureRoleEmailTriggers();
    await ensureUserGroupingSupport();
    await ensureUserAcademicProfileSupport();
    await ensureClassGroupSupport();
    await ensureProjectMembershipSupport();
    await ensureUnitRoomSupport();
  })();

  return initializationPromise;
};

module.exports = {
  app,
  initializeApp,
};