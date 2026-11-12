const SESSION_COOKIE_NAME = 'sid';
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

function getSessionTtlMs() {
  const parsed = Number(process.env.SESSION_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_TTL_MS;
}

function isCookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'lax',
    signed: true,
    path: '/',
  };
}

function getSessionCookieOptions() {
  return {
    ...getBaseCookieOptions(),
    maxAge: getSessionTtlMs(),
  };
}

function getClearCookieOptions() {
  return getBaseCookieOptions();
}

module.exports = {
  SESSION_COOKIE_NAME,
  getSessionTtlMs,
  isCookieSecure,
  getSessionCookieOptions,
  getClearCookieOptions,
};
