import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CalendarCheck,
  Clock,
  Dumbbell,
  Flame,
  FolderKanban,
  Lightbulb,
  Minus,
  Salad,
  Target,
  Wallet,
} from 'lucide-react';
import {
  FINANCE_STATUS_LABEL,
  IDEA_STATUS,
  IDEA_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  type DashboardData,
  type DashboardKpis,
  type DashboardRange,
  type TimeByDay,
} from '@kortex/shared';
import { BarChart, type BarSeries } from '../../components/charts/BarChart';
import { Heatmap } from '../../components/charts/Heatmap';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, Segmented } from '../../components/ui';
import { api } from '../../lib/api';
import { todayStr } from '../../lib/dates';
import { formatDuration } from '../../lib/duration';
import { timeAgo } from '../../lib/format';
import { formatCents } from '../../lib/money';

type AreaKey = Exclude<keyof TimeByDay, 'date'>;

/** Ordem = ordem validada da paleta (adjacências seguras para daltonismo). */
const AREAS: (BarSeries & { key: AreaKey })[] = [
  { key: 'study', label: 'Estudo', color: 'var(--k-s-study)' },
  { key: 'work', label: 'Trabalho', color: 'var(--k-s-work)' },
  { key: 'project', label: 'Projetos', color: 'var(--k-s-project)' },
  { key: 'idea', label: 'Ideias', color: 'var(--k-s-idea)' },
  { key: 'finance', label: 'Finanças', color: 'var(--k-s-finance)' },
  { key: 'other', label: 'Outro', color: 'var(--k-s-other)' },
];

const RANGE_LABEL: Record<DashboardRange, string> = {
  day: 'Hoje',
  week: '7 dias',
  month: '30 dias',
};
const PREV_LABEL: Record<DashboardRange, string> = {
  day: 'ontem',
  week: '7 dias anteriores',
  month: '30 dias anteriores',
};
const pct = (v: number) => `${Math.round(v)}%`;

export function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>('week');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', range, todayStr()],
    queryFn: () => api.get<DashboardData>(`/dashboard?today=${todayStr()}&range=${range}`),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Sua produtividade em números" />

      {/* Filtro de período: uma linha, acima de tudo */}
      <Segmented<DashboardRange>
        ariaLabel="Período"
        value={range}
        onChange={setRange}
        className="mb-6 max-w-sm"
        options={(['day', 'week', 'month'] as const).map((r) => ({
          value: r,
          label: RANGE_LABEL[r],
        }))}
      />

      {isError && (
        <Card className="mb-6 text-sm text-danger">
          Não foi possível carregar. A API está rodando?
        </Card>
      )}
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl shadow-neu-inset" />
          ))}
        </div>
      ) : (
        <Content data={data} />
      )}
    </>
  );
}

function Content({ data }: { data: DashboardData }) {
  const { kpis, prev, range } = data;
  const multiDay = range !== 'day';
  const totalsByArea = AREAS.map((a) => ({
    ...a,
    sec: data.timeByDay.reduce((n, d) => n + d[a.key], 0),
  })).filter((a) => a.sec > 0);
  const nDays = data.timeByDay.length;

  return (
    <div className="space-y-6">
      {/* KPIs com comparação */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          icon={<Clock className="size-4" />}
          label="Tempo registrado"
          value={formatDuration(kpis.focusSec)}
          delta={durDelta(kpis, prev, 'focusSec')}
          range={range}
        />
        <Kpi
          icon={<BookOpen className="size-4" />}
          label="Estudo"
          value={formatDuration(kpis.studySec)}
          delta={durDelta(kpis, prev, 'studySec')}
          range={range}
        />
        <Kpi
          icon={<Dumbbell className="size-4" />}
          label="Treinos"
          value={`${kpis.workouts}`}
          hint={`${kpis.workoutMin} min`}
          delta={numDelta(kpis.workouts, prev.workouts, '')}
          range={range}
        />
        <Kpi
          icon={<Salad className="size-4" />}
          label="Dieta"
          value={kpis.dietPct == null ? '—' : pct(kpis.dietPct)}
          delta={ppDelta(kpis.dietPct, prev.dietPct)}
          range={range}
        />
        <Kpi
          icon={<Target className="size-4" />}
          label="Metas"
          value={kpis.goalsPct == null ? '—' : pct(kpis.goalsPct)}
          delta={ppDelta(kpis.goalsPct, prev.goalsPct)}
          range={range}
        />
      </section>

      {/* Tempo por área */}
      <Card>
        <CardHeader
          icon={<Clock className="size-5" />}
          title="Tempo por área"
          subtitle={multiDay ? 'Por dia, empilhado' : 'Distribuição de hoje'}
        />
        {totalsByArea.length === 0 ? (
          <Empty>
            Nenhum tempo registrado no período. Use o Modo Foco ou registre sessões de estudo.
          </Empty>
        ) : (
          <div
            className={clsx(
              'grid grid-cols-1 gap-8',
              multiDay && 'lg:grid-cols-[minmax(0,1fr)_16rem]',
            )}
          >
            {multiDay && (
              <BarChart
                title="Tempo por área e por dia"
                data={data.timeByDay.map((d) => ({
                  date: d.date,
                  values: Object.fromEntries(AREAS.map((a) => [a.key, d[a.key]])),
                }))}
                series={AREAS.filter((a) => totalsByArea.some((t) => t.key === a.key))}
                format={formatDuration}
                height={200}
              />
            )}
            <AreaTotals rows={totalsByArea} />
          </div>
        )}
      </Card>

      {/* Estudo + Projetos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<BookOpen className="size-5" />}
            title="Estudo por matéria"
            subtitle={`Sequência atual: ${data.streaks.study} ${data.streaks.study === 1 ? 'dia' : 'dias'}`}
          />
          {data.studyBySubject.length === 0 ? (
            <Empty>Sem sessões de estudo no período.</Empty>
          ) : (
            <HBars
              rows={data.studyBySubject.map((s) => ({
                key: s.id,
                label: s.name,
                dot: s.color,
                value: s.sec,
              }))}
              format={formatDuration}
            />
          )}
        </Card>
        <Card>
          <CardHeader
            icon={<FolderKanban className="size-5" />}
            title="Continuidade em projetos"
            subtitle="Tempo, dias ativos e última atividade"
          />
          {data.projects.length === 0 ? (
            <Empty>Nenhum tempo em projetos no período. Foque em um projeto pelo Modo Foco.</Empty>
          ) : (
            <ul className="space-y-3">
              {data.projects.map((p) => (
                <li key={p.id} className="rounded-2xl px-4 py-3 shadow-neu-inset-sm">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatDuration(p.sec)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                    <span>{PROJECT_STATUS_LABEL[p.status]}</span>
                    <span>
                      {p.activeDays}/{nDays} {nDays === 1 ? 'dia' : 'dias'} ativos
                    </span>
                    {p.lastAt && <span>última: {timeAgo(p.lastAt)}</span>}
                  </div>
                  <div className="mt-2 flex gap-[2px]" aria-hidden>
                    {Array.from({ length: nDays }, (_, i) => (
                      <span
                        key={i}
                        className={clsx(
                          'h-1.5 flex-1 rounded-full',
                          i < p.activeDays ? '' : 'bg-line',
                        )}
                        style={i < p.activeDays ? { background: 'var(--k-s-project)' } : undefined}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Hábitos por dia (pequenos múltiplos, uma escala cada) */}
      {multiDay && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader
              icon={<Dumbbell className="size-5" />}
              title="Treinos"
              subtitle="Minutos por dia"
            />
            <BarChart
              title="Minutos de treino"
              data={data.workoutsByDay.map((d) => ({ date: d.date, values: { min: d.min } }))}
              series={[{ key: 'min', label: 'Minutos', color: 'var(--k-chart-1)' }]}
              format={(v) => `${v} min`}
              height={130}
            />
          </Card>
          <Card>
            <CardHeader
              icon={<Salad className="size-5" />}
              title="Dieta"
              subtitle="% cumprida por dia"
            />
            <BarChart
              title="Dieta cumprida (%)"
              data={data.dietByDay.map((d) => ({
                date: d.date,
                values: { pct: d.logged ? d.pct : null },
              }))}
              series={[{ key: 'pct', label: 'Dieta', color: 'var(--k-chart-1)' }]}
              format={pct}
              max={100}
              height={130}
            />
          </Card>
          <Card>
            <CardHeader
              icon={<Target className="size-5" />}
              title="Metas"
              subtitle="% cumprida por dia"
            />
            <BarChart
              title="Metas cumpridas (%)"
              data={data.goalsByDay.map((d) => ({
                date: d.date,
                values: { pct: d.planned ? (d.done / d.planned) * 100 : null },
              }))}
              series={[{ key: 'pct', label: 'Metas', color: 'var(--k-chart-1)' }]}
              format={pct}
              max={100}
              height={130}
            />
          </Card>
        </div>
      )}

      {/* Constância + frequência de trabalho + sequências */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {multiDay && (
          <Card>
            <CardHeader
              icon={<CalendarCheck className="size-5" />}
              title="Constância"
              subtitle={`Tempo registrado por dia · ${data.activeDays} de ${nDays} dias ativos`}
            />
            <Heatmap
              title="Tempo registrado por dia"
              days={data.timeByDay.map((d) => ({
                date: d.date,
                value: AREAS.reduce((n, a) => n + d[a.key], 0),
              }))}
              format={formatDuration}
            />
          </Card>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Mini
            icon={<Briefcase className="size-4" />}
            label="Frequência de trabalho"
            value={`${data.workDays}/${nDays}`}
            hint={nDays === 1 ? 'trabalhou hoje?' : 'dias com tempo de trabalho'}
          />
          <Mini
            icon={<Flame className="size-4" />}
            label="Sequência de estudo"
            value={`${data.streaks.study}`}
            hint={data.streaks.study === 1 ? 'dia seguido' : 'dias seguidos'}
          />
          <Mini
            icon={<Target className="size-4" />}
            label="Dias perfeitos"
            value={`${data.streaks.goalsPerfect}`}
            hint="todas as metas, seguidos"
          />
          <Mini
            icon={<Dumbbell className="size-4" />}
            label="Dias com treino"
            value={`${data.workoutsByDay.filter((d) => d.count).length}/${nDays}`}
            hint="no período"
          />
        </div>
      </div>

      {/* Ideias e finanças */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Lightbulb className="size-5" />}
            title="Ideias"
            subtitle={`${data.ideas.created} criadas · ${data.ideas.completed} finalizadas no período`}
          />
          <HBars
            rows={IDEA_STATUS.map((s) => ({
              key: s,
              label: IDEA_STATUS_LABEL[s],
              value: data.ideas.byStatus[s],
            }))}
            format={(v) => String(v)}
            color="var(--k-s-idea)"
          />
        </Card>
        <Card>
          <CardHeader
            icon={<Wallet className="size-5" />}
            title="Atividades financeiras"
            subtitle={`${data.finance.openAlerts} ${data.finance.openAlerts === 1 ? 'aviso pendente' : 'avisos pendentes'}`}
          />
          <p className="mb-4 text-2xl font-bold tracking-tight tabular-nums">
            {formatCents(data.finance.activeIncomeCents, true)}
            <span className="ml-1 text-sm font-normal text-muted">/mês em fontes ativas</span>
          </p>
          <HBars
            rows={(['idea', 'development', 'active'] as const).map((s) => ({
              key: s,
              label: FINANCE_STATUS_LABEL[s],
              value: data.finance.byStatus[s],
            }))}
            format={(v) => String(v)}
            color="var(--k-s-finance)"
          />
        </Card>
      </div>
    </div>
  );
}

// ---------- peças ----------

type Delta = { text: string; dir: 'up' | 'down' | 'flat' } | null;

const durDelta = (k: DashboardKpis, p: DashboardKpis, key: 'focusSec' | 'studySec'): Delta => {
  const diff = k[key] - p[key];
  if (!k[key] && !p[key]) return null;
  return {
    text: diff === 0 ? 'igual' : `${diff > 0 ? '+' : '−'}${formatDuration(Math.abs(diff))}`,
    dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
};
const numDelta = (a: number, b: number, unit: string): Delta => {
  if (!a && !b) return null;
  const diff = a - b;
  return {
    text: diff === 0 ? 'igual' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}${unit}`,
    dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
};
const ppDelta = (a: number | null, b: number | null): Delta => {
  if (a == null || b == null) return null;
  const diff = a - b;
  return {
    text: diff === 0 ? 'igual' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} p.p.`,
    dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
};

function Kpi({
  icon,
  label,
  value,
  hint,
  delta,
  range,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  delta: Delta;
  range: DashboardRange;
}) {
  const Arrow = delta?.dir === 'up' ? ArrowUpRight : delta?.dir === 'down' ? ArrowDownRight : Minus;
  return (
    <div className="min-w-0 rounded-3xl bg-bg p-4 shadow-neu md:p-5">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="text-accent-ink">{icon}</span>
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl md:text-2xl">
        {value}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted">{hint}</span>}
      </p>
      <p
        className="mt-1 flex items-center gap-1 text-[11px] text-muted"
        title={`Comparado com ${PREV_LABEL[range]}`}
      >
        {delta ? (
          <>
            <Arrow
              className="size-3.5 shrink-0"
              style={{
                color:
                  delta.dir === 'up'
                    ? '#1baf7a'
                    : delta.dir === 'down'
                      ? 'var(--k-danger)'
                      : undefined,
              }}
              aria-label={delta.dir === 'up' ? 'subiu' : delta.dir === 'down' ? 'caiu' : 'estável'}
            />
            <span className="truncate">
              {delta.text} vs {PREV_LABEL[range]}
            </span>
          </>
        ) : (
          <span>sem comparação</span>
        )}
      </p>
    </div>
  );
}

/** Totais por área com rótulo direto (legenda + valores). */
function AreaTotals({ rows }: { rows: (BarSeries & { sec: number })[] }) {
  const total = rows.reduce((n, r) => n + r.sec, 0);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Total: <span className="font-semibold text-fg tabular-nums">{formatDuration(total)}</span>
      </p>
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-center gap-2 text-sm">
            <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: r.color }} />
            <span className="flex-1">{r.label}</span>
            <span className="font-semibold tabular-nums">{formatDuration(r.sec)}</span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">
              {Math.round((r.sec / total) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-line" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.sec / total) * 100}%`, background: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barras horizontais com rótulo e valor diretos (cor única; identidade no texto/ponto). */
function HBars({
  rows,
  format,
  color = 'var(--k-chart-1)',
}: {
  rows: { key: string | number; label: string; value: number; dot?: string }[];
  format: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-center gap-2 text-sm">
            {r.dot && (
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: r.dot, boxShadow: `0 0 6px ${r.dot}` }}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-line" aria-hidden>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(r.value / max) * 100}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Mini({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-bg p-4 shadow-neu">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="text-accent-ink">{icon}</span>
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl px-4 py-8 text-center text-sm text-muted shadow-neu-inset-sm">
      {children}
    </p>
  );
}
