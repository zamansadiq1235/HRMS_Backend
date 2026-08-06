const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = {
      userId: payload.sub,
      companyId: payload.company_id || null,
      role: payload.role,
      permissions: payload.permissions || [],
      isPlatformOwner: payload.role === 'platform_owner',
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const perms = req.auth.permissions || [];
    if (perms.includes('*') || perms.includes(permissionKey)) {
      return next();
    }
    return res.status(403).json({
      error: `Missing required permission: ${permissionKey}`,
    });
  };
}

module.exports = { requireAuth, requireRole, requirePermission };
