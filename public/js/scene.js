// Night scene: sky, stars, moon, sky lanterns, temples, river.
// Everything is drawn in screen px; the ASCII renderer does the rest.

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export class Scene {
  constructor() {
    this.stars = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.pow(Math.random(), 1.3) * 0.9,
      r: rand(2, 5), p: rand(0, TAU), s: rand(0.6, 2.2), warm: Math.random() < 0.3,
    }));
    this.lanterns = Array.from({ length: 16 }, () => this.newLantern(true));
    this.ripples = Array.from({ length: 170 }, () => ({
      x: Math.random(), d: Math.random(), len: rand(0.02, 0.09), sp: rand(0.002, 0.01), p: rand(0, TAU),
    }));
    this.farLights = Array.from({ length: 28 }, () => ({
      x: Math.random(), d: rand(0.0, 0.12), sp: rand(-0.004, 0.004), p: rand(0, TAU),
    }));
  }

  newLantern(initial) {
    return { x: Math.random(), y: initial ? rand(0.05, 0.6) : rand(0.55, 0.65), sp: rand(0.006, 0.018), sw: rand(0, TAU), s: rand(0.6, 1.3) };
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.horizon = Math.round(h * 0.52);
    this.unit = Math.min(w / 1400, h / 850);
    this.moon = { x: w * 0.8, y: h * 0.14, r: Math.max(38, Math.min(w, h) * 0.085) };
  }

  /** depth 0 = near (bottom of screen) … 1 = horizon */
  waterY(d) { return this.h - (this.h - this.horizon) * d; }

  /** perspective size of a krathong sitting at screen y */
  scaleAt(y) {
    const k = Math.max(0, (y - this.horizon) / (this.h - this.horizon));
    return this.unit * (0.06 + 1.1 * k);
  }

  update(dt) {
    for (let i = 0; i < this.lanterns.length; i++) {
      const l = this.lanterns[i];
      l.y -= l.sp * dt;
      l.sw += dt;
      if (l.y < -0.05) this.lanterns[i] = this.newLantern(false);
    }
    for (const f of this.farLights) { f.x += f.sp * dt; if (f.x < -0.02) f.x = 1.02; if (f.x > 1.02) f.x = -0.02; }
  }

  drawSky(ctx, t) {
    const { w, h, horizon } = this;
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, '#04050f');
    g.addColorStop(0.6, '#0b0f24');
    g.addColorStop(1, '#2a1a22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon);

    // stars
    for (const s of this.stars) {
      const tw = 0.45 + 0.55 * Math.sin(t * s.s + s.p) ** 2;
      ctx.fillStyle = s.warm ? `rgba(255,214,150,${tw})` : `rgba(200,220,255,${tw})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * horizon, s.r, 0, TAU);
      ctx.fill();
    }

    // moon + halo
    const m = this.moon;
    const halo = ctx.createRadialGradient(m.x, m.y, m.r * 0.9, m.x, m.y, m.r * 2.6);
    halo.addColorStop(0, 'rgba(255,220,150,0.3)');
    halo.addColorStop(0.35, 'rgba(255,210,140,0.09)');
    halo.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 2.6, 0, TAU); ctx.fill();
    const disk = ctx.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.1, m.x, m.y, m.r);
    disk.addColorStop(0, '#fff6dc');
    disk.addColorStop(1, '#f2c46e');
    ctx.fillStyle = disk;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,110,50,0.35)';
    for (const [cx, cy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.05, 0.4, 0.14], [0.35, -0.35, 0.1]]) {
      ctx.beginPath(); ctx.arc(m.x + cx * m.r, m.y + cy * m.r, cr * m.r, 0, TAU); ctx.fill();
    }

    // sky lanterns (khom loi)
    for (const l of this.lanterns) {
      const x = l.x * w + Math.sin(l.sw * 0.7) * 14, y = l.y * h, s = l.s * 6 * Math.max(0.7, this.unit);
      const lg = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
      lg.addColorStop(0, 'rgba(255,170,60,0.9)');
      lg.addColorStop(0.3, 'rgba(255,120,30,0.35)');
      lg.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - s * 4, y - s * 4, s * 8, s * 8);
      ctx.fillStyle = '#ffd28a';
      ctx.fillRect(x - s * 0.6, y - s, s * 1.2, s * 1.6);
    }
  }

  drawLand(ctx, t) {
    const { w, h, horizon } = this;
    const u = Math.max(0.55, this.unit);
    // tree line
    ctx.fillStyle = '#0d1a14';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= w + 20; x += 20) {
      const y = horizon - 18 * u - 10 * u * Math.sin(x * 0.013) - 8 * u * Math.sin(x * 0.041 + 1);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizon);
    ctx.fill();

    const H = h * 0.24;
    const flick = 0.85 + 0.15 * Math.sin(t * 3.1) * Math.sin(t * 1.7);
    chedi(ctx, w * 0.05, horizon, H * 0.9, flick);
    hall(ctx, w * 0.2, horizon, H * 1.25, H * 0.95, flick);
    chedi(ctx, w * 0.36, horizon, H * 0.55, flick);
    chedi(ctx, w * 0.64, horizon, H * 0.6, flick);
    chedi(ctx, w * 0.75, horizon, H * 1.25, flick);
    hall(ctx, w * 0.92, horizon, H * 1.0, H * 0.8, flick);
  }

  drawWater(ctx, t) {
    const { w, h, horizon } = this;
    const g = ctx.createLinearGradient(0, horizon, 0, h);
    g.addColorStop(0, '#0b2129');
    g.addColorStop(0.3, '#06141a');
    g.addColorStop(1, '#020507');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, w, h - horizon);

    // warm glow of temple lights on the far water
    const wg = ctx.createLinearGradient(0, horizon, 0, horizon + (h - horizon) * 0.25);
    wg.addColorStop(0, 'rgba(255,150,60,0.14)');
    wg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, horizon, w, (h - horizon) * 0.25);

    // ripples
    ctx.lineCap = 'round';
    for (const r of this.ripples) {
      const d = r.d;
      const y = this.waterY(1 - d) + Math.sin(t * 0.8 + r.p) * 2;
      const x = ((r.x + t * r.sp) % 1.1 - 0.05) * w;
      const a = 0.08 + 0.3 * d * d * (0.5 + 0.5 * Math.sin(t * 1.5 + r.p));
      ctx.strokeStyle = `rgba(90,190,200,${a})`;
      ctx.lineWidth = 2 + 5 * d;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + r.len * w * (0.4 + d), y);
      ctx.stroke();
    }

    // moon reflection
    const m = this.moon;
    for (let i = 0; i < 46; i++) {
      const d = i / 46;
      const y = horizon + d * (h - horizon) * 0.95;
      const wob = Math.sin(t * 1.6 + i * 0.9) * (6 + 18 * d);
      const ww = m.r * (0.5 + 1.2 * d) * (0.6 + 0.4 * Math.sin(t * 2 + i * 1.7));
      ctx.strokeStyle = `rgba(255,226,160,${0.5 * (1 - d * 0.7)})`;
      ctx.lineWidth = 3 + 4 * d;
      ctx.beginPath();
      ctx.moveTo(m.x - ww / 2 + wob, y);
      ctx.lineTo(m.x + ww / 2 + wob, y);
      ctx.stroke();
    }

    // far away krathongs near the horizon
    for (const f of this.farLights) {
      const x = f.x * w, y = this.waterY(1 - f.d) + 3;
      const a = 0.6 + 0.4 * Math.sin(t * 4 + f.p);
      const lg = ctx.createRadialGradient(x, y, 0, x, y, 14);
      lg.addColorStop(0, `rgba(255,190,90,${a})`);
      lg.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.fillStyle = `rgba(255,180,80,${a * 0.35})`;
      ctx.fillRect(x - 1.5, y + 4, 3, 16);
    }
  }
}

function litFill(ctx, top, bottom, flick) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#1d1009');
  g.addColorStop(1, `rgb(${(120 * flick) | 0},${(58 * flick) | 0},18)`);
  return g;
}

function chedi(ctx, cx, by, H, flick) {
  const w = H * 0.42;
  ctx.beginPath();
  ctx.rect(cx - w * 0.6, by - H * 0.07, w * 1.2, H * 0.07);
  ctx.rect(cx - w * 0.5, by - H * 0.13, w, H * 0.06);
  ctx.moveTo(cx - w * 0.44, by - H * 0.13);
  ctx.bezierCurveTo(cx - w * 0.48, by - H * 0.4, cx - w * 0.2, by - H * 0.46, cx - w * 0.09, by - H * 0.52);
  ctx.lineTo(cx - w * 0.015, by - H);
  ctx.lineTo(cx + w * 0.015, by - H);
  ctx.lineTo(cx + w * 0.09, by - H * 0.52);
  ctx.bezierCurveTo(cx + w * 0.2, by - H * 0.46, cx + w * 0.48, by - H * 0.4, cx + w * 0.44, by - H * 0.13);
  ctx.closePath();
  ctx.fillStyle = litFill(ctx, by - H, by, flick);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,${(150 * flick) | 0},60,0.8)`;
  ctx.lineWidth = 3;
  ctx.stroke();
  // rings on the spire
  ctx.strokeStyle = 'rgba(255,190,90,0.6)';
  for (let i = 0; i < 5; i++) {
    const y = by - H * (0.56 + i * 0.07), hw = w * (0.08 - i * 0.012);
    ctx.beginPath(); ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.stroke();
  }
}

function hall(ctx, cx, by, W, H, flick) {
  const bodyTop = by - H * 0.42;
  ctx.fillStyle = litFill(ctx, bodyTop, by, flick);
  ctx.fillRect(cx - W * 0.42, bodyTop, W * 0.84, H * 0.42);
  // windows
  ctx.fillStyle = `rgba(255,${(200 * flick) | 0},90,0.95)`;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = cx - W * 0.34 + (i * W * 0.68) / (n - 1);
    ctx.fillRect(x - W * 0.025, bodyTop + H * 0.12, W * 0.05, H * 0.14);
  }
  // three tiers of roof
  for (let i = 0; i < 3; i++) {
    const ww = W * (1.05 - i * 0.24);
    const base = bodyTop - i * H * 0.1;
    const peak = base - H * (0.34 - i * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx - ww / 2, base);
    ctx.lineTo(cx - ww * 0.1, peak);
    ctx.lineTo(cx + ww * 0.1, peak);
    ctx.lineTo(cx + ww / 2, base);
    ctx.closePath();
    ctx.fillStyle = litFill(ctx, peak, base, flick * 0.8);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,${(160 * flick) | 0},60,0.85)`;
    ctx.lineWidth = 3;
    ctx.stroke();
    // chofa (horn ornament)
    ctx.beginPath();
    ctx.moveTo(cx + ww * 0.1, peak);
    ctx.quadraticCurveTo(cx + ww * 0.16, peak - H * 0.1, cx + ww * 0.1, peak - H * 0.12);
    ctx.moveTo(cx - ww * 0.1, peak);
    ctx.quadraticCurveTo(cx - ww * 0.16, peak - H * 0.1, cx - ww * 0.1, peak - H * 0.12);
    ctx.stroke();
  }
}
