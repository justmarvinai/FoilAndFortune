import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

/**
 * `vite preview` doesn't apply `vercel.json`, so the fixture adds the production
 * Content-Security-Policy to every page. Anything that would break on Vercel (eval, inline
 * scripts, external requests) fails here as a console error.
 */
const vercel = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig;
const csp = vercel.headers
  .flatMap((rule) => rule.headers)
  .find((header) => header.key === 'Content-Security-Policy')?.value;
if (!csp) throw new Error('vercel.json has no Content-Security-Policy header');

export const test = base.extend<{ errors: string[] }>({
  page: async ({ page }, use) => {
    await page.route(
      (url) => url.origin === 'http://localhost:4173',
      async (route) => {
        if (!route.request().isNavigationRequest()) return route.continue();
        const response = await route.fetch();
        return route.fulfill({
          response,
          headers: { ...response.headers(), 'content-security-policy': csp },
        });
      },
    );
    await use(page);
  },
  /** Uncaught page errors and console errors (CSP violations included). */
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    await use(errors);
  },
});

export { expect };
