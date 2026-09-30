# 01 · Game Design Document: Foil & Fortune

> **Status:** Draft v0.1 (planning phase). Some decisions are still waiting on the user (see `USER_QUESTIONS.md`). Items marked **(Q#)** depend on an open question.
> **Numbers** (prices, rates, curves) are in `02_ECONOMY_BALANCING.md`. **Content** (sets, cards, manga, characters) is in `03_CONTENT_BIBLE.md`.

---

## 1. Vision

**One-liner:** *Rip packs, read customers, ride the market, and grow a dusty corner shop into the most legendary collectibles store in town.*

**Elevator pitch:** Foil & Fortune is a cozy but addictive shop tycoon that runs in the browser. You inherit a tiny, cramped card and manga shop in the coastal city of **Brightbay**. You buy stock wholesale and sell it for more. You haggle with a cast of quirky customers and crack packs hoping for a Mythic Rare. You send your best pulls to grading companies and speculate on sealed boxes that could double in value when a set goes out of print. Every day your shop looks a little busier, shinier and bigger, until you run a collectibles empire. Along the way you unlock your mentor Theo's mysterious vault.

**Genre:** Management / tycoon simulation with collection and light-gambling (pack opening) mechanics.
**Comparable games (for tone, not for copying):** *TCG Card Shop Simulator* (theme), *Recettear* (haggling and shopkeeping), *Stardew Valley* (cozy calendar, characters), *Two Point Hospital* (juicy diorama management), *Game Dev Tycoon* (satisfying growth curve), *Moonlighter* (customer price reactions), Pokémon TCG Live/Pocket (pack-opening feel).

## 2. Design Pillars

Every feature must serve at least one pillar. If a feature serves none, cut it.

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| 1 | **The Thrill of the Pull** | Opening product is the emotional peak. Anticipation, rarity hints, foil shine, sound stingers, slow-motion on big hits. Rare moments must feel rare. |
| 2 | **Merchant's Instinct** | Buy low, sell high through skill: reading customers, haggling, timing the market, knowing when to hold sealed product and when to grade. Knowledge is power. |
| 3 | **Watch It Grow** | Progress is visible and physical. The shop gets bigger, the shelves fuller, the customers fancier, the display cases shinier. You never grind in the dark. |
| 4 | **Collector's Pride** | Binders with empty silhouettes to fill, graded slabs, grail cards in a trophy case, completed sets. Some things you never sell. |
| 5 | **Cozy, not Cruel** | Pressure is gentle and optional. Bad luck stings but never ruins you (except in opt-in Tycoon mode). The world is warm and funny. No real-money anything. |

## 3. Audience, Platform & Session

- **Audience:** Fans of TCGs, collecting, and cozy management games, ages 12+. Easy to pick up, with depth for "number crunchers" who love market speculation.
- **Platform:** Desktop web browser first (mouse and keyboard). Tablets and phones in landscape are fully supported with a touch-optimized layout **(Q3)**. Installable as a PWA and playable offline. Deployed as a static site on Vercel.
- **Session shape:** One in-game day takes about 6 minutes at 1× speed. A natural session is 3–8 days (20–50 minutes). The game saves at the start of every day, so stopping at any time is safe.
- **Monetization:** None. No ads, no microtransactions, no real-money purchases **(Q12)**. Pack-opening "gambling" uses in-game money only.

## 4. Player Fantasy & Tone

- **Fantasy:** "I'm the shopkeeper everyone in town trusts, with an eye for value and a legendary collection."
- **Tone:** Warm, witty, a bit nerdy. Think a friendly local game store with regulars who have running jokes. There's gentle satire of hobby culture (hype, "sealed is an investment!", grading obsession), but it's never mean.
- **Moral texture:** You *can* lowball a clueless grandma. The game won't stop you, but the town remembers (see §12.5).

---

## 5. Core Gameplay Loop

### 5.1 The loop (from the brief)

```
Buy ──► Stock / Grade / Open ──► Sell ──► Profit ──► Upgrade shop ──► Unlock better products ──► (repeat)
 ▲                                                                                              │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Three nested loops

| Loop | Length | Player activities | Reward |
|------|--------|-------------------|--------|
| **Micro** (moment to moment) | 5–60 s | Serve a customer, ring up a sale, haggle, answer a request, rip a pack, restock a shelf | Coins, XP, reputation ticks, pull excitement, "DEAL!" stamps |
| **Day** | ~6 min (+ untimed prep/night) | **Morning prep:** check the market, receive deliveries, restock, set prices → **Open:** serve customers and handle events → **Close:** day summary, place orders, grading returns, binder time | Day-summary dopamine, level-ups, next-day teasers |
| **Meta** | hours | Level up, unlock suppliers and categories, expand the shop, follow the set-release calendar, chase set completion and grails, beat rival shops, open Theo's Vault | New toys, new spaces, new customers, story beats |

### 5.3 A typical day

1. **Dawn (untimed "Prep" phase).** The newspaper, *The Glimmer Gazette*, slides in with 1–3 headlines (market news, upcoming releases, events). Deliveries arrive at the back door. You restock and adjust prices. When ready, flip the door sign to **OPEN**.
2. **Business hours (09:00–19:00, real-time, pausable, 1×/2×/4×).** Customers arrive based on reputation, weekday, season and events. They browse, buy, ask for cards, try to sell you things, and haggle. Random events pop up as choice cards. Employees (once hired) automate routine tasks.
3. **Closing (untimed "Night" phase).** A receipt-style **Day Summary** prints: revenue, costs, profit, customers served, reputation change, XP, highlights ("Best pull: Mythic Sparkit Nova!"). Then you order stock for tomorrow, open grading returns, organize your binder, and plan. A **teaser** for tomorrow ("Delivery: 2 boxes arriving · Friday League Night · Pre-release in 3 days") keeps the "one more day" pull.

---

## 6. Time & Calendar

- **Clock:** Business hours are 09:00–19:00. Default pace: 1 in-game minute = 0.6 s real time at 1×, so one open day ≈ 6 minutes. Speeds: ⏸ Pause, 1×, 2×, 4×. The clock runs **only** while the shop is open. Prep and night phases are untimed **(Q6)**.
- **Interactions pause time.** Opening a negotiation, dialogue or event card pauses the clock by default. This is a setting. You never lose a sale because you were reading.
- **Week:** Monday–Sunday. **Day 1 is a Monday**, and since a season is exactly 4 weeks, every season starts on a Monday. Traffic rises on weekends. Friday evening is **League Night** (once play tables are unlocked). Tuesday is **New Manga Day**. Rent is due Sunday night.
- **Seasons and years:** 4 seasons × 28 days = a 112-day year, Stardew style. Seasons change the view out the window, decorations, customer mix (summer: kids on holiday, winter: gift shoppers) and events.
- **Release calendar:** A new **main set releases on day 1 of every season**. **Special sets** release on day 15 of some seasons. Prerelease events run on the weekend before a main-set release. A set enters **"last call"** about 56 days after release and goes **out of print** at about 70 days (two and a half seasons). See §17.4.
- **Game start:** Day 1 = Spring 8, Year 1. The current set, *Emberdawn*, released one week earlier and sells well. At the end of the tutorial week, the hyped special set *Sparkit & Friends* arrives on Spring 15 (Day 8), which is the first big "release day" moment. The full timeline is in `03 §4`.

---

## 7. The Shop

### 7.1 Shop view
The shop is a living **3D miniature diorama**, like a toy shop in a glass box, seen from a rotatable isometric camera **(Q1)**. Front walls are cut away. You see customers walk in (the door bell jingles), browse, pick things off shelves (shelves visibly empty), queue and leave. Lighting follows the time of day, and the window shows the season and weather.

### 7.2 Shop tiers (expansions)
You grow through **5 tiers**. Each tier enlarges the buildable floor, raises the traffic ceiling and rent, and unlocks new fixtures:

1. **The Nook**: a cramped corner shop (start)
2. **Hobby Shop**: you knock through into the neighbor's space
3. **Collector's Corner**: adds a service wing for stations
4. **Card Emporium**: adds a mezzanine level (manga and events)
5. **Flagship Megastore**: two full floors and a street-front showcase window

Expansions are big celebratory moments: a construction montage, a "Grand Re-Opening" day with a traffic boost, and new music stems.

### 7.3 Fixtures (furniture that does things)
Placed on a tile grid in **Build Mode** (§7.5). Each fixture has a footprint, capacity, allowed product categories and an **Appeal** value.

- **Shelves** (wall shelf, gondola, tall shelf) hold sealed product, accessories and manga. Capacity grows with fixture size (the brief's "Bigger Shelves").
- **Display cases** (small, large lit, rotating showcase tower) hold singles and graded slabs. Customers ask to see items and may haggle. More and better cases cover the brief's "More Display Cases".
- **Box wall rack:** booster boxes and premium collections, face-out.
- **Manga bookshelf:** volumes spine-out plus face-out "featured" slots.
- **Bargain bin:** bulk cards at cents each. Kids love it.
- **Pack vending machine:** sells packs on its own, with no checkout needed.
- **Register counter:** checkout lane(s). A second lane cuts queues.
- **Play tables:** enable League Nights and tournaments (§22.3).
- **Service stations:** Grading Desk, Sorting Station, Self-Checkout Kiosk, Streaming Studio. These unlock features.
- **Decor:** plants, posters, rugs, neon signs, a mascot statue, arcade cabinet, lighting. Decor only raises Appeal and personality.

**Rule:** anything that takes floor or wall space is a **fixture** (bought and placed in Build Mode). Everything else is an **upgrade** (§7.6) or **storage** (§7.4).

### 7.4 Storage (the brief's "More Storage Room")
The backroom holds stock that isn't on display, measured in **storage units (SU)**. On-site storage is upgraded Closet → Back Room → Stockroom (each replaces the last). An off-site **Warehouse Unit** adds capacity with one day of retrieval time. A separate **Climate Vault** protects high-value graded and vintage items and adds prestige. If storage is full, deliveries can't be received. They wait at the depot and incur a small fee, so you need to manage it.

### 7.5 Build Mode
- The view switches to a blueprint look: a grid overlay, a catalogue drawer, and ghost placement (green = valid, red = blocked). Keys: R rotates, drag moves, sell refunds 50%.
- **Path validation:** the door → counter path and every fixture's access tile must stay reachable. This uses the same A* grid customers use.
- **Appeal** (the sum of fixtures, decor and cleanliness) is shown live. Appeal raises traffic and customer patience.
- Layout choices matter: popular products near the entrance sell faster, and display cases near the counter cut "ask to see" walking time. **(Q9:** free grid placement is recommended over fixed slots.)

### 7.6 Shop services & upgrades (non-furniture)
Bought from the **Upgrades** board. Each is a one-time purchase that unlocks or improves a capability:
- **POS System** (auto-pricing rules, sales analytics) → **POS Pro** (reorder points, demand forecast)
- **Card Reader Terminal** (faster checkout)
- **Card Lab tools:** Loupe → Light Box → Centering Tool, kept at the Grading Desk. Each reveals more precise condition information (§15).
- **Security Tags** (Tycoon mode only; see Q14)
- **Website** → **FoilMarket seller account** (online marketplace)
- **Loyalty Cards** (regulars return more often)
- **Marketing:** flyers, social ads, radio spots and billboards are consumables that boost traffic, with optional targeting of customer types.

Prices and unlock levels are in `02 §4.5`.

---

## 8. Products & Categories

Categories unlock over time (see the unlock table in `02 §9`).

| Category | Examples | Where it's sold | Notes |
|----------|----------|-----------------|-------|
| **Sealed TCG** | Booster packs, 3-pack blisters, booster bundles, booster boxes ("Displays", 36 packs), Elite Collector Boxes, collection boxes, tins, starter decks, prerelease kits | Shelves, box rack, vending machine | Can be opened, sold, or held for appreciation |
| **Singles** (raw cards) | Any card from any set | Display cases, "singles binder" on the counter, FoilMarket | Price by market × condition |
| **Graded slabs** | Cards graded by a grading company | Display cases, showcase, auctions | Premium collectors and investors |
| **Bulk** | Commons and uncommons in quantity | Bargain bin, bulk lots, mystery box filler | Low value, high volume |
| **Promos** | Event promos, prerelease promos, staff promos | Display cases, events | Some are only obtainable through events |
| **Accessories** | Sleeves, deck boxes, binders, playmats, toploaders, storage boxes, dice | Pegboard, shelves | Steady margins. Competitive players buy them |
| **Manga** | Single volumes, deluxe editions, box sets, complete collections | Manga shelves | Separate market dynamics (§20) |
| **Mystery boxes** | Third-party mystery boxes, or **your own** built with the Mystery Box Builder | Shelves | Gamblers love them. Stingy boxes hurt reputation |
| **Import product** (late) | "Glimmerkin JP-style" sets: 5-card packs, better print quality, different art | Shelves, cases | Collector premium |
| **Other TCG brands** (late) | *Arcane Dominion* (fantasy strategy TCG), *Crimson Moon Card Game* (manga tie-in) | Everywhere | New customer groups (**Q8**) |

### 8.1 Mystery Box Builder (unlocks mid-game)
Pack a box with a mix of inventory (bulk, a few packs, one "hit"), choose the box style and set a price. Customers see only the price and box size. Satisfaction depends on **opened value ÷ price**. Generous boxes earn buzz and reviews. Stingy boxes earn a "scammy" reputation. This is a clever way to turn bulk into money, with an ethical tradeoff.

---

## 9. Stocking, Pricing & Inventory Management

### 9.1 Stocking
- Click a fixture to open its **fixture popover**, which shows slots, product, count/capacity and price. Slot actions: **Fill**, **Change product**, **Set price**. You can also drag products from the inventory drawer onto slots.
- **Restock All** tops up every slot from storage in one click. The owner avatar visibly walks around restocking, which is cosmetic and fast.
- Later, the **Stocker** employee restocks automatically using **restock rules** (min fill %, priority products).

### 9.2 Pricing
- Prices are set **per product (SKU)**, with an optional per-slot override. Helpers: **Match market**, **Market +X%**, **MSRP**, **Round to .99**, **Undercut rival**.
- The **Price Board** lists all products in stock: your price, market price, your average cost, margin %, sales velocity (last 7 days) and a stock-out risk icon.
- **POS System** upgrade: **pricing rules** such as "All singles = market +8%, rounded" or "Packs = MSRP". They re-apply automatically after the daily market update.
- **Customer feedback teaches pricing.** Thought bubbles show reactions: "What a steal!" (≤ 80% of market), "Fair price." (80–110%), "Hmm, pricey…" (110–130%), "Rip-off!" (> 130%). Rip-offs can dent reputation. Steals raise it but cut margins.

### 9.3 Inventory management (the brief's "don't run out")
- Low-stock pulses on shelves, and a **stock-out** icon when empty. Customers who can't find their wanted product leave disappointed, with a small reputation hit and lost sales.
- **Reorder points** (POS Pro): an alert, or an automatic order when stock drops below a threshold.
- **Demand hints:** the newspaper and the POS forecast say things like "Release Day in 3 days: expect 3× pack demand".
- Inventory screens: tabs for **Sealed · Singles · Graded · Bulk · Manga · Accessories · Personal Collection**, with search, filters (set, rarity, condition, value), sorting and bulk actions (price, move to case, send to grading, list online, add to binder).

---

## 10. Customers

### 10.1 Archetypes
Each archetype has a budget range, product preferences, **knowledge** (how well they know market prices), **price sensitivity**, **haggle style**, **patience**, visit-time preferences, and a reputation threshold before they start visiting. Numbers are in `02 §5`.

| Archetype | Wants | Behavior | Special |
|-----------|-------|----------|---------|
| **Kid** 🧒 (often with a parent) | Single packs, blisters, bargain bin, cheap holos | Small budget, low knowledge, rarely haggles, *very* happy with any holo | Happy kids give an outsized reputation boost ("Kid's Smile"). Summer and weekends bring more |
| **Casual Collector** 🙂 | Packs, tins, collections, cheap-to-mid singles of cute creatures | Moderate budget, some knowledge, a bit price-sensitive | Occasionally sells a small binder |
| **Competitive Player** 🏆 | Meta singles (often ×4 playsets), accessories, current-set boxes | Knows prices well and haggles fairly | Comes in waves around tournaments and League Night. Reacts to meta shifts |
| **Investor** 📈 | Sealed boxes (especially 1st Edition and out-of-print), high-grade slabs | Big budget, expert knowledge, tough haggler | Also *sells* sealed product to you when they take profits. Needs 2.5★ |
| **Manga Fan** 📚 | Manga volumes, box sets, complete runs, tie-in TCG product | Loyal to favorite series, asks for specific volumes | Needs the Manga category |
| **Hardcore Collector** 💎 | Vintage, 1st Edition, gem-mint slabs, set completion, misprints | Huge budget, very picky about condition, pays premiums | Brings "want lists". Needs 3★ |
| **Card Hunter** 🔎 | One specific card (shown in a speech bubble) | Pays a premium if you have it | If you don't, from Lv 8 you can accept a **Special Order** (§11.4) |
| **Attic Finder** 📦 | Wants to *sell* an old collection | Low knowledge, sometimes sentimental | Source of hidden vintage gems (§12.3) |
| **Shady Dealer** 🕶️ | Wants to *sell* suspicious cards | Too-good-to-be-true deals | Fakes or trimmed cards (§12.4). More common at low reputation |
| **Influencer** 🎥 | Rare pulls, cool shop moments | Rare visits. Films in your shop | A good experience creates **Hype** (a big temporary traffic boost). Needs 4★ |
| **Tourist** 🧳 (Tier 2+) | Souvenir-ish items, starter decks, manga | Low knowledge, low price sensitivity | Summer and weekends |

### 10.2 Regulars (named characters)
A cast of about 8 recurring characters (see `03 §8`) with portraits, personalities, running storylines and a **friendship meter**. Examples: **Milo** (9, saving his allowance for a Sparkit holo), **Grandma Rosa** (keeps finding boxes in her late husband's attic), **Dex** (tournament grinder), **Vivian Chen** (sealed-product investor), **Kenji** (manga superfan), **Harold Pemberton** ("The Completionist"), **Sasha "SashaRips"** (streamer), **Mr. Grimsby** (shady). Treating them well unlocks personal quests, exclusive deals and story beats. They remember lowballs.

### 10.3 Customer behavior (state machine)
`Arrive → Enter (door bell) → Browse (visit 1–5 fixtures by interest) → Decide → [Ask for help / Negotiate / Offer to sell / Special request] → Queue → Checkout → Leave → (optional) Review`

- **Interest** in a fixture depends on archetype preferences, what's displayed there, appeal, and whether they have a want list.
- **Bubbles** above heads show intent: 🛒 ready to pay · 💬 wants to talk or haggle · 📦 wants to sell · 🔎 looking for a specific card · ⏳ waiting (turns 😠 as patience drains) · ❤️ delighted · 💢 annoyed.
- **Patience** drains while waiting (queue, unanswered bubbles). It depends on archetype, appeal, reputation and music/decor. Customers whose patience runs out leave, with a small reputation hit.
- **Satisfaction** (−3…+3) is computed at exit from price fairness, availability, wait time, deal outcomes and "delight moments". It feeds reputation (§19) and reviews.

### 10.4 Traffic
Arrivals per hour = shop-tier base × reputation factor × appeal factor × weekday/time-of-day curve × season × event and marketing multipliers. See `02 §5.1`.

---

## 11. Selling

### 11.1 Checkout
Customers queue at the register. **Early game:** you click the register or the customer to ring them up. A short, satisfying scan animation plays (beeps, total, *cha-ching*, coins fly to the cash counter). One click per customer. Long queues drain patience, which creates the natural need for a **Cashier** or a Card Reader upgrade.

### 11.2 Display-case sales
A customer asks to see a card in a case, walks to it and inspects it. At or under their valuation, they buy. Above it, they **negotiate** (§13). Graded slabs and high-value singles almost always involve a haggle.

### 11.3 Bulk & bundles
- Customers can buy **individual packs or entire displays**, as the brief asks. Investors and competitive players sometimes buy whole booster boxes or multiple ECBs.
- The bargain bin sells bulk commons automatically ("3 for $1").

### 11.4 Special orders (quest-like contracts, Lv 8)
A Card Hunter asks for a card you don't have. You can **accept a special order** and agree a price (they offer market +10–30%) and a deadline (3–7 days). A 20% deposit is paid up front. You then source the card from FoilMarket, a supplier, a collection or your own pulls. Deliver in time for full payment, XP and reputation. Miss the deadline and you refund the deposit and take a reputation hit.

### 11.5 Online & auctions (mid/late game)
- **FoilMarket** (online marketplace): list singles, slabs or sealed product at your price. It sells over 1–5 days depending on price versus market, with a 12% fee. It never builds reputation. It's a liquidity valve, not a replacement for the shop.
- **Gavel & Glimmer Auctions** (late game, weekly): consign grails for a chance to beat market in a bidding frenzy, or bid on rare lots yourself. The live auction plays with an animated ticker and rival bidders.

---

## 12. Buying from Customers

### 12.1 The offer flow
A customer with a 📦 bubble approaches the counter with **cards, a binder, a shoebox of bulk, sealed product, or manga**.
1. **Look:** you see the items. For large lots you see a **sample** plus a hidden remainder.
2. **Appraise:** an estimated value range is shown. It is **wide** for unappraised lots and narrows with inspection, tools, knowledge and the TCG Expert.
3. **Offer:** an offer slider plus quick buttons (40% / 60% / 75% / 90% of estimate). The customer accepts, counters or walks. Patience pips and their mood face react in real time.

### 12.2 Buy cheap, fair, or overpay (from the brief)
The offer slider shows five fairness zones (exact values in `02 §6.3`):
- **Lowball (< 40% of true value):** knowledgeable customers get insulted and leave (reputation −). Uninformed ones may accept, with a hidden **"word gets around"** chance of a bad review later.
- **Low (40–55%):** usually accepted by desperate or uninformed sellers, with a small hidden review risk.
- **Fair (55–90%, the realistic buylist range):** a steady reputation gain, and it counts toward the Happy Deal streak.
- **Generous (90–100%):** a bigger trust gain.
- **Overpay (> 100%):** a customer-love reputation boost. It's usually a loss, but sometimes it's worth it to win a regular's friendship or to grab a lot you *suspect* hides something.

### 12.3 Large collections & hidden gems
Lots (binders of 50–500 cards, shoeboxes of 200–2,000) are generated from **lot recipes** (vintage attic find, modern binder, bulk dump, "player quitting the game" and so on). They are biased by the seller's archetype and the story. A lot may hide **gems**: vintage holos, 1st Editions, misprints, promos, and on very rare occasions a grail.

After buying, you **sort** the lot:
- Manually, with the **Sorting minigame**: a fast, tactile stream where you flick cards into Keep / Bulk / Case / Binder piles. Hits reveal with a shine and a sound.
- Or instantly with the Sorting Station upgrade or the TCG Expert.

"Customer brings in an amazing collection" is a scripted event variant with a guaranteed gem.

### 12.4 Fakes & altered cards
Shady dealers (and occasionally honest but unlucky sellers) bring **counterfeit** or **trimmed** cards. Detection:
- **Tells** you can spot on inspection: slightly off colors, wrong font weight, missing texture, and "light test" results with the Light Box.
- The **TCG Expert** employee detects fakes with a skill-based chance.
- **Grading companies** return fakes marked "Authenticity: Not Genuine" and keep the fee.

Selling a fake unknowingly causes a reputation hit and a refund when it's discovered. Knowingly selling one is not possible (the game refuses), which keeps the tone cozy.

### 12.5 Reputation memory
Lowballing and overpricing leave "memories" on regulars and a hidden town-wide *Trust* sub-score. It recovers slowly through fair play.

---

## 13. Price Negotiation (Haggling)

Haggling appears when customers **buy** high-value items and when they **sell** to you. The design goal is short, readable and skill-based, never tedious.

**Customer hidden values:** a *reservation price* (the most they'll pay, or the least they'll accept), an *opening offer*, **haggle patience** (1–5 counter rounds, by style), **mood**, and a **haggle style** (Pushover · Fair · Tough · Chaotic).

**Mechanics:**
- **UI:** a haggle table showing the item, your ask, their offer, a mood meter (face with 5 expressions), patience pips and quick buttons (±5%, ±10%, "meet in the middle", "final offer").
- Every counter spends patience. **Insulting asks** (far beyond their reservation) spend extra patience and sour their mood.
- **Tells:** depending on archetype and your *Read People* perk, you get hints like "They glance at the price twice…" (near their limit), "They're clutching their wallet" (budget-limited), or "Collector's gleam in their eyes" (high desire).
- **"Final offer"** ends the haggle. If your ask is within their reservation, they accept. Slightly above it, some accept and the rest walk. Far above it, most walk, and a few make one last counter to take or leave (`02 §6.1`).
- **Happy Deal streak:** consecutive deals that leave the customer happy (sales at ≤ 110% of market, buys in the Fair zone or better) build a small, visible **Streak** multiplier on reputation and XP (inspired by Recettear's combo system).
- **Auto-haggle:** later, a TCG Expert or a player-set policy handles routine haggles ("accept anything ≥ 92% of my price").

---

## 14. Opening Products

### 14.1 The pack-opening experience (the core "wow")
- A dedicated full-screen scene: dark vignette, spotlight, the pack gently floating with a foil sheen.
- **Tear:** drag across the top crimp to rip it, with foil particles and a crinkle sound. Tap-to-tear is the accessibility alternative.
- Cards slide out as a stack. **Tap or swipe** to reveal each one. Commons are quick and uncommons slightly slower. The **rare slot is last**, and its edge glows in rarity color *before* the flip. Big hits add a screen shake, a light burst, a rising choir stinger and a short slow-motion moment. **Mythic Rare** triggers a unique fanfare.
- Every card shows a **NEW!** badge if it isn't in your collection, plus its current market value.
- **End summary:** all pulls in a grid, total market value versus what the pack cost, and quick actions (add hits to binder, send to case, list, grade).

### 14.2 Opening at scale
- **Booster box / display (36 packs):** "Rip one by one", or **Quick Rip**, which opens all packs in about 10 seconds with a highlights reel of every Holo Rare and better, then a box summary.
- **Collection boxes / ECBs / tins:** open the outer box first (reveals promo card, sleeves and dice, which go to accessories), then the packs.
- **Starter decks:** open to a deck list reveal (guaranteed holo shown last).
- **Mystery boxes:** a lid-shake, then the contents reveal one by one.

### 14.3 Special pulls
- **God Pack:** about 1 in 2,000 packs has every card at Illustration Rare or better. It gets its own legendary animation and often goes viral in-game (reputation and hype boost).
- **Misprints:** miscut, missing foil, ink error, crimped, or an ultra-rare "wrong back". Collectors pay huge premiums.
- **1st Edition:** products from a set's first print wave carry the 1st Edition stamp on every card (§17.4).

### 14.4 Open or keep sealed?
A strategic decision the game makes legible. A booster box has a third option: **break the box** into 36 loose packs and sell them singly from the shelf, which is how a shop without a Box Wall Rack sells it. **Expected Value (EV)** per pack is shown once you own the POS upgrade or have a TCG Expert. Usually EV < MSRP but > wholesale cost. Opening gives XP, collection progress and singles to sell (which takes time). Keeping sealed offers safe margins and appreciation potential. Hype can push EV above MSRP, which drains sealed stock across town.

---

## 15. Card Conditions & Inspection

- **Five visible conditions** (from the brief): **Damaged · Played · Good · Near Mint · Mint**. Condition sets raw price via a multiplier (`02 §7`).
- **Hidden sub-scores** (1–10 in 0.5 steps): **Centering, Corners, Edges, Surface**. The visible condition is derived from them. Grading outcomes depend on them.
- **Where condition comes from:** fresh pulls are mostly Mint or Near Mint with occasional factory defects (off-center, print lines). Customer lots vary widely. Vintage cards skew toward Good or Played.
- **Inspection (the Card Lab):** zoom into a card with a **loupe** to spot whitening, dings and scratches. The **Light Box** reveals surface scratches and fakes. The **Centering Tool** measures borders exactly. Better tools and better staff give narrower **grade estimates** ("likely 8–9" becomes "72% chance of a 9"). This turns grading into a knowledge skill, not pure luck.
- **Protection (Tycoon mode only, Q14):** sleeves and toploaders are supplies. In Tycoon mode, high-value cards left unprotected in open cases slowly risk *surface* wear (a very small chance). Protected cards don't. Cozy and Standard have no card wear.

---

## 16. Grading

### 16.1 Companies (from the brief: cheap vs prestigious)

| Company | Tier | Personality | Unlock |
|---------|------|-------------|--------|
| **Cardboard Certs (CC)** | Budget | Cheap, fast, lenient but *inconsistent*. Small value premium | Level 6 |
| **Summit Grading Authority (SGA)** | Mid | Fair price, solid reputation | Level 12 |
| **Apex Grading Co. (AGC)** | Premium | Strict. An AGC 10 is *the* hobby status symbol. Biggest premiums | Level 17 |
| **Blackline Grading (BLG)** | Ultra-premium | Sub-grades on the label. A perfect 10/10/10/10 earns the fabled **Black Label** | Level 30 |

Each company offers service tiers (Economy / Standard / Express: cost versus turnaround) with declared-value limits and bulk discounts.

### 16.2 Flow
1. **Build a submission** at the Grading Desk. Drag cards in, pick company and tier, and review fees, turnaround and (with tools or staff) the predicted grade distribution.
2. **Ship it.** A tracker shows the parcel journey: In Transit → Received → Grading → Shipped Back.
3. **The reveal** is its own dopamine moment. Slabs come out of bubble wrap one at a time and the label flips up, with a drumroll and a burst for 10s. A Black Label gets a unique celebration.
4. **Graded card.** The slab shows company, grade, card name and a cert number. Sell it in a case, consign it at auction, keep it in the Trophy Room, or **crack it** to resubmit (you lose the slab fee, gamble for a higher grade, and risk damage).

### 16.3 Randomness with logic
The final grade comes from the hidden sub-scores (**the weakest attribute dominates**) plus company-specific **noise** (budget = high variance) and **strictness** (premium = harsher, with a strict rule for 10s). Value multipliers depend on company prestige × grade × card desirability × **population scarcity** (fewer 10s in the world means a higher premium). The world has a simulated **Population Report** per card and company, which your own submissions add to. Formulas are in `02 §8`.

### 16.4 Graded cards sell individually (from the brief)
Slabs are individual inventory items with their own price tags. Investors and collectors hunt them, and high grades on vintage cards are the game's most valuable items.

---

## 17. Market & Economy (player-facing)

### 17.1 Daily market prices (from the brief)
Every morning at 06:00 the market ticks. Each card and sealed product gets a new **market price** that drifts with trends, randomness and events. It's visible in the **FoilTrack** app (an in-game tablet) as price, 7- and 30-day change, a sparkline, all-time high and a "Hot 🔥" tag.

### 17.2 What moves prices
- **Popularity** of creatures (fan favorites rise) and sets (hype cycles).
- **Tournaments and meta:** weekly tournament results make certain competitive cards spike. The brief's "temporarily popular because of tournaments" includes the ban-list shock.
- **New releases:** a new set pulls demand from the previous one. Its singles dip, but *out-of-print* sealed product rises. A new "Nova" support card can revive old cards. (From the brief: "New sets can make older cards more or less desirable.")
- **Reprints:** anniversary sets and reprint announcements drop prices of the reprinted vintage cards.
- **Events:** viral videos, influencer openings, anime announcements, nostalgia waves and "market crash" rumors.
- **Scarcity over time:** out-of-print product and vintage grow scarcer, so prices climb (from the brief: "Old sets become harder to find and potentially more valuable").

### 17.3 Market indices & news
Set indices ("Emberdawn Index", "GK Vintage Index") work like stock tickers. *The Glimmer Gazette* headlines explain big moves, which teaches players cause and effect.

### 17.4 Set lifecycle
`Announce (≈10 days before) → Pre-orders (Official Distributor) → Prerelease weekend → Release day (1st Edition wave, ~7 days) → In print (Unlimited) → "Last call" from ~day 56 (supplier stock dwindles) → Out of print at ~day 70 → Vintage (years later)`
- **1st Edition wave:** limited quantities of 1st Edition product, mostly through pre-order allocations. Holding 1st Edition sealed product is a long-term investment.
- **Out-of-print:** suppliers stop restocking. Remaining sealed product gets scarce and appreciates, with volatility and reprint risk.
- **Vintage:** sets from the TCG's history before the game begins. You obtain them only from customers, lots, auctions, card shows and FoilMarket.

---

## 18. Suppliers & Ordering

Better suppliers unlock with level and reputation (from the brief: "Unlock better suppliers"). The full catalog is in `02 §10`.

| Supplier | Unlock | Specialty | Delivery |
|----------|--------|-----------|----------|
| **Budget Box Co.** (cash & carry) | Start | Packs, blisters, starter decks, tins, collection boxes, third-party mystery boxes. Small minimums, higher prices | Next morning |
| **Harbor Hobby Distribution** (regional) | Lv 4, 2★ | Booster boxes, ECBs, bundles, collections, bulk discounts. Accessories from Lv 9 | 2 days |
| **Kaze Manga Direct** | Lv 5 | Manga volumes, deluxe editions, box sets | 3 days |
| **FoilMarket** (online) | Lv 8 | Buy singles, slabs and sealed at market + shipping. Also where you sell online | 2 days |
| **Starforge Official Distribution** | Lv 10, 3★ | Pre-orders, **1st Edition allocations**, prerelease kits, League Promo Kits (event supply), best prices | On release day |
| **Liquidators & Estate Sales** | Events, Lv 8+ | Random lots, vintage sealed, damaged stock. High risk, high reward | Varies |
| **Sakura Imports** | Lv 18 | JP-style Glimmerkin sets | 5 days + customs |
| **Other brand distributors** | Lv 22 / Lv 32 | *Arcane Dominion*, *Crimson Moon CG* | 2 days |

**Mechanics:** minimum order quantities, volume discount tiers, **limited stock** (from the brief), **allocations** for hyped releases (based on your shop tier and sales history), delivery ETAs, optional **shipping insurance**, and the **damaged shipment** risk (from the brief), which insurance covers. You order through the in-game **"Crate" app**, a slick delivery-app-style catalog.

---

## 19. Reputation & Reviews

- **Reputation:** a 0–100 score shown as **0–5 stars** (half-star steps). The start is 1★.
- **Built from** customer satisfaction, price fairness, availability, service speed, fair buying, community events and Kid's Smile moments.
- **Hurt by** rip-off prices, stock-outs, long queues, lowball exposure, selling fakes, failed special orders and broken promises.
- **Effects:** traffic volume, **customer mix** (higher reputation brings investors, collectors and influencers), patience, supplier access and event invitations. From the brief: "Higher reputation brings more customers".
- **Sub-scores** are shown on the reputation panel: *Prices · Service · Selection · Trust · Community*. This way the player knows *why* reputation moved.
- **ShopStars reviews:** a feed of short, funny customer reviews ("5★ Found my grail AND the owner gave my kid a free sticker"; "2★ Waited 20 min, guy was busy staring at a slab"). Reviews quote the actual cause.

---

## 20. Manga

From the brief: buy wholesale, sell individually, popular series sell fast, older volumes get harder to source, and complete collections can be bought and sold.

- **Series:** each has volumes 1…N, a genre, a status (ongoing or completed), a **popularity profile** (Mega-hit, Popular, Rising, Cult Classic, Evergreen, Seasonal, Fading) and a release cadence (every 4, 6, 7 or 8 weeks). There are 8 series at launch (`03 §7`).
- **Wholesale:** Kaze Manga Direct sells volumes in bundles of 5+. **Older volumes** of popular series have limited supplier stock and can go out of print for a while, so they carry a second-hand premium.
- **New Manga Day (Tuesdays):** fans come in for new volumes. Stock up in advance.
- **Complete collections:** box sets and "complete runs" (vol 1–N) sell at a premium to Manga Fans. Buy them from customers (who often want to offload a whole run), or assemble your own from single volumes to sell as a set.
- **Events:** an anime announcement spikes a series. "Final volume" hype. A manga-to-TCG tie-in brand (*Crimson Moon Card Game*) links the two markets.
- **Personal Manga Library** (from the brief's "Build a huge manga collection"): a cozy shelf in your back office that tracks completed series with achievements.

---

## 21. Employees & Automation

From the brief: hire employees later. Roles include cashier, stocker, TCG expert and grading specialist, with different skills and salaries.

| Role | Unlock | Automates | Key skill |
|------|--------|-----------|-----------|
| **Cashier** | Lv 7 | Checkout | Speed, Charisma |
| **Stocker** | Lv 12 | Restocking by rules, receiving deliveries | Speed, Organization |
| **TCG Expert** | Lv 14 | Appraising lots, fake detection, auto-buy offers by policy, pricing insights | Knowledge, Negotiation |
| **Event Host** | Lv 16 | Runs League Nights and tournaments | Charisma, Organization |
| **Grading Specialist** | Lv 20 | Precise pre-grading, submission prep (bulk-fee discount), crack-and-resubmit advice | Precision, Knowledge |
| **Streamer** | Lv 25 | Pack-break streams in the Streaming Studio | Charisma, Hype |
| **Store Manager** | Lv 35 | Runs branch stores, auto-ordering | Management |

- **Candidates** refresh weekly. Each has **skills** (1–5 ★), **traits** (e.g., *Speedy*, *Chatty* (+sales, −speed), *Eagle Eye* (+fake detection), *Kid Whisperer*, *Night Owl*, *Clumsy* (a tiny damage risk in Tycoon, slower restocking otherwise)), a **salary ask**, and a personality blurb.
- **Growth:** employees gain XP and level up. Training courses cost money.
- **Morale:** affected by pay versus market wage, workload, days off and bonuses. Low morale lowers performance, and very low morale leads to quitting (with warnings).
- **Policies:** you set rules instead of micromanaging, for example "Buy lots only if estimated profit ≥ 25%", "Restock packs when below 50%", or "Accept haggles within 5%".
- **Design intent:** early game you do everything by hand and learn the systems. Later you **delegate the routine and keep the fun** (big deals, openings, grading reveals, speculation). This is the classic tycoon arc.

---

## 22. Events

### 22.1 Random events (choice cards)
Presented as illustrated **event cards**, often with 2–3 choices. Frequency is about 0–2 per day. The positive-to-negative ratio is about 70/30. Examples (the full list is in `03 §10`):
- **Supplier has limited stock** (brief): a flash sale on hyped boxes. Only 3 left. Buy now at a premium?
- **Customer brings in an amazing collection** (brief): a guaranteed-gem lot and a haggle with a sentimental seller.
- **Sudden demand for a card** (brief): a streamer pulled it live, so its price spikes and hunters flood in.
- **Shipment arrives damaged** (brief): some items are damaged. Claim insurance or sell as "damaged box" at a discount.
- **Rare product available at a good price** (brief): an estate sale offers a vintage sealed box. Is it authentic?
- Others: rainy day, heat wave, power outage (close early), street festival, school holidays, bulk buyer, price-guide error (arbitrage), rival shop sale, influencer visit, ban-list update, reprint rumor, anime announcement, lost kid, and more.

### 22.2 Scheduled events
Release days, prerelease weekends, League Night (Fridays), New Manga Day (Tuesdays), seasonal festivals (Spring Blossom Fair, Summer Holidays, Autumn Lantern Festival, Winter Gift Rush), and quarterly **Collectors Con**.

### 22.3 Community events (you host)
With play tables you can host **League Night**, **Tournaments** and **Prerelease Events**. You charge entry fees and provide prize packs. Competitive players flood in and buy singles and accessories, and your Community sub-score grows. The simulated bracket's **winning deck influences local demand** for its cards the next day.

### 22.4 Card Shows (mid/late game)
**Brightbay Collectors Con** (quarterly, Lv 20+). Rent a booth, choose what to bring (limited cases), then play an intense high-traffic trading session. Other dealers have wares for you to buy, and rare finds turn up. There is big XP and reputation, and it's a change of scenery.

### 22.5 Streaming pack breaks (late game)
In the Streaming Studio you sell "spots" in a box break. Viewers watch you open live, chat reacts, and great pulls can go viral (hype boost). Bad breaks make chat grumpy.

---

## 23. Progression

- **Shop Level 1–50.** XP comes from sales, deals, openings, pulls, grading, special orders, events, achievements and story. Each level unlocks something (products, suppliers, fixtures, services, staff roles, events). The full table is in `02 §9`.
- **Shop Rank titles** mark milestones: *Corner Stall (Lv 1) → Hobby Shop (Lv 7) → Local Favorite (Lv 15) → Collector's Haven (Lv 25) → Collectibles Empire (Lv 35) → Collectibles Legend (Lv 50)*.
- **Unlock pacing:** there is a steady drip of new toys. No level is "empty".
- **Gated by more than level:** some unlocks also require reputation (for example Official Distributor needs 3★), a shop tier, or a story beat.
- **Pacing targets** (1× speed, average play): Lv 5 ≈ 30 min · Lv 10 ≈ 1.5 h · Lv 20 ≈ 5 h · Lv 30 ≈ 11 h · Lv 50 ≈ 35 h+ (tuned via the headless balance simulator; see `02 §18`).

---

## 24. Collection, Binder & Trophy Room

- **Personal Collection** is separate from shop inventory. Cards in your binder are **never sold by accident**, and staff never touch them.
- **Card Binder** (brief): a skeuomorphic binder with 3×3 pocket pages and satisfying page flips. Tabs per set, empty-slot silhouettes, completion rings, and filters by rarity or variant. Multiple binders can have custom covers, which are unlockable cosmetics.
- **Set completion:** a *normal set* (every card number) and a *master set* (every finish and variant), with rewards: achievements, reputation "Collector" bonus, trophies and binder covers.
- **Dex:** a species index (every creature you've owned, with lore blurbs), a nice extra for completionists.
- **Trophy Room** (back office): display grails and slabs on shelves and walls. Prestige feeds the Town Ranking. You can loan items to your shop's **Showcase** as "Not for sale" exhibits, which boosts appeal and attracts collectors. Real shops do this.

---

## 25. Goals, Quests & Achievements

- **Goals Board** (corkboard):
  - **Daily Objectives:** three small tasks per day ("Sell 15 packs", "Close 2 fair deals", "Open a box") with small rewards. You can reroll one per day.
  - **Theo's Lessons:** a tutorial quest chain in the first weeks that doubles as onboarding.
  - **Regular storylines:** personal quests from named characters.
  - **Legacy Goals:** the 5 locks of Theo's Vault (§26).
- **Achievements** (brief): about 100 at v1.0 across *Business, Opener, Collector, Grader, Merchant, Community, Manga and Legend*. They show toasts with sound. Some grant cosmetics (binder covers, shop decor, avatar items). Examples are in `03 §11`.

---

## 26. Long-term Goals & Endgame

From the brief, and expanded:

| Goal | How it's represented |
|------|---------------------|
| **Own the biggest shop in town** | **Town Rankings**: a weekly leaderboard of 6 Brightbay shops (you plus rivals *MegaMint Collectibles*, *Sterling & Slab*, *The Dragon's Hoard* and others). Score = reputation + revenue + collection prestige + community. Overtaking each rival triggers a story beat |
| **Complete entire TCG sets** | Set and master-set completion tracking, rewards and trophies |
| **Own extremely rare cards** | A **Grail List** of the game's rarest items (e.g., a 1st Edition Origins Infernox in AGC 10, Black Label Mythics, famous misprints, 1-of-1 prototypes) |
| **Build a huge manga collection** | Personal Manga Library with milestones (100 / 500 / 1,000 volumes, 10 complete series) |
| **Open additional stores** | **Branch stores** (Lv 35+) in other districts (Harborfront, University Quarter, Uptown), each with its own customer mix. A Store Manager runs each one, you set policies, and a **City Map** shows your empire |
| *(new)* **Theo's Vault** | A narrative meta-goal. The vault in the back office has **5 locks**, each opened by a Legacy Goal (5★ reputation, complete a vintage set, own a 10-graded Mythic, reach #1 in Town Rankings, open a branch). Inside is Theo's secret: the one-of-a-kind **Origins Prototype** card and the story finale |
| *(new)* **Hall of Fame** | Legendary moments are recorded: first God Pack, biggest sale, first Black Label |
| *(new)* **Become the Con headliner** | Host the Regional Championship at your Flagship |

The game continues as an endless sandbox after the finale. New sets keep releasing: hand-made sets first, then a procedural set generator (see `03 §5`).

---

## 27. Story, Characters & Onboarding

### 27.1 Premise
**Theo Hartley** ran *Theo's Cards & Comics* on Lantern Lane for 30 years. Retiring, he hands you the keys to the (now tiny, dusty) shop, a shoebox of stock, a battered binder, and one riddle: *"The vault opens for someone who earns it."* You name your shop. The default is **Foil & Fortune**.

### 27.2 Onboarding (Theo's Lessons)
Progressive disclosure: the HUD dock starts with 3 buttons and gains more as systems unlock. Nothing is dumped on the player at once.

| Day | Lesson (interactive, skippable) |
|-----|--------------------------------|
| 1 | Stock the shelf with packs, set a price, open the shop, serve a kid, ring up the checkout, **rip your first pack**, read the day summary |
| 2 | Order from Budget Box Co. and a customer offers you a binder: your first buy offer and haggle |
| 3 | Put singles in the display case, haggle a sale, and meet the FoilTrack market app |
| 4 | Level-up rewards, then enter Build Mode and place your first new fixture (a Gondola Shelf) |
| 5–7 | Reputation panel and reviews, Daily Objectives unlocked, rent day explained (Day 7 is the first Sunday), a teaser for grading ("Theo knows a guy at Cardboard Certs…") and for Release Day on Day 8 |

Later systems (grading, special orders, staff, and so on) get a short Theo tip or first-time spotlight when they unlock.

"I know what I'm doing" skips the tutorial but keeps the unlock pacing.

### 27.3 Story beats (light)
Delivered through Theo's visits, regulars, rival encounters and the vault. They are short, funny, optional to read, and never block play **(Q10)**.

---

## 28. Difficulty & Fail States **(Q7)**

| Mode | For | Rules |
|------|-----|-------|
| **Cozy** | Relaxed players | No rent. Forgiving customers. Fakes are rare. Cash can't go below 0 (purchases are blocked instead) |
| **Standard** (default) | Most players | Weekly rent and salaries. A bank loan is available when short (interest). No game over, but heavy debt limits suppliers and reputation |
| **Tycoon** | Veterans | Higher costs and savvier customers. Security matters. **Bankruptcy is possible** (game over, or reload the last weekly save) |

---

## 29. Retention & "Hook" Design (ethical)

- **Always something next:** tomorrow's teaser, a grading return countdown, the release calendar, pre-order countdowns, an auction timer.
- **Variable rewards** come *only* from in-game systems: pack pulls, lot sorting, grading reveals.
- **Collection loops:** silhouettes in binders and the Grail List.
- **Visible growth:** the shop changes physically.
- **Short feedback cycles** and juicy UI (see `05_UI_UX.md` §6).
- **No dark patterns:** no energy timers, no real money, no guilt-trip notifications, and no penalties for time away (no offline progress by default; **Q28**).

---

## 30. Scope Tiers

Mapped to `ROADMAP.md` phases:

| Tier | Contents |
|------|----------|
| **Vertical Slice** (Phase 2) | Tier-1 shop, one current set (subset), packs and boxes, kids and casual customers, stocking, pricing, checkout, pack opening, basic binder, day cycle, save/load |
| **MVP / Early Access** (Phases 3–6) | Full core loop, 6 curated sets (*Origins*, *Tidebreak*, *Moonlit Masquerade*, *Emberdawn*, *Sparkit & Friends*, *Sunken Kingdom*) plus Set Forge v1 as a calendar fallback, suppliers incl. Starforge, third-party mystery boxes, negotiation, buy offers, lots and sorting, reputation, full market sim with release calendar and 1st Editions, FoilMarket, special orders, conditions and grading (2 companies), fakes, events, League Night, build mode, tiers 1–3, first staff (Cashier, Stocker), achievements (first 30) |
| **v1.0** (Phases 7–10) | Manga, accessories, Mystery Box Builder, expert staff and automation, tiers 4–5, all 4 graders, imports, auctions, card shows, streaming, branches, rivals, Theo's Vault ending, second TCG brand, **all 16 curated sets** (`03 §4`) plus Set Forge v2, ~100 achievements, localization **(Q4)** |
| **Post-1.0** | Third brand, New Game+/Legacy, seeded daily challenges, mod/content packs, seasonal live events (offline, data-driven), optional card-battle mini-game **(Q11)** |

---

## Appendix A: Glossary

| Term | Meaning |
|------|---------|
| **Display** | A booster box (German hobby term). 36 packs for Glimmerkin |
| **ECB** | Elite Collector Box: 9 packs + accessories + promo |
| **Singles** | Individual cards sold separately |
| **Slab** | A graded card sealed in a plastic case |
| **Pop report** | How many copies of a card exist at each grade |
| **EV** | Expected value of opening a product |
| **OOP** | Out of print |
| **Hit** | A card of Holo Rare or better, the exciting pull |
| **Bulk** | Low-value commons and uncommons |
| **Lot** | A group of items sold together (e.g., a customer's binder) |
| **Chase card** | The most sought-after card of a set |
| **Grail** | A collector's ultimate dream item |
| **Nova** | Glimmerkin's ultra-rare "powered-up" creature card mechanic |
| **SU** | Storage units (backroom capacity) |
| **Appeal** | Shop attractiveness from fixtures and decor. Raises traffic and patience |
