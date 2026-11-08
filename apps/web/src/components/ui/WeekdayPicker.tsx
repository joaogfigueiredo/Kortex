import clsx from 'clsx';
import { ALL_WEEKDAYS } from '@kortex/shared';
import { WEEKDAY_NAME, WEEKDAY_SHORT } from '../../lib/dates';

const WORKDAYS = 0b0111110;

/** Seletor de dias da semana (bitmask Dom=1 … Sáb=64) com atalhos. */
export function WeekdayPicker({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (mask: number) => void;
  error?: string;
}) {
  return (
    <div>
      <div role="group" aria-label="Dias da semana" className="flex justify-between gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const on = (value & (1 << d)) !== 0;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAY_NAME[d]}
              title={WEEKDAY_NAME[d]}
              onClick={() => onChange(value ^ (1 << d))}
              className={clsx(
                'grid size-9 place-items-center rounded-full text-xs font-semibold transition-all',
                on
                  ? 'bg-accent text-on-accent shadow-glow'
                  : 'text-muted shadow-neu-sm hover:text-fg',
              )}
            >
              {WEEKDAY_SHORT[d]}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 px-1 text-xs">
        <button
          type="button"
          className="text-muted hover:text-accent-ink"
          onClick={() => onChange(WORKDAYS)}
        >
          Dias úteis
        </button>
        <span className="text-muted">·</span>
        <button
          type="button"
          className="text-muted hover:text-accent-ink"
          onClick={() => onChange(ALL_WEEKDAYS)}
        >
          Todos
        </button>
      </div>
      {error && <p className="mt-1 px-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** "Todos os dias", "Dias úteis" ou "Seg, Qua, Sex". */
export function weekdaysLabel(mask: number) {
  if ((mask & ALL_WEEKDAYS) === ALL_WEEKDAYS) return 'Todos os dias';
  if (mask === WORKDAYS) return 'Dias úteis';
  if (mask === 0b1000001) return 'Fins de semana';
  return [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => mask & (1 << d))
    .map((d) => WEEKDAY_NAME[d])
    .join(', ');
}
