const rateLimit = require('express-rate-limit');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts. Please try again later.',
  },
});

const resetVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RESET_VERIFY_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many password reset attempts. Please try again later.',
  },
});

const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CHAT_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many messages sent. Please slow down.',
  },
});

const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many uploads in a short time. Please try again later.',
  },
});

const reviewRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.REVIEW_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many review submissions. Please try again later.',
  },
});

module.exports = {
  authRateLimit,
  resetVerifyRateLimit,
  chatRateLimit,
  uploadRateLimit,
  reviewRateLimit,
};
