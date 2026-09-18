// The "what next" choice shown once, right after clearing the final
// level (see flight.ts's 'victoryChoice' state): keep playing level 3 for
// score from a fresh level 1, or drop straight into free shooting at
// level 3 with no arrow/point pressure. Same wood-panel look as the wind
// briefing box (wind.ts), just with two tappable buttons instead of
// "tap anywhere".
import { W, ctx, rgbStr, type RGB } from './render';
import { WOOD_DARK, WOOD_MID, TEXT_COLOR, TEXT_DIM } from './palette';
import { drawPixelTextCentered } from './font';

const PANEL_FILL: RGB = [16, 13, 12];
const PANEL_W = 150;
const PANEL_H = 122;
const PANEL_Y = 260 - PANEL_H / 2; // same vertical anchor as the wind briefing panel
const PANEL_X = Math.round(W / 2 - PANEL_W / 2);

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
// Exported so input.ts can hit-test taps against exactly what's drawn.
export const RESET_BUTTON: ButtonRect = { x: PANEL_X + 10, y: PANEL_Y + 68, w: PANEL_W - 20, h: 22 };
export const FREE_SHOOT_BUTTON: ButtonRect = { x: PANEL_X + 10, y: PANEL_Y + 96, w: PANEL_W - 20, h: 22 };

function drawButton(rect: ButtonRect, label: string) {
  ctx.fillStyle = rgbStr(WOOD_MID);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = rgbStr(WOOD_DARK);
  ctx.fillRect(rect.x, rect.y, rect.w, 2);
  ctx.fillRect(rect.x, rect.y + rect.h - 2, rect.w, 2);
  drawPixelTextCentered(label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 2, TEXT_COLOR);
}

export function drawVictoryPanel() {
  const px = PANEL_X;
  const py = PANEL_Y;

  ctx.fillStyle = rgbStr(WOOD_DARK);
  ctx.fillRect(px - 2, py - 2, PANEL_W + 4, PANEL_H + 4);
  ctx.fillStyle = rgbStr(PANEL_FILL);
  ctx.fillRect(px, py, PANEL_W, PANEL_H);
  ctx.fillStyle = rgbStr(WOOD_MID);
  ctx.fillRect(px, py, PANEL_W, 2);
  ctx.fillRect(px, py + PANEL_H - 2, PANEL_W, 2);

  const cx = W / 2;
  drawPixelTextCentered('VICTORY', cx, py + 12, TEXT_COLOR);
  drawPixelTextCentered('LEVEL 3 CLEARED', cx, py + 22, TEXT_DIM);
  drawPixelTextCentered('PLAY AGAIN', cx, py + 40, TEXT_DIM);
  drawButton(RESET_BUTTON, 'RESET');
  drawButton(FREE_SHOOT_BUTTON, 'FREE SHOOT');
}

export type VictoryChoice = 'reset' | 'freeShoot' | null;
export function hitTest(x: number, y: number): VictoryChoice {
  const inRect = (r: ButtonRect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  if (inRect(RESET_BUTTON)) return 'reset';
  if (inRect(FREE_SHOOT_BUTTON)) return 'freeShoot';
  return null;
}
