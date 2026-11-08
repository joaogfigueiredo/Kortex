import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseMoney } from './money';

describe('parseMoney', () => {
  it.each([
    ['3500', 350000],
    ['3.500', 350000],
    ['3.500,50', 350050],
    ['3500,5', 350050],
    ['3500.5', 350050],
    ['R$ 1.234.567,89', 123456789],
    ['0,99', 99],
    ['12.34', 1234],
  ])('"%s" → %d centavos', (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it('vazio = null', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('  ')).toBeNull();
  });

  it.each(['abc', '1,2,3', '10,999', '-5'])('"%s" é inválido', (input) => {
    expect(parseMoney(input)).toBeNaN();
  });

  it('ida e volta com centsToInput', () => {
    expect(parseMoney(centsToInput(123456789))).toBe(123456789);
    expect(centsToInput(null)).toBe('');
  });
});

describe('formatCents', () => {
  const norm = (s: string) => s.replace(/\s/g, ' ');
  it('compacto só abrevia valores inteiros (não arredonda centavos)', () => {
    expect(norm(formatCents(350000, true))).toBe('R$ 3.500');
    expect(norm(formatCents(125050, true))).toBe('R$ 1.250,50');
    expect(formatCents(null)).toBe('—');
  });
});
