# Audio (`src/audio`)

Everything you hear is synthesized in code: no audio files, no network (ADR-013, docs/04 §11,
docs/06 §10). Try it all at **`/debug/audio`** (SFX board, music contexts, mixer, voices, an
event storm and an offline loudness meter).

## How it fits together
```
index.ts (entry chunk, tiny)          engine/ (lazy chunk, loaded by unlockAudio)
  playSfx · setMusic · speak  ──────▶   engine.ts   mixer, settings binding, SFX cache, ducking
  duckMusic · unlockAudio               music.ts    MusicDirector → ContextPlayers (live nodes)
  installAudioReactions ──▶ reactions/  voice.ts    blip utterances
```
- **`unlockAudio()`** creates the `AudioContext` inside the first user gesture (Safari/iOS),
  plays one silent sample, then `import()`s the engine. Before that, calls are cheap no-ops:
  SFX younger than 250 ms play when the engine arrives, older ones are dropped; the latest
  `setMusic` context is remembered. Without Web Audio (Node, old browsers) it all stays silent.
- **Mixer:** `music (director → tape wow/flutter → 35 Hz high-pass → duck) · sfx · voices ·
  ambience → master → limiter`. Slider positions from `settingsStore` become gains through
  `volumeToGain` (x², ≈ a 40 dB taper: 0.5 → −12 dB) with smooth ramps. A hidden tab suspends the
  context; any later gesture resumes it.
- **SFX** (`sfx/`): each `SfxId` is a recipe of layers in `sfx/presets.ts`: ZzFX patches (our
  typed port in `sfx/zzfx.ts`, MIT), tones, filtered noise (sweeps, random AM, crackle), bells
  (partials + strikes), instrument notes (bell, mallet, pluck, brass, pad, EP, timpani) and
  sparkle grains. `sfx/render.ts` mixes them, adds a small baked room, peak-normalizes to −1 dBFS
  and fades the edges. The engine pre-renders every variant in idle slices after unlock (~0.5 s
  of CPU in total) and plays cached `AudioBuffer`s with random rate jitter, per-sound minimum
  intervals and a 24-voice cap. Long tonal sounds render at half rate (`halfRate`).
- **Music** (`music/`): `generateBar(style, seed, bar)` is pure and seeded; the director asks
  for bars just ahead of a lookahead scheduler (`music/scheduler.ts`, 40 ms timer, 300 ms
  lookahead, notes always on the AudioContext clock, late notes skipped after a stall). Each
  note is a few short-lived Web Audio nodes; contexts crossfade over 2.4 s.
- **Voices** (`voice/`, `voiceProfile.ts`): `voiceForSeed(lookSeed)` gives pitch, timbre and
  talking speed; `planUtterance` makes one blip per syllable with a mood contour; the engine
  plays it through two band-pass formants.
- **Reactions** (`reactions/`): sim events → sounds the shell doesn't already play (door bell
  on `customer/entered`, register beeps on `sale/completed`, customer blips from bubbles and
  exit satisfaction, `shop.boxOpen` on `product/unboxed`), rate-limited per group, per
  customer and per second. The shell owns cha-ching, delivery, level-up, sheet sounds and music.

## Tweaking sounds
- **An SFX:** edit its layers in `sfx/presets.ts`, listen in `/debug/audio`, then run
  `npx tsx --tsconfig tsconfig.node.json scripts/audio/levels.ts` and set `gainDb` so its max
  momentary loudness fits its family: UI −36…−26, shop −26…−20, rewards −23…−18, stingers
  climbing −22 → −14.6 LUFS. Keep `gainDb ≤ −5` (headroom). ZzFX designer patches paste in as
  `{ kind: 'zzfx', params: [...] }` (set randomness to 0; use `jitter` instead).
- **Music:** `music/styles.ts` holds each context's key, tempo, swing, progressions (scale
  degrees, so chords stay diatonic), section form, patterns and mix. After changing levels, run
  the dev server and `npx tsx --tsconfig tsconfig.node.json scripts/audio/measure-music.ts`; it
  renders 48 s of each context through the real graph (OfflineAudioContext) and prints LUFS.
  Targets at full music volume: ≈ −16.5 LUFS for title/day/evening, night ≈ −17.5, opening
  bed ≈ −18.5, peaks ≤ −1.5 dBFS.
- **Channels, limiter, ducking, crossfade and scheduler timing:** `mixConfig.ts`.

| Context | Key | Tempo | Feel |
|---------|-----|-------|------|
| `title` | E♭ major | 72, swing 0.56 | warm and nostalgic: keys, pad, flute melody, side-stick |
| `day` | F major | 84, swing 0.60 | cozy chillhop: full kit, bass, Rhodes-style keys, music-box bell |
| `evening` | B♭ major | 76, swing 0.58 | mellower: side-stick, quarter hats, vibraphone, darker tape |
| `night` | D minor | 64, swing 0.55 | quiet summary: heartbeat kick, pad, keys, sparse music box |
| `opening` | D major | 96, straight | tense bed: D pedal, suspended chords, ticking hats, sparkle arpeggio, riser |

Pack stingers are in D major (they resolve the opening bed); UI rewards are in F major.

## Tests
`npx vitest run src/audio`: ZzFX port and every preset (finite, expected length, normalized,
no edge clicks, ascending stinger family), generator determinism, key, monophony and form,
scheduler math under jitter and stalls, voice profiles and utterances, the event → sound
mapping and rate limiter, the volume curve, and the facade's no-op and ref-counting behavior.
