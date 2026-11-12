# Session-Based Authentication (Express + Prisma)

Implements cookie-backed server-side session authentication with `POST /auth/login`, `GET /auth/me`, and `POST /auth/logout`.

## Architecture & Security Model

- **Opaque Session IDs (`src/session/sessionStore.js`)**: Login issues a cryptographically random UUID (`crypto.randomUUID()`) and stores `{ userId, expiresAt }` on the server. Cookies never hold emails, passwords, password hashes, or user records.
- **Centralized Cookie Policy (`src/config/cookieConfig.js`)**: Login and logout share the same cookie name (`sid`) and security flags (`httpOnly: true`, `sameSite: 'lax'`, `signed: true`, `path: '/'`, `secure` controlled via `COOKIE_SECURE` / `NODE_ENV`, plus `maxAge` from `SESSION_TTL_MS` at login).
- **Repository Boundary (`src/repositories/userRepository.js`)**: Keeps Prisma queries behind repository helpers and exposes only public user fields (`id`, `name`, `email`, `createdAt`).
- **Generic Failure Responses**: Unknown email and wrong password return the exact same generic `401 INVALID_CREDENTIALS` response; missing, tampered, expired, or orphaned sessions return a generic `401 AUTH_REQUIRED` response.
- **Production Storage Notice**: The included in-memory `Map` session store is intended for **learning and local single-process execution only**—server restarts clear sessions and multiple instances cannot share state. Production deployments must use a shared expiring store such as **Redis** behind **HTTPS** with `COOKIE_SECURE=true`.

## Setup & Seed

```bash
cp .env.example .env
npm install
npm run setup
```

> Update `COOKIE_SECRET` in `.env` to a random secret of at least 32 characters (never commit `.env`). Keep `COOKIE_SECURE="false"` for local plain HTTP testing; set `COOKIE_SECURE="true"` in production over HTTPS.

Seeded demo account: `sam@example.com` / `SessionDemo!48`.

## Run & Test

```bash
npm run dev     # start with file watching
npm start       # start normally
npm test        # run automated verification suite
```

## Local Verification (`curl`)

```bash
# 1. Login and inspect Set-Cookie (sid, HttpOnly, SameSite=Lax)
curl -i -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sam@example.com","password":"SessionDemo!48"}'

# 2. Access protected identity endpoint with the session cookie
curl -i -b cookies.txt http://localhost:3000/auth/me

# 3. Missing or tampered cookie returns 401 AUTH_REQUIRED
curl -i http://localhost:3000/auth/me
curl -i -H "Cookie: sid=s%3Atampered.invalidsignature" http://localhost:3000/auth/me

# 4. Logout clears the cookie and revokes the server session
curl -i -b cookies.txt -c cookies-after-logout.txt -X POST http://localhost:3000/auth/logout

# 5. Replaying the old cookie after logout fails with 401
curl -i -b cookies.txt http://localhost:3000/auth/me
```

To verify production cookie flags (`Secure` attribute on `Set-Cookie`), start with `COOKIE_SECURE=true` (clients only send `Secure` cookies over HTTPS):

```bash
COOKIE_SECURE=true node src/app.js
```
