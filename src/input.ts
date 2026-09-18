// Pointer event wiring: converts touches to canvas-space coordinates and
// routes them to either dismissing the wind briefing or the bow-draw
// gesture.
import { canvas, W, H } from './render';
import { REST_NOCK } from './bow';
import * as flight from './flight';
import { unlockAudio } from './audio';
import * as victoryPanel from './victoryPanel';

// Generous grab radius so a thumb anywhere in the lower half can pick up
// the arrow, without letting a stray tap way up top yank it.
const GRAB_RADIUS = 170;

function toCanvasSpace(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

let activePointer: number | null = null;
canvas.addEventListener('pointerdown', (e) => {
  // Browsers block audio until a real user gesture — this is the
  // earliest one in the app, and it's a no-op to call again on every
  // subsequent tap (see unlockAudio's early-return for an existing ctx).
  unlockAudio();
  if (flight.state === 'briefing') {
    flight.dismissBriefing();
    return;
  }
  if (flight.state === 'victoryChoice') {
    const p = toCanvasSpace(e.clientX, e.clientY);
    const choice = victoryPanel.hitTest(p.x, p.y);
    if (choice === 'reset') flight.chooseReset();
    else if (choice === 'freeShoot') flight.chooseFreeShoot();
    return;
  }
  if (flight.state !== 'idle') return;
  const p = toCanvasSpace(e.clientX, e.clientY);
  if (Math.hypot(p.x - REST_NOCK.x, p.y - REST_NOCK.y) > GRAB_RADIUS) return;
  activePointer = e.pointerId;
  flight.beginDrawing(p.x, p.y);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (flight.state !== 'drawing' || e.pointerId !== activePointer) return;
  const p = toCanvasSpace(e.clientX, e.clientY);
  flight.updateDrawing(p.x, p.y);
});
function endDrag(e: PointerEvent) {
  if (flight.state !== 'drawing' || e.pointerId !== activePointer) return;
  activePointer = null;
  flight.endDrawing();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
