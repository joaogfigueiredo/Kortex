import { useState } from 'react';
import clsx from 'clsx';
import { WEEKDAY_SHORT, parseDateStr, todayStr } from '../../lib/dates';

export interface BarSeries {
  key: string;
  label: string;
  /** Cor por papel (CSS var), ex.: "var(--k-s-study)". */
  color: string;
}

export interface BarDatum {
  date: string;
  /** Valor por série; null = sem dado (desenha só a linha de base). */
  values: Record<string, number | null>;
}

/**
 * Barras por dia, simples ou empilhadas (uma escala só, sem eixo duplo).
 * - legenda sempre que houver ≥ 2 séries; série única é nomeada pelo título
 * - 2px de respiro entre segmentos; topo arredondado 4px ancorado na base
 * - tooltip por coluna (hover/foco) e tabela equivalente para leitores de tela
 */
export function BarChart({
  data,
  series,
  title,
  format,
  max,
  height = 160,
}: {
  data: BarDatum[];
  series: BarSeries[];
  title: string;
  format: (v: number) => string;
  /** Escala fixa (ex.: 100 para %); padrão = maior total. */
  max?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const today = todayStr();
  const totals = data.map((d) => series.reduce((n, s) => n + (d.values[s.key] ?? 0), 0));
  const scale = max ?? Math.max(1, ...totals);
  const dense = data.length > 10;
  const fmtDay = (d: string) =>
    parseDateStr(d).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  const tickLabel = (d: string, i: number) => {
    if (!dense) return WEEKDAY_SHORT[parseDateStr(d).getDay()];
    // no mês: rótulo a cada 5 dias + o último
    return i % 5 === 0 || i === data.length - 1 ? String(Number(d.slice(8))) : '';
  };

  return (
    <figure aria-label={title} className="w-full">
      {series.length > 1 && (
        <figcaption className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}

      <div className="relative" aria-hidden onMouseLeave={() => setHover(null)}>
        {/* linha de referência no topo da escala (recessiva) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        {totals.every((t) => t === 0) && (
          <span className="absolute inset-x-0 top-1/3 text-center text-xs text-muted">
            Sem registros no período
          </span>
        )}
        <div
          className={clsx('flex items-end border-b border-line', dense ? 'gap-[3px]' : 'gap-2')}
          style={{ height }}
        >
          {data.map((d, i) => {
            const total = totals[i]!;
            const isToday = d.date === today;
            const allNull = series.every((s) => d.values[s.key] == null);
            return (
              <div
                key={d.date}
                onMouseEnter={() => setHover(i)}
                className="relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md"
              >
                <div
                  className={clsx(
                    'flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-[height] duration-500',
                    !dense && 'max-w-6',
                  )}
                  style={{
                    height: `${(total / scale) * 100}%`,
                    boxShadow: isToday && total > 0 ? '0 0 12px var(--k-accent)' : undefined,
                  }}
                >
                  {series.map((s) => {
                    const v = d.values[s.key] ?? 0;
                    if (!v) return null;
                    return (
                      <span
                        key={s.key}
                        style={{ flex: `${v} 0 0`, background: s.color, minHeight: 2 }}
                      />
                    );
                  })}
                </div>
                {allNull && <span className="absolute bottom-0 h-px w-3 bg-muted/40" />}
                {hover === i && (
                  <div
                    className={clsx(
                      'pointer-events-none absolute bottom-full z-20 mb-2 min-w-36 rounded-xl bg-surface px-3 py-2 text-[11px] whitespace-nowrap shadow-neu-sm',
                      // nas bordas, ancora o tooltip para não vazar da tela
                      i < 2
                        ? 'left-0'
                        : i > data.length - 3
                          ? 'right-0'
                          : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    <p className="mb-1 text-muted first-letter:uppercase">{fmtDay(d.date)}</p>
                    {series
                      // no empilhado, esconde áreas zeradas; na série única mostra sempre (inclusive “—”)
                      .filter((s) => series.length === 1 || (d.values[s.key] ?? 0) > 0)
                      .map((s) => (
                        <p key={s.key} className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5">
                            {series.length > 1 && (
                              <span
                                className="size-2 rounded-[2px]"
                                style={{ background: s.color }}
                              />
                            )}
                            {series.length > 1 ? s.label : title}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {d.values[s.key] == null ? '—' : format(d.values[s.key]!)}
                          </span>
                        </p>
                      ))}
                    {series.length > 1 && (
                      <p className="mt-1 flex justify-between gap-3 border-t border-line pt-1 font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">{format(total)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className={clsx('mt-1.5 flex', dense ? 'gap-[3px]' : 'gap-2')}>
          {data.map((d, i) => (
            <span
              key={d.date}
              className={clsx(
                'min-w-0 flex-1 overflow-visible text-center text-[10px] whitespace-nowrap tabular-nums',
                d.date === today ? 'font-semibold text-accent-ink' : 'text-muted',
              )}
            >
              {tickLabel(d.date, i)}
            </span>
          ))}
        </div>
      </div>

      {/* sr-only num <div>: tabela ignora width:1px e alargaria a página */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row">{fmtDay(d.date)}</th>
                {series.map((s) => (
                  <td key={s.key}>
                    {d.values[s.key] == null ? 'sem dado' : format(d.values[s.key]!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
