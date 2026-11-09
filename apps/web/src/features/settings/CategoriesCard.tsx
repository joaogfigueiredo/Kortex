import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import type { ReminderCategory } from '@kortex/shared';
import { Button, Card, CardHeader, Field, Input } from '../../components/ui';
import { toast } from '../../stores/toast';
import { useCategories, useReminderMutations } from '../reminders/api';

/** Cores sugeridas (as mesmas da paleta neon do app). */
const SWATCHES = [
  '#6FE3FF',
  '#B79CFF',
  '#4DF5B8',
  '#FFD166',
  '#FF8FC7',
  '#FF6B6B',
  '#FF9F5A',
  '#9AA3B2',
];

type Draft = { id: number | null; name: string; color: string };

/** Categorias da Agenda: o nome e a cor das bolinhas do calendário. */
export function CategoriesCard() {
  const { data: categories = [] } = useCategories();
  const { createCategory, updateCategory, removeCategory } = useReminderMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const edit = (c: ReminderCategory) => {
    setDraft({ id: c.id, name: c.name, color: c.color });
    setError(undefined);
    setConfirmId(null);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError('Dê um nome à categoria');
    if (categories.some((c) => c.id !== draft.id && c.name.toLowerCase() === name.toLowerCase()))
      return setError('Já existe uma categoria com esse nome');
    try {
      if (draft.id) await updateCategory.mutateAsync({ id: draft.id, name, color: draft.color });
      else await createCategory.mutateAsync({ name, color: draft.color });
      toast.success(draft.id ? 'Categoria atualizada' : 'Categoria criada', name);
      setDraft(null);
    } catch {
      /* toast no hook */
    }
  }

  async function remove(c: ReminderCategory) {
    if (confirmId !== c.id) return setConfirmId(c.id);
    try {
      await removeCategory.mutateAsync(c.id);
      toast.info('Categoria excluída', 'Os lembretes dela ficaram sem categoria.');
      setConfirmId(null);
      if (draft?.id === c.id) setDraft(null);
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<Tags className="size-5" />}
        title="Categorias da agenda"
        subtitle="Nome e cor das bolinhas do calendário"
      />

      <ul className="space-y-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-2.5 shadow-neu-sm"
          >
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-full"
              style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
            <button
              type="button"
              aria-label={`Editar ${c.name}`}
              onClick={() => edit(c)}
              className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent-ink"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              aria-label={
                confirmId === c.id ? `Confirmar exclusão de ${c.name}` : `Excluir ${c.name}`
              }
              onClick={() => remove(c)}
              className={clsx(
                'grid h-8 place-items-center rounded-lg px-2 text-xs',
                confirmId === c.id ? 'font-semibold text-danger' : 'text-muted hover:text-danger',
              )}
            >
              {confirmId === c.id ? 'Excluir?' : <Trash2 className="size-4" />}
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="rounded-2xl px-4 py-5 text-center text-sm text-muted shadow-neu-inset-sm">
            Nenhuma categoria. Crie uma para colorir seus compromissos.
          </li>
        )}
      </ul>

      {draft ? (
        <form onSubmit={save} className="mt-5 space-y-4 rounded-3xl p-4 shadow-neu-inset-sm">
          <Input
            label={draft.id ? 'Editar categoria' : 'Nova categoria'}
            placeholder="Ex.: Faculdade, Família…"
            value={draft.name}
            onChange={(e) => {
              setDraft({ ...draft, name: e.target.value });
              setError(undefined);
            }}
            error={error}
            maxLength={200}
            autoFocus
          />
          <Field label="Cor">
            <div
              role="radiogroup"
              aria-label="Cor da categoria"
              className="flex flex-wrap items-center gap-3"
            >
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={draft.color.toLowerCase() === c.toLowerCase()}
                  aria-label={`Cor ${c}`}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className="grid size-8 place-items-center rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    boxShadow:
                      draft.color.toLowerCase() === c.toLowerCase()
                        ? `0 0 0 3px var(--k-bg), 0 0 0 5px ${c}, 0 0 14px ${c}`
                        : undefined,
                  }}
                >
                  {draft.color.toLowerCase() === c.toLowerCase() && (
                    <Check className="size-4 text-[#04222D]" strokeWidth={3} aria-hidden />
                  )}
                </button>
              ))}
              <label className="inline-flex items-center gap-2 text-xs text-muted">
                <input
                  type="color"
                  aria-label="Escolher outra cor"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value.toUpperCase() })}
                  className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
                outra
              </label>
            </div>
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" icon={<X className="size-4" />} onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {draft.id ? 'Salvar' : 'Criar categoria'}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          className="mt-5 w-full"
          icon={<Plus className="size-4" />}
          onClick={() => {
            setDraft({ id: null, name: '', color: SWATCHES[0]! });
            setError(undefined);
          }}
        >
          Nova categoria
        </Button>
      )}
    </Card>
  );
}
