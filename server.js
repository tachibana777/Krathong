// Local dev server (no dependencies): serves /public and /api/* like Vercel does.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return raw; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
      const mod = await import(`./api/${name}.js`);
      if (req.method === 'POST') req.body = await readBody(req);
      return await mod.default(req, res);
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(ROOT, '.' + path);
    if (!file.startsWith(ROOT + sep)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    const notFound = e.code === 'ENOENT' || e.code === 'ERR_MODULE_NOT_FOUND';
    if (!notFound) console.error(e);
    res.writeHead(notFound ? 404 : 500, { 'Content-Type': 'text/plain' });
    res.end(notFound ? 'Not found' : 'Server error');
  }
}).listen(PORT, () => console.log(`🪷  Krathong running at http://localhost:${PORT}`));
