/**
 * Middleware factory restricting access to callers whose verified role is allowed.
 */
module.exports = function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    }

    return next();
  };
};
