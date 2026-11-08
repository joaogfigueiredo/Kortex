import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** raised = elevado (padrão) · inset = afundado · selected = borda/brilho neon */
  variant?: 'raised' | 'inset';
  selected?: boolean;
  interactive?: boolean;
}

export function Card({ variant = 'raised', selected, interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-3xl bg-bg p-5 transition-all duration-200',
        variant === 'raised' ? 'shadow-neu' : 'shadow-neu-inset',
        selected && 'ring-2 ring-accent shadow-glow',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:shadow-neu-sm',
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-bg text-accent-ink shadow-neu-inset-sm">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
