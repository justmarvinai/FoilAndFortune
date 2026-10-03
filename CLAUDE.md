# CLAUDE.md: Foil & Fortune

Guidance for Claude Code (and humans) working in this repository. Keep this file **short, current and authoritative**. Details live in `docs/`.

## What this is
**Foil & Fortune** is a browser-based collectibles-shop tycoon. The player grows a tiny card and manga shop into a collectibles empire: buy wholesale, rip packs, grade cards, haggle with customers, ride a simulated market, expand the shop and hire staff. The main focus is TCGs, with a fictional Pokémon-inspired TCG called **Glimmerkin**. It is a static SPA on **Vercel** with **no backend or database**. Saves live in IndexedDB with export/import.

## ⚠️ Current status
- **Phase 2 (Vertical Slice: "One Day at the Nook") is in progress.** Phase 1 shipped as 0.1.0. Every ⭐ default in `USER_QUESTIONS.md` applies, the shop is the 3D diorama (Q1) and **all card art is Clay Critters** (Q2, ADR-006).
- Play at `/` (title) → `/play`. Debug hub at `/debug`: `/debug/engine` (sim sandbox + leva dev panel), `/debug/ui` (UI kit), `/debug/art` (card gallery), `/debug/sheets`, `/debug/opening`, `/debug/audio`, `/debug/live` (state-driven shop), `/debug/scene` (diorama spike), `/debug/clay` (art renderer workshop).

## Read before working
| Task | Read |
|------|------|
| Anything | This file + the current phase in `ROADMAP.md` |
| Gameplay systems | `docs/01_GAME_DESIGN.md`, `docs/02_ECONOMY_BALANCING.md` |
| Content (sets, cards, NPCs, events, manga) | `docs/03_CONTENT_BIBLE.md` |
| Visuals, UI, audio | `docs/04_ART_DIRECTION.md`, `docs/05_UI_UX.md` |
| Code structure and state shapes | `docs/06_TECH_ARCHITECTURE.md`, `docs/07_DATA_MODEL.md` |
| Assets and licenses | `docs/08_ASSET_PIPELINE.md`, `CREDITS.md` |
| Why things are the way they are | `docs/DECISIONS.md` |

## Stack (versions checked 2026-09-26; pin exact versions at scaffold)
TypeScript 7 (strict) · Vite 8 · React 19.3 + React Compiler 1.0 · three r186 + @react-three/fiber 9 + drei 10 + postprocessing 3 · Zustand 5 + Immer 11 · Tailwind CSS 4 · Motion 13 · Web Audio (procedural music, ZzFX-port SFX; ADR-013) · Zod 4 · idb-keyval + fflate · i18next · @tanstack/react-virtual · Biome 2 · Vitest 5 · fast-check · Playwright · tsx · vite-plugin-pwa · npm, Node ≥ 22.

## Commands
```bash
npm run dev               # dev server
npm run build             # production build → dist/
npm run check             # typecheck + lint + unit tests + content validation (run before every commit)
npm run test              # vitest run        · npm run test:e2e   # playwright (builds, then serves on :4173)
npm run content:validate  # schemas, IDs, references, card numbering, name blocklist
npm run format            # biome check --write
npx tsx --tsconfig tsconfig.node.json scripts/dev/screenshot.ts <url> <out.png> [WxH] [waitMs] [full]
npm run balance:sim -- --days 7 --seeds 20 --bot balanced   # headless economy KPIs (docs/02 §18)
npm run art:render -- --set emberdawn,promo [--only 035] [--force]   # pre-render Clay card art (docs/06 §9)
```

## Golden rules (architecture)
1. **The sim is pure.** `src/sim` never imports React, three, the DOM, `Date.now()` or `Math.random()`. It uses seeded RNG **streams** from state and time from the sim clock. *The sim decides, the view animates.*
2. **Commands in, events out.** UI, staff AI and bots change state only through `dispatch(command)`. The sim emits **domain events** (IDs and numbers, never display strings), which presentation turns into text, sound and VFX.
3. **All tunables live in `src/content/balance/*.ts`.** No magic numbers in systems. Formulas cite their doc section in a comment, for example `// docs/02 §5.3`.
4. **Content is data.** Sets, cards, products, customers, fixtures, events and achievements are typed data via `define*()` helpers, validated by Zod and `content:validate`.
5. **Stable IDs forever.** Never rename or remove a released content ID. Any `GameState` shape change bumps `saveVersion` and adds a **migration** plus a fixture test.
6. **Money is integer cents** (`Cents`). Format only through `core/money`.
7. **Per-frame data stays out of React.** Agent positions, particles and bubble screen positions live in mutable runtime objects read in `useFrame` or the overlay updater, not in Zustand.
8. **No user-facing string literals** in components or sim. Use i18n keys. Debug pages (`src/debug`, `*Playground.tsx`) are exempt (ADR-031).
9. **Assets:** self-made or CC0 / OFL / MIT / ISC / Apache-2.0 only. Add a `CREDITS.md` row in the **same commit**. **Never copy GPL code**, including popular open-source holo-card CSS demos. Write our own foil effects.
10. **No runtime network requests** (self-host fonts and assets; no CDNs). drei `<Environment preset>` fetches HDRIs from a CDN, so use Lightformer environments instead.
11. **Fictional brands only.** No real TCG, company or person names in content.

## Code conventions
- TypeScript strict, `noUncheckedIndexedAccess`. No `any` (use `unknown` and narrow). No non-null `!` outside tests.
- Files: components `PascalCase.tsx`, modules `camelCase.ts`, folders `kebab-case`. Content IDs are dotted lowercase (`gk.emberdawn.045`). Import via `@/`.
- React: function components and hooks. Select **narrow** store slices (`useShallow` for objects). No business logic in components: call commands (`useCommand`) and selectors. Lazy-load heavy features. The **React Compiler** is on (ADR-029): don't hand-write `useMemo`/`useCallback`/`memo` for performance.
- Styling: Tailwind utilities plus tokens from `src/ui/tokens.css`. Complex effects (foil, glass) go in dedicated CSS files. No raw hex colors in components.
- Comments explain *why*. Link doc sections for rules and formulas.
- Tests are colocated (`x.test.ts`). Randomness tests use fixed seeds and statistical tolerances.
- Biome formats the code (2 spaces, single quotes, semicolons, trailing commas, width 100). Don't hand-format against it.

## "Feels like a game" UI checklist
- Does it use a physical or diegetic metaphor (receipt, binder, clipboard, tablet app, corkboard) instead of a web-admin look?
- Is there feedback within 100 ms (visual + sound), with juice on success moments?
- Does every changing number explain *why*?
- Is it keyboard and touch friendly, with a reduced-motion variant, and all text through i18n?
- Did you review screenshots at desktop 1440×900 **and** phone landscape 915×412?

## Definition of Done (every task)
1. `npm run check` passes.
2. New sim logic has unit tests (edge cases and validation errors). Randomness has statistical tests.
3. UI or scene changes: run the app, capture Playwright screenshots, and review them.
4. Economy changes: run `npm run balance:sim`. Update `docs/02` if constants or targets changed.
5. Save shape changed: bump `saveVersion`, add a migration and a fixture test.
6. Docs: `CHANGELOG.md` (`[Unreleased]`), `ROADMAP.md` checkboxes, `docs/DECISIONS.md` for new decisions, and the relevant `docs/` sections.
7. Commit with a **Conventional Commit** message: `feat:`, `fix:`, `content:`, `art:`, `balance:`, `docs:`, `refactor:`, `test:`, `chore:`.

## Environment notes (Claude Code cloud sessions)
- Egress: the npm registry and GitHub are reachable. Most asset hosts (Kenney, Quaternius, Poly Haven, itch.io, OpenGameArt, FreePD…) are **blocked** (`docs/08 §2`).
- Chromium is pre-installed for Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). **Don't** run `playwright install`. If the pinned Playwright version mismatches, launch with `executablePath: '/opt/pw-browsers/chromium'`.

## Gotchas
- `@react-three/fiber` 9.x peer range is React `>=19 <19.4`, so check it before bumping React.
- `typescript-eslint` doesn't support TS ≥ 6.1, which is why we use Biome (ADR-014).
- Don't use drei `<Html>` per customer bubble (too slow). Use the single `WorldOverlay` layer.
- Browsers may evict IndexedDB. Call `navigator.storage.persist()` and keep the export-backup reminder.
- Audio must unlock on a user gesture (Safari/iOS).
- The app shell (`main.tsx`, `App.tsx`, `src/app`) imports UI components **by file**, never via the `@/ui/components` barrel, which pulls Motion into the entry chunk (+48 KB gz).
- Keep `@babel/core` on 7.x: the React Compiler plugin is built against Babel 7 ASTs (ADR-029).
- Right after a new dependency is first imported, the Vite dev server may answer `504 (Outdated Optimize Dep)` once. Reload before debugging a blank page.
