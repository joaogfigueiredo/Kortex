import clsx from 'clsx';
import { CircleCheckBig, FolderKanban } from 'lucide-react';
import { PRIORITY_LABEL, type Idea } from '@kortex/shared';
import { Dot } from '../../components/ui';
import { timeAgo } from '../../lib/format';

export const PRIORITY_COLOR: Record<number, string> = {
  1: '#FF6B6B',
  2: '#FFD166',
  3: '#4DF5B8',
};

export function IdeaCard({ idea, overlay }: { idea: Idea; overlay?: boolean }) {
  const done = idea.status === 'done';
  return (
    <article
      className={clsx(
        'group rounded-2xl bg-bg p-4 transition-all duration-200',
        overlay
          ? 'shadow-neu'
          : 'shadow-neu-sm hover:shadow-[var(--shadow-neu-sm),0_0_0_1px_rgb(111_227_255/0.45)]',
      )}
    >
      <div className="flex items-start gap-2">
        <h3
          className={clsx(
            'line-clamp-2 flex-1 text-sm leading-snug font-medium',
            done && 'text-muted',
          )}
        >
          {idea.title}
        </h3>
        {done && (
          <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-mint" aria-label="Finalizada" />
        )}
      </div>

      {idea.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{idea.description}</p>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Dot color={PRIORITY_COLOR[idea.priority] ?? '#FFD166'} size={6} />
          {PRIORITY_LABEL[idea.priority]}
        </span>
        <span title={new Date(idea.createdAt).toLocaleString('pt-BR')}>
          {timeAgo(idea.createdAt)}
        </span>
        {idea.promotedProjectId && (
          <span className="inline-flex items-center gap-1 font-medium text-accent-ink">
            <FolderKanban className="size-3.5" />
            Projeto
          </span>
        )}
      </footer>
    </article>
  );
}
