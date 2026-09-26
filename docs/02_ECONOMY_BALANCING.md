# 02 · Economy, Balancing & Progression

> **Purpose:** the *numbers* behind the systems in `01_GAME_DESIGN.md`.
> **Rule:** every constant here lives in code under `src/content/balance/*.ts` (one file per domain), never hard-coded in systems. The values below are **initial tuning targets**. The headless balance simulator (§18) is the source of truth for final values. When numbers change, update this doc in the same commit.

**Conventions:** money is shown in `$` (fictional "Brightbay dollars"; **Q5**). All prices are in **cents (integers)** internally to avoid floating-point drift. "Market value" always means **Near Mint, raw** unless stated otherwise. `U(a,b)` is uniform, `N(μ,σ)` is normal, and `round½` rounds to the nearest 0.5.

---

## 1. Time Constants (`balance/time.ts`)

| Constant | Value | Notes |
|----------|-------|-------|
| Business hours | 09:00–19:00 | 600 game-minutes |
| Real seconds per game-minute (1×) | 0.6 s | 1 open day ≈ 6 min real time |
| Speeds | 0 (pause), 1×, 2×, 4× | |
| Sim tick | 1 game-minute | Fixed step. The view interpolates between ticks |
| Week / Season / Year | 7 / 28 / 112 days | Mon–Sun · Spring, Summer, Autumn, Winter |
| Market update | Daily, before prep | |
| Rent due | Sunday night | Weekly: 7 × daily rent |
| Autosave | Start of every prep phase + manual | |

## 2. Starting State per Difficulty (`balance/difficulty.ts`)

| | Cozy | **Standard** | Tycoon |
|---|---|---|---|
| Cash | $1,000 | **$600** | $400 |
| Daily rent (Tier 1) | $0 | **$35** | $50 |
| Loan interest / week | — | **1%** | 3% |
| Customer knowledge modifier | −0.10 | **0** | +0.15 |
| Fake frequency | ×0.25 | **×1** | ×1.5 |
| Damaged-shipment chance / order | 1.5% | **3%** | 5% |
| Bankruptcy | never | **never** (debt limits instead) | yes |

**Starting inventory (all modes):** 24 × *Emberdawn* Booster Pack, 4 × *Emberdawn* 3-Pack Blister, 2 × *Emberdawn* Starter Deck, **Theo's Binder** (30 mixed singles including 2 Holo Rares and 1 vintage *Origins* uncommon as story bait), and a **Bulk Shoebox** (200 commons and uncommons).
**Starting fixtures:** 2 × Small Wall Shelf, 1 × Small Display Case, 1 × Register Counter (1 lane), Closet storage (200 SU), 1 plant, 1 "Origins" poster.
**Starting reputation:** 20 (1★). **Level** 1.

---

## 3. Money, Loans & Expenses (`balance/finance.ts`)

- **Expenses:** rent (weekly), salaries (daily, paid at close), supplier orders (paid when ordered), grading fees (paid at submission), marketing, fixtures and upgrades (paid on purchase), depot fees, loan interest.
- **Bank loan** (Brightbay Credit Union): available any time up to `max($1,000, 3 × avg weekly revenue over the last 4 weeks)`. Interest is charged weekly. In Standard, if rent can't be paid, an automatic loan is offered with a warning. Above 80% of the loan limit, **supplier credit freezes** (no new orders except Budget Box Co.) until debt drops.
- **Tycoon bankruptcy:** rent unpaid while the loan is maxed → bankruptcy screen → reload the last weekly save or restart.
- **HUD formatting:** `$1,234.56` in detailed views. Abbreviate large values in the HUD (`$12.4k`, `$1.2M`).

---

## 4. Shop Tiers, Fixtures, Storage & Appeal (`balance/shop.ts`)

### 4.1 Tiers

| Tier | Name | Buildable grid | Unlock | Upgrade cost | Rent/day (Std) | Base traffic `B` (customers/h) | Staff cap |
|------|------|----------------|--------|-------------|----------------|------------------------------|-----------|
| 1 | The Nook | 6 × 5 | start | — | $35 | 2.5 | 1 |
| 2 | Hobby Shop | 9 × 7 | Lv 7 | $6,000 | $70 | 4.0 | 3 |
| 3 | Collector's Corner | 12 × 9 + backroom | Lv 15 | $25,000 | $140 | 6.0 | 5 |
| 4 | Card Emporium | 16 × 11 + mezzanine 8 × 6 | Lv 25 | $90,000 | $280 | 9.0 | 8 |
| 5 | Flagship Megastore | 20 × 14 + upper floor 20 × 10 | Lv 35 | $300,000 | $550 | 13.0 | 12 |

Branch stores (Lv 35 / 40 / 45): $150,000 / $250,000 / $400,000 purchase, with $250–$400 per day rent each.

### 4.2 Fixtures (initial catalog)

| Fixture | Footprint | Capacity | Cost | Unlock | Appeal |
|---------|-----------|----------|------|--------|--------|
| Small Wall Shelf | 2×1 (wall) | 4 slots | $150 | Lv 1 | +1 |
| Gondola Shelf (double-sided) | 2×1 | 8 slots | $450 | Lv 3 | +2 |
| Tall Wall Shelf | 3×1 (wall) | 12 slots | $900 | Lv 8 | +3 |
| Box Wall Rack | 2×1 (wall) | 6 boxes | $600 | Lv 4 | +2 |
| Small Display Case | 2×1 | 6 singles/slabs | $300 | Lv 2 | +2 |
| Large Lit Display Case | 3×1 | 16 singles/slabs | $1,500 | Lv 10 | +5 |
| Showcase Tower (rotating, lit) | 1×1 | 8 premium items | $4,000 | Lv 18 | +10 |
| Manga Bookshelf | 2×1 (wall) | 60 spine + 6 face-out | $500 | Lv 5 | +2 |
| Bargain Bin | 1×1 | bulk cards | $120 | Lv 4 | +1 |
| Accessory Pegboard | 2×1 (wall) | 12 accessory slots | $350 | Lv 9 | +1 |
| Pack Vending Machine | 1×1 | 60 packs (auto-sell) | $2,500 | Lv 12 | +3 |
| Register Counter (extra lane) | 2×1 | 1 lane | $800 | Lv 7 | +1 |
| Play Table (4 seats) | 2×2 | 4 players | $400 | Lv 10 | +2 |
| Grading Desk (service) | 2×1 | — | $1,200 | Lv 6 | +1 |
| Sorting Station (service) | 2×1 | — | $900 | Lv 8 | 0 |
| Streaming Studio (service) | 3×3 | — | $12,000 | Lv 25 | +6 |
| Decor (plants, posters, rugs, lights, neon, statue, arcade…) | 1×1–2×2 | — | $25–$2,000 | Lv 1+ | +0.5…+8 |

**Slot capacities:** 1 shelf slot = 12 packs, **or** 4 blisters/tins/starter decks, **or** 2 bundles/collections/ECBs, **or** 6 accessories, **or** 10 manga volumes (face-out: 3). 1 box-rack slot = 1 booster box.

### 4.3 Storage

| Storage | Capacity | Cost | Unlock |
|---------|----------|------|--------|
| Closet | 200 SU | start | — |
| Back Room | 800 SU | $2,000 | Lv 6 |
| Stockroom | 2,500 SU | $10,000 | Lv 15 (Tier 3) |
| Warehouse Unit (off-site; +1 day retrieval) | 10,000 SU | $50,000 | Lv 28 |
| Climate Vault (graded/vintage; +prestige) | 500 slabs + 50 sealed | $80,000 | Lv 30 |

**Product sizes (SU):** pack 1 · blister 2 · tin 3 · starter deck 2 · bundle 3 · collection box 5 · ECB 6 · booster box 18 · manga volume 1 · accessory 1 · 100 bulk cards 1 · slab 0.2. Raw singles live in card boxes and binders, with no SU cap except 20,000 singles per Card Storage tier.
**Depot fee** when storage is full: $5/day per waiting order.

### 4.4 Appeal
`appeal = Σ fixture appeal + Σ decor appeal − clutterPenalty` · `clutterPenalty = 5 × max(0, floorUsage − 0.85) / 0.15`
Normalized appeal `a = 1 − e^(−appeal / scale_tier)`, where `scale_tier` = 15, 30, 50, 80, 120 for tiers 1–5.
**Effects:** traffic ×(1 + 0.5a) · patience ×(1 + 0.3a) · buy-probability tolerance +0.05a.

### 4.5 Upgrades, services & marketing

| Upgrade | Cost | Unlock | Effect |
|---------|------|--------|--------|
| Card Reader Terminal | $400 | Lv 7 | Checkout 30% faster (manual and cashier) |
| POS System | $750 | Lv 9 | Pricing rules, sales analytics, EV display |
| Website | $500 | Lv 8 | Enables the FoilMarket seller account |
| Card Lab: Loupe | $100 | Lv 6 | Inspect corners and edges, grade estimate ±1.5 |
| Card Lab: Light Box | $600 | Lv 12 | Reveals surface and fakes, estimate ±1.0 |
| Card Lab: Centering Tool | $1,500 | Lv 17 | Exact centering, estimate ±0.5 |
| Loyalty Cards | $800 | Lv 12 | Regulars and satisfied customers return 25% more often |
| POS Pro | $3,000 | Lv 16 | Reorder points, auto-order, demand forecast |
| Self-Checkout Kiosk | $3,500 | Lv 18 | 1 automatic lane (slower than a good cashier) |
| Security Tags *(Tycoon only)* | $1,000 | Lv 10 | Prevents shoplifting events |
| Marketing: Flyers | $50 | Lv 11 | +10% traffic for 3 days |
| Marketing: Social Ads | $200 | Lv 11 | +20% traffic for 7 days, targetable at one archetype |
| Marketing: Radio Spot | $1,000 | Lv 20 | +35% traffic for 7 days |
| Marketing: Billboard | $5,000 | Lv 30 | +50% traffic for 14 days, +Community |

Marketing effects of the same kind don't stack. The strongest active one applies.

---

## 5. Customers (`balance/customers.ts`)

### 5.1 Traffic
Customer arrivals follow a Poisson process with hourly rate:

```
λ(h) = B_tier × R(rep) × (1 + 0.5a) × W(weekday) × H(hour) × S(season) × E(events) × M(marketing)
R(rep) = 0.6 + 0.8 × (rep/100)^0.8
```

| Weekday `W` | Mon 0.85 · Tue 0.90 · Wed 0.95 · Thu 1.00 · Fri 1.15 · Sat 1.40 · Sun 1.25 |
|---|---|
| **Hour `H`** | 09–11: 0.6 · 11–13: 1.1 · 13–15: 0.9 · 15–17: 1.3 · 17–19: 1.1 (mean 1.0) |
| **Season `S`** | per archetype, e.g., Kids ×1.4 in Summer, gift shoppers (Casual ×1.3) in Winter |

*Sanity check:* Day 1 (Mon, rep 20, a≈0.2) gives 2.5 × 0.82 × 1.1 × 0.85 ≈ **1.9 customers/h ≈ 19/day**. The tutorial day overrides this with scripted arrivals.

### 5.2 Archetypes

| Archetype | Budget | Knowledge `k` | Price sens. `s` | Patience (game-min) | Haggle style mix | Min rep | Sell-intent chance |
|-----------|--------|---------------|-----------------|---------------------|------------------|---------|--------------------|
| Kid | $5–25 ($15–60 with parent) | 0.1–0.3 | 1.3 | 8–15 | Pushover 70 · Fair 30 | 0 | 3% |
| Casual Collector | $10–70 | 0.3–0.6 | 1.1 | 10–20 | Push 30 · Fair 60 · Tough 10 | 0 | 10% |
| Competitive Player | $20–200 | 0.7–0.95 | 1.0 | 12–25 | Fair 50 · Tough 50 | 1.5★ | 12% |
| Investor | $150–3,000 | 0.8–1.0 | 0.9 | 15–30 | Tough 80 · Chaotic 20 | 2.5★ | 15% |
| Manga Fan | $10–120 | 0.5–0.8 | 1.0 | 10–25 | Push 30 · Fair 70 | Manga unlocked | 8% |
| Hardcore Collector | $100–8,000 | 0.85–1.0 | 0.8 | 20–40 | Fair 40 · Tough 60 | 3★ | 8% |
| Card Hunter | wanted card × 1.1–1.4 | 0.7–1.0 | 0.85 | 8–15 | Fair 70 · Tough 30 | 1★ | 0% |
| Attic Finder | (seller) | 0.0–0.3 | — | 15–30 | Push 60 · Fair 40 | 0 | 100% |
| Shady Dealer | (seller) | — | — | 5–10 | Chaotic 100 | 0 (weight × (1.5 − rep/100)) | 100% |
| Influencer | $50–500 | 0.6–0.9 | 0.9 | 10–20 | Fair 100 | 4★ | 0% |
| Tourist | $20–100 | 0.1–0.4 | 0.7 | 8–15 | Push 80 · Fair 20 | Tier 2+ | 0% |

**Base mix weights (when eligible):** Kid 22 · Casual 28 · Competitive 14 · Manga Fan 12 · Investor 6 · Collector 5 · Hunter 6 · Attic Finder 3 · Shady 2 · Influencer 1 · Tourist 5. Weights are then modified by season, weekday, events and marketing targeting.

**Preferences** (weights over product categories): see `src/content/customers/archetypes.ts`. Example: Kid = packs 50, blisters 20, bargain bin 20, cheap holos 10.
**Basket size** ~ Poisson with mean: Kid 1.3 · Casual 2.0 · Competitive 2.5 · Investor 1.5 · Collector 1.5 · Tourist 2.0.

### 5.3 Willingness to pay (fixed-price items)

```
Perceived value   V̂ = V × (1 + (1 − k) × ε),   ε ~ N(0, 0.35) clipped to [−0.6, 0.6]
   (in-print sealed products: V = MSRP. Customers anchor to the sticker price)
Tolerance         τ = τ_base + 0.10 × rep/100 + 0.05 × a
Max price         p_max = V̂ × (1 + τ) × desire,   desire ~ U(0.8, 1.3) per customer–item match
P(buy | p)        = 0.95                              if p ≤ p_max
                  = 0.95 × exp(−6 × s × (p/p_max − 1)) otherwise
```
`τ_base`: Kid 0.10 · Casual 0.10 · Competitive 0.05 · Investor 0.02 · Collector 0.15 · Hunter 0.25 · Influencer 0.10 · Tourist 0.30. Budget caps the basket.

**Reaction bubbles** use the **true** ratio `r = p / V`: ≤ 0.80 "What a steal!" · 0.80–1.10 "Fair price." · 1.10–1.30 "Hmm, pricey…" · > 1.30 "Rip-off!".

### 5.4 Satisfaction (at exit, clamped −3…+3)
`+1.0` steal / `+0.5` fair / `−0.5` pricey / `−1.5` rip-off (averaged over items) · `+1` found what they wanted / `−1` wanted item out of stock · `−0.1` per game-minute waited beyond 50% of patience (cap −2) · `±0.5` haggle success or fail · `+1` delight (e.g., a kid pulls a holo from a pack opened at the counter) · `+0.3` cashier charisma bonus.

---

## 6. Haggling (`balance/haggle.ts`)

### 6.1 Customer buys from you (singles, slabs, lots, sealed ≥ $100)
| Style | Opening offer (× reservation `R`) | Patience (rounds) | Concession per round |
|-------|-----------------------------------|-------------------|----------------------|
| Pushover | 0.85–0.95 | 4–5 | 0.50 |
| Fair | 0.78–0.90 | 3–4 | 0.35 |
| Tough | 0.65–0.80 | 2–4 | 0.20 |
| Chaotic | 0.50–0.95 | 1–5 | U(0, 0.6) |

- `R = p_max` from §5.3.
- Your ask `a ≤ R` → accept. Tough customers test you once with a midpoint counter 50% of the time. If you hold, they accept.
- `a > R` → counter `c_t = min(R, c_{t−1} + (a − c_{t−1}) × concession)`, patience −1. Asks above `1.3R` cost **−2 patience and −1 mood** ("insulted").
- **Final offer:** accept if `a ≤ R`. If `R < a ≤ 1.05R`, 40% accept. Otherwise 70% walk.
- **Fair Deal Streak:** a deal closed at `0.9–1.1 × V` gives streak +1. Each streak level gives +1% XP and reputation from deals (cap +10%). A deal outside the band breaks the streak.

### 6.2 Customer sells to you
- Their minimum `S = V̂_c × accept`, where `V̂_c` is their *perceived* lot value (knowledge-weighted, ignoring hidden cards they don't know about). `accept`: Pushover 0.35–0.55 · Fair 0.55–0.70 · Tough 0.70–0.85 · Chaotic 0.30–0.90. The "needs cash" event modifier is −0.15.
- Opening ask `A₀ = V̂_c × U(0.9, 1.2)`. They concede toward `S` using the same concession table.
- Offers below `0.5 S` are an "insult" (−2 patience, −1 mood).

### 6.3 Fairness & reputation effects (per completed buy)
Fairness `f = offer / V_true` (true value includes hidden cards the seller *did* know about; gems they didn't know about are excluded).

| `f` | Immediate | Hidden consequence |
|-----|-----------|--------------------|
| < 0.35 | Trust −2 if seller `k ≥ 0.5` | Otherwise a bad-review risk within 14 days: `0.15 + 0.5 × (0.35 − f)/0.35` |
| 0.35–0.55 | — | Small review risk (5%) |
| 0.55–0.90 | Trust +0.2, streak +1 | — |
| 0.90–1.00 | Trust +0.4, streak +1 | — |
| > 1.00 | Reputation +0.5, friendship +1 (regulars) | — |

---

## 7. Card Values (`balance/cards.ts`)

### 7.1 Base value bands (modern set, NM, at release)

| Rarity | Min | Typical | Max |
|--------|-----|---------|-----|
| Common | $0.05 | $0.10 | $0.25 |
| Uncommon | $0.10 | $0.20 | $0.50 |
| Rare | $0.30 | $0.60 | $1.50 |
| Holo Rare | $1.00 | $2.50 | $6.00 |
| Ultra Rare | $4 | $9 | $25 |
| Illustration Rare | $8 | $15 | $60 |
| Secret Rare | $20 | $40 | $120 |
| Mythic Rare | $150 | $220 | $600 |
| Promo | $1 | $4 | $40 |

Each card's `baseValue` = typical × **species popularity** (0.5–3.0) × **playability bump** (competitive staples +0–150% at Rare and above) × **art appeal** (0.8–1.5, IR/SR/MR only). The value is clamped to the band. The content generator computes it and stores it in the card definition, so it can be hand-edited.

### 7.2 Multipliers
| Factor | Multipliers |
|--------|-------------|
| **Condition** | Mint ×1.20 · Near Mint ×1.00 · Good ×0.75 · Played ×0.50 · Damaged ×0.25 |
| **Reverse Holo** | Common ×3 · Uncommon ×2.5 · Rare ×2 (floor $0.25) |
| **1st Edition** | Modern singles ×1.6 · Vintage C/U ×3 · Vintage Rare ×4 · Vintage Holo+ ×6 |
| **Stamps** | Prerelease ×1.5 · League ×1.3 · Staff ×4 · Anniversary ×1.2 |
| **Misprints** | Crimped ×2 · Miscut ×3 · Ink Error ×4 · Missing Foil ×5 · Wrong Back ×25 |
| **Fake** | ×0 (worthless; illegal to sell) |

---

## 8. Conditions & Grading (`balance/grading.ts`)

### 8.1 Hidden sub-scores (Centering, Corners, Edges, Surface; 1–10 in 0.5 steps)

| Source | Centering | Corners / Edges / Surface | Extras |
|--------|-----------|---------------------------|--------|
| Fresh modern pull | `round½(N(9.0, 0.7))`, clamp 5–10 | `round½(10 − Gamma(1.2, 0.45))`, clamp 6–10 | 5% factory defect: one sub −U(1.5, 3.5) |
| JP-style import pull | `N(9.3, 0.5)` | Gamma(1.1, 0.35) | 2% defect |
| Customer modern binder | `N(8.6, 0.9)` | Gamma(1.6, 0.7) | 15% "played" event −U(1, 3) |
| Vintage lot | `N(7.2, 1.3)` | `N(7.0, 1.4)` each, correlated ρ = 0.5 | recipe modifiers (e.g., "well-kept binder" +1) |
| Kid's shoebox | `N(8.0, 1.0)` | `N(6.0, 1.5)` | — |

**Visible condition from the lowest sub-score:** ≥ 9.5 Mint · ≥ 8.0 Near Mint · ≥ 6.0 Good · ≥ 3.5 Played · else Damaged.
**Target distribution for fresh modern pulls** (asserted by a statistical unit test): Mint 15–20% · NM 65–75% · Good 8–14% · Played ≤ 2%.

### 8.2 True grade
`G_true = min( average(4 subs), lowestSub + 1.0 )`

### 8.3 Company grading
`g = G_true + bias + N(0, σ)`, then the company's rounding and rules apply.

| Company | Bias | σ | Scale | Rules for a 10 |
|---------|------|---|-------|----------------|
| Cardboard Certs (CC) | +0.25 | 0.70 | integers | none |
| Summit Grading Authority (SGA) | 0.00 | 0.45 | integers | all subs ≥ 9 |
| Apex Grading Co. (AGC) | −0.20 | 0.30 | integers | centering ≥ 9.5 and all other subs ≥ 9.5 |
| Blackline Grading (BLG) | −0.25 | 0.25 | half-steps + 4 printed sub-grades (each `sub + N(0, 0.3) − 0.2`) | "Pristine 10": overall 10 with all printed subs ≥ 9.5 · **Black Label**: all four printed subs = 10 |

**Target outcomes for a fresh NM/Mint modern pull** (unit-tested): AGC 10 ≈ 10–14%, 9 ≈ 40–50%, 8 ≈ 25–35% · CC 10 ≈ 20–30% · BLG Pristine ≈ 2–4%, Black Label ≈ 0.2–0.5%.

### 8.4 Fees, turnaround & limits
| Company | Economy | Standard | Express | Max declared value (E / S / X) | Bulk discount |
|---------|---------|----------|---------|---------------------------------|---------------|
| CC | $8 · 6 d | $15 · 3 d | $30 · 1 d | $300 / $1k / $5k | −10% at 20+ |
| SGA | $18 · 10 d | $35 · 5 d | $75 · 2 d | $500 / $2.5k / $10k | −10% at 20+ |
| AGC | $30 · 14 d | $65 · 7 d | $150 · 3 d | $1k / $5k / $25k | −15% at 50+ |
| BLG | $45 · 14 d | $90 · 7 d | $250 · 3 d | $2.5k / $10k / ∞ | −15% at 50+ |
Plus $12 insured shipping per submission. **Collectors Con walk-through:** same-day grading at 2 × Express price.

### 8.5 Graded value
`value = rawNM × M(company, grade) × D × P`

| Grade | CC | SGA | AGC | BLG |
|-------|----|-----|-----|-----|
| 10 Black Label | — | — | — | 14.0 |
| 10 (Pristine for BLG) | 1.7 | 2.6 | 4.5 | 6.0 |
| 9.5 | — | — | — | 3.0 |
| 9 | 1.15 | 1.35 | 1.7 | 1.6 |
| 8.5 | — | — | — | 1.25 |
| 8 | 0.95 | 1.05 | 1.15 | 1.10 |
| 7 | 0.75 | 0.85 | 0.95 | 0.90 |
| 6 | 0.60 | 0.70 | 0.80 | 0.75 |
| ≤ 5 | 0.45 | 0.50 | 0.60 | 0.55 |

- **Desirability `D`** = clamp(1 + 0.5 × (popularity − 1), 0.8, 2.0). For grades ≥ 9 on vintage cards, add ×(1 + 0.25 × min(ageYears, 20)/10), up to ×1.5.
- **Population scarcity `P`:** grade 10: `1 + 0.6 × e^(−pop10/20)` · grade 9: `1 + 0.2 × e^(−pop9/50)` · else 1.
- **Population report:** initialized per card and company from print run × grading rate × grade distribution (log-normal noise), then grows about 0.1%/day plus your submissions.

*Worked examples:* Modern Holo Rare ($3) in AGC 10 ≈ $17: **not worth** a $30–65 fee. Modern Mythic ($220) in AGC 10 ≈ $2,000: **worth it**. 1st Edition *Origins* Infernox Holo ($1,800 raw) in AGC 10 ≈ $35–40k: **grail**.

### 8.6 Crack & resubmit
The slab fee is lost. There is a 3% chance (Standard) of surface −0.5 while cracking. The hidden sub-scores are unchanged, so you're betting on company noise.

---

## 9. Progression (`balance/progression.ts`)

### 9.1 XP sources
| Action | XP |
|--------|----|
| Sales revenue | `revenue$ × 0.5 × f(L)`, with `f(L) = 1 / (1 + 0.08 L)` (diminishes with level) |
| Customer served with satisfaction ≥ 1 | +1 |
| Haggle won (sale or buy) | +5 (× streak bonus) |
| Buy offer closed | +5 + 1 per $20 of lot value (cap +100) |
| Pack opened / NEW card | +2 / +1 |
| Pull: Holo / Ultra / Illustration / Secret / Mythic | +3 / +10 / +15 / +30 / +100 |
| Grading return | +5 per card · +25 per 10 · +100 per Black Label |
| Special order fulfilled | +25 |
| Hosted event | +50 + 2 per participant |
| Daily Objective | +20–50 |
| Set completion (normal / master) | +500 / +1,500 |
| Achievements · story lessons | +25–500 · +50–200 |

### 9.2 Level curve
`XP to next level = round(80 × L^1.55)`. The level cap is 50.

| L | 1 | 2 | 3 | 5 | 7 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 49 |
|---|---|---|---|---|---|----|----|----|----|----|----|----|----|----|
| XP → L+1 | 80 | 234 | 439 | 970 | 1,632 | 2,838 | 5,319 | 8,312 | 11,745 | 15,582 | 19,784 | 24,344 | 29,216 | 33,344 |

Cumulative to reach Lv 10 ≈ 9.7k XP.

**Pacing targets** (1×, "balanced" bot, Standard): Lv 2 on day 1 · Lv 5 by day 4 · Lv 10 by day 12 · Lv 15 by day 25 · Lv 20 by day 40 · Lv 30 by day 90 · Lv 40 by day 170 · Lv 50 by day 300.

### 9.3 Unlock table

| Lv | Unlocks |
|----|---------|
| 1 | Budget Box Co. (packs, blisters, starter decks, tins, collection boxes) · Small Wall Shelf · pricing · checkout · pack opening · basic Binder |
| 2 | Singles in the display case · Small Display Case (buy more) · customer buy offers (tutorial) |
| 3 | Gondola Shelf · Decor catalog I · FoilTrack market app |
| 4 | **Harbor Hobby Distribution** (needs 2★): booster boxes, ECBs, bundles · Box Wall Rack · Bargain Bin |
| 5 | **Manga** (Kaze Manga Direct) · Manga Bookshelf · Manga Fans visit |
| 6 | **Grading** (Grading Desk, Cardboard Certs) · Card Lab: Loupe · Back Room storage |
| 7 | **Hiring: Cashier** · extra Register lane · **Shop Tier 2** · Card Reader Terminal |
| 8 | **FoilMarket** · Special Orders · Liquidator & Estate Sale events · Sorting Station · Tall Wall Shelf |
| 9 | **Accessories** · Accessory Pegboard · POS System (pricing rules) |
| 10 | **Starforge Official Distribution** (needs 3★): pre-orders, 1st Edition allocations · Play Tables · League Night · Large Lit Display Case |
| 11 | Marketing (flyers, social ads) · Decor catalog II |
| 12 | Summit Grading · **Hiring: Stocker** · Pack Vending Machine · Card Lab: Light Box · Loyalty Cards |
| 13 | Tournaments · host Prerelease Events |
| 14 | **Hiring: TCG Expert** · Mystery Box Builder |
| 15 | **Shop Tier 3** · Stockroom · more frequent vintage-hunting events |
| 16 | **Hiring: Event Host** · POS Pro (reorder points, forecasts) |
| 17 | Apex Grading · Card Lab: Centering Tool |
| 18 | Sakura Imports (JP-style sets) · Showcase Tower · Self-Checkout Kiosk |
| 20 | Brightbay Collectors Con (card shows) · **Hiring: Grading Specialist** |
| 22 | *Arcane Dominion* distributor (2nd TCG brand) |
| 25 | **Shop Tier 4** · Streaming Studio · **Hiring: Streamer** |
| 28 | Gavel & Glimmer Auctions · Warehouse Unit |
| 30 | Blackline Grading (Black Label) · Climate Vault |
| 32 | *Crimson Moon Card Game* distributor (3rd brand, **Q8**) |
| 35 | **Shop Tier 5** · **Hiring: Store Manager** · Branch #1 |
| 40 | Branch #2 · host the Regional Championship |
| 45 | Branch #3 |
| 50 | "Collectibles Legend" title · Golden Register (cosmetic) |
| *other levels* | **Perk levels**: a decor set, fixture variants, efficiency perks (+5% storage, −2% supplier prices, +1 daily-objective reroll), avatar cosmetics. No level is empty |

**Reputation gates** (stars = `round½(rep / 20)`, so 1★ = 15–24 … 5★ = 95+): Harbor Hobby 2★ · Starforge 3★ · Competitive customers 1.5★ · Hunters 1★ · Investors 2.5★ · Collectors 3★ · Influencers 4★.

---

## 10. Suppliers & Price List (`balance/suppliers.ts`)

### 10.1 Glimmerkin modern set products (e.g., *Emberdawn*)
| Product | Contents | SU | MSRP | Budget Box Co. | Harbor Hobby | Starforge |
|---------|----------|----|------|----------------|--------------|-----------|
| Booster Pack | 10 cards | 1 | $4.49 | $3.25 (min 12) | $2.95 (min 36) | $2.70 (min 36) |
| 3-Pack Blister | 3 packs + promo | 2 | $14.99 | $10.50 (min 4) | $9.50 (min 12) | $8.90 |
| Booster Bundle | 6 packs | 3 | $26.99 | — | $17.50 (min 6) | $16.20 |
| **Booster Box ("Display")** | 36 packs | 18 | $161.64 | — | $104 (min 1) | $96 (min 1) |
| Elite Collector Box | 9 packs, 65 sleeves, dice, promo | 6 | $49.99 | — | $33 (min 3) | $30 |
| Collection Box | 4 packs, promo, oversized card | 5 | $24.99 | $17.50 | $16 | $15 |
| Collector Tin | 3 packs, promo | 3 | $21.99 | $15.50 | $14 | $13 |
| Starter Deck | 60 cards, 1 guaranteed holo | 2 | $14.99 | $10.00 | $9.00 | $8.40 |
| Prerelease Kit | 4 packs, 20-card evolution pack, prerelease promo | 3 | $24.99 | — | — | $15.50 (release window only) |

**Accessories** (Harbor Hobby, Lv 9): Sleeves (65) $9.99 / $4.50 · Deck Box $6.99 / $3.00 · 9-Pocket Binder $24.99 / $11.00 · Playmat $24.99 / $10.00 · Toploaders (25) $4.99 / $1.80 · Storage Box (800) $7.99 / $3.20 · Dice Set $5.99 / $2.20.
**Manga** (Kaze Manga Direct, Lv 5): Volume $10.99 / $6.60 (min 5 per volume) · Deluxe Hardcover $24.99 / $15.00 (min 3) · Box Set: MSRP N × $8.50, cost N × $5.40.
**Import** (Sakura Imports, Lv 18): JP-style pack (5 cards) $3.99 / $2.40 · JP box (30 packs) $119.70 / $72.00 · +8% customs.

### 10.2 Supplier rules
- **Delivery:** Budget next morning · Harbor 2 days · Kaze 3 days · Starforge on release date (otherwise 2 days) · FoilMarket 2 days (+$4 singles, +$12 sealed) · Sakura 5 days.
- **Volume discounts (Harbor):** −3% at ≥ $500 · −6% at ≥ $1,500 · −10% at ≥ $5,000.
- **Allocation (Starforge 1st Edition boxes per release):** by tier 1 / 3 / 6 / 12 / 24 boxes × `(0.5 + rep/100)`, +25% if last season's Glimmerkin sales were in your top quartile.
- **Limited stock:** hyped products have supplier stock caps per day. They sell out and restock slowly. In the "last call" phase, stock caps shrink to 0 over 14 days.
- **Insurance** costs 2% of order value and covers damaged units at full cost.
- **Damaged shipment:** chance per order by difficulty (§2). It affects 10–40% of units, which become "Damaged box" SKUs (sell at −40% or open normally).

---

## 11. Packs & Pull Rates (`balance/packs.ts`)

### 11.1 Glimmerkin Modern Booster (10 cards)
| Slot | # | Table |
|------|---|-------|
| Common | 5 | Commons (normal finish) |
| Uncommon | 3 | Uncommons (normal) |
| Reverse | 1 | Reverse Holo of: Common 60% · Uncommon 30% · Rare 10% |
| Rare | 1 | Rare 62.5% · Holo Rare 25% · Ultra Rare 8% · Illustration Rare 3% · Secret Rare 1.2% · **Mythic Rare 0.3%** |

**Per 36-pack box (expected):** Holo 9.0 · Ultra 2.9 · Illustration 1.1 · Secret 0.43 · Mythic 0.108 (≈ 1 per 9 boxes).
**Box mapping (on by default):** each box guarantees ≥ 6 Holo Rares and ≥ 2 Ultra Rares or better. The last packs are adjusted if needed. Mythic is **never** guaranteed.
**God Pack:** 1 in 2,000 packs. All 10 cards come from IR 75% · SR 20% · MR 5%.
**Misprints:** 1 in 5,000 cards. Type mix: Miscut 45% · Ink Error 25% · Missing Foil 15% (foil cards only) · Crimped 14% · Wrong Back 1%.
**Onboarding luck (hidden):** the tutorial's first pack has a guaranteed Holo Rare (Sparkit). The player's first opened box has ≥ 1 Illustration Rare or better.

### 11.2 Other pack types
- **JP-style pack (5 cards):** 3 C/U · 1 Reverse-or-better · 1 Rare slot (Rare 55% · Holo 25% · UR 12% · IR 5% · SR 2.5% · MR 0.5%). God Pack 1 in 500.
- **Vintage Origins pack (11 cards):** 7 C · 3 U · 1 Rare slot (Rare 66.7% · Holo Rare 33.3%). The 1st Edition flag is on all cards in 1st Edition packs.
- **Starter deck:** fixed list + 1 guaranteed holo from a pool of 3.
- **Evolution pack (prerelease):** fixed 20-card list.

### 11.3 EV targets (unit-tested per set)
- **Market EV** of a modern pack at release: **0.85–1.10 × MSRP**.
- **Realizable EV** (bulk valued at a $0.02 buylist, others at 85% of market): **0.62–0.80 × MSRP**, which is just above Harbor wholesale ($2.95 = 0.66 × MSRP).
- **Result:** selling sealed at MSRP gives a safe ~30–40% margin. Opening is a gamble with a slight edge at wholesale cost, plus XP and collection value. Hype events can push EV above MSRP, and then everyone rips, which drains sealed stock.

---

## 12. Market Model (`balance/market.ts`)

### 12.1 Singles (daily)
```
ln P(t+1) = ln P(t) + κ × (ln F(t) − ln P(t)) + σ_rarity × ε + J(t)
F(t)      = baseValue × Pop_species(t) × Hype_set(t) × Meta_card(t) × Scarcity(t) × variantMult
```
| Parameter | Value |
|-----------|-------|
| κ (mean reversion) | 0.12 |
| σ by rarity | C 0.010 · U 0.012 · R 0.020 · HR 0.030 · UR 0.035 · IR 0.035 · SR 0.040 · MR 0.045 · graded ×0.8 |
| Price floors | C $0.05 · U $0.08 · R $0.15 · HR $0.50 |
| `Pop_species` | log random walk (σ 0.01/day), mean-reverting to species base (κ 0.02), clamp 0.5–3.0 |
| `Hype_set` | 1.25 on release day, decays to 1.0 with a half-life of 10 days. Events add ±0.1…0.5 (half-life 3–7 days) |
| `Meta_card` | for playability > 0.3: Saturday tournament results give winners +20–80% (half-life 7 days) and losers −5–10%. **Ban:** −60% |
| `Scarcity` | in print 1.0 · after OOP +0.05%/day up to ×1.5 · vintage: content-defined · reprint event ×0.70–0.85 on reprinted cards |
| Player impact | selling > 3 copies of one card to FoilMarket in a day: −1% per extra copy (half-life 3 days) |

### 12.2 Sealed products (daily)
```
F_sealed(t) = MSRP × SealedCurve(age, printStatus) × Hype_set(t) × EVfactor
```
- **In print:** SealedCurve 0.90–1.00 (market saturated). 1st Edition sealed: 1.15 at release.
- **Last call:** 1.00 → 1.10.
- **Out of print:** compounding growth `g ∈ [0.2%, 0.6%]` per day by set popularity (doubling in ≈ 115–350 days), with volatility σ 0.015. **Reprint wave:** 5% chance per season (−15% shock, growth paused for 28 days).
- **EVfactor:** if `EV/MSRP > 1.1`, multiply by `1 + 0.5 × (EV/MSRP − 1.1)`.

### 12.3 Indices & news
- **Set Index** = value-weighted average of the top 20 singles plus the set's sealed products. There is also **GK Vintage Index** and **Mythic Index**.
- A move > ±8% in a day, or any event shock, generates a *Glimmer Gazette* headline with the cause.

---

## 13. Reputation (`balance/reputation.ts`)

- **Model:** `rep = 0.25·Prices + 0.20·Service + 0.20·Selection + 0.25·Trust + 0.10·Community` (each sub-score 0–100).
- **Start:** all sub-scores 20, except Community 10.
- **Update:** each visit emits signals in −1…+1 (price fairness, wait vs patience, found-wanted, trust events). Daily: `sub += η × Σ(signal × influence) × diminishing(sub)`, with `η ≈ 0.10` and `diminishing = (1 − sub/110)` for positive totals. Influence: normal 1 · regular 2 · influencer 5.
- **Community** is raised by hosted events, League Night attendance, kids' delight and charity events.
- **Drift:** each sub-score decays 1% per day toward 20, so reputation needs upkeep.
- **Stars:** `round½(rep / 20)`.

---

## 14. Staff (`balance/staff.ts`)

| Role | Salary/day | Skill effects (skill 1–5) |
|------|------------|---------------------------|
| Cashier | $60–110 | Checkout time 1.0 → 0.4 game-min · +0.1 satisfaction per ★ above 2 · 3% upsell per ★ |
| Stocker | $55–100 | Restock 20 + 15 × skill units per game-hour · receives deliveries |
| TCG Expert | $100–180 | Appraisal range × (1 − 0.15 × skill) · fake detection 40% + 12% × skill · runs auto-buy policies |
| Event Host | $80–140 | Attendance +10% per ★ · +1 Community per event per ★ |
| Grading Specialist | $120–220 | Estimate σ = 1.0 − 0.18 × skill · bulk fee −2% per ★ |
| Streamer | $100–200 + 5% of break revenue | Viewers and hype × (0.6 + 0.2 × skill) |
| Store Manager | $200–350 | Branch efficiency 70% + 6% per ★ · auto-ordering |

- **Morale** (0–100) → performance × (0.7 + 0.004 × morale). The employee warns below 30 and quits after 3 days below 15.
- **Employee XP:** +10/day plus task XP. Level-up every `200 × level` XP gives +1 skill point.
- **Traits:** *Speedy* (+20% speed) · *Chatty* (+10% satisfaction, −10% speed) · *Eagle Eye* (+15% fake detection) · *Kid Whisperer* (+Kid satisfaction) · *Night Owl* (+10% after 17:00) · *Meticulous* (−errors) · *Clumsy* (0.5% chance per day to damage one displayed single's surface) · *Hype Machine* (+event attendance) · *Bargain Hunter* (+5% better buy offers).

---

## 15. Manga Economics (`balance/manga.ts`)

- **Series popularity** `P ∈ [0.3, 3.0]`, a random walk plus events. Daily demand per volume ∝ `P × fanbase × recency` (volume 1 and the latest volume sell the most).
- **Releases:** mega-hits every 28 days (Tuesdays), others every 42–56 days. Completed series have no new volumes.
- **Out-of-print volumes:** early volumes of popular series cycle through "limited" supplier stock. Market price is `MSRP × (1 + 0.3P)`, up to ×2.5.
- **Complete runs** sell at `Σ volumes × (1.1 + 0.05P)`. Completed series get +10%.
- **Anime announcement:** `P × 1.8` for 14 days, then it settles at ×1.3.
- **Used manga** (bought from customers): Used condition sells at 60% of MSRP. Customers sell complete runs at 30–50% of MSRP.

---

## 16. Events (`balance/events.ts`)

- **Daily roll at opening:** P(at least 1 event) = 0.55 (Standard). P(second event) = 0.15.
- Events are weighted by eligibility conditions (season, level, rep, unlocked systems) and have per-event cooldowns (typically 7–28 days). The target positive/negative ratio is **70/30**.
- Scripted story events override random rolls.

---

## 17. Mystery Boxes (`balance/mysteryBox.ts`)

- Customer satisfaction from a mystery box depends on `valueRatio = Σ contents market value / price`: `< 0.6` bad (Trust −) · `0.6–0.9` meh · `0.9–1.2` good · `> 1.2` great (buzz +).
- Demand is highest among Kids, Casuals, Influencers and Tourists. Price tolerance is anchored to box size (S $10–20 · M $25–50 · L $75–150).

---

## 18. Balance Simulator & KPIs

**Tool:** `npm run balance:sim -- --days 120 --seeds 50 --bot balanced` runs the pure `sim/` headless (no rendering) with scripted bot players:
- **Cautious Seller:** never opens product and prices at MSRP.
- **Pack Ripper:** opens most stock and sells singles.
- **Speculator:** hoards sealed and OOP product.
- **Balanced:** a sensible mix, which is the pacing reference.

It outputs a Markdown or CSV report: level by day, cash and debt curves, reputation curve, unlock days, bankruptcies (Tycoon), revenue mix, EV checks and grading distributions, and flags KPI violations.

**KPI targets (Standard, Balanced bot):**
| KPI | Target |
|-----|--------|
| Day-1 revenue / profit | $100–180 / $30–70 |
| Cash at end of week 1 (after rent) | $1,200–2,000 |
| First booster box affordable | day 4–6 |
| First grading submission | ≈ day 10 |
| Tier 2 affordable ($6,000) | day 10–14 |
| Sealed margin at MSRP | 30–40% |
| Bankruptcies (Standard) | 0 |
| Stuck states (no way to earn) | 0. The bargain bin and bulk always sell, and loans exist |
| Level pacing | within ±20% of §9.2 targets |

CI runs a short smoke version (10 days × 5 seeds) to catch economy-breaking changes.
