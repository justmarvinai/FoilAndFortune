# 06 · Technical Architecture

> How Foil & Fortune is built. The key constraints from the brief: **the best possible stack**, **easily editable, expandable and adaptable code**, **deployed to Vercel**, and **no databases or backend**.
> Versions were checked on the npm registry on **2026-09-26**. Pin exact versions in `package.json` at scaffold time, and upgrade deliberately.

---

## 1. Goals & Constraints

| Goal | Consequence |
|------|-------------|
| Real-game look and feel | A real-time 3D scene, a custom game UI kit, juicy animation, audio |
| Static hosting (Vercel), no backend | A pure client-side SPA. Saves live in IndexedDB with file export/import. No runtime network calls |
| Easy to edit and extend | Data-driven content, a pure-TypeScript simulation, all tunables in one place, typed schemas, and "how to add X" recipes (§20) |
| Deterministic and testable | Seeded RNG streams, integer money, a headless simulation that runs in Node for tests and balance |
| Runs well on laptops and mid-range phones | Quality presets, instancing, lazy loading, performance budgets (§17) |

---

## 2. The Stack

| Concern | Choice | Version (major) | Why |
|---------|--------|-----------------|-----|
| Language | **TypeScript** (strict) | 7.0 (native compiler) | Type safety across content, sim and UI. TS 7's native compiler makes typechecks about 10× faster |
| Build and dev server | **Vite** | 8.x | Instant HMR, first-class static output, the Vercel default for SPAs |
| UI framework | **React** | 19.3 | The biggest ecosystem. R3F needs it. Suspense and transitions for smooth UI |
| Memoization | **React Compiler** (`babel-plugin-react-compiler` via `@rolldown/plugin-babel`, Babel 7) | 1.0 | Automatic memoization, so components stay plain and readable (ADR-029) |
| 3D | **three.js** + **@react-three/fiber** + **@react-three/drei** + **@react-three/postprocessing** | r186 · 9.8 · 10.7 · 3.1 | Declarative 3D in React with helpers (camera controls, instancing, lightformers, contact shadows) and post effects |
| State | **Zustand** + **Immer** | 5.x · 11.x | A minimal, fast, React-agnostic store. Immer gives immutable updates with simple mutation syntax |
| Styling | **Tailwind CSS** + CSS custom properties (design tokens) + dedicated effect CSS | 4.3 | Fast iteration and consistent tokens. Foil effects live in hand-written CSS layers |
| UI animation | **Motion** (`motion/react`) | 13.x | Springs, layout animations, gestures, exit animations |
| Audio | **Web Audio** only: our own engine with a TypeScript port of the ZzFX generator, procedural music and blip voices (ADR-013) | ZzFX 1.3 (ported) | Zero audio files, deterministic and testable; Howler and Tone.js aren't needed |
| Validation | **Zod** | 4.x | Content schemas, save validation, settings |
| Persistence | **idb-keyval** + **fflate** | 6.x · 0.8 | Tiny IndexedDB wrapper plus compression for export files |
| i18n | **i18next** + **react-i18next** | 26.x · 17.x | Standard and typed, with plurals and interpolation |
| Lists | **@tanstack/react-virtual** | 3.x | Virtualized inventory with thousands of cards |
| Icons | **lucide-react** (+ custom SVG game icons) | 1.x | ISC-licensed, consistent |
| Fonts | **@fontsource** packages (Lilita One, Nunito, Barlow, Barlow Condensed, Caveat, Atkinson Hyperlegible) | 5.x | Self-hosted OFL fonts, no external requests |
| Lint and format | **Biome** | 2.x | One fast tool for lint and format with no dependency on the TypeScript JS API (see ADR-014) |
| Tests | **Vitest** · **fast-check** · **Playwright** | 5.x · 4.x · 1.63 | Unit and statistical tests, property tests, end-to-end and screenshots |
| Scripts | **tsx** | 4.x | Runs TS scripts (content validation, balance sim, art rendering) |
| Offline and install | **vite-plugin-pwa** | 1.x | Precaching, offline play, update prompt |
| Debug (dev only) | **leva**, drei **`<StatsGl>`** | 0.10 · (drei) | Tweak panels and 3D performance overlay (ADR-030) |
| Hosting | **Vercel** (static) | — | Preview deploys per branch, CDN, zero config |
| Package manager | **npm** (Node ≥ 22) | — | Simple, the Vercel default |

### 2.1 Alternatives considered (and why not)
- **Phaser / PixiJS-only:** great for 2D sprites, but a management UI (tables, forms, scrolling lists, text input) is painful on canvas, and 2D isometric art at high quality needs a large hand-drawn asset set we can't source.
- **Godot / Unity web exports:** heavy downloads, weaker web UI/UX, awkward text-based editing of scene files, and harder integration with web tooling. The brief prioritizes editability and the web.
- **Next.js:** SSR and server features bring no benefit to a client-only game. Vite is simpler and faster.
- **Svelte / Solid:** excellent, but React's 3D ecosystem (R3F, drei) is decisive.
- **Babylon.js:** capable, but R3F's composition with React UI is a better fit.
- **Redux Toolkit:** heavier than needed. Zustand plus a pure sim covers it.

---

## 3. Architecture Overview

```
                ┌────────────────────────── content/ (data) ─────────────────────────┐
                │ sets · cards · species · products · customers · fixtures · events  │
                │ achievements · manga · balance/*.ts (ALL tunables) · zod schemas    │
                └───────────────┬────────────────────────────────────────────────────┘
                                │ registry (read-only lookups)
┌───────────────────────────────▼───────────────────────────────┐
│ sim/  PURE TypeScript: no React, DOM, three or timers          │
│  commands → handlers (validate + mutate draft) → DomainEvents  │
│  systems: clock · customers · checkout · market · suppliers ·  │
│           grading · staff · reputation · events · progression  │
│  generators: packs · lots · customers · candidates · Set Forge  │
│  deterministic: seeded RNG streams, integer cents              │
└───────────────┬───────────────────────────────▲────────────────┘
                │ GameState (serializable)        │ Commands
┌───────────────▼──────────────── state/ ─────────┴──────────────┐
│ Zustand store: game (GameState) + ui (transient) · GameLoop     │
│ event bus → presentation (sfx, vfx, toasts) · selectors/hooks   │
└──────┬──────────────────┬──────────────────┬──────────────┬─────┘
       │                  │                  │              │
 ┌─────▼─────┐     ┌──────▼──────┐     ┌─────▼────┐   ┌─────▼─────┐
 │ scene/    │     │ ui/ +       │     │ audio/   │   │ save/     │
 │ R3F shop  │     │ features/   │     │ Web Audio│   │ IndexedDB │
 │ diorama   │     │ React HUD & │     │ synth    │   │ migrations│
 │ agents,   │     │ panels,     │     │          │   │ export/   │
 │ build mode│     │ cards/, art/│     │          │   │ import    │
 └───────────┘     └─────────────┘     └──────────┘   └───────────┘
```

**The golden rule:** the **sim decides, the presentation shows.** The sim never imports React, three, DOM APIs, `Date.now()` or `Math.random()`. That's what makes it testable, replayable, and runnable headless in Node for balancing. It could also move to a Web Worker later if ever needed.

---

## 4. Folder Structure

```
/
├─ CLAUDE.md · README.md · ROADMAP.md · CHANGELOG.md · USER_QUESTIONS.md · CREDITS.md
├─ docs/                        # design and technical docs (this folder)
├─ public/                      # static files served as-is
│  ├─ art/v<N>/<set>/           # pre-rendered card art (WebP), versioned folders
│  ├─ audio/                    # music (ogg/m4a) and sampled SFX sprites
│  └─ icons/ · manifest assets
├─ scripts/                     # Node/tsx tools (never shipped)
│  ├─ content/validate.ts       # schemas, references, blocklist, EV checks
│  ├─ balance/simulate.ts       # headless balance simulator plus bots
│  ├─ art/render.ts             # Playwright renders card art → WebP
│  └─ assets/optimize.ts        # image and audio optimization, atlases
├─ src/
│  ├─ main.tsx · App.tsx
│  ├─ app/                      # boot, screen manager, providers, error boundary, loading
│  ├─ core/                     # rng, math, time, ids, money (cents), format, bus, assert, types
│  ├─ content/                  # DATA ONLY (+ define helpers, schemas, registry)
│  │  ├─ schema/                # zod schemas for every content type
│  │  ├─ balance/               # time, difficulty, finance, shop, customers, haggle, cards, grading,
│  │  │                         # progression, suppliers, packs, market, reputation, staff, manga, events
│  │  ├─ tcg/gk/                # brand.ts · elements.ts · species/*.ts · sets/<slug>.ts · products.ts · packs.ts
│  │  ├─ manga/                 # series/*.ts
│  │  ├─ customers/             # archetypes.ts · regulars/*.ts · names.ts · dialogue/*.ts
│  │  ├─ shop/                  # tiers.ts · fixtures.ts · decor.ts · upgrades.ts
│  │  ├─ suppliers/ grading/ staff/ events/ achievements/ goals/ story/ lots/
│  │  └─ registry.ts            # builds typed lookup maps. Card index is eager, card details lazy
│  ├─ sim/                      # PURE simulation
│  │  ├─ state/                 # GameState types, createNewGame, pure selectors
│  │  ├─ commands/              # one file per domain: handler + validation
│  │  ├─ systems/               # clock, customers, checkout, restock, market, suppliers, grading,
│  │  │                         # staff, reputation, events, progression, achievements, rivals, world
│  │  ├─ generators/            # packOpening, lots, customerFactory, candidates, setForge, names
│  │  ├─ events.ts              # DomainEvent union
│  │  └─ engine.ts              # createNewGame, dispatch, tick, phase transitions
│  ├─ state/                    # zustand store, GameLoop, event bridge, hooks (useGame, useUi)
│  ├─ save/                     # SaveFile schema, slots, migrations/, export/import
│  ├─ scene/                    # R3F: ShopScene, CameraRig, Lighting, shell/, fixtures/, products/,
│  │                            # agents/ (Peg-folk + motion), build/, vfx/, overlay/ (DOM bubbles)
│  ├─ cards/                    # CardView, CardBack, SlabView, PackView, foil/*.css, layout/
│  ├─ art/                      # genome types, sdf/ shaders, svg/ parts, composer, art registry, cache
│  ├─ ui/                       # design system: tokens.css, components/, themes (sheets)
│  ├─ features/                 # hud, day-summary, pack-opening, inventory, pricing, crate, market,
│  │                            # binder, grading, negotiation, appraisal, sorting, staff, build,
│  │                            # upgrades, goals, achievements, events, reputation, manga, title,
│  │                            # new-game, tutorial, settings, saves, auction, card-show, city-map
│  ├─ audio/                    # AudioManager, music director, sfx (zzfx presets), voice blips
│  ├─ i18n/                     # setup.ts, locales/en/*.json
│  ├─ debug/                    # dev panel, cheats, scenarios, galleries (/debug/ui, /debug/art)
│  └─ styles/                   # global.css (tailwind entry), fonts.css, foil.css
├─ tests/                       # e2e/ (Playwright), fixtures/ (saves, scenarios)
└─ config: vite.config.ts · tsconfig.json · biome.json · vercel.json · playwright.config.ts · .github/workflows/ci.yml
```
Unit tests are **colocated** (`foo.ts` next to `foo.test.ts`).

---

## 5. Simulation Engine (`src/sim`)

### 5.1 State
`GameState` is a single **plain, serializable object** (no classes, Maps, Sets or functions; `Record`s and arrays only). Money is **integer cents**. The full shape is in `07_DATA_MODEL.md`.

### 5.2 API
```ts
createNewGame(opts: NewGameOptions, ctx: SimContext): GameState
dispatch(draft: GameState, cmd: Command, ctx: SimContext): CommandResult   // player/staff/bot actions
tick(draft: GameState, ctx: SimContext): void                              // advance 1 game-minute
advancePhase(draft: GameState, ctx: SimContext): void                     // prep → open → night → prep
// ctx = { content: ContentRegistry, balance: BalanceConfig, emit(e: DomainEvent): void }
```
- **Commands** are serializable discriminated unions (`{ type: 'pricing/setPrice', productId, cents }`). Handlers **validate first** and return typed errors (`{ ok: false, code: 'NOT_ENOUGH_CASH' }`) that the UI turns into friendly messages. Bots in the balance sim and tests dispatch the **same** commands the UI does.
- **Domain events** (`sale/completed`, `product/opened`, `card/pulled`, `customer/left`, `level/up`, `grading/returned`…; full list in `07 §5`) are emitted during dispatch and tick, then delivered to presentation (sounds, VFX, toasts) and to in-sim listeners (achievements, goals, stats).

### 5.3 Tick order (each game-minute while OPEN)
`clock → scheduledEvents → customerSpawn → customerAgents (browse/decide/queue) → staffAutomation → checkout → vending → reputationSignals`
**Night pipeline (on close):** ledger close · wages · grading progress · rent (Sunday) · review resolution · morale · objectives reset · autosave point.
**Dawn pipeline (prep start):** market daily update · world calendar (releases, print status, manga releases) · supplier restock · deliveries · event roll · newspaper · candidate refresh (Mondays) · autosave (ring) · weekly autosave (Mondays).

### 5.4 Determinism
- **RNG:** a small seeded PRNG (sfc32) with **independent streams** per domain (`customers`, `market`, `packs`, `grading`, `events`, `staff`, `misc`), stored in state. Opening a pack never shifts tomorrow's market.
- **No wall clock** in sim. Time comes only from the sim clock.
- **Replays:** `seed + command log` reproduces a session, which is used for bug reports and regression tests.

### 5.5 Scale strategies
- **Card stacks vs instances:** bulk cards are **stacks** keyed by `(cardId, finish, stamp, condition)` with counts. Only notable cards (Holo Rare+, graded, inspected, in cases, or in the binder) become **instances** with sub-scores. Sub-scores for stack cards are generated **lazily and deterministically** when a card is split out (inspected, graded, displayed).
- **Market:** factor models (species, set, meta) update in O(species + sets + cards). History is kept only for *tracked* items (owned, watchlisted, Holo+, sealed), encoded compactly (Int32 cents → base64).
- **Content:** a small eager **card index** (id, rarity, species, baseValue, playability) for the sim. Heavy display data (attack text, flavor, art keys) is lazy-loaded per set.

### 5.6 Customer agents: sim/view split
The sim owns each customer's **logical plan** (intent, target fixture, timings, basket, patience). Walking durations come from grid A* path lengths. The view **animates** the agent along the same path, interpolating between sim ticks. Headless mode uses identical timings, so balance results match real play.

---

## 6. State Management (`src/state`)
- **Store:** `useGameStore = create(immer((set, get) => ({ game, ui, actions })))`. `game` is `GameState` (persisted). `ui` holds transient UI state (open sheet, selection, camera, never persisted).
- **GameLoop:** a `requestAnimationFrame` accumulator converts real time × speed into whole ticks (max 20 ticks per frame for catch-up). It runs all ticks for the frame inside **one** `set()` call, then flushes buffered domain events to the event bus. The loop pauses when the tab is hidden.
- **Subscriptions:** components select narrow slices (`useGame(s => s.finance.cashCents)`, `useShallow` for objects) to keep re-renders small.
- **Per-frame data** (agent positions, particles, bubble screen positions) lives **outside React**, in plain mutable runtime objects read in `useFrame` or a rAF overlay updater. It never goes in Zustand.
- **Presentation bus:** a typed `mitt` bus (`presentationBus.on('card/pulled', …)`) drives sounds, VFX and toasts without coupling the sim to UI.

---

## 7. 3D Scene (`src/scene`)

```tsx
<Canvas orthographic shadows dpr={[1, quality.maxDpr]}>
  <CameraRig />                 // iso camera, 90° rotations, zoom levels, pan bounds
  <Lighting />                  // time-of-day and season driven; lamps at evening
  <ProceduralEnvironment />     // Lightformers → env map (no HDRI download)
  <ShopShell tier={tier} />     // floor, back walls, windows, door, street plinth, sign
  <Fixtures />                  // procedural fixture components, merged geometries
  <ShelfProducts />             // InstancedMesh per product family, texture atlas
  <Agents />                    // customers, staff, owner (Peg-folk + procedural anim)
  <BuildModeLayer />            // grid, ghost, validity, path preview
  <Effects quality={q} />       // SMAA, bloom, AO, vignette, tilt-shift
</Canvas>
<WorldOverlay />                // ONE DOM layer: bubbles, popovers, floating +$ (projected coords)
```
- **Picking:** R3F pointer events on simplified collider meshes. Hover outlines use emissive highlight or an outline pass on High.
- **Pathfinding:** grid A* on the tile map. Paths are cached per (from, to) and invalidated on layout change. Build mode uses the same grid for placement validity and a reachability check (door → counter → every access tile).
- **Instancing and atlases:** packs, boxes, slabs and manga spines are drawn as instances with per-instance UV offsets into a generated **product atlas** (canvas-rendered from pack art at load time).
- **Quality presets:** *Low* (no shadows, no post, DPR 1) · *Medium* (1024 shadow map, SMAA, bloom) · *High* (soft shadows, AO, tilt-shift, physical glass, DPR ≤ 2). Auto-detect runs on first launch, and the player can override it.
- **Overlay performance:** bubbles are positioned by projecting 3D anchors once per frame and writing `transform` directly (no React re-render per frame).
- **Live scene contract** (`src/scene/live/types.ts`): the play screen renders `LiveShopScene` with `quality`, `insets`, `shopName`, `paused` (true under the Day Summary and the pack stage, which stops the render loop) and `anchored` (the Fixture Popover, placed above or below its fixture by the pure `placeAnchored` and clamped to the viewport minus the insets). The scene reads the game through narrow selectors, animates customers every frame from their sim `activity` and `simNow()`, and reports clicks through callbacks; it never dispatches commands.

---

## 8. Cards & 2D (`src/cards`)
- **CardView** is layered DOM: `frame (SVG) → art (<img>/<canvas>) → text (HTML) → foil layers (CSS) → stamps and overlays`. Props: `cardId`, `print` (finish, stamps, misprint), `condition?`, `slab?`, `size`, `interactive`.
- **Foil engine:** CSS custom properties (`--mx`, `--my`, `--angle`, `--foil-intensity`) are set from pointer or tilt on a single rAF-throttled handler. Each foil type is a CSS class stacking gradients, masks and blend modes (`foil.css`). **Our own implementation** (see the GPL note in `CLAUDE.md`).
- **Art resolution:** `useCardArt(cardId, variant)` resolves in order: **user override** (`/art/overrides/…`) → **pre-rendered** (`/art/v<N>/<set>/<nnn>.webp`) → **runtime render** (art engine, cached) → element-tinted **placeholder**. Suspense-friendly, with a shimmer placeholder while loading.
- **Performance:** binder pages render 9 cards with foil on hover only. Inventory uses `CardThumb` (no foil, small art). A full CardView is used only for focused cards.

---

## 9. Art Engine (`src/art`) (see `04 §6`)
- **Genome:** a data description of a species (body plan, parts, palette, patterns, features, expression set). Evolutions reference a parent genome plus "growth" modifiers.
- **Style A, SDF renderer:** WebGL2 full-screen shader. The genome compiles to a uniform buffer and part list (smooth-union SDF primitives). Soft shadows, AO, rim light and glossy eyes. Backgrounds are procedural biomes. It renders into an offscreen canvas and returns an `ImageBitmap` or `Blob`.
- **Style B, SVG composer:** part library plus palette mapping, producing an optimized SVG string.
- **Build-time render:** `npm run art:render -- --set emberdawn` drives the renderer in headless Chromium (Playwright), encodes WebP on a canvas (stepping the quality down until the file fits its budget), and writes `public/art/v<N>/<set>/`. Output is committed with a manifest (renderer version, genome hash, seed, input hash), and unchanged cards are skipped, so builds stay fast and reproducible.
- **Runtime render** (Set Forge sets): the same code runs in the browser and caches results in IndexedDB (`art-cache` store, key = hash of genome version + card + variant).

---

## 10. Audio (`src/audio`)
- **AudioManager:** channels (Master, Music, SFX, Voices, Ambience) with persisted volumes. Audio unlocks on the first user gesture, with a friendly "click to start" on the title screen.
- **Music director:** a procedural lo-fi generator (seeded 8-bar phrases: swing drums, bass, extended-chord keys, melody, tape warmth) with contexts for title, day, evening, night and pack opening (later: event, card show, auction). Notes are scheduled ahead on the audio clock; contexts crossfade, and music ducks under reveals.
- **SFX:** ZzFX patches (a TypeScript port of the generator) plus layered synthesis for what ZzFX can't do well (foil pack tear, bells, coins), rendered after unlock into cached `AudioBuffer`s. Zero audio files. The engine loads lazily on the first gesture; `src/audio/index.ts` is a tiny facade.
- **Blip voices:** Web Audio oscillators with formant-ish filters. Pitch and timbre come from the character's voice profile, and rhythm from the text's syllables.

---

## 11. Persistence (`src/save`)
- **SaveFile:** `{ format: 'ff-save', saveVersion, gameVersion, savedAt, slot, summary: { shopName, day, level, cashCents }, state: GameState }`.
- **Storage:** IndexedDB (`idb-keyval` custom store `foil-and-fortune/saves`). Slots: 3 manual, a ring of 3 **autosaves** (every prep start), and 1 **weekly autosave** (`auto-weekly`, every Monday prep, which Tycoon bankruptcy reloads). The app calls `navigator.storage.persist()` to reduce eviction.
- **Migrations:** `save/migrations/NNN-description.ts`, applied sequentially from the file's `saveVersion` to the current one. **Every** schema change bumps `saveVersion` and ships a migration plus a fixture test (`tests/fixtures/saves/`).
- **Export/Import:** JSON → deflate (`fflate`) → base64 in a `.ffsave` text file with a header line. Import runs size limits, Zod validation, migrations and then load. There's an in-game weekly reminder to export a backup, since browser storage can be cleared.
- **Settings** live in `localStorage` (`ff.settings`), validated with defaults and separate from saves.
- **Corruption handling:** if the latest autosave fails validation, offer the previous one. Never crash to a blank screen.

---

## 12. Content Pipeline (`src/content`)
- Content is authored as **typed TypeScript data** with `define*()` helpers (`defineSet`, `defineSpecies`, `defineProduct`, `defineEvent`…) for autocompletion and inline docs, and validated by **Zod** schemas at test and build time.
- **Registry:** `registry.ts` builds lookup maps once. The card index is eager, and per-set detail modules are loaded with dynamic `import()`.
- **`npm run content:validate`** checks unique and stable IDs, cross-references (species, sets, products, packs), pull tables summing to 1, EV within targets (`02 §11.3`), the name blocklist (well-known franchise names, profanity), missing i18n keys, and missing art (a warning).
- **Card authoring:** a set file can define cards explicitly, or use **roster helpers** that expand a compact roster (species × rarity × art) into full card definitions with generated attacks from element templates. Hand-written text always wins.

---

## 13. Internationalization (`src/i18n`) (**Q4**)
- i18next with namespaces (`common`, `hud`, `tutorial`, `customers`, `events`, `achievements`, `content`). Keys are typed through TS declaration merging.
- Content display names default to English in content files. The `content` namespace can override them per locale by content ID.
- Numbers, currency and dates use `Intl` (for example `$1,234.56` in `en`, `1.234,56 $` in `de`).
- **Rule:** no user-facing string literals in components or sim messages. The sim emits **codes and params**, and the UI translates them.

---

## 14. Testing Strategy
| Layer | Tool | What |
|-------|------|------|
| Sim unit | Vitest (node) | Each system and command handler: happy paths, validation errors, edge cases |
| Statistical | Vitest + fixed seeds | Pull rates within ±3σ over 200k packs · condition and grade distributions (`02 §8`) · customer mix · EV targets |
| Property | fast-check | Random command sequences keep invariants: cash in integer cents, no negative stock, card conservation (a pack yields exactly N cards), save round-trip equality, no NaN |
| Balance | `balance:sim` | Pacing and economy KPIs (`02 §18`). A smoke run in CI |
| Migrations | Vitest | Each fixture save migrates and validates |
| Components | Vitest + happy-dom + Testing Library | Critical UI logic (stepper math, negotiation controls) |
| E2E | Playwright | Boot → new game → first tutorial steps → open pack → save/reload. Desktop and phone screenshots for **visual review** |

**Visual QA protocol:** after UI or scene changes, run the app and capture Playwright screenshots (1440×900 and 915×412 landscape phone). Review them before calling the work done. Chromium is pre-installed in the cloud dev container. Use `executablePath` if Playwright's pinned browser differs.

---

## 15. Tooling & Code Quality
- **tsconfig:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `moduleResolution: bundler`, path alias `@/* → src/*`.
- **Biome:** lint and format (2 spaces, single quotes, semicolons, trailing commas, width 100). Rules include hook dependency checks and no unused imports or variables.
- **npm scripts:** `dev` · `build` · `preview` · `typecheck` · `lint` · `format` · `test` · `test:watch` · `test:e2e` · `content:validate` · `balance:sim` · `art:render` · `assets:optimize` · **`check`** (typecheck + lint + test + content:validate, run before every commit).
- **CI (GitHub Actions):** Node 22, `npm ci`, `npm run check`, `npm run build`, balance smoke. E2E runs on main and on PRs labeled `e2e`.
- **React Compiler:** evaluate in Phase 1 (`babel-plugin-react-compiler` via `@rolldown/plugin-babel`). Adopt it only if it plays well with R3F and doesn't slow builds noticeably.

---

## 16. Build & Deployment
- **Vite:** `build.target: 'es2022'`. Manual chunks: `three` (three and @react-three/*), `react`, `motion`. Heavy features (binder, market charts, build mode, art engine) are lazy-loaded with `React.lazy`. `__APP_VERSION__` is injected from `package.json`.
- **Assets:** hashed assets in `/assets/*`. Versioned static folders (`/art/v3/<set>/…`, `/audio/v2/…`) so they can be cached immutably.
- **PWA:** `vite-plugin-pwa` with `registerType: 'prompt'`. It precaches the app shell and core assets, runtime-caches art and audio (CacheFirst), and shows an in-game **"Update available"** toast.
- **Vercel:** framework preset Vite, build `npm run build`, output `dist`. A `vercel.json` sets immutable cache headers for hashed and versioned assets, a strict **Content-Security-Policy** (self only; `blob:`/`data:` for images and audio; no external origins), and an SPA fallback. Every branch gets a **preview deployment**.
- **Versioning:** SemVer `0.x` until v1.0. Each roadmap phase bumps the minor version. `CHANGELOG.md` is updated in the same commit.

---

## 17. Performance Budgets
| Metric | Budget |
|--------|--------|
| Initial JS (gzip, before the 3D chunk) | ≤ 450 KB |
| Title screen interactive (mid laptop, fast 4G) | < 3 s |
| Frame rate | 60 fps desktop (High) · ≥ 30 fps mid-range phone (Low) |
| Draw calls (Tier 5 shop, 40 agents) | < 250 |
| JS heap | < 400 MB |
| Save size (typical late game) | < 2 MB |
| Card art | ≤ 30 KB (art window WebP) · ≤ 70 KB (full art) |

Tools: drei `<StatsGl>` in debug, Chrome performance traces, a bundle visualizer, and the balance sim for CPU time per simulated day.

---

## 18. Security & Privacy
No accounts, no tracking, **no runtime network requests** (fonts and assets are self-hosted). Analytics are off unless the user opts in (**Q24**). Save imports are size-limited and schema-validated, and there's no `eval`. The strict CSP is in `vercel.json`.

---

## 19. Debug Tools (`src/debug`, dev builds or `?debug=1`)
A **dev panel** (leva): time warp (jump to hour or day), add cash, XP or reputation, spawn a customer by archetype, trigger any event, unlock everything, bulk-open N packs with a stats readout, set the RNG seed. **Scenario loader** (JSON presets: "Day 1", "Mid-game Tier 3", "Late-game empire"). **Galleries:** `/debug/ui` (all components), `/debug/art` (all species × poses × styles), `/debug/cards` (every frame and foil). **Save inspector** (view and diff state). drei `<StatsGl>` overlay. Debug pages are exempt from i18n (ADR-031).

---

## 20. Extension Recipes ("How do I add…")

| I want to add… | Steps |
|----------------|-------|
| **A TCG set** | 1) `content/tcg/gk/sets/<slug>.ts` with `defineSet({ id, code, name, releaseDay, era, packConfig, roster/cards, products })` · 2) species genomes if new (`content/tcg/gk/species/`) · 3) `npm run art:render -- --set <slug>` · 4) i18n names if localized · 5) `npm run content:validate` (EV, IDs) · 6) add to `03 §4` timeline and the CHANGELOG |
| **A product type** | Add the kind to `content/schema/product.ts`, define the SKU in `products.ts` with contents and SU, add opening behavior in `sim/generators/packOpening.ts` if new, then add art or 3D prop mapping |
| **A customer archetype** | `content/customers/archetypes.ts` entry (budget, knowledge, preferences, haggle mix, rep gate), dialogue lines in `content/customers/dialogue/<id>.ts`, visual cues in `scene/agents/looks.ts`, then balance weights in `balance/customers.ts` |
| **An event** | `content/events/<id>.ts` with `defineEvent({ id, category, weight, conditions, cooldownDays, urgent, choices: [{ labelKey, effects }] })`. Effects use the shared **effect DSL** from `07 §2.4` (`cash`, `traffic`, `marketShock`, `reputation`, `spawnCustomer`, `grantProduct`, `supplierPrice`, `closeEarly`, `flag`). Add i18n strings and a test for its effects |
| **A fixture or decor** | `content/shop/fixtures.ts` (footprint, capacity, categories, appeal, cost, unlock) plus a procedural model component in `scene/fixtures/` (or a CC0 model mapping) |
| **An upgrade** | `content/shop/upgrades.ts` plus the effect hook in the relevant system (checked via `hasUpgrade(state, id)`) |
| **An achievement** | `content/achievements/*.ts` with `defineAchievement({ id, category, condition: { stat, gte } \| custom, reward })`. Prefer stat-based conditions (auto-tracked) |
| **A manga series** | `content/manga/series/<slug>.ts` (volumes, cadence, popularity profile, cover template params) |
| **A grading company** | `content/grading/<id>.ts` (bias, σ, scale rules, fees, multipliers, label style) plus a slab label component variant |
| **A staff role or trait** | `content/staff/roles.ts` / `traits.ts` plus the effect in `sim/systems/staff.ts` |
| **A language** | `src/i18n/locales/<lang>/*.json`, register it in `i18n/setup.ts`, add it to the Settings language list |
| **A balance tweak** | Edit `src/content/balance/<domain>.ts` → `npm run balance:sim` → update `02_ECONOMY_BALANCING.md` if targets or constants changed |
