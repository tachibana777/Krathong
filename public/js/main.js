import { AsciiRenderer } from './ascii.js';
import { Scene } from './scene.js';

const canvas = document.getElementById('scene');
const renderer = new AsciiRenderer(canvas);
const scene = new Scene();

function resize() {
  const w = innerWidth, h = innerHeight;
  if (w < 700) { renderer.cellW = 6; renderer.cellH = 10; } else { renderer.cellW = 8; renderer.cellH = 13; }
  renderer.resize(w, h);
  scene.resize(w, h);
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  scene.update(dt);
  renderer.render((ctx) => {
    scene.drawSky(ctx, t);
    scene.drawLand(ctx, t);
    scene.drawWater(ctx, t);
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
