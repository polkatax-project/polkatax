import { TaxData } from '../model/tax-data';
import { TaxableEvent, TaxableEventTransfer } from '../model/taxable-event';
import { formatDateUTC } from '../util/date-utils';
import { describe, expect, it } from '@jest/globals';
import { generateDefaultCsv } from './default-csv-export';

const genericTaxData = {
  chain: 'polkadot',
  address: '123',
  currency: 'USD',
  deviations: [],
  fromDate: '2024-01-01',
  toDate: '2025-01-01',
  portfolioSupported: true,
};

describe('generateDefaultCsv', () => {
  const timestamp = new Date('2025-01-01T12:00:00Z').getTime();

  it('generates CSV for a single transfer', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      chain: 'bifrost',
      address: '0x12345',
      currency: 'USD',
      values: [
        {
          label: 'Reward',
          timestamp,
          transfers: [
            {
              amount: 10,
              symbol: 'ACA',
              fiatValue: 50,
            } as TaxableEventTransfer,
          ],
          extrinsic_index: '0xabc',
          block: 1,
        } as TaxableEvent,
      ],
    };

    const csv = generateDefaultCsv(taxData);
    expect(csv).toContain('ACA');
    expect(csv).toContain('10');
    expect(csv).toContain('50'); // Net Worth
    expect(csv).toContain('Reward');
    expect(csv).toContain(formatDateUTC(timestamp));
    expect(csv).toContain('USD');
  });

  it('handles multiple transfers with sent and received amounts', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      chain: 'bifrost',
      address: '0x23456',
      currency: 'USD',
      values: [
        {
          label: 'Swap',
          timestamp,
          transfers: [
            {
              amount: -5,
              symbol: 'ACA',
              fiatValue: 25,
            } as TaxableEventTransfer,
            {
              amount: 4,
              symbol: 'VMANTA',
              fiatValue: 20,
            } as TaxableEventTransfer,
          ],
          extrinsic_index: '0xdef',
          block: 2,
        } as TaxableEvent,
      ],
    };

    const csv = generateDefaultCsv(taxData);
    expect(csv).toContain('ACA');
    expect(csv).toContain('VMANTA');
    expect(csv).toContain('5'); // Sent Amount
    expect(csv).toContain('4'); // Received Amount
    expect(csv).toContain('25'); // Net Worth sent
    expect(csv).toContain('20'); // Net Worth received
    expect(csv).toContain('Swap');
  });

  it('handles multiple sent or received transfers correctly', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      chain: 'bifrost',
      address: '0x34567',
      currency: 'USD',
      values: [
        {
          label: 'Reward',
          timestamp,
          transfers: [
            {
              amount: -3,
              symbol: 'ACA',
              fiatValue: 15,
            } as TaxableEventTransfer,
            {
              amount: -2,
              symbol: 'VMANTA',
              fiatValue: 10,
            } as TaxableEventTransfer,
            { amount: 5, symbol: 'UNQ', fiatValue: 25 } as TaxableEventTransfer,
          ],
          extrinsic_index: '0xghi',
          block: 3,
        } as TaxableEvent,
      ],
    };

    const csv = generateDefaultCsv(taxData);
    // Should create max(allSent.length, allReceived.length) rows = 3
    const rows = csv.split('\n').slice(1); // skip header
    expect(rows.length).toBe(2);
    expect(csv).toContain('ACA');
    expect(csv).toContain('VMANTA');
    expect(csv).toContain('UNQ');
    expect(csv).toContain('Reward');
  });

  it('handles transfers missing fiatValue', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      chain: 'bifrost',
      address: '0x45678',
      currency: 'USD',
      values: [
        {
          label: 'Reward',
          timestamp,
          transfers: [{ amount: 10, symbol: 'ACA' } as TaxableEventTransfer],
          extrinsic_index: '0xjkl',
          block: 4,
        } as TaxableEvent,
      ],
    };

    const csv = generateDefaultCsv(taxData);
    expect(csv).toContain('ACA');
    expect(csv).toContain('10');
  });

  it('handles empty taxdata gracefully', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      chain: 'bifrost',
      address: '0x56789',
      currency: 'USD',
      values: [],
    };

    const csv = generateDefaultCsv(taxData);
    expect(csv).toEqual('');
  });
});
