import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { STUDY_LEVEL, STUDY_LEVEL_LABEL, type StudyLevel, type StudySubject } from '@kortex/shared';
import { Button, Field, Input, Modal, Segmented, Textarea } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { formatDuration, formatHours } from '../../lib/duration';
import { toast } from '../../stores/toast';
import { useSessions, useStudyMutations } from './api';
import { SUBJECT_COLORS } from './meta';

export type SubjectModalState =
  { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; subject: StudySubject };

export function SubjectModal({
  state,
  onClose,
}: {
  state: SubjectModalState;
  onClose: () => void;
}) {
  const { create, update, remove, removeSession } = useStudyMutations();
  const editing = state.mode === 'edit' ? state.subject : null;
  const { data: sessions = [] } = useSessions(editing?.id ?? null);

  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]!);
  const [level, setLevel] = useState<StudyLevel>('beginner');
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openKey =
    state.mode === 'closed' ? null : state.mode === 'edit' ? `e${state.subject.id}` : 'c';
  useEffect(() => {
    if (state.mode === 'closed') return;
    setName(editing?.name ?? '');
    setColor(editing?.color ?? SUBJECT_COLORS[0]!);
    setLevel(editing?.level ?? 'beginner');
    setProgress(editing?.progress ?? 0);
    setTarget(editing?.targetHours ? String(editing.targetHours) : '');
    setDescription(editing?.description ?? '');
    setError(undefined);
    setConfirmDelete(false);
  }, [openKey]); // reset só ao abrir outro item

  const busy = create.isPending || update.isPending || remove.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Dê um nome à matéria');
    const t = target.trim() ? Number(target.replace(',', '.')) : null;
    const body = {
      name: name.trim(),
      color,
      level,
      progress,
      targetHours: t && t > 0 ? t : null,
      description: description.trim() || null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        toast.success('Matéria atualizada');
      } else {
        await create.mutateAsync(body);
        toast.success('Matéria criada', 'Bons estudos ✦');
      }
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  async function toggleArchive() {
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, archived: !editing.archived });
      toast.info(editing.archived ? 'Matéria reativada' : 'Matéria arquivada');
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
      toast.info('Matéria excluída');
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Modal
      open={state.mode !== 'closed'}
      onClose={onClose}
      size={editing ? 'lg' : 'md'}
      title={editing ? editing.name : 'Nova matéria'}
      description={
        editing
          ? `${formatHours(editing.totalSec)} no total · ${editing.sessions} sessões`
          : 'Um tópico que você quer dominar.'
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          {editing && (
            <>
              <Button
                size="sm"
                icon={
                  editing.archived ? (
                    <ArchiveRestore className="size-4" />
                  ) : (
                    <Archive className="size-4" />
                  )
                }
                onClick={toggleArchive}
                disabled={busy}
              >
                {editing.archived ? 'Reativar' : 'Arquivar'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="size-4" />}
                onClick={handleDelete}
                disabled={busy}
              >
                {confirmDelete ? 'Excluir com sessões?' : 'Excluir'}
              </Button>
            </>
          )}
          <div className="ml-auto flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="subject-form" disabled={busy}>
              {editing ? 'Salvar' : 'Criar matéria'}
            </Button>
          </div>
        </div>
      }
    >
      <div
        className={clsx('grid grid-cols-1 gap-6', editing && 'md:grid-cols-[1fr_minmax(0,18rem)]')}
      >
        <form id="subject-form" onSubmit={submit} className="space-y-5">
          <Input
            label="Nome"
            placeholder="Ex.: Inglês, Cálculo, React…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            error={error}
            maxLength={200}
          />
          <Field label="Cor">
            <div role="radiogroup" aria-label="Cor" className="flex gap-3">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className="size-8 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    boxShadow:
                      color === c
                        ? `0 0 0 3px var(--k-bg), 0 0 0 5px ${c}, 0 0 14px ${c}`
                        : undefined,
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="Nível atual">
            <Segmented
              ariaLabel="Nível"
              value={level}
              onChange={setLevel}
              options={STUDY_LEVEL.map((l) => ({ value: l, label: STUDY_LEVEL_LABEL[l] }))}
            />
          </Field>
          <Field label={`Progresso no nível: ${progress}%`} htmlFor="progress-range">
            <input
              id="progress-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="kortex-range w-full"
              style={{
                ['--range-color' as string]: color,
                ['--range-pct' as string]: `${progress}%`,
              }}
            />
          </Field>
          <Input
            label="Meta de horas (opcional)"
            inputMode="decimal"
            placeholder="Ex.: 50"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Textarea
            label="Anotações"
            rows={3}
            placeholder="Materiais, objetivos, links…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </form>

        {editing && (
          <aside aria-label="Sessões" className="rounded-3xl p-4 shadow-neu-inset-sm">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
              Sessões recentes
            </h3>
            {sessions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhuma sessão ainda.</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="group flex items-start gap-3 rounded-2xl bg-bg px-3 py-2.5 shadow-neu-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatDuration(s.durationSec)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatDate(`${s.startedAt.slice(0, 10)}T12:00`)} ·{' '}
                        {s.startedAt.slice(11, 16)}
                        {s.source === 'focus' && ' · Modo Foco'}
                      </p>
                      {s.note && <p className="mt-1 text-xs">{s.note}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label="Excluir sessão"
                      onClick={() =>
                        removeSession.mutate(s.id, {
                          onSuccess: () => toast.info('Sessão excluída'),
                        })
                      }
                      className="text-muted transition-colors hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </Modal>
  );
}
