import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'neu' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium select-none transition-all duration-200 ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent shadow-glow hover:bg-accent-hover hover:shadow-[0_0_0_1px_var(--k-accent),0_0_28px_rgb(111_227_255/0.55)]',
  neu: 'bg-bg text-fg shadow-neu-sm hover:text-accent-ink active:shadow-neu-inset-sm',
  ghost: 'text-muted hover:text-fg hover:bg-line',
  danger:
    'bg-bg text-danger shadow-neu-sm hover:shadow-[0_0_18px_rgb(255_107_107/0.35)] active:shadow-neu-inset-sm',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-11 px-5 text-sm rounded-2xl',
  lg: 'h-13 px-6 text-base rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'neu', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
}

/** Botão só com ícone — `label` vira aria-label e tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'neu', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        base,
        variants[variant],
        size === 'sm' ? 'size-9 rounded-xl' : 'size-11 rounded-2xl',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
