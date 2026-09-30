# 07 · Data Model

> TypeScript **shapes** for content definitions and the save-able `GameState`. This is a spec: the implementation lives in `src/content/schema/*` (Zod schemas, with types inferred from them) and `src/sim/state/*`. Names here are canonical. If the code diverges, update this doc in the same commit.

**Conventions:** money is `Cents` (integer). Days are absolute `Day` numbers: Day 1 = Spring 8, Year 1, a **Monday**. Days ≤ 0 are before the game starts, and `weekday = (day − 1) mod 7` (0 = Monday). All state is plain JSON-compatible: no `Map`, `Set`, `Date`, classes or `undefined`-dependent semantics. `Record` keys are string IDs.

---

## 1. Primitives

```ts
type Cents = number;                 // integer
type Day = number;                   // absolute game day
type GameMinute = number;            // 0..1439 (open hours 540..1140)
type Brand<T, B extends string> = T & { readonly __brand: B };
type CardId = Brand<string, 'CardId'>;       // 'gk.emberdawn.045'
type SetId = Brand<string, 'SetId'>;         // 'gk.emberdawn'
type ProductId = Brand<string, 'ProductId'>; // 'gk.emberdawn.box'
type SpeciesId = Brand<string, 'SpeciesId'>; // 'gk.species.sparkit'
type InstanceId = Brand<string, 'InstanceId'>;
// …similar branded ids: FixtureId, UpgradeId, EventId, AchievementId, SupplierId, GradingCompanyId,
//   ArchetypeId, NpcId, SeriesId, VolumeId, RoleId, TraitId, UnlockId

type ElementId = 'ember' | 'tide' | 'bloom' | 'volt' | 'terra' | 'mystic' | 'shade' | 'frost' | 'neutral';
type Rarity = 'common' | 'uncommon' | 'rare' | 'holoRare' | 'ultraRare'
            | 'illustrationRare' | 'secretRare' | 'mythicRare' | 'promo';
type Finish = 'normal' | 'reverseHolo' | 'holo' | 'fullArtTextured' | 'gold'
            | 'rainbow' | 'cosmos' | 'etched' | 'crystal';
type Stamp = 'firstEdition' | 'prerelease' | 'league' | 'staff' | 'anniversary';
type Misprint = 'miscut' | 'inkError' | 'missingFoil' | 'crimped' | 'wrongBack';
type Condition = 'mint' | 'nearMint' | 'good' | 'played' | 'damaged';
type SubScores = { centering: number; corners: number; edges: number; surface: number }; // 1–10, step 0.5
type Difficulty = 'cozy' | 'standard' | 'tycoon';
type Requirement = { level?: number; repStars?: number; tier?: number; upgrade?: UpgradeId; flag?: string };
type Weighted<T> = { value: T; weight: number };
```

---

## 2. Content Definitions (read-only data)

### 2.1 TCG
```ts
interface BrandDef {
  id: string;                       // 'gk'
  name: string;                     // 'Glimmerkin'
  publisher: string;                // 'Starforge Games'
  elements: ElementId[];
  unlock: Requirement;              // flagship: {} (start)
  cardBackArt: ArtRef; logoArt: ArtRef;
}

interface SpeciesDef {
  id: SpeciesId; brandId: string; dex: number; name: string; element: ElementId;
  stage: 'basic' | 'stage1' | 'stage2' | 'legend';
  evolvesFrom?: SpeciesId;
  popularity: number;               // 0.5–3.0 base
  genome: CreatureGenome;           // see §2.6
  lore: string;
}

interface SetDef {
  id: SetId; brandId: string; code: string;   // 'EMD'
  name: string;
  era: 'vintage' | 'classic' | 'modern' | 'special' | 'future' | 'generated';
  releaseDay: Day; announceDaysBefore: number;
  print: {
    firstEdition: 'none' | 'vintage' | 'wave';  // vintage = separate 1st Ed print; wave = limited release-week wave
    firstEditionWaveDays?: number;              // e.g., 7
    lastCallAfterDays: number;                  // supplier caps begin shrinking
    oopAfterDays: number;                       // ≈ 2 seasons
    printRunScale: number;                      // relative print size (affects pop reports, scarcity)
  };
  totalMain: number;                // for "045/100" numbering; secret rares exceed it
  packConfigId: string;
  productIds: ProductId[];
  packArtVariants: ArtRef[];
  theme: { palette: string[]; symbol: ArtRef; logo: ArtRef; biomes: string[]; storyBeats?: string[] };
  hype: { launch: number; halfLifeDays: number };
  cards: CardDef[] | RosterSpec;    // explicit list, or compact roster expanded by helpers
}

interface CardDef {
  id: CardId; setId: SetId; number: number; name: string;
  kind: 'creature' | 'tactic' | 'essence';
  rarity: Rarity;
  finishes: Finish[];               // printable finishes (e.g., common: ['normal','reverseHolo'])
  speciesId?: SpeciesId; element?: ElementId;
  stage?: 'basic' | 'stage1' | 'stage2' | 'nova' | 'legend';
  hp?: number;
  ability?: { name: string; text: string };
  attacks?: { name: string; cost: ElementId[]; damage?: string; text?: string }[];
  weakness?: ElementId; resistance?: ElementId; retreat?: number;
  tacticType?: 'item' | 'ally' | 'arena'; rulesText?: string;
  flavor?: string; illustrator: string;
  art: CardArtSpec;
  baseValueCents: Cents;            // NM market value at release (see 02 §7)
  playability: number;              // 0–1 competitive relevance
}

interface CardArtSpec {
  composition: 'window' | 'fullArt' | 'illustration' | 'hero';
  subject: { speciesId?: SpeciesId; npcId?: string; prop?: string };
  pose?: string; expression?: string; biome?: string; timeOfDay?: string;
  seed: number;                     // deterministic variation
  override?: string;                // path to user-supplied art (optional)
}

interface PackConfigDef {
  id: string; cardsPerPack: number;
  slots: { count: number; table: { rarity: Rarity; finish?: Finish; weight: number }[] }[];
  godPack?: { chance: number; table: { rarity: Rarity; weight: number }[] };
  misprintChancePerCard: number;
  misprintTable: Weighted<Misprint>[];
  boxMapping?: { minHolo: number; minUltraPlus: number } | null;
}

type ProductKind = 'booster' | 'blister' | 'bundle' | 'box' | 'eliteBox' | 'collection' | 'tin'
  | 'starterDeck' | 'prereleaseKit' | 'posterCollection' | 'promoKit' | 'mysteryBox' | 'accessory'
  | 'mangaVolume' | 'mangaDeluxe' | 'mangaBoxSet' | 'importBooster' | 'importBox';
// promoKit = event supply (League Promo Kit): consumed by hosted events, never sold to customers.
// mysteryBox = third-party boxes (recipe-based contents) and player-built boxes (explicit contents).

interface ProductDef {
  id: ProductId; kind: ProductKind; name: string;
  brandId?: string; setId?: SetId; seriesId?: string;
  msrpCents: Cents; storageUnits: number; slotUnits: number;  // shelf slot consumption
  contents: ContentEntry[];
  art: ArtRef; model: ModelRef;     // 2D art + 3D prop mapping
  tags: string[];                   // 'hyped', 'kidFriendly', …
}
type ContentEntry =
  | { type: 'pack'; productId: ProductId; count: number }
  | { type: 'fixedCards'; cards: { cardId: CardId; finish?: Finish; stamps?: Stamp[] }[] }
  | { type: 'promoPool'; cardIds: CardId[]; count: number }
  | { type: 'accessory'; productId: ProductId; count: number }
  | { type: 'guaranteedHoloPool'; cardIds: CardId[] };
```

### 2.2 Shop, suppliers, grading
```ts
interface ShopTierDef { tier: 1|2|3|4|5; name: string; grid: { w: number; d: number; floors: number };
  unlock: Requirement; costCents: Cents; rentPerDayCents: Cents; baseTraffic: number; staffCap: number }

interface FixtureDef { id: FixtureId; name: string;
  category: 'shelf' | 'case' | 'rack' | 'manga' | 'bin' | 'pegboard' | 'vending' | 'register'
          | 'table' | 'service' | 'decor';
  footprint: { w: number; d: number }; wallMounted: boolean;
  slots: { count: number; accepts: ProductKind[] | 'singles' | 'slabs' | 'bulk' };
  appeal: number; costCents: Cents; unlock: Requirement; model: ModelRef }

interface UpgradeDef { id: UpgradeId; name: string; costCents: Cents; unlock: Requirement;
  effects: UpgradeEffect[] }

interface SupplierDef { id: SupplierId; name: string; unlock: Requirement; deliveryDays: number;
  items: { productId: ProductId; costCents: Cents; minQty: number; dailyCap?: number;
           availability: 'always' | 'inPrint' | 'releaseWindow' | 'allocation' }[];
  volumeDiscounts?: { minCents: Cents; pct: number }[];
  allocation?: { perTierBoxes: number[]; repFactor: boolean } }

interface GradingCompanyDef { id: GradingCompanyId; name: string; unlock: Requirement;
  bias: number; sigma: number; scale: 'integer' | 'half';
  tenRule: 'none' | 'allSubsGte9' | 'centering95AllGte95' | 'blackline';
  subgradesOnLabel: boolean;
  services: { tier: 'economy' | 'standard' | 'express'; feeCents: Cents; days: number; maxDeclaredCents: Cents | null }[];
  bulkDiscount: { minCards: number; pct: number };
  multipliers: Record<string, number>;   // '10BL','10','9.5','9',… → multiplier (02 §8.5)
  label: { theme: string } }
```

### 2.3 Customers & staff
```ts
interface ArchetypeDef { id: ArchetypeId; budgetCents: [Cents, Cents]; knowledge: [number, number];
  priceSensitivity: number; patienceMinutes: [number, number];
  haggleStyles: Weighted<'pushover' | 'fair' | 'tough' | 'chaotic'>[];
  minRepStars: number; requires?: Requirement; sellIntentChance: number;
  preferences: Weighted<PreferenceTag>[]; basketMean: number; toleranceBase: number;
  looks: LookRules; dialogueSet: string }

interface RegularDef { id: NpcId; name: string; archetypeId: ArchetypeId; looks: AvatarSpec;
  voice: VoiceProfile; storyline: QuestId[]; dialogue: string }

interface RoleDef { id: RoleId; unlock: Requirement; salaryRangeCents: [Cents, Cents]; skills: SkillId[] }
interface TraitDef { id: TraitId; effects: TraitEffect[]; rarity: number }
```

### 2.4 Events, goals, achievements
```ts
interface EventDef { id: EventId; category: 'supply' | 'market' | 'customer' | 'shop' | 'rival' | 'community' | 'seasonal' | 'story';
  weight: number; conditions: EventCondition[]; cooldownDays: number; urgent: boolean;
  choices: { labelKey: string; hintKey?: string; requires?: Requirement; effects: Effect[] }[] }

type Effect =
  | { type: 'cash'; cents: Cents }
  | { type: 'traffic'; mult: number; days: number; archetype?: ArchetypeId }
  | { type: 'marketShock'; target: MarketTarget; logDelta: number; halfLifeDays: number }
  | { type: 'reputation'; sub: RepSub; delta: number }
  | { type: 'spawnCustomer'; archetype: ArchetypeId; lotRecipe?: string; npcId?: NpcId }
  | { type: 'grantProduct'; productId: ProductId; qty: number; unitCostCents: Cents }
  | { type: 'supplierPrice'; supplierId: SupplierId; pct: number; days: number }
  | { type: 'closeEarly'; minutes: number }
  | { type: 'flag'; key: string; value: boolean | number };

interface AchievementDef { id: AchievementId; category: string; hidden?: boolean; xp: number;
  condition: { stat: StatKey; gte: number } | { custom: string }; reward?: Reward }

interface QuestDef { id: QuestId; giver: NpcId | 'theo'; steps: QuestStep[]; reward: Reward }
```

### 2.5 Manga
```ts
interface MangaSeriesDef { id: SeriesId; title: string; publisher: string; genre: string;
  status: 'ongoing' | 'completed'; volumesAtStart: number; cadenceDays?: number;
  popularity: { base: number;
    profile: 'megaHit' | 'popular' | 'rising' | 'cultClassic' | 'evergreen' | 'seasonal' | 'fading' };
  // cadenceDays must be a multiple of 7 (28, 42, 49 or 56) so releases stay on Tuesdays
  oopEarlyVolumes?: number[]; cover: CoverTemplate }
```

### 2.6 Art genome (see `04 §6`)
```ts
interface CreatureGenome {
  version: number;
  plan: 'quadruped' | 'biped' | 'serpent' | 'bird' | 'blob' | 'insect' | 'fish';
  proportions: { body: number; head: number; limbs: number; tail: number };   // 0–1 sliders
  parts: GenomePart[];            // ears, horns, wings, fins, spikes, tail tips, crests, leaves, flames…
  palette: { primary: string; secondary: string; accent: string; belly?: string; eyes: string };
  pattern?: { kind: 'stripes' | 'spots' | 'gradient' | 'patches'; color: string; scale: number };
  face: { eyes: 'round' | 'sleepy' | 'fierce' | 'sparkle'; mouth: 'smile' | 'fang' | 'beak' | 'none' };
  elementFx?: 'embers' | 'bubbles' | 'sparks' | 'petals' | 'dust' | 'runes' | 'wisps' | 'snow';
  growth?: { from: SpeciesId; scale: number; addParts: GenomePart[]; intensify: number }; // evolutions
}
```

---

## 3. GameState (persisted)

```ts
interface GameState {
  meta: { saveVersion: number; gameVersion: string; seed: number; createdAt: string;
          playTimeMs: number; difficulty: Difficulty; shopName: string; owner: AvatarSpec };
  rng: Record<'customers' | 'market' | 'packs' | 'grading' | 'events' | 'staff' | 'misc',
              [number, number, number, number]>;                 // sfc32 state per stream
  clock: { day: Day; minute: GameMinute; phase: 'prep' | 'open' | 'night'; speed: 0 | 1 | 2 | 4 };
  finance: FinanceState;
  progression: { level: number; xp: number; unlocked: Record<UnlockId, Day>;
                 flags: Record<string, boolean | number>; tutorial: TutorialState };
  reputation: { sub: Record<RepSub, number>; history: number[]; reviews: Review[]; risks: ReviewRisk[] };
  shop: { tier: 1|2|3|4|5; layout: LayoutState;
          storage: { onsite: 'closet' | 'backRoom' | 'stockroom'; warehouse: boolean; climateVault: boolean };
          upgrades: Record<UpgradeId, Day>; appealCache: number };
  inventory: InventoryState;
  pricing: { prices: Record<ProductId, Cents>; rules: PricingRule[] };
  market: MarketState;
  world: WorldState;
  suppliers: { orders: Order[]; preorders: Preorder[]; caps: Record<string, number>;
               allocations: Record<SetId, number> };
  grading: { submissions: Submission[]; pop: Record<string, PopRow> };   // key `${cardId}|${company}`
  customers: { active: CustomerAgent[]; queue: number[]; nextUid: number;
               regulars: Record<NpcId, RegularState>; specialOrders: SpecialOrder[] };
  staff: { employees: Employee[]; candidates: Candidate[]; policies: StaffPolicies };
  events: { active: ActiveEvent[]; deferred: ActiveEvent[]; cooldowns: Record<EventId, Day>; log: EventLogEntry[] };
  collection: { binders: Binder[]; trophy: InstanceId[]; dexSeen: Record<SpeciesId, Day>;
                dexOwned: Record<SpeciesId, Day>; mangaLibrary: Record<VolumeId, number> };
  goals: { daily: DailyObjective[]; rerollsLeft: number; quests: Record<QuestId, QuestState>;
           legacyLocks: Record<LegacyLockId, Day | null>; achievements: Record<AchievementId, Day> };
  stats: Record<StatKey, number>;                  // lifetime counters → achievements, summaries
}

type RepSub = 'prices' | 'service' | 'selection' | 'trust' | 'community';

interface FinanceState { cashCents: Cents;
  loan: { principalCents: Cents; limitCents: Cents; weeklyRate: number };
  ledger: { day: Day; kind: LedgerKind; cents: Cents; ref?: string }[];   // rolling ~60 days
  today: { revenue: Cents; cogs: Cents; wages: Cents; fees: Cents; other: Cents; customers: number } }

interface InventoryState {
  sealed: Record<ProductId, SealedLot[]>;
  cardStacks: Record<string, number>;      // key `${cardId}|${finish}|${stamps}|${condition}` → count
  instances: Record<InstanceId, CardInstance>;
  locations: Record<InstanceId, string>;   // 'storage' | 'case:<fixtureUid>:<slot>' | 'binder:<id>' |
                                           // 'grading:<submissionUid>' | 'listed:<listingUid>' | 'trophy'
  unsortedLots: UnsortedLot[];             // bought lots awaiting sorting
  bulkCount: number;
  accessories: Record<ProductId, number>;
  manga: Record<VolumeId, { newQty: number; usedQty: number; avgCostCents: Cents }>;
  mysteryBoxes: MysteryBoxInstance[];
}
interface SealedLot { qty: number; unitCostCents: Cents; acquiredDay: Day;
  firstEdition?: boolean; damaged?: boolean; packArt?: number }
interface CardInstance { id: InstanceId; cardId: CardId; finish: Finish; stamps: Stamp[];
  misprint?: Misprint; sub: SubScores; condition: Condition;
  inspected: 0 | 1 | 2 | 3;               // 0 none, 1 loupe, 2 light box, 3 centering tool
  fake?: { kind: 'counterfeit' | 'trimmed'; detected: boolean };
  graded?: { company: GradingCompanyId; grade: number; subgrades?: SubScores;
             blackLabel?: boolean; cert: string; day: Day };
  acquiredDay: Day; costCents: Cents; priceCents?: Cents }

interface MarketState {
  prices: Record<string, Cents>;           // PriceKey: `${cardId}|${variantKey}` or productId (NM raw)
  history: Record<string, string>;         // tracked keys only; base64 Int32 daily series
  factors: { species: Record<SpeciesId, number>; setHype: Record<SetId, number>;
             meta: Record<CardId, number>; shocks: MarketShock[] };
  indices: Record<string, number[]>; news: NewsItem[]; watchlist: string[];
  listings: OnlineListing[];               // FoilMarket listings
}

interface WorldState {
  sets: Record<SetId, { status: 'announced' | 'preorder' | 'released' | 'lastCall' | 'oop' | 'vintage';
                        firstEditionOpen: boolean }>;
  generatedSets: SetDef[];                 // Set Forge output stored verbatim (save-stable)
  manga: Record<SeriesId, { popularity: number; volumes: number; nextReleaseDay?: Day }>;
  rivals: Record<string, { score: number; mood: number }>;
  ranking: { shopId: string; score: number }[];
  calendar: { day: Day; kind: string; ref?: string }[];
}

interface LayoutState { grid: { w: number; d: number; floors: number }; fixtures: PlacedFixture[] }
interface PlacedFixture { uid: string; fixtureId: FixtureId; x: number; z: number;
  rot: 0 | 1 | 2 | 3; floor: number;
  slots: { productId?: ProductId; qty: number; instanceId?: InstanceId; priceOverrideCents?: Cents }[] }

interface CustomerAgent { uid: number; archetypeId: ArchetypeId; npcId?: NpcId; name: string;
  looks: AvatarSpec; voice: VoiceProfile;
  budgetCents: Cents; knowledge: number;
  patienceMinutes: number;          // remaining waiting tolerance (queue, unanswered bubbles)
  hagglePatience: number;           // remaining counter rounds (1–5, by haggle style)
  mood: -2 | -1 | 0 | 1 | 2;
  haggleStyle: 'pushover' | 'fair' | 'tough' | 'chaotic';
  intent: 'buy' | 'sell' | 'request' | 'event';
  plan: PlanStep[]; step: number; stepEndsAt: GameMinute;
  basket: { productId?: ProductId; instanceId?: InstanceId; qty: number; priceCents: Cents }[];
  wants?: { cardId?: CardId; productTag?: string }; lot?: LotSpec;
  satisfaction: number; signals: Partial<Record<RepSub, number>>;
  bubble?: 'pay' | 'talk' | 'sell' | 'request' | 'waiting' | 'angry' | 'delight' }
type PlanStep =
  | { kind: 'walk'; path: [number, number][]; minutes: number }
  | { kind: 'browse'; fixtureUid: string; minutes: number }
  | { kind: 'queue' } | { kind: 'interact'; what: 'haggle' | 'sellOffer' | 'request' | 'askToSee' }
  | { kind: 'leave' };

interface Employee { uid: string; name: string; looks: AvatarSpec; role: RoleId;
  skills: Record<SkillId, 1 | 2 | 3 | 4 | 5>; traits: TraitId[]; salaryCents: Cents;
  morale: number; xp: number; level: number; schedule: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  hiredDay: Day }

interface Submission { uid: string; company: GradingCompanyId; tier: 'economy' | 'standard' | 'express';
  instanceIds: InstanceId[]; feeCents: Cents; sentDay: Day; returnDay: Day;
  status: 'transit' | 'grading' | 'returning' | 'ready' | 'revealed' }

interface Order { uid: string; supplierId: SupplierId;
  lines: { productId: ProductId; qty: number; unitCostCents: Cents; firstEdition?: boolean }[];
  totalCents: Cents; placedDay: Day; etaDay: Day; insured: boolean;
  status: 'pending' | 'delivered' | 'atDepot' }

interface SpecialOrder { uid: string; customerName: string; npcId?: NpcId; cardId: CardId;
  minCondition?: Condition; agreedCents: Cents; depositCents: Cents; dueDay: Day;
  status: 'open' | 'fulfilled' | 'failed' }

interface Review { day: Day; stars: 1 | 2 | 3 | 4 | 5; textKey: string;
  params: Record<string, string | number>; cause: string; author: string }
```

---

## 4. Commands (player, staff and bot actions)

Grouped by domain. Each is a discriminated union member `{ type: '<domain>/<verb>', …payload }`.

| Domain | Commands |
|--------|----------|
| time | `setSpeed` · `openShop` · `closeShop` · `nextDay` |
| shop | `placeFixture` · `moveFixture` · `sellFixture` · `buyUpgrade` · `expandTier` · `buyStorage` · `buyDecor` |
| stock | `fillSlot` · `clearSlot` · `restockAll` · `moveInstance` |
| pricing | `setPrice` · `setRule` · `applyRules` |
| suppliers | `placeOrder` · `placePreorder` · `cancelPreorder` |
| open | `openProduct` (a box opens all its packs; one-by-one vs Quick Rip is presentation only) |
| customers | `checkout` · `haggleRespond` · `makeBuyOffer` · `appraise` · `acceptSpecialOrder` · `fulfillSpecialOrder` · `dismiss` |
| lots | `sortLot` (manual choices or auto) |
| collection | `addToBinder` · `removeFromBinder` · `toTrophy` · `fromTrophy` |
| grading | `submit` · `reveal` · `crack` |
| market | `listOnline` · `delistOnline` · `buyOnline` · `watch` · `unwatch` |
| staff | `hire` · `fire` · `setSchedule` · `setPolicy` · `train` |
| events | `choose` · `defer` |
| finance | `takeLoan` · `repayLoan` |
| goals | `rerollDaily` · `claimReward` |
| mystery | `createBox` · `disassembleBox` |

**Result:** `{ ok: true, events: DomainEvent[] } | { ok: false, code: ErrorCode, params? }`.

## 5. Domain Events (presentation and in-sim listeners)

`clock/phaseChanged` · `clock/dayStarted` · `customer/arrived` · `customer/bubble` · `customer/left` · `sale/completed` · `buy/completed` · `haggle/updated` · `product/opened` · `card/pulled` · `order/placed` · `order/delivered` · `order/damaged` · `grading/submitted` · `grading/returned` · `grading/revealed` · `market/updated` · `news/published` · `reputation/changed` · `review/posted` · `xp/gained` · `level/up` · `unlock/granted` · `achievement/unlocked` · `event/triggered` · `event/resolved` · `staff/hired` · `staff/quit` · `rent/charged` · `loan/changed` · `set/announced` · `set/released` · `set/statusChanged` · `manga/released` · `tutorial/step` · `legacy/lockOpened`.

Each event carries IDs and numbers only (no display strings). Presentation maps events to i18n text, SFX and VFX.

---

## 6. Save File

```ts
interface SaveFile {
  format: 'ff-save';
  saveVersion: number;              // bump on ANY GameState shape change (+ migration)
  gameVersion: string;              // package.json version
  savedAt: string;                  // ISO
  slot: 'slot-1' | 'slot-2' | 'slot-3' | 'auto-1' | 'auto-2' | 'auto-3' | 'auto-weekly';
  summary: { shopName: string; day: Day; level: number; cashCents: Cents; playTimeMs: number };
  state: GameState;
}
```
**Settings** (separate, `localStorage` `ff.settings`): audio volumes, quality preset, text scale, reduced motion, colorblind mode, dyslexia font, pause-on-interaction, relaxed customers, language, keybinds, tutorial toggles.
