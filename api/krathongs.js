// GET  /api/krathongs  → { items (newest 10, oldest first), total, now, storage }
// POST /api/krathongs {name, wish, design} → { item, total }
import { randomUUID } from 'node:crypto';
import { add, allow, recent, usingRedis } from '../lib/store.js';

const DESIGN_COUNT = 10;
const ON_RIVER = 10;      // krathongs stay on the water until 10 newer ones arrive

function send(res, status, body, cdnSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');   // browsers always ask again
  // Vercel's CDN may answer everyone from one copy for a moment, so the
  // database load stays the same however many people are watching
  if (cdnSeconds) res.setHeader('Vercel-CDN-Cache-Control', `max-age=${cdnSeconds}`);
  res.end(JSON.stringify(body));
}

/** trim, collapse spaces, strip control chars, cap by characters (Thai-safe) */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  const s = value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, max).join('');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // the same answer for everyone: the newest 10 (the ones still on the river),
      // however long ago they were launched; pages skip the ones they already have
      const data = await recent(0);
      data.items = data.items.slice(-ON_RIVER);
      return send(res, 200, { ...data, now: Date.now(), storage: usingRedis ? 'redis' : 'memory' }, 2);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const name = clean(body.name, 24);
      const wish = clean(body.wish, 60);
      const design = Number(body.design);
      if (!name) return send(res, 400, { error: 'name_required' });
      if (!Number.isInteger(design) || design < 0 || design >= DESIGN_COUNT) return send(res, 400, { error: 'bad_design' });

      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      if (!(await allow(ip))) return send(res, 429, { error: 'too_fast' });

      const item = { id: typeof body.id === 'string' && /^[\w-]{6,40}$/.test(body.id) ? body.id : randomUUID(), name, wish, design, ts: Date.now() };
      const total = await add(item);
      return send(res, 201, { item, total });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'server_error' });
  }
}
