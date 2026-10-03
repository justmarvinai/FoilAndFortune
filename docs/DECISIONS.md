# Decision Log (ADRs)

> Architecture and design decisions in brief. **Status:** ✅ Accepted · 🟡 Proposed (waiting on a user answer in `USER_QUESTIONS.md`) · ❌ Rejected · 🔁 Superseded.
> **2026-09-29:** the owner answered "use your recommendations", so every ADR that waited on a ⭐ default is now ✅.
> **2026-09-30:** after the Art Spike the owner chose **Clay Critters for all card art** (ADR-006 ✅).
> Add a new entry for every significant decision. Never delete entries. Supersede them instead.

| ADR | Decision | Status | Linked |
|-----|----------|--------|--------|
| 001 | Browser game, static hosting on **Vercel**, **no backend or database** | ✅ | Brief |
| 002 | **TypeScript + Vite** | ✅ | `06 §2` |
| 003 | **React 19** for app shell and UI | ✅ | `06 §2` |
| 004 | Shop view as a **3D toy diorama** (three.js + React Three Fiber), isometric orthographic camera | ✅ | Q1 |
| 005 | Cards as **layered DOM/SVG with CSS foil** (our own implementation) | ✅ | `04 §5`, `06 §8` |
| 006 | Creature art: **genome-based procedural engine**, **Style A "Clay Critters" (SDF) for all card art** (owner's pick after the Art Spike). Style B was removed | ✅ | Q2 |
| 007 | **Pure TypeScript simulation** (`src/sim`) with a Zustand + Immer bridge. The sim decides, the view animates | ✅ | `06 §5–6` |
| 008 | **Determinism:** seeded RNG streams, integer cents, no wall clock in sim | ✅ | `06 §5.4` |
| 009 | **Persistence:** IndexedDB slots + autosave ring, versioned migrations, export/import file | ✅ | `06 §11` |
| 010 | **Content as typed TS data**, validated by Zod and `content:validate` | ✅ | `06 §12` |
| 011 | **Tailwind CSS 4** + CSS design tokens + hand-written effect CSS | ✅ | `06 §2` |
| 012 | **Motion** for UI animation. 3D animation is code-driven (procedural) | ✅ | `06 §2` |
| 013 | Audio: **Howler + Web Audio** (ZzFX SFX, blip voices) + CC0 music. **Amended 2026-10-03:** Web Audio only, procedural music (see below) | ✅ | Q15 |
| 014 | Tooling: **TypeScript 7 (native) + Biome 2**. `typescript-eslint` doesn't support TS ≥ 6.1 yet (checked 2026-09-26). If a TS-API-dependent tool becomes essential, run it against TS 6.0 in isolation | ✅ | `06 §15` |
| 015 | Testing: **Vitest + fast-check + Playwright + headless balance sim** | ✅ | `06 §14` |
| 016 | i18n with **i18next**. English first, German planned | ✅ | Q4 |
| 017 | **Fictional brands only.** No real TCG, company or person names | ✅ | Q17 |
| 018 | **Asset policy:** self-made or CC0 / OFL / MIT / ISC / Apache-2.0. Procedural-first. CC0 packs are optional | ✅ | `08 §1` |
| 019 | **npm** as package manager, Node ≥ 22 | ✅ | `06 §2` |
| 020 | **PWA** (installable, offline) | ✅ | Q29 |
| 021 | **No offline progress** (the shop doesn't run while you're away) | ✅ | Q28 |
| 022 | **Real-time days** with pause and speed. Untimed prep and night phases. Interactions pause the clock | ✅ | Q6, Q13 |
| 023 | **Three difficulty modes** (Cozy, Standard, Tycoon). Bankruptcy only in Tycoon | ✅ | Q7 |
| 024 | **One flagship TCG** (Glimmerkin) at launch. Multi-brand architecture from day one | ✅ | Q8 |
| 025 | **Free grid Build Mode** with path validation | ✅ | Q9 |
| 026 | **Card stacks vs instances** model for scale (bulk aggregated, notable cards individual, lazy sub-scores) | ✅ | `06 §5.5` |
| 027 | **Set Forge** procedural sets after the curated ones. Generated definitions are stored in the save | ✅ | `03 §5` |
| 028 | The TCG is **not playable** (no battles). Card stats are flavor, and tournaments are simulated | ✅ | Q11 |
| 029 | **React Compiler 1.0** (Babel preset via `@rolldown/plugin-babel`): automatic memoization, no hand-written `useMemo`/`useCallback` for performance | ✅ | `06 §2` |
| 030 | Debug tooling: **leva** dev panel and drei **`<StatsGl>`** perf overlay (not `r3f-perf`) | ✅ | `06 §19` |
| 031 | **Debug pages are exempt from i18n** (`src/debug`, `/debug/*` playgrounds). Everything a player sees uses i18n keys | ✅ | CLAUDE.md rule 8 |

---

## ADR-004 · 3D toy-diorama shop (✅ Accepted 2026-09-29)
**Context:** the brief demands a "REAL game" look and forbids an online-shop feel. Assets must be self-made or CC0, and most CC0 hosts are blocked from the dev environment.
**Decision:** render the shop as a stylized **3D miniature diorama** with an orthographic isometric camera. Fixtures, props and characters are generated procedurally in code (rounded, chunky "toy" shapes). Lighting and post-processing do the heavy lifting.
**Why not 2D isometric:** high-quality 2D iso art needs a large hand-drawn sprite set from multiple angles, which we can't produce or source at the same quality. In 3D, procedural geometry plus lighting looks polished for free.
**Why not first-person:** worse overview for management, harder on mobile, more motion sickness risk.
**Consequences:** the 3D stack is one lazy `three` chunk: 1.32 MB, **428 KB gzip** (three core, R3F, postprocessing + N8AO, drei parts). That's larger than the planning estimate of ~170 KB, and only 3D routes load it: E2E tests fail if any other page requests it. Quality tiers (Low/Medium/High: 134/238/349 draw calls at 1440×900) cover phones. Trim candidate: replace drei `<Environment>` (whose module bundles HDR/EXR/gain-map loaders we don't use) with a small PMREM-from-Lightformers helper.
**Validation:** Phase 1 Art Spike (a diorama corner with lighting and a walking customer) on `/debug/scene`. Accepted with the ⭐ default for Q1; revisit only if the spike disappoints the owner.

## ADR-006 · Genome-based creature art: Clay Critters for everything (✅ Accepted 2026-09-30)
**Context:** 1,000+ card illustrations are needed. There is no budget for artists, and style consistency is required.
**Decision:** a data-driven **genome** per species feeds an art engine. Style A (SDF clay renders) and Style B (SVG stickers) are both prototyped. Curated sets are pre-rendered to WebP, and procedural sets render at runtime with caching. Any card can be overridden by user-supplied art.
**Consequences:** there is an up-front engine investment, and then content scales cheaply. Evolutions share genomes, so lines look related.
**Outcome (Art Spike, 2026-09-30):** both styles were built and compared on real cards (`/debug/art`). The owner chose **Style A, Clay Critters, for every rarity**. Style B (Sticker Pop) was removed to keep one art pipeline; it is recoverable from git (commit `9efe6c0`). Clay art for curated sets is pre-rendered to WebP by `npm run art:render` (docs/06 §9), and Clay also renders at runtime as the fallback.

## ADR-013 · Audio stack (✅ Accepted; amended 2026-10-03 for Audio v1)
**Context:** the plan was Howler for music and sampled SFX, ZzFX for generated SFX and CC0 lo-fi tracks for music (Q15: cozy lo-fi / jazz-hop). Asset hosts are blocked from the dev environment, so no CC0 tracks or samples could be fetched, and every sound the game needs can be synthesized.
**Decision:** Audio v1 is **Web Audio only, zero audio files**. SFX are ZzFX patches plus our own layered synthesis (noise, bells, instruments), rendered once into cached `AudioBuffer`s after unlock. Music is a **procedural lo-fi generator** (seeded bars of drums, bass, extended-chord keys, melody) played with short-lived Web Audio nodes on a lookahead scheduler. Voices are blips with formant filters. **Howler is not used:** with no sample files it would only add an unlock helper and ~10 KB gzip (the `howler` dependency can be removed). ZzFX is a **TypeScript port** of its generator (MIT, credited), because the `zzfx` package opens an AudioContext at import time (a second context in the browser; it throws in Node tests).
**Consequences:** no downloads and fully deterministic, testable audio (`src/audio/README.md`). Revisit Howler or CC0 tracks if we add recorded music or samples (docs/08 §3), for example a licensed lo-fi pack on a later phase.

## ADR-014 · TypeScript 7 + Biome (✅ Accepted)
**Context:** TypeScript 7.0 (the native Go compiler) is `latest` on npm, with roughly 10× faster typechecks. `typescript-eslint@8.x` declares `typescript <6.1`.
**Decision:** use TS 7 for type-checking (`tsc --noEmit`) and **Biome** for lint and format (it doesn't depend on the TS JS API).
**Revisit when:** typescript-eslint supports TS 7, or a critical tool requires the TS JS API.

## ADR-029 · React Compiler (✅ Accepted 2026-09-29)
**Context:** the roadmap asked for an adopt-or-reject evaluation in Phase 1. `@vitejs/plugin-react` 6.1 offers two routes: the stable **Babel** compiler (`babel-plugin-react-compiler` 1.0 through `@rolldown/plugin-babel`) and an **experimental** Rust port (`oxc-transform-react`).
**Evaluation:** with the Babel route, every page chunk compiled (memo-cache sentinels in all components), all 62 unit tests and all 14 Playwright E2E tests passed unchanged, and a production build went from about 2.2–3.5 s to 4.6–5.9 s.
**Decision:** adopt the **Babel** compiler. `@babel/core` is pinned to 7.x because the compiler plugin is built against Babel 7 ASTs.
**Consequences:** don't hand-write `useMemo`, `useCallback` or `memo` for performance. Keep them only where identity is semantic (for example, a stable callback used as an effect dependency). Per-frame work still stays out of React (golden rule 7): the compiler reduces re-renders, but it doesn't make 60 fps state updates cheap.
**Revisit when:** the Rust compiler (`compiler: true` in plugin-react) leaves experimental status. It removes the Babel pass entirely.

## ADR-030 · Debug tooling: leva + drei StatsGl (✅ Accepted 2026-09-29)
**Context:** `r3f-perf` pulled in drei 9 through peer overrides and a deprecated `three-mesh-bvh`.
**Decision:** use **leva** for the dev panel (time warp, grants, raw state inspector; themed with our tokens) and drei **`<StatsGl>`** as the WebGL performance overlay.

## ADR-031 · Debug pages are exempt from i18n (✅ Accepted 2026-09-29)
**Context:** golden rule 8 forbids user-facing string literals. Debug galleries, playgrounds and the engine sandbox are developer tools that change constantly.
**Decision:** code under `src/debug/` and the `*Playground.tsx` spike pages may use plain English strings, marked with a `// Debug page: exempt from i18n` comment. Anything that ships to players (HUD, screens, toasts, errors, the app shell) must use i18n keys. Components promoted from a debug page into the game get translated at that point.
