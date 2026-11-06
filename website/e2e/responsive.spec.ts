/* Mobile viewport checks: navigation, no horizontal overflow, bottom nav. */
import { expect, test } from '@playwright/test';
import { registerNewUser, shot } from './fixtures';

const noOverflow = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

test('mobile: marketing menu and pages fit the screen', async ({ page }) => {
  await page.goto('/');
  await noOverflow(page);
  await shot(page, 'm01_home_mobile');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Features' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Features' })).toBeVisible();
  await noOverflow(page);
});

test('mobile: app uses bottom navigation without overflow', async ({ page }) => {
  await registerNewUser(page);
  const bottom = page.getByRole('navigation', { name: 'App navigation (mobile)' });
  await expect(bottom).toBeVisible();
  await noOverflow(page);
  await bottom.getByRole('link', { name: 'Scan' }).click();
  await expect(page.getByRole('heading', { name: 'Scan a bill' })).toBeVisible();
  await noOverflow(page);
  await shot(page, 'm02_scan_mobile');
  for (const p of ['/app/bills', '/app/analytics', '/app/settings', '/app/categories']) {
    await page.goto(p);
    await noOverflow(page);
  }
});
