import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

/** Campo "afundado" (neu-inset) com foco em accent neon. */
const control =
  'w-full rounded-2xl bg-bg px-4 text-sm text-fg shadow-neu-inset-sm outline-none transition-shadow ' +
  'placeholder:text-muted/70 focus:shadow-[inset_2px_2px_5px_var(--k-sh-dark),inset_-2px_-2px_5px_var(--k-sh-light),0_0_0_2px_var(--k-accent)] ' +
  'aria-invalid:shadow-[inset_2px_2px_5px_var(--k-sh-dark),inset_-2px_-2px_5px_var(--k-sh-light),0_0_0_2px_var(--k-red)]';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block px-1 text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="px-1 text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="px-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

type WithLabel = { label?: ReactNode; hint?: ReactNode; error?: ReactNode };

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & WithLabel
>(function Input({ label, hint, error, className, id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const el = (
    <input
      ref={ref}
      id={fieldId}
      aria-invalid={error ? true : undefined}
      className={clsx(control, 'h-11', className)}
      {...rest}
    />
  );
  return label ? (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      {el}
    </Field>
  ) : (
    el
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & WithLabel
>(function Textarea({ label, hint, error, className, id, rows = 4, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const el = (
    <textarea
      ref={ref}
      id={fieldId}
      rows={rows}
      aria-invalid={error ? true : undefined}
      className={clsx(control, 'resize-y py-3', className)}
      {...rest}
    />
  );
  return label ? (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      {el}
    </Field>
  ) : (
    el
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & WithLabel
>(function Select({ label, hint, error, className, id, children, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const el = (
    <div className="relative">
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={clsx(control, 'h-11 appearance-none pr-10', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
  return label ? (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      {el}
    </Field>
  ) : (
    el
  );
});
