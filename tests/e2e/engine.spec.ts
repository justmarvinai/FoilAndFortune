import { expect, test } from './fixtures';

/**
 * The engine sandbox end to end: new game → open → close → next day (autosave) → manual save →
 * reload → continue → export → import. Exercises the store, GameLoop, sim and save system.
 */
test('play a day, save, reload and continue', async ({ page, errors }) => {
  await page.goto('/debug/engine');

  await page.getByLabel('Shop name').fill('E2E Emporium');
  await page.getByRole('button', { name: 'Open the shop' }).click();
  await expect(page.getByText('Morning prep')).toBeVisible();
  await expect(page.getByText('Mon · Spring 8 · Y1')).toBeVisible();

  await page.getByRole('button', { name: 'Open shop', exact: true }).click();
  await expect(page.getByText('OPEN', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Skip to closing' }).click();
  await expect(page.getByText('After hours')).toBeVisible();

  await page.getByRole('button', { name: 'Start next day' }).click();
  await expect(page.getByText('Tue · Spring 9 · Y1')).toBeVisible();

  // The dawn autosave lands in the ring.
  const autosave = page
    .getByRole('listitem')
    .filter({ has: page.getByText('Autosave', { exact: true }) });
  await expect(autosave).toContainText('E2E Emporium');
  await expect(autosave).toContainText('Day 2');

  // Theo's stocked shelf sells during the day, so a level-up toast may still cover the slot list
  // on short screens: let it auto-dismiss first.
  await expect(page.getByRole('button', { name: /Level \d+!/ })).toHaveCount(0, {
    timeout: 15_000,
  });
  const slot1 = page.getByRole('listitem').filter({ hasText: 'Slot 1' });
  await slot1.getByRole('button', { name: 'Save' }).click();
  await expect(slot1).toContainText('Day 2');

  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Tue · Spring 9 · Y1')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('e2e-emporium-day-2.ffsave');

  await page.locator('input[type="file"]').setInputFiles(await download.path());
  await expect(page.getByText('Backup imported')).toBeVisible();

  expect(errors).toEqual([]);
});

test('the sim rejects a bad price with a friendly message', async ({ page }) => {
  await page.goto('/debug/engine');
  await page.getByRole('button', { name: 'Open the shop' }).click();

  const price = page.getByLabel('Price of Emberdawn Booster Pack');
  await price.fill('abc');
  await price.press('Enter');
  await expect(page.getByText("That price doesn't look right.")).toBeVisible();
  await expect(price).toHaveValue('4.49');

  await price.fill('5.25');
  await price.press('Enter');
  await expect(price).toHaveValue('5.25');
});
