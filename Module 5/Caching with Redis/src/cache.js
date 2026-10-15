'use strict';

// ─── YOUR FILE — implement this ───────────────────────────────────────────────
// Implement three Redis helper functions using ioredis.
//
// cacheGet(key)
//   - redis.get(key) → string | null
//   - If string: JSON.parse and return the object
//   - If null: return null (cache miss)
//   - Wrap in try/catch: on error, log and return null (graceful degradation)
//
// cacheSet(key, data, ttlSeconds)
//   - redis.set(key, JSON.stringify(data), 'EX', ttlSeconds)
//   - Wrap in try/catch: on error, log (don't fail the request)
//
// cacheDel(key)
//   - redis.del(key)
//   - Wrap in try/catch: on error, log
//
// Redis connection:
//   host: process.env.REDIS_HOST || 'localhost'
//   port: parseInt(process.env.REDIS_PORT || '6379')
//   lazyConnect: true

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  lazyConnect: true,
});

// TODO: implement cacheGet
async function cacheGet(key) {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error(`[cache] error getting key ${key}:`, err);
    return null;
  }
}

// TODO: implement cacheSet
async function cacheSet(key, data, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    console.error(`[cache] error setting key ${key}:`, err);
  }
}

// TODO: implement cacheDel
async function cacheDel(key) {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[cache] error deleting key ${key}:`, err);
  }
}

module.exports = { redis, cacheGet, cacheSet, cacheDel };
