import { expect, test } from './fixtures';

/**
 * "Day one" (ROADMAP Phase 2 done-when): a new player opens Theo's stocked shop, serves a real
 * customer from the simulation at the register, closes up, reads the receipt and starts Tuesday.
 * Everything runs through the real sim, the live 3D shop (low quality for software WebGL) and the
 * game shell; nothing is mocked.
 */
test('day one: open the shop, ring up a customer, close and start Tuesday', async ({
  page,
  errors,
}) => {
  test.setTimeout(240_000);
  await page.goto('/?quality=low');
  await page.getByRole('button', { name: /^New Game/ }).click();
  const form = page.getByRole('dialog', { name: 'Shop Registration' });
  await form.getByLabel('Shop name').fill('Day One Cards');
  await form.getByRole('button', { name: 'Next' }).click();
  await form.getByRole('button', { name: 'Next' }).click();
  await form.getByRole('button', { name: 'Sign & stamp' }).click();
  await page.waitForURL('**/play');

  // Theo left the first shelf stocked: flip the sign and run the day at 4×.
  await page.getByRole('button', { name: 'Flip the sign to OPEN and start the day' }).click();
  await expect(page.getByRole('button', { name: 'Close the shop early' })).toBeVisible();
  await page.keyboard.press('3');

  // A customer browses, picks something and waits at the pay spot: ring them up.
  const ringUp = page.getByRole('button', { name: 'Ring up the customer at the register' });
  await expect(ringUp).toBeVisible({ timeout: 150_000 });
  await ringUp.click();
  await expect(page.getByText('First sale of the day!')).toBeVisible({ timeout: 15_000 });

  // Close up; the receipt counts the customer and the takings.
  await page.getByRole('button', { name: 'Close the shop early' }).click();
  await page.getByRole('button', { name: 'Close shop' }).click();
  const receipt = page.getByRole('dialog', { name: 'Day Summary' });
  await expect(receipt).toBeVisible();
  await receipt
    .getByRole('button', { name: 'Show all' })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
  await expect(receipt.getByText('Customers served')).toBeVisible({ timeout: 20_000 });
  await expect(receipt.getByText('Tomorrow (Tue)')).toBeVisible({ timeout: 20_000 });

  // Day two begins.
  await receipt.getByRole('button', { name: 'Next Day' }).click();
  await expect(
    page.getByRole('button', { name: 'Flip the sign to OPEN and start the day' }),
  ).toBeVisible();
  await expect(page.getByText('Tue', { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});
