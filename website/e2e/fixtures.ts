import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURES = path.resolve(here, '..', '..', 'evaluation', 'synthetic_smoke', 'images');
export const fixture = (name: string) => {
  const p = path.join(FIXTURES, name);
  if (!fs.existsSync(p)) throw new Error(`Missing fixture ${p}. Run: npm run fixtures:synthetic`);
  return p;
};
export const SHOTS = path.resolve(here, '..', '..', 'assets', 'screenshots');
export async function shot(page: Page, name: string) {
  if (!process.env.E2E_SCREENSHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

let n = 0;
export async function registerNewUser(page: Page) {
  const email = `e2e${Date.now()}${n++}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Name').fill('Priya Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('e2e strong pass 2026');
  await page.getByLabel('Confirm password').fill('e2e strong pass 2026');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app$/);
  return email;
}

export async function uploadAndWait(page: Page, file: string) {
  await page.goto('/app/scan');
  await page.locator('input[type=file][multiple]').setInputFiles(file);
  await page.getByRole('button', { name: /Upload & process/ }).click();
  await expect(page).toHaveURL(/\/app\/scan\/[0-9a-f-]{36}$/);
}
