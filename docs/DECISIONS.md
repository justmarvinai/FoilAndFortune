# Decision Log (ADRs)

> Architecture and design decisions in brief. **Status:** ✅ Accepted · 🟡 Proposed (waiting on a user answer in `USER_QUESTIONS.md`) · ❌ Rejected · 🔁 Superseded.
> Add a new entry for every significant decision. Never delete entries. Supersede them instead.

| ADR | Decision | Status | Linked |
|-----|----------|--------|--------|
| 001 | Browser game, static hosting on **Vercel**, **no backend or database** | ✅ | Brief |
| 002 | **TypeScript + Vite** | ✅ | `06 §2` |
| 003 | **React 19** for app shell and UI | ✅ | `06 §2` |
| 004 | Shop view as a **3D toy diorama** (three.js + React Three Fiber), isometric orthographic camera | 🟡 | Q1 |
| 005 | Cards as **layered DOM/SVG with CSS foil** (our own implementation) | ✅ | `04 §5`, `06 §8` |
| 006 | Creature art: **genome-based procedural engine**. Style A "Clay Critters" (SDF) recommended, B "Sticker Pop" (SVG) as alternative. The user picks after the Phase 1 Art Spike | 🟡 | Q2 |
| 007 | **Pure TypeScript simulation** (`src/sim`) with a Zustand + Immer bridge. The sim decides, the view animates | ✅ | `06 §5–6` |
| 008 | **Determinism:** seeded RNG streams, integer cents, no wall clock in sim | ✅ | `06 §5.4` |
| 009 | **Persistence:** IndexedDB slots + autosave ring, versioned migrations, export/import file | ✅ | `06 §11` |
| 010 | **Content as typed TS data**, validated by Zod and `content:validate` | ✅ | `06 §12` |
| 011 | **Tailwind CSS 4** + CSS design tokens + hand-written effect CSS | ✅ | `06 §2` |
| 012 | **Motion** for UI animation. 3D animation is code-driven (procedural) | ✅ | `06 §2` |
| 013 | Audio: **Howler + Web Audio** (ZzFX SFX, blip voices) + CC0 music | 🟡 | Q15 |
| 014 | Tooling: **TypeScript 7 (native) + Biome 2**. `typescript-eslint` doesn't support TS ≥ 6.1 yet (checked 2026-09-26). If a TS-API-dependent tool becomes essential, run it against TS 6.0 in isolation | ✅ | `06 §15` |
| 015 | Testing: **Vitest + fast-check + Playwright + headless balance sim** | ✅ | `06 §14` |
| 016 | i18n with **i18next**. English first, German planned | 🟡 | Q4 |
| 017 | **Fictional brands only.** No real TCG, company or person names | 🟡 | Q17 |
| 018 | **Asset policy:** self-made or CC0 / OFL / MIT / ISC / Apache-2.0. Procedural-first. CC0 packs are optional | ✅ | `08 §1` |
| 019 | **npm** as package manager, Node ≥ 22 | ✅ | `06 §2` |
| 020 | **PWA** (installable, offline) | 🟡 | Q29 |
| 021 | **No offline progress** (the shop doesn't run while you're away) | 🟡 | Q28 |
| 022 | **Real-time days** with pause and speed. Untimed prep and night phases. Interactions pause the clock | 🟡 | Q6, Q13 |
| 023 | **Three difficulty modes** (Cozy, Standard, Tycoon). Bankruptcy only in Tycoon | 🟡 | Q7 |
| 024 | **One flagship TCG** (Glimmerkin) at launch. Multi-brand architecture from day one | 🟡 | Q8 |
| 025 | **Free grid Build Mode** with path validation | 🟡 | Q9 |
| 026 | **Card stacks vs instances** model for scale (bulk aggregated, notable cards individual, lazy sub-scores) | ✅ | `06 §5.5` |
| 027 | **Set Forge** procedural sets after the curated ones. Generated definitions are stored in the save | ✅ | `03 §5` |
| 028 | The TCG is **not playable** (no battles). Card stats are flavor, and tournaments are simulated | 🟡 | Q11 |

---

## ADR-004 · 3D toy-diorama shop (🟡 Proposed)
**Context:** the brief demands a "REAL game" look and forbids an online-shop feel. Assets must be self-made or CC0, and most CC0 hosts are blocked from the dev environment.
**Decision:** render the shop as a stylized **3D miniature diorama** with an orthographic isometric camera. Fixtures, props and characters are generated procedurally in code (rounded, chunky "toy" shapes). Lighting and post-processing do the heavy lifting.
**Why not 2D isometric:** high-quality 2D iso art needs a large hand-drawn sprite set from multiple angles, which we can't produce or source at the same quality. In 3D, procedural geometry plus lighting looks polished for free.
**Why not first-person:** worse overview for management, harder on mobile, more motion sickness risk.
**Consequences:** the three.js chunk (~170 KB gz) is lazy-loaded. Quality presets are needed for phones.
**Validation:** Phase 1 Art Spike (a diorama corner with lighting and a walking customer).

## ADR-006 · Genome-based creature art (🟡 Proposed)
**Context:** 1,000+ card illustrations are needed. There is no budget for artists, and style consistency is required.
**Decision:** a data-driven **genome** per species feeds an art engine. Style A (SDF clay renders) and Style B (SVG stickers) are both prototyped. Curated sets are pre-rendered to WebP, and procedural sets render at runtime with caching. Any card can be overridden by user-supplied art.
**Consequences:** there is an up-front engine investment, and then content scales cheaply. Evolutions share genomes, so lines look related.

## ADR-014 · TypeScript 7 + Biome (✅ Accepted)
**Context:** TypeScript 7.0 (the native Go compiler) is `latest` on npm, with roughly 10× faster typechecks. `typescript-eslint@8.x` declares `typescript <6.1`.
**Decision:** use TS 7 for type-checking (`tsc --noEmit`) and **Biome** for lint and format (it doesn't depend on the TS JS API).
**Revisit when:** typescript-eslint supports TS 7, or a critical tool requires the TS JS API.
