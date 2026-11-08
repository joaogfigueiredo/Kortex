import { hasWeekday, type Recurrence } from '@kortex/shared';

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
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12

export interface RecurrenceRule {
  /** "YYYY-MM-DDTHH:mm" (local/flutuante) */
  startAt: string;
  recurrence: Recurrence;
  recurrenceWeekdays: number | null;
  recurrenceUntil: string | null;
}

/** O lembrete acontece no dia `date`? */
export function occursOn(rule: RecurrenceRule, date: string): boolean {
  const start = rule.startAt.slice(0, 10);
  if (date < start) return false;
  if (rule.recurrenceUntil && date > rule.recurrenceUntil) return false;

  switch (rule.recurrence) {
    case 'none':
      return date === start;
    case 'daily':
      return true;
    case 'weekly': {
      const mask = rule.recurrenceWeekdays || 1 << weekdayOf(start);
      return hasWeekday(mask, weekdayOf(date));
    }
    case 'monthly': {
      // Dia 31 em meses curtos cai no último dia do mês (30, 29 ou 28).
      const startDay = Number(start.slice(8, 10));
      const [y, m, d] = date.split('-').map(Number) as [number, number, number];
      return d === Math.min(startDay, daysInMonth(y, m));
    }
  }
}

/** Todas as datas (YYYY-MM-DD) em que o lembrete ocorre dentro de [from, to]. */
export function expandDates(rule: RecurrenceRule, from: string, to: string): string[] {
  const start = rule.startAt.slice(0, 10);
  const first = from > start ? from : start;
  const last = rule.recurrenceUntil && rule.recurrenceUntil < to ? rule.recurrenceUntil : to;
  if (first > last) return [];
  if (rule.recurrence === 'none') return start >= from && start <= to ? [start] : [];

  const out: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) if (occursOn(rule, d)) out.push(d);
  return out;
}
