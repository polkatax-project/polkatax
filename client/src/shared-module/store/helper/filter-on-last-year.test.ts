import { expect, describe, it, beforeAll, jest, afterAll } from '@jest/globals';
import { RewardsDto } from '../../model/rewards';
import { filterOnLastYear } from './filter-on-last-year';

describe('filterOnLastYear', () => {
  const realDateNow = Date.now;

  beforeAll(() => {
    // Mock system date to 2025-07-08 for predictable tests
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2025-07-08T00:00:00Z').valueOf());
  });

  afterAll(() => {
    // Restore original Date
    global.Date.now = realDateNow;
  });

  it('should only keep rewards from the last year', () => {
    const dto: RewardsDto = {
      values: [
        { isoDate: '2023-01-01', someOtherField: 1 },
        { isoDate: '2024-01-01', someOtherField: 2 },
        { isoDate: '2024-06-30', someOtherField: 3 },
        { isoDate: '2025-01-01', someOtherField: 4 },
        { isoDate: '2025-06-30', someOtherField: 5 },
      ],
    } as any;

    filterOnLastYear(dto);

    expect(dto.values).toEqual([
      { isoDate: '2024-01-01', someOtherField: 2 },
      { isoDate: '2024-06-30', someOtherField: 3 },
    ]);
  });
});
