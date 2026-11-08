import type {
  FinanceEntryType,
  FinanceKind,
  FinanceStatus,
  IdeaStatus,
  ProjectStatus,
} from './enums';

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

export interface FinanceActivity {
  id: number;
  title: string;
  description: string | null;
  status: FinanceStatus;
  kind: FinanceKind;
  expectedMonthlyCents: number | null;
  actualMonthlyCents: number | null;
  currency: string;
  position: number;
  projectId: number | null;
  createdAt: string;
  updatedAt: string;
  /** Avisos não resolvidos. */
  openAlerts: number;
  /** Data do aviso pendente mais próximo. */
  nextDueAt: string | null;
}

export interface FinanceChange {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
}

export interface FinanceEntry {
  id: number;
  activityId: number;
  type: FinanceEntryType;
  content: string;
  meta: { changes?: FinanceChange[]; from?: FinanceStatus; to?: FinanceStatus } | null;
  dueAt: string | null;
  resolved: boolean;
  createdAt: string;
}

export const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
