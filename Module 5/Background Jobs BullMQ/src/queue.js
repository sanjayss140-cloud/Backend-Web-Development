'use strict';

// ─── YOUR FILE, implement this ───────────────────────────────────────────────
// Create a BullMQ Queue named 'email' with a Redis connection.
// Export { emailQueue, connection } so the worker and routes can use them.
//
// Redis connection: use process.env.REDIS_HOST (default 'localhost')
//                       process.env.REDIS_PORT (default 6379)

const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

module.exports = { emailQueue, connection };
