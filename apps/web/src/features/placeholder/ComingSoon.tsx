import type { LucideIcon } from 'lucide-react';
import { Badge, Card } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';

export function ComingSoon({
  title,
  subtitle,
  icon: Icon,
  step,
  features,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  step: number;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-bg text-accent-ink shadow-neu-inset">
          <Icon className="size-7" style={{ filter: 'drop-shadow(0 0 6px var(--k-accent))' }} />
        </span>
        <Badge color="#6FE3FF">Chega no Passo {step}</Badge>
        <ul className="mt-6 space-y-2.5 text-left text-sm text-muted">
          {features.map((f) => (
            <li key={f} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent shadow-glow" />
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
