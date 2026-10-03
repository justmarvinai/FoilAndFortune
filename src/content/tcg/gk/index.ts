import type { CardDef, PackConfigDef, ProductDef, SetDef } from '@/content/schema/tcg';
import { emberdawn, emberdawnCards, emberdawnProducts, gkModernBooster } from './sets/emberdawn';
import { essenceCards, essenceSet } from './sets/essence';
import { promoCards, promoSet } from './sets/promo';

/** All Glimmerkin TCG content in one place for the registry (docs/06 §12). */
export const gkSets: readonly SetDef[] = [emberdawn, essenceSet, promoSet];
export const gkCards: readonly CardDef[] = [...emberdawnCards, ...essenceCards, ...promoCards];
export const gkPackConfigs: readonly PackConfigDef[] = [gkModernBooster];
export const gkProducts: readonly ProductDef[] = emberdawnProducts;
