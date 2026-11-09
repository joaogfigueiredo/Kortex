import { useEffect, useId, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import {
  FINANCE_KIND,
  FINANCE_KIND_LABEL,
  FINANCE_STATUS,
  FINANCE_STATUS_LABEL,
  type FinanceActivity,
  type FinanceKind,
  type FinanceStatus,
} from '@kortex/shared';
import { Button, Field, Input, Modal, Segmented, Select, Textarea } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { centsToInput, parseMoney } from '../../lib/money';
import { toast } from '../../stores/toast';
import { useProjects } from '../projects/api';
import { useFinanceMutations } from './api';
import { FinanceTimeline } from './FinanceTimeline';

export type FinanceModalState =
  | { mode: 'closed' }
  | { mode: 'create'; status: FinanceStatus }
  | { mode: 'edit'; activity: FinanceActivity };

export function FinanceModal({
  state,
  onClose,
}: {
  state: FinanceModalState;
  onClose: () => void;
}) {
  const { create, update, remove } = useFinanceMutations();
  const { data: projects = [] } = useProjects();
  const editing = state.mode === 'edit' ? state.activity : null;
  /** Muda só quando OUTRO item é aberto: refetches não resetam o formulário. */
  const openKey =
    state.mode === 'closed'
      ? null
      : state.mode === 'edit'
        ? `edit:${state.activity.id}`
        : `create:${state.status}`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<FinanceStatus>('idea');
  const [kind, setKind] = useState<FinanceKind>('business');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [projectId, setProjectId] = useState('');
  const [errors, setErrors] = useState<{ title?: string; expected?: string; actual?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<'details' | 'history'>('details');

  useEffect(() => {
    if (state.mode === 'closed') return;
    setTitle(editing?.title ?? '');
    setDescription(editing?.description ?? '');
    setStatus(editing?.status ?? (state.mode === 'create' ? state.status : 'idea'));
    setKind(editing?.kind ?? 'business');
    setExpected(centsToInput(editing?.expectedMonthlyCents));
    setActual(centsToInput(editing?.actualMonthlyCents));
    setProjectId(editing?.projectId ? String(editing.projectId) : '');
    setErrors({});
    setConfirmDelete(false);
    setTab('details');
  }, [openKey]); // reset intencional só ao abrir outro item

  const busy = create.isPending || update.isPending || remove.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const exp = parseMoney(expected);
    const act = parseMoney(actual);
    const next = {
      title: title.trim() ? undefined : 'Dê um nome à atividade',
      expected: Number.isNaN(exp) ? 'Valor inválido (ex.: 3.500,00)' : undefined,
      actual: Number.isNaN(act) ? 'Valor inválido (ex.: 3.500,00)' : undefined,
    };
    setErrors(next);
    if (next.title || next.expected || next.actual) {
      setTab('details');
      return;
    }
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      kind,
      expectedMonthlyCents: exp,
      actualMonthlyCents: act,
      projectId: projectId ? Number(projectId) : null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        toast.success('Atividade atualizada', 'As mudanças foram registradas no histórico.');
      } else {
        await create.mutateAsync(body);
        toast.success('Atividade criada');
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
      toast.info('Atividade excluída');
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
      title={editing ? editing.title : 'Nova atividade financeira'}
      description={
        editing
          ? `${FINANCE_KIND_LABEL[editing.kind]} · criada em ${formatDate(editing.createdAt)}`
          : 'Fonte de renda, negócio ou ideia de monetização.'
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
              Fechar
            </Button>
            <Button variant="primary" type="submit" form="finance-form" disabled={busy}>
              {editing ? 'Salvar' : 'Criar atividade'}
            </Button>
          </div>
        </div>
      }
    >
      {editing && (
        <Segmented
          ariaLabel="Seção"
          value={tab}
          onChange={setTab}
          className="mb-5 md:hidden"
          options={[
            { value: 'details', label: 'Detalhes' },
            { value: 'history', label: 'Histórico e avisos' },
          ]}
        />
      )}
      <div
        className={clsx('grid grid-cols-1 gap-6', editing && 'md:grid-cols-[1fr_minmax(0,24rem)]')}
      >
        <form
          id="finance-form"
          onSubmit={submit}
          className={clsx('space-y-5', editing && tab !== 'details' && 'hidden md:block')}
        >
          <Input
            label="Nome"
            placeholder="Ex.: Trabalho principal, Canal no YouTube…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={200}
          />
          <div
            className={clsx('grid grid-cols-1 gap-5 sm:grid-cols-2', editing && 'md:grid-cols-1')}
          >
            <Select
              label="Tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value as FinanceKind)}
            >
              {FINANCE_KIND.map((k) => (
                <option key={k} value={k}>
                  {FINANCE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as FinanceStatus)}
            >
              {FINANCE_STATUS.map((s) => (
                <option key={s} value={s}>
                  {FINANCE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <MoneyField
              label="Esperada / mês"
              value={expected}
              onChange={setExpected}
              error={errors.expected}
            />
            <MoneyField
              label="Real / mês"
              value={actual}
              onChange={setActual}
              error={errors.actual}
            />
          </div>
          <Textarea
            label="Descrição"
            placeholder="Como funciona, clientes, próximos passos…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <Select
            label="Projeto vinculado"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            hint="Opcional: conecte a um projeto do seu Kanban de Projetos."
          >
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </form>

        {editing && (
          <div className={clsx(tab !== 'history' && 'hidden md:block')}>
            <FinanceTimeline activityId={editing.id} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted">
          R$
        </span>
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const c = parseMoney(value);
            if (c != null && !Number.isNaN(c)) onChange(centsToInput(c));
          }}
          aria-invalid={error ? true : undefined}
          className="pl-11 tabular-nums"
        />
      </div>
    </Field>
  );
}
