/* Automated accessibility audit (axe-core, WCAG 2.x A/AA rules) of key pages. Not a substitute for a manual audit. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { registerNewUser } from './fixtures';

const audit = async (page: import('@playwright/test').Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) console.log(JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2));
  expect(serious).toEqual([]);
};

test('public pages have no serious/critical axe violations', async ({ page }) => {
  for (const p of ['/', '/features', '/how-it-works', '/technology', '/privacy-security', '/faq', '/contact', '/login', '/register']) {
    await page.goto(p);
    await audit(page);
  }
});

test('app pages have no serious/critical axe violations', async ({ page }) => {
  await registerNewUser(page);
  for (const p of ['/app', '/app/scan', '/app/bills', '/app/analytics', '/app/categories', '/app/settings']) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    await audit(page);
  }
});
