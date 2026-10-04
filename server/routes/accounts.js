import { randomUUID } from 'node:crypto';
import express from 'express';
import { validateLogin, validateRegistration } from '../../shared/accounts.js';
import { ApiError, Conflict } from '../errors.js';
import { readJson } from '../middleware.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { SESSION_SECONDS, newToken, sessionCookie, sessionToken, stamp, tokenDigest } from '../services/sessions.js';

const text = (value) => (value ? String(value) : '');
const secret = (value) => (typeof value === 'string' ? value : '');

function refuseInvalid(result) {
  if (result.ok) return;
  throw new ApiError(400, Object.values(result.errors)[0], result.errors);
}

export async function currentUser(req, ctx) {
  const token = sessionToken(req);
  if (!token) return null;
  return ctx().backend.sessionUser(tokenDigest(token), stamp(new Date()));
}

export async function requireUser(req, ctx) {
  const user = await currentUser(req, ctx);
  if (!user) throw new ApiError(401, 'Log in to continue.');
  return user;
}

async function startSession(req, context, userId) {
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000);
  await context.backend.createSession(tokenDigest(token), userId, stamp(now), stamp(expires));
  return sessionCookie(req, token, SESSION_SECONDS, context.secureCookies);
}

/** Register, log in, log out and who-am-I. */
export function accountRoutes({ ctx, clientIp }) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const body = await readJson(req);
    const name = text(body.name).trim();
    const email = text(body.email).trim().toLowerCase();
    const password = secret(body.password);
    refuseInvalid(validateRegistration({ name, email, password }));

    const context = ctx();
    const user = { id: randomUUID().replace(/-/g, ''), email, name };
    const passwordHash = await hashPassword(password, context.iterations);
    try {
      await context.backend.createUser(user, passwordHash, stamp(new Date()));
    } catch (error) {
      if (!(error instanceof Conflict)) throw error;
      const message = 'An account with that email already exists. Log in instead.';
      throw new ApiError(409, message, { email: message });
    }
    res.setHeader('Set-Cookie', await startSession(req, context, user.id));
    res.status(201).json({ user });
  });

  router.post('/login', async (req, res) => {
    const body = await readJson(req);
    const email = text(body.email).trim().toLowerCase();
    const password = secret(body.password);
    refuseInvalid(validateLogin({ email, password }));

    const context = ctx();
    const key = `${clientIp(req)}|${email}`;
    if (await context.throttle.blocked(key)) {
      throw new ApiError(429, 'Too many attempts. Wait a few minutes, then try again.');
    }
    const row = await context.backend.findUser(email);
    const matched = await verifyPassword(password, row ? row.password_hash : await context.decoyHash());
    if (!row || !matched) {
      await context.throttle.fail(key);
      // One message for both cases: which half was wrong is not the server's to say.
      throw new ApiError(401, 'Email or password is incorrect.');
    }
    const cookie = await startSession(req, context, row.id);
    await context.throttle.reset(key);
    res.setHeader('Set-Cookie', cookie);
    res.status(200).json({ user: { id: row.id, email: row.email, name: row.name } });
  });

  router.post('/logout', async (req, res) => {
    const context = ctx();
    const token = sessionToken(req);
    if (token) await context.backend.endSession(tokenDigest(token));
    res.setHeader('Set-Cookie', sessionCookie(req, '', 0, context.secureCookies));
    res.status(204).end();
  });

  router.get('/me', async (req, res) => {
    res.status(200).json({ user: await requireUser(req, ctx) });
  });

  return router;
}
