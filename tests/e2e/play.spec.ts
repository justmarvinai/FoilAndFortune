import { expect, test } from './fixtures';

/**
 * The game shell end to end (docs/05 §2–3, §5.1–5.2, §5.17): title → New Game form → signed and
 * stamped → the shop; the door sign opens the day and the clock runs; shortcuts toggle sheets and
 * Esc backs out; closing prints the receipt and Next Day starts Tuesday; Continue restores the
 * shop after a reload. `?quality=low` keeps software WebGL light once the real diorama lands.
 */
test.describe('play screen', () => {
  // Long flows over the live 3D shop, which is slow on software WebGL (CI has no GPU).
  test.describe.configure({ timeout: 180_000 });

  test('new game, open the shop, sheets and Esc, then continue after a reload', async ({
    page,
    errors,
  }) => {
    await page.goto('/?quality=low');
    await expect(page.getByRole('heading', { level: 1, name: 'Foil & Fortune' })).toBeVisible();
    // A fresh browser has no save: New Game is the hero card and there is no Continue.
    await expect(page.getByRole('button', { name: /^Continue/ })).toHaveCount(0);

    await page.getByRole('button', { name: /^New Game/ }).click();
    const form = page.getByRole('dialog', { name: 'Shop Registration' });
    await expect(form).toBeVisible();
    await form.getByLabel('Shop name').fill('E2E Emporium');
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByRole('radio', { name: /Cozy/ }).click();
    await expect(form.getByRole('radio', { name: /Cozy/ })).toHaveAttribute('aria-checked', 'true');
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByRole('button', { name: 'Sign & stamp' }).click();
    await expect(form.getByText('APPROVED')).toBeVisible();

    await page.waitForURL('**/play');
    const sign = page.getByRole('button', { name: 'Flip the sign to OPEN and start the day' });
    await expect(sign).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Shop tools' })).toBeVisible();
    const clock = page.getByRole('timer');
    await expect(clock).toHaveText('08:00');

    // The door sign opens the shop and the clock starts running.
    await sign.click();
    await expect(page.getByRole('button', { name: 'Close the shop early' })).toBeVisible();
    // The first frames of the 3D shop are slow on software WebGL (CI has no GPU).
    await expect(clock).toHaveText(/^09:(0[1-9]|[1-5]\d)$/, { timeout: 45_000 });

    // Shortcuts toggle sheets; Esc closes the top layer, then opens Settings (the pause menu).
    await page.keyboard.press('i');
    await expect(page.getByRole('dialog', { name: 'Stock' })).toBeVisible();
    await page.keyboard.press('o');
    await expect(page.getByRole('dialog', { name: 'Crate' })).toBeVisible();
    await page.keyboard.press('o');
    await expect(page.getByRole('dialog', { name: 'Crate' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Binder' }).click();
    await expect(page.getByRole('dialog', { name: 'Binder' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Binder' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);

    // Space pauses, 2 picks double speed.
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: 'Pause' })).toBeChecked();
    await page.keyboard.press('2');
    await expect(page.getByRole('radio', { name: 'Fast (2×)' })).toBeChecked();

    // The new shop was saved right away: after a reload, Continue brings it back.
    await page.goto('/?quality=low');
    const continueCard = page.getByRole('button', { name: /^Continue/ });
    await expect(continueCard).toContainText('E2E Emporium');
    await expect(continueCard).toContainText('Day 1');
    await continueCard.click();
    await page.waitForURL('**/play');
    await expect(page.getByText('Welcome back to E2E Emporium!')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Emporium' })).toBeAttached();

    expect(errors).toEqual([]);
  });

  test('closing early prints the receipt and Next Day starts Tuesday', async ({ page, errors }) => {
    await page.goto('/?quality=low');
    await page.getByRole('button', { name: /^New Game/ }).click();
    const form = page.getByRole('dialog', { name: 'Shop Registration' });
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByRole('button', { name: 'Sign & stamp' }).click();
    await page.waitForURL('**/play');

    await page.getByRole('button', { name: 'Flip the sign to OPEN and start the day' }).click();
    await page.getByRole('button', { name: 'Close the shop early' }).click();
    // The confirmation focuses the safe choice; then close for real.
    await expect(page.getByRole('button', { name: 'Keep open' })).toBeFocused();
    await page.getByRole('button', { name: 'Close shop' }).click();

    const receipt = page.getByRole('dialog', { name: 'Day Summary' });
    await expect(receipt).toBeVisible();
    // "Show all" skips the printing animation; it unmounts once the receipt has printed, so the
    // click is best-effort and the assertions below wait for the printed lines either way.
    await receipt
      .getByRole('button', { name: 'Show all' })
      .click({ timeout: 2_000 })
      .catch(() => undefined);
    await expect(receipt.getByText('Customers served')).toBeVisible({ timeout: 20_000 });
    await expect(receipt.getByText('Tomorrow (Tue)')).toBeVisible({ timeout: 20_000 });

    // Tuck the receipt away for night tasks; the HUD keeps a Next Day key.
    await receipt.getByRole('button', { name: 'Night tasks first' }).click();
    await expect(receipt).toHaveCount(0);
    await page.getByRole('button', { name: 'Start the next day' }).click();
    await expect(
      page.getByRole('button', { name: 'Flip the sign to OPEN and start the day' }),
    ).toBeVisible();
    await expect(page.getByText('Tue', { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
