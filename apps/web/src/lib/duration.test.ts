import { describe, expect, it } from 'vitest';
import { formatDuration, formatHours } from './duration';

describe('formatDuration', () => {
  it.each([
    [0, '0min'],
    [30, '<1min'],
    [60, '1min'],
    [2700, '45min'],
    [3600, '1h'],
    [5400, '1h 30min'],
    [3599, '1h'], // 59,98 min arredonda para 60
  ])('%d s → %s', (s, out) => expect(formatDuration(s)).toBe(out));

  it('formatHours', () => {
    expect(formatHours(5400)).toBe('1,5h');
    expect(formatHours(36000)).toBe('10h');
  });
});
