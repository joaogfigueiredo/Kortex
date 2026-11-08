import clsx from 'clsx';

export interface ProgressProps {
  value: number; // 0..100
  label?: string;
  showValue?: boolean;
  /** Cor da barra (hex). Padrão: accent neon. */
  color?: string;
  size?: 'sm' | 'md';
}

export function Progress({ value, label, showValue, color, size = 'md' }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex justify-between px-0.5 text-xs">
          <span className="text-muted">{label}</span>
          {showValue && <span className="font-semibold tabular-nums">{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={clsx(
          'rounded-full bg-bg p-0.5 shadow-neu-inset-sm',
          size === 'sm' ? 'h-2' : 'h-3',
        )}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: color ?? 'var(--k-accent)',
            boxShadow: `0 0 10px ${color ?? 'var(--k-accent)'}`,
          }}
        />
      </div>
    </div>
  );
}
