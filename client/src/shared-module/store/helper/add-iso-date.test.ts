import { RewardDto } from '../../model/rewards';
import * as dateUtils from '../../util/date-utils';
import { expect, describe, it, jest } from '@jest/globals';
import { addIsoDate } from './add-iso-date';

describe('addIsoDate', () => {
  it('should preserve existing isoDate', () => {
    const input: RewardDto[] = [
      { timestamp: 1234567890, isoDate: '2024-01-01', someField: 'x' },
    ] as any;

    const result = addIsoDate(input);

    expect(result).toEqual([
      { timestamp: 1234567890, isoDate: '2024-01-01', someField: 'x' },
    ]);
  });

  it('should compute isoDate using formatDate when missing', () => {
    const input: RewardDto[] = [
      { timestamp: 1698796800000, someField: 'a' }, // Example timestamp
    ] as any;

    const mockIsoDate = '2023-11-01';
    const formatDateSpy = jest
      .spyOn(dateUtils, 'formatDate')
      .mockReturnValue(mockIsoDate);

    const result = addIsoDate(input);

    expect(formatDateSpy).toHaveBeenCalledWith(1698796800000);
    expect(result).toEqual([
      { timestamp: 1698796800000, someField: 'a', isoDate: mockIsoDate },
    ]);

    formatDateSpy.mockRestore();
  });
});
