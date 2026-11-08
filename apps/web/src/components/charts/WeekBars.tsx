import clsx from 'clsx';
import { WEEKDAY_NAME, WEEKDAY_SHORT, parseDateStr, todayStr } from '../../lib/dates';

/**
 * Barras de 7 dias (série única → sem legenda; o título nomeia).
 * Cor validada (--k-chart-1); hoje recebe o brilho neon. Tooltip por barra
 * (hover/foco) e tabela equivalente para leitores de tela.
 */
export function WeekBars({
  days,
  title,
  format,
}: {
  days: { date: string; value: number }[];
  title: string;
  /** Formata o valor para rótulo/tooltip/tabela (ex.: segundos → "1h 30min"). */
  format: (value: number) => string;
}) {
  const today = todayStr();
  const max = Math.max(...days.map((d) => d.value), 1);
  const fmtDay = (d: string) =>
    parseDateStr(d).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  return (
    <figure aria-label={title}>
      <div className="relative flex h-32 items-end gap-2 border-b border-line pb-px" aria-hidden>
        {days.map((d) => {
          const isToday = d.date === today;
          const pct = d.value ? Math.max(6, Math.round((d.value / max) * 100)) : 0;
          return (
            <div
              key={d.date}
              tabIndex={0}
              className="group relative flex h-full flex-1 cursor-default items-end justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {/* rótulo direto só em hoje (seletivo) */}
              {isToday && d.value > 0 && (
                <span
                  className="absolute text-[11px] font-semibold text-fg tabular-nums"
                  style={{ bottom: `calc(${pct}% + 6px)` }}
                >
                  {format(d.value)}
                </span>
              )}
              <span
                className={clsx(
                  'w-full max-w-4 rounded-t-[4px] transition-[height] duration-500',
                  !d.value && 'opacity-0',
                )}
                style={{
                  height: `${pct}%`,
                  background: 'var(--k-chart-1)',
                  boxShadow: isToday ? '0 0 14px var(--k-accent)' : undefined,
                }}
              />
              {/* tooltip */}
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-xl bg-surface px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-neu-sm group-hover:block group-focus-visible:block">
                <span className="block text-muted first-letter:uppercase">{fmtDay(d.date)}</span>
                <span className="font-semibold tabular-nums">{format(d.value)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2" aria-hidden>
        {days.map((d) => (
          <span
            key={d.date}
            className={clsx(
              'flex-1 text-center text-[11px]',
              d.date === today ? 'font-semibold text-accent-ink' : 'text-muted',
            )}
          >
            {WEEKDAY_SHORT[parseDateStr(d.date).getDay()]}
          </span>
        ))}
      </div>

      {/* Visão em tabela para leitores de tela */}
      {/* sr-only num <div>: tabela ignora width:1px e alargaria a página */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Tempo</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td>
                  {WEEKDAY_NAME[parseDateStr(d.date).getDay()]} {d.date.slice(8)}/
                  {d.date.slice(5, 7)}
                </td>
                <td>{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
