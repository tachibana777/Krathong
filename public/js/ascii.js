// Glowing ASCII renderer.
// The scene is painted with the normal Canvas2D API onto a tiny offscreen canvas
// (one pixel per character cell). Each pixel is then turned into a glyph whose
// density follows brightness and whose colour follows the pixel colour.
// A blurred copy of the tiny canvas is laid underneath to fake bloom.

const RAMP_A = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '&', '@'];
const RAMP_B = [' ', '`', "'", '~', 'i', 'x', 'o', '8', '$', 'B', '@'];

// ctx.filter is slow or missing on many phones (and older Safari); test once.
const FILTER_OK = (() => {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.filter = 'blur(2px)';
    return c.filter === 'blur(2px)';
  } catch { return false; }
})();

export class AsciiRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.low = document.createElement('canvas');
    this.lctx = this.low.getContext('2d', { willReadFrequently: true });
    this.cellW = opts.cellW || 8;
    this.cellH = opts.cellH || 13;
    this.glow = opts.glow ?? 0.5;
    this.blur = opts.blur ?? 7;
    this.useBlur = (opts.useBlur ?? true) && FILTER_OK;
    this.maxDpr = opts.maxDpr ?? 2;
    this.bg = opts.bg || '#030509';
    this.threshold = opts.threshold ?? 0.04;
    this.fontFamily = opts.fontFamily || "'JetBrains Mono', 'Consolas', monospace";
  }

  setCell(cellW, cellH) {
    this.cellW = cellW;
    this.cellH = cellH;
    this.resize(this.w, this.h);
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cols = Math.ceil(w / this.cellW);
    this.rows = Math.ceil(h / this.cellH);
    this.low.width = this.cols;
    this.low.height = this.rows;
    this.font = `bold ${Math.round(this.cellH * 0.95)}px ${this.fontFamily}`;
  }

  /**
   * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw  paints the scene in screen px
   * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} [overlay] crisp drawing on top
   */
  render(draw, overlay) {
    const { lctx, ctx, cols, rows, cellW, cellH, dpr } = this;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, cols, rows);
    lctx.setTransform(1 / cellW, 0, 0, 1 / cellH, 0, 0);
    draw(lctx, this.w, this.h);

    const data = lctx.getImageData(0, 0, cols, rows).data;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    // bloom underlay
    if (this.glow > 0) {
      ctx.save();
      ctx.globalAlpha = this.glow;
      ctx.imageSmoothingEnabled = true;
      if (this.useBlur && FILTER_OK) ctx.filter = `blur(${this.blur}px)`;
      ctx.drawImage(this.low, 0, 0, cols * cellW, rows * cellH);
      ctx.restore();
    }

    ctx.font = this.font;
    ctx.textBaseline = 'top';
    let lastStyle = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        if (lum < this.threshold) continue;
        const level = Math.min(10, 1 + Math.floor(Math.pow(lum, 0.75) * 10));
        const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const ch = (hash & 4 ? RAMP_A : RAMP_B)[level];
        // normalise colour then scale by brightness so dim areas keep their hue
        const m = Math.max(r, g, b, 1);
        const k = (255 / m) * (0.14 + 0.86 * Math.pow(lum, 0.6));
        const style = `rgb(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0})`;
        if (style !== lastStyle) { ctx.fillStyle = style; lastStyle = style; }
        ctx.fillText(ch, x * cellW, y * cellH);
      }
    }

    if (overlay) overlay(ctx, this.w, this.h);
  }
}
