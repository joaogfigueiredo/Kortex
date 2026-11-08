/**
 * Enums de domínio compartilhados entre API e Web.
 * Os valores precisam bater com os CHECKs de docs/DATABASE.sql.
 */

export const IDEA_STATUS = ['organized', 'started', 'developing', 'done'] as const;
export type IdeaStatus = (typeof IDEA_STATUS)[number];
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  organized: 'Organizadas e arquitetadas',
  started: 'Iniciadas',
  developing: 'Em desenvolvimento',
  done: 'Finalizadas',
};

export const PROJECT_STATUS = ['idea', 'started', 'development', 'done', 'deployed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'Ideias',
  started: 'Projetos iniciados',
  development: 'Desenvolvimento',
  done: 'Finalizado',
  deployed: 'Deployzado',
};
export const DEV_LEVELS = [1, 2, 3] as const;
export type DevLevel = (typeof DEV_LEVELS)[number];

export const FINANCE_STATUS = ['idea', 'development', 'active'] as const;
export type FinanceStatus = (typeof FINANCE_STATUS)[number];
export const FINANCE_STATUS_LABEL: Record<FinanceStatus, string> = {
  idea: 'Ideias',
  development: 'Desenvolvimento',
  active: 'Ativas',
};

export const FINANCE_KIND = [
  'job',
  'freelance',
  'business',
  'content',
  'investment',
  'other',
] as const;
export type FinanceKind = (typeof FINANCE_KIND)[number];
export const FINANCE_KIND_LABEL: Record<FinanceKind, string> = {
  job: 'Trabalho',
  freelance: 'Freelance',
  business: 'Negócio',
  content: 'Conteúdo',
  investment: 'Investimento',
  other: 'Outro',
};

export const FINANCE_ENTRY_TYPE = ['note', 'edit', 'status_change', 'alert'] as const;
export type FinanceEntryType = (typeof FINANCE_ENTRY_TYPE)[number];

export const REMINDER_KIND = ['reminder', 'appointment', 'notice'] as const;
export type ReminderKind = (typeof REMINDER_KIND)[number];
export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  reminder: 'Lembrete',
  appointment: 'Compromisso',
  notice: 'Aviso',
};

export const RECURRENCE = ['none', 'daily', 'weekly', 'monthly'] as const;
export type Recurrence = (typeof RECURRENCE)[number];

export const STUDY_LEVEL = ['beginner', 'intermediate', 'advanced'] as const;
export type StudyLevel = (typeof STUDY_LEVEL)[number];
export const STUDY_LEVEL_LABEL: Record<StudyLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const TIME_MODULE = ['study', 'idea', 'project', 'finance', 'work', 'other'] as const;
export type TimeModule = (typeof TIME_MODULE)[number];

export const TIME_SOURCE = ['manual', 'focus'] as const;
export type TimeSource = (typeof TIME_SOURCE)[number];

export const MEAL_STATUS = ['done', 'partial', 'skipped'] as const;
export type MealStatus = (typeof MEAL_STATUS)[number];

export const TAG_ENTITY = ['idea', 'project', 'finance', 'reminder', 'study'] as const;
export type TagEntity = (typeof TAG_ENTITY)[number];

/** Bitmask de dias da semana: Dom=1, Seg=2, Ter=4, Qua=8, Qui=16, Sex=32, Sáb=64. */
export const ALL_WEEKDAYS = 127;
export const weekdayBit = (day: number) => 1 << day; // day: 0 (Dom) .. 6 (Sáb)
export const hasWeekday = (mask: number, day: number) => (mask & weekdayBit(day)) !== 0;
