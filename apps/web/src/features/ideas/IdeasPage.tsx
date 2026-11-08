import { useMemo, useState } from 'react';
import { Lightbulb, Plus } from 'lucide-react';
import { IDEA_STATUS, IDEA_STATUS_LABEL, type Idea, type IdeaStatus } from '@kortex/shared';
import { Board, type BoardColumn } from '../../components/kanban/Board';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Card, SearchField } from '../../components/ui';
import { matchesQuery, normalize, toFullIndex } from '../../lib/kanban';
import { useIdeaMutations, useIdeas } from './api';
import { IdeaCard } from './IdeaCard';
import { IdeaModal, type IdeaModalState } from './IdeaModal';

export const IDEA_COLUMN_COLOR: Record<IdeaStatus, string> = {
  organized: '#B79CFF',
  started: '#FFD166',
  developing: '#6FE3FF',
  done: '#4DF5B8',
};

export function IdeasPage() {
  const { data: ideas = [], isLoading, isError } = useIdeas();
  const { move } = useIdeaMutations();
  const [modal, setModal] = useState<IdeaModalState>({ mode: 'closed' });
  const [query, setQuery] = useState('');

  const q = normalize(query.trim());

  const columns: BoardColumn<Idea>[] = useMemo(() => {
    const matches = (i: Idea) => matchesQuery(q, i.title, i.description);
    return IDEA_STATUS.map((status) => ({
      id: status,
      title: IDEA_STATUS_LABEL[status],
      color: IDEA_COLUMN_COLOR[status],
      items: ideas.filter((i) => i.status === status && matches(i)),
    }));
  }, [ideas, q]);

  /**
   * Com busca ativa a coluna exibida é parcial: converte o índice visível
   * para o índice real (posiciona antes do próximo card visível).
   */
  function handleMove(id: number, status: string, visibleIndex: number) {
    const target = status as IdeaStatus;
    if (!q) return move(id, target, visibleIndex);
    const visible = columns.find((c) => c.id === target)!.items;
    const full = ideas.filter((i) => i.status === target);
    move(id, target, toFullIndex(visible, full, id, visibleIndex));
  }

  const total = ideas.length;
  const done = ideas.filter((i) => i.status === 'done').length;

  return (
    <>
      <PageHeader
        title="Ideias"
        subtitle={
          total
            ? `${total} ${total === 1 ? 'ideia' : 'ideias'} · ${done} finalizadas`
            : 'Registre e evolua seus insights'
        }
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create', status: 'organized' })}
          >
            Nova ideia
          </Button>
        }
      />

      {total > 0 && (
        <SearchField
          label="Buscar ideias"
          placeholder="Buscar ideias…"
          value={query}
          onChange={setQuery}
          className="mb-6"
        />
      )}

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar as ideias. A API está rodando?
        </Card>
      )}

      {isLoading ? (
        <BoardSkeleton />
      ) : total === 0 ? (
        <EmptyState onCreate={() => setModal({ mode: 'create', status: 'organized' })} />
      ) : (
        <Board
          columns={columns}
          renderCard={(idea, { overlay }) => <IdeaCard idea={idea} overlay={overlay} />}
          onMove={handleMove}
          onOpen={(idea) => setModal({ mode: 'edit', idea })}
          onAdd={(status) => setModal({ mode: 'create', status: status as IdeaStatus })}
          emptyLabel={q ? 'Nada encontrado aqui' : 'Arraste ideias para cá'}
        />
      )}

      <IdeaModal state={modal} onClose={() => setModal({ mode: 'closed' })} />
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="mx-auto max-w-md py-10 text-center">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl text-accent-ink shadow-neu-inset">
        <Lightbulb className="size-7" style={{ filter: 'drop-shadow(0 0 6px var(--k-accent))' }} />
      </span>
      <h2 className="text-lg font-semibold">Nenhuma ideia ainda</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
        Anote aquele insight antes que ele escape. Depois é só arrastar conforme ele evolui.
      </p>
      <Button
        variant="primary"
        className="mt-6"
        icon={<Plus className="size-4" />}
        onClick={onCreate}
      >
        Registrar primeira ideia
      </Button>
    </Card>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {IDEA_STATUS.map((s) => (
        <div key={s} className="w-[84vw] shrink-0 sm:w-80 lg:w-auto lg:flex-1">
          <div className="mb-3 h-5 w-32 animate-pulse rounded-full bg-line" />
          <div className="h-64 animate-pulse rounded-3xl shadow-neu-inset" />
        </div>
      ))}
    </div>
  );
}
