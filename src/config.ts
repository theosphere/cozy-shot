// --- All tunable gameplay numbers live here --------------------------------
// This is the file to edit when adjusting difficulty/feel. Everything else
// (rendering, input, the state machine) reads these rather than hardcoding
// its own numbers. Pure visual layout (compass position, arrow length in
// pixels, torch spacing, etc.) stays with the rendering code it belongs
// to — this file is specifically the *gameplay math*.
import { H } from './render';
import type { RGB } from './render';

// --- Draw / power ------------------------------------------------------
// Max pull distance, as a fraction of the bow's own half-span (tip to
// grip) — "you can't pull the string further than the bow's own frame."
export const PULL_FRACTION = 0.55;
// Pull distance (px) below which releasing just cancels the shot instead
// of firing a near-useless dribble.
export const MIN_PULL_TO_FIRE = 14;

// --- Overdraw wobble: the risk of pulling too hard -------------------------
// Past this fraction of max pull, the aim starts trembling — the harder
// (and longer) you hold past it, the more it shakes. It fires in whatever
// direction it's actually pointing the instant you release, so this is a
// real, visible risk, not a hidden dice roll.
export const OVERDRAW_START = 0.75; // pull fraction (0-1) where the wobble begins
export const MAX_WOBBLE_RAD = 0.3; // max angular wobble at a full 100% draw, radians
export const WOBBLE_FREQ = 4.5; // how fast the wobble oscillates, radians/sec

// --- Flight physics ------------------------------------------------------
export const GRAVITY = 110;
// Launch speed range at the BASELINE distance (BASE_TRAVEL below) — other
// levels scale these by sqrt(their travel / BASE_TRAVEL) in levels.ts, so
// every level keeps the same "only a strong, risky pull reaches" curve.
export const BASE_TRAVEL = 2 * H;
export const BASE_MIN_SPEED = 220; // speed at 0% power
export const BASE_MAX_SPEED = 506; // speed at 100% power
// Real-time speed-up applied only while the arrow is actually flying (aim
// and idle stay real-time for responsive controls) — otherwise even a
// short-range shot is a long wait on a phone.
export const FLIGHT_TIME_SCALE = 2.4;
// Screen height (px from top) the camera tries to keep the arrow pinned
// at while it's ascending past that point.
export const ANCHOR_SCREEN_Y = 150;
// How far past the target the camera is allowed to keep scrolling.
export const CAMERA_TARGET_MARGIN = 70;

// --- Levels --------------------------------------------------------------
// Level 1's target sits on the bow's own screen; level 2's after one
// screen of scroll; level 3's after two. Each level gives you a fixed
// budget of arrows (fewer for the close, easy levels; more once level 3's
// long, risky distance needs the extra tries): reach POINTS_TO_ADVANCE
// before you run out and you clear it (points reset to 0, no carryover
// into the next level); run out of arrows first and you're sent all the
// way back to level 1.
export const LEVEL_TRAVEL = [260, H, 2 * H];
export const POINTS_TO_ADVANCE = 10;
export const ARROWS_PER_LEVEL = [3, 4, 5];

// --- Target rings ----------------------------------------------------------
// Outer to inner. `frac` is the ring's outer edge as a fraction of
// TARGET_RADIUS; a hit scores whichever ring its landing offset falls
// inside (see target.ts's ringForOffset).
export const TARGET_RADIUS = 46;
export interface RingDef {
  frac: number;
  score: number;
  label: string;
  color: RGB;
}
export const RINGS: RingDef[] = [
  { frac: 1.0, score: 1, label: 'ON THE BOARD', color: [214, 198, 164] },
  { frac: 0.8, score: 2, label: 'CLOSE', color: [46, 38, 34] },
  { frac: 0.6, score: 3, label: 'GOOD SHOT', color: [58, 92, 138] },
  { frac: 0.4, score: 4, label: 'GREAT SHOT', color: [178, 54, 42] },
  { frac: 0.2, score: 5, label: 'BULLSEYE', color: [224, 182, 98] }, // same gold as the bow's accents
];

// --- Wind ------------------------------------------------------------------
// Picked from a 12-heading compass (direction) and a 3-tier picker
// (strength) — see wind.ts. Speed is a single combined push magnitude in
// the chosen direction (px/s^2); position drift grows with the SQUARE of
// flight time, so keep these modest — a max-wind shot should cost you
// roughly one ring's width, not blow the arrow off-screen.
export type WindTier = 'green' | 'yellow' | 'red';
export const WIND_TIER_SPEED: Record<WindTier, number> = { green: 10, yellow: 15, red: 30 };
export const WIND_TIER_COLOR: Record<WindTier, RGB> = {
  green: [86, 196, 106],
  yellow: [224, 196, 74],
  red: [206, 70, 56],
};
