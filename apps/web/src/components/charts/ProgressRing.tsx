import type { ReactNode } from 'react';

/**
 * Anel de progresso (SVG). O arco usa a cor de gráfico validada (--k-chart-1)
 * com brilho neon; o número no centro é sempre visível (a cor não é o único sinal).
 */
export function ProgressRing({
  value,
  max,
  size = 64,
  stroke = 7,
  label,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const complete = max > 0 && value >= max;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--k-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete ? 'var(--k-accent)' : 'var(--k-chart-1)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)',
            filter: pct > 0 ? 'drop-shadow(0 0 4px var(--k-accent))' : undefined,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
