// GET  /api/krathongs?since=<ms>  → { items, total, now }
// POST /api/krathongs {name, wish, design} → { item, total }
import { randomUUID } from 'node:crypto';
import { add, allow, recent } from '../lib/store.js';

const DESIGN_COUNT = 10;
const WINDOW_MS = 60_000; // a krathong is "on the river" for about a minute

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
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
      const url = new URL(req.url, 'http://localhost');
      const now = Date.now();
      const asked = Number(url.searchParams.get('since')) || 0;
      const since = Math.max(asked, now - WINDOW_MS);
      const data = await recent(since);
      return send(res, 200, { ...data, now });
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
