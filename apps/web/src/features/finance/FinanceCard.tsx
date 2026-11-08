import clsx from 'clsx';
import { Bell } from 'lucide-react';
import { FINANCE_KIND_LABEL, type FinanceActivity } from '@kortex/shared';
import { formatCents } from '../../lib/money';
import { ALERT_COLOR, KIND_ICON, alertState, shortDate } from './meta';

export function FinanceCard({
  activity: a,
  overlay,
}: {
  activity: FinanceActivity;
  overlay?: boolean;
}) {
  const Icon = KIND_ICON[a.kind];
  const state = alertState(a.nextDueAt);
  const alertColor = ALERT_COLOR[state];

  return (
    <article
      className={clsx(
        'rounded-2xl bg-bg p-4 transition-all duration-200',
        overlay
          ? 'shadow-neu'
          : 'shadow-neu-sm hover:shadow-[var(--shadow-neu-sm),0_0_0_1px_rgb(111_227_255/0.45)]',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-accent-ink shadow-neu-inset-sm">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">{a.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted">{FINANCE_KIND_LABEL[a.kind]}</p>
        </div>
      </div>

      {(a.actualMonthlyCents != null || a.expectedMonthlyCents != null) && (
        <div className="mt-3 flex items-baseline justify-between gap-2">
          {a.actualMonthlyCents != null ? (
            <p className="text-base font-semibold tabular-nums">
              {formatCents(a.actualMonthlyCents, true)}
              <span className="ml-0.5 text-[11px] font-normal text-muted">/mês</span>
            </p>
          ) : (
            <span className="text-[11px] text-muted">Sem renda ainda</span>
          )}
          {a.expectedMonthlyCents != null && (
            <p className="text-[11px] text-muted tabular-nums">
              meta {formatCents(a.expectedMonthlyCents, true)}
            </p>
          )}
        </div>
      )}

      {a.openAlerts > 0 && (
        <p
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-neu-inset-sm"
          style={{ color: state === 'overdue' ? 'var(--k-danger)' : undefined }}
        >
          <Bell
            className="size-3.5"
            style={{ color: alertColor, filter: `drop-shadow(0 0 4px ${alertColor})` }}
          />
          {a.openAlerts} {a.openAlerts === 1 ? 'aviso' : 'avisos'}
          {a.nextDueAt && (
            <span className="text-muted">
              · {state === 'overdue' ? 'venceu' : 'vence'} {shortDate(a.nextDueAt)}
            </span>
          )}
        </p>
      )}
    </article>
  );
}
