// The bow's geometry (world-fixed; the bow itself never moves) and its
// rendering — limbs, grip/gem, string, and the arrow shape shared by both
// the nocked (idle/drawing) and in-flight arrow.
import { W, ctx, rgbStr, drawFilledCircle, drawTaperedCurve, drawLocalTaper, lerpColor } from './render';
import {
  WOOD_DARK,
  WOOD_MID,
  WOOD_LIGHT,
  GOLD,
  GOLD_DARK,
  GRIP_WRAP,
  GEM_BASE,
  GEM_BRIGHT,
  STRING_COLOR,
  SHAFT_COLOR,
  HEAD_COLOR,
  HEAD_DARK,
  FLETCH_COLOR,
} from './palette';
import { PULL_FRACTION } from './config';

export const BOW_Y = 325;
export const BOW_CENTER_X = W / 2;
export const LEFT_TIP = { x: 26, y: BOW_Y };
export const RIGHT_TIP = { x: W - 26, y: BOW_Y };
export const GRIP = { x: BOW_CENTER_X, y: BOW_Y - 20 }; // brace height: limbs arc up and away from the string
export const REST_NOCK = { x: BOW_CENTER_X, y: BOW_Y };
export const BOW_HALF_SPAN = RIGHT_TIP.x - GRIP.x;
export const MAX_PULL = BOW_HALF_SPAN * PULL_FRACTION;

export function drawBowLimbs(camY: number) {
  const ltx = LEFT_TIP.x,
    lty = LEFT_TIP.y - camY;
  const rtx = RIGHT_TIP.x,
    rty = RIGHT_TIP.y - camY;
  const gx = GRIP.x,
    gy = GRIP.y - camY;
  drawTaperedCurve(ltx, lty, gx, gy, -6, 1.5, 4.2, WOOD_DARK);
  drawTaperedCurve(rtx, rty, gx, gy, 6, 1.5, 4.2, WOOD_DARK);
  drawTaperedCurve(ltx, lty, gx, gy - 1, -6, 0.9, 2.6, WOOD_MID);
  drawTaperedCurve(rtx, rty, gx, gy - 1, 6, 0.9, 2.6, WOOD_MID);
  drawTaperedCurve(ltx, lty - 1, gx - 3, gy - 2, -6, 0.4, 1.1, WOOD_LIGHT);
  drawTaperedCurve(rtx, rty - 1, gx + 3, gy - 2, 6, 0.4, 1.1, WOOD_LIGHT);
  drawFilledCircle(ltx, lty, 2.6, GOLD_DARK);
  drawFilledCircle(ltx, lty - 0.6, 1.6, GOLD);
  drawFilledCircle(rtx, rty, 2.6, GOLD_DARK);
  drawFilledCircle(rtx, rty - 0.6, 1.6, GOLD);
}

export function drawGripAndGem(time: number, camY: number) {
  const gx = GRIP.x,
    gy = GRIP.y - camY;
  drawFilledCircle(gx, gy, 5.4, GRIP_WRAP);
  drawFilledCircle(gx, gy - 1, 4.2, WOOD_DARK);
  for (let i = -1; i <= 1; i++) {
    ctx.fillStyle = rgbStr(GOLD_DARK);
    ctx.fillRect(Math.round(gx - 3), Math.round(gy - 2 + i * 2.4), 6, 1);
  }
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  drawFilledCircle(gx, gy - 6, 2.4, GEM_BASE);
  drawFilledCircle(gx, gy - 6.4, 1.1 + pulse * 0.5, lerpColor(GEM_BASE, GEM_BRIGHT, pulse));
}

export function drawString(nockX: number, nockY: number, camY: number) {
  drawTaperedCurve(LEFT_TIP.x, LEFT_TIP.y - camY, nockX, nockY - camY, 0, 0.6, 0.6, STRING_COLOR);
  drawTaperedCurve(RIGHT_TIP.x, RIGHT_TIP.y - camY, nockX, nockY - camY, 0, 0.6, 0.6, STRING_COLOR);
}

// --- Arrow shape (shared by nocked and in-flight rendering) ---------------
// Drawn in LOCAL space with the tail (nock end) at the origin and the tip
// pointing along local -Y; `angle` rotates that into world space.
export const ARROW_LEN = 64;
export const HEAD_LEN = 11;
export function drawArrowShape(originX: number, originY: number, angle: number) {
  const shaftEnd = -(ARROW_LEN - HEAD_LEN);
  drawLocalTaper(originX, originY, angle, 0, 0, 0, shaftEnd, 1.2, 1.2, SHAFT_COLOR);
  drawLocalTaper(originX, originY, angle, 0, shaftEnd, 0, -ARROW_LEN, 2.6, 0.3, HEAD_DARK);
  drawLocalTaper(originX, originY, angle, 0, shaftEnd, 0, -ARROW_LEN + 2, 1.6, 0.2, HEAD_COLOR);
  drawLocalTaper(originX, originY, angle, 0, -2, -4.5, -13, 0.3, 2.4, FLETCH_COLOR);
  drawLocalTaper(originX, originY, angle, 0, -2, 4.5, -13, 0.3, 2.4, FLETCH_COLOR);
}
