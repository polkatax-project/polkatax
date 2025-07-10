import { Page } from '@playwright/test';

export const mockCountry = async (page: Page, country: string) => {
  await page.route('https://ipinfo.io/json', async (route) => {
    await route.fulfill({ json: { country } });
  });
};
