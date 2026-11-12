const { SESSION_COOKIE_NAME } = require('../config/cookieConfig');
const sessionStore = require('../session/sessionStore');
const userRepository = require('../repositories/userRepository');

function rejectUnauthorized(res) {
  return res.status(401).json({
    error: {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    },
  });
}

module.exports = async function requireSession(req, res, next) {
  try {
    const sid = req.signedCookies?.[SESSION_COOKIE_NAME];
    const session = sessionStore.get(sid);
    if (!session) {
      return rejectUnauthorized(res);
    }

    const user = await userRepository.findPublicById(session.userId);
    if (!user) {
      sessionStore.destroy(sid);
      return rejectUnauthorized(res);
    }

    req.user = user;
    req.sessionId = sid;
    return next();
  } catch (error) {
    return next(error);
  }
};
