// A single shared animation clock. Anything that needs "how much time has
// passed" (gem pulse, torch flicker, the overdraw wobble) imports simTime
// directly instead of having it threaded through as a parameter.
export let simTime = 0;
let lastTime = performance.now() / 1000;

export function advance(): number {
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastTime, 0.1);
  lastTime = now;
  simTime += dt;
  return dt;
}
