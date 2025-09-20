import { describe, expect, it } from '@jest/globals';
import { TaxData } from '../model/tax-data';
import { TaxableEventTransfer, TaxableEvent } from '../model/taxable-event';
import { generateKoinlyCSV } from './export-koinly-csv';

const genericTaxData = {
  chain: 'polkadot',
  address: '123',
  currency: 'USD',
  deviations: [],
  fromDate: '2024-01-01',
  toDate: '2025-01-01',
  portfolioSupported: true,
};

describe('generateKoinlyCSV with token mapping and labels', () => {
  const timestamp = new Date('2025-01-01T12:00:00Z').getTime();

  it('maps token symbols to Koinly IDs', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      values: [
        {
          label: 'Reward',
          timestamp,
          transfers: [
            {
              amount: 10,
              symbol: 'VMANTA',
              fiatValue: 100,
            } as TaxableEventTransfer,
          ],
          extrinsic_index: '0x111',
          block: 1,
        } as TaxableEvent,
      ],
    };

    const csv = generateKoinlyCSV(taxData);
    expect(csv).toContain('ID:25400343'); // VMANTA mapped ID
    expect(csv).toContain('Reward'); // Koinly label
  });

  it('applies correct Koinly label for Crowdloan contribution', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      values: [
        {
          label: 'Crowdloan contribution',
          timestamp,
          transfers: [
            {
              amount: -5,
              symbol: 'DOT',
              fiatValue: 50,
            } as TaxableEventTransfer,
          ],
          extrinsic_index: '0x222',
          block: 2,
        } as TaxableEvent,
      ],
    };

    const csv = generateKoinlyCSV(taxData);
    expect(csv).toContain('Add to Pool'); // Koinly label for Crowdloan contribution
    expect(csv).toContain('DOT'); // token
  });

  it('processes Swap event with multiple token types', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      values: [
        {
          label: 'Swap',
          timestamp,
          transfers: [
            {
              amount: -3,
              symbol: 'KSM',
              fiatValue: 30,
            } as TaxableEventTransfer,
            { amount: 2, symbol: 'DOT' } as TaxableEventTransfer,
          ],
          extrinsic_index: '0x333',
          block: 3,
        } as TaxableEvent,
      ],
    };

    const csv = generateKoinlyCSV(taxData);
    expect(csv.split('\n').length).toBe(2); // -> swap should be in a single row + header
    expect(csv).toContain('Swap'); // description
    expect(csv).toContain('KSM'); // sent
    expect(csv).toContain('DOT'); // received
    expect(csv).toContain('30'); // Net Worth currency
  });

  it('handles multiple non-swap transfers with mixed labels', () => {
    const taxData: TaxData = {
      ...genericTaxData,
      values: [
        {
          label: 'Reward',
          timestamp,
          transfers: [
            { amount: 5, symbol: 'GLMR' } as TaxableEventTransfer,
            { amount: -2, symbol: 'MANTA' } as TaxableEventTransfer,
            { amount: 3, symbol: 'UNQ' } as TaxableEventTransfer,
          ],
          extrinsic_index: '0x444',
          block: 4,
        } as TaxableEvent,
      ],
    };

    const csv = generateKoinlyCSV(taxData);
    expect(csv.split('\n').length).toBe(4); // header + 3 rows
    expect(csv).toContain('GLMR');
    expect(csv).toContain('MANTA');
    expect(csv).toContain('ID:738022');
    expect(csv).toContain('Reward'); // Koinly label for all transfers
  });
});
