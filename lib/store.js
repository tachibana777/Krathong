// Storage for shared krathongs.
// On Vercel: Upstash Redis over its REST API (add "Upstash for Redis" from the
// Vercel Marketplace; it sets KV_REST_API_URL / KV_REST_API_TOKEN).
// Locally (no env vars): an in-memory store, so `npm run dev` just works.

// Vercel may add a custom prefix when connecting the database (e.g. STORAGE_KV_REST_API_URL),
// so accept any prefix; the read-only token can't write, so never use it.
function findEnv(suffixes) {
  for (const suffix of suffixes) {
    if (process.env[suffix]) return process.env[suffix];
    const key = Object.keys(process.env).find((k) => k.endsWith('_' + suffix) && !k.includes('READ_ONLY') && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
}
const URL_ = findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
const TOKEN = findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);

const LIST = 'krathong:list';
const TOTAL = 'krathong:total';
const KEEP = 200;            // how many recent krathongs to keep
// many people can share one IP (cafe/campus Wi-Fi, mobile carriers), so allow a
// few launches per IP per window instead of one; the button itself has a cooldown
const RATE_WINDOW = 10;      // seconds
const RATE_MAX = 6;          // launches per IP per window

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
  const key = `krathong:rl:${ip}`;
  if (usingRedis) {
    // start the window if needed, then count this launch (INCR keeps the expiry)
    const [, count] = await redis([['SET', key, '0', 'EX', String(RATE_WINDOW), 'NX'], ['INCR', key]]);
    return Number(count) <= RATE_MAX;
  }
  const now = Date.now();
  let r = mem.rate.get(key);
  if (!r || r.reset <= now) { r = { count: 0, reset: now + RATE_WINDOW * 1000 }; mem.rate.set(key, r); }
  return ++r.count <= RATE_MAX;
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
