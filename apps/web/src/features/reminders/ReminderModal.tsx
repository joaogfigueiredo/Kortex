import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Repeat, Trash2 } from 'lucide-react';
import {
  REMINDER_KIND,
  REMINDER_KIND_LABEL,
  type Recurrence,
  type ReminderKind,
} from '@kortex/shared';
import {
  Button,
  Field,
  Input,
  Modal,
  Segmented,
  Textarea,
  Toggle,
  WeekdayPicker,
} from '../../components/ui';
import { longDayLabel, weekdayOfStr } from '../../lib/dates';
import { toast } from '../../stores/toast';
import { useCategories, useReminder, useReminderMutations } from './api';
import { KIND_ICON, NO_CATEGORY_COLOR } from './OccurrenceItem';

export type ReminderModalState =
  { mode: 'closed' } | { mode: 'create'; date: string } | { mode: 'edit'; reminderId: number };

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Não repete' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

export function ReminderModal({
  state,
  onClose,
}: {
  state: ReminderModalState;
  onClose: () => void;
}) {
  const { create, update, remove } = useReminderMutations();
  const { data: categories = [] } = useCategories();
  const editId = state.mode === 'edit' ? state.reminderId : null;
  const { data: editing, isLoading: loadingEdit } = useReminder(editId);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ReminderKind>('reminder');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [weekdays, setWeekdays] = useState(0);
  const [until, setUntil] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openKey =
    state.mode === 'closed'
      ? null
      : state.mode === 'edit'
        ? `e${state.reminderId}:${editing ? 1 : 0}`
        : `c${state.date}`;

  useEffect(() => {
    if (state.mode === 'closed') return;
    if (state.mode === 'edit' && !editing) return; // aguarda carregar
    const start = editing?.startAt ?? `${state.mode === 'create' ? state.date : ''}T09:00`;
    setTitle(editing?.title ?? '');
    setKind(editing?.kind ?? 'reminder');
    setCategoryId(editing?.categoryId ?? null);
    setDate(start.slice(0, 10));
    setAllDay(editing?.allDay ?? false);
    setTime(editing && !editing.allDay ? start.slice(11, 16) : '09:00');
    setEndTime(editing?.endAt && !editing.allDay ? editing.endAt.slice(11, 16) : '');
    setRecurrence(editing?.recurrence ?? 'none');
    setWeekdays(editing?.recurrenceWeekdays ?? 1 << weekdayOfStr(start.slice(0, 10)));
    setUntil(editing?.recurrenceUntil ?? '');
    setDescription(editing?.description ?? '');
    setErrors({});
    setConfirmDelete(false);
  }, [openKey]); // reset intencional só ao abrir outro item / quando o item carrega

  const busy = create.isPending || update.isPending || remove.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string | undefined> = {
      title: title.trim() ? undefined : 'Dê um título',
      date: date ? undefined : 'Escolha a data',
      endTime: !allDay && endTime && endTime < time ? 'Termina antes de começar' : undefined,
      weekdays: recurrence === 'weekly' && !weekdays ? 'Escolha ao menos um dia' : undefined,
      until:
        recurrence !== 'none' && until && until < date
          ? 'Deve ser depois da data inicial'
          : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const body = {
      title: title.trim(),
      description: description.trim() || null,
      kind,
      categoryId,
      startAt: `${date}T${allDay ? '00:00' : time}`,
      endAt: !allDay && endTime ? `${date}T${endTime}` : null,
      allDay,
      recurrence,
      recurrenceWeekdays: recurrence === 'weekly' ? weekdays : null,
      recurrenceUntil: recurrence !== 'none' && until ? until : null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        toast.success('Lembrete atualizado');
      } else {
        await create.mutateAsync(body);
        toast.success('Adicionado à agenda', longDayLabel(date));
      }
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(editing.id);
      toast.info(editing.recurrence === 'none' ? 'Lembrete excluído' : 'Série excluída');
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  const isRecurringEdit = editing && editing.recurrence !== 'none';

  return (
    <Modal
      open={state.mode !== 'closed'}
      onClose={onClose}
      title={editing ? 'Editar lembrete' : 'Novo na agenda'}
      description={
        isRecurringEdit
          ? 'Este item se repete: as alterações valem para toda a série.'
          : 'Lembrete, compromisso ou aviso.'
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          {editing && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="size-4" />}
              onClick={handleDelete}
              disabled={busy}
            >
              {confirmDelete ? 'Confirmar exclusão' : isRecurringEdit ? 'Excluir série' : 'Excluir'}
            </Button>
          )}
          <div className="ml-auto flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="reminder-form"
              disabled={busy || (editId != null && loadingEdit)}
            >
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      }
    >
      {editId != null && loadingEdit ? (
        <div className="h-72 animate-pulse rounded-3xl shadow-neu-inset" />
      ) : (
        <form id="reminder-form" onSubmit={submit} className="space-y-5">
          <Input
            label="Título"
            placeholder="Ex.: Dentista, pagar fatura, reunião…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={200}
          />

          <Segmented
            ariaLabel="Tipo"
            value={kind}
            onChange={setKind}
            options={REMINDER_KIND.map((k) => {
              const Icon = KIND_ICON[k];
              return {
                value: k,
                label: REMINDER_KIND_LABEL[k],
                icon: <Icon className="size-3.5 shrink-0" />,
              };
            })}
          />

          <Field label="Categoria">
            <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-2">
              {[{ id: null, name: 'Sem categoria', color: NO_CATEGORY_COLOR }, ...categories].map(
                (c) => {
                  const active = categoryId === c.id;
                  return (
                    <button
                      key={c.id ?? 'none'}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCategoryId(c.id)}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                        active ? 'shadow-neu-inset-sm' : 'shadow-neu-sm hover:text-accent-ink',
                      )}
                      style={
                        active
                          ? { boxShadow: `var(--shadow-neu-inset-sm), 0 0 0 1.5px ${c.color}` }
                          : undefined
                      }
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
                      />
                      {c.name}
                    </button>
                  );
                },
              )}
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Data"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={errors.date}
            />
            <div className="flex items-end pb-2">
              <Toggle checked={allDay} onChange={setAllDay} label="Dia todo" />
            </div>
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-5">
              <Input
                label="Início"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <Input
                label="Fim (opcional)"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                error={errors.endTime}
              />
            </div>
          )}

          <div className="space-y-4 rounded-3xl p-4 shadow-neu-inset-sm">
            <p className="flex items-center gap-2 px-1 text-sm font-medium">
              <Repeat className="size-4 text-accent-ink" /> Repetição
            </p>
            <Segmented
              ariaLabel="Repetição"
              value={recurrence}
              onChange={setRecurrence}
              options={RECURRENCE_OPTIONS}
            />
            {recurrence === 'weekly' && (
              <WeekdayPicker value={weekdays} onChange={setWeekdays} error={errors.weekdays} />
            )}
            {recurrence !== 'none' && (
              <Input
                label="Repetir até (opcional)"
                type="date"
                value={until}
                min={date}
                onChange={(e) => setUntil(e.target.value)}
                error={errors.until}
                hint="Em branco = sem data para acabar."
              />
            )}
          </div>

          <Textarea
            label="Observações"
            placeholder="Endereço, link da reunião, o que levar…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </form>
      )}
    </Modal>
  );
}
