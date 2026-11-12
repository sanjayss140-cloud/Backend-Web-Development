const crypto = require('crypto');
const { getSessionTtlMs } = require('../config/cookieConfig');

/**
 * In-memory Map-backed session store.
 *
 * Suitable for learning and local single-process execution only: server restarts
 * clear active sessions and multiple processes cannot share state. Production
 * deployments must use a shared expiring store such as Redis.
 */
const sessions = new Map();

function create(userId, ttlMs = getSessionTtlMs()) {
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMs;
  const record = { userId, expiresAt };
  sessions.set(id, record);
  return { id, ...record };
}

function get(sid) {
  if (typeof sid !== 'string' || !sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;

  if (Date.now() >= session.expiresAt) {
    sessions.delete(sid);
    return null;
  }

  return session;
}

function destroy(sid) {
  if (typeof sid !== 'string' || !sid) return false;
  return sessions.delete(sid);
}

function clear() {
  sessions.clear();
}

module.exports = {
  create,
  get,
  destroy,
  clear,
};
