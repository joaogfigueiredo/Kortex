import { useEffect, useState, type FormEvent } from 'react';
import { FolderKanban, Rocket, Trash2 } from 'lucide-react';
import { IDEA_STATUS, IDEA_STATUS_LABEL, type Idea, type IdeaStatus } from '@kortex/shared';
import { Button, Input, Modal, Segmented, Select, Textarea } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { toast } from '../../stores/toast';
import { useIdeaMutations } from './api';

export type IdeaModalState =
  { mode: 'closed' } | { mode: 'create'; status: IdeaStatus } | { mode: 'edit'; idea: Idea };

export function IdeaModal({ state, onClose }: { state: IdeaModalState; onClose: () => void }) {
  const { create, update, remove, promote } = useIdeaMutations();
  const editing = state.mode === 'edit' ? state.idea : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IdeaStatus>('organized');
  const [priority, setPriority] = useState('2');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();

  // Preenche o formulário sempre que o modal abre.
  useEffect(() => {
    if (state.mode === 'closed') return;
    setTitle(editing?.title ?? '');
    setDescription(editing?.description ?? '');
    setStatus(editing?.status ?? (state.mode === 'create' ? state.status : 'organized'));
    setPriority(String(editing?.priority ?? 2));
    setConfirmDelete(false);
    setError(undefined);
  }, [state, editing]);

  const busy = create.isPending || update.isPending || remove.isPending || promote.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Dê um título para a ideia');
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority: Number(priority),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        toast.success('Ideia atualizada');
      } else {
        await create.mutateAsync(body);
        toast.success('Ideia registrada', 'Bora tirar do papel ✦');
      }
      onClose();
    } catch {
      /* erro já exibido via toast no hook */
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(editing.id);
      toast.info('Ideia excluída');
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  async function handlePromote() {
    if (!editing) return;
    try {
      await promote.mutateAsync(editing.id);
      toast.success('Ideia virou projeto!', 'Ela aparece na coluna "Ideias" de Projetos.');
      onClose();
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Modal
      open={state.mode !== 'closed'}
      onClose={onClose}
      title={editing ? 'Editar ideia' : 'Nova ideia'}
      description={
        editing
          ? `Criada em ${formatDate(editing.createdAt)}${
              editing.completedAt ? ` · finalizada em ${formatDate(editing.completedAt)}` : ''
            }`
          : 'Registre agora, organize depois.'
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
            <Button variant="primary" type="submit" form="idea-form" disabled={busy}>
              {editing ? 'Salvar' : 'Criar ideia'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="idea-form" onSubmit={submit} className="space-y-5">
        <Input
          label="Título"
          placeholder="Ex.: App que organiza receitas por ingrediente"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(undefined);
          }}
          error={error}
          maxLength={200}
          autoFocus
        />
        <Textarea
          label="Descrição"
          placeholder="Contexto, problema, público, primeiros passos…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as IdeaStatus)}
          >
            {IDEA_STATUS.map((s) => (
              <option key={s} value={s}>
                {IDEA_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <div className="space-y-1.5">
            <span className="block px-1 text-sm font-medium">Prioridade</span>
            <Segmented
              ariaLabel="Prioridade"
              value={priority}
              onChange={setPriority}
              options={[
                { value: '1', label: 'Alta' },
                { value: '2', label: 'Média' },
                { value: '3', label: 'Baixa' },
              ]}
            />
          </div>
        </div>

        {editing && (
          <div className="flex items-center gap-3 rounded-2xl p-4 shadow-neu-inset-sm">
            {editing.promotedProjectId ? (
              <>
                <FolderKanban className="size-5 shrink-0 text-accent-ink" />
                <p className="text-sm text-muted">Esta ideia já virou um projeto.</p>
              </>
            ) : (
              <>
                <Rocket className="size-5 shrink-0 text-accent-ink" />
                <p className="flex-1 text-sm text-muted">Pronta para virar projeto?</p>
                <Button size="sm" onClick={handlePromote} disabled={busy}>
                  Promover
                </Button>
              </>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
