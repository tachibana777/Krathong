import { AsciiRenderer } from './ascii.js';
import { Scene } from './scene.js';
import { DESIGNS, drawKrathong } from './krathong.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const renderer = new AsciiRenderer(canvas);
const scene = new Scene();

const state = {
  design: Number(localStorage.getItem('krathong:design')) || 0,
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

/* ---------------- layout ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 700) { renderer.cellW = 6; renderer.cellH = 10; } else { renderer.cellW = 8; renderer.cellH = 13; }
  renderer.resize(w, h);
  scene.resize(w, h);
  resizePreviews();
}
addEventListener('resize', resize);
resize();

/* ---------------- main loop ---------------- */
let last = performance.now();
let previewClock = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  scene.update(dt);

  const panel = $('panel');
  const panelOpen = !panel.classList.contains('hidden');
  const panelTop = panelOpen ? panel.getBoundingClientRect().top : innerHeight;

  renderer.render((ctx, w, h) => {
    scene.drawSky(ctx, t);
    scene.drawLand(ctx, t);
    scene.drawWater(ctx, t);
    if (panelOpen) {
      // the chosen krathong waits on the water just above the panel
      const y = Math.min(h * 0.93, panelTop - 14);
      const s = Math.max(scene.scaleAt(y), scene.unit * 0.5);
      if (y > scene.horizon + 60) drawKrathong(ctx, DESIGNS[state.design], w / 2, y, s, t, 7);
    }
  });

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
