import { test, expect } from '@playwright/test';
import { mockSubscanChainList } from './util/mock-subscan-chain-list';
import { WsWrapper } from './util/WsWrapper';
import { mockRewards } from './util/mock-rewards';
import { mockCountry } from './util/mock-country';

test('Staking rewards', () => {
  let wsWrapper: WsWrapper;

  test('Add wallet and sync', async ({ page }) => {
    page.on('console', (msg) => {
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
    const msg = wsWrapper.receivedMessages[0];
    await expect(msg).toMatchObject({
      type: 'fetchDataRequest',
      payload: {
        wallet: '14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1',
        currency: 'EUR',
      },
      timestamp: expect.any(Number),
      reqId: expect.any(String),
    });
    wsWrapper.send({
      type: 'data',
      reqId: msg.reqId,
      payload: [
        {
          reqId: msg.reqId,
          wallet: msg.payload.wallet,
          blockchain: 'polkadot',
          type: 'staking_rewards',
          status: 'pending',
          currency: 'EUR',
          syncFromDate: 1703980800000,
        },
        {
          reqId: msg.reqId,
          wallet: msg.payload.wallet,
          blockchain: 'kusama',
          type: 'staking_rewards',
          status: 'pending',
          currency: 'EUR',
          syncFromDate: 1703980800000,
        },
      ],
    });
    const rows = page.locator('[data-testid="wallet-data-table"] tr');
    await expect(rows).toHaveCount(2);

    wsWrapper.send({
      type: 'data',
      reqId: msg.reqId,
      payload: [
        {
          reqId: msg.reqId,
          wallet: msg.payload.wallet,
          blockchain: 'polkadot',
          type: 'staking_rewards',
          status: 'in_progress',
          currency: 'EUR',
          syncFromDate: 1703980800000,
        },
      ],
    });

    const statusIcon = page.getByTestId('wallet-status-icon').first();
    await expect(statusIcon).toContainClass('spinner');
    const walletAddress = page.getByTestId('wallet-address').first();
    await expect(walletAddress).toHaveText(msg.payload.wallet + ' 📋');

    wsWrapper.send({
      type: 'data',
      reqId: msg.reqId,
      payload: [
        {
          reqId: msg.reqId,
          wallet: msg.payload.wallet,
          blockchain: 'polkadot',
          type: 'staking_rewards',
          status: 'done',
          currency: 'EUR',
          syncFromDate: 1703980800000,
          data: mockRewards,
        },
      ],
    });
    await expect(statusIcon).not.toHaveClass('spinner');
  });

  test('Navigation to connected blockchains and details', async ({ page }) => {
    page.on('console', (msg) => {
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
        {
          reqId: '123',
          wallet: '14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1',
          blockchain: 'mythos',
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
    await expect(blockchainRows).toHaveCount(3);
    await page.getByText('Kusama').click();
    await expect(page.getByTestId('title')).toHaveText('Taxable Events');
    await expect(page.getByTestId('summary-blockchain')).toHaveText('Kusama');
  });

  test('Breadcrumbs navigation', async ({ page }) => {
    page.on('console', (msg) => {
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
    await page
      .getByText('14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1')
      .click();
    await expect(page.getByTestId('title')).toHaveText('Connected Blockchains');
    await page.getByText('Kusama').click();
    await expect(page.getByTestId('title')).toHaveText('Taxable Events');
    await page.getByTestId('breadcrumb-Connected blockchains').click();
    expect(page.url()).toBe(
      'http://localhost:9000/wallets/14B6NNVcXVQytArm6kaBHQV1PEuha9N7zZ1CvXhfhfopXeN1/EUR'
    );
    await page.getByTestId('breadcrumb-Wallets').click();
    await expect(page.getByTestId('title')).toHaveText('Wallets');
  });

  test.afterEach(async () => {
    await wsWrapper.close();
  });
});
