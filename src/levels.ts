// Level/points/arrows state and the per-level physics scaling. `level`,
// `levelPoints`, `arrowsLeft`, and the derived target distance / launch
// speeds all live here so tuning "how hard is level N" is one place to
// look.
import { LEVEL_TRAVEL, POINTS_TO_ADVANCE, ARROWS_PER_LEVEL, BASE_TRAVEL, BASE_MIN_SPEED, BASE_MAX_SPEED, CAMERA_TARGET_MARGIN } from './config';
import { BOW_Y, MAX_PULL } from './bow';
import { W } from './render';
import { drawPixelText, textWidth } from './font';
import { TEXT_COLOR, TEXT_DIM } from './palette';

export let level = 1;
export let levelPoints = 0;
export let arrowsLeft = ARROWS_PER_LEVEL;
// Unlocked from the post-victory choice panel (see flight.ts's
// 'victoryChoice' state) — shoot level 3 for as long as you want with no
// arrow budget or point threshold. recordShot short-circuits below.
export let freeShooting = false;

export let WORLD_TRAVEL = LEVEL_TRAVEL[0];
export let TARGET_WORLD_Y = BOW_Y - WORLD_TRAVEL;
export let CAMERA_MIN = TARGET_WORLD_Y - CAMERA_TARGET_MARGIN;
export let MIN_SPEED = BASE_MIN_SPEED;
export let MAX_SPEED = BASE_MAX_SPEED;

export function applyLevel() {
  WORLD_TRAVEL = LEVEL_TRAVEL[level - 1];
  TARGET_WORLD_Y = BOW_Y - WORLD_TRAVEL;
  CAMERA_MIN = TARGET_WORLD_Y - CAMERA_TARGET_MARGIN;
  // The arrow actually launches from the drawn nock position — up to
  // MAX_PULL below BOW_Y — not from BOW_Y itself. That's noise against
  // level 3's long travel (the tuning baseline) but a huge fraction of
  // level 1's short one, so it has to be included on both sides of the
  // scale ratio or short levels come out under-tuned.
  const effective = WORLD_TRAVEL + MAX_PULL;
  const baseEffective = BASE_TRAVEL + MAX_PULL;
  const scale = Math.sqrt(effective / baseEffective);
  MIN_SPEED = BASE_MIN_SPEED * scale;
  MAX_SPEED = BASE_MAX_SPEED * scale;
}
applyLevel();

export type ShotOutcome = 'continue' | 'advance' | 'complete' | 'fail';

// Records one shot's result against the current level's tally — every
// arrow counts against the budget, hit or miss. Returns what happened:
//  - 'advance': reached POINTS_TO_ADVANCE with arrows to spare (or on the
//    last one) — points reset to 0 (no carryover) and level increments.
//  - 'complete': same as 'advance', but there's no level after this one —
//    the player just cleared the last level. flight.ts treats this as its
//    cue to fire the piñata/confetti celebration instead of a plain
//    "LEVEL UP". Level stays put (nothing to increment to) so the same
//    final level just plays again, fresh, for anyone who wants another go.
//  - 'fail': used the last arrow without reaching the threshold — once
//    you've reached a level it's WON, you never drop back below it. This
//    just retries the same level: fresh 0 points, a full arrow budget,
//    and (see flight.ts) a newly-rolled wind for the retry.
//  - 'continue': neither yet, same level, arrows remain.
// Either 'advance', 'complete' or 'fail' means a fresh attempt is
// starting; the caller is responsible for actually applying the level's
// geometry (see flight.ts's pendingApplyLevel) once it's safe to move the
// target — 'advance' needs this because the target itself moved, the
// other two don't strictly need it (same level) but still trigger the
// same "new attempt" briefing/re-roll.
export function recordShot(score: number): ShotOutcome {
  if (freeShooting) return 'continue'; // no budget, no threshold — just shoot
  levelPoints += score;
  arrowsLeft -= 1;

  if (levelPoints >= POINTS_TO_ADVANCE) {
    levelPoints = 0;
    arrowsLeft = ARROWS_PER_LEVEL;
    if (level < LEVEL_TRAVEL.length) {
      level += 1;
      return 'advance';
    }
    return 'complete';
  }
  if (arrowsLeft <= 0) {
    levelPoints = 0;
    arrowsLeft = ARROWS_PER_LEVEL;
    return 'fail';
  }
  return 'continue';
}

// Chosen from the post-victory panel: keep the level-3 target but drop
// the arrow/point pressure entirely.
export function enterFreeShooting() {
  freeShooting = true;
}
// Chosen from the post-victory panel: back to a fresh level 1.
export function resetGame() {
  freeShooting = false;
  level = 1;
  levelPoints = 0;
  arrowsLeft = ARROWS_PER_LEVEL;
  applyLevel();
}

export function drawLevelHUD() {
  if (freeShooting) {
    const line1 = 'FREE SHOOT';
    drawPixelText(line1, W - 4 - textWidth(line1), 6, TEXT_COLOR);
    return;
  }
  const line1 = `LV ${level}`;
  const line2 = `${levelPoints}/${POINTS_TO_ADVANCE}`;
  const line3 = `AR ${arrowsLeft}/${ARROWS_PER_LEVEL}`;
  drawPixelText(line1, W - 4 - textWidth(line1), 6, TEXT_COLOR);
  drawPixelText(line2, W - 4 - textWidth(line2), 14, TEXT_DIM);
  drawPixelText(line3, W - 4 - textWidth(line3), 22, TEXT_DIM);
}
