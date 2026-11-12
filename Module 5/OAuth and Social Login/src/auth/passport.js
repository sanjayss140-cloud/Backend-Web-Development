'use strict';
// auth/passport.js — Google OAuth strategy
//
// YOUR TASK: implement verifyCallback below.
//
// Passport has already handled the full OAuth dance (redirect → code → token
// exchange → userinfo fetch) by the time verifyCallback is called.
// You receive the Google profile and must decide what user object to return.
//
// profile.id               → Google's stable permanent ID for this user (store as googleId)
// profile.emails[0].value  → the user's email address (may change; don't use as primary key)
// profile.displayName      → their full name
// profile._json.email_verified → boolean; only link to an existing account when true
//
// done(null, user)   → success; Passport sets req.user = user
// done(null, false)  → auth rejected (e.g. email not verified); Passport returns 401
// done(err)          → unexpected error; Passport returns 500

const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { users, nextId } = require('../data');

// ─── TODO ──────────────────────────────────────────────────────────────────────
// Implement this function.
// Three scenarios to handle, in this exact order:
//
//   1. RETURNING OAuth user
//      Find a user in `users` whose googleId === profile.id.
//      If found → call done(null, user). You are done.
//
//   2. EXISTING local account (first-time Google login)
//      Find a user in `users` whose email === profile.emails[0].value.
//      If found AND profile._json.email_verified is true:
//        Set user.googleId = profile.id  (link the account)
//        Call done(null, user). You are done.
//      If found but email NOT verified:
//        Call done(null, false) — reject to prevent account hijacking.
//
//   3. BRAND-NEW user
//      No match at all. Build a new user object:
//        { id: nextId(), googleId: profile.id, email, name, role: 'member' }
//      Push it into `users`.
//      Call done(null, newUser).
//
// Hint: use Array.prototype.find() on `users`. No database, no await needed.
// ───────────────────────────────────────────────────────────────────────────────
async function verifyCallback(accessToken, refreshToken, profile, done) {
  // Resolve Google profile to a local user (returning, verified-link, or new member).
  try {
    if (!profile || !profile.id) {
      return done(null, false);
    }

    const googleId = profile.id;
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;

    // 1. Returning OAuth user — look up by stable Google sub first
    const existingOAuthUser = users.find((u) => u.googleId && u.googleId === googleId);
    if (existingOAuthUser) {
      return done(null, existingOAuthUser);
    }

    if (!email) {
      return done(null, false);
    }

    // 2. Existing local account — link only when Google verified the email
    const existingLocalUser = users.find((u) => u.email === email);
    if (existingLocalUser) {
      if (profile._json?.email_verified !== true) {
        return done(null, false);
      }
      existingLocalUser.googleId = googleId;
      return done(null, existingLocalUser);
    }

    // 3. Brand-new user — create with lowest privilege ('member')
    const newUser = {
      id: nextId(),
      googleId,
      email,
      name: profile.displayName || '',
      role: 'member',
    };
    users.push(newUser);
    return done(null, newUser);
  } catch (err) {
    return done(err);
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID     || 'test-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret',
      callbackURL:  '/auth/google/callback',
    },
    verifyCallback,
  ),
);

// verifyCallback is exported so tests can call it directly without a real browser.
module.exports = { passport, verifyCallback };
