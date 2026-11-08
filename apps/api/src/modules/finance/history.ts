import {
  FINANCE_KIND_LABEL,
  FINANCE_STATUS_LABEL,
  type FinanceActivityUpdate,
  type FinanceChange,
  type FinanceKind,
} from '@kortex/shared';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatCents = (c: number | null | undefined) =>
  // Intl usa espaço não separável entre "R$" e o valor; normaliza para espaço comum.
  c == null ? '—' : money.format(c / 100).replace(/\s/g, ' ');

type Tracked = Exclude<keyof FinanceActivityUpdate, 'status'>;

const FIELDS: Record<Tracked, { label: string; show: (v: unknown, ctx: Ctx) => string }> = {
  title: { label: 'Título', show: (v) => `"${v}"` },
  description: { label: 'Descrição', show: (v) => (v ? 'preenchida' : 'vazia') },
  kind: { label: 'Tipo', show: (v) => FINANCE_KIND_LABEL[v as FinanceKind] ?? String(v) },
  expectedMonthlyCents: { label: 'Renda esperada', show: (v) => formatCents(v as number | null) },
  actualMonthlyCents: { label: 'Renda real', show: (v) => formatCents(v as number | null) },
  projectId: {
    label: 'Projeto vinculado',
    show: (v, ctx) => (v == null ? 'nenhum' : (ctx.projectTitle(v as number) ?? `#${v}`)),
  },
};

interface Ctx {
  projectTitle: (id: number) => string | undefined;
}

/**
 * Compara o estado atual com o PATCH e devolve só o que mudou de verdade,
 * com um resumo legível ("Renda real: R$ 0,00 → R$ 3.500,00").
 */
export function describeChanges(
  before: Record<string, unknown>,
  patch: FinanceActivityUpdate,
  ctx: Ctx = { projectTitle: () => undefined },
): { changes: FinanceChange[]; summary: string } | null {
  const changes: FinanceChange[] = [];
  const lines: string[] = [];
  for (const field of Object.keys(FIELDS) as Tracked[]) {
    if (!(field in patch)) continue;
    const to = patch[field] ?? null;
    const from = before[field] ?? null;
    if (to === from) continue;
    const { label, show } = FIELDS[field];
    changes.push({ field, label, from, to });
    lines.push(
      field === 'description'
        ? 'Descrição atualizada'
        : `${label}: ${show(from, ctx)} → ${show(to, ctx)}`,
    );
  }
  return changes.length ? { changes, summary: lines.join('\n') } : null;
}

export const statusSummary = (
  from: keyof typeof FINANCE_STATUS_LABEL,
  to: keyof typeof FINANCE_STATUS_LABEL,
) => `Movida de ${FINANCE_STATUS_LABEL[from]} para ${FINANCE_STATUS_LABEL[to]}`;
