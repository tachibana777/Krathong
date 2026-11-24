import { AsciiRenderer } from './ascii.js';
import { Scene } from './scene.js';
import { DESIGNS, drawKrathong } from './krathong.js';
import { Fireworks } from './fireworks.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const renderer = new AsciiRenderer(canvas);
const scene = new Scene();
const fireworks = new Fireworks();

const LIFE = 55;          // seconds a krathong stays visible
const Z_FAR = 13;         // how far it drifts (world units)

const state = {
  design: Number(localStorage.getItem('krathong:design')) || 0,
  krathongs: [],          // {id, name, wish, design, born, x0, z0, own, seed}
  rings: [],              // launch ripples {x, y, born}
  t: 0,
  nextAmbient: 6,
};

/* ---------------- design picker ---------------- */
const previews = [];
DESIGNS.forEach((d, i) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.setAttribute('role', 'radio');
  card.innerHTML = `<canvas></canvas><span class="nm"></span><span class="en"></span>`;
  card.querySelector('.nm').textContent = d.name;
  card.querySelector('.en').textContent = d.en;
  card.addEventListener('click', () => selectDesign(i));
  $('designs').appendChild(card);
  const r = new AsciiRenderer(card.querySelector('canvas'), { cellW: 4, cellH: 6.5, glow: 0.7, blur: 4, bg: '#020306' });
  previews.push({ card, r, design: d });
});

function selectDesign(i) {
  state.design = i;
  localStorage.setItem('krathong:design', String(i));
  previews.forEach((p, j) => p.card.setAttribute('aria-checked', String(i === j)));
}
selectDesign(Math.min(state.design, DESIGNS.length - 1));

$('name').value = localStorage.getItem('krathong:name') || '';

function resizePreviews() {
  for (const p of previews) {
    const rect = p.card.querySelector('canvas').getBoundingClientRect();
    p.r.resize(Math.max(40, rect.width), Math.max(40, rect.height));
  }
}

function drawPreview(p, t, i) {
  p.r.render((ctx, w, h) => {
    const wy = h * 0.8;
    const g = ctx.createLinearGradient(0, wy - 6, 0, h);
    g.addColorStop(0, '#0d2830');
    g.addColorStop(1, '#03080b');
    ctx.fillStyle = g;
    ctx.fillRect(0, wy - 6, w, h);
    const s = Math.min(w / 260, h / 220);
    drawKrathong(ctx, p.design, w / 2, wy, s, t, i * 3.1);
  });
}

/* ---------------- krathongs on the river ---------------- */
function spawnKrathong(item, { own = false, age = 0 } = {}) {
  if (state.krathongs.some((k) => k.id === item.id)) return null;
  const k = {
    id: item.id,
    name: item.name,
    wish: item.wish || '',
    design: DESIGNS[item.design] ? item.design : 0,
    born: state.t - age,
    own,
    // own krathong starts centre-front; others enter from either side a bit further out
    x0: own ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.6),
    z0: own ? 0.95 : 1.4 + Math.random() * 1.2,
    seed: Math.random() * 100,
  };
  state.krathongs.push(k);
  return k;
}

/** world → screen. z = distance (1 = right at the front). */
function place(k, t) {
  const age = t - k.born;
  const p = age / LIFE;
  const push = 0.25 * (1 - Math.exp(-age * 1.5));
  const z = k.z0 + push + (Z_FAR - k.z0) * Math.pow(p, 1.5);
  const { w, h, horizon, unit } = scene;
  const drift = Math.sin(age * 0.25 + k.seed) * 0.12;
  const x = w / 2 + ((k.x0 + drift) * w * 0.55) / z * 1.4;
  const y = horizon + ((h - horizon) * 0.94) / z;
  const s = (unit * 1.15) / z;
  const fadeIn = Math.min(1, age / 0.8);
  const fadeOut = p > 0.82 ? Math.max(0, 1 - (p - 0.82) / 0.18) : 1;
  return { x, y, s, z, alpha: fadeIn * fadeOut, done: p >= 1 };
}

/* ---------------- launching ---------------- */
function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.append(...html);
  $('toasts').prepend(el);
  setTimeout(() => el.remove(), 6200);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}

function bold(text) { const b = document.createElement('b'); b.textContent = text; return b; }

function celebrate(k, big) {
  const pos = place(k, state.t);
  state.rings.push({ x: pos.x, y: pos.y, born: state.t, s: pos.s });
  if (big) fireworks.show(9, 7);
  else fireworks.show(2, 2);
}

function launchOwn(name, wish) {
  const item = {
    id: (crypto.randomUUID?.() || String(Math.random()).slice(2)),
    name, wish, design: state.design,
  };
  const k = spawnKrathong(item, { own: true });
  celebrate(k, true);
  $('panel').classList.add('hidden');
  $('afterText').replaceChildren('✨ กระทงของ ', bold(name), ' กำลังลอยไป…');
  $('after').classList.remove('hidden');
  return item;
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('name').value.trim().replace(/\s+/g, ' ');
  const wish = $('wish').value.trim().replace(/\s+/g, ' ');
  if (!name) { $('name').focus(); return; }
  localStorage.setItem('krathong:name', name);
  const item = launchOwn(name, wish);
  $('wish').value = '';
  $('launch').disabled = true;
  setTimeout(() => { $('launch').disabled = false; }, 4500);
  try {
    const res = await fetch('/api/krathongs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (res.status === 429) { toast(['ลอยถี่ไปนิด รอสักครู่แล้วค่อยลอยใหม่นะ 🙏']); return; }
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
  } catch {
    // offline: the krathong still floats locally
  }
});

$('again').addEventListener('click', () => {
  $('after').classList.add('hidden');
  $('panel').classList.remove('hidden');
});


/* ---------------- sharing with everyone else ---------------- */
let lastSeen = 0;          // server timestamp of the newest krathong we've seen
const POLL_MS = 3500;

async function poll(first = false) {
  try {
    const res = await fetch(`/api/krathongs?since=${lastSeen}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const { items = [], now = Date.now() } = await res.json();
    for (const item of items) {
      lastSeen = Math.max(lastSeen, item.ts);
      const k = spawnKrathong(item, { age: Math.max(0, (now - item.ts) / 1000) });
      if (!k || first) continue;
      celebrate(k, false);
      toast(['🪷 ', bold(item.name), ` ลอยกระทง${DESIGNS[k.design].name}`]);
    }
  } catch {
    // offline or server hiccup: try again next poll
  }
}

poll(true);
setInterval(() => { if (!document.hidden) poll(); }, POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

/* ---------------- layout ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 700) { renderer.cellW = 6; renderer.cellH = 10; } else { renderer.cellW = 8; renderer.cellH = 13; }
  renderer.resize(w, h);
  scene.resize(w, h);
  fireworks.resize(w, h, scene.horizon, scene.unit);
  resizePreviews();
}
addEventListener('resize', resize);
resize();

/* ---------------- drawing ---------------- */
function drawRings(ctx, t) {
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    const age = t - r.born;
    if (age > 2.5) { state.rings.splice(i, 1); continue; }
    for (let j = 0; j < 3; j++) {
      const a = age - j * 0.35;
      if (a < 0) continue;
      const R = (40 + a * 160) * r.s;
      ctx.strokeStyle = `rgba(150,230,255,${Math.max(0, 0.7 * (1 - a / 2))})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + 4, R, R * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawLabels(ctx, list) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const { k, pos } of list) {
    const rel = pos.s / scene.unit;
    if (rel < 0.14 || pos.alpha <= 0) continue;
    const size = Math.max(11, Math.min(22, 26 * rel));
    const top = pos.y - 205 * pos.s;
    const a = pos.alpha * Math.min(1, (rel - 0.14) * 6);
    ctx.globalAlpha = a;
    ctx.font = `600 ${size}px Mitr, sans-serif`;
    ctx.shadowColor = k.own ? 'rgba(255,170,60,0.95)' : 'rgba(255,200,140,0.7)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = k.own ? '#ffd98a' : '#fff1dc';
    ctx.fillText(k.name, pos.x, top);
    if (k.wish && rel > 0.3) {
      ctx.font = `300 ${Math.max(10, size * 0.62)}px Mitr, sans-serif`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(255,236,210,0.85)';
      ctx.fillText(`“${k.wish}”`, pos.x, top + size * 0.95);
    }
  }
  ctx.restore();
}

/* ---------------- main loop ---------------- */
let last = performance.now();
let previewClock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.t += dt;
  const t = state.t;
  scene.update(dt);
  fireworks.update(dt);

  if (t > state.nextAmbient) {
    fireworks.launch();
    state.nextAmbient = t + 8 + Math.random() * 9;
  }

  const panel = $('panel');
  const panelOpen = !panel.classList.contains('hidden');
  const panelTop = panelOpen ? panel.getBoundingClientRect().top : innerHeight;

  // compute positions, drop finished ones, sort far → near
  const list = [];
  state.krathongs = state.krathongs.filter((k) => {
    const pos = place(k, t);
    if (pos.done) return false;
    list.push({ k, pos });
    return true;
  });
  list.sort((a, b) => b.pos.z - a.pos.z);

  renderer.render(
    (ctx, w, h) => {
      scene.drawSky(ctx, t);
      fireworks.draw(ctx);
      scene.drawLand(ctx, t);
      scene.drawWater(ctx, t);
      fireworks.drawReflection(ctx);
      drawRings(ctx, t);
      for (const { k, pos } of list) {
        drawKrathong(ctx, DESIGNS[k.design], pos.x, pos.y, pos.s, t, k.seed, pos.alpha);
      }
      if (panelOpen) {
        // the chosen krathong waits on the water just above the panel
        const y = Math.min(h * 0.93, panelTop - 14);
        const s = Math.max(scene.scaleAt(y), scene.unit * 0.5);
        if (y > scene.horizon + 60) drawKrathong(ctx, DESIGNS[state.design], w / 2, y, s, t, 7);
      }
    },
    (ctx) => drawLabels(ctx, list),
  );

  // previews at ~24fps to keep things light
  previewClock += dt;
  if (panelOpen && previewClock > 1 / 24) {
    previewClock = 0;
    previews.forEach((p, i) => drawPreview(p, t, i));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.fonts?.ready.then(resize);

