import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useState } from 'react';
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { ROOM, type WallOpening } from '../layout';
import { cachedTexture, liveCanvasTexture } from '../lib/canvas';
import { plane, roundedBox } from '../lib/geometry';
import { vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';
import { windowViewTexture } from './windowView';

/**
 * A window in a wall opening (wall-local frame, +z into the room): chunky frame, mullions,
 * a deep sill for plants and cats, a scalloped valance, and a painted outside view that
 * crossfades with the time of day.
 */
interface WindowProps {
  opening: WallOpening;
  view: 'west' | 'south';
  /** Items standing on the sill (sill-top frame: origin at the sill's centre, top surface). */
  sill?: ReactNode;
  frameColor?: string;
  valanceColor?: string;
}

const T = ROOM.wallThickness;

function valanceTexture(color: string) {
  return cachedTexture(`valance:${color}`, () =>
    liveCanvasTexture(512, 96, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const scallops = 9;
      const sw = w / scallops;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h * 0.55);
      for (let i = scallops - 1; i >= 0; i--) {
        ctx.arc(i * sw + sw / 2, h * 0.55, sw / 2, 0, Math.PI, false);
      }
      ctx.closePath();
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 === 0 ? color : '#FFF6E5';
        ctx.fillRect((i * w) / 16, 0, w / 16 + 1, h);
      }
      ctx.fillStyle = 'rgba(30,35,64,0.18)';
      ctx.fillRect(0, 0, w, 10);
      ctx.restore();
    }),
  );
}

export function ShopWindow({
  opening,
  view,
  sill,
  frameColor = tones.trim,
  valanceColor = tones.coral,
}: WindowProps) {
  const runtime = useDioramaRuntime();
  const { center, width, bottom, top } = opening;
  const height = top - bottom;
  const frame = cachedMerge(`window:${center}:${width}:${bottom}:${top}:${frameColor}`, () => {
    const f = 0.08;
    const parts: Part[] = [
      // Casing on the inner face.
      {
        geometry: roundedBox(f, height + f * 2, 0.05, 0.02, 2),
        color: frameColor,
        position: [center - width / 2 - f / 2, bottom + height / 2, 0.02],
      },
      {
        geometry: roundedBox(f, height + f * 2, 0.05, 0.02, 2),
        color: frameColor,
        position: [center + width / 2 + f / 2, bottom + height / 2, 0.02],
      },
      {
        geometry: roundedBox(width + f * 2 + 0.04, f + 0.02, 0.06, 0.025, 2),
        color: frameColor,
        position: [center, top + f / 2, 0.025],
      },
      // Deep sill with an apron below.
      {
        geometry: roundedBox(width + f * 2 + 0.1, 0.05, T + 0.22, 0.02, 2),
        color: tones.maple,
        position: [center, bottom - 0.005, 0.11 - T / 2],
      },
      {
        geometry: roundedBox(width + f * 2 - 0.04, 0.07, 0.03, 0.012, 1),
        color: frameColor,
        position: [center, bottom - 0.065, 0.02],
      },
      // Mullions, set in the wall thickness.
      {
        geometry: roundedBox(0.045, height, 0.05, 0.012, 1),
        color: frameColor,
        position: [center, bottom + height / 2, -T / 2],
      },
      {
        geometry: roundedBox(width, 0.045, 0.05, 0.012, 1),
        color: frameColor,
        position: [center, bottom + height * 0.58, -T / 2],
      },
      // Sash frame against the glass.
      {
        geometry: roundedBox(width, 0.05, 0.06, 0.015, 1),
        color: frameColor,
        position: [center, bottom + 0.025, -T / 2],
      },
      {
        geometry: roundedBox(width, 0.05, 0.06, 0.015, 1),
        color: frameColor,
        position: [center, top - 0.025, -T / 2],
      },
      {
        geometry: roundedBox(0.05, height, 0.06, 0.015, 1),
        color: frameColor,
        position: [center - width / 2 + 0.025, bottom + height / 2, -T / 2],
      },
      {
        geometry: roundedBox(0.05, height, 0.06, 0.015, 1),
        color: frameColor,
        position: [center + width / 2 - 0.025, bottom + height / 2, -T / 2],
      },
    ];
    return parts;
  });
  const [glass] = useState(
    () =>
      new MeshStandardMaterial({
        color: '#DDF2FF',
        transparent: true,
        opacity: 0.14,
        roughness: 0.05,
        metalness: 0.2,
        envMapIntensity: 2,
        depthWrite: false,
      }),
  );
  const viewDay = useMemo(
    () => new MeshBasicMaterial({ map: windowViewTexture(view, 'day') }),
    [view],
  );
  const viewEve = useMemo(
    () =>
      new MeshBasicMaterial({
        map: windowViewTexture(view, 'evening'),
        transparent: true,
        opacity: 0,
      }),
    [view],
  );
  const valance = useMemo(
    () =>
      new MeshStandardMaterial({
        map: valanceTexture(valanceColor),
        alphaTest: 0.5,
        roughness: 0.9,
      }),
    [valanceColor],
  );
  useFrame(() => {
    viewEve.opacity = runtime.evening;
    viewEve.visible = runtime.evening > 0.001;
  });

  // Backdrop card behind the window. Looking down at 35° through the glass, the view lands
  // ~0.6 m lower on a card 0.65 m back, so the card sits low: it then also stays hidden behind
  // the wall from outside. Wide enough for the 45° azimuth at every camera angle.
  const backW = width + 1.4;
  const backBottom = Math.max(0.1, bottom - 0.75);
  const backTop = top - 0.45;
  const backH = backTop - backBottom;
  return (
    <group>
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.5 })}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={plane(width - 0.05, height - 0.05)}
        material={glass}
        position={[center, bottom + height / 2, -T / 2 - 0.01]}
        renderOrder={5}
      />
      <group position={[center, backBottom + backH / 2, -T - 0.45]}>
        <mesh geometry={plane(backW, backH)} material={viewDay} />
        <mesh geometry={plane(backW, backH)} material={viewEve} position-z={0.002} />
      </group>
      <mesh
        geometry={plane(width + 0.2, 0.2)}
        material={valance}
        position={[center, top - 0.06, 0.06]}
      />
      <group position={[center, bottom + 0.02, 0.06]}>{sill}</group>
    </group>
  );
}
