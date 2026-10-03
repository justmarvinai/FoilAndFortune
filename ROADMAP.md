# 🗺️ Roadmap: Foil & Fortune

> **Current status: Phase 2 (Vertical Slice) is built and released as 0.2.0 ✅. Waiting for your playtest of Days 1–3, then Phase 3 · The Merchant.**
> Each phase ends with a **playable deploy** (Vercel preview), a `CHANGELOG.md` entry, ticked boxes here, and a short playtest by you.
> Versions follow SemVer. Each phase bumps the minor version, and v1.0.0 is the release.

| Phase | Name | Version | Headline | Status |
|-------|------|---------|----------|--------|
| 0 | Planning | 0.0.1 | Full design, tech and content plan | ✅ Done |
| 1 | Foundation & Art Spike | 0.1.0 | Project skeleton, core engine, **visual prototypes to choose the art direction** | ✅ Done |
| 2 | Vertical Slice: "One Day at the Nook" | 0.2.0 | The core loop in miniature: stock, sell, rip packs, reorder | ✅ Built (awaiting your playtest) |
| 3 | The Merchant | 0.3.0 | Suppliers, haggling, buying from customers, reputation, market v1, Build Mode v1, tutorial | ⏳ Next |
| 4 | Collector & Grader | 0.4.0 | Card conditions, grading, binder, fakes, achievements | |
| 5 | Living Market & Events | 0.5.0 | Full market sim, release calendar, 1st Editions, events, tournaments, FoilMarket, Set Forge v1 | |
| 6 | Build, Grow & First Staff | 0.6.0 | Build Mode v2, expansions, upgrades, Cashier and Stocker → **MVP / Early Access** | |
| 7 | Manga & Accessories | 0.7.0 | Manga category, accessories, Mystery Box Builder | |
| 8 | Experts & Automation | 0.8.0 | Expert staff, policies, premium grading, imports | |
| 9 | Empire | 0.9.0 | Tiers 4–5, auctions, card shows, streaming, branches, rivals, **Theo's Vault** | |
| 10 | Content, Polish & Release | **1.0.0** | Set Forge v2, localization, audio, accessibility, balance → **Launch** 🚀 | |

> **Unlocks vs. phases:** features unlock in-game by level (`docs/02 §9`). Until a feature is built, its unlock is hidden behind a feature flag and its level grants a placeholder perk, so every build stays coherent and no level is empty.
> **Content per phase** (full table in `docs/03 §4`): P2 *Emberdawn* subset · P3 *Emberdawn*, *Origins*, *Moonlit Masquerade* · P5 *Tidebreak*, *Sparkit & Friends*, *Sunken Kingdom* + Set Forge v1 fallback · P7 *Harvest of Spirits*, *Wildwood* · P8 *O25*, *Frostbound Kingdom*, *Ancient Amber* · P9 *Shadow Syndicate*, *Crystal Skies*, *Echoes of Legend* · P10 *Neon Circuit*, *Starfall Odyssey* + Set Forge v2.

---

## Phase 0 · Planning ✅
- [x] Game Design Document (`docs/01_GAME_DESIGN.md`)
- [x] Economy, balancing and progression (`docs/02_ECONOMY_BALANCING.md`), with grading and reputation calibrated by simulation
- [x] Content bible: TCG, sets, creatures, manga, characters, events (`docs/03_CONTENT_BIBLE.md`)
- [x] Art direction and audio (`docs/04_ART_DIRECTION.md`)
- [x] UI/UX design with wireframes (`docs/05_UI_UX.md`)
- [x] Technical architecture (`docs/06_TECH_ARCHITECTURE.md`) and data model (`docs/07_DATA_MODEL.md`)
- [x] Asset pipeline and licensing (`docs/08_ASSET_PIPELINE.md`), decision log (`docs/DECISIONS.md`)
- [x] `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md`, `USER_QUESTIONS.md`, `README.md`, `CREDITS.md`
- [ ] **You:** answer `USER_QUESTIONS.md` (or "use recommendations") and say **"Start Phase 1"**

## Phase 1 · Foundation & Art Spike (v0.1.0)
**Goal:** a solid, tested skeleton deployed on Vercel, plus visual prototypes so you can **see and choose** the art direction before we build on it.
- [x] Scaffold: Vite 8, React 19, TypeScript 7, Tailwind 4, Biome, Vitest, Playwright, path aliases, npm scripts, `vercel.json`, CI workflow
- [x] `core/`: seeded RNG streams, money (cents) and formatting, calendar utilities (Day 1 = Spring 8 = Monday), event bus. *(Instance IDs arrive with card instances in Phase 2.)*
- [x] `content/`: Zod schemas (brand, species, set, card, pack, product), registry, `content:validate`, balance config skeleton
- [x] `sim/`: GameState v1, `createNewGame`, `dispatch`, `tick`, phase transitions, first commands, with unit tests
- [x] `state/`: Zustand bridge, GameLoop, presentation bus
- [x] `save/`: IndexedDB slots, autosave ring and weekly autosave, export/import, migration framework with a fixture test
- [x] `i18n/` setup (English) · fonts · UI tokens · first UI kit components · `/debug/ui` gallery · debug panel (`/debug/engine`, leva)
- [x] **Art Spike A:** 3D diorama corner (shell, shelf, counter, day/evening lighting, one walking Peg-folk with expressions) → `/debug/scene` (the whole Tier-1 Nook, a scripted customer loop, 3 quality tiers)
- [x] **Art Spike B:** CardView (frame, text, 3 foil types) with **Sparkit, Emberpup and Sploot** in **Style A (Clay)** and **Style B (Sticker)** → `/debug/art` (workshop: `/debug/clay`)
- [x] Evaluate React Compiler (adopt or reject → DECISIONS): **adopted**, ADR-029
- [x] **You pick** the shop style (Q1: 3D diorama) and creature style (Q2: **Clay Critters for all cards**), recorded in DECISIONS
- [ ] Deploy a preview (owner: import the repo in Vercel; every branch then gets a preview URL)
- **Done when:** `npm run check` is green, the preview URL works on desktop and phone, and the art direction is chosen.

## Phase 2 · Vertical Slice: "One Day at the Nook" (v0.2.0)
**Goal:** 15 minutes of genuine fun: stock the shelf, serve kids, rip packs, reorder, watch money grow.
- [x] Content: *Emberdawn* subset (42 cards plus Essences and promos, 20 species genomes, pre-rendered Clay art), Booster Pack, 3-Pack Blister, two Starter Decks, Booster Box
- [x] Starting inventory per `docs/02 §2`, including Theo's Booster Box (open it, keep it sealed, or **break it into 36 loose packs**). Theo leaves the first wall shelf stocked
- [x] Tier-1 shop scene (fixed starter layout): wall shelves, display case, register, door and bell, driven live by the game state
- [x] Day cycle: prep → open → night · clock · pause and speed · **Day Summary receipt**
- [x] Customers: Kid and Casual archetypes. Arrive, browse, pick (shelves visibly empty), queue, **manual checkout**, bubbles and reactions, satisfaction
- [x] Stocking via Fixture Popover, Restock All, Closet storage · per-SKU pricing with market reference and price reaction bubbles
- [x] **Basic ordering:** a simple Crate app with Budget Box Co. only (next-morning delivery), so stock never runs dry
- [x] **Pack Opening** with full juice (tear, reveal, rarity hints, summary) and **Quick Rip** for boxes
- [x] Inventory sheet (sealed, singles) · basic Binder
- [x] Cash, XP, levels 1–5 · toasts · level-up celebration
- [x] Audio v1: title and day music, core SFX (bell, register, tear, flip, stingers), blip voices (all procedural)
- [x] Title screen · New Game (shop name, simple avatar, difficulty) · Continue/Load
- **Done when:** a new player enjoys Days 1–3, it runs at 60 fps on desktop and is playable on phone landscape, and the "day one" E2E test passes. *Status: the day-one E2E passes on desktop and phone landscape, and the balance sim meets every Phase 2 KPI. Pending: your playtest of Days 1–3, and a 60 fps check on real hardware (this environment only has software WebGL).*

## Phase 3 · The Merchant (v0.3.0)
**Goal:** the complete core loop, Buy → Stock/Open → Sell → Profit → Upgrade, for the first ~2 hours.
- [ ] **Crate app, full version:** Budget Box Co. and Harbor Hobby. Orders, delivery, minimums, volume discounts, limited stock, insurance, damaged shipments · **third-party mystery boxes**
- [ ] **Build Mode v1:** buy fixtures from a catalog, place, move and rotate them on the grid, with validity and path checks
- [ ] **Upgrades board v1:** Card Reader Terminal, POS System (pricing rules)
- [ ] Display-case singles, "ask to see", **Negotiation** (haggling) with tells and the Happy Deal streak
- [ ] **Buy offers:** customers selling singles, binders and lots. Appraisal, offer slider with fairness zones, hidden reputation effects, **Sorting minigame**
- [ ] Archetypes: Competitive Player, Card Hunter (buys if you have the card), Attic Finder (Grandma Rosa intro)
- [ ] **Reputation v2** with sub-scores and a **ShopStars** review feed
- [ ] **Market v1:** daily card and sealed prices, **FoilTrack** app (watchlist, detail, sparkline)
- [ ] Content: full *Emberdawn* (130), *Origins* (72, vintage) and *Moonlit Masquerade* (125) with art
- [ ] **Theo's Lessons** tutorial (Days 1–7) · Daily Objectives
- [ ] Rent, bank loans, difficulty modes (Cozy, Standard, Tycoon)
- **Done when:** the balance sim meets the Day 1–14 KPIs that apply at this phase (`docs/02 §18`: revenue, cash, margins, Harbor day, Tier-2 affordability), and the first two hours feel rewarding.

## Phase 4 · Collector & Grader (v0.4.0)
- [ ] Hidden sub-scores and 5 conditions from all sources · **Card Inspect** with Card Lab tools (Loupe, Light Box, Centering Tool, bought on the Upgrades board)
- [ ] **Grading:** Grading Desk (placed via Build Mode), Cardboard Certs and Summit, service tiers, shipment tracker, **reveal ceremony**, slabs, pop reports, crack and resubmit
- [ ] Graded sales · Investor and Hardcore Collector archetypes
- [ ] Fakes and detection · Shady Dealer (Mr. Grimsby)
- [ ] Binder complete (set and master set, silhouettes, covers) · Dex · Trophy Room
- [ ] Achievements framework and the first 30 achievements
- **Done when:** the grading statistical tests (`docs/02 §8`) pass, the "first grading submission ≈ day 10" KPI holds, and grading feels like a skill because tools improve predictions.

## Phase 5 · Living Market & Events (v0.5.0)
- [ ] Full market model (species, set and meta factors, shocks, indices, *Glimmer Gazette* news) · sealed appreciation · print lifecycle (announce → pre-order → release → last call → OOP) · **1st Edition waves**
- [ ] Seasons and release calendar · release-day rush · prerelease weekends · **Set Forge v1** as the fallback for any unauthored release
- [ ] Content: *Tidebreak* (goes OOP on Day 8), **Sparkit & Friends** (Day 8) and *Sunken Kingdom* (Day 22, the first pre-order release)
- [ ] **Starforge Official Distribution:** pre-orders, allocations, prerelease kits, League Promo Kits
- [ ] Random **event cards** system with the first ~25 events · Liquidator and Estate Sale events
- [ ] Influencer archetype (SashaRips) and hype events
- [ ] Play tables · **League Night** and tournaments (simulated brackets that shift the meta)
- [ ] **Website** upgrade → **FoilMarket** (buy and sell online) · **Special Orders**
- **Done when:** speculation works (buying *Tidebreak* sealed and holding through OOP can pay off), a *Sunken Kingdom* pre-order works end to end, and 30 in-game days feel varied.

## Phase 6 · Build, Grow & First Staff (v0.6.0) → 🎉 MVP / Early Access
- [ ] **Build Mode v2:** sell, undo/redo, multi-select, appeal meter polish, full launch fixture catalog, decor catalogs I and II
- [ ] **Shop Tiers 2–3** with the expansion celebration · storage upgrades (Back Room, Stockroom)
- [ ] **Upgrades board v2:** Loyalty Cards, marketing (flyers, social ads) · Security Tags and shoplifting (Tycoon only)
- [ ] **Staff v1:** hiring, **Cashier** and **Stocker**, salaries, morale, schedules
- [ ] Tourist archetype (Tier 2+) · customer pathfinding on custom layouts
- [ ] Settings complete (graphics presets, audio, accessibility v1)
- **Done when:** there are 5–8 hours of engaging play, performance budgets are met, and all implemented screens have Early-Access polish.

## Phase 7 · Manga & Accessories (v0.7.0)
- [ ] **Manga:** 8 series, volumes and generated covers, Kaze Manga Direct, New Manga Day, complete runs, out-of-print volumes, anime events, Manga Fans, **Manga Library**
- [ ] **Accessories** category and pegboard
- [ ] **Mystery Box Builder** (player-made boxes)
- [ ] Content: *Harvest of Spirits* and *Wildwood*

## Phase 8 · Experts & Automation (v0.8.0)
- [ ] Staff: **TCG Expert**, **Event Host**, **Grading Specialist**. Traits, training, **policies** (auto-buy, auto-haggle, restock rules)
- [ ] POS Pro (reorder points, auto-order, forecasts) · Self-Checkout Kiosk
- [ ] **Apex Grading** · **Sakura Imports** (JP-style sets)
- [ ] Content: *Origins 25th Anniversary*, *Frostbound Kingdom* and *Ancient Amber*

## Phase 9 · Empire (v0.9.0)
- [ ] **Shop Tiers 4–5** (mezzanine and upper floor) · Warehouse Unit and Climate Vault
- [ ] **Blackline Grading** (Black Label)
- [ ] **Collectors Con** card shows · **Gavel & Glimmer Auctions** · **Streaming Studio** and Streamer
- [ ] **Rivals and Town Rankings** · **Branch stores**, City Map, Store Manager
- [ ] **Theo's Vault** legacy goals and finale · Hall of Fame · Grail List
- [ ] 2nd TCG brand: **Arcane Dominion** (Q8)
- [ ] Content: *Shadow Syndicate*, *Crystal Skies* and *Echoes of Legend* (the remaining vintage and classic grails)

## Phase 10 · Content, Polish & Release (v1.0.0) 🚀
- [ ] **Set Forge v2** (polished procedural future sets) · content: *Neon Circuit* and *Starfall Odyssey* (all 16 curated sets complete)
- [ ] ~100 achievements · ~40 events · all regular storylines
- [ ] German localization (Q4)
- [ ] Audio complete (music set, ~60 SFX, adaptive layers)
- [ ] Accessibility complete · performance pass · PWA offline · save robustness
- [ ] Full balance pass (300-day bot sims) · playtests · bug bash
- [ ] Credits screen · name and trademark sanity check · launch

---

## 🔮 Post-1.0 Ideas (backlog)
3rd TCG brand *Crimson Moon Card Game* · portrait phone layout · New Game+ / Legacy mode · seeded daily challenges · content packs / modding · optional auto-battler mini-game (Q11) · gamepad support · data-driven seasonal events · more districts.
