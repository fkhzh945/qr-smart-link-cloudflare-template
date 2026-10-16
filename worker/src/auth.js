import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const COOKIE = 'qr_lite_session';
const enc = new TextEncoder();

function noStore(c, body, status = 200) {
  return c.json(body, status, { 'Cache-Control': 'no-store' });
}
function originAllowed(c) {
  const origin = c.req.header('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(c.req.url).origin; } catch { return false; }
}
function key(c) {
  if (!c.env.SESSION_SECRET || c.env.SESSION_SECRET.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  return enc.encode(c.env.SESSION_SECRET);
}
function validEmail(e) { return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254; }
function validPassword(p) { return typeof p === 'string' && p.length >= 12 && p.length <= 128; }
async function session(c, user) {
  const jwt = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id))
    .setIssuedAt().setExpirationTime('8h').sign(key(c));
  setCookie(c, COOKIE, jwt, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/', maxAge: 28800 });
}
export async function currentUser(c) {
  const cookie = getCookie(c, COOKIE);
  if (!cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, key(c), { algorithms: ['HS256'] });
    if (!/^\d+$/.test(payload.sub || '')) return null;
    return await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(Number(payload.sub)).first();
  } catch { return null; }
}
export function registerAuth(app) {
  app.get('/api/setup/status', async c => {
    const found = await c.env.DB.prepare('SELECT id FROM users LIMIT 1').first();
    return noStore(c, { initialized: Boolean(found) });
  });

  app.post('/api/setup/initialize', async c => {
    if (!originAllowed(c)) return noStore(c, { error: 'Origin rejected' }, 403);
    const body = await c.req.json().catch(() => ({}));
    if (typeof c.env.SETUP_TOKEN !== 'string' || c.env.SETUP_TOKEN.length < 16)
      return noStore(c, { error: 'Setup token not configured' }, 503);
    if (!body.setupToken || body.setupToken !== c.env.SETUP_TOKEN) return noStore(c, { error: 'Invalid setup token' }, 403);
    const email = String(body.email || '').trim().toLowerCase();
    if (!validEmail(email) || !validPassword(body.password))
      return noStore(c, { error: 'Valid email and password (12–128 characters) required' }, 400);
    if (await c.env.DB.prepare('SELECT id FROM users LIMIT 1').first())
      return noStore(c, { error: 'Already initialized' }, 409);
    const hash = await bcrypt.hash(body.password, 10);
    // One single reserved administrator row makes concurrent initialization atomic.
    const result = await c.env.DB.prepare(
      'INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (1, ?, ?)'
    ).bind(email, hash).run();
    if (result.meta.changes !== 1) return noStore(c, { error: 'Already initialized' }, 409);
    const user = { id: 1, email };
    await session(c, user);
    return noStore(c, { ok: true, user }, 201);
  });

  app.post('/api/auth/login', async c => {
    if (!originAllowed(c)) return noStore(c, { error: 'Origin rejected' }, 403);
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!validEmail(email) || typeof body.password !== 'string') return noStore(c, { error: 'Invalid credentials' }, 401);
    const user = await c.env.DB.prepare('SELECT id, email, password_hash, login_failures, login_locked_until FROM users WHERE email = ?').bind(email).first();
    const now=Math.floor(Date.now()/1000);
    if (user?.login_locked_until>now) return noStore(c,{error:'Too many attempts. Try later.'},429);
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      if(user) await c.env.DB.prepare('UPDATE users SET login_failures=CASE WHEN login_locked_until>0 AND login_locked_until<=? THEN 1 ELSE login_failures+1 END,login_locked_until=CASE WHEN (CASE WHEN login_locked_until>0 AND login_locked_until<=? THEN 1 ELSE login_failures+1 END)>=5 THEN ? ELSE 0 END WHERE id=?')
        .bind(now,now,now+900,user.id).run();
      return noStore(c, { error: 'Invalid credentials' }, 401);
    }
    await c.env.DB.prepare('UPDATE users SET login_failures=0,login_locked_until=0 WHERE id=?').bind(user.id).run();
    await session(c, user);
    return noStore(c, { ok: true, user: { id: user.id, email: user.email } });
  });

  app.post('/api/auth/logout', c => {
    if (!originAllowed(c)) return noStore(c, { error: 'Origin rejected' }, 403);
    deleteCookie(c, COOKIE, { path: '/' });
    return noStore(c, { ok: true });
  });

  app.get('/api/auth/me', async c => {
    const user = await currentUser(c);
    return user ? noStore(c, { user }) : noStore(c, { error: 'Unauthorized' }, 401);
  });

  app.post('/api/auth/change-password', async c => {
    if (!originAllowed(c)) return noStore(c, { error: 'Origin rejected' }, 403);
    const user = await currentUser(c);
    if (!user) return noStore(c, { error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({}));
    if (!validPassword(body.newPassword)) return noStore(c, { error: 'Password must be 12–128 characters' }, 400);
    const saved = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
    if (!saved || !await bcrypt.compare(body.oldPassword || '', saved.password_hash))
      return noStore(c, { error: 'Invalid current password' }, 401);
    await c.env.DB.prepare('UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(await bcrypt.hash(body.newPassword, 10), user.id).run();
    await session(c, user);
    return noStore(c, { ok: true });
  });

  app.use('/api/*', async (c, next) => {
    if (!originAllowed(c)) return noStore(c, { error: 'Origin rejected' }, 403);
    const user = await currentUser(c);
    if (!user) return noStore(c, { error: 'Unauthorized' }, 401);
    c.set('user', user);
    await next();
  });
}
