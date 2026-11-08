import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

/** Controle segmentado: trilho afundado, opção ativa elevada com texto neon. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  iconOnly,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
  /** Mostra só os ícones (o texto vira aria-label/tooltip). */
  iconOnly?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx('flex min-w-0 gap-1 rounded-2xl bg-bg p-1 shadow-neu-inset-sm', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly && typeof o.label === 'string' ? o.label : undefined}
            title={iconOnly && typeof o.label === 'string' ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={clsx(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all duration-200',
              active ? 'bg-bg text-accent-ink shadow-neu-sm' : 'text-muted hover:text-fg',
            )}
          >
            {o.icon}
            {!iconOnly && <span className="truncate">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
