import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Sparkles, Target } from 'lucide-react';
import { Badge, Card, CardHeader, Progress } from '../../components/ui';
import { MiniAgenda } from '../reminders/MiniAgenda';
import { NAV } from '../../app/nav';
import { api } from '../../lib/api';

const greeting = (h: number) =>
  h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

export function HomePage() {
  const now = new Date();
  const today = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string }>('/health'),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-bg p-6 shadow-neu md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-40 blur-3xl"
          style={{ background: 'var(--k-accent)' }}
        />
        <p className="text-sm text-muted first-letter:uppercase">{today}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
          {greeting(now.getHours())} <span className="text-accent-ink">✦</span>
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted md:text-base">
          Seu cockpit pessoal. Ideias, projetos, agenda e hábitos num só lugar.
        </p>
        <div className="mt-5">
          <Badge color={health.isSuccess ? '#4DF5B8' : health.isError ? '#FF6B6B' : '#FFD166'}>
            {health.isSuccess ? 'API conectada' : health.isError ? 'API offline' : 'Conectando…'}
          </Badge>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Target className="size-5" />}
            title="Metas de hoje"
            subtitle="Check rápido · Passo 9"
          />
          <div className="space-y-3 opacity-60">
            {['Beber 2L de água', 'Estudar 1h', 'Treinar'].map((g, i) => (
              <div
                key={g}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 shadow-neu-inset-sm"
              >
                <CircleCheck className={i === 0 ? 'size-5 text-accent-ink' : 'size-5 text-muted'} />
                <span className="text-sm">{g}</span>
              </div>
            ))}
          </div>
        </Card>

        <MiniAgenda />

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader
            icon={<Sparkles className="size-5" />}
            title="Semana"
            subtitle="Produtividade · Passo 11"
          />
          <div className="space-y-4 opacity-60">
            <Progress label="Estudos" value={62} showValue />
            <Progress label="Treinos" value={40} showValue color="#4DF5B8" />
            <Progress label="Dieta" value={85} showValue color="#B79CFF" />
          </div>
        </Card>
      </div>

      <section>
        <h2 className="mb-4 px-1 text-sm font-semibold tracking-wide text-muted uppercase">
          Módulos
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {NAV.filter((n) => n.to !== '/').map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-2xl bg-bg p-4 text-sm font-medium shadow-neu-sm transition-all hover:-translate-y-0.5 hover:text-accent-ink active:shadow-neu-inset-sm"
            >
              <Icon className="size-5 text-muted transition-colors group-hover:text-accent-ink" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
