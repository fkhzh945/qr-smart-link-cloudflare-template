import { Hono } from 'hono';
import { registerAuth } from './auth.js';
import { registerLocations } from './locations.js';
import { registerBatches } from './batches.js';
import { registerQrs } from './qrs.js';
import { registerActivation } from './activation.js';
import { registerCloudflareUsage } from './cloudflare-usage.js';

const app = new Hono();
registerAuth(app);
registerLocations(app);
registerBatches(app);
registerQrs(app);
registerActivation(app);
registerCloudflareUsage(app);

// Serve the public landing page explicitly, including in Worker editor previews.
app.get('/', c => c.env.ASSETS.fetch(c.req.raw));

app.get('/health', c => c.json({ ok: true, version: '0.1.0' }, 200, {
  'Cache-Control': 'no-store'
}));

app.get('/health/db', async c => {
  try {
    const row = await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ ok: row?.ok === 1, database: row?.ok === 1, driver: 'd1' },
      row?.ok === 1 ? 200 : 503, { 'Cache-Control': 'no-store' });
  } catch {
    return c.json({ ok: false, database: false, driver: 'd1' }, 503,
      { 'Cache-Control': 'no-store' });
  }
});

// Public redirect. No visit tracking, no IP or device fingerprint collection.
app.get('/q/:shortCode', async c => {
  const code = c.req.param('shortCode').toUpperCase();
  if (!/^[A-Z0-9]{5,16}$/.test(code)) return c.text('Not found', 404);
  const row = await c.env.DB.prepare(
    'SELECT status, target_url FROM qr_codes WHERE short_code = ? LIMIT 1'
  ).bind(code).first();
  if (!row) return c.text('Not found', 404);
  if (row.status !== 'ACTIVE') return c.text(
    row.status === 'DISABLED' ? 'QR code disabled' : 'QR code not activated', 200,
    { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  );
  let url;
  try {
    url = new URL(row.target_url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('bad protocol');
  } catch {
    return c.text('Invalid target', 503);
  }
  return new Response(null, { status: 302, headers: { Location: url.href, 'Cache-Control': 'no-store' } });
});

export default app;
