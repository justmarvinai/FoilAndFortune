import { type ColorRepresentation, DoubleSide, FrontSide, MeshStandardMaterial } from 'three';

/**
 * Shared "painted toy" materials (docs/04 §4.3): matte-satin plastics with roughness 0.55–0.8.
 * Materials are cached by their parameters so identical looks share one shader program and
 * state. Anything whose parameters animate (neon, bulbs, fading walls) must create its own
 * instance instead of using these.
 */
const cache = new Map<string, MeshStandardMaterial>();

export interface ToyOptions {
  roughness?: number;
  metalness?: number;
  emissive?: ColorRepresentation;
  emissiveIntensity?: number;
  doubleSide?: boolean;
  envMapIntensity?: number;
}

export function toyMaterial(
  color: ColorRepresentation,
  options: ToyOptions = {},
): MeshStandardMaterial {
  const {
    roughness = 0.62,
    metalness = 0,
    emissive = '#000000',
    emissiveIntensity = 1,
    doubleSide = false,
    envMapIntensity = 1,
  } = options;
  const key = `${String(color)}|${roughness}|${metalness}|${String(emissive)}|${emissiveIntensity}|${doubleSide}|${envMapIntensity}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const material = new MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    envMapIntensity,
    side: doubleSide ? DoubleSide : FrontSide,
  });
  cache.set(key, material);
  return material;
}

/** Material for merged, vertex-coloured fixture geometry (`mergeParts`). */
export function vertexColorMaterial(options: ToyOptions = {}): MeshStandardMaterial {
  const { roughness = 0.64, metalness = 0, envMapIntensity = 1 } = options;
  const key = `vc|${roughness}|${metalness}|${envMapIntensity}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness,
    envMapIntensity,
  });
  cache.set(key, material);
  return material;
}
