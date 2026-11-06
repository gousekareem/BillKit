/* Journeys A–F from the website brief, against the real backend + real OCR pipeline. */
import { expect, test } from '@playwright/test';
import { fixture, registerNewUser, shot, uploadAndWait } from './fixtures';

test.describe.configure({ mode: 'serial' });

test('Journey A: Home → Get Started → Register → Dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Every bill, in your pocket.' })).toBeVisible();
  await shot(page, '01_home');
  await page.getByRole('link', { name: /Get started/ }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await shot(page, '02_register');
  await registerNewUser(page);
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Priya/ })).toBeVisible();
  await expect(page.getByText('No bills yet')).toBeVisible(); // honest empty state, no fake data
  await shot(page, '03_dashboard_empty');
});

test('Journey B: Upload bill → Process → Review → Correct → Save → History', async ({ page }) => {
  await registerNewUser(page);
  await page.goto('/app/scan');
  await expect(page.getByRole('heading', { name: 'Scan a bill' })).toBeVisible();
  await shot(page, '04_scan');
  await page.locator('input[type=file][multiple]').setInputFiles(fixture('S01_syn_grocery_inr_photo_on_table.jpg'));
  await expect(page.getByRole('img', { name: 'Page 1 preview' })).toBeVisible();
  await page.getByRole('button', { name: /Upload & process/ }).click();
  await expect(page.getByRole('heading', { name: 'Processing your bill' }).or(page.getByRole('heading', { name: 'Review bill' }))).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review bill' })).toBeVisible({ timeout: 60_000 });
  const merchant = page.getByLabel(/^Merchant/);
  await expect(merchant).toHaveValue('GREENLEAF FRESH MART');
  await expect(page.getByLabel(/^Total amount/)).toHaveValue('1275');
  await expect(page.getByLabel(/^Bill date/)).toHaveValue('2026-10-14');
  await expect(page.getByLabel(/^Category/)).toHaveValue('Groceries');
  await page.getByLabel(/^Total amount/).focus();
  await shot(page, '05_review');
  // Correct the merchant name
  await merchant.fill('Greenleaf Fresh Mart');
  await expect(page.locator('.field-row').filter({ has: merchant }).getByText('You corrected')).toBeVisible();
  // Confirm any flagged key fields (approval policy)
  for (const cb of await page.getByLabel('I checked this value against the bill').all()) await cb.check();
  await page.getByRole('button', { name: /Approve & save/ }).click();
  await expect(page).toHaveURL(/\/app\/bills\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Greenleaf Fresh Mart' })).toBeVisible();
  await expect(page.getByText('You corrected').first()).toBeVisible();
  await shot(page, '06_bill_detail');
  await page.getByRole('link', { name: 'Bill history' }).first().click();
  await expect(page.getByText('1 verified bill')).toBeVisible();
  await shot(page, '07_history');
});

test('Journey C: Upload selfie → Classification → Polite rejection', async ({ page }) => {
  await registerNewUser(page);
  await uploadAndWait(page, fixture('S11_nonbill_selfie_or_photo.jpg'));
  await expect(page.getByRole('heading', { name: 'This doesn’t look like a bill' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/photograph rather than a bill/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'It is a bill — process anyway' })).toBeVisible();
  await shot(page, '08_rejected_selfie');
  await uploadAndWait(page, fixture('S12_nonbill_id_card.png'));
  await expect(page.getByText(/identity document/)).toBeVisible({ timeout: 60_000 });
});

test('Journey D: History → Search → Open bill → Edit → Save', async ({ page }) => {
  await registerNewUser(page);
  await uploadAndWait(page, fixture('S03_syn_restaurant_inr_perspective.jpg'));
  await expect(page.getByRole('heading', { name: 'Review bill' })).toBeVisible({ timeout: 60_000 });
  for (const cb of await page.getByLabel('I checked this value against the bill').all()) await cb.check();
  await page.getByRole('button', { name: /Approve & save/ }).click();
  await expect(page).toHaveURL(/\/app\/bills\//);
  await page.goto('/app/bills');
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill('spice');
  await page.getByRole('textbox', { name: 'Search', exact: true }).press('Enter');
  await expect(page).toHaveURL(/q=spice/);
  await page.getByRole('link', { name: /SPICE COURTYARD/ }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Notes').fill('Team dinner');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('Entertainment');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Entertainment' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Team dinner' })).toBeVisible();
});

test('Journey E: Dashboard → Analytics → Category filter', async ({ page }) => {
  await registerNewUser(page);
  await uploadAndWait(page, fixture('S05_syn_electricity_inr_clean.png'));
  await expect(page.getByRole('heading', { name: 'Review bill' })).toBeVisible({ timeout: 60_000 });
  for (const cb of await page.getByLabel('I checked this value against the bill').all()) await cb.check();
  await page.getByRole('button', { name: /Approve & save/ }).click();
  await expect(page).toHaveURL(/\/app\/bills\//);
  await page.goto('/app');
  await expect(page.getByText('Saved bills')).toBeVisible();
  await shot(page, '09_dashboard');
  await page.getByRole('link', { name: 'Analytics' }).first().click();
  await expect(page.getByRole('heading', { name: 'Expense analytics' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Category' }).selectOption('Utilities');
  await expect(page.getByText(/Spending over the last 12 months/)).toBeVisible();
  await shot(page, '10_analytics');
  await page.getByRole('combobox', { name: 'Category' }).selectOption('Travel');
  await expect(page.getByText('Nothing to analyse yet')).toBeVisible();
});

test('Journey F: Settings → Export → Delete account', async ({ page }) => {
  await registerNewUser(page);
  await page.goto('/app/settings');
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
  await shot(page, '11_settings');
  await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/api/bills/export.csv');
  const csv = await page.request.get('/api/bills/export.csv');
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-disposition']).toMatch(/attachment; filename="billkit-bills-.*\.csv"/);
  expect(await csv.text()).toContain('merchant_name');
  const json = await page.request.get('/api/bills/export.json');
  expect((await json.json()).format).toBe('billkit-export/1');
  await page.getByRole('combobox', { name: 'Default currency' }).selectOption('USD');
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByLabel('Enter your password to confirm').fill('e2e strong pass 2026');
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
});

test('Public pages render, contact form submits honestly, unknown routes 404', async ({ page }) => {
  for (const [path, heading] of ([['/features', 'Features'], ['/how-it-works', 'How BillKit works'], ['/technology', 'AI & technology'], ['/privacy-security', 'Privacy & security'], ['/about', 'About BillKit'], ['/faq', 'Frequently asked questions'], ['/legal/privacy', 'Privacy policy']] as Array<[string, string]>)) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await expect(page.getByText('© 2026 Shaik Gouse Kareem. All rights reserved.').first()).toBeVisible();
  await page.goto('/contact');
  await page.getByLabel('Name').fill('Visitor');
  await page.getByLabel('Email').fill('visitor@example.com');
  await page.getByLabel('Subject').fill('Question');
  await page.getByLabel('Message').fill('Does BillKit support PDF invoices?');
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(/stored on this BillKit server/)).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
