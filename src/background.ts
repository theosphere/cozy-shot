// Ambient scene dressing: the dusk-dungeon gradient with a warm glow
// anchored on the bow, drifting embers, and world-fixed wall torches
// along the flight corridor. The torches are what actually sells "this is
// scrolling" — the gradient itself is cheap screen-space atmosphere that
// doesn't move with the camera, so without something world-fixed sliding
// past, a long flight would read as the arrow just sitting still.
import { W, H, ctx, rgbStr, mixColor, drawFilledCircle } from './render';
import { BG_TOP, BG_BOTTOM, GLOW, WOOD_DARK, EMBER_HOT, EMBER_MID, EMBER_COOL } from './palette';
import { BOW_CENTER_X, BOW_Y } from './bow';

interface AmbientEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  maxAge: number;
  hot: boolean;
}
const ambientEmbers: AmbientEmber[] = [];
for (let i = 0; i < 14; i++) {
  ambientEmbers.push({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 4,
    vy: -6 - Math.random() * 10,
    r: 0.6 + Math.random() * 1.2,
    age: Math.random() * 4,
    maxAge: 3 + Math.random() * 3,
    hot: Math.random() < 0.5,
  });
}

// The dithered top->bottom gradient never changes frame to frame (nothing
// it depends on — BG_TOP/BG_BOTTOM/x/y — is dynamic), so it's baked once
// onto an offscreen canvas instead of being re-stamped with ~86,000
// individual ctx.fillRect calls every frame: at 60fps that was ~5M canvas
// draw calls a second just for the background, the single biggest cost in
// the whole game and the main reason it was running hot on phones. Each
// frame now blits that baked canvas with one drawImage (GPU-composited,
// unlike a same-size putImageData round-trip, which measured *worse* here
// — Chrome already batches plain fillRect sequences reasonably well, so
// putImageData's full pixel-buffer upload lost more than it saved). The
// glow is a radial gradient fill instead of per-pixel dithering — same
// idea, trading pixel-perfect dither on this one soft highlight for a
// single hardware-accelerated fill.
let baseGradientCanvas: HTMLCanvasElement | null = null;
function buildBaseGradientCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const c2d = c.getContext('2d')!;
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      c2d.fillStyle = rgbStr(mixColor(BG_TOP, BG_BOTTOM, x, y, t));
      c2d.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

const GLOW_RADIUS = 130;
const GLOW_Y_SCALE = 0.7; // matches the old per-pixel falloff's gdy*0.7 term

export function drawBackground(dt: number, glowScreenY: number) {
  if (!baseGradientCanvas) baseGradientCanvas = buildBaseGradientCanvas();
  ctx.drawImage(baseGradientCanvas, 0, 0);

  ctx.save();
  ctx.translate(BOW_CENTER_X, glowScreenY);
  ctx.scale(1, 1 / GLOW_Y_SCALE);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, GLOW_RADIUS);
  grad.addColorStop(0, `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0.5)`);
  grad.addColorStop(1, `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(-GLOW_RADIUS, -GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2);
  ctx.restore();

  for (const e of ambientEmbers) {
    e.age += dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.age > e.maxAge || e.y < -4) {
      e.x = Math.random() * W;
      e.y = H + Math.random() * 20;
      e.vx = (Math.random() - 0.5) * 4;
      e.vy = -6 - Math.random() * 10;
      e.age = 0;
      e.maxAge = 3 + Math.random() * 3;
      e.hot = Math.random() < 0.5;
    }
    const fade = 1 - e.age / e.maxAge;
    if (fade <= 0) continue;
    drawFilledCircle(e.x, e.y, e.r * Math.max(0.2, fade), e.hot ? EMBER_MID : EMBER_COOL);
  }
}

const TORCH_SPACING = H / 2;
export function drawTorches(camY: number, time: number, worldTravel: number) {
  const torchCount = Math.floor(worldTravel / TORCH_SPACING);
  for (let i = 1; i <= torchCount; i++) {
    const worldY = BOW_Y - i * TORCH_SPACING;
    const y = worldY - camY;
    if (y < -20 || y > H + 20) continue;
    for (const side of [-1, 1]) {
      const x = BOW_CENTER_X + side * (W / 2 - 12);
      ctx.fillStyle = rgbStr(WOOD_DARK);
      ctx.fillRect(Math.round(x - 1), Math.round(y - 4), 3, 9);
      const flick = 0.6 + 0.4 * Math.sin(time * 9 + i * 2 + side);
      drawFilledCircle(x, y - 7, 2.4, EMBER_COOL);
      drawFilledCircle(x, y - 8 - flick, 1.5 + flick * 0.6, EMBER_MID);
      drawFilledCircle(x, y - 9 - flick, 0.7, EMBER_HOT);
    }
  }
}
