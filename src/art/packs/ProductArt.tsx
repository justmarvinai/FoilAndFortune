import { useId } from 'react';
import { getRegistry } from '@/content/registry';
import { ART_BOX, artShape, productArtSvg } from './productArt';

export interface ProductArtProps {
  productId: string;
  /** Wrapper variant (boosters rotate through the set's creatures). */
  variant?: number;
  /** Rendered height: pixels or any CSS length. Width follows the art's aspect ratio. */
  height?: number | string;
  /** Accessible name. Without it the art is decorative (`aria-hidden`). */
  label?: string;
  /** Force the small-render detail level; by default it's picked from a numeric `height`. */
  detail?: 'full' | 'icon';
  className?: string;
}

/** Below this rendered height fine print is dropped (it would be mush anyway). */
const ICON_BELOW_PX = 72;

/**
 * Inline product art (docs/04 §5.5). Inlining keeps the self-hosted display font and stays crisp
 * at any size; each instance gets its own id prefix because inline SVGs share the page's ids.
 */
export function ProductArt({
  productId,
  variant = 0,
  height = 96,
  label,
  detail,
  className = '',
}: ProductArtProps) {
  const prefix = `pa${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const registry = getRegistry();
  const product = registry.products.get(productId);
  if (!product) return null;
  const set = product.setId ? registry.sets.get(product.setId) : undefined;
  const brand = product.brandId ? registry.brands.get(product.brandId)?.name : undefined;
  const cardsPerPack = product.packConfigId
    ? registry.packConfigs.get(product.packConfigId)?.cardsPerPack
    : undefined;
  const level =
    detail ?? (typeof height === 'number' && height < ICON_BELOW_PX ? 'icon' : ('full' as const));
  const svg = productArtSvg(product, set, {
    variant,
    idPrefix: prefix,
    brandName: brand,
    cardsPerPack,
    detail: level,
  });
  const box = ART_BOX[artShape(product.kind)];
  const style = { height, aspectRatio: `${box.width} / ${box.height}` };
  const classes = `inline-block shrink-0 align-middle [&>svg]:block [&>svg]:overflow-visible ${className}`;
  const markup = { __html: svg };
  return label ? (
    <span
      className={classes}
      style={style}
      role="img"
      aria-label={label}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markup from our own pure composer; every text node is XML-escaped (src/art/packs/svg.ts).
      dangerouslySetInnerHTML={markup}
    />
  ) : (
    <span
      className={classes}
      style={style}
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markup from our own pure composer; every text node is XML-escaped (src/art/packs/svg.ts).
      dangerouslySetInnerHTML={markup}
    />
  );
}
