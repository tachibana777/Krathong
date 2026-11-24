// Cached radial-glow sprites: one small canvas per colour, reused every frame
// instead of building a new gradient for every light, every frame.

const cache = new Map();
const SIZE = 64;

function sprite(rgb) {
  let c = cache.get(rgb);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(0.35, `rgba(${rgb},0.35)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, SIZE, SIZE);
    cache.set(rgb, c);
  }
  return c;
}

/** additive glow of radius r at (x, y); rgb like '255,170,60' */
export function glow(ctx, x, y, r, rgb, a = 1) {
  if (a <= 0 || r <= 0) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, a);
  ctx.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevA;
}
