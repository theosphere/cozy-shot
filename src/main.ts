// cozy-shot — a portrait touch toy: a bow lying horizontally near
// the bottom of the screen. Each level attempt opens with a wind briefing
// (direction + strength, randomized, shown on a compass), then you drag
// the nocked arrow away from the bow to draw the string (further pull =
// more power, opposite direction = aim) and release to loose a burning
// arrow upward toward a target. That wind drifts the shot over the
// distance, and gravity means a weak pull can fall short before ever
// reaching the target.
//
// This file is just the frame-loop wiring — the actual game logic lives
// in flight.ts, the tunable numbers in config.ts, and level/target state
// in levels.ts. See config.ts first for anything gameplay-math related.
import './input'; // wires pointer events (side-effect only)
import { W, H } from './render';
import { advance, simTime } from './clock';
import { drawPixelTextCentered } from './font';
import { TEXT_COLOR, TEXT_DIM } from './palette';
import { OVERDRAW_START, WIND_TIER_COLOR } from './config';
import * as bow from './bow';
import * as target from './target';
import * as background from './background';
import * as wind from './wind';
import * as levels from './levels';
import * as flight from './flight';
import * as celebration from './celebration';
import * as victoryPanel from './victoryPanel';

function frame() {
  requestAnimationFrame(frame);
  const dt = advance();

  flight.tickGame(dt);

  const bowScreenY = bow.BOW_Y - flight.cameraTop;
  background.drawBackground(dt, bowScreenY);
  background.drawTorches(flight.cameraTop, simTime, levels.WORLD_TRAVEL);
  target.drawTargetBoard(levels.TARGET_WORLD_Y, flight.cameraTop);
  bow.drawBowLimbs(flight.cameraTop);
  if (flight.state !== 'flying') {
    levels.drawLevelHUD();
  }

  if (flight.state === 'idle' || flight.state === 'drawing') {
    bow.drawString(flight.nockX, flight.nockY, flight.cameraTop);
    bow.drawGripAndGem(simTime, flight.cameraTop);
    bow.drawArrowShape(flight.nockX, flight.nockY - flight.cameraTop, flight.currentAimAngle());
    wind.drawWindIndicator();
    if (flight.state === 'drawing') {
      const power = flight.currentPower();
      const powerPct = Math.round(power * 100);
      const shaky = power > OVERDRAW_START;
      drawPixelTextCentered(`POWER ${powerPct}`, W / 2, H - 24, shaky ? WIND_TIER_COLOR.red : TEXT_COLOR);
    }
  } else {
    bow.drawString(bow.REST_NOCK.x, bow.REST_NOCK.y, flight.cameraTop);
    bow.drawGripAndGem(simTime, flight.cameraTop);
    if (flight.state === 'flying') {
      bow.drawArrowShape(flight.flyX, flight.flyY - flight.cameraTop, flight.flyAngle);
    }
  }
  flight.updateAndDrawTrail(dt, flight.cameraTop);
  celebration.updateAndDrawConfetti(dt, flight.cameraTop);
  if (flight.celebrating) {
    celebration.drawPinataBurst(target.TARGET_CENTER_X, flight.celebrationY - flight.cameraTop, flight.celebrationProgress());
  }

  if (flight.state === 'briefing') {
    wind.drawBriefingPanel(flight.briefingHeader, levels.level);
  }
  if (flight.state === 'victoryChoice') {
    victoryPanel.drawVictoryPanel();
  }

  if (flight.state === 'result') {
    // A hit resolves near the target (pinned near the top, bow long
    // scrolled out of view) — text goes at the bottom, empty there.
    // A fall-short resolves back near the bow (bottom of screen, target
    // nowhere in view) — text goes at the top instead. Same text, safe
    // empty half of the screen either way.
    const ty = flight.resultNearTarget ? H - 54 : 26;
    const sy = flight.resultNearTarget ? H - 44 : 36;
    drawPixelTextCentered(flight.resultTitle, W / 2, ty, TEXT_COLOR);
    drawPixelTextCentered(flight.resultSub, W / 2, sy, TEXT_DIM);
  }
}
frame();
