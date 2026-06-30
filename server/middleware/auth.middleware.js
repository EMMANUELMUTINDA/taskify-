const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userID: Number(decoded.userID),
      role: decoded.role,
      name: decoded.name,
      email: decoded.email,
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireSupervisor = (req, res, next) => {
  const role = req.user?.role;

  if (role !== 'Supervisor') {
    return res.status(403).json({ message: 'Supervisor role is required' });
  }

  return next();
};

module.exports = {
  authenticateToken,
  requireSupervisor,
};
