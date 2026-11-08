import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Modal acessível sobre <dialog> nativo (foco preso, Esc fecha).
 * No celular abre como "bottom sheet"; a partir de md fica centralizado.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // O <dialog> foca o 1º elemento focável (o botão fechar); preferimos o 1º campo.
      dialog
        .querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), textarea, select')
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // clique no backdrop
      }}
      className={clsx(
        'm-0 mt-auto w-full max-w-none bg-transparent p-0 text-fg',
        'md:m-auto md:w-[calc(100%-2rem)]',
        size === 'sm' && 'md:max-w-md',
        size === 'md' && 'md:max-w-xl',
        size === 'lg' && 'md:max-w-3xl',
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col rounded-t-3xl bg-bg shadow-neu md:rounded-3xl">
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <header className="flex items-start gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <IconButton label="Fechar" size="sm" variant="ghost" onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-6 py-3">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-3 px-6 pt-3 pb-safe md:pb-6">
              {footer}
            </footer>
          )}
          {!footer && <div className="pb-safe md:pb-3" />}
        </div>
      )}
    </dialog>
  );
}
