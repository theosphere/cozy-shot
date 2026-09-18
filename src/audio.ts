// Real recorded sound effects (see CREDITS.md for sources/licenses), played
// through the Web Audio API so we still get sample-accurate looping and
// live gain/pitch control — no synthesis, every buffer here is a decoded
// audio file. Browsers block audio until a real user gesture, so the
// context is created lazily and resumed on the first pointer interaction
// (see input.ts's unlockAudio() call).

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

const SOURCES = {
  pull: 'sfx/pull.ogg',
  release: 'sfx/release.ogg',
  flight: 'sfx/flight.ogg',
  hit: 'sfx/hit.ogg',
  miss: 'sfx/miss.ogg',
  ambiance: 'sfx/ambiance.ogg',
  fire: 'sfx/fire.ogg',
} as const;
type SoundName = keyof typeof SOURCES;

const buffers: Partial<Record<SoundName, AudioBuffer>> = {};

async function loadAll() {
  const audioCtx = ctx!;
  await Promise.all(
    (Object.keys(SOURCES) as SoundName[]).map(async (name) => {
      // Sound files are optional — drop them into public/sfx/ (see the
      // README there) whenever they're ready. A missing/undecodable file
      // just leaves that buffer unset; every play/loop call already
      // guards on the buffer being present, so nothing else is affected.
      try {
        const res = await fetch(SOURCES[name]);
        if (!res.ok) return;
        const data = await res.arrayBuffer();
        buffers[name] = await audioCtx.decodeAudioData(data);
      } catch {
        // ignore — this sound just stays silent
      }
    })
  );
  // Ambiance and fire are continuous background loops — start them as soon
  // as they're decoded, whenever that happens to land relative to unlock.
  startLoop('ambiance', 0.05, 3);
  startLoop('fire', 0.035, 3);
}

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(ctx.destination);
  loadAll();
}

function playOnce(name: SoundName, gainValue = 1, rate = 1): { src: AudioBufferSourceNode; gain: GainNode } | null {
  const buf = buffers[name];
  if (!ctx || !masterGain || !buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  src.connect(gain).connect(masterGain);
  src.start();
  return { src, gain };
}

const loopGains: Partial<Record<SoundName, GainNode>> = {};
const loopSrcs: Partial<Record<SoundName, AudioBufferSourceNode>> = {};
function startLoop(name: SoundName, targetGain: number, fadeSeconds: number) {
  const buf = buffers[name];
  if (!ctx || !masterGain || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(masterGain);
  src.start();
  gain.gain.linearRampToValueAtTime(targetGain, now() + fadeSeconds);
  loopSrcs[name] = src;
  loopGains[name] = gain;
}

// --- Pulling the string: a real creak, looped and pitched up with power --
let pullSrc: AudioBufferSourceNode | null = null;
let pullGain: GainNode | null = null;

export function startPullSound() {
  const buf = buffers.pull;
  if (!ctx || !masterGain || !buf) return;
  stopPullSound(true);
  const t = now();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.55, t + 0.08);
  src.connect(gain).connect(masterGain);
  src.start(t);
  pullSrc = src;
  pullGain = gain;
}
// Called every time the draw updates — power is 0..1, straight from
// flight.ts's currentPower(), so the creak's pitch tracks the pull. Kept
// to a narrow range: this is a rasping rope/string-under-tension texture
// (broadband creaks, not a tonal squeak), and too wide a playbackRate
// swing turns any real recording into a cartoon chipmunk squeal.
export function updatePullSound(power: number) {
  if (!pullSrc) return;
  pullSrc.playbackRate.linearRampToValueAtTime(0.9 + power * 0.45, now() + 0.05);
}
// immediate=true for a canceled (too-short) pull, no release tail needed.
export function stopPullSound(immediate = false) {
  if (!ctx || !pullSrc || !pullGain) return;
  const t = now();
  const rel = immediate ? 0.02 : 0.08;
  pullGain.gain.cancelScheduledValues(t);
  pullGain.gain.setValueAtTime(pullGain.gain.value, t);
  pullGain.gain.linearRampToValueAtTime(0, t + rel);
  pullSrc.stop(t + rel + 0.02);
  pullSrc = null;
  pullGain = null;
}

// --- Release: real bow-shot sample ------------------------------------------
export function playRelease(power: number) {
  playOnce('release', 0.8, 0.95 + power * 0.1);
}

// --- Flight: a quick whoosh, cut short if the arrow lands early ------------
let flightGain: GainNode | null = null;
let flightSrc: AudioBufferSourceNode | null = null;
export function startFlightSound() {
  const r = playOnce('flight', 0.5);
  if (!r) return;
  flightSrc = r.src;
  flightGain = r.gain;
}
export function stopFlightSound() {
  if (!ctx || !flightSrc || !flightGain) return;
  const t = now();
  flightGain.gain.cancelScheduledValues(t);
  flightGain.gain.setValueAtTime(flightGain.gain.value, t);
  flightGain.gain.linearRampToValueAtTime(0, t + 0.05);
  flightSrc.stop(t + 0.06);
  flightSrc = null;
  flightGain = null;
}

// --- Impact: hit or miss, real thuds ----------------------------------------
export function playHit(score: number) {
  // A slightly higher, brighter pitch on the best shots — still the same
  // real sample, just played back a little faster.
  playOnce('hit', 0.9, score >= 4 ? 1.15 : 1);
}
export function playMiss() {
  playOnce('miss', 0.8, 1);
}
