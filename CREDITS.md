# Credits & Third-Party Assets

Every asset that isn't self-made must be listed here **in the same commit that adds it** (policy: `docs/08_ASSET_PIPELINE.md §1`). Only CC0 / Public Domain, OFL (fonts) and MIT / ISC / Apache-2.0 (code, icons) are allowed without extra approval. The in-game Credits screen is generated from this list (`src/content/credits.ts`).

## Assets in use
All creature art, card frames, foils, the card back, the 3D shop and its characters are **self-made in code** (procedural). Only fonts and UI icons come from third parties. License texts ship with the game in `public/licenses/`.

| Asset / pack | Author | Source | License | Files / usage | Added |
|--------------|--------|--------|---------|---------------|-------|
| Lilita One (font) | Juan Montoreano | `@fontsource/lilita-one` 5.3.0 | OFL-1.1 | Display font (titles, buttons) · `licenses/lilita-one-OFL.txt` | 2026-09-29 |
| Nunito (variable font) | The Nunito Project Authors | `@fontsource-variable/nunito` 5.3.0 | OFL-1.1 | UI body font · `licenses/nunito-OFL.txt` | 2026-09-29 |
| Barlow (font) | The Barlow Project Authors | `@fontsource/barlow` 5.3.0 | OFL-1.1 | Card body text · `licenses/barlow-OFL.txt` | 2026-09-29 |
| Barlow Condensed (font) | The Barlow Project Authors | `@fontsource/barlow-condensed` 5.3.0 | OFL-1.1 | Card names and stats · `licenses/barlow-condensed-OFL.txt` | 2026-09-29 |
| Caveat (variable font) | The Caveat Project Authors | `@fontsource-variable/caveat` 5.3.0 | OFL-1.1 | Handwritten notes · `licenses/caveat-OFL.txt` | 2026-09-29 |
| Atkinson Hyperlegible (font) | Braille Institute of America, Inc. | `@fontsource/atkinson-hyperlegible` 5.3.0 | OFL-1.1 | Legibility font (receipts, logs, accessibility option) · `licenses/atkinson-hyperlegible-OFL.txt` | 2026-09-29 |
| Lucide icons | Lucide Icons and Contributors | `lucide-react` 1.48.0 | ISC | UI icons · `licenses/lucide-ISC.txt` | 2026-09-29 |

## Third-party code (adapted, permissive licenses)
Short snippets adapted into our shaders. Their license notices ship in `public/licenses/third-party-code.txt` (and `apache-2.0.txt`) and are marked at each use site.

| Code | Author | Source | License | Where | Added |
|------|--------|--------|---------|-------|-------|
| SDF primitives (ellipsoid bound, exact round cone, quadratic Bézier distance) and polynomial smooth-min | Inigo Quilez | iquilezles.org/articles/distfunctions and the author's Shadertoy examples | MIT | `src/art/clay/shaders/common.ts` | 2026-09-29 |
| "Hash without Sine" (`hash11`/`hash12`/`hash22`) | David Hoskins | shadertoy.com/view/4djSRW | MIT | `src/art/clay/shaders/common.ts` | 2026-09-29 |
| PBR Neutral tone mapper | The Khronos Group Inc. | github.com/KhronosGroup/ToneMapping | Apache-2.0 | `src/art/clay/shaders/common.ts` | 2026-09-29 |

## Candidate sources (researched, not yet used)
| Source | Content of interest | License |
|--------|---------------------|---------|
| Kenney (kenney.nl) | Furniture Kit, Mini Characters, UI and Interface audio, Casino Audio (card sounds), Impact Sounds, Particle Pack | CC0 |
| Quaternius (quaternius.com) | Ultimate Monsters (50 animated monsters), Universal Animation Library | CC0 |
| KayKit by Kay Lousberg (itch.io) | Furniture Bits, Restaurant Bits, City Builder Bits | CC0 |
| Poly Haven / ambientCG | HDRIs, PBR textures | CC0 |
| Open-Lofi (GitHub) · HoliznaCC0 (Free Music Archive) · FreePD | Lo-fi and general music | CC0 |
| Phosphor | Extra UI icons | MIT |
