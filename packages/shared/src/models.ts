import type { IdeaStatus, ProjectStatus } from './enums';

/** Formatos retornados pela API (JSON). Datas em ISO-8601. */

export interface Idea {
  id: number;
  title: string;
  description: string | null;
  status: IdeaStatus;
  priority: number; // 1 alta · 2 média · 3 baixa
  position: number;
  promotedProjectId: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: ProjectStatus;
  devLevel: number | null;
  position: number;
  repoUrl: string | null;
  deployUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  deployedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
