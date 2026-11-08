const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "há 3 dias", "ontem", "agora". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diffSec = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return 'agora';
}

/** "8 de nov. de 2026". */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
