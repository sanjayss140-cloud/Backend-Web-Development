require('dotenv').config();
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret-at-least-32-chars-long';
process.env.COOKIE_SECURE = 'false';
process.env.SESSION_TTL_MS = '3600000';

const http = require('http');
const assert = require('assert/strict');
const cookieSignature = require('cookie-signature');
const app = require('../src/app');
const sessionStore = require('../src/session/sessionStore');

function request(server, { path = '/', method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const reqHeaders = { ...headers };
    let payload = null;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: reqHeaders }, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let parsed = raw;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

function extractSidCookie(setCookieHeaders) {
  assert.ok(Array.isArray(setCookieHeaders) && setCookieHeaders.length > 0, 'Expected Set-Cookie header');
  const raw = setCookieHeaders.find((h) => h.startsWith('sid='));
  assert.ok(raw, 'Expected sid cookie in Set-Cookie');
  const cookiePair = raw.split(';')[0];
  return { raw, cookiePair };
}

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    sessionStore.clear();

    // 1. Validation errors on malformed or empty login input
    {
      const rMissing = await request(server, { method: 'POST', path: '/auth/login', body: { email: 'sam@example.com' } });
      assert.equal(rMissing.status, 400);
      assert.equal(rMissing.body?.error?.code, 'VALIDATION_ERROR');

      const rEmpty = await request(server, { method: 'POST', path: '/auth/login', body: { email: '  ', password: '' } });
      assert.equal(rEmpty.status, 400);
      assert.equal(rEmpty.body?.error?.code, 'VALIDATION_ERROR');

      const rBadJson = await request(server, {
        method: 'POST',
        path: '/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json',
      });
      assert.equal(rBadJson.status, 400);
      assert.equal(rBadJson.body?.error?.code, 'INVALID_JSON');
    }

    // 2. Unknown email and wrong password share identical generic 401
    {
      const rUnknown = await request(server, {
        method: 'POST',
        path: '/auth/login',
        body: { email: 'nobody@example.com', password: 'SessionDemo!48' },
      });
      const rWrongPw = await request(server, {
        method: 'POST',
        path: '/auth/login',
        body: { email: 'sam@example.com', password: 'wrong-password' },
      });
      assert.equal(rUnknown.status, 401);
      assert.equal(rWrongPw.status, 401);
      assert.deepEqual(rUnknown.body, rWrongPw.body);
      assert.equal(rUnknown.body?.error?.code, 'INVALID_CREDENTIALS');
      assert.equal(rUnknown.headers['set-cookie'], undefined);
      assert.equal(rWrongPw.headers['set-cookie'], undefined);
    }

    // 3. Successful login (with email normalization), cookie flags, and opaque ID
    let sessionCookiePair;
    let firstRawSidValue;
    {
      const rLogin = await request(server, {
        method: 'POST',
        path: '/auth/login',
        body: { email: '  SAM@Example.com ', password: 'SessionDemo!48' },
      });
      assert.equal(rLogin.status, 200);
      assert.equal(rLogin.body?.data?.email, 'sam@example.com');
      assert.equal(rLogin.body?.data?.name, 'Sam');
      assert.equal('passwordHash' in rLogin.body.data, false);

      const { raw, cookiePair } = extractSidCookie(rLogin.headers['set-cookie']);
      sessionCookiePair = cookiePair;

      assert.match(raw, /HttpOnly/i);
      assert.match(raw, /SameSite=Lax/i);
      assert.match(raw, /Path=\//i);
      assert.match(raw, /Max-Age=3600/i);
      assert.doesNotMatch(raw, /;\s*Secure\b/i);

      const decoded = decodeURIComponent(cookiePair.slice(4));
      assert.ok(decoded.startsWith('s:'), 'Cookie must be signed');
      const unsigned = cookieSignature.unsign(decoded.slice(2), process.env.COOKIE_SECRET);
      assert.ok(unsigned, 'Cookie signature must verify');
      assert.match(unsigned, /^[0-9a-f-]{36}$/i, 'Session ID must be an opaque UUID');
      assert.ok(!raw.includes('sam@example.com') && !raw.includes('SessionDemo!48'));
      firstRawSidValue = unsigned;
    }

    // 4. Protected GET /auth/me succeeds with valid signed cookie
    {
      const rMe = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: sessionCookiePair },
      });
      assert.equal(rMe.status, 200);
      assert.equal(rMe.body?.data?.email, 'sam@example.com');
      assert.equal('passwordHash' in rMe.body.data, false);
    }

    // 5. Missing or tampered cookie returns generic 401 AUTH_REQUIRED
    {
      const rNoCookie = await request(server, { method: 'GET', path: '/auth/me' });
      assert.equal(rNoCookie.status, 401);
      assert.equal(rNoCookie.body?.error?.code, 'AUTH_REQUIRED');

      const tampered = sessionCookiePair.slice(0, -2) + (sessionCookiePair.endsWith('aa') ? 'bb' : 'aa');
      const rTampered = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: tampered },
      });
      assert.equal(rTampered.status, 401);
      assert.deepEqual(rTampered.body, rNoCookie.body);
    }

    // 6. Expired session is rejected and pruned on read
    {
      const expired = sessionStore.create(1, 10);
      await new Promise((r) => setTimeout(r, 25));
      const signedExpired = `sid=${encodeURIComponent('s:' + cookieSignature.sign(expired.id, process.env.COOKIE_SECRET))}`;
      const rExpired = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: signedExpired },
      });
      assert.equal(rExpired.status, 401);
      assert.equal(rExpired.body?.error?.code, 'AUTH_REQUIRED');
      assert.equal(sessionStore.get(expired.id), null);
    }

    // 7. Orphaned session (non-existent userId) is destroyed and rejected
    {
      const orphan = sessionStore.create(999999);
      const signedOrphan = `sid=${encodeURIComponent('s:' + cookieSignature.sign(orphan.id, process.env.COOKIE_SECRET))}`;
      const rOrphan = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: signedOrphan },
      });
      assert.equal(rOrphan.status, 401);
      assert.equal(rOrphan.body?.error?.code, 'AUTH_REQUIRED');
      assert.equal(sessionStore.get(orphan.id), null);
    }

    // 8. Re-login rotates session ID and invalidates previous session
    {
      const rRelogin = await request(server, {
        method: 'POST',
        path: '/auth/login',
        headers: { Cookie: sessionCookiePair },
        body: { email: 'sam@example.com', password: 'SessionDemo!48' },
      });
      assert.equal(rRelogin.status, 200);
      const { cookiePair: rotatedCookie } = extractSidCookie(rRelogin.headers['set-cookie']);
      assert.notEqual(rotatedCookie, sessionCookiePair);
      assert.equal(sessionStore.get(firstRawSidValue), null);
      sessionCookiePair = rotatedCookie;
    }

    // 9. Logout clears cookie, deletes server session, blocks replay, and is idempotent
    {
      const rLogout = await request(server, {
        method: 'POST',
        path: '/auth/logout',
        headers: { Cookie: sessionCookiePair },
      });
      assert.equal(rLogout.status, 204);
      const { raw: clearRaw, cookiePair: clearedCookiePair } = extractSidCookie(rLogout.headers['set-cookie']);
      assert.match(clearRaw, /^sid=s%3A\.[^;]+;/);
      assert.match(clearRaw, /HttpOnly/i);
      assert.match(clearRaw, /SameSite=Lax/i);
      assert.match(clearRaw, /Path=\//i);
      assert.match(clearRaw, /Expires=Thu, 01 Jan 1970/i);

      const rClearedReplay = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: clearedCookiePair },
      });
      assert.equal(rClearedReplay.status, 401);
      assert.equal(rClearedReplay.body?.error?.code, 'AUTH_REQUIRED');

      const rReplay = await request(server, {
        method: 'GET',
        path: '/auth/me',
        headers: { Cookie: sessionCookiePair },
      });
      assert.equal(rReplay.status, 401);
      assert.equal(rReplay.body?.error?.code, 'AUTH_REQUIRED');

      const rRepeatLogout = await request(server, { method: 'POST', path: '/auth/logout' });
      assert.equal(rRepeatLogout.status, 204);
    }

    // 10. Production cookie config emits Secure on both login and logout
    {
      process.env.COOKIE_SECURE = 'true';
      const rProdLogin = await request(server, {
        method: 'POST',
        path: '/auth/login',
        body: { email: 'sam@example.com', password: 'SessionDemo!48' },
      });
      assert.equal(rProdLogin.status, 200);
      const { raw: prodSetRaw, cookiePair: prodCookie } = extractSidCookie(rProdLogin.headers['set-cookie']);
      assert.match(prodSetRaw, /;\s*Secure\b/i);

      const rProdLogout = await request(server, {
        method: 'POST',
        path: '/auth/logout',
        headers: { Cookie: prodCookie },
      });
      assert.equal(rProdLogout.status, 204);
      const { raw: prodClearRaw } = extractSidCookie(rProdLogout.headers['set-cookie']);
      assert.match(prodClearRaw, /;\s*Secure\b/i);
    }

    console.log('ALL_SESSION_AUTH_TESTS_PASSED');
  } finally {
    process.env.COOKIE_SECURE = 'false';
    server.close();
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
