import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BellRing, CalendarDays, Clock, Lightbulb, Plus, Timer } from 'lucide-react';
import { Button, Modal, Segmented } from '../../components/ui';
import { api } from '../../lib/api';
import { addDaysStr, relativeDayLabel, todayStr } from '../../lib/dates';
import { parseCapture } from '../../lib/quickParse';
import { useFocus } from '../../stores/focus';
import { toast } from '../../stores/toast';

type Kind = 'idea' | 'reminder';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Captura rápida global: botão flutuante + atalhos
 * N = nova captura · F = Modo Foco (fora de campos de texto).
 */
export function QuickCapture() {
  const qc = useQueryClient();
  const { session, openSetup } = useFocus();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('idea');
  const [text, setText] = useState('');
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const today = todayStr();

  const parsed = useMemo(() => parseCapture(text, today), [text, today]);
  const date = dateOverride ?? parsed.date ?? today;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        isTyping(e.target) ||
        document.querySelector('dialog[open]')
      )
        return;
      if (useFocus.getState().session) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        useFocus.getState().openSetup();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setText('');
    setDateOverride(null);
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      if (kind === 'idea') {
        await api.post('/ideas', { title: text.trim() });
        return;
      }
      const title = parsed.title || text.trim();
      await api.post('/reminders', {
        title,
        startAt: `${date}T${parsed.time ?? '00:00'}`,
        allDay: !parsed.time,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [kind === 'idea' ? 'ideas' : 'reminders'] });
      if (kind === 'idea') toast.success('Ideia registrada', 'Está em Ideias → Organizadas');
      else
        toast.success(
          'Lembrete criado',
          `${relativeDayLabel(date, today)}${parsed.time ? ` às ${parsed.time}` : ' · dia todo'}`,
        );
      setOpen(false);
    },
    onError: (e: Error) => toast.error('Não foi possível salvar', e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) save.mutate();
  }

  if (session) return null; // Modo Foco cobre a tela

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Captura rápida (atalho: N)"
        title="Captura rápida (N)"
        className="fixed right-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-2xl bg-accent text-on-accent shadow-glow transition-all hover:scale-105 hover:bg-accent-hover active:scale-95 md:right-8 md:bottom-8"
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Captura rápida"
        description="Registre em segundos e volte ao que estava fazendo."
      >
        <form onSubmit={submit} className="space-y-4">
          <Segmented<Kind>
            ariaLabel="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'idea', label: 'Ideia', icon: <Lightbulb className="size-3.5" /> },
              { value: 'reminder', label: 'Lembrete', icon: <BellRing className="size-3.5" /> },
            ]}
          />
          <input
            aria-label={kind === 'idea' ? 'Sua ideia' : 'Seu lembrete'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'idea' ? 'Qual é a ideia?' : 'Ex.: dentista amanhã às 15h'}
            maxLength={200}
            className="h-14 w-full rounded-2xl bg-bg px-5 text-base text-fg shadow-neu-inset-sm outline-none placeholder:text-muted/70 focus:shadow-[inset_2px_2px_5px_var(--k-sh-dark),inset_-2px_-2px_5px_var(--k-sh-light),0_0_0_2px_var(--k-accent)]"
          />

          {kind === 'reminder' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-accent-ink shadow-neu-inset-sm">
                  <CalendarDays className="size-3.5" />
                  {relativeDayLabel(date, today)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-accent-ink shadow-neu-inset-sm">
                  <Clock className="size-3.5" />
                  {parsed.time ?? 'Dia todo'}
                </span>
                {parsed.title && parsed.title !== text.trim() && (
                  <span className="truncate text-muted">“{parsed.title}”</span>
                )}
              </div>
              <div className="flex gap-2">
                {[
                  { label: 'Hoje', d: today },
                  { label: 'Amanhã', d: addDaysStr(today, 1) },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={date === o.d}
                    onClick={() => setDateOverride(o.d)}
                    className={clsx(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                      date === o.d
                        ? 'bg-accent text-on-accent shadow-glow'
                        : 'shadow-neu-sm hover:text-accent-ink',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="px-1 text-[11px] text-muted">
                Dica: escreva “amanhã às 15h”, “sexta 9h” ou “12/11”.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openSetup();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-accent-ink"
            >
              <Timer className="size-3.5" /> Modo Foco (F)
            </button>
            <Button
              type="submit"
              variant="primary"
              className="ml-auto"
              disabled={!text.trim() || save.isPending}
            >
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
