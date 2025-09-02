import { expect, jest, it, describe } from '@jest/globals';
import { stakingExportPdf } from './staking-export-pdf';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const jsPdf = {
  setFontSize: jest.fn(),
  text: jest.fn(),
  save: jest.fn(),
  setPage: jest.fn(),
};
jest.mock('jspdf', () => {
  return {
    jsPDF: jest.fn().mockImplementation(() => jsPdf),
  };
});

jest.mock('jspdf-autotable', () => jest.fn());

jest.mock('../util/number-formatters', () => ({
  formatCryptoAmount: jest.fn((val) => `${val} COIN`),
  formatCurrency: jest.fn((val, currency) => `${val} ${currency}`),
}));

describe('exportPdf', () => {
  it('should generate a PDF and call autoTable with the right data', () => {
    const rewards = {
      year: 2024,
      chain: 'Polkadot',
      token: 'DOT',
      currency: 'USD',
      address: '1abcXYZ',
      summary: {
        amount: 123.45,
        fiatValue: 678.9,
      },
      dailyValues: {
        '2024-01-01': { amount: 1.1, fiatValue: 2.2 },
        '2024-01-02': { amount: 3.3, fiatValue: 4.4 },
      },
    } as any;

    stakingExportPdf(rewards);

    expect(jsPDF).toHaveBeenCalled();
    expect(autoTable).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        head: [['', 'Reward Amount', 'Value']],
        body: [
          ['2024-01-01', '1.1 COIN', '2.2 USD'],
          ['2024-01-02', '3.3 COIN', '4.4 USD'],
        ],
      })
    );

    expect(jsPdf.text).toHaveBeenCalledWith('Staking Rewards Report', 14, 20);
    expect(jsPdf.save).toHaveBeenCalledWith(
      expect.stringMatching(/^staking-rewards-Polkadot-1abc/)
    );
  });
});
