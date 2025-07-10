import { test, expect } from '@playwright/test';
import { mockSubscanChainList } from './util/mock-subscan-chain-list';

test.describe('Navigation within the app', () => {
  test('navigate to wallet', async ({ page }) => {
    mockSubscanChainList(page);
    await page.goto('http://localhost:9000');
    await expect(page).toHaveTitle('PolkaTax');
    await page.getByTestId('launch-button').click();
    await expect(page.getByTestId('title')).toHaveText('Wallets');

    await page.goto('http://localhost:9000');
    await expect(page).toHaveTitle('PolkaTax');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByTestId('launch-button2').click();
    await expect(page.getByTestId('title')).toHaveText('Wallets');
  });

  test('navigate to tutorial', async ({ page }) => {
    await mockSubscanChainList(page);
    await page.goto('http://localhost:9000');
    await expect(page).toHaveTitle('PolkaTax');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('a[href="/tutorial-faq"]').click();
    await expect(page.getByTestId('title')).toHaveText('Tutorial & FAQ');
  });

  test('navigate via header menu', async ({ page }) => {
    await mockSubscanChainList(page);
    await page.goto('http://localhost:9000/wallets');
    await expect(page.getByTestId('title')).toHaveText('Wallets');
    await page.locator('header a[href="/tutorial-faq"]').click();
    await expect(page.getByTestId('title')).toHaveText('Tutorial & FAQ');
    await page.locator('header a[href="/wallets"]').click();
    await expect(page.getByTestId('title')).toHaveText('Wallets');
  });
});
