import { Search } from 'lucide-react';
import clsx from 'clsx';
import { Input } from './Field';

export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative max-w-sm', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted" />
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-11"
        type="search"
      />
    </div>
  );
}
