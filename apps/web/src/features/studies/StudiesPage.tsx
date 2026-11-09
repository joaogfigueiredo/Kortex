import { useState, type ReactNode } from 'react';
import { BookOpen, Clock, Flame, GraduationCap, Plus } from 'lucide-react';
import { STUDY_LEVEL_LABEL, type StudySubject } from '@kortex/shared';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Card, Segmented } from '../../components/ui';
import { formatDuration } from '../../lib/duration';
import { toast } from '../../stores/toast';
import { useStudyMutations, useStudySummary, useSubjects } from './api';
import { nextLevel } from './meta';
import { SessionModal } from './SessionModal';
import { SubjectCard } from './SubjectCard';
import { SubjectModal, type SubjectModalState } from './SubjectModal';
import { WeekBars } from '../../components/charts/WeekBars';

export function StudiesPage() {
  const { data: subjects = [], isLoading, isError } = useSubjects();
  const { data: summary } = useStudySummary();
  const { update } = useStudyMutations();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [modal, setModal] = useState<SubjectModalState>({ mode: 'closed' });
  const [logFor, setLogFor] = useState<StudySubject | null>(null);

  // Mantém o modal sincronizado com a lista (estatísticas atualizadas).
  const modalState: SubjectModalState =
    modal.mode === 'edit'
      ? { mode: 'edit', subject: subjects.find((s) => s.id === modal.subject.id) ?? modal.subject }
      : modal;

  const active = subjects.filter((s) => !s.archived);
  const archived = subjects.filter((s) => s.archived);
  const shown = tab === 'active' ? active : archived;

  async function levelUp(s: StudySubject) {
    const next = nextLevel(s.level);
    if (!next) return;
    try {
      await update.mutateAsync({ id: s.id, level: next, progress: 0 });
      toast.success(
        `${s.name}: ${STUDY_LEVEL_LABEL[next]}!`,
        'Subiu de nível. Progresso reiniciado ✦',
      );
    } catch {
      /* toast no hook */
    }
  }

  return (
    <>
      <PageHeader
        title="Estudos"
        subtitle="Acompanhe cada matéria, do básico ao avançado"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create' })}
          >
            Nova matéria
          </Button>
        }
      />

      {subjects.length > 0 && summary && (
        <section
          aria-label="Resumo"
          className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        >
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-1 lg:grid-rows-3">
            <Stat
              icon={<Clock className="size-4" />}
              color="#6FE3FF"
              label="Últimos 7 dias"
              value={formatDuration(summary.weekSec)}
            />
            <Stat
              icon={<Flame className="size-4" />}
              color="#FFD166"
              label="Sequência"
              value={`${summary.streak} ${summary.streak === 1 ? 'dia' : 'dias'}`}
            />
            <Stat
              icon={<BookOpen className="size-4" />}
              color="#B79CFF"
              label="Matérias ativas"
              value={String(active.length)}
            />
          </div>
          <Card className="p-5">
            <h2 className="mb-5 text-sm font-semibold">Tempo de estudo por dia</h2>
            <WeekBars
              days={summary.last7.map((d) => ({ date: d.date, value: d.sec }))}
              title="Tempo de estudo por dia, últimos 7 dias"
              format={formatDuration}
            />
          </Card>
        </section>
      )}

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar. A API está rodando?
        </Card>
      )}

      {archived.length > 0 && (
        <Segmented
          ariaLabel="Mostrar"
          value={tab}
          onChange={setTab}
          className="mb-6 max-w-xs"
          options={[
            { value: 'active', label: `Ativas (${active.length})` },
            { value: 'archived', label: `Arquivadas (${archived.length})` },
          ]}
        />
      )}

      {isLoading ? null : subjects.length === 0 ? (
        <Card className="mx-auto max-w-md py-10 text-center">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl text-accent-ink shadow-neu-inset">
            <GraduationCap
              className="size-7"
              style={{ filter: 'drop-shadow(0 0 6px var(--k-accent))' }}
            />
          </span>
          <h2 className="text-lg font-semibold">O que você está aprendendo?</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Crie uma matéria e registre suas sessões. O Kortex acompanha o tempo, o nível e a
            constância.
          </p>
          <Button
            variant="primary"
            className="mt-6"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create' })}
          >
            Criar primeira matéria
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              onOpen={() => setModal({ mode: 'edit', subject: s })}
              onLog={() => setLogFor(s)}
              onLevelUp={() => levelUp(s)}
            />
          ))}
        </div>
      )}

      <SubjectModal state={modalState} onClose={() => setModal({ mode: 'closed' })} />
      <SessionModal subject={logFor} onClose={() => setLogFor(null)} />
    </>
  );
}

function Stat({
  icon,
  color,
  label,
  value,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col justify-center rounded-3xl bg-bg p-4 shadow-neu lg:flex-row lg:items-center lg:justify-start lg:gap-4 lg:px-6">
      <span
        className="mb-2 grid size-8 place-items-center rounded-xl shadow-neu-inset-sm lg:mb-0"
        style={{ color, filter: `drop-shadow(0 0 4px ${color}88)` }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted lg:text-xs">{label}</p>
        <p className="text-base font-bold tracking-tight whitespace-nowrap tabular-nums sm:text-lg lg:text-xl">
          {value}
        </p>
      </div>
    </div>
  );
}
