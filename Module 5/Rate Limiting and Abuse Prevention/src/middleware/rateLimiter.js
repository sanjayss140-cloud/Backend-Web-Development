'use strict';
// middleware/rateLimiter.js
//
// Strict rate limiter for authentication routes (/auth/login, /auth/register, /auth/refresh).
//
// Why the default in-memory store is not enough in a multi-instance deployment:
// By default, express-rate-limit uses MemoryStore, which stores request counters inside each
// Node.js process's local memory. When multiple instances of the API run behind a load balancer,
// every instance maintains a separate, isolated counter (and resets if that process restarts).
// An attacker whose requests are routed across N instances gets N times the intended limit
// (e.g., max: 5 across 3 instances allows up to 15 attempts before a single instance blocks them).
//
// Scaling across multiple instances with a Redis-backed store (rate-limit-redis):
// Replace MemoryStore by passing a shared `store` backed by Redis via `rate-limit-redis`.
// All app instances point to the same Redis server (e.g., via process.env.REDIS_URL), so
// increments and TTL windows live in one shared, atomic counter across the entire cluster:
//
//   const { RedisStore } = require('rate-limit-redis');
//   const { createClient } = require('redis');
//   const redisClient = createClient({ url: process.env.REDIS_URL });
//   redisClient.connect();
//
//   // Then add to the rateLimit({ ... }) options below:
//   // store: new RedisStore({
//   //   sendCommand: (...args) => redisClient.sendCommand(args),
//   // }),

const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Auth route rate limiter: allows up to 5 failed attempts per 15-minute window per IP,
 * responds with HTTP 429 and a Retry-After header once exceeded, and ignores successful
 * requests so legitimate users are never penalized.
 */
const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true, // Send RateLimit-* headers (draft-6) and Retry-After
  legacyHeaders: false, // Disable deprecated X-RateLimit-* headers
  skipSuccessfulRequests: true, // Only count failed attempts (status >= 400)
  handler: (req, res) => {
    if (!res.getHeader('Retry-After')) {
      const retryAfterSeconds = req.rateLimit?.resetTime
        ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(WINDOW_MS / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }

    return res.status(429).json({
      error: 'Too many requests, please try again later.',
    });
  },
});

module.exports = authLimiter;
