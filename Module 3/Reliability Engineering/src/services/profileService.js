const DEFAULT_AVATAR = {
  url: 'https://cdn.aurora-profiles.dev/avatars/default.png',
  initials: '?',
  source: 'fallback',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;

  const status = error.status ?? error.statusCode ?? error.response?.status;
  if (status === undefined || status === null) return true;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;

  return false;
}

async function withTimeout(operation, timeoutMs = 200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(operation, options = {}) {
  const opts = typeof options === 'number' ? { maxAttempts: options } : (options || {});
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      const delay = baseDelayMs * (2 ** attempt);
      await sleep(delay);
    }
  }
}

async function getProfileWithAvatar(authorId, avatarClient, options = {}) {
  const timeoutMs = options.timeoutMs || 200;
  const maxAttempts = options.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || 25;

  try {
    const avatar = await withRetry(
      () => withTimeout(signal => avatarClient.getAvatar(authorId, { signal }), timeoutMs),
      { maxAttempts, baseDelayMs }
    );
    return { authorId, avatar, degraded: false };
  } catch (error) {
    return { authorId, avatar: DEFAULT_AVATAR, degraded: true };
  }
}

module.exports = {
  DEFAULT_AVATAR,
  sleep,
  isRetryable,
  withTimeout,
  withRetry,
  getProfileWithAvatar,
};
