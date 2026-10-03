import { ProductArt } from '@/art/packs/ProductArt';

/**
 * The one place the stage draws sealed-product art (docs/04 §5.5), so a different wrapper
 * renderer (e.g. a 3D or rasterized one) can be swapped in without touching the choreography.
 */
export function ProductArtAdapter({
  productId,
  variant = 0,
  height,
  label,
}: {
  productId: string;
  variant?: number;
  height: number | string;
  label?: string;
}) {
  return (
    <ProductArt
      productId={productId}
      variant={variant}
      height={height}
      label={label}
      detail="full"
    />
  );
}
