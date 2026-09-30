# 04 · Art Direction & Audio

> **Goal (from the brief):** look like a *real game*, not an online shop. Fun, playful, high quality, hooking.
> **Constraint:** all art is **made by us in code** (procedural and hand-authored SVG, shaders, generated textures and audio) or sourced as **CC0 / OFL / MIT-compatible** assets. See `08_ASSET_PIPELINE.md`.
> **Open decisions:** shop view style (**Q1**) and creature art style (**Q2**). Both are validated with a visual **Art Spike** in Phase 1 before we commit.

---

## 1. Visual Pillars

| Pillar | One-liner | Where |
|--------|-----------|-------|
| **Toy Diorama** | The shop is a miniature, lovingly lit toy world: rounded, chunky, warm, alive | 3D shop scene, title screen, city map |
| **Foil Magic** | Cards and rare things *shine*. Holo reacts to your cursor and tilt. Rarity is felt | Cards, packs, slabs, rare UI moments |
| **Chunky & Tactile** | UI feels like physical objects you press, flip, stamp and peel | All menus, HUD, popovers |

**Mood references (for feel, not for copying):** tilt-shift miniature photography, designer vinyl toys, *Animal Crossing* warmth, *Two Point Hospital* readability, *Pokémon TCG Pocket* card shine, sticker and stamp culture, cozy lo-fi aesthetics.

---

## 2. Color

### 2.1 Core tokens (UI)
| Token | Hex | Use |
|-------|-----|-----|
| `--ink` | `#1E2340` | Outlines, primary text |
| `--paper` | `#FFF6E5` | Panel background |
| `--paper-2` | `#F6E7CB` | Secondary panels, table stripes |
| `--wood` / `--wood-dark` | `#A86B3C` / `#6E4323` | Shop-flavored frames, inventory drawer |
| `--teal` | `#1FB5A6` | Primary action |
| `--coral` | `#FF6F59` | Danger, "hot", destructive |
| `--sun` | `#FFC93C` | Money, gold, XP |
| `--sky` | `#4DA8FF` | Info, links |
| `--grape` | `#8E5CF7` | Special, rare |
| `--mint` | `#43D17A` | Success |
| `--night` | `#121634` | Dark stages (pack opening, reveals) |
| `--foil` | `linear-gradient(115deg,#7FF6FF,#B78BFF,#FF8BD1,#FFE58A,#8BFFB0)` | Foil accents, animated shimmer |

### 2.2 Rarity colors (always paired with a **shape**, never color alone)
Common `#9AA3B2` ● · Uncommon `#43D17A` ◆ · Rare `#4DA8FF` ★ · Holo Rare `#1FB5A6` ★ + glow · Ultra Rare `#8E5CF7` ★★ · Illustration Rare `#FF7BC0` gold ★ · Secret Rare `#FFC93C` ★★★ · **Mythic** animated foil with a `#FF3D6E` core and ♛.

### 2.3 Element colors
See `03 §3.2`. Each element also has a light tint (card body gradient) and a dark shade (outlines), generated with OKLCH lightness steps so contrast stays consistent.

### 2.4 World lighting palettes
Morning (warm peach, long soft shadows) → Noon (neutral bright) → Late afternoon (golden) → Evening (dusky blue outside, warm lamps inside, neon sign on) → Night (title and summary scenes). Seasonal tints: spring pink blossom light, summer high-key, autumn amber, winter cool blue with snow-bounce light.

---

## 3. Typography (all OFL, self-hosted via `@fontsource`)

| Role | Font | Notes |
|------|------|-------|
| Display (logo, titles, big numbers) | **Lilita One** | Chunky, friendly, game-like |
| UI (body, buttons, tables) | **Nunito Variable** (600–900) | Rounded and readable. `tabular-nums` for money |
| Card text | **Barlow Condensed** (names, attacks) + **Barlow** (rules) | Compact and printed-card feel |
| Handwritten (price tags, notes, Theo's letters) | **Caveat Variable** | Diegetic charm |

Type scale (UI): 12 / 14 / 16 / 20 / 24 / 32 / 48 / 72. Minimum readable size is 12px at 1× (text-size setting scales everything).

---

## 4. The Shop World (3D Toy Diorama) **(Q1)**

### 4.1 Camera & framing
- **Orthographic** isometric camera (≈ 35° elevation, 45° azimuth). It **rotates in 90° steps** (Q/E), zooms in 3 smooth levels, and pans with drag or WASD. It auto-frames on shop expansion.
- **Cutaway walls:** the two walls facing the camera are hidden (or shown as low edges). The back walls hold wall fixtures. The shop sits on a small street "plinth" (sidewalk, lamp post, bench) like a museum diorama.

### 4.2 Modeling rules
- **Soft-chunky:** everything has **rounded bevels** (no razor edges), slightly exaggerated proportions (thick shelves, big knobs), and simple silhouettes.
- **Procedural by default:** fixtures and props are built in code from parameterized parts (`RoundedBox`, extrusions from SVG paths, lathes, instanced items), so they're resizable, restylable and tiny to download. Optional CC0 models (Kenney, KayKit, Quaternius) may supplement if they match the style (`08`).
- **Product items on shelves** are real little objects: packs (thin crimped boxes with pack-art textures), booster boxes, tins, slabs (clear boxes with a card texture), manga (spines with generated colors and titles). They're drawn with instancing and a generated texture atlas.
- **Scale:** 1 tile = 1 m. Characters are about 1.1 m (kids 0.8 m) in stylized chibi proportions.

### 4.3 Materials & lighting
- **Materials:** matte-satin "painted toy" plastics (roughness 0.55–0.8), warm woods with subtle generated grain, **glass** for display cases (physical transmission on High, fake glass on Low), emissive neon, and metallic gold on premium fixtures.
- **Lighting:** hemisphere fill, a sun or window key light with soft shadows, and warm interior lamps at evening. Environment reflections come from a **procedurally generated** environment (Lightformers), with no downloaded HDRI needed.
- **Post-processing (quality presets):** SMAA · subtle bloom (neon, foil, sparkles) · soft AO · vignette · optional **tilt-shift depth of field** (the miniature look; off on Low).
- **Time of day and weather:** lighting animates through the day. The window shows rain, snow, blossoms or leaves by season and event.

### 4.4 Characters: "Peg-folk"
A consistent, charming style that can be generated entirely in code:
- **Anatomy:** capsule body, slightly squashed sphere head (about 45% of height), short capsule arms and legs, and no hands (mitten nubs). Faces are **texture decals** (eyes, brows, mouth), swapped for **expressions**: neutral · happy · excited · thinking · annoyed · angry · surprised · sleepy · starry-eyed.
- **Variety:** skin tones (a wide, inclusive palette) · hairstyles (bob, spiky, bun, ponytail, curls, buzz, braids, cap-hair) · outfits (color-blocked tops and bottoms, hoodies, suits, vests) · accessories (glasses, caps, headphones, backpacks, tote bags, briefcases, scarves, a phone on a gimbal). Some wheelchair users and some older characters with canes (inclusion by default).
- **Archetype cues:** Kid (small, cap, backpack) · Casual (hoodie, tote) · Competitive (deck box on belt, sleeves) · Investor (suit, briefcase, sunglasses) · Collector (vest, loupe on a chain) · Manga Fan (headphones, tote with a manga cover) · Shady (trench coat, shades) · Influencer (phone gimbal, bright outfit) · Tourist (camera, sunhat).
- **Animation (procedural, no rigs needed):** walk (leg and arm swing, body bob), idle (breathing, looking around), browse (lean in, head tilt), reach (arm up), carry (item bob), cheer (hop, arms up), stomp (angry), sit (play tables). A thought or intent **bubble** floats above the head.
- **The owner avatar** is customizable at New Game and appears behind the counter, walking to fixtures when you act.

---

## 5. Cards

### 5.1 Specification
- Aspect **5:7** (real card proportions). Master layout is **500 × 700 CSS px** at scale 1, fully vector, crisp at any zoom.
- Built as **layered DOM/SVG**: frame (SVG), art (image), text (HTML), foil layers (CSS), stamp and overlays. This keeps it sharp, themeable, accessible and cheap.

### 5.2 Glimmerkin card layout (Creature)
```
┌───────────────────────────────┐  ← rounded border (modern: silver-white, vintage: warm cream)
│ [Stage] NAME           HP 120 ◉│  ← name bar; element gem on the right
│ ┌───────────────────────────┐ │
│ │                           │ │  ← art window (holo foil zone on Holo Rares)
│ │           ART             │ │
│ │                           │ │
│ └───────────────────────────┘ │
│  Stage 1 · Evolves from Sparkit│  ← info strip (dex no., height, weight)
│ ◉◉  Thunder Pounce        60  │  ← attacks: essence cost · name · damage
│      Flip a coin. If heads…   │
│ ◉◉◉ Voltage Rush         110  │
│ weak ◉×2  resist —  retreat ◉ │
│ "It stores static in its tail…"│  ← flavor
│ Illus. Mika Arai   ⚡ 045/100 ★ │  ← footer: illustrator · set symbol · number · rarity
└───────────────────────────────┘
```
- **Glimmer rail:** a thin iridescent line inside the border, Glimmerkin's signature trade dress.
- **Frames by kind and rarity:** Standard · Holo (foil art window) · **Nova** (textured silver frame, "NOVA" logotype) · **Legend** (ornate gold filigree) · Full-art and IR (full-bleed art with frosted text panels) · Secret Rare (gold or rainbow textured) · **Mythic** (crown crest, cosmos foil, animated border glint).
- **Tactic cards:** colored title banner (Item teal / Ally coral / Arena green), art and rules box. **Essence cards:** a large element emblem on a patterned field.
- **Stamps:** "1st EDITION" (circular seal next to the art window) · prerelease and league stamps (small gold stamps) · STAFF.
- **Card back:** deep indigo `#1B1F4B` with a golden radial "spark burst" emblem, a ring of the 9 element symbols, and the **GLIMMERKIN** wordmark over a fine guilloché pattern. It's iconic and memorable.

### 5.3 Foil catalog (implemented as CSS layers driven by pointer/tilt variables; our own implementation)
| Foil | Look | Used on |
|------|------|---------|
| **Holo Swirl / Starburst** | Rainbow bands and a starburst sparkle inside the art window, with glare following the cursor | Holo Rare |
| **Reverse** | Foil everywhere except the art window | Reverse Holo |
| **Textured** | Embossed line pattern with a diagonal sheen | Nova, full art |
| **Gold / Etched Gold** | Warm gold gradient with an etched pattern and hot glare | Secret, Mythic, Gold Star |
| **Rainbow** | Pastel rainbow that shifts with angle | Secret Rare variants |
| **Cosmos** | Galaxy-dot pattern with a rainbow sweep | Promos, Mythic accents |
| **Crystal** | Faceted refraction pattern | Crystal Skies |

Interaction: pointer position and device tilt (when permitted) set `--mx --my --angle`. An idle **shimmer sweep** runs every few seconds on rare cards. **Reduced motion** switches to a static foil.

> ⚠️ Well-known open-source holo-card demos are **GPL-licensed**. We implement ours from first principles and never copy that code (see `CLAUDE.md`).

### 5.4 Slabs (graded cards)
A clear acrylic case (glass gradient and highlight), the card inset with a soft shadow, and a **company label**:
- **Cardboard Certs:** kraft-brown label, simple type, red grade.
- **Summit:** blue label with a mountain logo.
- **Apex:** white label with a bold red Apex logo and a **huge grade number**, the iconic one.
- **Blackline:** black label with silver text and 4 sub-grades. A **Black Label** 10 has gold text and a special holographic sticker.

### 5.5 Packs, boxes & products
- **Booster pack:** foil wrapper (SVG silhouette with crimped ends), pack-art creature, set logo, "10 CARDS", Glimmerkin logo, and a foil sheen. There are 3–4 art variants per set.
- **Booster box and ECB:** box art compositions with the set logo and "36 BOOSTER PACKS", reused as 3D textures in the shop.
- **Promo stamps and misprints:** visual treatments (miscut shifts the frame, ink error smears color, missing foil means no foil layers, wrong back shows a different brand's back).

---

## 6. Creature Art **(Q2: decided, Clay Critters for all cards, ADR-006)**

Every card needs a charming, consistent creature illustration, and we need **hundreds** of them. The system is **genome-based**. Each species is defined once as data (a "genome"), and card art is composed from genome × pose × expression × background × composition. Evolutions inherit their parent's genome (same palette and key features, bigger and fancier), so lines look related.

### 6.1 Candidate styles (both are prototyped in the Art Spike)

| | **A · "Clay Critters"** ✅ *chosen for all card art* | **B · "Sticker Pop"** *(prototyped, not chosen, removed)* |
|---|---|---|
| Look | Soft 3D "vinyl toy / claymation" creatures with glossy eyes, rim light, soft shadows and AO | Bold-outline 2D vector with cel shading, like premium stickers |
| Technique | Signed-distance-field (SDF) creatures ray-marched in a WebGL shader. Smooth unions give organic, cute shapes | Parametric SVG part library (bodies, heads, ears, tails, wings…) |
| Strengths | Looks rendered and premium, forgiving shapes, consistent lighting, matches the toy-diorama world, easy dramatic lighting for rares | Tiny files, razor sharp, classic card-art feel, cheap to render at runtime |
| Risks | Rendering cost (solved by pre-rendering curated sets; runtime render with caching for procedural sets) | Can look "clip-art" if proportions drift. Needs strong part design |

### 6.2 Composition by rarity
- **Standard art window:** creature in a readable pose, 3/4 view, with a biome background (per element: volcano dawn, lagoon, forest glade, storm plains, canyon, aurora sky, moonlit ruins, ice cave, meadow).
- **Holo:** the same with more dynamic lighting. The foil does the rest.
- **Nova and Ultra:** action pose, dramatic rim light, element VFX (embers, bubbles, sparks, petals, snow).
- **Illustration Rare:** full-bleed **story scene** (wide shot, environment-first, a painterly post-filter). A set's IRs form a narrative sequence.
- **Secret and Mythic:** hero composition, gold or cosmic lighting, particles, and for Mythic an animated parallax layer in the inspect view.
- **Ally cards:** Peg-folk characters (the same models as the shop) rendered in portrait poses. Our regulars and Theo appear here.

### 6.3 Output
Curated sets are **pre-rendered** to WebP (art window ~512×360, full art ~700×980) by a build script and committed with generator version and seed. Procedural Set Forge sets render **at runtime** into an IndexedDB cache using the same shader, so the look is identical. User-supplied art can **override** any card via the art registry (`08 §4`).

---

## 7. Manga Covers
Procedural cover templates per series: palette, title typography (display font plus stylized treatment), layout family (big character silhouette, action diagonal, pastel frame and so on), volume number badge, publisher logo and spine design. Covers use the **Peg-folk** style and **SDF** props so they stay consistent with the world, with a few generated variations per volume (pose, color accent, background motif). Spines on shelves are generated from the same template.

---

## 8. UI Art ("Chunky & Tactile")
- **Panels:** paper or cardboard surfaces with rounded corners (12–20px), **thick 3px `--ink` outlines** and **hard offset shadows** (`0 4px 0 --ink`). Themed variants: *clipboard* (orders), *tablet* (market, supplier apps), *leather binder* (collection), *blueprint* (build mode), *corkboard* (goals), *receipt* (day summary).
- **Buttons:** physical keys. They press down 3px on click with a squash animation. Primary is teal, money actions sun-gold, destructive coral.
- **Stickers and stamps** as motif: "NEW!", "HOT", "SOLD!", "DEAL!", "1st ED", rarity gems, price tags (handwritten Caveat on a string tag).
- **Icons:** a custom SVG game-icon set (drawn by us) for game concepts (pack, box, slab, binder, grade, rep star, XP, etc.). Generic UI icons come from **Lucide** (ISC) or **Phosphor** (MIT).
- **Textures:** subtle paper grain, wood and leather generated with SVG filters or canvas noise, never heavy images.

---

## 9. VFX Catalog
| Moment | Effect |
|--------|--------|
| Sale | Coins arc from the register to the HUD cash counter, which pulses and rolls up |
| Pack tear | Foil shards and a crinkle wave |
| Rarity reveal | Edge glow in rarity color → flip → light beams (color and count by rarity) · Secret: gold burst · Mythic: slow-mo, star rain, screen flash, crown stamp |
| God Pack | Unique "divine" sequence: pack glows gold before tearing and choir particles |
| Level up | Full-width banner, confetti, radial rays, new-unlock cards fly into the dock |
| Grade reveal | Bubble wrap pops, the slab rotates in, the label flips up. 10: fireworks. Black Label: gold smoke and a slow reveal |
| Customer emotions | Hearts (delight), steam puffs (angry), "!" pulse (needs attention), sweat drop (impatient) |
| Construction | Dust puffs, hammer "tink" sparks, scaffold wipe transition |
| Market spike | Ticker flash green or red and a pulsing badge on the market app |

**Screen shake** is used sparingly (big hits only) and can be disabled. **Reduced-motion mode** replaces shakes and flashes with gentle fades.

---

## 10. Logos & Branding
- **Foil & Fortune** (game logo): chunky Lilita One letterforms with an **animated foil fill**, a fanned trio of cards behind the ampersand, and a coin as the "o" in *Fortune*. It's also used on the shop's neon sign in the diorama.
- **Glimmerkin** wordmark: rounded, playful type with a spark over the "i".
- **Set logos:** each has a unique emblem (set symbol) plus stylized title treatment.
- **Grading company, supplier and rival logos:** simple, distinct marks. None imitate real companies.

---

## 11. Audio Direction

### 11.1 Music
- **Style:** cozy **lo-fi / jazzy chillhop** by day, mellower in the evening, and a warm nostalgic title theme. Special cues cover release-day hype (upbeat), card shows (busy funk), auctions (tension), rainy days and night summaries.
- **Adaptive:** the intensity layer rises with crowd size. New "stems" are added as the shop tier grows, so bigger shops sound busier and richer.
- **Sources:** curated **CC0** tracks (candidates in `08 §3`) or procedurally generated loops (Tone.js) as a fallback. **Q15** covers taste.

### 11.2 Sound effects (≈ 60 at v1.0)
Door bell · footsteps (soft) · register beep and *cha-ching* · coin clinks (S/M/L) · bill counting · paper rustle · **pack tear (crinkly foil)** · card slide, flip and snap · holo shimmer · **rarity stingers** (6 ascending tiers) · Mythic fanfare · slab crack · bubble-wrap pops · stamp thud · box open and tape rip · delivery truck · phone buzz · UI pops, ticks and toggles · gentle error · level-up jingle · achievement chime · crowd murmur · rain ambience · construction montage · gavel · applause.
**Voices:** no recorded voice. Each character "speaks" in **blip-speech** (pitch and timbre per character, syllable rhythm from the text), cute and language-agnostic.

### 11.3 Mix
Channels: Master · Music · SFX · Voices · Ambience (separate sliders). Music **ducks** under big reveals. Rarity stingers are never masked. The loudness target is about −16 LUFS integrated for music.

---

## 12. Accessibility in Art
- Rarity is conveyed by **shape, label and color**. Element by **symbol and color**.
- Contrast: UI text ≥ 4.5:1 on panels. Speech bubbles use `--ink` on white.
- **Colorblind mode** adjusts rarity and element palettes and adds patterns to charts.
- **Reduced motion** covers foil, shakes, flashes and parallax.
- Text-size setting (90–150%) with layouts that reflow.
