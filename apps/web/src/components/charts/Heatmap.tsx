import { WEEKDAY_SHORT, parseDateStr, todayStr } from '../../lib/dates';

/**
 * Calendário de consistência: um quadrado por dia, alinhado por dia da semana.
 * Escala sequencial de UM matiz (--k-chart-1), do claro ao forte; o valor exato
 * está no tooltip (title) e na tabela para leitores de tela.
 */
export function Heatmap({
  days,
  title,
  format,
}: {
  days: { date: string; value: number }[];
  title: string;
  format: (v: number) => string;
}) {
  const today = todayStr();
  const max = Math.max(0, ...days.map((d) => d.value));
  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const MIX = [0, 30, 55, 78, 100];
  const fill = (lvl: number) =>
    lvl === 0 ? 'var(--k-line)' : `color-mix(in oklab, var(--k-chart-1) ${MIX[lvl]}%, var(--k-bg))`;
  const offset = days.length ? parseDateStr(days[0]!.date).getDay() : 0;
  const fmtDay = (d: string) =>
    parseDateStr(d).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  return (
    <figure aria-label={title} className="mx-auto w-full max-w-[19rem]">
      <div aria-hidden className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_SHORT.map((w, i) => (
          <span key={i} className="text-center text-[10px] text-muted">
            {w}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((d) => (
          <span
            key={d.date}
            title={`${fmtDay(d.date)}: ${format(d.value)}`}
            className="aspect-square rounded-md transition-colors"
            style={{
              background: fill(level(d.value)),
              boxShadow: d.date === today ? '0 0 0 2px var(--k-accent)' : undefined,
            }}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted"
      >
        Menos
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-3 rounded-[3px]" style={{ background: fill(l) }} />
        ))}
        Mais
      </div>
      {/* sr-only num <div>: tabela ignora width:1px e alargaria a página */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{fmtDay(d.date)}</th>
                <td>{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
