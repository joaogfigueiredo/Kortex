import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Dumbbell, Flame, Trash2 } from 'lucide-react';
import type { WellnessDay } from '@kortex/shared';
import { Button, Card, CardHeader, Input } from '../../components/ui';
import { toast } from '../../stores/toast';
import { useHealthMutations, useWorkoutTypes } from './api';

const DEFAULT_TYPES = [
  'Musculação',
  'Corrida',
  'Caminhada',
  'Bike',
  'Funcional',
  'Yoga',
  'Natação',
];
const DURATIONS = [20, 30, 45, 60, 90];
const INTENSITY_LABEL = ['', 'Leve', 'Moderada', 'Média', 'Forte', 'Máxima'];

/** Medidor de intensidade 1–5 (chamas). */
export function IntensityMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`Intensidade ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Flame
          key={n}
          className={clsx('size-3', n <= value ? 'text-amber' : 'text-line')}
          style={n <= value ? { filter: 'drop-shadow(0 0 3px #FFD166)' } : undefined}
          fill={n <= value ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}

export function WorkoutsCard({ day }: { day: WellnessDay | undefined }) {
  const { addWorkout, removeWorkout } = useHealthMutations();
  const { data: usedTypes = [] } = useWorkoutTypes();
  const [type, setType] = useState('');
  const [minutes, setMinutes] = useState('45');
  const [intensity, setIntensity] = useState(3);
  const [error, setError] = useState<string>();

  // Tipos já usados primeiro, depois os padrões (sem repetir).
  const chips = [...usedTypes, ...DEFAULT_TYPES.filter((t) => !usedTypes.includes(t))].slice(0, 8);
  const total = (day?.workouts ?? []).reduce((n, w) => n + (w.durationMin ?? 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!day) return;
    if (!type.trim()) return setError('Escolha ou digite o tipo');
    const mins = Number(minutes);
    try {
      await addWorkout.mutateAsync({
        date: day.date,
        type: type.trim(),
        durationMin: Number.isInteger(mins) && mins > 0 ? mins : null,
        intensity,
      });
      toast.success(
        `${type.trim()} registrado`,
        mins ? `${mins} min · ${INTENSITY_LABEL[intensity]}` : undefined,
      );
      setType('');
      setError(undefined);
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<Dumbbell className="size-5" />}
        title="Treinos"
        subtitle={
          day?.workouts.length
            ? `${day.workouts.length} no dia · ${total} min`
            : 'Nenhum treino neste dia'
        }
      />

      <form onSubmit={submit} className="space-y-4 rounded-3xl p-4 shadow-neu-inset-sm">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de treino">
          {chips.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => {
                setType(t);
                setError(undefined);
              }}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                type === t
                  ? 'bg-accent text-on-accent shadow-glow'
                  : 'shadow-neu-sm hover:text-accent-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Input
          aria-label="Tipo de treino"
          placeholder="Ou digite outro tipo…"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setError(undefined);
          }}
          error={error}
          maxLength={60}
        />
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={minutes === String(d)}
              onClick={() => setMinutes(String(d))}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition-all',
                minutes === String(d)
                  ? 'bg-accent text-on-accent shadow-glow'
                  : 'shadow-neu-sm hover:text-accent-ink',
              )}
            >
              {d} min
            </button>
          ))}
          <Input
            aria-label="Minutos"
            type="number"
            min={1}
            max={1440}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-9 w-20! text-center"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <span className="text-xs text-muted">Intensidade</span>
          <div role="radiogroup" aria-label="Intensidade" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={intensity === n}
                aria-label={`${n} – ${INTENSITY_LABEL[n]}`}
                title={INTENSITY_LABEL[n]}
                onClick={() => setIntensity(n)}
                className="grid size-8 place-items-center rounded-lg transition-all hover:scale-110"
              >
                <Flame
                  className={clsx('size-5', n <= intensity ? 'text-amber' : 'text-muted/40')}
                  fill={n <= intensity ? 'currentColor' : 'none'}
                  style={n <= intensity ? { filter: 'drop-shadow(0 0 4px #FFD166)' } : undefined}
                />
              </button>
            ))}
          </div>
          <span className="text-xs font-medium">{INTENSITY_LABEL[intensity]}</span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="w-full sm:ml-auto sm:w-auto"
            disabled={addWorkout.isPending}
          >
            Registrar
          </Button>
        </div>
      </form>

      {day && day.workouts.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {day.workouts.map((w) => (
            <li
              key={w.id}
              className="group flex items-center gap-3 rounded-2xl bg-bg px-4 py-3 shadow-neu-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.type}</p>
                <p className="flex items-center gap-2 text-xs text-muted">
                  {w.durationMin != null && (
                    <span className="tabular-nums">{w.durationMin} min</span>
                  )}
                  {w.intensity != null && <IntensityMeter value={w.intensity} />}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Excluir ${w.type}`}
                onClick={() =>
                  removeWorkout.mutate(w.id, { onSuccess: () => toast.info('Treino excluído') })
                }
                className="text-muted transition-colors hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
