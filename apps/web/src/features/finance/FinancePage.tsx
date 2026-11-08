import { useMemo, useState, type ReactNode } from 'react';
import { Bell, Lightbulb, Plus, TrendingUp, Wallet } from 'lucide-react';
import {
  FINANCE_STATUS,
  FINANCE_STATUS_LABEL,
  type FinanceActivity,
  type FinanceStatus,
} from '@kortex/shared';
import { Board, type BoardColumn } from '../../components/kanban/Board';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Card, SearchField } from '../../components/ui';
import { matchesQuery, normalize, toFullIndex } from '../../lib/kanban';
import { formatCents } from '../../lib/money';
import { useFinance, useFinanceMutations } from './api';
import { FinanceCard } from './FinanceCard';
import { FinanceModal, type FinanceModalState } from './FinanceModal';
import { FINANCE_COLUMN_COLOR, alertState } from './meta';

export function FinancePage() {
  const { data: activities = [], isLoading, isError } = useFinance();
  const { move } = useFinanceMutations();
  const [modal, setModal] = useState<FinanceModalState>({ mode: 'closed' });
  const [query, setQuery] = useState('');
  const q = normalize(query.trim());

  // Mantém o modal aberto sincronizado com a lista (avisos/valores atualizados).
  const modalState: FinanceModalState =
    modal.mode === 'edit'
      ? {
          mode: 'edit',
          activity: activities.find((a) => a.id === modal.activity.id) ?? modal.activity,
        }
      : modal;

  const columns: BoardColumn<FinanceActivity>[] = useMemo(
    () =>
      FINANCE_STATUS.map((status) => ({
        id: status,
        title: FINANCE_STATUS_LABEL[status],
        color: FINANCE_COLUMN_COLOR[status],
        items: activities.filter(
          (a) => a.status === status && matchesQuery(q, a.title, a.description),
        ),
      })),
    [activities, q],
  );

  function handleMove(id: number, status: string, visibleIndex: number) {
    const target = status as FinanceStatus;
    const index = q
      ? toFullIndex(
          columns.find((c) => c.id === target)!.items,
          activities.filter((a) => a.status === target),
          id,
          visibleIndex,
        )
      : visibleIndex;
    move(id, target, index);
  }

  const sum = (list: FinanceActivity[], f: (a: FinanceActivity) => number | null) =>
    list.reduce((n, a) => n + (f(a) ?? 0), 0);
  const active = activities.filter((a) => a.status === 'active');
  const dev = activities.filter((a) => a.status === 'development');
  const ideas = activities.filter((a) => a.status === 'idea');
  const alerts = sum(activities, (a) => a.openAlerts);
  const overdue = activities.filter(
    (a) => a.openAlerts && alertState(a.nextDueAt) === 'overdue',
  ).length;

  return (
    <>
      <PageHeader
        title="Atividades financeiras"
        subtitle="Fontes de renda, negócios e ideias de monetização"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create', status: 'idea' })}
          >
            Nova atividade
          </Button>
        }
      />

      {activities.length > 0 && (
        <section aria-label="Resumo" className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            icon={<Wallet className="size-4" />}
            color="#4DF5B8"
            label="Renda ativa / mês"
            value={formatCents(
              sum(active, (a) => a.actualMonthlyCents),
              true,
            )}
            hint={`${active.length} ${active.length === 1 ? 'fonte ativa' : 'fontes ativas'}`}
          />
          <Stat
            icon={<TrendingUp className="size-4" />}
            color="#FFD166"
            label="Potencial em desenvolvimento"
            value={formatCents(
              sum(dev, (a) => a.expectedMonthlyCents),
              true,
            )}
            hint={`${dev.length} em desenvolvimento`}
          />
          <Stat
            icon={<Lightbulb className="size-4" />}
            color="#B79CFF"
            label="Ideias de renda"
            value={String(ideas.length)}
            hint="esperando sair do papel"
          />
          <Stat
            icon={<Bell className="size-4" />}
            color={overdue ? '#FF6B6B' : '#6FE3FF'}
            label="Avisos pendentes"
            value={String(alerts)}
            hint={overdue ? `${overdue} com prazo vencido` : 'nenhum vencido'}
            danger={overdue > 0}
          />
        </section>
      )}

      {activities.length > 0 && (
        <SearchField
          label="Buscar atividades"
          placeholder="Buscar atividades…"
          value={query}
          onChange={setQuery}
          className="mb-6"
        />
      )}

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar. A API está rodando?
        </Card>
      )}

      {isLoading ? null : activities.length === 0 ? (
        <Card className="mx-auto max-w-md py-10 text-center">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl text-accent-ink shadow-neu-inset">
            <Wallet className="size-7" style={{ filter: 'drop-shadow(0 0 6px var(--k-accent))' }} />
          </span>
          <h2 className="text-lg font-semibold">Mapeie suas fontes de renda</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Coloque seu trabalho principal em "Ativas" e as ideias de monetização em "Ideias".
          </p>
          <Button
            variant="primary"
            className="mt-6"
            icon={<Plus className="size-4" />}
            onClick={() => setModal({ mode: 'create', status: 'active' })}
          >
            Adicionar primeira atividade
          </Button>
        </Card>
      ) : (
        <Board
          boardId="finance"
          columns={columns}
          renderCard={(a, { overlay }) => <FinanceCard activity={a} overlay={overlay} />}
          onMove={handleMove}
          onOpen={(activity) => setModal({ mode: 'edit', activity })}
          onAdd={(status) => setModal({ mode: 'create', status: status as FinanceStatus })}
          emptyLabel={q ? 'Nada encontrado aqui' : 'Arraste atividades para cá'}
        />
      )}

      <FinanceModal state={modalState} onClose={() => setModal({ mode: 'closed' })} />
    </>
  );
}

function Stat({
  icon,
  color,
  label,
  value,
  hint,
  danger,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-bg p-4 shadow-neu md:p-5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span
          className="grid size-7 place-items-center rounded-lg shadow-neu-inset-sm"
          style={{ color, filter: `drop-shadow(0 0 4px ${color}88)` }}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-3 text-xl font-bold tracking-tight tabular-nums md:text-2xl">{value}</p>
      <p className={danger ? 'mt-0.5 text-xs text-danger' : 'mt-0.5 text-xs text-muted'}>{hint}</p>
    </div>
  );
}
