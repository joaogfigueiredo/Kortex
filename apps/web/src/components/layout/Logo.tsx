import clsx from 'clsx';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <span className="block size-9 overflow-hidden rounded-xl bg-bg shadow-neu-sm">
        <img src="/icons/logo-128.png" alt="" width={36} height={36} className="size-full" />
      </span>
      {!compact && <span className="text-lg font-bold tracking-tight">Kortex</span>}
    </span>
  );
}
