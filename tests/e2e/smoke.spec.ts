import { expect, test } from './fixtures';

/** Every Phase 1 screen boots and renders its header without errors. */
const ROUTES = [
  { path: '/', heading: 'Foil & Fortune' },
  { path: '/debug/ui', heading: 'UI Kit Gallery' },
  { path: '/debug/engine', heading: 'Engine Sandbox' },
  { path: '/debug/art', heading: 'Card Art Spike' },
] as const;

for (const route of ROUTES) {
  test(`${route.path} renders without errors`, async ({ page, errors }) => {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('unknown routes fall back to the hub', async ({ page }) => {
  await page.goto('/definitely/not/a/page');
  await expect(page.getByRole('heading', { level: 1, name: 'Foil & Fortune' })).toBeVisible();
});

test('pages run under the production CSP', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text());
  });
  await page.goto('/');
  // Guards the fixture itself: if the header weren't applied, every "no errors" check above
  // would pass without proving anything about Vercel. (Playwright's own `evaluate` is exempt
  // from CSP, so the probe injects a real inline <script>, which the policy must block.)
  const inlineRan = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const flag = window as Window & { __inlineRan?: boolean };
        flag.__inlineRan = false;
        const script = document.createElement('script');
        script.textContent = 'window.__inlineRan = true';
        document.head.append(script);
        setTimeout(() => resolve(flag.__inlineRan ?? false), 100);
      }),
  );
  expect(inlineRan).toBe(false);
  expect(violations).toHaveLength(1);
});
