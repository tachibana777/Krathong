// GPU version of the glowing ASCII renderer.
// The scene is still painted with Canvas2D onto a tiny canvas (one pixel per cell),
// but turning pixels into tinted glyphs + bloom happens in a single fragment shader,
// so the cost no longer grows with the number of characters on screen.

// one calm, symbol-only ramp (no letters) so shapes read as pictures, not text;
// the second row only swaps in look-alike symbols to avoid a rigid grid pattern
const RAMP_A = [' ', '.', ':', '-', '=', '+', '*', '#', '#', '%', '@'];
const RAMP_B = [' ', '.', ':', '~', '=', '+', '*', '#', '#', '%', '@'];

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D uScene;
uniform sampler2D uAtlas;
uniform vec2 uGrid;      // cols, rows
uniform vec2 uCell;      // cell size in css px
uniform vec2 uRes;       // canvas size in device px
uniform float uDpr;
uniform float uGlow;
uniform float uFill;      // soft picture underneath the characters
uniform float uThreshold;
uniform vec3 uBg;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;   // css px, y down
  vec2 cellF = p / uCell;
  vec2 cell = floor(cellF);
  vec2 local = fract(cellF);
  vec2 span = uGrid;

  // bloom: a few bilinear taps around this pixel
  vec2 uv = cellF / span;
  vec2 o = 1.0 / span;
  vec3 base = texture2D(uScene, uv).rgb;
  vec3 bloom = base * 0.36;
  bloom += texture2D(uScene, uv + vec2( o.x * 1.5, 0.0)).rgb * 0.16;
  bloom += texture2D(uScene, uv + vec2(-o.x * 1.5, 0.0)).rgb * 0.16;
  bloom += texture2D(uScene, uv + vec2(0.0,  o.y * 1.2)).rgb * 0.16;
  bloom += texture2D(uScene, uv + vec2(0.0, -o.y * 1.2)).rgb * 0.16;

  // glyph for this cell
  vec3 c = texture2D(uScene, (cell + 0.5) / span).rgb;
  float lum = luma(c);
  float glyph = 0.0;
  vec3 tint = vec3(0.0);
  if (lum >= uThreshold) {
    float level = min(10.0, 1.0 + floor(pow(lum, 0.75) * 10.0));
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float row = h < 0.5 ? 0.0 : 1.0;
    vec2 auv = vec2((level + local.x) / 11.0, (row + local.y) / 2.0);
    glyph = texture2D(uAtlas, auv).a;
    float m = max(max(c.r, c.g), max(c.b, 0.004));
    tint = c / m * min(1.0, 0.22 + 0.9 * pow(lum, 0.62));
  }
  gl_FragColor = vec4(uBg + base * uFill + bloom * uGlow + tint * glyph, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export class GLAsciiRenderer {
  /** @param overlayCanvas 2D canvas stacked on top for crisp text */
  constructor(canvas, overlayCanvas, opts = {}) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    this.canvas = canvas;
    this.overlay = overlayCanvas;
    this.octx = overlayCanvas.getContext('2d');
    this.low = document.createElement('canvas');
    this.lctx = this.low.getContext('2d');
    this.atlas = document.createElement('canvas');
    this.cellW = opts.cellW || 8;
    this.cellH = opts.cellH || 13;
    this.glow = opts.glow ?? 0.5;
    this.fill = opts.fill ?? 0.3;
    this.maxDpr = opts.maxDpr ?? 2;
    this.threshold = opts.threshold ?? 0.04;
    this.fontFamily = opts.fontFamily || "'JetBrains Mono', 'Consolas', monospace";
    this.useBlur = false; // bloom is built into the shader

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.u = {};
    for (const n of ['uScene', 'uAtlas', 'uGrid', 'uCell', 'uRes', 'uDpr', 'uGlow', 'uFill', 'uThreshold', 'uBg']) this.u[n] = gl.getUniformLocation(prog, n);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.sceneTex = tex();
    this.atlasTex = tex();
    gl.uniform1i(this.u.uScene, 0);
    gl.uniform1i(this.u.uAtlas, 1);
    gl.uniform3f(this.u.uBg, 3 / 255, 5 / 255, 9 / 255);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.dpr = dpr;
    this.w = w; this.h = h;
    for (const c of [this.canvas, this.overlay]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = w + 'px';
      c.style.height = h + 'px';
    }
    this.cols = Math.ceil(w / this.cellW);
    this.rows = Math.ceil(h / this.cellH);
    this.low.width = this.cols;
    this.low.height = this.rows;
    this.buildAtlas();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.uGrid, this.cols, this.rows);
    gl.uniform2f(this.u.uCell, this.cellW, this.cellH);
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uDpr, dpr);
    gl.uniform1f(this.u.uThreshold, this.threshold);
  }

  buildAtlas() {
    const gw = Math.max(2, Math.round(this.cellW * this.dpr));
    const gh = Math.max(2, Math.round(this.cellH * this.dpr));
    this.atlas.width = gw * 11;
    this.atlas.height = gh * 2;
    const a = this.atlas.getContext('2d');
    a.clearRect(0, 0, this.atlas.width, this.atlas.height);
    a.fillStyle = '#fff';
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    a.font = `bold ${Math.round(this.cellH * 0.95 * this.dpr)}px ${this.fontFamily}`;
    [RAMP_A, RAMP_B].forEach((ramp, row) => ramp.forEach((ch, i) => a.fillText(ch, i * gw + gw / 2, row * gh + gh / 2 + 0.5)));
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas);
  }

  render(draw, overlay) {
    const { lctx, cols, rows, cellW, cellH, gl } = this;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, cols, rows);
    lctx.setTransform(1 / cellW, 0, 0, 1 / cellH, 0, 0);
    draw(lctx, this.w, this.h);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.low);
    gl.uniform1f(this.u.uGlow, this.glow);
    gl.uniform1f(this.u.uFill, this.fill);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const o = this.octx;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (overlay) {
      o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      overlay(o, this.w, this.h);
    }
  }
}
