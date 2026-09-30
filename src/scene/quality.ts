/**
 * Render quality presets (docs/06 §7 "Quality presets"). Every knob that costs GPU time lives
 * here so the three tiers stay easy to compare and tune. Light counts and shadow casting never
 * change *within* a tier at runtime, because toggling them recompiles every shader (a hitch).
 */
export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Device-pixel-ratio range handed to the Canvas. */
  dpr: [number, number];
  /** Native MSAA on the default framebuffer (only useful when there is no post chain). */
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** PCF blur radius in shadow-map texels (three r186 Vogel-disk PCF). */
  shadowRadius: number;
  /** Post-processing chain on/off; the effects below only apply when true. */
  post: boolean;
  /** MSAA samples on the composer's render target (0 = rely on SMAA). */
  multisampling: number;
  ao: null | {
    halfRes: boolean;
    quality: 'performance' | 'low' | 'medium' | 'high';
    radius: number;
    intensity: number;
  };
  /**
   * Bloom follows the time of day: by day only true emissives may glow (sunlit plaster must not
   * haze over), at evening the threshold drops so lamps, neon and string lights bloom.
   */
  bloom: null | {
    day: { intensity: number; threshold: number };
    evening: { intensity: number; threshold: number };
    smoothing: number;
  };
  smaa: boolean;
  vignette: boolean;
  /** The miniature "tilt-shift" depth-of-field look. */
  tiltShift: boolean;
  /** Real refraction (transmission pass) for display-case glass instead of fake glass. */
  physicalGlass: boolean;
  /** Iridescent foil sheen on booster packs (MeshPhysicalMaterial). */
  iridescentFoil: boolean;
  /** Cube resolution of the procedural Lightformer environment. */
  envResolution: number;
  /** Floating dust motes in the window light. */
  dustMotes: number;
  /**
   * Extra point lights beyond the two pendants (lamp post, shelf spots). Fixed per tier: each
   * point light costs every lit fragment, and changing the count recompiles shaders.
   */
  accentLights: boolean;
}

export const qualityPresets: Record<QualityLevel, QualityPreset> = {
  low: {
    dpr: [1, 1],
    antialias: true,
    shadows: false,
    shadowMapSize: 512,
    shadowRadius: 1,
    post: false,
    multisampling: 0,
    ao: null,
    bloom: null,
    smaa: false,
    vignette: false,
    tiltShift: false,
    physicalGlass: false,
    iridescentFoil: false,
    envResolution: 64,
    dustMotes: 0,
    accentLights: false,
  },
  medium: {
    dpr: [1, 1.5],
    antialias: false,
    shadows: true,
    shadowMapSize: 1024,
    shadowRadius: 3,
    post: true,
    multisampling: 0,
    ao: { halfRes: true, quality: 'performance', radius: 0.45, intensity: 2.2 },
    bloom: {
      day: { intensity: 0.35, threshold: 2.2 },
      evening: { intensity: 0.8, threshold: 0.85 },
      smoothing: 0.3,
    },
    smaa: true,
    vignette: true,
    tiltShift: false,
    physicalGlass: false,
    iridescentFoil: false,
    envResolution: 128,
    dustMotes: 24,
    accentLights: true,
  },
  high: {
    dpr: [1, 2],
    antialias: false,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 4,
    post: true,
    multisampling: 4,
    ao: { halfRes: false, quality: 'medium', radius: 0.5, intensity: 2.6 },
    bloom: {
      day: { intensity: 0.45, threshold: 2.0 },
      evening: { intensity: 0.95, threshold: 0.8 },
      smoothing: 0.3,
    },
    smaa: true,
    vignette: true,
    tiltShift: true,
    physicalGlass: true,
    iridescentFoil: true,
    envResolution: 256,
    dustMotes: 40,
    accentLights: true,
  },
};
