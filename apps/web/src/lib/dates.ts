/**
 * Datas de calendário como strings "YYYY-MM-DD" (locais, sem fuso),
 * no mesmo formato "flutuante" que a API usa para lembretes.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const nowTimeStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Converte "YYYY-MM-DD" em Date local ao meio-dia (seguro contra horário de verão). */
export const parseDateStr = (s: string) => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
};

export const addDaysStr = (s: string, n: number) => {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

export const weekdayOfStr = (s: string) => parseDateStr(s).getDay();

/** 42 dias (6 semanas) cobrindo o mês, começando no domingo (0) ou segunda (1). */
export function monthGrid(year: number, month: number, weekStart: 0 | 1 = 0): string[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = toDateStr(new Date(year, month, 1 - offset, 12));
  return Array.from({ length: 42 }, (_, i) => addDaysStr(start, i));
}

export const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const WEEKDAY_NAME = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

/** "Hoje", "Amanhã", "Ontem" ou "qui., 12 de nov." */
export function relativeDayLabel(s: string, today = todayStr()): string {
  if (s === today) return 'Hoje';
  if (s === addDaysStr(today, 1)) return 'Amanhã';
  if (s === addDaysStr(today, -1)) return 'Ontem';
  return parseDateStr(s).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "quinta-feira, 12 de novembro" */
export const longDayLabel = (s: string) =>
  parseDateStr(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Dias entre duas datas "YYYY-MM-DD" (b - a). */
export const daysBetweenStr = (a: string, b: string) =>
  Math.round((parseDateStr(b).getTime() - parseDateStr(a).getTime()) / 86_400_000);
