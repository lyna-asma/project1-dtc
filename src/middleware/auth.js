import jwt from 'jsonwebtoken';

export const DEFAULT_JWT_SECRET = 'dev-jwt-secret-key-change-in-production';

export function getJwtSecret() {
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
}

/**
 * Generate a signed JWT token
 */
export function generateToken(payload, options = {}) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '24h',
    ...options,
  });
}

/**
 * Middleware: Verifies JWT token in Authorization header
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
    return res.status(401).json({ error: 'Invalid authorization header format' });
  }

  const token = parts[1].trim();

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

/**
 * Middleware factory: Enforces user role(s)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

/**
 * Middleware / helper: Resource isolation allowing user themselves or admin
 */
export function requireSelfOrAdmin(reqOrParam = 'userId', res, next) {
  if (typeof reqOrParam === 'string' && (!res || typeof res.status !== 'function')) {
    const paramName = reqOrParam;
    return (req, res, next) => checkSelfOrAdmin(req, res, next, paramName);
  }
  return checkSelfOrAdmin(reqOrParam, res, next, 'userId');
}

function checkSelfOrAdmin(req, res, next, paramName = 'userId') {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  if (req.user.role === 'admin') {
    return next();
  }
  const targetUserId = req.params[paramName];
  if (targetUserId === undefined || String(targetUserId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Access denied: You can only access your own resources' });
  }
  return next();
}
