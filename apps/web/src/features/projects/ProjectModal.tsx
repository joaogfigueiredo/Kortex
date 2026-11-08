import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import type { Project } from '@kortex/shared';
import { Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { toast } from '../../stores/toast';
import { useProjectMutations } from './api';
import { PROJECT_COLUMNS, columnDef, columnKeyOf, type ProjectColumnKey } from './columns';

export type ProjectModalState =
  | { mode: 'closed' }
  | { mode: 'create'; column: ProjectColumnKey }
  | { mode: 'edit'; project: Project };

/** Aceita "github.com/x" e completa com https://. */
export const normalizeUrl = (v: string) => {
  const t = v.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export function ProjectModal({
  state,
  onClose,
}: {
  state: ProjectModalState;
  onClose: () => void;
}) {
  const { create, update, remove } = useProjectMutations();
  const editing = state.mode === 'edit' ? state.project : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [column, setColumn] = useState<ProjectColumnKey>('idea');
  const [repoUrl, setRepoUrl] = useState('');
  const [deployUrl, setDeployUrl] = useState('');
  const [errors, setErrors] = useState<{ title?: string; repoUrl?: string; deployUrl?: string }>(
    {},
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (state.mode === 'closed') return;
    setTitle(editing?.title ?? '');
    setDescription(editing?.description ?? '');
    setColumn(editing ? columnKeyOf(editing) : state.mode === 'create' ? state.column : 'idea');
    setRepoUrl(editing?.repoUrl ?? '');
    setDeployUrl(editing?.deployUrl ?? '');
    setErrors({});
    setConfirmDelete(false);
  }, [state, editing]);

  const busy = create.isPending || update.isPending || remove.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const repo = normalizeUrl(repoUrl);
    const deploy = normalizeUrl(deployUrl);
    const urlOk = (u: string | null) => !u || /^https?:\/\/[^\s.]+\.\S+/i.test(u);
    const next = {
      title: title.trim() ? undefined : 'Dê um nome ao projeto',
      repoUrl: urlOk(repo) ? undefined : 'Link inválido',
      deployUrl: urlOk(deploy) ? undefined : 'Link inválido',
    };
    setErrors(next);
    if (next.title || next.repoUrl || next.deployUrl) return;

    const { status, devLevel } = columnDef(column);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      devLevel,
      repoUrl: repo,
      deployUrl: deploy,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        toast.success('Projeto atualizado');
      } else {
        await create.mutateAsync(body);
        toast.success('Projeto criado', 'Hora de construir ✦');
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
      toast.info('Projeto excluído');
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Modal
      open={state.mode !== 'closed'}
      onClose={onClose}
      size="lg"
      title={editing ? 'Editar projeto' : 'Novo projeto'}
      description={
        editing ? `Criado em ${formatDate(editing.createdAt)}` : 'Do rascunho ao deploy.'
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
              {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <div className="ml-auto flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="project-form" disabled={busy}>
              {editing ? 'Salvar' : 'Criar projeto'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="project-form" onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_15rem]">
        <div className="space-y-5">
          <Input
            label="Nome"
            placeholder="Ex.: Kortex"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={200}
          />
          <Textarea
            label="Descrição"
            placeholder="Objetivo, stack, próximos marcos…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          <Select
            label="Etapa"
            value={column}
            onChange={(e) => setColumn(e.target.value as ProjectColumnKey)}
            hint="As datas de início, conclusão e deploy são registradas automaticamente."
          >
            {PROJECT_COLUMNS.filter((c) => !c.group)
              .slice(0, 2)
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
            <optgroup label="Desenvolvimento">
              {PROJECT_COLUMNS.filter((c) => c.group).map((c) => (
                <option key={c.key} value={c.key}>
                  Desenvolvimento · {c.title}
                </option>
              ))}
            </optgroup>
            {PROJECT_COLUMNS.filter((c) => !c.group)
              .slice(2)
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
          </Select>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Repositório"
              placeholder="github.com/voce/projeto"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              error={errors.repoUrl}
              inputMode="url"
            />
            <Input
              label="Deploy"
              placeholder="meuapp.com"
              value={deployUrl}
              onChange={(e) => setDeployUrl(e.target.value)}
              error={errors.deployUrl}
              inputMode="url"
            />
          </div>
        </div>

        {editing && <Timeline project={editing} />}
      </form>
    </Modal>
  );
}

function Timeline({ project: p }: { project: Project }) {
  const steps = [
    { label: 'Criado', at: p.createdAt, color: '#B79CFF' },
    { label: 'Iniciado', at: p.startedAt, color: '#FFD166' },
    { label: 'Concluído', at: p.finishedAt, color: '#4DF5B8' },
    { label: 'Deploy', at: p.deployedAt, color: '#FF8FC7' },
  ];
  return (
    <aside className="rounded-3xl p-5 shadow-neu-inset-sm" aria-label="Linha do tempo">
      <h3 className="mb-4 text-xs font-semibold tracking-wider text-muted uppercase">
        Linha do tempo
      </h3>
      <ol className="relative space-y-5">
        <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-line" />
        {steps.map((s) => (
          <li key={s.label} className="relative flex gap-3">
            <span
              className={clsx(
                'relative mt-1 size-[11px] shrink-0 rounded-full',
                !s.at && 'bg-line',
              )}
              style={s.at ? { background: s.color, boxShadow: `0 0 8px ${s.color}` } : undefined}
            />
            <div>
              <p className={clsx('text-sm font-medium', !s.at && 'text-muted')}>{s.label}</p>
              <p className="text-xs text-muted">{s.at ? formatDate(s.at) : '—'}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
