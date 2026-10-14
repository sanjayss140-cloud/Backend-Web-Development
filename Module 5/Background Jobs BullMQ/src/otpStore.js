'use strict';

// ─── YOUR FILE, implement this ───────────────────────────────────────────────
// In-memory OTP store for email verification.
//
// Implement and export:
//
//  generateOTP()
//    Returns a random 6-digit numeric string (e.g. '183726').
//
//  storeOTP(email, otp)
//    Saves the OTP in a Map with:
//      - expiresAt: Date.now() + 10 minutes
//      - attempts: 0
//
//  verifyOTP(email, code)
//    Returns { ok, reason }. Check guards IN ORDER:
//      1. Not found   → { ok: false, reason: 'not_found'          }  → 401
//      2. Expired     → { ok: false, reason: 'expired'            }  → 410  (also delete entry)
//      3. Attempts≥3  → { ok: false, reason: 'too_many_attempts'  }  → 429
//      4. Wrong code  → { ok: false, reason: 'wrong_code'         }  → 401  (increment attempts)
//      5. Correct     → delete entry (single-use), return { ok: true }
//
//  markVerified(email)
//    Log that email is verified. In production: update the DB.
//
//  IMPORTANT, also export the Map itself as `_store`:
//    module.exports = { generateOTP, storeOTP, verifyOTP, markVerified, _store };
//    The test suite (Test 6) reaches into `_store` directly to simulate an
//    already-expired OTP, since there's no other way to fast-forward time.
//    Without this export, Test 6 fails even with a correct verifyOTP().

const store = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(email, otp) {
  store.set(email, {
    otp: String(otp),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
}

function verifyOTP(email, code) {
  const entry = store.get(email);
  if (!entry) {
    return { ok: false, reason: 'not_found' };
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(email);
    return { ok: false, reason: 'expired' };
  }

  if (entry.attempts >= 3) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (entry.otp !== String(code)) {
    entry.attempts++;
    return { ok: false, reason: 'wrong_code' };
  }

  store.delete(email);
  return { ok: true };
}

function markVerified(email) {
  console.log(`Email verified: ${email}`);
}

function _storeForTest(email, data) {
  store.set(email, data);
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  markVerified,
  _store: store,
  _storeForTest,
};
