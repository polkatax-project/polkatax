import { expect, jest, it, describe, beforeEach } from '@jest/globals';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';
import { exportDefaultCsv } from './export-default-csv';

const parse = jest.fn().mockReturnValue('mocked_csv');
jest.mock('@json2csv/plainjs', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parse,
  })),
}));

jest.mock('file-saver', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../util/date-utils', () => ({
  formatDateUTC: jest.fn(),
}));

describe('exportDefaultCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format rewards and export to CSV correctly', () => {
    const rewards = {
      token: 'XYZ',
      year: 2024,
      chain: 'Kusama',
      currency: 'EUR',
      address: '0x123',
      summary: {
        amount: 100,
        fiatValue: 500,
      },
      values: [
        { timestamp: 1700000000, amount: 50, hash: 'hash1' },
        { timestamp: 1700001000, amount: 50, hash: 'hash2' },
      ],
    };

    // Mock UTC formatting
    (formatDateUTC as jest.Mock).mockImplementation((ts) => `UTC-${ts}`);

    exportDefaultCsv(rewards as any);

    const expectedValues = [
      {
        'Reward token': 'XYZ',
        Chain: 'Kusama',
        Currency: 'EUR',
        'Wallet address': '0x123',
        timestamp: 1700000000,
        amount: 50,
        hash: 'hash1',
        nominationPool: undefined,
        utcDate: 'UTC-1700000000',
        totalAmount: 100,
        totalValue: 500,
      },
      {
        timestamp: 1700001000,
        amount: 50,
        hash: 'hash2',
        nominationPool: false,
        utcDate: 'UTC-1700001000',
      },
    ];

    expect(parse).toHaveBeenCalledWith(expectedValues);

    expect(saveAs).toHaveBeenCalledWith(
      expect.any(Blob),
      'staking-rewards-Kusama-0x123.csv'
    );
  });
});
