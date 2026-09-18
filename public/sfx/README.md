Drop real sound files here with these exact names — audio.ts already wires
each one up, and missing files are silently skipped (no errors), so the
game works with none, some, or all of these present.

- pull.ogg      — looped while drawing the bow (a taut string/rope creak)
- release.ogg   — one-shot, played the instant the arrow is loosed
- flight.ogg    — one-shot, played while the arrow is airborne
- hit.ogg       — one-shot, played when the arrow lands on the target
- miss.ogg      — one-shot, played on a miss (off-board or fell short)
- ambiance.ogg  — looped continuously in the background once loaded
- fire.ogg      — looped continuously (torches) once loaded

Files must be saved as .ogg with exactly these names — audio.ts fetches
each by its exact path (e.g. "sfx/pull.ogg"). If a source file is mp3/wav,
convert it first, e.g.: ffmpeg -i input.mp3 pull.ogg
