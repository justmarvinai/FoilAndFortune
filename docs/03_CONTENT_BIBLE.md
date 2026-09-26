# 03 · Content Bible: TCGs, Sets, Creatures, Manga, Characters

> The creative canon of Foil & Fortune. Names here are **working names**. The user may rename anything (**Q5**). All content is **original and fictional**. It is inspired by the *structure* of real TCGs, especially the Pokémon TCG, but never copies names, characters, logos or card text.
> Content lives as typed data in `src/content/**` and is validated by `npm run content:validate` (unique IDs, valid references, pull tables summing to 1, a name blocklist check).

---

## 1. Content Principles

1. **Original and fictional.** No real brands, companies, people, card names or logos. Parodies are fine if clearly distinct (e.g., "Apex Grading Co." is *not* PSA).
2. **Instantly readable.** A player should guess a creature's element from its silhouette and color, and a card's rarity from its frame and shine.
3. **Collectible by design.** Every set has a mascot, a chase card, 3–4 pack-art variants, a coherent theme and at least one "story" in its art (e.g., the Illustration Rares form a sequence).
4. **Warm humor.** Puns are allowed. Snark is allowed with a light touch. Cruelty is not.
5. **Stable IDs.** Content IDs never change after release (save compatibility). Display names can change freely.

### 1.1 ID scheme
| Entity | ID pattern | Example |
|--------|-----------|---------|
| TCG brand | `<brand>` | `gk` (Glimmerkin) |
| Set | `<brand>.<set-slug>` | `gk.emberdawn` |
| Card | `<set>.<number3>` | `gk.emberdawn.045` |
| Promo | `<brand>.promo.<number3>` | `gk.promo.023` |
| Species | `<brand>.species.<slug>` | `gk.species.sparkit` |
| Product | `<set>.<kind>` / `<brand>.<kind>.<slug>` | `gk.emberdawn.booster`, `gk.emberdawn.box` |
| Manga series / volume | `mg.<slug>` / `mg.<slug>.v<nn>` | `mg.crimson-moon.v12` |
| Fixture / upgrade / event / achievement | `fx.` / `up.` / `ev.` / `ach.` + slug | `fx.wall-shelf-s`, `ev.limited-stock` |
| Regular / archetype | `npc.<slug>` / `arch.<slug>` | `npc.milo`, `arch.kid` |

Display format for card numbers: `EMD 045/100`. Secret rares are numbered past the set total: `EMD 112/100`. Promos: `GK-P023`.

---

## 2. The World: Brightbay

A sunny coastal city with an old harbor, a university, and a hobby scene that has quietly exploded.

| District | Vibe | Customer tilt | Role |
|----------|------|---------------|------|
| **Old Town** (Lantern Lane) | Cobblestones, string lights, indie shops | Balanced; lots of kids and casuals | **Your first shop** at 12 Lantern Lane |
| **Harborfront** | Boardwalk, ferries, tourists | Tourists, casuals, manga | Branch option. *Comic Cove* rival |
| **University Quarter** | Cafés, dorms, game stores | Competitive players, manga fans | Branch option. *The Dragon's Hoard* |
| **Uptown** | Glass towers, galleries | Investors, hardcore collectors | Branch option. *Sterling & Slab* |
| **Brightbay Mall** | Chain stores, food court | Everyone, price-sensitive | *MegaMint Collectibles* |
| **Maple Heights** | Suburbs, schools, parks | Families, kids | *Pixel & Paper* |

**Seasons in Brightbay:** Spring cherry blossoms and the Blossom Fair · Summer beach crowds and school holidays · Autumn Lantern Festival · Winter snow and the Gift Rush.

---

## 3. Glimmerkin TCG (Flagship Brand)

> *"Find your spark."* Glimmerkin is Brightbay's (and the world's) most beloved creature-collecting trading card game, published by **Starforge Games**. It's in its **26th year** when the game begins.

### 3.1 Brand history
- **Year 1 (the Vintage era):** *Origins* launches with 33 creatures and becomes a phenomenon. The first four sets had **1st Edition** and **Unlimited** print runs.
- **Years 5–20 (Classic era):** Crystal types, legendary "Gold Star" cards, and the first secret rares. 1st Edition printing is discontinued.
- **Years 21–25 (Modern era):** full-art and Illustration Rares, **Nova** cards, and quarterly releases.
- **Year 26 (game start):** Starforge **revives 1st Edition** for its anniversary year, starting with *Emberdawn*. Every new set now has a limited 1st Edition wave, which feeds the speculation game.

### 3.2 Elements (9)

| Element | Color | Symbol | Themes & creature types |
|---------|-------|--------|-------------------------|
| **Ember** | `#FF6B35` orange-red | flame drop | Fire, volcanoes, dawn, forges |
| **Tide** | `#2EA7E0` ocean blue | wave curl | Water, sea, rain, coral |
| **Bloom** | `#4CB944` leaf green | sprout | Plants, forests, fungi, seasons |
| **Volt** | `#FFD23F` electric yellow | bolt | Electricity, storms, machines, speed |
| **Terra** | `#B5835A` earth brown | stacked stones | Rock, fossils, mountains, strength |
| **Mystic** | `#B15EFF` violet | eye-star | Psychic, auroras, runes, dreams |
| **Shade** | `#3D3B8E` indigo | crescent | Ghosts, night, shadows, tricks |
| **Frost** | `#7FDBFF` ice cyan | snowflake | Ice, snow, crystal |
| **Neutral** | `#C9C3B6` warm gray | ring star | Birds, everyday animals, versatile |

### 3.3 Card kinds
- **Creature** cards: **Basic → Stage 1 → Stage 2** evolution lines. Plus two special forms:
  - **Nova** (Ultra Rare mechanic): a "supercharged" version with huge HP and a flashy attack. Full holo, textured frame.
  - **Legend**: legendary creatures (usually Holo, Ultra or Mythic).
- **Tactic** cards: **Item** (e.g., *Glimmer Potion*, *Spark Charm*, *Amber Fossil*), **Ally** (human characters, the Supporter equivalent; full-art Allies are big chase cards, and many Allies depict Brightbay regulars 😉), **Arena** (e.g., *Brightbay Harbor*, *Crystal Cavern*).
- **Essence** cards: basic energy per element. Found in starter decks and evolution packs, not in boosters. There are also special textured Essences as Secret Rares.

**Card face data (flavor only; the TCG is not playable, see Q11):** name · HP · element · stage (and "evolves from") · 1 ability (optional) · 1–2 attacks (cost in essence symbols, damage, effect text) · weakness / resistance / retreat · illustrator · flavor text · set symbol · number · rarity symbol. HP ranges: Basic 40–90 · Stage 1 80–130 · Stage 2 120–180 · Nova 200–280 · Legend 130–220.

### 3.4 Rarity ladder

| Rarity | Symbol | Frame / finish | Typical placement |
|--------|--------|----------------|-------------------|
| Common | ● | Standard frame, matte | Common slot |
| Uncommon | ◆ | Standard | Uncommon slot |
| Rare | ★ | Standard | Rare slot |
| Holo Rare | ★ (holo) | Holographic art window (swirl/starburst foil) | Rare slot |
| Ultra Rare | ★★ | **Nova**/Legend frame, full-card holo, texture | Rare slot |
| Illustration Rare | ★ gold | **Full-bleed alternate art**, subtle etched foil, story art | Rare slot (numbered as secret) |
| Secret Rare | ★★★ gold | Gold or rainbow foil, textured, numbered beyond the set total | Rare slot |
| **Mythic Rare** | ♛ crown | Gold crown frame, "cosmos" foil, unique animation | Rare slot (≈ 0.3%) |
| Promo | ★ PROMO | Black-star promo frame, sometimes stamped | Products and events |

**Finishes:** Normal · Reverse Holo (foil everywhere *except* the art; C/U/R only) · Holo (art window) · Full-Art Textured · Gold · Rainbow · Cosmos (promos and Mythics) · Etched.
**Stamps:** 1st Edition · Prerelease · League · Staff · Anniversary.
**Misprints:** Miscut · Ink Error · Missing Foil · Crimped · Wrong Back (see `02 §11`).

### 3.5 Product lineup (per main set)
Booster Pack · 3-Pack Blister (+promo) · Booster Bundle (6) · **Booster Box / Display (36)** · Elite Collector Box · Collection Boxes (2–3 variants with promos) · Collector Tins (3 variants) · 2 Starter Decks · Prerelease Kit (release window only). **Special sets** have no booster boxes: only ECB, bundles, collections, tins, blisters and poster collections. That is why they are so scarce.
**Pack art variants:** every set has 3–4 pack wrappers featuring different creatures. They are distributed randomly, and some collectors hunt all of them.

---

## 4. Set Timeline

Game time **Day 1 = Spring 8, Year 1** (Glimmerkin's 26th year). *Emberdawn* released one week earlier (Spring 1). The calendar rule is **main sets on day 1 of each season** and **special sets on day 15 of selected seasons**.

| # | Set | Code | Era | Release | Theme | Chase / signature | Cards | Status at start |
|---|-----|------|-----|---------|-------|-------------------|-------|-----------------|
| 1 | **Origins** | ORG | Vintage | Year −25 | The original 33 creatures | **Infernox** Holo (1st Ed.) | 72 | Vintage (second-hand only) |
| 2 | Wildwood | WLD | Vintage | Year −25 | Deep forests, Neutral critters | Mossquatch Holo | 64 | Vintage |
| 3 | Ancient Amber | AMB | Vintage | Year −24 | Fossils revived from amber | Rexolith Holo | 62 | Vintage |
| 4 | Shadow Syndicate | SHS | Vintage | Year −24 | Villain team *Umbra Syndicate* and dark variants | Syndicate's Infernox Holo | 82 | Vintage |
| 5 | Crystal Skies | CRS | Classic | Year −18 | Crystal-type variants | Crystalynx (Crystal) | 150 | Vintage |
| 6 | Echoes of Legend | EOL | Classic | Year −15 | Legendary trio debut, "Gold Star" legends | Aurorael Gold Star | 110 | Vintage |
| 7 | Tidebreak | TDB | Modern | Autumn 1, Y0 | Oceans and storms | Maelstryx Mythic | 120 | **Last call** (goes OOP early game) |
| 8 | Moonlit Masquerade | MNM | Modern | Winter 1, Y0 | A masked ball of Shade and Mystic creatures | Phantomane Nova (IR) | 125 | In print |
| 9 | **Emberdawn** | EMD | Modern | Spring 1, Y1 | Volcanic island at sunrise | **Solaryx** Mythic | 130 | **Current set** (1st Ed. sold out) |
| S1 | **Sparkit & Friends** | SPF | Special | Spring 15, Y1 (**Day 8**) | Mascot celebration, slice-of-life art | Sparkit Nova Crown | 90 | First release you experience |
| 10 | Sunken Kingdom | SNK | Future | Summer 1, Y1 (Day 22) | Underwater ruins, *Relic* items | Maelstryx Nova | ~130 | Future |
| 11 | Harvest of Spirits | HOS | Future | Autumn 1, Y1 (Day 50) | Lantern festival spirits | Phantomane Legend art | ~130 | Future |
| S2 | Origins 25th Anniversary | O25 | Special | Autumn 15, Y1 (Day 64) | Reprints of Origins classics with new frames (**vintage reprint shock**) | Anniversary Infernox | 60 | Future |
| 12 | Frostbound Kingdom | FBK | Future | Winter 1, Y1 (Day 78) | Ice castle, crowned creatures | Glacierra Mythic | ~130 | Future |
| 13 | Neon Circuit | NEC | Future | Spring 1, Y2 (Day 106) | Cyber city, Volt and Mystic | Thundervixen Nova | ~130 | Future |
| 14 | Starfall Odyssey | SFO | Future | Summer 1, Y2 (Day 134) | Space voyage | Aurorael Mythic | ~130 | Future |
| ∞ | **Set Forge** (procedural) | auto | Future | Autumn 1, Y2 onward | Generated (§5) | Generated | 100–140 | — |

**Content needed per roadmap phase:** Vertical Slice uses an *Emberdawn* subset (~40 cards). MVP adds full *Emberdawn*, *Origins* and *Sparkit & Friends*. v1.0 adds *Tidebreak*, *Moonlit Masquerade*, *Sunken Kingdom*, *Harvest of Spirits*, *O25* and *Frostbound Kingdom*, plus Set Forge. Other vintage and classic sets appear as they are authored. Until then, lots draw from available sets only.

### 4.1 Launch set details

**Origins (ORG)**: 72 cards, 11-card packs (7C / 3U / 1 rare slot: 2/3 Rare, 1/3 Holo). 1st Edition and Unlimited prints.
- Holo Rares (12): Infernox, Thundervixen, Tsunamaw, Sylvhare, Stormcrest, Bouldrake, Phantomane, Aurorwing, Glacierra, Snoozle, Mimicat, Nocturnowl.
- Rares (12): Blazehound, Voltail, Axolagoon, Bloomhop, Galewing, Voltbandit, Bastionaut, Pengwing, plus 4 Tactics (e.g., *Coach's Pep Talk*).
- Uncommons (20) and Commons (28): the remaining Origins basics and tactics.
- **Lore variant:** the first print of Origins **Sparkit** has **blue sparks** (the "Blue Spark error"), corrected to yellow in later prints. It is a famous, valuable variant.
- Reference values (raw NM): Infernox Unlimited ≈ $350 · 1st Ed ≈ $1,800 · 1st Ed in AGC 10 ≈ $35–40k (a grail).

**Emberdawn (EMD)**: 130 cards = 100 main (C 40 · U 30 · R 14 · HR 10 · UR 6) + 30 secret (IR 16 · SR 10 · MR 4).
- New species: **Magmadillo**, **Boltbuck**, **Solaryx** (Legend).
- Nova cards: Infernox, Thundervixen, Solaryx, Magmadillo, Boltbuck, Snoozle.
- Mythic Rares: Solaryx *Gold Crown* · Infernox *Nova Gold* · Sparkit *"Dawn Chase"* (illustration) · Solaryx & Emberpup *"Bond"* art.
- Pack art: Solaryx, Magmadillo, Boltbuck, Emberpup. Starter decks: *Ember Blaze* (Emberpup line) and *Volt Surge* (Sparkit line).
- Its Illustration Rares tell the story of one day on the volcanic island, from dawn to night.

**Sparkit & Friends (SPF)**: a special set with 90 cards = 70 main (C 25 · U 20 · R 10 · HR 8 · UR 7) + 20 secret (IR 12 · SR 6 · MR 2). **No booster boxes.**
- Products: ECB, Booster Bundle, 3 Collection Boxes, 3 Tins, 3-Pack Blisters, Poster Collection.
- Mythics: **Sparkit Nova Crown** and **"Sparkit & Milo"**, a full-art Ally starring our kid regular.
- Hype: launch hype ×1.6 (instead of 1.25) and tight allocations. The "limited stock" event is guaranteed in release week.

---

## 5. Set Forge: procedural future sets

After the curated sets, new releases are generated deterministically from the save seed and the set index. The **full generated definition is stored in the save**, so generator changes never break old saves.
1. **Theme** from a pool (biome × culture × mechanic, e.g., "Desert Carnival", "Sky Railway", "Haunted Library"), with 2–3 focus elements.
2. **Roster:** 1–3 **new species** (procedural creature genome plus a syllable-based name that passes the blocklist and similarity checks) + popular reprints (weighted by species popularity) + 1 legendary headliner.
3. **Composition** from a template (e.g., 100 main + 20–40 secret) with Tactic names from templates ("<Adjective> <Object>").
4. **Art assignments:** pose, background scene and composition per card. IR sequences follow the theme's "story beats".
5. **Validation:** the same Zod schemas and EV tests as curated sets.

---

## 6. Species Roster (Dex)

Popularity (`pop`, 0.5–3.0) drives prices and demand. **Bold** marks fan favorites.

| Dex | Species | Element | Stage / line | Concept | pop | Debut |
|-----|---------|---------|--------------|---------|-----|-------|
| 001 | **Sparkit** | Volt | Basic → Voltail → Thundervixen | Electric fox kit, **the mascot** | 3.0 | ORG |
| 002 | Voltail | Volt | Stage 1 | Lanky storm fox | 1.8 | ORG |
| 003 | **Thundervixen** | Volt | Stage 2 | Majestic lightning fox | 2.4 | ORG |
| 004 | **Emberpup** | Ember | Basic → Blazehound → Infernox | Puppy with a flame tail | 2.2 | ORG |
| 005 | Blazehound | Ember | Stage 1 | Fire hound | 1.6 | ORG |
| 006 | **Infernox** | Ember | Stage 2 | Wolf-dragon of fire, **the vintage chase** | 3.0 | ORG |
| 007 | **Sploot** | Tide | Basic → Axolagoon → Tsunamaw | Cheerful axolotl | 2.4 | ORG |
| 008 | Axolagoon | Tide | Stage 1 | Lagoon axolotl | 1.4 | ORG |
| 009 | Tsunamaw | Tide | Stage 2 | Sea-dragon axolotl | 2.0 | ORG |
| 010 | **Budbun** | Bloom | Basic → Bloomhop → Sylvhare | Bunny with leaf ears | 2.2 | ORG |
| 011 | Bloomhop | Bloom | Stage 1 | Flower-crowned hare | 1.3 | ORG |
| 012 | Sylvhare | Bloom | Stage 2 | Tree-antlered forest hare | 1.8 | ORG |
| 013 | Chirpip | Neutral | Basic → Galewing → Stormcrest | Fluffy chick | 1.1 | ORG |
| 014 | Galewing | Neutral | Stage 1 | Swift bird | 1.0 | ORG |
| 015 | Stormcrest | Neutral | Stage 2 | Crested sky raptor | 1.6 | ORG |
| 016 | Pebblit | Terra | Basic → Bouldrake | Pebble pup | 1.2 | ORG |
| 017 | Bouldrake | Terra | Stage 1 | Boulder drake | 1.9 | ORG |
| 018 | Wisplet | Shade | Basic → Phantomane | Shy ghost wisp | 1.5 | ORG |
| 019 | **Phantomane** | Shade | Stage 1 | Ghost lion with a smoke mane | 2.1 | ORG |
| 020 | Mothlume | Mystic | Basic → Aurorwing | Glowing moth | 1.4 | ORG |
| 021 | Aurorwing | Mystic | Stage 1 | Aurora-winged moth | 2.0 | ORG |
| 022 | **Snoozle** | Neutral | Basic | Sleepy panda (fan favorite) | 2.0 | ORG |
| 023 | Mimicat | Neutral | Basic | Cat that mimics others' looks | 1.8 | ORG |
| 024 | Zapcoon | Volt | Basic → Voltbandit | Static-charged raccoon | 1.2 | ORG |
| 025 | Voltbandit | Volt | Stage 1 | Masked raccoon thief | 1.4 | ORG |
| 026 | Frostling | Frost | Basic → Glacierra | Snow sprite | 1.4 | ORG |
| 027 | Glacierra | Frost | Stage 1 | Ice fairy | 1.9 | ORG |
| 028 | Pengwing | Frost | Basic | Penguin with a scarf | 1.6 | ORG |
| 029 | Shellby | Tide | Basic → Bastionaut | Hermit crab | 1.0 | ORG |
| 030 | Bastionaut | Tide | Stage 1 | Crab with a castle shell | 1.3 | ORG |
| 031 | Flickerfly | Ember | Basic | Firefly | 1.1 | ORG |
| 032 | Dusklet | Shade | Basic → Nocturnowl | Owlet | 1.3 | ORG |
| 033 | Nocturnowl | Shade | Stage 1 | Night owl | 1.7 | ORG |
| 034 | Mossquatch | Bloom | Basic | Moss yeti | 1.7 | WLD |
| 035 | Fungloo | Bloom | Basic → Mycelord | Mushroom blob | 1.2 | WLD |
| 036 | Mycelord | Bloom | Stage 1 | Mushroom king | 1.4 | WLD |
| 037 | Puffcap | Bloom | Basic | Dandelion puff | 1.2 | WLD |
| 038 | Nibblit | Neutral | Basic | Hamster | 1.3 | WLD |
| 039 | Molemite | Terra | Basic → Tunnelord | Mole | 1.0 | WLD |
| 040 | Tunnelord | Terra | Stage 1 | Drill-clawed mole | 1.2 | WLD |
| 041 | Amberwing | Terra | Basic (fossil) | Pterosaur revived from amber | 1.8 | AMB |
| 042 | Trilobyte | Tide | Basic (fossil) | Trilobite | 1.2 | AMB |
| 043 | Rexolith | Terra | Stage 1 (fossil) | Fossil rex | 2.0 | AMB |
| 044 | Umbraith | Shade | Basic | Wraith fox, Syndicate mascot | 1.9 | SHS |
| 045 | **Crystalynx** | Frost | Basic | Crystal lynx | 2.2 | CRS |
| 046 | **Aurorael** | Mystic | Legend | Aurora sky dragon | 2.8 | EOL |
| 047 | Terravok | Terra | Legend | Mountain titan | 2.2 | EOL |
| 048 | Maelstryx | Tide | Legend | Sea serpent | 2.4 | EOL |
| 049 | Runeling | Mystic | Basic → Oracleon | Floating rune stone | 1.1 | MNM |
| 050 | Oracleon | Mystic | Stage 1 | Sphinx-like seer | 1.8 | MNM |
| 051 | Tidepup | Tide | Basic → Walrusk | Seal pup | 1.3 | TDB |
| 052 | Walrusk | Tide | Stage 1 | Walrus | 1.2 | TDB |
| 053 | Glowtoad | Mystic | Basic | Toad with glowing spots | 1.1 | MNM |
| 054 | **Solaryx** | Ember | Legend | Sun phoenix | 2.6 | EMD |
| 055 | Magmadillo | Ember | Basic | Lava armadillo | 1.3 | EMD |
| 056 | Boltbuck | Volt | Basic | Lightning stag | 1.5 | EMD |

*Villain variants:* "Syndicate's <Species>" cards (SHS) are darker palette swaps with Syndicate insignia. They count as separate cards with the same species.

---

## 7. Manga

Publishers: **Kaze Comics** · **Moonpetal Press** · **Iron Lotus**. The distributor is **Kaze Manga Direct**.

| Series | Genre | Status | Vols at start | Popularity profile | Cover motif |
|--------|-------|--------|---------------|--------------------|-------------|
| **Blade of the Crimson Moon** | Shōnen battle | Ongoing (new vol / 28 days) | 27 | **Mega-hit** (P 2.6) | Crimson moon, bold brush title |
| **Ramen Samurai** | Cooking battle comedy | Ongoing | 14 | Popular (1.6) | Steam, noodles, katana chopsticks |
| **Starlight Idol Academy** | Idol / school | Ongoing | 8 | Rising (1.2, trending up) | Pastel stars, stage lights |
| **Iron Tide 2099** | Mecha sci-fi | Completed | 18 | Cult classic (1.1). Vols 1–3 out of print | Chrome, blueprints |
| **The Hollow Lantern** | Horror mystery | Completed | 11 | Steady (0.9). Spikes every Autumn | Dark ink, lantern glow |
| **Spike Kings** | Volleyball sports | Ongoing | 16 | Popular (1.5) | Dynamic action, halftone |
| **Reincarnated as a Holo Rare** | Isekai comedy | Ongoing | 3 | New and rising (0.8). Anime-announcement candidate | A salaryman trapped in a trading card |
| **The Tea Witch of Willowmere** | Cozy fantasy slice of life | Ongoing | 6 | Evergreen (1.0) | Watercolor, teapots, cats |

**Later series:** *Ghost Detective Kuro* · *Dragon Courier* · *Pixel Heart* · *Neon Ronin* · *Kaiju Kindergarten*.
**Tie-in:** *Blade of the Crimson Moon* gets its own TCG (**Crimson Moon Card Game**) late in the game, which links the manga and TCG markets.

---

## 8. Characters

### 8.1 Mentor
**Theo Hartley**: 70s, cardigan, reading glasses on a chain, terrible puns, knows everyone. He ran *Theo's Cards & Comics* for 30 years. He runs the tutorial ("Theo's Lessons"), visits now and then with tips and quests, and holds the key to the story: **Theo's Vault**.

### 8.2 Regulars

| NPC | Archetype | Personality | Storyline & rewards |
|-----|-----------|-------------|---------------------|
| **Milo Okafor** (9) + mom **Adaeze** | Kid | Bouncing, loud, pure joy | Saving his allowance for a Sparkit holo. Help him and he brings friends (kid traffic up) and stars on the SPF Mythic |
| **Grandma Rosa Bellini** | Attic Finder | Sweet, sentimental, sharp memory | Keeps finding boxes from her late husband Enzo, who was Theo's friend. Her final box holds a sealed 1st Edition *Origins* pack |
| **Dex Park** (19) | Competitive | Intense, analytical, secretly kind | Wants meta cards. Becomes the League Night champion. Can be hired as Event Host |
| **Vivian Chen** | Investor | Sharp, stylish, blunt | The sealed-product queen. Teaches market lessons, sells OOP boxes, and taunts your "paper hands" |
| **Kenji Mori** (22) | Manga Fan | Enthusiastic, spoiler-averse | Completing *Crimson Moon*. Starts a manga club at your shop (Community up) |
| **Harold Pemberton** ("The Completionist") | Hardcore Collector | Fussy, generous with the right card | Master-set quests with premium payouts. Obsessed with condition |
| **Sasha Rivera** ("SashaRips") | Influencer | Hype, loud, loves the camera | On-stream openings go viral. Later a Streaming Studio partner |
| **Mr. Grimsby** | Shady Dealer | Trench coat, whispers, "trust me" | Offers too-good-to-be-true deals and fakes. Report him (Trust up) or keep dodging him |

### 8.3 Rivals (Town Rankings)
| Shop | Owner | District | Style |
|------|-------|----------|-------|
| **MegaMint Collectibles** | Victor Vance (slick corporate manager) | Brightbay Mall | Price wars, hoards allocations, outbids you at auctions |
| **Sterling & Slab** | Celeste Sterling (elegant, snobbish) | Uptown | High-end graded boutique |
| **The Dragon's Hoard** | "Big" Bjorn Halvorsen (jolly) | University Quarter | A friendly rival and *Arcane Dominion* hub who co-hosts events |
| Comic Cove | (background) | Harborfront | Manga and comics |
| Pixel & Paper | (background) | Maple Heights | Family-friendly |

### 8.4 Other NPCs
**Nadia** (delivery driver, chatty on deliveries) · **Dr. Ada Kwan** (Apex Grading representative) · **Mayor Pim** (festival events) · **Gavel & Glimmer** auctioneer **Barnaby Gavel**.

### 8.5 Dialogue style guide
- Keep bubbles short (≤ 90 characters). Dialogue boxes are 1–3 sentences.
- **Kid:** "WHOA! Is that a HOLO?!" · **Investor:** "What's the ROI on this box in 12 months?" · **Competitive:** "Is Voltail still meta after the ban?" · **Collector:** "Any whitening on the back? Be honest." · **Manga Fan:** "Vol. 12 is where it gets SO good." · **Shady:** "Psst… wanna see something *special*?" · **Grandma Rosa:** "My Enzo used to love these little critters."
- Every archetype has 20+ lines per intent (browse, buy, haggle, sell, leave-happy, leave-angry) to avoid repetition. Regulars get unique lines.

---

## 9. Other TCG Brands (later phases, **Q8**)

### 9.1 Arcane Dominion (Lv 22), inspired by fantasy strategy TCGs
- Publisher: **Wyrmgate Games**. Five **Domains**: *Dawn* (white/gold), *Deep* (blue), *Dusk* (black), *Blaze* (red), *Wild* (green).
- Card types: Champions, Spells, Relics, Realms (lands).
- Rarities: Common, Uncommon, Rare, **Mythic**, with foil variants and "Showcase" frames.
- Products: Draft Booster (15 cards), **Collector Booster** (premium, all foils), Bundle, Warband precon decks.
- **Economy:** singles-driven, with high-value competitive staples. The **Reserved Vault** (never-reprinted vintage cards) produces extreme vintage prices. Its customers are older, competitive and very knowledgeable.

### 9.2 Crimson Moon Card Game (Lv 32), a manga tie-in
- Publisher: **Kaze Comics**. It uses characters from *Blade of the Crimson Moon*: Leader, Character and Event cards.
- Rarities: C, UC, R, SR, SEC, **Manga Rare** (black-and-white manga-panel art, the super chase) and Alternate Art.
- Its popularity is coupled to the manga's popularity and anime events.

---

## 10. Events Catalogue (v1.0 target: 40)

| ID | Event | Type | Summary / choices |
|----|-------|------|-------------------|
| ev.limited-stock | **Limited Stock Flash Sale** (brief) | Supply + | Hyped product, only N left, premium price. Buy now or pass |
| ev.damaged-shipment | **Shipment Arrived Damaged** (brief) | Supply − | Claim insurance / sell as "damaged" at a discount / open anyway |
| ev.estate-deal | **Rare Product at a Good Price** (brief) | Supply ± | Estate sale vintage sealed product. Inspect for authenticity first? |
| ev.amazing-collection | **Amazing Collection** (brief) | Customer + | A guaranteed-gem lot and a sentimental seller haggle |
| ev.sudden-demand | **Sudden Demand** (brief) | Market + | A viral pull makes a card spike and hunters flood in |
| ev.allocation-cut | Allocation Cut | Supply − | Next release allocation reduced. Buy extra from Harbor at a premium? |
| ev.surprise-restock | Surprise Restock | Supply + | A sold-out item is back briefly |
| ev.price-hike | Supplier Price Hike | Supply − | Wholesale +10% for 7 days |
| ev.misprint-rumor | Misprint Batch Rumor | Market ± | A batch reportedly has misprints. Buy a case and gamble? |
| ev.meta-shift | Tournament Meta Shift | Market ± | Saturday Regionals results move competitive cards |
| ev.ban-list | Ban List Update | Market ± | One card banned (crash), one unbanned (spike) |
| ev.reprint | Reprint Announced | Market − | Older cards drop. Sealed product is mostly unaffected |
| ev.influencer-hype | Influencer Hype | Market + | Set hype up. SashaRips pulled three Mythics |
| ev.anime | Anime Announced | Manga + | Series popularity ×1.8 |
| ev.nostalgia | Nostalgia Wave | Market + | GK Vintage Index up |
| ev.jitters | Market Jitters | Market − | Temporary dip, which is a buying opportunity |
| ev.price-error | Price Guide Error | Market + | FoilMarket underprices a card for 2 hours, an arbitrage chance |
| ev.bulk-buyer | Bulk Buyer | Customer + | Offers $X per 1,000 bulk cards |
| ev.want-list | Collector's Want List | Customer + | Harold posts premium buy requests |
| ev.lost-kid | Lost Kid | Community + | Reunite the kid with their parent. Community up and Kid's Smile |
| ev.birthday | Birthday Party | Customer + | A pack-opening party package: 20 packs plus a table |
| ev.school-trip | School Trip | Customer + | A wave of kids |
| ev.tourist-bus | Tourist Bus | Customer + | Tourists flood in (Tier 2+) |
| ev.shady-offer | Shady Offer | Customer ± | Grimsby's "mint 1st Edition Infernox". Real or fake? |
| ev.complaint | Customer Complaint | Customer − | A return claim. Refund or refuse |
| ev.swap-meet | Card Swap Meet | Community + | Customers trade in your shop. Community up |
| ev.rainy-day | Rainy Day | Shop − | Traffic −30% but longer browsing. Cozy music |
| ev.heat-wave | Heat Wave | Shop − | Traffic −20% |
| ev.power-outage | Power Outage | Shop − | Close 2 hours early. The card reader is offline |
| ev.street-festival | Street Festival | Shop + | Traffic +50% and tourists |
| ev.leaky-roof | Leaky Roof | Shop − | Storage leak. Pay for repair or risk damage to sealed stock |
| ev.news-feature | Local News Feature | Shop + | Reputation and traffic up (needs 3★) |
| ev.rival-sale | MegaMint Mega Sale | Rival − | Traffic −15%. Counter with a promotion? |
| ev.rival-poach | Staff Poaching | Rival − | A rival offers your best employee a raise. Match it or lose them |
| ev.charity | Charity Drive | Community + | Donate cards to the children's hospital. Community ++ |
| ev.theo-visit | Theo Drops By | Story + | Tips, quests, lore |
| ev.seasonal-* | Blossom Fair · Summer Holidays · Lantern Festival · Gift Rush | Seasonal | Seasonal traffic and customer mix modifiers |
| ev.collectors-con | Collectors Con | Scheduled | Card show (Lv 20+) |
| ev.shoplifting | Shoplifter *(Tycoon only, Q14)* | Shop − | Loss unless you have Security Tags |

---

## 11. Achievements (v1.0 target ≈ 100; examples)

| Category | Examples |
|----------|----------|
| **Business** | *Open for Business* (first sale) · *Cha-Ching!* ($1k revenue) · *Rent Paid* · *Debt Free* · *Money Printer* ($100k lifetime) · *Millionaire* ($1M lifetime) |
| **Opener** | *First Rip* · *Holo There!* · *Nova Burst* (first UR) · *Art Lover* (first IR) · *Golden Touch* (first SR) · *Myth Made Real* (first Mythic) · *Divine Intervention* (God Pack) · *Glitch in the Print* (misprint) · *Box Breaker* (a full display) · *Rip City* (1,000 packs) |
| **Collector** | *Binder Beginnings* (50 unique cards) · *Set Complete: Emberdawn* · *Master of Origins* · *Gotta Dex 'Em* (all species) · *Grail Keeper* · *First Edition Fan* |
| **Grader** | *Slabbed* · *Perfect 10* (AGC 10) · *Black Label Legend* · *Crack Addict* (10 resubmits) · *Pop 1* (own the only 10) |
| **Merchant** | *Silver Tongue* (10 haggles won) · *Fair & Square* (streak 10) · *Hidden Gem* · *Whale Watcher* (single $10k+ sale) · *Special Delivery* (10 special orders) · *Fake Buster* (5 fakes caught) |
| **Community** | *League Night Legend* (10 events) · *Kid's Hero* (50 Kid's Smiles) · *Five Stars* · *Town Favorite* (#1 ranking) |
| **Manga** | *Bookworm* (100 volumes sold) · *Complete Run* · *Library of Legends* (1,000 volumes owned) |
| **Legend** | *Theo's Legacy* (open the vault) · *Empire Builder* (3 branches) · *Hall of Famer* |
| **Secret / fun** | *Just One More Day* (7 days in one session) · *Sparkit Supremacy* (own 100 Sparkit cards) · *Paper Hands* (sell a box that doubles in value within 14 days) |

---

## 12. Collection Lot Recipes

| Recipe | Size | Content | Condition | Gem chance |
|--------|------|---------|-----------|-----------|
| Kid's Shoebox | 200–500 | Modern commons, a few holos | Kid's shoebox model (worn) | Low |
| Modern Binder | 60–300 | Organized modern sets, some rares | Customer binder model | Medium |
| Quitting Player's Collection | 500–2,000 | Competitive staples, playsets, accessories | Good–NM | Medium |
| Grandpa's Attic Box | 100–600 | Vintage ORG/WLD/AMB/SHS | Vintage lot model | **High** |
| Investor Liquidation | 2–20 sealed | OOP boxes and ECBs | Sealed | — (authentic) |
| Mystery Estate Lot | 100–1,000 | Random mix across eras | Mixed | Medium, with a **fake chance** |
| Manga Complete Run | 1 series | Volumes 1–N (used) | Used | — |
| Bulk Dump | 1,000–5,000 | Commons and uncommons | Mixed | Very low |

---

## 13. Grail List (long-term "own extremely rare cards")

1. *Origins* 1st Edition **Infernox** Holo in AGC 10
2. *Origins* **Prototype Infernox** (1 of 1, in Theo's Vault)
3. *Origins* **"Blue Spark" Sparkit** (1st print error) in any 9+
4. *Crystal Skies* **Crystalynx** (Crystal) in a BLG Black Label
5. *Echoes of Legend* **Aurorael Gold Star** 1st Edition
6. *Emberdawn* **Solaryx** Mythic *Gold Crown* in a Black Label
7. Any **Wrong Back** misprint
8. *SPF* **Staff-stamped Prerelease Sparkit**
9. **Illustrator Contest Promo "Sparkit's First Spark"** (only 100 exist; event reward)
10. **"Divine Ten"**: all 10 cards from a single God Pack graded 10
