import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { type Group, MeshStandardMaterial, Vector3 } from 'three';
import { setArtStyle, wrapperVariant } from '@/art/packs/setStyles';
import { getRegistry } from '@/content/registry';
import type { FixtureSlot } from '@/sim/state/types';
import { useGame } from '@/state/gameStore';
import { signTexture } from '../fixtures/signs';
import { useSceneLabels } from '../labels';
import { BlobShadow } from '../lib/blobShadow';
import { lerp } from '../lib/easing';
import { cylinder, plane, roundedBox, sphere } from '../lib/geometry';
import { toyMaterial, vertexColorMaterial } from '../lib/materials';
import { cachedMerge, type Part } from '../lib/merge';
import { useDioramaRuntime } from '../runtime';
import { tones } from '../scenePalette';
import { useLiveRuntime } from './liveRuntime';
import { ProductInstances, type ProductUnit } from './ProductInstances';
import { productRect, unitVariant } from './productAtlas';
import {
  type ProductShape,
  SHELF_RISER,
  type SlotCell,
  shapeForKind,
  shelfSlotCells,
  slotGrid,
  slotUnits,
  visibleUnits,
} from './slotLayout';

/**
 * The Small Wall Shelf (`fx.shelf.wall-small`, docs/01 §7.3) driven by its slots: two columns of
 * cubbies, laid out like the Fixture Popover's grid, each showing exactly the units in stock, so
 * shelves visibly empty as customers pick and fill back up on restock (with a shimmer).
 *
 * Local frame: origin on the floor at the shelf's centre, back against the wall (−z), front +z.
 */
export const SHELF = {
  width: 1.9,
  depth: 0.42,
  /** Board tops, bottom first: each holds one row of cubbies. */
  levels: [0.155, 0.68] as const,
  cubby: 0.48,
  height: 1.25,
} as const;

/** Open booster display boxes (counter displays) that packs stand in. */
const TRAY = { floor: 0.016, wall: 0.016, lip: 0.075, flap: 0.2, inset: 0.022 } as const;

const BOARD = 0.045;
const SIDE = 0.07;
const DIVIDER = 0.05;
const INNER = {
  width: SHELF.width - SIDE * 2,
  depth: SHELF.depth - 0.05,
  frontZ: SHELF.depth / 2 - 0.01,
};

const NO_SLOTS: readonly FixtureSlot[] = [];

export function shelfCells(count: number): SlotCell[] {
  return shelfSlotCells(count, INNER, SHELF.levels, SHELF.cubby);
}

function shelfFrame(slotCount: number) {
  return cachedMerge(`live-shelf:${slotCount}`, () => {
    const { width, depth, height } = SHELF;
    const frame = tones.wood;
    const parts: Part[] = [
      // Sides, back panel, kick base and crown.
      ...[-1, 1].map<Part>((side) => ({
        geometry: roundedBox(SIDE, height, depth, 0.028, 3),
        color: frame,
        position: [side * (width / 2 - SIDE / 2), height / 2, 0],
      })),
      {
        geometry: roundedBox(width - 0.1, height - 0.1, 0.03, 0.01, 1),
        color: tones.indigoPanel,
        position: [0, height / 2, -depth / 2 + 0.02],
      },
      {
        geometry: roundedBox(width - 0.08, 0.13, depth - 0.07, 0.02, 2),
        color: tones.woodDark,
        position: [0, 0.065, 0.015],
      },
      {
        geometry: roundedBox(width + 0.08, 0.09, depth + 0.05, 0.035, 3),
        color: frame,
        position: [0, height - 0.02, 0.012],
      },
      // Middle divider between the two columns.
      {
        geometry: roundedBox(
          DIVIDER,
          SHELF.levels[1] + SHELF.cubby - SHELF.levels[0],
          depth - 0.06,
          0.015,
          2,
        ),
        color: frame,
        position: [0, (SHELF.levels[0] + SHELF.levels[1] + SHELF.cubby) / 2, 0.01],
      },
    ];
    for (const level of [...SHELF.levels, SHELF.levels[1] + SHELF.cubby]) {
      parts.push({
        geometry: roundedBox(INNER.width + 0.02, BOARD, depth - 0.05, 0.018, 2),
        color: frame,
        position: [0, level - BOARD / 2, 0.005],
      });
    }
    for (const cell of shelfCells(slotCount)) {
      // A price-tag lip along the front of each cubby.
      parts.push(
        {
          geometry: roundedBox(cell.width + 0.03, 0.05, 0.022, 0.01, 1),
          color: tones.trim,
          position: [cell.x, cell.y - 0.012, depth / 2 - 0.02],
        },
        {
          geometry: roundedBox(0.09, 0.034, 0.008, 0.004, 1),
          color: tones.sun,
          position: [cell.x, cell.y - 0.012, depth / 2 - 0.006],
        },
      );
    }
    // Two gooseneck lamps on the crown, aimed at the product.
    for (const x of [-width * 0.28, width * 0.28]) {
      parts.push(
        {
          geometry: cylinder(0.012, 0.012, 0.16, 8),
          color: tones.iron,
          position: [x, height + 0.06, depth / 2 - 0.02],
        },
        {
          geometry: cylinder(0.012, 0.012, 0.2, 8),
          color: tones.iron,
          position: [x, height + 0.13, depth / 2 + 0.08],
          rotation: [Math.PI / 2, 0, 0],
        },
        {
          geometry: cylinder(0.035, 0.075, 0.09, 16, true),
          color: tones.teal,
          position: [x, height + 0.1, depth / 2 + 0.2],
        },
      );
    }
    return parts;
  });
}

/** Where a slot's units stand: inside its display box for packs, else on the board. */
function unitCell(cell: SlotCell, shape: ProductShape): SlotCell {
  if (shape !== 'pack') return cell;
  return {
    ...cell,
    y: cell.y + TRAY.floor,
    width: cell.width - TRAY.inset * 2,
    depth: cell.depth - TRAY.inset * 2,
  };
}

/**
 * Slot dressing: a booster slot gets an open display box in its set's colours (packs stand in it,
 * and an empty one plainly says "sold out"); slots with several rows get a step at the back so
 * the back row shows over the front one.
 */
function dressingParts(slots: readonly FixtureSlot[]): {
  key: string;
  empty: boolean;
  build: () => Part[];
} {
  const registry = getRegistry();
  const cells = shelfCells(slots.length);
  const specs: { cell: SlotCell; tray: { body: string; flap: string; rim: string } | null }[] = [];
  const keys: string[] = [];
  slots.forEach((slot, index) => {
    const product = slot.productId ? registry.products.get(slot.productId) : undefined;
    const cell = cells[index];
    if (!product || !cell) return;
    const shape = shapeForKind(product.kind);
    if (shape === 'pack') {
      const style = setArtStyle(product.setId ? registry.sets.get(product.setId) : undefined);
      const v = wrapperVariant(style, 0);
      const tray = { body: v.bottom, flap: v.mid, rim: style.band };
      specs.push({ cell, tray });
      keys.push(`${index}:tray:${tray.body}${tray.flap}${tray.rim}`);
    } else if (slotGrid(shape, product.perShelfSlot, cell).rows > 1) {
      specs.push({ cell, tray: null });
      keys.push(`${index}:step`);
    }
  });
  return {
    key: `live-shelf-dressing:${slots.length}:${keys.join('|')}`,
    empty: specs.length === 0,
    build: () => {
      const parts: Part[] = [];
      for (const { cell, tray } of specs) {
        const inner = unitCell(cell, tray ? 'pack' : 'box');
        const stepDepth = inner.depth * 0.42;
        const stepY = inner.y + SHELF_RISER / 2;
        const stepZ = inner.z - inner.depth / 2 + stepDepth / 2;
        if (!tray) {
          parts.push({
            geometry: roundedBox(inner.width, SHELF_RISER, stepDepth, 0.008, 1),
            color: tones.walnutLight,
            position: [inner.x, stepY, stepZ],
          });
          continue;
        }
        const w = cell.width;
        const d = cell.depth;
        const { floor, wall, lip, flap } = TRAY;
        parts.push(
          {
            geometry: roundedBox(w, floor, d, 0.006, 1),
            color: tray.body,
            position: [cell.x, cell.y + floor / 2, cell.z],
          },
          // Front lip, sides and the inner step for the back row.
          {
            geometry: roundedBox(w, lip, wall, 0.006, 1),
            color: tray.body,
            position: [cell.x, cell.y + lip / 2, cell.z + d / 2 - wall / 2],
          },
          {
            geometry: roundedBox(w - 0.03, 0.014, wall + 0.002, 0.004, 1),
            color: tray.rim,
            position: [cell.x, cell.y + lip - 0.012, cell.z + d / 2 - wall / 2],
          },
          ...[-1, 1].map<Part>((side) => ({
            geometry: roundedBox(wall, lip, d, 0.006, 1),
            color: tray.body,
            position: [cell.x + side * (w / 2 - wall / 2), cell.y + lip / 2, cell.z],
          })),
          {
            geometry: roundedBox(inner.width, SHELF_RISER, stepDepth, 0.006, 1),
            color: tray.body,
            position: [inner.x, stepY, stepZ],
          },
          // The back flap, folded up behind the packs with a band of the set's trade dress.
          {
            geometry: roundedBox(w, flap, wall, 0.008, 1),
            color: tray.flap,
            position: [cell.x, cell.y + flap / 2 + 0.01, cell.z - d / 2 + wall / 2],
            rotation: [-0.12, 0, 0],
          },
          {
            geometry: roundedBox(w - 0.05, 0.05, wall + 0.004, 0.006, 1),
            color: tray.rim,
            position: [cell.x, cell.y + flap * 0.78, cell.z - d / 2 + wall / 2 + 0.011],
            rotation: [-0.12, 0, 0],
          },
        );
      }
      return parts;
    },
  };
}

interface SlotStock {
  shape: ProductShape;
  units: ProductUnit[];
  capacity: number;
}

/** The units to draw per shape, from the slots' stock. */
function stockUnits(slots: readonly FixtureSlot[], seed: number): Map<ProductShape, SlotStock> {
  const registry = getRegistry();
  const cells = shelfCells(slots.length);
  const byShape = new Map<ProductShape, SlotStock>();
  slots.forEach((slot, index) => {
    const product = slot.productId ? registry.products.get(slot.productId) : undefined;
    const cell = cells[index];
    if (!product || !cell) return;
    const shape = shapeForKind(product.kind);
    const capacity = product.perShelfSlot;
    const layout = slotUnits(shape, capacity, unitCell(cell, shape), seed * 31 + index * 7 + 1);
    const shown = visibleUnits(slot.qty, capacity);
    let entry = byShape.get(shape);
    if (!entry) {
      entry = { shape, units: [], capacity: 0 };
      byShape.set(shape, entry);
    }
    for (let i = 0; i < shown; i++) {
      const unit = layout[i];
      if (unit) entry.units.push({ ...unit, rect: productRect(product.id, unitVariant(shape, i)) });
    }
  });
  // Capacity per shape: enough for every slot full of the biggest product of that shape.
  for (const entry of byShape.values()) entry.capacity = Math.max(16, slots.length * 12);
  return byShape;
}

/** Slot centre in fixture-local space (for the restock shimmer). */
function cellCenter(cell: SlotCell): Vector3 {
  return new Vector3(cell.x, cell.y + 0.18, cell.z + 0.05);
}

export function WallShelf({ uid, seed }: { uid: string; seed: number }) {
  const runtime = useDioramaRuntime();
  const live = useLiveRuntime();
  const labels = useSceneLabels();
  const slots = useGame<readonly FixtureSlot[]>(
    (game) => game.shop.fixtures.find((f) => f.uid === uid)?.slots ?? NO_SLOTS,
    NO_SLOTS,
  );
  const groupRef = useRef<Group>(null);
  const stock = stockUnits(slots, seed);
  const frame = shelfFrame(slots.length);
  const dressing = dressingParts(slots);
  const dressingGeometry = dressing.empty ? null : cachedMerge(dressing.key, dressing.build);

  // Restock shimmer: sparkles over every slot whose stock went up (not on first mount).
  const previous = useRef<number[] | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = slots.map((slot) => slot.qty);
    const group = groupRef.current;
    if (!before || !group || live.reducedMotion) return;
    const cells = shelfCells(slots.length);
    slots.forEach((slot, index) => {
      const cell = cells[index];
      if (!cell || slot.qty <= (before[index] ?? 0)) return;
      const at = group.localToWorld(cellCenter(cell));
      live.particles.push({ kind: 'sparkle', position: at, count: 7, spread: 0.32 });
    });
  }, [slots, live]);

  const [header] = useState(
    () =>
      new MeshStandardMaterial({
        map: signTexture(labels.shelfHeader, tones.sun, tones.coral),
        roughness: 0.5,
      }),
  );
  const [bulb] = useState(
    () =>
      new MeshStandardMaterial({ color: tones.trim, emissive: tones.sun, emissiveIntensity: 0.6 }),
  );
  useFrame(() => {
    bulb.emissiveIntensity = lerp(0.5, 2.6, runtime.evening);
  });

  const { width, depth, height } = SHELF;
  return (
    <group ref={groupRef}>
      <BlobShadow radius={width * 0.55} stretch={[1, 0.3]} opacity={0.35} position={[0, 0, 0.05]} />
      <mesh
        geometry={frame}
        material={vertexColorMaterial({ roughness: 0.6 })}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={roundedBox(width * 0.56, 0.28, 0.05, 0.03, 2)}
        material={toyMaterial(tones.woodDark)}
        position={[0, height + 0.15, 0.08]}
        castShadow
      />
      <mesh
        geometry={plane(width * 0.55, 0.27)}
        material={header}
        position={[0, height + 0.15, 0.106]}
      />
      {[-width * 0.28, width * 0.28].map((x) => (
        <mesh
          key={x}
          geometry={sphere(0.03, 10, 8)}
          material={bulb}
          position={[x, height + 0.075, depth / 2 + 0.2]}
        />
      ))}
      {dressingGeometry ? (
        <mesh
          geometry={dressingGeometry}
          material={vertexColorMaterial({ roughness: 0.55 })}
          castShadow
          receiveShadow
        />
      ) : null}
      {[...stock.values()].map((entry) => (
        <ProductInstances
          key={entry.shape}
          shape={entry.shape}
          units={entry.units}
          capacity={entry.capacity}
          castShadow={entry.shape !== 'pack'}
        />
      ))}
    </group>
  );
}
