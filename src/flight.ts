// The actual game logic: aiming, the overdraw wobble, releasing, flight
// physics, scoring against the target, and the shot state machine
// (briefing -> idle -> drawing -> flying -> result -> returning ->
// briefing-or-idle). This is where the "math of gameplay" the rest of
// the app hangs off of lives.
import { MIN_PULL_TO_FIRE, OVERDRAW_START, MAX_WOBBLE_RAD, WOBBLE_FREQ, GRAVITY, FLIGHT_TIME_SCALE, ANCHOR_SCREEN_Y } from './config';
import { REST_NOCK, MAX_PULL, BOW_Y } from './bow';
import { TARGET_CENTER_X, ringForOffset } from './target';
import * as levels from './levels';
import { windX, windY, rollWind } from './wind';
import { angleForDir, dirForAngle, rot, drawFilledCircle, lerpColor } from './render';
import { EMBER_HOT, EMBER_MID, EMBER_COOL } from './palette';
import { simTime } from './clock';
import * as audio from './audio';
import * as celebration from './celebration';

export type ShotState = 'briefing' | 'idle' | 'drawing' | 'flying' | 'result' | 'returning' | 'victoryChoice';
// Every level attempt opens with a wind briefing before the player can
// touch the bow — see dismissBriefing() and tickGame's returning->idle
// transition (which re-enters 'briefing' instead whenever a level just
// changed).
export let state: ShotState = 'briefing';

// Nocked-arrow position while idle/drawing.
export let nockX = REST_NOCK.x;
export let nockY = REST_NOCK.y;
export let aimDX = 0;
export let aimDY = -1;

// In-flight arrow.
export let flyX = 0;
export let flyY = 0;
let flyVX = 0;
let flyVY = 0;
export let flyAngle = 0;
let pastApex = false;

export let cameraTop = 0;
let pendingApplyLevel = false;
// Set instead of pendingApplyLevel when the winning shot cleared the
// final level — the next 'returning'->? transition goes to the
// victoryChoice panel instead of straight back into a wind briefing.
let pendingVictoryChoice = false;
// What to announce on the wind-check box that follows a level change —
// '' for the very first briefing (no prior outcome to report).
export let briefingHeader = '';

export let resultTitle = '';
export let resultSub = '';
export let resultNearTarget = true;
let resultTimer = 0;

// The piñata/confetti celebration for clearing the final level — purely
// visual, layered on top of whatever the state machine is otherwise doing
// (result -> returning -> briefing keeps running underneath it).
const CELEBRATION_DURATION = 2.6;
export let celebrating = false;
export let celebrationX = 0;
export let celebrationY = 0;
let celebrationTimer = 0;
export function celebrationProgress(): number {
  return celebrating ? 1 - celebrationTimer / CELEBRATION_DURATION : 0;
}

// Overdrawing is risky, not just "more power": past OVERDRAW_START the
// aim itself visibly trembles, growing stronger the harder you pull — you
// can SEE it building while holding, and the shot fires in whatever
// direction it's actually pointing the instant you release (not a hidden
// dice roll applied afterward).
export function overdrawWobble(power: number, t: number): number {
  const amt = Math.max(0, (power - OVERDRAW_START) / (1 - OVERDRAW_START));
  return Math.sin(t * WOBBLE_FREQ) * amt * amt * MAX_WOBBLE_RAD;
}

function updateAim(touchX: number, touchY: number) {
  const dx = touchX - REST_NOCK.x;
  const dyRaw = touchY - REST_NOCK.y;
  const dy = Math.max(0, dyRaw); // never let the pull go "above" the string's rest line
  let len = Math.hypot(dx, dy);
  let cx = dx;
  let cy = dy;
  if (len > MAX_PULL) {
    const s = MAX_PULL / len;
    cx *= s;
    cy *= s;
    len = MAX_PULL;
  }
  nockX = REST_NOCK.x + cx;
  nockY = REST_NOCK.y + cy;
  if (len > 0.5) {
    aimDX = -cx / len;
    aimDY = -cy / len;
  } else {
    aimDX = 0;
    aimDY = -1;
  }
  audio.updatePullSound(currentPower());
}

export function pullLength(): number {
  return Math.hypot(nockX - REST_NOCK.x, nockY - REST_NOCK.y);
}
export function currentPower(): number {
  return Math.min(1, pullLength() / MAX_PULL);
}
// The angle to actually render the nocked arrow at — the aim direction,
// plus the overdraw wobble while actively drawing.
export function currentAimAngle(): number {
  const base = angleForDir(aimDX, aimDY);
  if (state === 'drawing') return base + overdrawWobble(currentPower(), simTime);
  return base;
}

// --- Input entry points (called from input.ts) ----------------------------
export function dismissBriefing() {
  if (state !== 'briefing') return;
  state = 'idle';
}
export function chooseReset() {
  if (state !== 'victoryChoice') return;
  levels.resetGame();
  briefingHeader = '';
  rollWind();
  state = 'briefing';
}
export function chooseFreeShoot() {
  if (state !== 'victoryChoice') return;
  levels.enterFreeShooting();
  state = 'idle';
}
export function beginDrawing(px: number, py: number) {
  state = 'drawing';
  audio.startPullSound();
  updateAim(px, py);
}
export function updateDrawing(px: number, py: number) {
  if (state !== 'drawing') return;
  updateAim(px, py);
}
export function endDrawing() {
  if (state !== 'drawing') return;
  release();
}

function release() {
  const len = pullLength();
  if (len < MIN_PULL_TO_FIRE) {
    audio.stopPullSound(true);
    state = 'idle';
    nockX = REST_NOCK.x;
    nockY = REST_NOCK.y;
    aimDX = 0;
    aimDY = -1;
    return;
  }
  const power = currentPower();
  audio.stopPullSound();
  audio.playRelease(power);
  const speed = levels.MIN_SPEED + power * (levels.MAX_SPEED - levels.MIN_SPEED);
  // Fire in whatever direction the (possibly trembling) aim is actually
  // pointing at this exact instant — same formula the draw-time rendering
  // uses (currentAimAngle), so there is no discrepancy between what you
  // saw and what fires.
  const releaseAngle = angleForDir(aimDX, aimDY) + overdrawWobble(power, simTime);
  const dir = dirForAngle(releaseAngle);
  flyX = nockX;
  flyY = nockY;
  flyVX = dir.x * speed;
  flyVY = dir.y * speed;
  flyAngle = releaseAngle;
  pastApex = false;
  spawnTrail(flyX, flyY, 12, 60);
  state = 'flying';
  audio.startFlightSound();
}

function beginResult(title: string, sub: string, nearTarget: boolean) {
  resultTitle = title;
  resultSub = sub;
  resultNearTarget = nearTarget;
  resultTimer = 1.7;
  state = 'result';
}

// --- Trail particles ---------------------------------------------------
interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  r0: number;
}
const trail: TrailParticle[] = [];
function spawnTrail(x: number, y: number, n: number, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * spread;
    trail.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 8,
      age: 0,
      maxAge: 0.28 + Math.random() * 0.3,
      r0: 1.2 + Math.random() * 1.3,
    });
  }
}
export function updateAndDrawTrail(dt: number, camY: number) {
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = trail[i];
    p.age += dt;
    if (p.age >= p.maxAge) {
      trail.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const f = p.age / p.maxAge;
    const color = f < 0.4 ? lerpColor(EMBER_HOT, EMBER_MID, f / 0.4) : lerpColor(EMBER_MID, EMBER_COOL, (f - 0.4) / 0.6);
    drawFilledCircle(p.x, p.y - camY, p.r0 * (1 - f), color);
  }
}

// --- Flight physics + scoring ---------------------------------------------
function updateFlight(dt: number) {
  // Substepped, not one big integration per frame: semi-implicit Euler at
  // a coarse timestep systematically loses height compared to the true
  // continuous physics (the larger the step, the more it loses) — with
  // FLIGHT_TIME_SCALE stretching the effective dt further, a single big
  // step was quietly undershooting the "speed^2/(2*GRAVITY)" rise formula
  // every level is tuned against. Substeps make the simulation actually
  // match that formula instead of padding numbers to compensate.
  const SUBSTEPS = 8;
  const subDt = dt / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) {
    flyVY += GRAVITY * subDt;
    flyVX += windX * subDt;
    flyVY += windY * subDt;
    flyX += flyVX * subDt;
    flyY += flyVY * subDt;
    if (flyVY > 0) pastApex = true;

    if (flyY <= levels.TARGET_WORLD_Y) {
      const offset = Math.abs(flyX - TARGET_CENTER_X);
      const ring = ringForOffset(offset);
      spawnTrail(flyX, flyY, 16, 90);
      audio.stopFlightSound();
      if (ring.score > 0) audio.playHit(ring.score);
      else audio.playMiss();
      const title = ring.score > 0 ? ring.label : 'OFF TARGET';
      const outcome = levels.recordShot(ring.score);
      if (levels.freeShooting) {
        // No arrows/points/levels here — just a fresh wind for the next
        // shot, and the piñata treat again on every bullseye.
        rollWind();
        if (ring.label === 'BULLSEYE') {
          celebrating = true;
          celebrationTimer = CELEBRATION_DURATION;
          celebrationX = flyX;
          celebrationY = flyY;
          celebration.spawnConfetti(flyX, flyY);
        }
        beginResult(title, ring.score > 0 ? `SCORE ${ring.score}` : 'MISSED THE BOARD', true);
      } else if (outcome === 'advance') {
        pendingApplyLevel = true;
        briefingHeader = 'LEVEL UP';
        beginResult(title, `LEVEL ${levels.level}`, true);
      } else if (outcome === 'complete') {
        // Cleared the final level — the piñata/confetti treat, then (once
        // the result/return animation finishes) the victoryChoice panel
        // instead of a plain wind briefing. Level 3's own geometry is
        // unchanged, so there's nothing for pendingApplyLevel to redo here.
        pendingVictoryChoice = true;
        celebrating = true;
        celebrationTimer = CELEBRATION_DURATION;
        celebrationX = flyX;
        celebrationY = flyY;
        celebration.spawnConfetti(flyX, flyY);
        beginResult(title, 'VICTORY', true);
      } else if (outcome === 'fail') {
        // A level once reached is never lost — this just means the
        // arrows ran out before clearing it, so the same level retries
        // with a fresh wind. Title still reports what THIS shot did.
        pendingApplyLevel = true;
        briefingHeader = 'TRY AGAIN';
        beginResult(title, 'TRY AGAIN', true);
      } else if (ring.score > 0) {
        beginResult(title, `SCORE ${ring.score}`, true);
      } else {
        beginResult(title, 'MISSED THE BOARD', true);
      }
      return;
    }
    if (pastApex && flyY >= BOW_Y) {
      audio.stopFlightSound();
      audio.playMiss();
      const outcome = levels.recordShot(0);
      if (levels.freeShooting) {
        rollWind();
        beginResult('FELL SHORT', 'PULL HARDER', false);
      } else if (outcome === 'fail') {
        pendingApplyLevel = true;
        briefingHeader = 'TRY AGAIN';
        beginResult('FELL SHORT', 'TRY AGAIN', false);
      } else {
        beginResult('FELL SHORT', 'PULL HARDER', false);
      }
      return;
    }
  }
  flyAngle = angleForDir(flyVX, flyVY);
  if (Math.random() < 0.9) {
    const back = rot(0, 6, flyAngle);
    spawnTrail(flyX + back.x, flyY + back.y, 1, 12);
  }
}

function updateCamera(dt: number) {
  if (state === 'flying') {
    cameraTop = Math.min(0, Math.max(levels.CAMERA_MIN, flyY - ANCHOR_SCREEN_Y));
  } else if (state === 'result') {
    // hold camera where the shot ended, let the player see the outcome
  } else if (state === 'returning') {
    cameraTop += (0 - cameraTop) * Math.min(1, dt * 4);
    if (Math.abs(cameraTop) < 0.5) cameraTop = 0;
  } else {
    cameraTop = 0;
  }
}

// Called once per frame from main.ts: advances the state machine and
// physics, then the camera.
export function tickGame(dt: number) {
  if (celebrating) {
    celebrationTimer -= dt;
    if (celebrationTimer <= 0) celebrating = false;
  }
  if (state === 'flying') {
    updateFlight(dt * FLIGHT_TIME_SCALE);
  } else if (state === 'result') {
    resultTimer -= dt;
    if (resultTimer <= 0) state = 'returning';
  } else if (state === 'returning') {
    if (Math.abs(cameraTop) < 0.5) {
      nockX = REST_NOCK.x;
      nockY = REST_NOCK.y;
      aimDX = 0;
      aimDY = -1;
      if (pendingVictoryChoice) {
        pendingVictoryChoice = false;
        state = 'victoryChoice';
      } else if (pendingApplyLevel) {
        // A fresh level attempt just started (advanced or dropped back) —
        // roll new wind and make the player look at it before they can
        // touch the bow again.
        levels.applyLevel();
        pendingApplyLevel = false;
        rollWind();
        state = 'briefing';
      } else {
        // Same level, arrows still left — no new briefing, same wind.
        state = 'idle';
      }
    }
  }
  updateCamera(dt);
}
