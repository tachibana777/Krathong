// Storage for shared krathongs.
// On Vercel: Upstash Redis over its REST API (add "Upstash for Redis" from the
// Vercel Marketplace; it sets KV_REST_API_URL / KV_REST_API_TOKEN).
// Locally (no env vars): an in-memory store, so `npm run dev` just works.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const LIST = 'krathong:list';
const TOTAL = 'krathong:total';
const KEEP = 200;            // how many recent krathongs to keep
const RATE_SECONDS = 4;      // one krathong per IP every few seconds

export const usingRedis = Boolean(URL_ && TOKEN);

async function redis(commands) {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

const mem = globalThis.__krathongMem || (globalThis.__krathongMem = { list: [], total: 0, rate: new Map() });

/** @returns {Promise<boolean>} false when this IP must wait */
export async function allow(ip) {
  if (usingRedis) {
    const [ok] = await redis([['SET', `krathong:rl:${ip}`, '1', 'EX', String(RATE_SECONDS), 'NX']]);
    return ok === 'OK';
  }
  const now = Date.now();
  if ((mem.rate.get(ip) || 0) > now) return false;
  mem.rate.set(ip, now + RATE_SECONDS * 1000);
  return true;
}

export async function add(item) {
  if (usingRedis) {
    const [, , total] = await redis([
      ['LPUSH', LIST, JSON.stringify(item)],
      ['LTRIM', LIST, '0', String(KEEP - 1)],
      ['INCR', TOTAL],
    ]);
    return Number(total);
  }
  mem.list.unshift(item);
  mem.list.length = Math.min(mem.list.length, KEEP);
  return ++mem.total;
}

/** krathongs newer than `since` (ms), oldest first */
export async function recent(since) {
  let raw, total;
  if (usingRedis) {
    [raw, total] = await redis([['LRANGE', LIST, '0', '59'], ['GET', TOTAL]]);
    raw = raw.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  } else {
    raw = mem.list.slice(0, 60);
    total = mem.total;
  }
  return { items: raw.filter((k) => k.ts > since).reverse(), total: Number(total) || 0 };
}
