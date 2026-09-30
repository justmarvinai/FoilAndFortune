import { useMemo } from 'react';
import { type CanvasTexture, MeshBasicMaterial } from 'three';
import { cachedTexture, liveCanvasTexture } from './canvas';
import { circle } from './geometry';

/** Soft radial "contact shadow" texture, shared by every blob shadow. */
function blobTexture(): CanvasTexture {
  return cachedTexture('blob-shadow', () =>
    liveCanvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(30, 35, 64, 0.9)');
      g.addColorStop(0.45, 'rgba(30, 35, 64, 0.55)');
      g.addColorStop(1, 'rgba(30, 35, 64, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }),
  );
}

interface BlobShadowProps {
  radius: number;
  opacity?: number;
  position?: readonly [number, number, number];
  /** Non-uniform footprint (x, z) for oblong things like benches. */
  stretch?: readonly [number, number];
}

/**
 * Cheap grounding shadow: a transparent disc just above the floor. Always on (it is the only
 * shadow on Low quality) and it doubles as fake contact AO under feet and fixtures on the others.
 */
export function BlobShadow({
  radius,
  opacity = 0.35,
  position = [0, 0, 0],
  stretch = [1, 1],
}: BlobShadowProps) {
  const material = useBlobMaterial(opacity);
  return (
    <mesh
      geometry={circle(1, 32)}
      material={material}
      position={[position[0], position[1] + 0.006, position[2]]}
      rotation-x={-Math.PI / 2}
      scale={[radius * stretch[0], radius * stretch[1], 1]}
      renderOrder={1}
    />
  );
}

export function useBlobMaterial(opacity: number): MeshBasicMaterial {
  return useMemo(
    () =>
      new MeshBasicMaterial({
        map: blobTexture(),
        transparent: true,
        depthWrite: false,
        opacity,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [opacity],
  );
}
