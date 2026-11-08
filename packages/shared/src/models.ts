import type {
  FinanceEntryType,
  FinanceKind,
  FinanceStatus,
  IdeaStatus,
  MealStatus,
  ProjectStatus,
  Recurrence,
  ReminderKind,
  StudyLevel,
  TimeModule,
  TimeSource,
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

export interface ReminderCategory {
  id: number;
  name: string;
  color: string;
}

export interface Reminder {
  id: number;
  title: string;
  description: string | null;
  kind: ReminderKind;
  categoryId: number | null;
  /** Local/flutuante: "YYYY-MM-DDTHH:mm" */
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  recurrence: Recurrence;
  recurrenceWeekdays: number | null;
  recurrenceUntil: string | null;
  notifyMinutesBefore: number | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Uma ocorrência concreta de um lembrete num dia (já expandida a recorrência). */
export interface Occurrence {
  reminderId: number;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" (null quando o dia todo) */
  time: string | null;
  endTime: string | null;
  title: string;
  description: string | null;
  kind: ReminderKind;
  categoryId: number | null;
  color: string | null;
  recurrence: Recurrence;
  allDay: boolean;
  done: boolean;
}

export interface TimeEntry {
  id: number;
  module: TimeModule;
  refId: number | null;
  /** Local/flutuante: "YYYY-MM-DDTHH:mm[:ss]" */
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  source: TimeSource;
  note: string | null;
  createdAt: string;
}

export interface StudySubject {
  id: number;
  name: string;
  description: string | null;
  color: string;
  level: StudyLevel;
  progress: number;
  targetHours: number | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  /** Estatísticas calculadas a partir das sessões (time_entries). */
  totalSec: number;
  weekSec: number;
  sessions: number;
  lastStudiedAt: string | null;
}

export interface StudySummary {
  /** Segundos estudados nos últimos 7 dias (incluindo hoje). */
  weekSec: number;
  /** Dias seguidos com estudo, terminando hoje ou ontem. */
  streak: number;
  /** Segundos por dia dos últimos 7 dias, do mais antigo para hoje. */
  last7: { date: string; sec: number }[];
}

export interface Workout {
  id: number;
  date: string;
  type: string;
  durationMin: number | null;
  intensity: number | null;
  notes: string | null;
  createdAt: string;
}

export interface Meal {
  id: number;
  name: string;
  time: string | null;
  description: string | null;
  weekdays: number;
  position: number;
  active: boolean;
}

export interface MealLog {
  mealId: number;
  date: string;
  status: MealStatus;
  note: string | null;
}

/** Visão de um dia: refeições previstas (com marcação) + treinos. */
export interface WellnessDay {
  date: string;
  meals: (Meal & { log: MealLog | null })[];
  workouts: Workout[];
}

export interface WellnessDayStats {
  date: string;
  workoutMin: number;
  workouts: number;
  mealsPlanned: number;
  mealsDone: number;
  mealsPartial: number;
  /** 0–100, feita = 1 e parcial = 0,5; null quando não há refeição prevista. */
  dietPct: number | null;
}

export interface WellnessSummary {
  last7: WellnessDayStats[];
  weekWorkouts: number;
  weekWorkoutMin: number;
  activeDays: number;
  /** Dias (dos 7) com alguma refeição marcada. */
  loggedDays: number;
  /** Aderência média nos dias registrados (0–100); null se nenhum dia registrado. */
  dietPct: number | null;
}

export const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
