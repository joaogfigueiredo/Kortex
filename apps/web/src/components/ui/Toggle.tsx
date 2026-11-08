import { useId, type ReactNode } from 'react';
import clsx from 'clsx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const id = useId();
  const sw = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 shrink-0 rounded-full bg-bg shadow-neu-inset-sm transition-opacity disabled:opacity-50"
    >
      <span
        className={clsx(
          'absolute top-1 left-1 size-5 rounded-full transition-all duration-300',
          checked ? 'translate-x-5 bg-accent shadow-glow' : 'bg-surface shadow-neu-sm',
        )}
      />
    </button>
  );
  if (!label) return sw;
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
      {sw}
    </div>
  );
}
