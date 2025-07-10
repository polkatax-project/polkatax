import { expect, it, describe } from '@jest/globals';
import { formatDate, formatDateUTC } from './date-utils';

describe('formatDateUTC', () => {
  it('should format timestamp to UTC date string', () => {
    const timestamp = Date.UTC(2024, 4, 31, 14, 30, 45); // 2024-05-31T14:30:45Z
    expect(formatDateUTC(timestamp)).toBe('2024-05-31T14:30:45Z');
  });
});

describe('formatDate', () => {
  it('should format timestamp to YYYY-MM-DD string', () => {
    const timestamp = new Date(2025, 0, 2).getTime(); // 2025-01-02
    expect(formatDate(timestamp)).toBe('2025-01-02');
  });
});
