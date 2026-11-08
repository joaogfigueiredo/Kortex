import clsx from 'clsx';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-bg shadow-neu-sm">
        <svg viewBox="0 0 64 64" className="size-5" aria-hidden>
          <path
            d="M22 14v36M22 32l17-18M27 27l13 23"
            stroke="var(--k-accent)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{ filter: 'drop-shadow(0 0 5px var(--k-accent))' }}
          />
        </svg>
      </span>
      {!compact && <span className="text-lg font-bold tracking-tight">Kortex</span>}
    </span>
  );
}
