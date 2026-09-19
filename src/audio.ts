// Real recorded sound effects, played through the Web Audio API so we
// still get sample-accurate looping and live gain/pitch control — no
// synthesis, every buffer here is a decoded audio file. Browsers block
// audio until a real user gesture, so the context is created lazily and
// resumed on the first pointer interaction (see input.ts's unlockAudio()
// call).
//
// Most categories have several recorded variations (see public/sfx/) —
// each play picks one at random rather than always playing the same take.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

const SOURCES = {
  pull: ['sfx/pull/pull-01.ogg', 'sfx/pull/pull-02.ogg', 'sfx/pull/pull-03.ogg', 'sfx/pull/pull-04.ogg', 'sfx/pull/pull-05.ogg'],
  release: [
    'sfx/release/release-01.ogg',
    'sfx/release/release-02.ogg',
    'sfx/release/release-03.ogg',
    'sfx/release/release-04.ogg',
    'sfx/release/release-05.ogg',
  ],
  flight: ['sfx/flight/flight-01.ogg', 'sfx/flight/flight-02.ogg'],
  hit: [
    'sfx/hit/hit-01.ogg',
    'sfx/hit/hit-02.ogg',
    'sfx/hit/hit-03.ogg',
    'sfx/hit/hit-04.ogg',
    'sfx/hit/hit-05.ogg',
    'sfx/hit/hit-06.ogg',
    'sfx/hit/hit-07.ogg',
    'sfx/hit/hit-08.ogg',
    'sfx/hit/hit-09.ogg',
    'sfx/hit/hit-10.ogg',
    'sfx/hit/hit-11.ogg',
    'sfx/hit/hit-12.ogg',
    'sfx/hit/hit-13.ogg',
    'sfx/hit/hit-14.ogg',
  ],
  miss: ['sfx/miss/miss-01.ogg'],
  ambience: ['sfx/ambience/ambience-01.ogg', 'sfx/ambience/ambience-02.ogg', 'sfx/ambience/ambience-03.ogg'],
} satisfies Record<string, string[]>;
type SoundName = keyof typeof SOURCES;

const buffers: Partial<Record<SoundName, AudioBuffer[]>> = {};
function pickBuffer(name: SoundName): AudioBuffer | null {
  const list = buffers[name];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

async function loadAll() {
  const audioCtx = ctx!;
  await Promise.all(
    (Object.keys(SOURCES) as SoundName[]).map(async (name) => {
      const decoded: AudioBuffer[] = [];
      await Promise.all(
        SOURCES[name].map(async (path) => {
          // Every file is optional — a missing/undecodable one just isn't
          // added to the pool. A category with at least one loaded
          // variation still works; only pickBuffer's null case is skipped.
          try {
            const res = await fetch(path);
            if (!res.ok) return;
            const data = await res.arrayBuffer();
            decoded.push(await audioCtx.decodeAudioData(data));
          } catch {
            // ignore — this variation just isn't in the pool
          }
        })
      );
      buffers[name] = decoded;
    })
  );
  // Ambience is a continuous background loop — pick one of its variations
  // for this whole session (not re-rolled per play) and start it as soon
  // as it's decoded, whenever that lands relative to unlock.
  startAmbienceLoop();
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
  const buf = pickBuffer(name);
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

function startAmbienceLoop() {
  const buf = pickBuffer('ambience');
  if (!ctx || !masterGain || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(masterGain);
  src.start();
  gain.gain.linearRampToValueAtTime(0.05, now() + 3);
}

// --- Pulling the string: a real recording, looped and pitched up with
// power. One of the pull variations is picked when the draw begins and
// held for that whole draw (not re-picked while updating/looping).
let pullSrc: AudioBufferSourceNode | null = null;
let pullGain: GainNode | null = null;

export function startPullSound() {
  const buf = pickBuffer('pull');
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
// flight.ts's currentPower(), so the sound's pitch tracks the pull. Kept
// to a narrow range: too wide a playbackRate swing turns any real
// recording into a cartoon chipmunk squeal.
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

// --- Release: real bow-shot samples -----------------------------------------
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
  // A slightly higher, brighter pitch on the best shots — still a real
  // sample, just played back a little faster.
  playOnce('hit', 0.9, score >= 4 ? 1.15 : 1);
}
export function playMiss() {
  playOnce('miss', 0.8, 1);
}
