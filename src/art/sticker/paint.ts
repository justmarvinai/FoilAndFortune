import type { ColorRef, CreatureGenome } from '@/content/schema/genome';
import { adjust, light, lineOf, mix, shade } from './core/color';

/** The genome palette resolved to hex colors, plus the derived tones the part kit needs. */
export interface Paint {
  primary: string;
  secondary: string;
  accent: string;
  belly: string;
  eyes: string;
  glow: string;
  ref(c: ColorRef): string;
  /** Limbs/ears on the far side of the body sit in the form's shadow: a step darker (depth cue). */
  far(hex: string): string;
  /** Colored detail line (fur tufts, creases) for a fill. */
  line(hex: string): string;
  light(hex: string, lift?: number): string;
  shade(hex: string, depth?: number): string;
  mix(a: string, b: string, t: number): string;
  /** Warm pink blush that sits well on any skin tone. */
  blush: string;
  /** Mouth interior and tongue. */
  mouth: string;
  tongue: string;
}

export function createPaint(genome: CreatureGenome): Paint {
  const p = genome.palette;
  const ref = (c: ColorRef): string => {
    switch (c) {
      case 'primary':
        return p.primary;
      case 'secondary':
        return p.secondary;
      case 'accent':
        return p.accent;
      case 'belly':
        return p.belly;
      case 'glow':
        return p.glow;
    }
  };
  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    belly: p.belly,
    eyes: p.eyes,
    glow: p.glow,
    ref,
    far: (hex) => shade(hex, 0.07),
    line: lineOf,
    light,
    shade,
    mix,
    blush: mix('#FF6F8E', p.primary, 0.18),
    mouth: adjust(mix('#7A1F3D', p.eyes, 0.35), { c: 1.1 }),
    tongue: '#FF8FA3',
  };
}
