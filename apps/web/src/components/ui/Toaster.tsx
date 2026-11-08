import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useToasts, type ToastTone } from '../../stores/toast';

const TONE: Record<ToastTone, { color: string; icon: typeof Info }> = {
  success: { color: '#4DF5B8', icon: CircleCheck },
  error: { color: '#FF6B6B', icon: CircleAlert },
  info: { color: '#6FE3FF', icon: Info },
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-3 md:inset-x-auto md:right-6 md:items-end"
    >
      {toasts.map((t) => {
        const { color, icon: Icon } = TONE[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-[toast-in_.25s_ease-out] items-start gap-3 rounded-2xl bg-bg p-4 shadow-neu"
          >
            <Icon
              className="mt-0.5 size-5 shrink-0"
              style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => dismiss(t.id)}
              className="text-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
