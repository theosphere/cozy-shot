// Canvas setup and hand-rasterized drawing primitives. Nothing in this
// file knows about the bow, wind, or scoring — it's the pixel-stamping
// layer everything else is built on. Manual pixel/circle stamping instead
// of ctx.rotate/ctx.stroke is what keeps rotated shapes crisp instead of
// anti-aliased.

export const W = 220;
export const H = 390;

export const canvas = document.getElementById('scene') as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
export const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

function fit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw;
  let h = w / (W / H);
  if (h > vh) {
    h = vh;
    w = h * (W / H);
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}
window.addEventListener('resize', fit);
fit();

// --- Color / dithering helpers ---------------------------------------------
export type RGB = [number, number, number];
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
function ditherThreshold(x: number, y: number): number {
  return (BAYER4[y % 4][x % 4] + 0.5) / 16;
}
export function mixColor(a: RGB, b: RGB, x: number, y: number, t: number): RGB {
  return t > ditherThreshold(x, y) ? b : a;
}
export function rgbStr([r, g, b]: RGB): string {
  return `rgb(${r},${g},${b})`;
}
export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// --- Geometry primitives -----------------------------------------------
export function drawFilledCircle(cx: number, cy: number, r: number, color: RGB) {
  ctx.fillStyle = rgbStr(color);
  const rr = Math.ceil(r);
  for (let py = -rr; py <= rr; py++) {
    for (let px = -rr; px <= rr; px++) {
      if (px * px + py * py <= r * r) ctx.fillRect(Math.round(cx + px), Math.round(cy + py), 1, 1);
    }
  }
}
function bezierControl(x0: number, y0: number, x1: number, y1: number, bulge: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { cx: (x0 + x1) / 2 + nx * bulge, cy: (y0 + y1) / 2 + ny * bulge };
}
function bezierPoint(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number) {
  const mt = 1 - t;
  return { x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1, y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1 };
}
// A tapered "stroke" along a quadratic bezier (bulge = 0 gives a straight
// line — see bezierControl) — stamped filled circles whose radius
// interpolates r0->r1, so curved shapes stay crisp/pixelated.
export function drawTaperedCurve(x0: number, y0: number, x1: number, y1: number, bulge: number, r0: number, r1: number, color: RGB) {
  const { cx, cy } = bezierControl(x0, y0, x1, y1, bulge);
  const steps = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) + Math.abs(bulge)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = bezierPoint(x0, y0, cx, cy, x1, y1, t);
    drawFilledCircle(p.x, p.y, r0 + (r1 - r0) * t, color);
  }
}
export function rot(x: number, y: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}
// Rotate a LOCAL offset by angle (radians, 0 = pointing "up" in world
// space — see angleForDir) and stamp filled circles along a straight
// local segment. Only the stamped CENTER is rotated (never a canvas
// transform), so arbitrarily-angled shapes still have no anti-aliasing.
export function drawLocalTaper(originX: number, originY: number, angle: number, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, color: RGB) {
  const steps = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) + Math.max(r0, r1)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lx = x0 + (x1 - x0) * t;
    const ly = y0 + (y1 - y0) * t;
    const w = rot(lx, ly, angle);
    drawFilledCircle(originX + w.x, originY + w.y, r0 + (r1 - r0) * t, color);
  }
}
// Local "up" (0,-1) maps to world direction dir under this angle.
export function angleForDir(dx: number, dy: number): number {
  return Math.atan2(dx, -dy);
}
// Inverse of angleForDir: the unit direction a given angle points.
export function dirForAngle(angle: number): { x: number; y: number } {
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}
