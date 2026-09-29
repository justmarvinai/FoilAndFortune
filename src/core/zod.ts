import { z } from 'zod';

/**
 * The one place Zod is imported. Our Content-Security-Policy (vercel.json) forbids eval, so
 * Zod's JIT is switched off before any schema exists. That also skips its `new Function` probe,
 * which a strict CSP reports as a violation even though Zod catches it.
 * Biome's `noRestrictedImports` keeps every other module importing `z` from here.
 */
z.config({ jitless: true });

export type { ZodType } from 'zod';
export { z };
