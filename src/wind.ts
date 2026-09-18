// Wind: randomized once per level attempt (rollWind), not player-set —
// shown to the player via a briefing message box before they start
// shooting (drawBriefingPanel) and via a small reference arrow while
// actually aiming (drawWindIndicator). Purely informational; there's
// nothing left here to tap.
import { W, type RGB, ctx, rgbStr, drawFilledCircle, drawLocalTaper, rot, angleForDir } from './render';
import { TEXT_DIM, TEXT_COLOR, WOOD_DARK, WOOD_MID } from './palette';
import { type WindTier, WIND_TIER_SPEED, WIND_TIER_COLOR } from './config';
import { drawPixelTextCentered } from './font';

export let windDirIndex = 0; // clockwise, 12 steps of 30 degrees, 0 = straight up
export let windTier: WindTier = 'green';
export let windX = 0;
export let windY = 0;

function recomputeWind() {
  const angle = (windDirIndex * Math.PI) / 6;
  const speed = WIND_TIER_SPEED[windTier];
  windX = Math.sin(angle) * speed;
  windY = -Math.cos(angle) * speed;
}

const TIER_ORDER: WindTier[] = ['green', 'yellow', 'red'];
// Rolls a fresh random direction + intensity for the upcoming level
// attempt — called once when a level's briefing starts, then held fixed
// for that whole attempt (all of its arrows fly under the same wind).
export function rollWind() {
  windDirIndex = Math.floor(Math.random() * 12);
  windTier = TIER_ORDER[Math.floor(Math.random() * TIER_ORDER.length)];
  recomputeWind();
}
rollWind();

// A clean shaft + solid triangular head — no fletching. The head is
// filled row-by-row rather than stamped as a shrinking circle: at this
// scale a circle taper never gets below ~1px radius (anything under r=1
// rounds to the same single pixel), so it reads as "blob then a dot"
// instead of a clean point. An explicit filled triangle keeps a crisp
// point regardless of how small this gets.
function drawMiniArrow(cx: number, cy: number, angle: number, len: number, color: RGB) {
  const headLen = Math.max(4, len * 0.34);
  const headHalfWidth = Math.max(1.6, len * 0.16);
  const shaftEnd = -(len - headLen);

  drawLocalTaper(cx, cy, angle, 0, 0, 0, shaftEnd, 0.6, 0.6, color); // shaft

  ctx.fillStyle = rgbStr(color);
  const rows = Math.max(3, Math.round(headLen));
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const y = shaftEnd + (-len - shaftEnd) * t; // shaftEnd (base) -> -len (tip)
    const hw = headHalfWidth * (1 - t); // full width at base, zero at tip
    const steps = Math.max(1, Math.round(hw * 2));
    for (let s = 0; s <= steps; s++) {
      const x = -hw + (hw * 2) * (s / steps);
      const w = rot(x, y, angle);
      ctx.fillRect(Math.round(cx + w.x), Math.round(cy + w.y), 1, 1);
    }
  }
}

// Small always-on reference arrow, in the corner where the old
// interactive compass used to sit — a quick glance back at the wind you
// were briefed on.
export function drawWindIndicator() {
  const cx = 34;
  const cy = 40;
  drawPixelTextCentered('WIND', cx, 6, TEXT_DIM);
  const maxSpeed = WIND_TIER_SPEED.red;
  const mag = Math.min(1, Math.hypot(windX, windY) / maxSpeed);
  const len = 8 + mag * 16;
  const angle = angleForDir(windX, windY);
  const color = WIND_TIER_COLOR[windTier];
  drawMiniArrow(cx, cy, angle, len, color);
}

// --- Compass dial: the same art style as before, but now just a display,
// parameterized so it can be drawn at any position/size (used inside the
// briefing panel, not as a fixed on-screen control anymore).
const TICK_DIM: RGB = [70, 62, 56];
const CROSS_DIM: RGB = [58, 52, 48];
function drawCompassDial(cx: number, cy: number, r: number) {
  // Quadrant cross: two faint diameters (N-S, E-W) splitting the compass
  // into its four quadrants, each holding 3 of the 12 headings.
  drawLocalTaper(cx, cy, 0, 0, -r, 0, r, 0.4, 0.4, CROSS_DIM);
  drawLocalTaper(cx, cy, Math.PI / 2, 0, -r, 0, r, 0.4, 0.4, CROSS_DIM);
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    const outer = rot(0, -r, ang);
    const onQuadrantLine = i % 3 === 0;
    const color: RGB = i === windDirIndex ? WIND_TIER_COLOR[windTier] : onQuadrantLine ? TEXT_DIM : TICK_DIM;
    drawFilledCircle(cx + outer.x, cy + outer.y, i === windDirIndex ? 2.4 : 1.2, color);
  }
  const dirAngle = (windDirIndex * Math.PI) / 6;
  drawMiniArrow(cx, cy, dirAngle, r - 6, WIND_TIER_COLOR[windTier]);
}
function drawIntensityLegend(cx: number, cy: number) {
  const spacing = 14;
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const tier = TIER_ORDER[i];
    const x = cx - spacing + i * spacing;
    const selected = tier === windTier;
    if (selected) drawFilledCircle(x, cy, 4.6, TEXT_COLOR);
    drawFilledCircle(x, cy, selected ? 3.2 : 3.6, WIND_TIER_COLOR[tier]);
  }
}

// --- Briefing panel: the pre-attempt message box -------------------------
// Centered, drawn over the bow, showing this attempt's wind before the
// player is allowed to shoot. Dismissed by a tap anywhere (see input.ts).
// Also announces WHY a new attempt is starting — level gained, level
// lost, or (headerText '') just the very first briefing of the session —
// so a level change is a real message in a box, not just a flash of text
// that scrolls past.
const PANEL_FILL: RGB = [16, 13, 12];
const PANEL_W = 150;
const PANEL_H = 162;
export function drawBriefingPanel(headerText: string, level: number) {
  const px = Math.round(W / 2 - PANEL_W / 2);
  const py = 260 - PANEL_H / 2; // centered over the nocked arrow/grip area

  ctx.fillStyle = rgbStr(WOOD_DARK);
  ctx.fillRect(px - 2, py - 2, PANEL_W + 4, PANEL_H + 4);
  ctx.fillStyle = rgbStr(PANEL_FILL);
  ctx.fillRect(px, py, PANEL_W, PANEL_H);
  ctx.fillStyle = rgbStr(WOOD_MID);
  ctx.fillRect(px, py, PANEL_W, 2);
  ctx.fillRect(px, py + PANEL_H - 2, PANEL_W, 2);

  const cx = W / 2;
  if (headerText) drawPixelTextCentered(headerText, cx, py + 10, TEXT_COLOR);
  drawPixelTextCentered(`LEVEL ${level}`, cx, py + 20, TEXT_COLOR);
  drawCompassDial(cx, py + 74, 34);
  drawIntensityLegend(cx, py + 120);
  drawPixelTextCentered('TAP TO SHOOT', cx, py + 140, TEXT_DIM);
}
