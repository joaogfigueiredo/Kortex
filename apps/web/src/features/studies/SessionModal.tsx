import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import type { StudySubject } from '@kortex/shared';
import { Button, Field, Input, Modal, Textarea } from '../../components/ui';
import { nowTimeStr, todayStr } from '../../lib/dates';
import { formatDuration } from '../../lib/duration';
import { toast } from '../../stores/toast';
import { useStudyMutations } from './api';

const PRESETS = [15, 25, 45, 60, 90];

/** Registro rápido de uma sessão de estudo (manual). */
export function SessionModal({
  subject,
  onClose,
}: {
  subject: StudySubject | null;
  onClose: () => void;
}) {
  const { addSession } = useStudyMutations();
  const [minutes, setMinutes] = useState('25');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTimeStr());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!subject) return;
    setMinutes('25');
    setDate(todayStr());
    setTime(nowTimeStr());
    setNote('');
    setError(undefined);
  }, [subject]);

  const mins = Number(minutes);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject) return;
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440)
      return setError('Entre 1 e 1440 minutos');
    try {
      await addSession.mutateAsync({
        refId: subject.id,
        startedAt: `${date}T${time}`,
        durationSec: mins * 60,
        note: note.trim() || null,
      });
      toast.success(`${formatDuration(mins * 60)} de ${subject.name}`, 'Sessão registrada ✦');
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Modal
      open={subject != null}
      onClose={onClose}
      size="sm"
      title="Registrar sessão"
      description={subject ? subject.name : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="session-form"
            disabled={addSession.isPending}
          >
            Registrar
          </Button>
        </>
      }
    >
      <form id="session-form" onSubmit={submit} className="space-y-5">
        <Field label="Duração">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de duração">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={mins === p}
                onClick={() => setMinutes(String(p))}
                className={clsx(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold tabular-nums transition-all',
                  mins === p
                    ? 'bg-accent text-on-accent shadow-glow'
                    : 'shadow-neu-sm hover:text-accent-ink',
                )}
              >
                {formatDuration(p * 60)}
              </button>
            ))}
          </div>
        </Field>
        <Input
          label="Minutos"
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => {
            setMinutes(e.target.value);
            setError(undefined);
          }}
          error={error}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dia"
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Início"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Textarea
          label="O que estudou? (opcional)"
          rows={2}
          placeholder="Capítulo, exercícios, vídeo…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>
    </Modal>
  );
}
