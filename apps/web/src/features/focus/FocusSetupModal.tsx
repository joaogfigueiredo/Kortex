import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Hourglass, Play, Timer } from 'lucide-react';
import { Button, Field, Input, Modal, Segmented, Select } from '../../components/ui';
import { enterFullscreen } from '../../lib/focusDevice';
import { useFocus, type FocusMode, type FocusTarget } from '../../stores/focus';
import { useProjects } from '../projects/api';
import { useSubjects } from '../studies/api';

type Kind = 'study' | 'project' | 'work' | 'other';
const PRESETS = [15, 25, 50, 90];

/** Configura e inicia uma sessão de foco. */
export function FocusSetupModal() {
  const { setupOpen, closeSetup, preset, start, session } = useFocus();
  const { data: subjects = [] } = useSubjects();
  const { data: projects = [] } = useProjects();
  const activeSubjects = subjects.filter((s) => !s.archived);
  const openProjects = projects.filter((p) => p.status !== 'deployed');

  const [kind, setKind] = useState<Kind>('study');
  const [refId, setRefId] = useState('');
  const [mode, setMode] = useState<FocusMode>('timer');
  const [minutes, setMinutes] = useState('25');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!setupOpen) return;
    setError(undefined);
    setNote('');
    if (preset) {
      setKind(
        preset.module === 'study' ? 'study' : preset.module === 'project' ? 'project' : 'other',
      );
      setRefId(preset.refId ? String(preset.refId) : '');
    } else {
      setKind('study');
      setRefId('');
    }
  }, [setupOpen, preset]);

  // Seleciona o primeiro item disponível ao trocar o tipo.
  useEffect(() => {
    if (kind === 'study' && !activeSubjects.some((s) => String(s.id) === refId))
      setRefId(activeSubjects[0] ? String(activeSubjects[0].id) : '');
    if (kind === 'project' && !openProjects.some((p) => String(p.id) === refId))
      setRefId(openProjects[0] ? String(openProjects[0].id) : '');
  }, [kind, activeSubjects.length, openProjects.length]); // depende só do tipo e do tamanho das listas

  async function submit(e: FormEvent) {
    e.preventDefault();
    const mins = Number(minutes);
    if (mode === 'timer' && (!Number.isInteger(mins) || mins < 1 || mins > 600))
      return setError('Entre 1 e 600 minutos');

    let target: FocusTarget;
    if (kind === 'study') {
      const s = activeSubjects.find((x) => String(x.id) === refId);
      target = s
        ? { module: 'study', refId: s.id, label: `Estudo · ${s.name}` }
        : { module: 'study', refId: null, label: 'Estudo' };
    } else if (kind === 'project') {
      const p = openProjects.find((x) => String(x.id) === refId);
      target = p
        ? { module: 'project', refId: p.id, label: `Projeto · ${p.title}` }
        : { module: 'project', refId: null, label: 'Projeto' };
    } else if (kind === 'work') {
      target = { module: 'work', refId: null, label: 'Trabalho' };
    } else {
      target = { module: 'other', refId: null, label: note.trim() || 'Foco' };
    }

    void enterFullscreen(); // precisa do gesto do usuário (o clique de "Começar")
    start({ mode, targetSec: mode === 'timer' ? mins * 60 : 0, target, note: note.trim() });
  }

  if (session) return null;

  return (
    <Modal
      open={setupOpen}
      onClose={closeSetup}
      size="sm"
      title="Modo Foco"
      description="Tela cheia, sem distrações. O tempo vai para o seu histórico."
      footer={
        <Button
          type="submit"
          form="focus-form"
          variant="primary"
          size="lg"
          className="w-full"
          icon={<Play className="size-5" />}
        >
          Começar
        </Button>
      }
    >
      <form id="focus-form" onSubmit={submit} className="space-y-5">
        <Field label="No que vai focar?">
          <Segmented<Kind>
            ariaLabel="Tipo de foco"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'study', label: 'Estudo' },
              { value: 'project', label: 'Projeto' },
              { value: 'work', label: 'Trabalho' },
              { value: 'other', label: 'Outro' },
            ]}
          />
        </Field>

        {kind === 'study' &&
          (activeSubjects.length ? (
            <Select aria-label="Matéria" value={refId} onChange={(e) => setRefId(e.target.value)}>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="px-1 text-xs text-muted">
              Nenhuma matéria ativa. A sessão fica como "Estudo" geral.
            </p>
          ))}
        {kind === 'project' &&
          (openProjects.length ? (
            <Select aria-label="Projeto" value={refId} onChange={(e) => setRefId(e.target.value)}>
              {openProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          ) : (
            <p className="px-1 text-xs text-muted">Nenhum projeto em andamento.</p>
          ))}

        <Segmented<FocusMode>
          ariaLabel="Modo"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'timer', label: 'Timer', icon: <Hourglass className="size-3.5" /> },
            { value: 'stopwatch', label: 'Cronômetro', icon: <Timer className="size-3.5" /> },
          ]}
        />

        {mode === 'timer' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Duração">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={minutes === String(p)}
                  onClick={() => {
                    setMinutes(String(p));
                    setError(undefined);
                  }}
                  className={clsx(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold tabular-nums transition-all',
                    minutes === String(p)
                      ? 'bg-accent text-on-accent shadow-glow'
                      : 'shadow-neu-sm hover:text-accent-ink',
                  )}
                >
                  {p} min
                </button>
              ))}
            </div>
            <Input
              aria-label="Minutos"
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
          </div>
        )}

        <Input
          label={kind === 'other' ? 'O que é?' : 'Nota (opcional)'}
          placeholder={
            kind === 'other' ? 'Ex.: Escrever o relatório' : 'Ex.: capítulo 3, exercícios…'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
        />
      </form>
    </Modal>
  );
}
