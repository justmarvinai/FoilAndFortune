import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  LatheGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Shared, cached primitive geometries. Every chunky part of the diorama is built from a handful
 * of these, so caching keeps GPU memory tiny and lets identical parts share buffers.
 *
 * Cached geometries are never disposed: they are small and reused across remounts. Geometries
 * passed to `<mesh geometry={…}>` are not auto-disposed by R3F, so sharing is safe.
 */
const cache = new Map<string, BufferGeometry>();

function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  const hit = cache.get(key);
  if (hit) return hit;
  const geometry = make();
  cache.set(key, geometry);
  return geometry;
}

const q = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Rounded box, the workhorse of the soft-chunky look (docs/04 §4.2): no razor edges anywhere.
 * `radius` is clamped by three to half the smallest side.
 */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius = 0.03,
  segments = 3,
): BufferGeometry {
  return cached(`rbox:${q(width)}:${q(height)}:${q(depth)}:${q(radius)}:${segments}`, () => {
    const geometry = new RoundedBoxGeometry(width, height, depth, segments, radius);
    return geometry;
  });
}

/** Plain box for tiny parts (cards, spines) where rounded edges would be sub-pixel anyway. */
export function box(width: number, height: number, depth: number): BufferGeometry {
  return cached(
    `box:${q(width)}:${q(height)}:${q(depth)}`,
    () => new BoxGeometry(width, height, depth),
  );
}

/** Capsule whose *total* height is `height` (three's CapsuleGeometry takes the middle length). */
export function capsule(
  radius: number,
  height: number,
  capSegments = 6,
  radialSegments = 16,
  heightSegments = 1,
): BufferGeometry {
  const key = `capsule:${q(radius)}:${q(height)}:${capSegments}:${radialSegments}:${heightSegments}`;
  return cached(key, () => {
    const length = Math.max(0.0001, height - radius * 2);
    return new CapsuleGeometry(radius, length, capSegments, radialSegments, heightSegments);
  });
}

export function sphere(radius: number, widthSegments = 24, heightSegments = 16): BufferGeometry {
  return cached(`sphere:${q(radius)}:${widthSegments}:${heightSegments}`, () => {
    return new SphereGeometry(radius, widthSegments, heightSegments);
  });
}

/** Partial sphere shell, used for face decals, hair caps and lamp shades. Angles in radians. */
export function sphereSection(
  radius: number,
  phiStart: number,
  phiLength: number,
  thetaStart: number,
  thetaLength: number,
  widthSegments = 24,
  heightSegments = 16,
): BufferGeometry {
  const key = `sphsec:${q(radius)}:${q(phiStart)}:${q(phiLength)}:${q(thetaStart)}:${q(thetaLength)}:${widthSegments}:${heightSegments}`;
  return cached(key, () => {
    return new SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength,
    );
  });
}

export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments = 20,
  openEnded = false,
): BufferGeometry {
  return cached(
    `cyl:${q(radiusTop)}:${q(radiusBottom)}:${q(height)}:${radialSegments}:${openEnded}`,
    () => new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, openEnded),
  );
}

/** A pie-slice of a cylinder (cap brims, half-round shelves). Theta 0 points at +z. */
export function cylinderSector(
  radius: number,
  height: number,
  thetaStart: number,
  thetaLength: number,
  radialSegments = 20,
): BufferGeometry {
  return cached(
    `cylsec:${q(radius)}:${q(height)}:${q(thetaStart)}:${q(thetaLength)}:${radialSegments}`,
    () =>
      new CylinderGeometry(
        radius,
        radius,
        height,
        radialSegments,
        1,
        false,
        thetaStart,
        thetaLength,
      ),
  );
}

export function torus(
  radius: number,
  tube: number,
  radialSegments = 10,
  tubularSegments = 32,
  arc = Math.PI * 2,
): BufferGeometry {
  return cached(
    `torus:${q(radius)}:${q(tube)}:${radialSegments}:${tubularSegments}:${q(arc)}`,
    () => new TorusGeometry(radius, tube, radialSegments, tubularSegments, arc),
  );
}

export function plane(width: number, height: number): BufferGeometry {
  return cached(`plane:${q(width)}:${q(height)}`, () => new PlaneGeometry(width, height));
}

export function circle(radius: number, segments = 48): BufferGeometry {
  return cached(`circle:${q(radius)}:${segments}`, () => new CircleGeometry(radius, segments));
}

/**
 * Lathe from a 2D profile of `[radius, y]` points (bottom to top). `key` names the profile so
 * pots, bells and shades each build once.
 */
export function lathe(
  key: string,
  profile: readonly (readonly [number, number])[],
  segments = 28,
): BufferGeometry {
  return cached(`lathe:${key}:${segments}`, () => {
    const points = profile.map(([r, y]) => new Vector2(r, y));
    return new LatheGeometry(points, segments);
  });
}
