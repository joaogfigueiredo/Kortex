import { DEV_LEVELS, PROJECT_STATUS_LABEL, type Project, type ProjectStatus } from '@kortex/shared';

/**
 * Colunas do Kanban de Projetos. "development" vira 3 colunas (Nível 1/2/3),
 * identificadas por "development:N".
 */
export type ProjectColumnKey = Exclude<ProjectStatus, 'development'> | `development:${1 | 2 | 3}`;

export interface ProjectColumnDef {
  key: ProjectColumnKey;
  status: ProjectStatus;
  devLevel: number | null;
  title: string;
  color: string;
  group?: 'development';
}

const DEV_COLOR = '#6FE3FF';

export const PROJECT_COLUMNS: ProjectColumnDef[] = [
  { key: 'idea', status: 'idea', devLevel: null, title: 'Ideias', color: '#B79CFF' },
  {
    key: 'started',
    status: 'started',
    devLevel: null,
    title: 'Projetos iniciados',
    color: '#FFD166',
  },
  ...DEV_LEVELS.map((n): ProjectColumnDef => ({
    key: `development:${n}`,
    status: 'development',
    devLevel: n,
    title: `Nível ${n}`,
    color: DEV_COLOR,
    group: 'development',
  })),
  { key: 'done', status: 'done', devLevel: null, title: 'Finalizado', color: '#4DF5B8' },
  { key: 'deployed', status: 'deployed', devLevel: null, title: 'Deployzado', color: '#FF8FC7' },
];

export const PROJECT_GROUPS = {
  development: { title: PROJECT_STATUS_LABEL.development, color: DEV_COLOR },
};

export const columnKeyOf = (p: Pick<Project, 'status' | 'devLevel'>): ProjectColumnKey =>
  p.status === 'development'
    ? (`development:${p.devLevel ?? 1}` as ProjectColumnKey)
    : (p.status as ProjectColumnKey);

export const columnDef = (key: string) => PROJECT_COLUMNS.find((c) => c.key === key)!;

/** Rótulo completo, ex.: "Desenvolvimento · Nível 2". */
export const stageLabel = (p: Pick<Project, 'status' | 'devLevel'>) =>
  p.status === 'development'
    ? `${PROJECT_STATUS_LABEL.development} · Nível ${p.devLevel}`
    : PROJECT_STATUS_LABEL[p.status];
