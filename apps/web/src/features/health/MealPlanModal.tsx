import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ALL_WEEKDAYS, type Meal } from '@kortex/shared';
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
import { useHealthMutations, useMeals } from './api';

type Draft = {
  id: number | null;
  name: string;
  time: string;
  description: string;
  weekdays: number;
};
const EMPTY: Draft = { id: null, name: '', time: '', description: '', weekdays: ALL_WEEKDAYS };

/** Gerencia o plano de refeições: lista + formulário de criar/editar. */
export function MealPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: meals = [] } = useMeals();
  const { createMeal, updateMeal, removeMeal } = useHealthMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ name?: string; weekdays?: string }>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const edit = (m: Meal) => {
    setDraft({
      id: m.id,
      name: m.name,
      time: m.time ?? '',
      description: m.description ?? '',
      weekdays: m.weekdays,
    });
    setErrors({});
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const next = {
      name: draft.name.trim() ? undefined : 'Dê um nome',
      weekdays: draft.weekdays ? undefined : 'Escolha ao menos um dia',
    };
    setErrors(next);
    if (next.name || next.weekdays) return;
    const body = {
      name: draft.name.trim(),
      time: draft.time || null,
      description: draft.description.trim() || null,
      weekdays: draft.weekdays,
    };
    try {
      if (draft.id) await updateMeal.mutateAsync({ id: draft.id, ...body });
      else await createMeal.mutateAsync(body);
      toast.success(draft.id ? 'Refeição atualizada' : 'Refeição adicionada ao plano');
      setDraft(null);
    } catch {
      /* toast no hook */
    }
  }

  async function remove(id: number) {
    if (confirmId !== id) return setConfirmId(id);
    try {
      await removeMeal.mutateAsync(id);
      toast.info('Refeição removida do plano');
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
      title="Plano de refeições"
      description="Defina as refeições e em quais dias da semana elas valem."
    >
      <ul className="space-y-2.5">
        {meals.map((m) => (
          <li
            key={m.id}
            className={clsx('flex items-center gap-3 rounded-2xl bg-bg px-4 py-3 shadow-neu-sm')}
          >
            <div className="min-w-0 flex-1">
              <p className={clsx('truncate text-sm font-medium', !m.active && 'text-muted')}>
                {m.name}
                {m.time && (
                  <span className="ml-2 text-xs font-normal text-muted tabular-nums">{m.time}</span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {!m.active && 'Inativa · '}
                {weekdaysLabel(m.weekdays)}
                {m.description && ` · ${m.description}`}
              </p>
            </div>
            <Toggle
              checked={m.active}
              onChange={(active) => updateMeal.mutate({ id: m.id, active })}
              ariaLabel={`${m.name} ativa no plano`}
            />
            <button
              type="button"
              aria-label={`Editar ${m.name}`}
              onClick={() => edit(m)}
              className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent-ink"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              aria-label={
                confirmId === m.id ? `Confirmar remoção de ${m.name}` : `Remover ${m.name}`
              }
              onClick={() => remove(m.id)}
              className={clsx(
                'grid h-8 place-items-center rounded-lg px-2 text-xs',
                confirmId === m.id ? 'font-semibold text-danger' : 'text-muted hover:text-danger',
              )}
            >
              {confirmId === m.id ? 'Remover?' : <Trash2 className="size-4" />}
            </button>
          </li>
        ))}
        {meals.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">Nenhuma refeição no plano ainda.</p>
        )}
      </ul>

      {draft ? (
        <form onSubmit={save} className="mt-5 space-y-4 rounded-3xl p-4 shadow-neu-inset-sm">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Input
              label={draft.id ? 'Editar refeição' : 'Nova refeição'}
              placeholder="Ex.: Café da manhã"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              error={errors.name}
              autoFocus
            />
            <Input
              label="Horário"
              type="time"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
          </div>
          <Input
            label="O que comer (opcional)"
            placeholder="Ex.: ovos, pão integral e fruta"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
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
            <Button
              type="submit"
              variant="primary"
              disabled={createMeal.isPending || updateMeal.isPending}
            >
              {draft.id ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          className="mt-5 w-full"
          icon={<Plus className="size-4" />}
          onClick={() => setDraft({ ...EMPTY })}
        >
          Adicionar refeição
        </Button>
      )}
    </Modal>
  );
}
