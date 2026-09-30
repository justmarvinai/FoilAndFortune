# Changelog

All notable changes to **Foil & Fortune** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/) (`0.x` until the v1.0 release; each roadmap phase bumps the minor version).

## [Unreleased] · Phase 2: Vertical Slice "One Day at the Nook"
### Added
- **GameState v2** (save migration `001-phase2-shop` with a fixture test): owner avatar, the shop layout with fixture slots, singles as card stacks, customer agents and the register lane, supplier orders, the binder, unlocks and placeholder perks, reputation signals and the day log.
- **Shop content:** fixtures, the Nook starter layout on a 1 m tile grid (validated for bounds, overlaps, wall contact and free access), Budget Box Co., the Kid and Casual customer archetypes, level 1–5 unlocks with placeholder perks, and balance tables for customers, card values and packs.
- **Sim systems:** stocking (fill, clear, Restock All, per-slot prices), pricing and market references with price-reaction buckets, supplier orders (paid up front, closet space checked, delivered at dawn), the binder, XP sources with level-up unlocks, nightly reputation from customer signals, and shared tile navigation with the register lane.
- **Pack generator and opening** (`src/sim/packs`): slot tables with a rarity fallback for partial sets, god packs, misprints (stored as `misprint.<kind>` stamps with their value premium), booster-box mapping (≥ 6 Holo Rares and ≥ 2 Ultra-or-better, Mythic never forced), hidden onboarding luck (a Sparkit holo in the first pack, an Illustration Rare or better in the first box), starter decks with a guaranteed holo last, and blister promos. Opening grants XP per pack, new card and hit, updates the day log and the best pull, and records the opened cost. **Break the box** turns a booster box into 36 loose packs with an exactly split cost. A pack EV helper checks the docs/02 §11.3 target.

### Changed
- The owner chose **Clay Critters for all card art** (ADR-006). `/debug/art` is now a Clay card gallery.
- Failed commands are atomic: no partial state change and no events.

### Removed
- Style B "Sticker Pop" renderer and its workshop page (not chosen; recoverable from git at `9efe6c0`).

## [0.1.0] – 2026-09-30 · Phase 1: Foundation & Art Spike
### Added
- **Project scaffold:** Vite 8 (Rolldown), React 19.3 with the **React Compiler**, TypeScript 7 (strict), Tailwind CSS 4, Biome 2, Vitest 5, Playwright, `vercel.json` (SPA rewrites, strict CSP, immutable asset caching) and a GitHub Actions CI workflow (check, build, E2E).
- **Core** (`src/core`): seeded sfc32 RNG with independent streams, integer-cents money with formatting, the game calendar (Day 1 = Spring 8, a Monday), a typed event bus, math helpers, and a CSP-safe Zod setup.
- **Content** (`src/content`): Zod schemas for brands, species genomes, sets, cards, pack configs and products; the Glimmerkin brand, its 9 elements, 3 species (Sparkit, Emberpup, Sploot) and 5 Emberdawn spike cards; a content registry; balance config for time, difficulty, progression, reputation and shop tiers; `npm run content:validate`.
- **Simulation** (`src/sim`): GameState v1, `createNewGame`, command dispatch with typed validation errors, the one-minute tick, the prep → open → night day cycle, weekly Sunday rent with automatic bank loans, XP and levels, domain events, and pure selectors. Determinism is property-tested with fast-check.
- **State bridge** (`src/state`): Zustand + Immer store (events are published after each commit), a requestAnimationFrame `GameLoop` with catch-up caps and batched play-time updates, the presentation bus, serialized autosaves, and a `useCommand` hook that turns validation errors into friendly toasts.
- **Saves** (`src/save`): IndexedDB slots (3 manual, a 3-deep autosave ring, a Monday weekly save), a migration framework with a frozen v1 fixture, corruption fallback, `.ffsave` export/import (deflate + base64 with size guards), and settings.
- **UI kit** (`src/ui`): design tokens, fonts, Button, Panel (paper, clipboard, tablet, receipt), StarRating, ProgressBar, MoneyCounter, SpeedControl, SegmentedControl (native radios), Toasts, Modal, Tooltip, Stamp, Sticker, RarityGem, ElementIcon; an app-wide error boundary with a friendly crash screen; i18n (English) for everything a player sees.
- **Cards** (`src/cards`): CardView with standard and full-art layouts, our own foil effects (holo, reverse holo, textured full art, gold) with pointer tilt and an idle shimmer, and the Glimmerkin card back.
- **Debug pages:** hub (`/`), UI kit gallery (`/debug/ui`), card art spike (`/debug/art`), and the **Engine Sandbox** (`/debug/engine`): a prototype HUD, day-cycle clipboard, stock and price editor, ledger, save slots with export/import, a live domain-event log, and a leva dev panel (time scale, skip hour/day/week, grants, raw state).
- **Art Spike A, the shop diorama** (`src/scene`, `/debug/scene`): the Tier-1 Nook as a 3D toy diorama on a walnut street plinth (35° orthographic camera with animated 90° turns, zoom and pan). It has cut-away walls, procedural fixtures (pack wall, counter and register, display case, bargain bin, manga shelf, neon OPEN sign and more) and instanced product atlases. Peg-folk customers and the shopkeeper have 9 expressions and procedural poses, and one scripted customer walks the full loop with intent bubbles on a single DOM overlay. Day↔evening lighting uses Lightformer reflections (no HDRI), with AO, bloom, tilt-shift and three quality tiers. Everything is procedural: no downloaded assets, no network requests.
- **Art Spike, Style A "Clay Critters"** (`src/art/clay`): soft vinyl-toy creatures, ray-marched in WebGL2 from signed-distance fields generated from the genome. It has quadruped and amphibian rigs with pose variants, painted eyes and mouths, three biome backdrops at day, dusk and night, element glows and particles, and a neutral tone curve with a print-like grade. It uses one shared WebGL2 context with a serial queue, caches shader programs, and offers `draft`/`final`/`ultra` quality. Playground at `/debug/clay` (state lives in the URL).
- **Art Spike, Style B "Sticker Pop"** (`src/art/sticker`): a deterministic SVG part kit that reads the creature genome. It draws bold ink outlines, a white die-cut border, one-tone cel shading with gloss, big highlighted eyes and seeded element effects. It includes storm meadow, volcano dawn and lagoon scenes at day, dusk and night, with extra drama in full art. `buildStickerSvg()` returns a pure SVG string; `render()` returns a PNG. Playground at `/debug/sticker`.
- **Tests:** 108 unit tests (sim, saves, state bridge, calendar, money, RNG, content, tokens, art requests, sticker and clay pipelines, diorama camera, motion, easing and customer-script logic) and 34 Playwright tests on desktop and phone landscape, all running under the production Content-Security-Policy, including guards that non-3D pages never download the three.js chunk.
- Credits and license texts in `public/licenses/`: the bundled fonts (OFL), Lucide icons (ISC), and the shader snippets adapted from Inigo Quilez and David Hoskins (MIT) and Khronos (Apache-2.0).

### Decisions
- The owner chose "use your recommendations": every ⭐ default in `USER_QUESTIONS.md` is accepted (ADR-004, 013, 016, 017, 020–025, 028). The creature art style (ADR-006, Q2) is picked after the Art Spike.
- ADR-029 React Compiler adopted · ADR-030 leva + drei `StatsGl` instead of `r3f-perf` · ADR-031 debug pages are exempt from i18n.

## [0.0.1] – 2026-09-26 · Planning
### Added
- **Game Design Document** (`docs/01_GAME_DESIGN.md`): vision, 5 design pillars, core, day and meta loops, and every system in the brief (shop and upgrades, products, pack opening, conditions, grading, customers, haggling, buying collections, market, suppliers, reputation, manga, employees, events, progression, collection and binder, goals and achievements, long-term goals, story and onboarding, difficulty modes, scope tiers).
- **Economy & balancing** (`docs/02_ECONOMY_BALANCING.md`): formulas and starting values for traffic, willingness to pay, haggling, card values, conditions and grading, XP curve, a 50-level unlock table, supplier price lists, pull rates and EV targets, the market model, reputation, staff, manga, and balance-simulator KPIs. The grading model (4 companies) was calibrated with a 200,000-card Monte Carlo simulation, and reputation pacing was checked against the unlock gates.
- **Content bible** (`docs/03_CONTENT_BIBLE.md`): the Brightbay setting, the Glimmerkin TCG (9 elements, rarity ladder, finishes, stamps, misprints, product lineup), a 16-set timeline, 56 creature species, 8 manga series, the cast (mentor, regulars, rivals), a 40-event catalogue, achievement examples, lot recipes and the Grail List.
- **Art direction & audio** (`docs/04_ART_DIRECTION.md`), **UI/UX with wireframes** (`docs/05_UI_UX.md`), **technical architecture** (`docs/06_TECH_ARCHITECTURE.md`), **data model** (`docs/07_DATA_MODEL.md`), **asset pipeline & licensing** (`docs/08_ASSET_PIPELINE.md`) and a **decision log** (`docs/DECISIONS.md`).
- Project guides: `CLAUDE.md` (development guide), `ROADMAP.md` (10 phases to v1.0), `USER_QUESTIONS.md` (32 questions, each with a recommended default), `README.md`, `CREDITS.md` template.

### Notes
- An independent consistency review of all documents was run. Its findings were fixed: phase ordering (Build Mode v1 and basic ordering moved earlier), release-calendar content coverage and the Set Forge fallback, the grading and reputation math, the calendar anchor (Day 1 is a Monday), brand years, save slots, naming drift, and brief coverage (third-party mystery boxes, promo products).
- Library versions were verified against the npm registry on 2026-09-26 (React 19.3, Vite 8, TypeScript 7, three r186, R3F 9, Tailwind 4, and others).
- The cloud dev environment blocks the common CC0 asset hosts, so the asset strategy is **procedural-first** (see `docs/08 §2`).
