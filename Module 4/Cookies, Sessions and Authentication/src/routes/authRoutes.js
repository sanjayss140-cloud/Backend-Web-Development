const express = require('express');
const bcrypt = require('bcryptjs');
const {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getClearCookieOptions,
} = require('../config/cookieConfig');
const sessionStore = require('../session/sessionStore');
const userRepository = require('../repositories/userRepository');
const requireSession = require('../middleware/requireSession');

const router = express.Router();

// Valid hash evaluated when an email does not exist so login always runs async bcrypt.compare.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-timing-guard-value', 10);

function rejectInvalidCredentials(res) {
  return res.status(401).json({
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    },
  });
}

router.post('/login', async (req, res, next) => {
  try {
    const body = req.body;
    if (
      !body ||
      typeof body !== 'object' ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string'
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    const user = await userRepository.findByEmail(email);
    const hashToCompare = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatches) {
      return rejectInvalidCredentials(res);
    }

    // Rotate any prior session cookie presented during login to prevent fixation.
    const existingSid = req.signedCookies?.[SESSION_COOKIE_NAME];
    if (typeof existingSid === 'string' && existingSid) {
      sessionStore.destroy(existingSid);
    }

    const session = sessionStore.create(user.id);
    res.cookie(SESSION_COOKIE_NAME, session.id, getSessionCookieOptions());

    return res.status(200).json({
      data: userRepository.toPublicUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireSession, (req, res) => {
  return res.status(200).json({ data: req.user });
});

router.post('/logout', (req, res) => {
  const sid = req.signedCookies?.[SESSION_COOKIE_NAME];
  if (typeof sid === 'string' && sid) {
    sessionStore.destroy(sid);
  }

  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  return res.status(204).send();
});

module.exports = router;
