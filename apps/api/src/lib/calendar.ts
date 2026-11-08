/**
 * Aritmética de datas "de calendário" sobre strings YYYY-MM-DD.
 * Usa Date em UTC só como calculadora: não há fuso envolvido.
 */
const toUtc = (d: string) => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromUtc(toUtc(d) + n * 86_400_000);
export const weekdayOf = (d: string) => new Date(toUtc(d)).getUTCDay(); // 0 = domingo
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
