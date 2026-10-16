function respond(c, value, status = 200) { return c.json(value, status, { 'Cache-Control': 'no-store' }); }
const validId = v => /^\d+$/.test(v) && Number(v) > 0;
export function registerLocations(app) {
  app.get('/api/locations', async c => {
    const { results } = await c.env.DB.prepare(
      'SELECT l.id,l.name,l.remark,l.created_at,COUNT(q.id) AS qr_count FROM locations l LEFT JOIN qr_codes q ON q.location_id=l.id GROUP BY l.id ORDER BY l.id DESC'
    ).all();
    return respond(c, { items: results });
  });
  app.post('/api/locations', async c => {
    const body = await c.req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const remark = String(body.remark || '').trim();
    if (!name || name.length > 100 || remark.length > 500) return respond(c, { error: 'Invalid location' }, 400);
    try {
      const result = await c.env.DB.prepare('INSERT INTO locations (name, remark) VALUES (?,?)').bind(name, remark).run();
      return respond(c, { ok: true, id: result.meta.last_row_id }, 201);
    } catch (e) {
      if (String(e).includes('UNIQUE')) return respond(c, { error: 'Location already exists' }, 409);
      throw e;
    }
  });
  app.put('/api/locations/:id', async c => {
    const id = c.req.param('id');
    if (!validId(id)) return respond(c, { error: 'Invalid id' }, 400);
    const body = await c.req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const remark = String(body.remark || '').trim();
    if (!name || name.length > 100 || remark.length > 500) return respond(c, { error: 'Invalid location' }, 400);
    try {
      const result = await c.env.DB.prepare('UPDATE locations SET name=?, remark=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(name, remark, Number(id)).run();
      return respond(c, { ok: result.meta.changes > 0 }, result.meta.changes ? 200 : 404);
    } catch (e) {
      if (String(e).includes('UNIQUE')) return respond(c, { error: 'Location already exists' }, 409);
      throw e;
    }
  });
  app.delete('/api/locations/:id', async c => {
    const id = c.req.param('id');
    if (!validId(id)) return respond(c, { error: 'Invalid id' }, 400);
    const bound = await c.env.DB.prepare('SELECT id FROM qr_codes WHERE location_id=? LIMIT 1').bind(Number(id)).first();
    if (bound) return respond(c, { error: 'Location is in use' }, 409);
    const r = await c.env.DB.prepare('DELETE FROM locations WHERE id=?').bind(Number(id)).run();
    return respond(c, { ok: r.meta.changes > 0 }, r.meta.changes ? 200 : 404);
  });
}
