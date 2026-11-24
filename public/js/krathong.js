// The five krathong designs. Each draws itself in local units:
// origin = centre of the waterline, body ≈ 200 units wide, up is −y.

import { glow } from './glow.js';

const TAU = Math.PI * 2;

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** pointed petal standing on (0,0), pointing to (0,-len); caller rotates */
function petal(ctx, len, width, base, tip, edge) {
  ctx.beginPath();
  ctx.moveTo(-width * 0.18, 0);
  ctx.bezierCurveTo(-width * 0.75, -len * 0.35, -width * 0.45, -len * 0.8, 0, -len);
  ctx.bezierCurveTo(width * 0.45, -len * 0.8, width * 0.75, -len * 0.35, width * 0.18, 0);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, 0, 0, -len, [base, tip]);
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function petalRing(ctx, cx, cy, n, spread, len, width, base, tip, edge) {
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1);
    ctx.save();
    ctx.translate(cx + Math.sin(a) * width * 0.35, cy);
    ctx.rotate(a);
    petal(ctx, len * (1 - Math.abs(a) * 0.12), width, base, tip, edge);
    ctx.restore();
  }
}

/** green banana-leaf bowl that every krathong sits on */
function leafBowl(ctx, rx, top, light = '#3f9a48', dark = '#14421f') {
  ctx.beginPath();
  ctx.moveTo(-rx, top);
  ctx.quadraticCurveTo(-rx * 0.98, 6, 0, 8);
  ctx.quadraticCurveTo(rx * 0.98, 6, rx, top);
  ctx.quadraticCurveTo(0, top + 12, -rx, top);
  ctx.fillStyle = grad(ctx, 0, top, 0, 8, [light, dark]);
  ctx.fill();
  // zig-zag folded leaf rim
  ctx.fillStyle = light;
  for (let i = 0; i <= 12; i++) {
    const x = -rx + (2 * rx * i) / 12;
    ctx.beginPath();
    ctx.moveTo(x - 9, top + 4);
    ctx.lineTo(x, top - 16);
    ctx.lineTo(x + 9, top + 4);
    ctx.fill();
  }
}

function candle(ctx, x, y, h, t, seed) {
  ctx.fillStyle = grad(ctx, x - 6, 0, x + 6, 0, ['#d9c9a0', '#fff6dc', '#c9b080']);
  ctx.fillRect(x - 6, y - h, 12, h);
  const f = 1 + 0.18 * Math.sin(t * 13 + seed) + 0.1 * Math.sin(t * 23 + seed * 2);
  const sway = Math.sin(t * 5 + seed) * 2.5;
  const fy = y - h;
  glow(ctx, x, fy - 14, 110, '255,170,70', 0.55);
  ctx.beginPath();
  ctx.moveTo(x - 7, fy - 4);
  ctx.quadraticCurveTo(x - 9, fy - 20 * f, x + sway, fy - 34 * f);
  ctx.quadraticCurveTo(x + 9, fy - 20 * f, x + 7, fy - 4);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, fy, 0, fy - 34 * f, ['#ff7a1a', '#ffd36b', '#fff8e0']);
  ctx.fill();
  glow(ctx, x, fy - 12, 26, '255,240,200', 0.9);
}

function incense(ctx, x, y, angle, len, t, seed) {
  const tx = x + Math.sin(angle) * len, ty = y - Math.cos(angle) * len;
  ctx.strokeStyle = '#9a5a32';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
  glow(ctx, tx, ty, 16, '255,80,40', 0.7 + 0.3 * Math.sin(t * 6 + seed));
}

function marigold(ctx, x, y, r, hue = 32) {
  circle(ctx, x, y, r, `hsl(${hue},100%,42%)`);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    circle(ctx, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.42, `hsl(${hue + 6},100%,55%)`);
  }
  circle(ctx, x, y, r * 0.45, `hsl(${hue + 12},100%,64%)`);
}

function jasmine(ctx, x, y, r) {
  circle(ctx, x, y, r, '#fffbea');
  circle(ctx, x, y, r * 0.4, '#ffe9a8');
}

function orchid(ctx, x, y, r) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    circle(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, '#b44fd6');
  }
  circle(ctx, x, y, r * 0.35, '#ffe3ff');
}

function sakura(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate(rot + (i * TAU) / 5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.6, -r * 0.3, -r * 0.55, -r * 0.95, -r * 0.18, -r);
    ctx.lineTo(0, -r * 0.8);
    ctx.lineTo(r * 0.18, -r);
    ctx.bezierCurveTo(r * 0.55, -r * 0.95, r * 0.6, -r * 0.3, 0, 0);
    ctx.fillStyle = grad(ctx, 0, 0, 0, -r, ['#ff8fb4', '#ffd6e6', '#fff2f7']);
    ctx.fill();
    ctx.restore();
  }
  circle(ctx, 0, 0, r * 0.24, '#ff4f86');
  circle(ctx, 0, 0, r * 0.1, '#ffe38a');
  ctx.restore();
}

function hexagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62);
  }
  ctx.closePath();
}

function sunflower(ctx, x, y, r) {
  for (let i = 0; i < 20; i++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i / 20) * TAU);
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.25, r * 0.22, r * 0.55, 0, 0, TAU);
    ctx.fillStyle = i % 2 ? '#ffcf1f' : '#ffb000';
    ctx.fill();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#7a4a12');
  g.addColorStop(1, '#3a1f06');
  circle(ctx, x, y, r, g);
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, d = Math.sqrt(i / 40) * r * 0.9;
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.06, '#c98a2a');
  }
}

function candleAndIncense(ctx, y, t, seed, cx = 0) {
  incense(ctx, cx - 10, y, -0.32, 78, t, seed + 1);
  incense(ctx, cx, y, 0.04, 86, t, seed + 2);
  incense(ctx, cx + 10, y, 0.36, 76, t, seed + 3);
  candle(ctx, cx, y + 4, 48, t, seed);
}

export const DESIGNS = [
  {
    id: 'lotus',
    name: 'บัวหลวง',
    en: 'Royal Lotus',
    light: '255,120,180',
    draw(ctx, t, seed) {
      leafBowl(ctx, 100, -26);
      petalRing(ctx, 0, -26, 9, 1.25, 78, 44, '#b02a63', '#ff9cc6', 'rgba(255,190,220,0.7)');
      petalRing(ctx, 0, -30, 7, 0.82, 96, 40, '#d84586', '#ffc6de', 'rgba(255,220,235,0.7)');
      candleAndIncense(ctx, -64, t, seed);
      petalRing(ctx, 0, -32, 4, 0.36, 72, 34, '#ef6fa6', '#fff0f6', 'rgba(255,240,248,0.8)');
    },
  },
  {
    id: 'banana',
    name: 'กระทงใบตอง',
    en: 'Banana Leaf',
    light: '150,255,140',
    draw(ctx, t, seed) {
      // tall leaf body with vertical fold lines
      ctx.fillStyle = grad(ctx, 0, -64, 0, 8, ['#3faa4f', '#103d1c']);
      ctx.beginPath();
      ctx.moveTo(-96, -60); ctx.lineTo(96, -60);
      ctx.quadraticCurveTo(92, 6, 0, 8); ctx.quadraticCurveTo(-92, 6, -96, -60);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,230,140,0.5)'; ctx.lineWidth = 3;
      for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 20, -58); ctx.lineTo(i * 17, 2); ctx.stroke(); }
      // two rows of "nom maew" folded points
      for (let row = 0; row < 2; row++) {
        const n = 11 - row * 2, span = 92 - row * 18, base = -56 - row * 18;
        for (let i = 0; i < n; i++) {
          const x = -span + (2 * span * i) / (n - 1);
          ctx.fillStyle = (i + row) % 2 ? '#5cc26a' : '#2c8a3c';
          ctx.beginPath(); ctx.moveTo(x - 12, base + 6); ctx.lineTo(x, base - 30); ctx.lineTo(x + 12, base + 6); ctx.fill();
        }
      }
      // flower mound
      for (let i = -3; i <= 3; i++) marigold(ctx, i * 22, -84 - (3 - Math.abs(i)) * 4, 13, 36);
      for (let i = -5; i <= 5; i++) jasmine(ctx, i * 15, -70, 5);
      orchid(ctx, -40, -100, 14); orchid(ctx, 40, -100, 14);
      candleAndIncense(ctx, -104, t, seed);
      circle(ctx, 0, -100, 15, '#e0233c'); circle(ctx, 0, -100, 8, '#ff6f7f');
    },
  },
  {
    id: 'marigold',
    name: 'ดาวเรืองทอง',
    en: 'Golden Marigold',
    light: '255,180,40',
    draw(ctx, t, seed) {
      leafBowl(ctx, 96, -24, '#46a04c', '#163f1d');
      const rows = [[7, 84], [6, 70], [5, 56], [4, 42], [3, 28]];
      rows.forEach(([n, span], r) => {
        for (let i = 0; i < n; i++) {
          const x = n === 1 ? 0 : -span + (2 * span * i) / (n - 1);
          marigold(ctx, x, -36 - r * 21, 16, 28 + ((i + r) % 3) * 6);
        }
      });
      candleAndIncense(ctx, -136, t, seed);
      marigold(ctx, 0, -132, 14, 44);
    },
  },
  {
    id: 'bread',
    name: 'ขนมปังรักษ์โลก',
    en: 'Eco Bread',
    light: '255,200,120',
    draw(ctx, t, seed) {
      ctx.fillStyle = grad(ctx, 0, -70, 0, 8, ['#f4bf6f', '#b46a26', '#6a3612']);
      ctx.beginPath(); ctx.ellipse(0, -26, 98, 34, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,170,0.7)'; ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * 24, -30, 8, 18, 0.3, 0, Math.PI); ctx.stroke(); }
      petalRing(ctx, 0, -40, 8, 1.2, 66, 40, '#a35a1e', '#ffd99a', 'rgba(255,235,190,0.6)');
      petalRing(ctx, 0, -44, 5, 0.6, 70, 34, '#c47a33', '#ffe8bd', 'rgba(255,245,215,0.7)');
      // sugar sprinkles
      const cols = ['#ff6fa8', '#7dff9a', '#ffe66b', '#7ad8ff'];
      for (let i = 0; i < 26; i++) {
        const a = (i * 2.39996) % TAU, rr = 30 + (i * 37) % 60;
        circle(ctx, Math.cos(a) * rr, -26 + Math.sin(a) * rr * 0.3, 3.5, cols[i % 4]);
      }
      candleAndIncense(ctx, -76, t, seed);
    },
  },
  {
    id: 'swan',
    name: 'หงส์ทอง',
    en: 'Golden Swan',
    light: '255,230,150',
    draw(ctx, t, seed) {
      // body
      ctx.fillStyle = grad(ctx, 0, -80, 0, 8, ['#fffaf0', '#f1d99a', '#9a7a3a']);
      ctx.beginPath();
      ctx.moveTo(-104, -70);
      ctx.quadraticCurveTo(-80, -20, -30, -20);
      ctx.lineTo(70, -26);
      ctx.quadraticCurveTo(100, -30, 92, -8);
      ctx.quadraticCurveTo(40, 12, -60, 6);
      ctx.quadraticCurveTo(-100, -6, -104, -70);
      ctx.fill();
      // neck + head
      ctx.strokeStyle = grad(ctx, 0, -160, 0, -20, ['#ffffff', '#f3dfa6']);
      ctx.lineWidth = 15; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(66, -26);
      ctx.bezierCurveTo(100, -70, 30, -100, 56, -150);
      ctx.stroke();
      circle(ctx, 58, -156, 13, '#fffaf0');
      ctx.fillStyle = '#ff8a1e';
      ctx.beginPath(); ctx.moveTo(68, -160); ctx.lineTo(92, -150); ctx.lineTo(68, -149); ctx.fill();
      circle(ctx, 60, -159, 2.5, '#1a1208');
      // golden layered wing
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.translate(-10 + i * 6, -30);
        ctx.rotate(-1.1 + i * 0.2);
        petal(ctx, 90 - i * 8, 30, '#b8862b', i % 2 ? '#ffe9a8' : '#fff6d8', 'rgba(255,240,200,0.7)');
        ctx.restore();
      }
      candleAndIncense(ctx, -46, t, seed, -46);
    },
  },
  {
    id: 'sakura',
    name: 'ซากุระ',
    en: 'Sakura',
    light: '255,150,200',
    draw(ctx, t, seed) {
      leafBowl(ctx, 98, -24, '#3c8a48', '#123a1c');
      petalRing(ctx, 0, -26, 10, 1.3, 70, 40, '#e8679a', '#ffe0ec', 'rgba(255,225,238,0.7)');
      const spots = [[-62, -50, 18], [62, -50, 18], [-32, -70, 20], [32, -70, 20], [0, -56, 22], [-80, -34, 13], [80, -34, 13]];
      spots.forEach(([x, y, r], i) => sakura(ctx, x, y, r, i * 0.7));
      candleAndIncense(ctx, -82, t, seed);
      sakura(ctx, 0, -84, 16, 0.3);
      // a few petals drifting around it
      for (let i = 0; i < 4; i++) {
        const a = t * 0.6 + i * 1.57 + seed;
        sakura(ctx, Math.cos(a) * 115, -90 + Math.sin(a * 1.3) * 40, 7, a * 2);
      }
    },
  },
  {
    id: 'turtle',
    name: 'ขนมปังเต่า',
    en: 'Turtle Bread',
    light: '255,190,110',
    draw(ctx, t, seed) {
      const paddle = Math.sin(t * 2 + seed) * 0.25;
      ctx.fillStyle = '#9a5520';
      for (const [x, y, rot] of [[-62, -6, -0.5 - paddle], [58, -6, 0.5 + paddle], [-30, 2, -0.2 + paddle], [30, 2, 0.2 - paddle]]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 11, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // tail
      ctx.beginPath(); ctx.moveTo(-88, -26); ctx.lineTo(-112, -18); ctx.lineTo(-88, -14); ctx.fill();
      // head
      const hy = -32 + Math.sin(t * 1.2 + seed) * 3;
      circle(ctx, 100, hy, 22, grad(ctx, 0, hy - 22, 0, hy + 22, ['#e7a85e', '#9a5520']));
      circle(ctx, 108, hy - 6, 5, '#fff6e0');
      circle(ctx, 109, hy - 6, 3, '#1a0e05');
      ctx.strokeStyle = '#5a2c0c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(108, hy + 4, 7, 0.2, 1.4); ctx.stroke();
      // shell
      ctx.beginPath();
      ctx.moveTo(-94, -16);
      ctx.bezierCurveTo(-90, -96, 90, -96, 94, -16);
      ctx.quadraticCurveTo(0, 0, -94, -16);
      ctx.fillStyle = grad(ctx, 0, -92, 0, 0, ['#ffd28a', '#d0843a', '#7a3f14']);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,232,190,0.8)'; ctx.lineWidth = 3;
      for (const [x, y, r] of [[0, -56, 20], [-38, -46, 16], [38, -46, 16], [-66, -28, 11], [66, -28, 11], [0, -26, 13]]) {
        hexagon(ctx, x, y, r); ctx.stroke();
      }
      ctx.strokeStyle = '#6a3410'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-94, -16); ctx.quadraticCurveTo(0, 0, 94, -16); ctx.stroke();
      candleAndIncense(ctx, -76, t, seed);
    },
  },
  {
    id: 'koi',
    name: 'ปลาคาร์ปทอง',
    en: 'Lucky Koi',
    light: '255,140,70',
    draw(ctx, t, seed) {
      // lily pad
      ctx.fillStyle = grad(ctx, 0, -20, 0, 8, ['#4aa457', '#16441f']);
      ctx.beginPath(); ctx.ellipse(0, -6, 106, 22, 0, 0.25, TAU - 0.05); ctx.lineTo(0, -6); ctx.fill();
      const flick = Math.sin(t * 3 + seed) * 0.15;
      // tail fan
      ctx.save(); ctx.translate(-70, -40); ctx.rotate(flick);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-30, -40, -46, -52); ctx.quadraticCurveTo(-30, -20, -48, 10); ctx.quadraticCurveTo(-26, 2, 0, 0);
      ctx.fillStyle = grad(ctx, 0, -52, 0, 10, ['#ffd0a8', '#ff6a1f', '#ffb27a']);
      ctx.fill();
      ctx.restore();
      // fins
      ctx.fillStyle = 'rgba(255,170,110,0.9)';
      ctx.beginPath(); ctx.moveTo(30, -24); ctx.quadraticCurveTo(26, 0, 4, 4); ctx.quadraticCurveTo(14, -12, 10, -22); ctx.fill();
      // body
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-72, -42);
      ctx.bezierCurveTo(-30, -86, 50, -84, 88, -50);
      ctx.quadraticCurveTo(98, -32, 72, -24);
      ctx.bezierCurveTo(30, -14, -30, -20, -72, -36);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, -84, 0, -16, ['#fffdf6', '#f6ead6']);
      ctx.fill();
      ctx.clip();
      circle(ctx, -22, -60, 22, '#ff4d1a');
      circle(ctx, 36, -66, 16, '#ff6a1f');
      circle(ctx, 66, -44, 10, '#ff3c1a');
      circle(ctx, 8, -30, 9, '#1c1410');
      ctx.restore();
      circle(ctx, 78, -50, 4, '#1a0e05');
      ctx.strokeStyle = '#ffcf9a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(92, -34); ctx.quadraticCurveTo(104, -30, 110, -20); ctx.stroke();
      candleAndIncense(ctx, -78, t, seed, 8);
    },
  },
  {
    id: 'sunflower',
    name: 'ทานตะวัน',
    en: 'Sunflower',
    light: '255,210,60',
    draw(ctx, t, seed) {
      leafBowl(ctx, 100, -22, '#4aa04e', '#143c1b');
      sunflower(ctx, -70, -40, 16);
      sunflower(ctx, 70, -40, 16);
      sunflower(ctx, 0, -72, 32);
      candleAndIncense(ctx, -78, t, seed);
    },
  },
  {
    id: 'shell',
    name: 'เปลือกหอยมุก',
    en: 'Pearl Shell',
    light: '210,190,255',
    draw(ctx, t, seed) {
      const cx = 0, cy = -10, R = 112, n = 9;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.95;
        if (i === 0) { ctx.lineTo(x, y); continue; }
        const am = Math.PI + ((i - 0.5) / n) * Math.PI;
        ctx.quadraticCurveTo(cx + Math.cos(am) * R * 1.12, cy + Math.sin(am) * R * 1.07, x, y);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
      g.addColorStop(0, '#fff8fd');
      g.addColorStop(0.55, '#f4d2ea');
      g.addColorStop(1, '#a98be0');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
      for (let i = 1; i < n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.93); ctx.stroke();
      }
      // hinge
      ctx.fillStyle = '#c9a6e8';
      ctx.beginPath(); ctx.moveTo(-26, cy); ctx.lineTo(26, cy); ctx.lineTo(14, 6); ctx.lineTo(-14, 6); ctx.fill();
      candleAndIncense(ctx, -60, t, seed);
      // glowing pearl
      glow(ctx, 0, -18, 46, '230,220,255', 0.6 + 0.2 * Math.sin(t * 2 + seed));
      const pg = ctx.createRadialGradient(-5, -24, 2, 0, -18, 15);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, '#d8cdf0');
      circle(ctx, 0, -18, 15, pg);
    },
  },
];

/**
 * Draws a krathong floating on water at screen (x, y) with size `s`
 * (1 → 200 px wide). Adds a light pool and a reflection under it.
 */
export function drawKrathong(ctx, design, x, y, s, t, seed = 0, alpha = 1) {
  const bob = Math.sin(t * 1.4 + seed) * 3 * s;
  const tilt = Math.sin(t * 0.9 + seed * 1.7) * 0.05;
  ctx.save();
  ctx.globalAlpha = alpha;

  // light pool on the water
  ctx.save();
  ctx.translate(x, y + 6 * s);
  ctx.scale(1, 0.28);
  glow(ctx, 0, 0, 260 * s, design.light, 0.32);
  glow(ctx, 0, 0, 140 * s, '255,190,110', 0.45);
  ctx.restore();

  // reflection
  ctx.save();
  ctx.globalAlpha = alpha * 0.22;
  ctx.translate(x, y + bob * 0.3 + 6 * s);
  ctx.scale(s, -s * 0.55);
  ctx.rotate(-tilt);
  design.draw(ctx, t, seed);
  ctx.restore();

  ctx.translate(x, y + bob);
  ctx.scale(s, s);
  ctx.rotate(tilt);
  design.draw(ctx, t, seed);
  ctx.restore();
}
