import { useMemo, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import type { Project } from '@kortex/shared';
import { Board, type BoardColumn } from '../../components/kanban/Board';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Card, SearchField } from '../../components/ui';
import { matchesQuery, normalize, toFullIndex } from '../../lib/kanban';
import { useProjectMutations, useProjects } from './api';
import {
  PROJECT_COLUMNS,
  PROJECT_GROUPS,
  columnDef,
  columnKeyOf,
  type ProjectColumnKey,
} from './columns';
import { ProjectCard } from './ProjectCard';
import { ProjectModal, type ProjectModalState } from './ProjectModal';

export function ProjectsPage() {
  const { data: projects = [], isLoading, isError } = useProjects();
  const { move } = useProjectMutations();
  const [modal, setModal] = useState<ProjectModalState>({ mode: 'closed' });
  const [query, setQuery] = useState('');
  const q = normalize(query.trim());

  const columns: BoardColumn<Project>[] = useMemo(
    () =>
      PROJECT_COLUMNS.map((c) => ({
        id: c.key,
        title: c.title,
        color: c.color,
        group: c.group,
        items: projects.filter(
          (p) => columnKeyOf(p) === c.key && matchesQuery(q, p.title, p.description),
        ),
      })),
    [projects, q],
  );

  function handleMove(id: number, key: string, visibleIndex: number) {
    const { status, devLevel } = columnDef(key);
    const index = q
      ? toFullIndex(
          columns.find((c) => c.id === key)!.items,
          projects.filter((p) => columnKeyOf(p) === key),
          id,
          visibleIndex,
        )
      : visibleIndex;
    move(id, status, devLevel, index);
  }

  const total = projects.length;
  const live = projects.filter((p) => p.status === 'deployed').length;
  const inDev = projects.filter((p) => p.status === 'development').length;

  return (
    <>
      <PageHeader
        title="Projetos"
        subtitle={
          total
            ? `${total} ${total === 1 ? 'projeto' : 'projetos'} · ${inDev} em desenvolvimento · ${live} no ar`
            : 'Do rascunho ao deploy'
        }
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create', column: 'idea' })}
          >
            Novo projeto
          </Button>
        }
      />

      {total > 0 && (
        <SearchField
          label="Buscar projetos"
          placeholder="Buscar projetos…"
          value={query}
          onChange={setQuery}
          className="mb-6"
        />
      )}

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar os projetos. A API está rodando?
        </Card>
      )}

      {isLoading ? null : total === 0 ? (
        <Card className="mx-auto max-w-md py-10 text-center">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl text-accent-ink shadow-neu-inset">
            <FolderKanban
              className="size-7"
              style={{ filter: 'drop-shadow(0 0 6px var(--k-accent))' }}
            />
          </span>
          <h2 className="text-lg font-semibold">Nenhum projeto ainda</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Crie um projeto ou promova uma ideia. Ele avança das ideias até o deploy.
          </p>
          <Button
            variant="primary"
            className="mt-6"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create', column: 'idea' })}
          >
            Criar primeiro projeto
          </Button>
        </Card>
      ) : (
        <Board
          boardId="projects"
          layout="scroll"
          columns={columns}
          groups={PROJECT_GROUPS}
          renderCard={(p, { overlay }) => <ProjectCard project={p} overlay={overlay} />}
          onMove={handleMove}
          onOpen={(project) => setModal({ mode: 'edit', project })}
          onAdd={(key) => setModal({ mode: 'create', column: key as ProjectColumnKey })}
          emptyLabel={q ? 'Nada encontrado aqui' : 'Arraste projetos para cá'}
        />
      )}

      <ProjectModal state={modal} onClose={() => setModal({ mode: 'closed' })} />
    </>
  );
}
