import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ALL_WEEKDAYS } from '@kortex/shared';
import {
  Button,
  Field,
  Input,
  Modal,
  Toggle,
  WeekdayPicker,
  weekdaysLabel,
} from '../../components/ui';
import { toast } from '../../stores/toast';
import { useGoalMutations, useGoals } from './api';
import { GOAL_ICONS, GOAL_ICON_LABEL, goalIcon } from './icons';

type Draft = { id: number | null; title: string; icon: string; weekdays: number };
const EMPTY: Draft = { id: null, title: '', icon: 'target', weekdays: ALL_WEEKDAYS };

export function GoalsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: goals = [] } = useGoals();
  const { create, update, remove } = useGoalMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ title?: string; weekdays?: string }>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const next = {
      title: draft.title.trim() ? undefined : 'Dê um nome à meta',
      weekdays: draft.weekdays ? undefined : 'Escolha ao menos um dia',
    };
    setErrors(next);
    if (next.title || next.weekdays) return;
    const body = { title: draft.title.trim(), icon: draft.icon, weekdays: draft.weekdays };
    try {
      if (draft.id) await update.mutateAsync({ id: draft.id, ...body });
      else await create.mutateAsync(body);
      toast.success(draft.id ? 'Meta atualizada' : 'Meta criada', weekdaysLabel(draft.weekdays));
      setDraft(null);
    } catch {
      /* toast no hook */
    }
  }

  async function del(id: number) {
    if (confirmId !== id) return setConfirmId(id);
    try {
      await remove.mutateAsync(id);
      toast.info('Meta excluída');
      setConfirmId(null);
      if (draft?.id === id) setDraft(null);
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setDraft(null);
        onClose();
      }}
      title="Metas diárias"
      description="Hábitos que se repetem todo dia ou em dias específicos."
    >
      <ul className="space-y-2.5">
        {goals.map((g) => {
          const Icon = goalIcon(g.icon);
          return (
            <li
              key={g.id}
              className={clsx(
                'flex items-center gap-3 rounded-2xl bg-bg px-4 py-3 shadow-neu-sm',
                !g.active && 'opacity-55',
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-accent-ink shadow-neu-inset-sm">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.title}</p>
                <p className="truncate text-xs text-muted">{weekdaysLabel(g.weekdays)}</p>
              </div>
              <Toggle
                checked={g.active}
                onChange={(active) => update.mutate({ id: g.id, active })}
                ariaLabel={`${g.title} ativa`}
              />
              <button
                type="button"
                aria-label={`Editar ${g.title}`}
                onClick={() => {
                  setDraft({
                    id: g.id,
                    title: g.title,
                    icon: g.icon ?? 'target',
                    weekdays: g.weekdays,
                  });
                  setErrors({});
                }}
                className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent-ink"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={
                  confirmId === g.id ? `Confirmar exclusão de ${g.title}` : `Excluir ${g.title}`
                }
                onClick={() => del(g.id)}
                className={clsx(
                  'grid h-8 place-items-center rounded-lg px-2 text-xs',
                  confirmId === g.id ? 'font-semibold text-danger' : 'text-muted hover:text-danger',
                )}
              >
                {confirmId === g.id ? 'Excluir?' : <Trash2 className="size-4" />}
              </button>
            </li>
          );
        })}
        {goals.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">Nenhuma meta ainda.</p>
        )}
      </ul>

      {draft ? (
        <form onSubmit={save} className="mt-5 space-y-4 rounded-3xl p-4 shadow-neu-inset-sm">
          <Input
            label={draft.id ? 'Editar meta' : 'Nova meta'}
            placeholder="Ex.: Ler 20 páginas, meditar 10 min…"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            error={errors.title}
            maxLength={200}
            autoFocus
          />
          <Field label="Ícone">
            <div role="radiogroup" aria-label="Ícone" className="flex flex-wrap gap-2">
              {Object.entries(GOAL_ICONS).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={draft.icon === name}
                  aria-label={GOAL_ICON_LABEL[name] ?? name}
                  title={GOAL_ICON_LABEL[name] ?? name}
                  onClick={() => setDraft({ ...draft, icon: name })}
                  className={clsx(
                    'grid size-9 place-items-center rounded-xl transition-all',
                    draft.icon === name
                      ? 'bg-accent text-on-accent shadow-glow'
                      : 'text-muted shadow-neu-sm hover:text-fg',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Dias">
            <WeekdayPicker
              value={draft.weekdays}
              onChange={(weekdays) => setDraft({ ...draft, weekdays })}
              error={errors.weekdays}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending || update.isPending}>
              {draft.id ? 'Salvar' : 'Criar meta'}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          className="mt-5 w-full"
          icon={<Plus className="size-4" />}
          onClick={() => setDraft({ ...EMPTY })}
        >
          Nova meta
        </Button>
      )}
    </Modal>
  );
}
