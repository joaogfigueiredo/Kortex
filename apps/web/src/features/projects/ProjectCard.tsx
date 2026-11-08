import clsx from 'clsx';
import { GitBranch, Globe, Rocket } from 'lucide-react';
import type { Project } from '@kortex/shared';
import { timeAgo } from '../../lib/format';

/** Frase de data mais relevante para a fase atual. */
function stageDate(p: Project): string {
  if (p.status === 'deployed' && p.deployedAt) return `No ar ${timeAgo(p.deployedAt)}`;
  if (p.status === 'done' && p.finishedAt) return `Concluído ${timeAgo(p.finishedAt)}`;
  if (p.startedAt) return `Iniciado ${timeAgo(p.startedAt)}`;
  return `Criado ${timeAgo(p.createdAt)}`;
}

/** 3 barrinhas que acendem conforme o nível de desenvolvimento. */
export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={`Nível ${level} de 3`} role="img">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={clsx('w-1 rounded-full', n <= level ? 'bg-accent shadow-glow' : 'bg-line')}
          style={{ height: 4 + n * 3 }}
        />
      ))}
    </span>
  );
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function ProjectCard({ project: p, overlay }: { project: Project; overlay?: boolean }) {
  return (
    <article
      className={clsx(
        'rounded-2xl bg-bg p-4 transition-all duration-200',
        overlay
          ? 'shadow-neu'
          : 'shadow-neu-sm hover:shadow-[var(--shadow-neu-sm),0_0_0_1px_rgb(111_227_255/0.45)]',
      )}
    >
      <div className="flex items-start gap-2">
        <h3 className="line-clamp-2 flex-1 text-sm leading-snug font-medium">{p.title}</h3>
        {p.status === 'development' && p.devLevel && <LevelMeter level={p.devLevel} />}
        {p.status === 'deployed' && (
          <Rocket
            className="size-4 shrink-0 text-pink"
            style={{ filter: 'drop-shadow(0 0 5px #FF8FC7)' }}
            aria-label="No ar"
          />
        )}
      </div>

      {p.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{p.description}</p>
      )}

      <footer className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <span className="flex-1 truncate">{stageDate(p)}</span>
        {p.repoUrl && (
          <a
            href={p.repoUrl}
            target="_blank"
            rel="noreferrer"
            onClick={stop}
            onMouseDown={stop}
            onTouchStart={stop}
            onKeyDown={stop}
            aria-label="Abrir repositório"
            title={p.repoUrl}
            className="grid size-7 place-items-center rounded-lg shadow-neu-sm transition-colors hover:text-accent-ink"
          >
            <GitBranch className="size-3.5" />
          </a>
        )}
        {p.deployUrl && (
          <a
            href={p.deployUrl}
            target="_blank"
            rel="noreferrer"
            onClick={stop}
            onMouseDown={stop}
            onTouchStart={stop}
            onKeyDown={stop}
            aria-label="Abrir site publicado"
            title={p.deployUrl}
            className="grid size-7 place-items-center rounded-lg shadow-neu-sm transition-colors hover:text-accent-ink"
          >
            <Globe className="size-3.5" />
          </a>
        )}
      </footer>
    </article>
  );
}
