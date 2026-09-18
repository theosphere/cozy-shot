// A one-off visual treat for clearing the final level: the target "pops"
// like a piñata — splits into two striped halves that fly apart — while
// confetti bursts outward and rains down. Purely decorative, no gameplay
// effect; triggered once from flight.ts when levels.recordShot reports
// 'complete'.
import { ctx, rgbStr, drawFilledCircle, lerpColor, type RGB } from './render';

const CONFETTI_COLORS: RGB[] = [
  [232, 84, 120], // pink
  [96, 200, 214], // teal
  [244, 196, 62], // yellow
  [156, 106, 224], // purple
  [110, 206, 96], // green
];
const PINATA_COLORS: RGB[] = CONFETTI_COLORS;

// --- Confetti burst ---------------------------------------------------------
interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  size: number;
  color: RGB;
}
const confetti: ConfettiPiece[] = [];

export function spawnConfetti(x: number, y: number) {
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 150;
    confetti.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 70, // biased upward, gravity pulls it back down
      age: 0,
      maxAge: 1.3 + Math.random() * 1.1,
      size: 1.4 + Math.random() * 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    });
  }
}

export function updateAndDrawConfetti(dt: number, camY: number) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.age += dt;
    if (p.age >= p.maxAge) {
      confetti.splice(i, 1);
      continue;
    }
    p.vy += 260 * dt; // gravity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const f = p.age / p.maxAge;
    const size = f > 0.75 ? p.size * (1 - (f - 0.75) / 0.25) : p.size;
    if (size > 0.3) drawFilledCircle(p.x, p.y - camY, size, p.color);
  }
}

// --- Piñata burst ------------------------------------------------------------
function drawStripedHalf(cx: number, cy: number, r: number, top: boolean, splitOffset: number) {
  const bandH = Math.max(2, Math.round((2 * r) / PINATA_COLORS.length));
  const rTop = Math.round(cy - r);
  const yStart = top ? rTop : Math.round(cy);
  const yEnd = top ? Math.round(cy) : Math.round(cy + r);
  const shift = top ? -splitOffset : splitOffset;
  for (let y = yStart; y <= yEnd; y++) {
    const dy = y - cy;
    const halfW = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (halfW < 0.5) continue;
    const bandIndex = Math.floor((y - rTop) / bandH);
    const color = PINATA_COLORS[((bandIndex % PINATA_COLORS.length) + PINATA_COLORS.length) % PINATA_COLORS.length];
    ctx.fillStyle = rgbStr(color);
    ctx.fillRect(Math.round(cx - halfW), y + shift, Math.round(halfW * 2), 1);
  }
}

// progress: 0 (just popped) -> 1 (fully separated and faded out).
export function drawPinataBurst(cx: number, cy: number, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const r = 24;
  const split = p * 30;
  const alpha = p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.45);
  if (alpha <= 0) return;

  // Bright pop flash right at the start, under the halves.
  if (p < 0.25) {
    const flashColor = lerpColor([255, 255, 240], PINATA_COLORS[0], p / 0.25);
    ctx.globalAlpha = alpha * (1 - p / 0.25);
    drawFilledCircle(cx, cy, r + 10, flashColor);
  }

  ctx.globalAlpha = alpha;
  drawStripedHalf(cx, cy, r, true, split);
  drawStripedHalf(cx, cy, r, false, split);
  ctx.globalAlpha = 1;
}
