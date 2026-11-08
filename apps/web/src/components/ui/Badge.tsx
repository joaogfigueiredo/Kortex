import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface BadgeProps {
  children: ReactNode;
  /** Cor do ponto neon (hex ou var). Sem cor = badge neutro. */
  color?: string;
  variant?: 'soft' | 'solid';
  className?: string;
}

export function Badge({ children, color, variant = 'soft', className }: BadgeProps) {
  if (variant === 'solid') {
    const c = color ?? '#6FE3FF';
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-on-accent',
          className,
        )}
        style={{ background: c, boxShadow: `0 0 12px ${c}66` }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-xs font-medium shadow-neu-inset-sm',
        className,
      )}
    >
      {color && <Dot color={color} />}
      {children}
    </span>
  );
}

/** Bolinha neon (usada no calendário, categorias e legendas). */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}
