const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  // ── Extract ──────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
  const token = match ? match[1] : null;

  if (!token) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
    });
  }

  // ── Verify ───────────────────────────────────────────────
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    req.user = payload;
    next();
  } catch (_error) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
    });
  }
};
