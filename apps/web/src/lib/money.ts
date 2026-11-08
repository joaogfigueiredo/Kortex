const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** 350000 → "R$ 3.500,00" · compact: "R$ 3.500" (só abrevia valores sem centavos). */
export const formatCents = (c: number | null | undefined, compact = false) =>
  c == null ? '—' : (compact && c % 100 === 0 ? fmtCompact : fmt).format(c / 100);

/** 350000 → "3.500,00" (valor para o campo de edição) */
export const centsToInput = (c: number | null | undefined) =>
  c == null
    ? ''
    : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Interpreta valores digitados em BRL: "3500", "3.500", "3.500,50", "3500.5", "R$ 1,99".
 * Retorna centavos, null (vazio) ou NaN (inválido).
 */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "3.500" = três mil e quinhentos
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}
