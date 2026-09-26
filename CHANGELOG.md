# Changelog

All notable changes to **Foil & Fortune** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/) (`0.x` until the v1.0 release; each roadmap phase bumps the minor version).

## [Unreleased]
_Nothing yet. Game code starts after the owner's go-ahead ("Start Phase 1")._

## [0.0.1] – 2026-09-26 · Planning
### Added
- **Game Design Document** (`docs/01_GAME_DESIGN.md`): vision, 5 design pillars, core, day and meta loops, and every system in the brief (shop and upgrades, products, pack opening, conditions, grading, customers, haggling, buying collections, market, suppliers, reputation, manga, employees, events, progression, collection and binder, goals and achievements, long-term goals, story and onboarding, difficulty modes, scope tiers).
- **Economy & balancing** (`docs/02_ECONOMY_BALANCING.md`): formulas and starting values for traffic, willingness to pay, haggling, card values, conditions and grading, XP curve, a 50-level unlock table, supplier price lists, pull rates and EV targets, the market model, reputation, staff, manga, and balance-simulator KPIs.
- **Content bible** (`docs/03_CONTENT_BIBLE.md`): the Brightbay setting, the Glimmerkin TCG (9 elements, rarity ladder, finishes, stamps, misprints, product lineup), a 16-set timeline, 56 creature species, 8 manga series, the cast (mentor, regulars, rivals), a 40-event catalogue, achievement examples, lot recipes and the Grail List.
- **Art direction & audio** (`docs/04_ART_DIRECTION.md`), **UI/UX with wireframes** (`docs/05_UI_UX.md`), **technical architecture** (`docs/06_TECH_ARCHITECTURE.md`), **data model** (`docs/07_DATA_MODEL.md`), **asset pipeline & licensing** (`docs/08_ASSET_PIPELINE.md`) and a **decision log** (`docs/DECISIONS.md`).
- Project guides: `CLAUDE.md` (development guide), `ROADMAP.md` (10 phases to v1.0), `USER_QUESTIONS.md` (32 questions, each with a recommended default), `README.md`, `CREDITS.md` template.

### Notes
- Library versions were verified against the npm registry on 2026-09-26 (React 19.3, Vite 8, TypeScript 7, three r186, R3F 9, Tailwind 4, and others).
- The cloud dev environment blocks the common CC0 asset hosts, so the asset strategy is **procedural-first** (see `docs/08 §2`).
