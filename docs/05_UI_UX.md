# 05 · UI / UX Design

> **North star (from the brief):** outstanding UI/UX that feels like a **real game**, fun and playful, never like an online shop.
> **Rule of thumb:** if a screen could be mistaken for an e-commerce admin panel, redesign it with a physical or diegetic metaphor, juice and personality.

---

## 1. UX Principles

1. **The shop is home.** The 3D diorama is always visible or dimmed behind panels. The player never "leaves" the shop for a menu desert.
2. **Diegetic metaphors.** Menus are *things in the world*: a clipboard for orders, a tablet app for the market, a leather binder for the collection, a corkboard for goals, a receipt for the day summary, and a blueprint for build mode.
3. **One click for the core.** The most frequent actions (checkout, restock, answer a bubble, rip a pack) take one click or tap. Depth is optional, never mandatory.
4. **Progressive disclosure.** The dock starts with 3 buttons. Systems appear when they unlock, each with a short spotlight intro. Nothing is dumped on the player at once.
5. **Always show *why*.** Every number that changes explains itself (reputation sub-scores, market news, satisfaction reasons in reviews, fee breakdowns).
6. **Feel first.** Every action has visual, audio and (on mobile) haptic feedback. A response within 100 ms is mandatory, and the payoff animation follows.
7. **Respect the player.** No dark patterns. Pausing is always possible. Interactions pause the clock by default. Big irreversible actions get confirmation, and small ones get undo.

---

## 2. Screen Map & Layers

```
Title ─► New Game (shop name, avatar, difficulty) ─► Intro (Theo) ─► SHOP (home)
                                    Load / Settings / Credits ◄──────────┘

SHOP (layer 0, 3D) + HUD (layer 1)
 ├─ Sheets (layer 2): Stock/Inventory · Price Board · Crate (suppliers) · FoilTrack (market)
 │                    Binder · Grading Lab · Staff Room · Upgrades · Goals · Reputation/Reviews
 │                    Manga Library · City Map (late) · Settings
 ├─ Modes: Build Mode (camera + blueprint overlay) · Pack Opening (full-screen stage)
 │         Sorting (full-screen minigame) · Card Show (late) · Auction (late)
 ├─ Modals (layer 3, pause time): Negotiation · Buy Offer/Appraisal · Special Order
 │         Event Card · Confirmations · Card Inspect
 ├─ Celebrations (layer 4): Level-up · Achievement · Grade Reveal · Expansion · God Pack
 └─ Toasts & activity feed (layer 5)
```

**Layer rules:** only one sheet at a time. Modals stack at most 2 deep. **Esc** or the back gesture closes the top layer. Opening a modal pauses the clock (a setting). Celebrations are skippable and auto-dismiss.

---

## 3. HUD

### 3.1 Desktop (16:9)
```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ [🏪 Foil & Fortune  Lv 15 ◔] [☀ Thu · Summer 4 · 14:35 ⏸ ▶ ▶▶ ▶▶▶ [OPEN]] [$12,431.50] [★★★] [🔔3]│
│                                                                                       │
│                                                                    ┌──────────────┐   │
│                   ( 3D shop diorama: customers, shelves,            │ Activity     │   │
│                     bubbles 🛒 💬 📦 🔎 above heads )                │ +$12.99 pack │   │
│                                                                    │ 📦 Rosa wants│   │
│                                                                    │   to sell…   │   │
│  ┌ Goals 📌 2/3 ┐                                                  └──────────────┘   │
│  └──────────────┘                                                                     │
│ ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📦 Stock  🏷 Prices  🚚 Orders  📈 Market  📒 Binder  🔍 Grading  👥 Staff  🔨 Build  ⬆ Upgrades │ │
│ └───────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────┘
```
- **Top-left:** shop name, level badge with an XP ring (click for level rewards).
- **Top-center:** weather/season icon, weekday, date, clock, speed controls, and the **OPEN/CLOSED door sign** (big, flippable).
- **Top-right:** **cash counter** (rolling digits, pulses on change), **reputation stars** (click for sub-scores and reviews), notification bell.
- **Bottom dock:** chunky key buttons with **badges** (e.g., Orders ②, Grading ✓), unlocked progressively. Each has a **letter-key** shortcut (§9). Number keys are reserved for game speed.
- **Right:** collapsible activity feed. **Left:** Goals chip (daily objectives progress).

### 3.2 Phone and tablet landscape
The top bar compresses to icons plus key numbers, and the dock becomes an icon rail. Sheets open full-screen. The activity feed becomes a drawer. Touch targets are ≥ 44 px. Pinch zooms the camera, two-finger drag pans, and rotation uses buttons.

---

## 4. Core Interaction Patterns

| Pattern | Desktop | Touch |
|---------|---------|-------|
| Select fixture → **Fixture Popover** (slots, counts, prices, Fill / Change / Price) | Click | Tap |
| Answer a customer | Click their bubble | Tap bubble |
| Context actions (radial menu) | Right-click | Long-press |
| Move items (product to slot, card to grading tray or binder, furniture) | Drag & drop | Long-press, then drag |
| Details | Hover tooltip (300 ms) | Tap-and-hold |
| Camera | Wheel zoom, drag pan, Q/E rotate | Pinch, two-finger pan, buttons |
| Time | Space pause · 1 = 1×, 2 = 2×, 3 = 4× | Buttons |

**Safety:** confirmation for high-value irreversible actions (opening sealed product worth > $200, cracking a slab, selling an item worth > $500 below 80% of market, firing staff). **Undo** for price edits and build placements (Ctrl+Z / ↶ button).

---

## 5. Key Screens

### 5.1 Title screen
The 3D shop exterior at dusk: a neon **Foil & Fortune** sign flickers on, season weather falls, and the camera drifts. Menu items are chunky cards: **Continue** (shows shop name, day, level, cash), New Game, Load, Settings, Credits. The music is the warm title theme.

### 5.2 New Game
Three steps on a "shop registration form" (a paper sheet with stamps): **(1)** shop name (default *Foil & Fortune*) and owner avatar customizer (live 3D preview) → **(2)** difficulty cards (Cozy / Standard / Tycoon, with clear descriptions) → **(3)** "Sign" stamp animation → intro scene with Theo handing over the keys.

### 5.3 Fixture Popover
Anchored to the fixture in 3D. It shows slot tiles (product art, count/capacity bar, price tag in handwritten font). Each slot has quick actions: **Fill** · **Swap product** · **Price**. A header button runs **Restock this fixture**. Low stock pulses, and stock-outs show a sad empty-shelf icon.

### 5.4 Stock / Inventory ("Backroom", wood-panel sheet)
Tabs: Sealed · Singles · Graded · Bulk · Manga · Accessories · Personal. It has search, filters (set, rarity, condition, value, location), sorting, a **virtualized** grid or list (thousands of cards), multi-select, and bulk actions (price, move to case, send to grading, list online, add to binder, open). A storage capacity bar (SU) is always visible.

### 5.5 Price Board (clipboard)
The table uses a clipboard skin: product · your price · market · your avg cost · margin % · 7-day sales sparkline · stock-out risk. Helpers: **Match market**, **Market +X%**, **MSRP**, **Round .99**. Pricing rules live in a POS System tab.

### 5.6 Crate: supplier app (tablet)
```
┌────────── 🚚 Crate · Harbor Hobby Distribution ─────────── Cart (3) $314.20 ┐
│ [Budget Box][Harbor Hobby▼][Starforge 🔒Lv10][Kaze Manga][FoilMarket]       │
│ Filters: [Glimmerkin ▾] [Emberdawn ▾] [Sealed ▾]        Delivery: 2 days 🚚 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│ │[box art] │ │[ECB art] │ │[bundle]  │ │[pack]    │                        │
│ │EMD Box   │ │EMD ECB   │ │EMD Bundle│ │EMD Pack  │                        │
│ │$104      │ │$33       │ │$17.50    │ │$2.95 ×36 │                        │
│ │MSRP $161 │ │MSRP $49  │ │MSRP $26  │ │MSRP $4.49│                        │
│ │Stock 12  │ │Stock 4 🔥│ │Stock 30  │ │Stock ∞   │                        │
│ │[−] 2 [+] │ │[−] 0 [+] │ │[−] 0 [+] │ │[−] 1 [+] │                        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                        │
│ Volume discount: $314 → reach $500 for −3%  ▰▰▰▰▰▱▱▱▱                        │
│                                            [ Place order · arrives Thu ▶ ] │
└────────────────────────────────────────────────────────────────────────────┘
```
Pre-orders get their own tab with **countdown timers** and allocation meters. Locked suppliers show their unlock requirements, which builds anticipation.

### 5.7 Pack Opening (full-screen stage)
```
┌──────────────────────────── (dark stage, spotlight) ───────────────────────────┐
│ EMBERDAWN · Booster Pack                                 [Skip to hits ⏭] [✕]  │
│                           ╔═══════════════╗                                    │
│                     ~~~~~ ║ ≈≈ tear here ≈║ ~~~~~   ← drag across to rip       │
│                           ║   (pack art)  ║                                    │
│                           ╚═══════════════╝                                    │
│   Value so far: $0.42                      Cards left: ▮▮▮▮▮▮▮▮▮▮                │
└────────────────────────────────────────────────────────────────────────────────┘
```
Tear → the card stack slides out → tap or swipe to reveal → **the rare slot is last, with an edge glow hint** → hit celebration → **summary grid** (NEW badges, values, total vs cost, quick actions). **Quick Rip** for boxes plays a highlights reel. Auto-open and "skip commons" toggles are remembered.

### 5.8 Card Inspect (modal)
A large card with **tilt and holo** (drag or cursor). Tabs: **Details** (market price, history sparkline, pop report, owned copies) · **Condition** (visible condition; with Card Lab tools, a **loupe mode** zooms corners and edges; light box and centering overlays) · **Actions** (price, move, grade, binder, list). Slabs rotate to show the back label.

### 5.9 Binder (leather, full-screen)
```
┌──────────── 📒 Binder · Emberdawn ───────────── 67/130 ◔ ──────────┐
│ [ORG][WLD][TDB][MNM][EMD▼][SPF]      Filter: [All ▾] [Missing only] │
│  ┌─────┬─────┬─────┐     ┌─────┬─────┬─────┐                        │
│  │ 037 │ 038 │░039░│     │ 046 │ 047 │ 048 │                        │
│  ├─────┼─────┼─────┤     ├─────┼─────┼─────┤                        │
│  │ 040 │░041░│ 042 │     │░049░│ 050 │ 051 │                        │
│  ├─────┼─────┼─────┤     ├─────┼─────┼─────┤                        │
│  │ 043 │ 044 │ 045 │     │ 052 │░053░│ 054 │                        │
│  └─────┴─────┴─────┘     └─────┴─────┴─────┘                        │
│  ◀ page 5/15 ▶       ░ = missing (silhouette + number)  [Master set ◻]│
└─────────────────────────────────────────────────────────────────────┘
```
Real page-turn animation (CSS 3D) with a paper sound. Pockets have a subtle sleeve sheen. Drag cards from inventory into pockets. Completion rings per set. Binder covers are unlockable cosmetics.

### 5.10 Negotiation (modal)
```
┌──────────────────────────── Haggle ──────────────────────────────┐
│ [portrait] Dex Park · 🏆 Competitive     Mood 😐    Patience ●●●○  │
│ "Would you do $38 for the Voltail Nova?"                          │
│ ┌──────────┐  Market $42.10 · Your cost $19.00 · Tag $45.00        │
│ │  [card]  │  Your ask:  [−]  $42.00  [+]                          │
│ │          │  [−10%] [−5%] [Meet halfway] [+5%]                    │
│ └──────────┘  💡 "He keeps glancing at his wallet…"                │
│      [ Accept $38 ]   [ Counter ]   [ Final offer ]   [ No deal ]   │
└──────────────────────────────────────────────────────────────────┘
```
The face reacts live as you adjust the ask (before you commit). The patience pips crack when spent. A deal ends with a **"DEAL!"** stamp and coin burst. A walk-away plays a door-slam puff. The **streak counter** is shown when active.

### 5.11 Buy Offer / Appraisal (modal)
The seller's items are laid out on the counter mat. Lots show a **sample** plus a "+ 243 more cards" box. The **estimated value range bar** narrows as you appraise (Appraise button: costs game time, or instant with the TCG Expert). Offer via slider with the five fairness zones from `02 §6.3` colored along it (Lowball · Low · Fair · Generous · Overpay) and a mood face. The **Sorting minigame** follows for purchased lots (optional, or instant with an upgrade).

### 5.12 Grading Lab (desk)
A submission tray (drag cards in), **company cards** (logo, price, turnaround, prestige stars, max value), a service-tier toggle, fee total, and a **predicted grade distribution** mini-chart when tools or staff allow. A "Shipments" tab shows parcel trackers with progress along a route line. **Reveal ceremony** plays at the night phase.

### 5.13 FoilTrack: market app (tablet)
Tabs: **Watchlist** · **Movers** (top gainers and losers) · **Sets** (index charts) · **News** (*Glimmer Gazette* feed) · **Search**. Card detail shows a price chart (7D / 30D / ALL), pop report and owned copies. Big moves pulse. Tapping a news item highlights the affected cards.

### 5.14 Build Mode
The camera tilts to a blueprint look with a grid overlay. The **catalog drawer** at the bottom holds fixture cards (price, capacity, appeal, unlock state). Placement uses ghost previews (green or red), R rotates, click places, and there are Move and Sell tools. Live **Appeal meter**, **path check** warnings, and Undo/Redo. Leaving triggers a satisfying "construction" transition.

### 5.15 Staff Room
Candidate résumés as cards (portrait, skills ★, traits as stickers, salary ask, a quote) and **Hire** stamps. The roster shows morale faces, schedule toggles (weekday chips), policies per role, training and fire (confirm).

### 5.16 Goals Board (corkboard)
Daily objectives as sticky notes (with a reroll), Theo's Lessons as index cards, regular quests, and the **Legacy Goals** vault graphic with 5 locks (glowing when opened). Achievements live in a trophy-shelf tab.

### 5.17 Day Summary (receipt)
```
        ╔══════════════════════════╗
        ║     FOIL & FORTUNE       ║
        ║  Thu · Summer 4 · Y1     ║
        ║--------------------------║
        ║ Customers served     27  ║
        ║ Revenue         $684.20  ║
        ║ Cost of goods  −$402.10  ║
        ║ Wages           −$80.00  ║
        ║--------------------------║
        ║ PROFIT         +$202.10  ║
        ║ Reputation  ★★½  (+1.2)  ║
        ║ XP     +312   ▰▰▰▰▰▰▱▱   ║
        ║--------------------------║
        ║ ⭐ Best pull: Solaryx IR   ║
        ║ 🤝 Best deal: +$41 (Dex)  ║
        ║--------------------------║
        ║ TOMORROW (Fri):          ║
        ║ · 2 boxes arrive         ║
        ║ · League Night 🏆         ║
        ╚══════════════════════════╝
               [ Next Day ▶ ]
```
The receipt **prints** line by line (thermal printer sound), with numbers rolling up. The "Tomorrow" teaser is always present.

### 5.18 Event Card (modal)
An illustrated card (the same frame language as TCG cards), a title, 2–3 sentence setup, and 2–3 **choice buttons** with outcome hints (e.g., "💰 −$400 · 📦 +3 Boxes"). Non-urgent events can be **deferred** to the notification tray.

### 5.19 Other screens
**Reputation & Reviews** (sub-score bars with "why" tooltips, ShopStars review feed) · **Manga Library** (personal bookshelf with completion) · **City Map** (late game: illustrated Brightbay, district pins, branch cards) · **Auction** (live ticker, bidder portraits, gavel) · **Card Show** (booth layout mini-mode) · **Settings** (Audio, Graphics, Gameplay, Accessibility, Controls, Language, Saves) · **Save/Load** (3 slots + autosave, export/import file).

---

## 6. Feedback & Juice Mapping

| Event | Visual | Sound | Haptic (mobile) |
|-------|--------|-------|-----------------|
| Button press | Squash 0.95 → spring back | Soft pop | Light tick |
| Sale | Coins → cash counter, `+$` float | *Cha-ching* | Light |
| Customer delighted | Hearts and a happy face | Blip "yay" | — |
| Customer angry or leaving | Steam puff, door-slam dust | Grumble blip | — |
| Pack tear | Foil shards, crinkle | Tear | Medium |
| Holo+ reveal | Edge glow → beam | Rarity stinger | Medium → Heavy |
| Mythic / God Pack | Slow-mo, star rain, crown stamp | Fanfare | Heavy pattern |
| Deal closed | "DEAL!" stamp | Stamp thud | Medium |
| Level up | Banner, confetti, unlock cards fly to the dock | Jingle | Pattern |
| Achievement | Trophy toast with shimmer | Chime | Light |
| Grade reveal 10 | Fireworks, label flip | Drumroll → burst | Heavy |
| Error / not allowed | Gentle shake, coral outline | Soft "bonk" | Double tick |

---

## 7. Notifications & Interruption Rules
- **Toasts** (bottom-left, max 3, about 4 s): sales milestones, deliveries, achievements.
- **Activity feed** (right): a running log of the day.
- **Badges** on dock keys: pending work.
- **Bell tray:** history plus deferred events.
- **During business hours** nothing auto-opens a modal except **urgent** event cards (max 1 per in-game hour). Customers communicate through **bubbles** only.
- **Night phase** is where heavier moments happen: grading reveals, story beats, the level-up recap.

---

## 8. Onboarding UX
- **Theo** appears as a portrait card (bottom-left) with speech. A **spotlight mask** dims everything except the target. A pulsing hand pointer shows the action, and there's a mini step list.
- Every lesson has **Skip lesson** and **Skip all tutorials** (unlock pacing still applies).
- **First-time tooltips** for each newly unlocked system are shown once and can be recalled from a **"?"** button on each sheet.
- Glossary terms (EV, OOP, pop report…) are underlined with a dotted line and explained on hover.

---

## 9. Responsive & Input
| Breakpoint | Layout |
|------------|--------|
| ≥ 1280 px (desktop) | Sheets slide in from the right (480–720 px) with the shop visible |
| 900–1279 px (laptop, tablet landscape) | Sheets 60% width |
| < 900 px landscape (phones) | Sheets full-screen, icon dock, compressed HUD |
| Portrait phones | v1.0: a "rotate your device" prompt. Portrait layout post-1.0 (**Q3**) |

Mouse and keyboard, and touch, are first-class. Gamepad support is post-1.0.

**Keyboard shortcuts:** Space pause · 1 = 1×, 2 = 2×, 3 = 4× speed · B build · I inventory · P prices · O orders · M market · C collection (binder) · G grading · S staff · U upgrades · J goals · Q/E rotate · Esc back · Ctrl+Z undo (build and prices).

---

## 10. Accessibility
- Text size 90–150% · optional **dyslexia-friendly UI font** (Atkinson Hyperlegible, OFL) · high-contrast panel theme.
- **Colorblind mode** (rarity and element palettes plus patterns) · rarity always has shape and label.
- **Reduced motion:** no shake or flash, static foils, instant page turns.
- **No forced time pressure:** interactions pause the clock by default. There's a "relaxed customers" option (patience ×2).
- Full keyboard navigation with visible focus rings. ARIA labels on all controls. Screen-reader-friendly sheets (the 3D scene has a textual "shop status" summary).
- All audio has a visual equivalent. Blip-voices are always accompanied by text.

---

## 11. Microcopy & Tone
- Second person, short and warm: "Your shelf is looking lonely." · "Dex left happy. That was a fair deal!"
- Numbers are always formatted (`$1,234.56`, `12.4k`) with a `+`/`−` sign on changes.
- Explain consequences before commitment: "Opening this 1st Edition box forfeits its sealed value ($1,240)."
- Personality in empty states: an empty binder says "Every legend starts with a single card."

---

## 12. UI Component Library (`src/ui/`)
**Primitives:** Button (primary, secondary, gold, danger, ghost; S/M/L) · IconButton · Toggle · Checkbox · Slider (with zone markers) · PriceStepper (± and quick %) · Select · SearchField · Tabs · SegmentedControl · Tooltip · Popover · Modal · Sheet (themes: paper, clipboard, tablet, leather, blueprint, corkboard, receipt) · Toast.
**Display:** Badge · Chip · Sticker · Stamp (animated) · RarityGem · ElementIcon · StarRating (half stars) · ProgressBar (XP shimmer) · Ring (completion) · MoneyCounter (rolling digits) · Countdown · Portrait (renders Peg-folk) · SpeechBubble · Sparkline · PriceChart · Receipt · EmptyState.
**Game:** CardView · CardThumb · SlabView · PackView · ProductTile · FixturePopover · CustomerBubble · DockButton · VirtualGrid (inventory).
Every component has a **Storybook-like demo page** in the debug build (`/debug/ui`) so the style can be reviewed in isolation.
