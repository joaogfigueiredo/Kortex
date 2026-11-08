/** 5400 → "1h 30min" · 2700 → "45min" · 30 → "<1min" · 0 → "0min" */
export function formatDuration(sec: number): string {
  if (sec <= 0) return '0min';
  if (sec < 60) return '<1min';
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** 5400 → "1,5h" (para metas e totais) */
export const formatHours = (sec: number) =>
  `${(sec / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
