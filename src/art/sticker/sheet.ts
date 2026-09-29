import type { Path, Pt } from './core/path';
import { el } from './core/svg';

/**
 * Collects the creature's pieces with a paint order (`z`) and the "mass" shapes that form the
 * silhouette. The silhouette is drawn once, behind everything, as the die-cut border and the
 * bold outer outline, so overlapping parts merge into one clean sticker shape.
 */
export class Sheet {
  private readonly pieces: { z: number; order: number; svg: string }[] = [];
  readonly silhouette: Path[] = [];
  private transform: { deg: number; pivot: Pt } | null = null;

  put(z: number, svg: string, ...silhouette: readonly Path[]): void {
    if (!svg && !silhouette.length) return;
    const t = this.transform;
    const wrapped =
      t && svg
        ? el('g', { transform: `rotate(${t.deg.toFixed(2)} ${t.pivot[0]} ${t.pivot[1]})` }, svg)
        : svg;
    this.pieces.push({ z, order: this.pieces.length, svg: wrapped });
    for (const s of silhouette) this.silhouette.push(t ? s.rotate(t.deg, t.pivot) : s);
  }

  /** Everything put inside `draw` is rotated around `pivot` (head tilt). */
  rotated<T>(deg: number, pivot: Pt, draw: () => T): T {
    const previous = this.transform;
    this.transform = { deg, pivot };
    try {
      return draw();
    } finally {
      this.transform = previous;
    }
  }

  render(): string {
    return [...this.pieces]
      .sort((a, b) => a.z - b.z || a.order - b.order)
      .map((p) => p.svg)
      .join('');
  }
}

/** Paint order of creature parts (back → front). */
export const Z = {
  farGill: 6,
  tail: 10,
  farLeg: 20,
  farEar: 24,
  body: 30,
  nearHind: 40,
  nearFront: 50,
  ruff: 52,
  gill: 55,
  ear: 57,
  head: 60,
  face: 70,
  headTop: 74,
  frontEar: 80,
  fx: 90,
} as const;
