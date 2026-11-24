// Fireworks: rockets climb from behind the temples, burst into particle shells.
// Drawn additively so overlapping sparks bloom into dense ASCII glyphs.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const TYPES = ['peony', 'peony', 'ring', 'willow', 'double', 'glitter', 'heart', 'chrysanthemum'];
const HUES = [0, 20, 42, 120, 160, 200, 280, 320, 340];

export class Fireworks {
  constructor() {
    this.rockets = [];
    this.particles = [];
    this.flashes = [];
    this.queue = [];
    this.time = 0;
  }

  resize(w, h, horizon, unit) {
    this.w = w; this.h = h; this.horizon = horizon; this.unit = Math.max(0.55, unit);
  }

  /** queue a show of `count` rockets spread over `duration` seconds */
  show(count = 8, duration = 6, opts = {}) {
    for (let i = 0; i < count; i++) {
      const delay = (duration * i) / count + rand(0, duration / count);
      this.queue.push({ at: this.time + delay, ...opts });
    }
  }

  launch({ x, height, hue, type } = {}) {
    const w = this.w, hz = this.horizon;
    const sx = x ?? rand(0.1, 0.9) * w;
    const ty = height ?? rand(0.1, 0.42) * hz;
    const g = 260 * this.unit;
    const y0 = hz - 20 * this.unit;
    this.rockets.push({
      x: sx, y: y0, vx: rand(-20, 20) * this.unit, vy: -Math.sqrt(2 * g * (y0 - ty)), g,
      hue: hue ?? pick(HUES), type: type ?? pick(TYPES),
    });
  }

  burst(r) {
    const u = this.unit;
    const add = (vx, vy, o = {}) => this.particles.push({
      x: r.x, y: r.y, vx, vy, life: 0, max: o.max ?? rand(1.3, 2.1), hue: o.hue ?? r.hue + rand(-12, 12),
      light: o.light ?? 62, drag: o.drag ?? 0.975, grav: (o.grav ?? 70) * u, size: o.size ?? 3.2, sparkle: !!o.sparkle,
    });
    const radial = (n, speed, o, jitter = 0.25) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.05, 0.05);
        const s = speed * u * (1 - jitter + Math.random() * jitter * 2);
        add(Math.cos(a) * s, Math.sin(a) * s, o);
      }
    };
    switch (r.type) {
      case 'ring': radial(72, 230, {}, 0.02); break;
      case 'willow': radial(90, 170, { hue: 40, light: 58, max: rand(2.6, 3.4), drag: 0.955, grav: 120, size: 3.5 }); break;
      case 'double': radial(90, 250, {}); radial(50, 120, { hue: r.hue + 150 }); break;
      case 'glitter': radial(110, 230, { sparkle: true, light: 75, max: rand(1.8, 2.5) }); break;
      case 'chrysanthemum': radial(130, 260, { size: 2.6, drag: 0.97 }, 0.45); break;
      case 'heart':
        for (let i = 0; i < 80; i++) {
          const a = (i / 80) * TAU;
          const hx = 16 * Math.sin(a) ** 3;
          const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
          add(hx * 13 * u, hy * 13 * u, { hue: 340, light: 66, grav: 30, drag: 0.968 });
        }
        break;
      default: // peony: filled sphere
        for (let i = 0; i < 100; i++) {
          const a = rand(0, TAU), s = Math.pow(Math.random(), 0.35) * 260 * u;
          add(Math.cos(a) * s, Math.sin(a) * s, { size: 3 });
        }
    }
    this.flashes.push({ x: r.x, y: r.y, life: 0, hue: r.hue });
  }

  update(dt) {
    this.time += dt;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].at <= this.time) { this.launch(this.queue[i]); this.queue.splice(i, 1); }
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vy += r.g * dt; r.x += r.vx * dt; r.y += r.vy * dt;
      if (Math.random() < 0.8) {
        this.particles.push({ x: r.x, y: r.y, vx: rand(-15, 15), vy: rand(10, 40), life: 0, max: 0.5, hue: 35, light: 70, drag: 0.94, grav: 40, size: 3, sparkle: true });
      }
      if (r.vy >= -20) { this.burst(r); this.rockets.splice(i, 1); }
    }
    const k = Math.pow(0.975, dt * 60);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      const drag = Math.pow(p.drag, dt * 60) || k;
      p.vx *= drag; p.vy = p.vy * drag + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life += dt;
      if (this.flashes[i].life > 0.45) this.flashes.splice(i, 1);
    }
  }

  get active() { return this.rockets.length + this.particles.length > 0; }

  draw(ctx, alphaMul = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const f of this.flashes) {
      const a = (1 - f.life / 0.45) * 0.3 * alphaMul, R = 150 * this.unit;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, `hsla(${f.hue},100%,80%,${a})`);
      g.addColorStop(1, `hsla(${f.hue},100%,50%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(f.x - R, f.y - R, R * 2, R * 2);
    }
    for (const r of this.rockets) {
      ctx.strokeStyle = `rgba(255,220,160,${alphaMul})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.vx * 0.05, r.y - r.vy * 0.05); ctx.stroke();
    }
    for (const p of this.particles) {
      if (p.sparkle && Math.random() < 0.35) continue;
      const fade = 1 - p.life / p.max;
      const a = Math.pow(fade, 0.7) * alphaMul;
      ctx.strokeStyle = `hsla(${p.hue},100%,${p.light + 20 * fade}%,${a})`;
      ctx.lineWidth = p.size * (0.5 + 0.6 * fade);
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.11, p.y - p.vy * 0.11);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** dim, squashed mirror image on the river */
  drawReflection(ctx) {
    const hz = this.horizon;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, hz, this.w, this.h - hz); ctx.clip();
    ctx.translate(0, hz);
    ctx.scale(1, -0.7);
    ctx.translate(0, -hz);
    this.draw(ctx, 0.3);
    ctx.restore();
  }
}
