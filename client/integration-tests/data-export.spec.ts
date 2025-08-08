import { test, expect, Page } from '@playwright/test';
import { mockSubscanChainList } from './util/mock-subscan-chain-list';
import { WsWrapper } from './util/WsWrapper';
import { mockCountry } from './util/mock-country';
import { mockRewards } from './util/mock-rewards';

/**
 * Deactivated for now...
 */
test.skip('Wallet', () => {
  let wsWrapper: WsWrapper;

  const mockRewardsAndNavigateToDetails = async (page: Page) => {
    page.on('console', (msg: any) => {
      console.log(`Browser log: ${msg.type()}: ${msg.text()}`);
    });

    wsWrapper = new WsWrapper();

    await mockCountry(page, 'IT');
    await mockSubscanChainList(page);
    await page.goto('http://localhost:9000/wallets');
    await page.fill(
      '[data-testid="wallet-input"]',
      '14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1'
    );
    await page.click('[data-testid="submit"]');
    await wsWrapper.waitForNMessages(1);
    wsWrapper.send({
      type: 'data',
      reqId: '123',
      payload: [
        {
          reqId: '123',
          wallet: '14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1',
          blockchain: 'kusama',
          type: 'staking_rewards',
          status: 'done',
          currency: 'EUR',
          syncFromDate: 1703980800000,
          data: mockRewards,
        },
      ],
    });

    const rows = page.locator('[data-testid="wallet-data-table"] tr');
    await expect(rows).toHaveCount(2);
    await page
      .getByText('14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1')
      .click();
    await expect(page.getByTestId('title')).toHaveText('Connected Blockchains');
    const blockchainRows = page.locator(
      '[data-testid="connected-chains-data-table"] tr'
    );
    await expect(blockchainRows).toHaveCount(2);
    await page.getByText('Kusama').click();
    await expect(page.getByTestId('summary-blockchain')).toHaveText('Kusama');
  };

  const expectExport = async (
    page: Page,
    testId: string,
    filePattern: RegExp
  ) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(testId).click(),
    ]);

    await expect(await download.suggestedFilename()).toMatch(filePattern);
  };

  test('Pdf Export', async ({ page }) => {
    await mockRewardsAndNavigateToDetails(page);
    await expectExport(page, 'pdfExport', /\.pdf$/);
  });

  test('CSV Export', async ({ page }) => {
    await mockRewardsAndNavigateToDetails(page);
    await expectExport(page, 'csvExport', /\.csv$/);
  });

  test('Koinly Export', async ({ page }) => {
    await mockRewardsAndNavigateToDetails(page);
    await expectExport(page, 'koinlyExport', /\.csv$/);
  });

  test.afterEach(async () => {
    await wsWrapper.close();
  });
});
