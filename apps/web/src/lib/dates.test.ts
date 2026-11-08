import { describe, expect, it } from 'vitest';
import { addDaysStr, monthGrid, relativeDayLabel, weekdayOfStr } from './dates';

describe('dates', () => {
  it('addDaysStr atravessa meses e anos bissextos', () => {
    expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysStr('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysStr('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('monthGrid: 42 dias começando no domingo ou segunda', () => {
    const g = monthGrid(2026, 10); // novembro/2026 começa num domingo
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-11-01');
    const mon = monthGrid(2026, 10, 1);
    expect(mon[0]).toBe('2026-10-26');
    expect(weekdayOfStr(mon[0]!)).toBe(1);
  });

  it('relativeDayLabel', () => {
    expect(relativeDayLabel('2026-11-08', '2026-11-08')).toBe('Hoje');
    expect(relativeDayLabel('2026-11-09', '2026-11-08')).toBe('Amanhã');
    expect(relativeDayLabel('2026-11-07', '2026-11-08')).toBe('Ontem');
  });
});
