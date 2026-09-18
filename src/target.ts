// The target board — a medieval archery target on a wooden X-stand — and
// the ring-scoring lookup. Ring definitions (size/score/label/color) are
// gameplay data, so they live in config.ts; this file just renders and
// scores against them.
import { H, drawFilledCircle, drawTaperedCurve } from './render';
import { WOOD_DARK, WOOD_MID } from './palette';
import { RINGS, TARGET_RADIUS, type RingDef } from './config';
import { BOW_CENTER_X } from './bow';

export const TARGET_CENTER_X = BOW_CENTER_X;

export function drawTargetBoard(targetWorldY: number, camY: number) {
  const tx = TARGET_CENTER_X;
  const ty = targetWorldY - camY;
  if (ty < -TARGET_RADIUS - 60 || ty > H + TARGET_RADIUS + 60) return;
  // Wooden support frame: an X-stand behind the board.
  drawTaperedCurve(tx - 34, ty + 40, tx + 30, ty - 44, 0, 2.4, 2.4, WOOD_DARK);
  drawTaperedCurve(tx + 34, ty + 40, tx - 30, ty - 44, 0, 2.4, 2.4, WOOD_DARK);
  drawTaperedCurve(tx - 34, ty + 40, tx + 30, ty - 44, 0, 1.3, 1.3, WOOD_MID);
  drawTaperedCurve(tx + 34, ty + 40, tx - 30, ty - 44, 0, 1.3, 1.3, WOOD_MID);
  // Straw backing disc, then the scoring rings on top.
  drawFilledCircle(tx, ty, TARGET_RADIUS + 4, WOOD_MID);
  for (const ring of RINGS) drawFilledCircle(tx, ty, TARGET_RADIUS * ring.frac, ring.color);
}

const MISS: { score: number; label: string } = { score: 0, label: 'OFF TARGET' };

// Which ring a landing offset (distance from target center, px) falls
// into — the outermost ring whose radius the offset is still within.
export function ringForOffset(offset: number): RingDef | typeof MISS {
  const frac = offset / TARGET_RADIUS;
  for (let i = RINGS.length - 1; i >= 0; i--) {
    if (frac <= RINGS[i].frac) return RINGS[i];
  }
  return MISS;
}
