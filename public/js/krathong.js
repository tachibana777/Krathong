// The five krathong designs. Each draws itself in local units:
// origin = centre of the waterline, body ≈ 200 units wide, up is −y.

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

function glow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prev;
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
    name: 'ใบตองนมแมว',
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
