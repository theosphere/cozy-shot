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

export function drawBackground(dt: number, glowScreenY: number) {
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      let color = mixColor(BG_TOP, BG_BOTTOM, x, y, t);
      const gdx = x - BOW_CENTER_X;
      const gdy = y - glowScreenY;
      const gd = Math.hypot(gdx, gdy * 0.7);
      const glowT = Math.max(0, 1 - gd / 130) * 0.5;
      if (glowT > 0.02) color = mixColor(color, GLOW, x, y, glowT);
      ctx.fillStyle = rgbStr(color);
      ctx.fillRect(x, y, 1, 1);
    }
  }
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
