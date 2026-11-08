import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import {
  ArrowRightLeft,
  Bell,
  CircleCheck,
  Circle,
  MessageSquare,
  Pencil,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { FinanceEntry } from '@kortex/shared';
import { Button, Input, Segmented, Textarea } from '../../components/ui';
import { formatDate, timeAgo } from '../../lib/format';
import { toast } from '../../stores/toast';
import { useFinanceEntries, useFinanceMutations } from './api';
import { ALERT_COLOR, alertState, dateInputToIso } from './meta';

const TYPE_STYLE: Record<FinanceEntry['type'], { icon: LucideIcon; color: string; label: string }> =
  {
    edit: { icon: Pencil, color: 'var(--k-muted)', label: 'Edição' },
    status_change: { icon: ArrowRightLeft, color: '#6FE3FF', label: 'Movimentação' },
    note: { icon: MessageSquare, color: '#B79CFF', label: 'Observação' },
    alert: { icon: Bell, color: '#FFD166', label: 'Aviso' },
  };

export function FinanceTimeline({ activityId }: { activityId: number }) {
  const { data: entries = [], isLoading } = useFinanceEntries(activityId);
  const { addEntry, updateEntry, removeEntry } = useFinanceMutations();
  const [kind, setKind] = useState<'note' | 'alert'>('note');
  const [content, setContent] = useState('');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState<'all' | 'alerts'>('all');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await addEntry.mutateAsync({
        activityId,
        type: kind,
        content: content.trim(),
        dueAt: kind === 'alert' && due ? dateInputToIso(due) : null,
      });
      setContent('');
      setDue('');
      toast.success(kind === 'alert' ? 'Aviso criado' : 'Observação adicionada');
    } catch {
      /* toast no hook */
    }
  }

  const visible = filter === 'alerts' ? entries.filter((x) => x.type === 'alert') : entries;
  const pending = entries.filter((x) => x.type === 'alert' && !x.resolved).length;

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Composer */}
      <form onSubmit={submit} className="space-y-3 rounded-3xl p-4 shadow-neu-inset-sm">
        <Segmented
          ariaLabel="Tipo de registro"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'note', label: 'Observação', icon: <MessageSquare className="size-3.5" /> },
            { value: 'alert', label: 'Aviso', icon: <Bell className="size-3.5" /> },
          ]}
        />
        <Textarea
          aria-label={kind === 'alert' ? 'Texto do aviso' : 'Texto da observação'}
          placeholder={
            kind === 'alert'
              ? 'Ex.: Emitir nota fiscal do cliente X'
              : 'Anote algo sobre esta atividade…'
          }
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-end gap-3">
          {kind === 'alert' && (
            <div className="flex-1">
              <Input
                type="date"
                aria-label="Data do aviso"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className={clsx('h-11', kind === 'note' && 'ml-auto')}
            disabled={!content.trim() || addEntry.isPending}
          >
            Adicionar
          </Button>
        </div>
      </form>

      {/* Lista */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Histórico</h3>
        <Segmented
          ariaLabel="Filtrar histórico"
          value={filter}
          onChange={setFilter}
          className="w-52"
          options={[
            { value: 'all', label: 'Tudo' },
            { value: 'alerts', label: `Avisos${pending ? ` (${pending})` : ''}` },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-line" />
      ) : visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted">Nenhum aviso por aqui.</p>
      ) : (
        <ol className="relative space-y-4 pl-1">
          <span aria-hidden className="absolute top-3 bottom-3 left-[18px] w-px bg-line" />
          {visible.map((entry) => (
            <TimelineItem
              key={entry.id}
              entry={entry}
              onToggle={() => updateEntry.mutate({ id: entry.id, resolved: !entry.resolved })}
              onDelete={() =>
                removeEntry.mutate(entry.id, { onSuccess: () => toast.info('Registro excluído') })
              }
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineItem({
  entry,
  onToggle,
  onDelete,
}: {
  entry: FinanceEntry;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const style = TYPE_STYLE[entry.type];
  const isAlert = entry.type === 'alert';
  const state = isAlert ? alertState(entry.dueAt, entry.resolved) : null;
  const color = state ? ALERT_COLOR[state] : style.color;
  const created = entry.content === 'Atividade criada' && entry.type === 'edit';
  const Icon = created ? Sparkles : style.icon;
  const editable = entry.type === 'note' || isAlert;

  return (
    <li className="group relative flex gap-3">
      <span
        className="relative z-10 grid size-9 shrink-0 place-items-center rounded-xl bg-bg shadow-neu-sm"
        style={{ color }}
      >
        <Icon className="size-4" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </span>
      <div
        className={clsx(
          'min-w-0 flex-1 rounded-2xl px-4 py-3',
          editable ? 'shadow-neu-sm' : 'shadow-neu-inset-sm',
          isAlert && entry.resolved && 'opacity-60',
        )}
      >
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="font-medium" style={{ color: editable ? color : undefined }}>
            {created ? 'Criação' : style.label}
          </span>
          <span title={new Date(entry.createdAt).toLocaleString('pt-BR')}>
            · {timeAgo(entry.createdAt)}
          </span>
          {editable && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Excluir registro"
              className="ml-auto text-muted opacity-100 transition-opacity hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <p
          className={clsx(
            'mt-1 text-sm whitespace-pre-line',
            entry.type === 'edit' && 'text-muted',
            isAlert && entry.resolved && 'line-through',
          )}
        >
          {entry.content}
        </p>
        {isAlert && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {entry.dueAt && (
              <span
                style={{ color: state === 'overdue' ? 'var(--k-danger)' : undefined }}
                className="text-muted"
              >
                {state === 'overdue' ? 'Venceu' : 'Vence'} {formatDate(entry.dueAt)}
              </span>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={entry.resolved}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium shadow-neu-sm transition-colors hover:text-accent-ink"
            >
              {entry.resolved ? (
                <CircleCheck className="size-3.5 text-mint" />
              ) : (
                <Circle className="size-3.5" />
              )}
              {entry.resolved ? 'Resolvido' : 'Marcar resolvido'}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
