# ✨ Foil & Fortune

> *Rip packs, read customers, ride the market, and grow a dusty corner shop into the most legendary collectibles store in town.*

**Foil & Fortune** is a cozy but addictive **card and manga shop tycoon** that runs in the browser. You buy stock wholesale and sell it at a profit. You rip booster packs hoping for a Mythic Rare, send your best pulls to grading companies, haggle with a cast of quirky regulars, and speculate on sealed boxes that climb in value once a set goes out of print. Step by step, you expand a tiny shop in the coastal city of **Brightbay** into a collectibles empire, and on the way you unlock the secret of your mentor's vault.

**Status:** 🛠️ **Phase 2 · Vertical Slice** ("One Day at the Nook"). Phase 1 shipped as 0.1.0: engine, saves, UI kit, the 3D diorama shop and Clay Critters card art. See [`ROADMAP.md`](ROADMAP.md) and [`USER_QUESTIONS.md`](USER_QUESTIONS.md).

## Planned highlights
- 🏪 A living **3D toy-diorama shop**: customers browse, shelves empty, and the shop physically grows through 5 tiers
- ✨ **Pack opening** with holographic foil cards, rarity reveals, God Packs and misprints
- 🃏 **Glimmerkin**, an original Pokémon-inspired TCG with sets, 8 rarities, 1st Editions and a living market
- 🔍 **Grading** with four fictional companies (from budget to the fabled *Black Label*), pop reports, and crack-and-resubmit
- 🤝 **Haggling** and **buying collections** that can hide vintage gems (or fakes!)
- 📈 A **daily market** shaped by hype, tournaments, reprints and out-of-print scarcity
- 📚 **Manga** series with release days, complete runs and rare early volumes
- 👥 **Staff**, automation, events, achievements, rivals, branch stores and a story finale

## Documentation
| Doc | Contents |
|-----|----------|
| [`CLAUDE.md`](CLAUDE.md) | Development guide: rules, conventions, Definition of Done |
| [`ROADMAP.md`](ROADMAP.md) | Phases 0–10 up to the v1.0 release |
| [`USER_QUESTIONS.md`](USER_QUESTIONS.md) | Open design questions with recommendations |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history |
| [`docs/01_GAME_DESIGN.md`](docs/01_GAME_DESIGN.md) | Game Design Document |
| [`docs/02_ECONOMY_BALANCING.md`](docs/02_ECONOMY_BALANCING.md) | Numbers, formulas, progression |
| [`docs/03_CONTENT_BIBLE.md`](docs/03_CONTENT_BIBLE.md) | TCG, sets, creatures, manga, characters, events |
| [`docs/04_ART_DIRECTION.md`](docs/04_ART_DIRECTION.md) | Visual style, cards and foil, audio |
| [`docs/05_UI_UX.md`](docs/05_UI_UX.md) | Screens, flows, wireframes, accessibility |
| [`docs/06_TECH_ARCHITECTURE.md`](docs/06_TECH_ARCHITECTURE.md) | Stack, architecture, testing, deployment |
| [`docs/07_DATA_MODEL.md`](docs/07_DATA_MODEL.md) | Content and save-state shapes |
| [`docs/08_ASSET_PIPELINE.md`](docs/08_ASSET_PIPELINE.md) | Asset sourcing, generators, licensing |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log (ADRs) |
| [`CREDITS.md`](CREDITS.md) | Third-party asset credits |

## Tech
TypeScript 7 · Vite 8 · React 19 (+ React Compiler) · three.js / React Three Fiber · Zustand · Tailwind CSS · Motion · Howler · Vitest · Playwright. It's a static site on **Vercel** with no backend, and saves stay in your browser (with export/import). Details: [`docs/06_TECH_ARCHITECTURE.md`](docs/06_TECH_ARCHITECTURE.md).

## Running locally
Requires Node ≥ 22.
```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + unit tests + content validation
npm run test:e2e   # Playwright smoke tests (desktop + phone landscape)
```
The hub at `/` links to the debug pages: **Card Art** (`/debug/art`), **Shop Diorama** (`/debug/scene`), **Engine Sandbox** (`/debug/engine`), **Clay Workshop** (`/debug/clay`) and the **UI Kit** (`/debug/ui`).

## Deploying (Vercel)
Import the GitHub repository in Vercel (**Add New → Project**). Vercel detects Vite from `vercel.json`: build `npm run build`, output `dist/`, with SPA rewrites and security headers. Every branch gets its own preview URL, and there is no backend or database to configure.

## License
Not chosen yet (owner's decision). All game content is original and fictional. Third-party assets are listed in [`CREDITS.md`](CREDITS.md).
