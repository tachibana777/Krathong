import { AsciiRenderer } from './ascii.js';
import { GLAsciiRenderer } from './ascii-gl.js';
import { Scene } from './scene.js';
import { DESIGNS, drawKrathong } from './krathong.js';
import { Fireworks } from './fireworks.js';

const $ = (id) => document.getElementById(id);
// GPU renderer when possible; plain Canvas2D otherwise
let renderer;
try {
  renderer = new GLAsciiRenderer($('scene'), $('overlay'));
} catch (err) {
  console.warn('WebGL unavailable, using Canvas2D renderer', err);
  const fresh = $('scene').cloneNode();
  $('scene').replaceWith(fresh);   // a canvas can only ever hold one context type
  $('overlay').remove();
  renderer = new AsciiRenderer(fresh);
}

/* ---------------- quality (adaptive) ---------------- */
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
// each step trades a little sharpness/bloom for speed
const TIERS = [
  { cell: [7, 11], small: [5, 9], dpr: 2, blur: true, previews: 2, shadow: 14 },
  { cell: [7, 11], small: [5, 9], dpr: 1.5, blur: false, previews: 2, shadow: 8 },
  { cell: [9, 15], small: [7, 12], dpr: 1.25, blur: false, previews: 1, shadow: 0 },
  { cell: [10, 16], small: [8, 13], dpr: 1, blur: false, previews: 1, shadow: 0 },
];
let tier = MOBILE ? 1 : 0;
const perf = { sum: 0, n: 0, holdUntil: 0 };

function applyTier() {
  const q = TIERS[tier];
  renderer.maxDpr = q.dpr;
  renderer.useBlur = q.blur;
  for (const p of previews) { p.r.maxDpr = Math.min(q.dpr, 1.5); p.r.useBlur = false; }
}

/** step quality down when the average frame time stays above ~25ms */
function watchPerformance(rawDt, now) {
  if (now < perf.holdUntil || document.hidden || rawDt > 0.25) return;
  perf.sum += rawDt; perf.n++;
  if (perf.n < 90) return;
  const avg = perf.sum / perf.n;
  perf.sum = 0; perf.n = 0;
  if (avg > 1 / 40 && tier < TIERS.length - 1) {
    tier++;
    applyTier();
    resize();
    perf.holdUntil = now + 2000;
  }
}
const scene = new Scene();
const fireworks = new Fireworks();

const MAX_ON_WATER = 10; // more than this → the oldest drifts away into the distance
const RETIRE_TIME = 14;  // seconds a departing krathong takes to fade out
// where krathongs may wander: u = sideways (fraction of screen width), d = ln(depth)
const U_MAX = 0.4;
const D_MIN = Math.log(1.25), D_MAX = Math.log(6.5);
const SPEED = 0.03;      // wander speed in (u, d) units per second

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
  const r = new AsciiRenderer(card.querySelector('canvas'), { cellW: 4, cellH: 6.5, glow: 0.7, useBlur: false, maxDpr: 1.5, bg: '#020306' });
  previews.push({ card, r, design: d, visible: true });
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
/**
 * @param scatter  true for krathongs that were already on the river when the page
 *                 opened: drop them anywhere instead of having them all enter at once
 */
function spawnKrathong(item, { own = false, age = 0, scatter = false } = {}) {
  if (state.krathongs.some((k) => k.id === item.id)) return null;
  const side = Math.random() < 0.5 ? -1 : 1;
  let u, d;
  if (own) { u = 0; d = Math.log(0.95); }                       // right in front of you
  else if (scatter) { u = (Math.random() * 2 - 1) * U_MAX * 0.9; d = D_MIN + Math.random() * (D_MAX - D_MIN); }
  else { u = side * (0.25 + Math.random() * 0.3); d = Math.log(1.4 + Math.random() * 1.6); }
  // head off in a random direction (own one goes out into the river first)
  const heading = own ? Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
  const k = {
    id: item.id,
    name: item.name,
    wish: item.wish || '',
    design: DESIGNS[item.design] ? item.design : 0,
    born: state.t - age,
    shown: state.t,           // when it appeared on this screen (for the fade-in)
    order: item.ts || Date.now(),
    own,
    u, d, heading,
    turn: (Math.random() - 0.5) * 0.3,
    seed: Math.random() * 100,
    retire: null,             // time it started drifting away
  };
  state.krathongs.push(k);
  // too many on the water → the oldest ones start drifting off, in order
  const staying = state.krathongs.filter((x) => x.retire === null).sort((a, b) => a.order - b.order);
  for (let i = 0; i < staying.length - MAX_ON_WATER; i++) staying[i].retire = state.t;
  return k;
}

/** wander + keep apart from each other + stay on the visible water */
function moveKrathongs(dt, t) {
  const list = state.krathongs;
  for (const k of list) {
    if (k.retire !== null) {
      // leaving: glide away towards the horizon, faster and faster
      const a = t - k.retire;
      k.d += dt * (0.04 + a * 0.012);
      k.u *= 1 - dt * 0.03;
      continue;
    }
    // slowly changing heading
    k.turn += (Math.random() - 0.5) * dt * 0.6;
    k.turn = Math.max(-0.35, Math.min(0.35, k.turn));
    k.heading += k.turn * dt;
    let vu = Math.cos(k.heading) * SPEED;
    let vd = Math.sin(k.heading) * SPEED;

    // push away from neighbours so they spread out over the whole river
    for (const o of list) {
      if (o === k || o.retire !== null) continue;
      const du = k.u - o.u, dd = (k.d - o.d) * 0.7;
      const dist2 = du * du + dd * dd;
      if (dist2 > 0.09 || dist2 === 0) continue;
      const f = (0.09 - dist2) / 0.09 * 0.08 / Math.sqrt(dist2);
      vu += du * f; vd += dd * f;
    }
    // soft walls
    if (k.u > U_MAX) vu -= (k.u - U_MAX) * 0.6;
    if (k.u < -U_MAX) vu -= (k.u + U_MAX) * 0.6;
    if (k.d < D_MIN) vd += (D_MIN - k.d) * 0.5;
    if (k.d > D_MAX) vd -= (k.d - D_MAX) * 0.6;

    k.u += vu * dt;
    k.d += vd * dt;
    // steer the heading along with where the walls/neighbours push it
    const want = Math.atan2(vd, vu);
    let diff = want - k.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    k.heading += diff * Math.min(1, dt * 0.8);
  }
}

/** world → screen. z = distance (1 = right at the front). */
function place(k, t) {
  const z = Math.exp(k.d);
  const { w, h, horizon, unit } = scene;
  const bob = Math.sin((t - k.born) * 0.25 + k.seed) * 0.02;
  const x = w / 2 + (k.u + bob) * w;
  const y = horizon + ((h - horizon) * 0.94) / z;
  const s = (unit * 1.15) / z;
  const fadeIn = Math.min(1, (t - k.shown) / 0.8);
  const fadeOut = k.retire === null ? 1 : Math.max(0, 1 - (t - k.retire) / RETIRE_TIME);
  return { x, y, s, z, alpha: fadeIn * fadeOut, done: fadeOut <= 0 };
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
  setPanel(false, ['✨ กระทงของ ', bold(name), ' กำลังลอยไป…'], 'ลอยอีกกระทง');
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

/* ---------------- open / close the picker ---------------- */
// Closed, a small bar at the bottom lets people just watch the river and reopen it.
// The choice is remembered, so someone who already floated one comes back to the view.
function setPanel(open, text = ['🪷 กำลังชมกระทงบนสายน้ำ'], button = 'ลอยกระทง ▴') {
  $('panel').classList.toggle('hidden', !open);
  $('after').classList.toggle('hidden', open);
  $('collapse').setAttribute('aria-expanded', String(open));
  if (!open) {
    $('afterText').replaceChildren(...text);
    $('again').textContent = button;
  }
  localStorage.setItem('krathong:panel', open ? 'open' : 'closed');
}
$('again').addEventListener('click', () => setPanel(true));
$('collapse').addEventListener('click', () => setPanel(false));
if (localStorage.getItem('krathong:panel') === 'closed') {
  // start closed without the slide-away animation
  const els = [$('panel'), $('after')];
  els.forEach((el) => { el.style.transition = 'none'; });
  setPanel(false);
  requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => { el.style.transition = ''; })));
}


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
      const k = spawnKrathong(item, { age: Math.max(0, (now - item.ts) / 1000), scatter: first });
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
  const q = TIERS[tier];
  [renderer.cellW, renderer.cellH] = w < 700 ? q.small : q.cell;
  renderer.resize(w, h);
  scene.resize(w, h);
  fireworks.resize(w, h, scene.horizon, scene.unit);
  resizePreviews();
}
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });
applyTier();
resize();

// only animate the preview cards that are actually on screen (mobile scrolls them)
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const p = previews.find((x) => x.card === e.target);
      if (p) p.visible = e.isIntersecting;
    }
  }, { root: $('designs'), threshold: 0.05 });
  previews.forEach((p) => io.observe(p.card));
}

/* ---------------- drawing ---------------- */
function drawRings(ctx, t) {
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    const age = t - r.born;
    if (r.wake) {
      // small ring left behind a drifting krathong
      if (age > 2.4) { state.rings.splice(i, 1); continue; }
      const R = (70 + age * 85) * r.s;
      ctx.strokeStyle = `rgba(140,215,240,${0.4 * r.a * (1 - age / 2.4)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + 4 * r.s, R, R * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
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

/** V-shaped wake trailing behind a moving krathong, whichever way it is heading */
function drawWake(ctx, pos, t, k) {
  const s = pos.s, seed = k.seed;
  // direction of travel on the water plane (x = sideways, z = away from viewer)
  const fx = k.retire === null ? Math.cos(k.heading) : 0;
  const fz = k.retire === null ? Math.sin(k.heading) : 1;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const shimmer = 0.6 + 0.4 * Math.sin(t * 3 + seed + i * 1.3);
    const len = 1 - i * 0.18;
    ctx.strokeStyle = `rgba(150,220,245,${0.32 * pos.alpha * shimmer * len})`;
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      // water-plane offsets (sideways along n, backwards along -f) → screen
      const a1 = side * (60 + i * 30), b1 = (10 + i * 14) / 0.35;
      const a2 = a1 + side * 55 * len, b2 = b1 + 12 / 0.35;
      const sx = (a, b) => pos.x + (a * fz - b * fx) * s;
      const sy = (a, b) => pos.y - (-a * fx - b * fz) * 0.35 * s;
      ctx.beginPath();
      ctx.moveTo(sx(a1, b1), sy(a1, b1));
      ctx.lineTo(sx(a2, b2), sy(a2, b2));
      ctx.stroke();
    }
  }
  ctx.restore();
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
    ctx.shadowBlur = TIERS[tier].shadow;
    ctx.fillStyle = k.own ? '#ffd98a' : '#fff1dc';
    ctx.fillText(k.name, pos.x, top);
    if (k.wish && rel > 0.3) {
      ctx.font = `300 ${Math.max(10, size * 0.62)}px Mitr, sans-serif`;
      ctx.shadowBlur = TIERS[tier].shadow * 0.6;
      ctx.fillStyle = 'rgba(255,236,210,0.85)';
      ctx.fillText(`“${k.wish}”`, pos.x, top + size * 0.95);
    }
  }
  ctx.restore();
}

/* ---------------- main loop ---------------- */
let last = performance.now();
let previewTurn = 0;
let panelTop = innerHeight;
function frame(now) {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(0.05, rawDt);
  last = now;
  watchPerformance(rawDt, now);
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
  if (panelOpen && (state.frame = (state.frame || 0) + 1) % 15 === 1) panelTop = panel.getBoundingClientRect().top;

  moveKrathongs(dt, t);

  // compute positions, drop finished ones, sort far → near
  const list = [];
  state.krathongs = state.krathongs.filter((k) => {
    const pos = place(k, t);
    if (pos.done) return false;
    list.push({ k, pos });
    return true;
  });
  list.sort((a, b) => b.pos.z - a.pos.z);

  // every krathong leaves a little ring on the water as it drifts
  for (const { k, pos } of list) {
    if (pos.alpha < 0.3 || pos.s / scene.unit < 0.08) continue;
    if (t - (k.lastWake ?? -Infinity) > 0.75) {
      k.lastWake = t;
      state.rings.push({ x: pos.x, y: pos.y, born: t, s: pos.s, a: pos.alpha, wake: true });
    }
  }

  renderer.render(
    (ctx, w, h) => {
      scene.drawSky(ctx, t);
      fireworks.draw(ctx);
      scene.drawLand(ctx, t);
      scene.drawWater(ctx, t);
      fireworks.drawReflection(ctx);
      drawRings(ctx, t);
      for (const { k, pos } of list) {
        drawWake(ctx, pos, t, k);
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

  // previews: a couple of cards per frame, round-robin, visible ones only
  if (panelOpen) {
    for (let n = 0, tries = 0; n < TIERS[tier].previews && tries < previews.length; tries++) {
      previewTurn = (previewTurn + 1) % previews.length;
      const p = previews[previewTurn];
      if (!p.visible) continue;
      drawPreview(p, t, previewTurn);
      n++;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.fonts?.ready.then(resize);

