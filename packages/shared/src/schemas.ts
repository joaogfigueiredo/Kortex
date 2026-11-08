import { z } from 'zod';
import {
  FINANCE_ENTRY_TYPE,
  FINANCE_KIND,
  FINANCE_STATUS,
  IDEA_STATUS,
  MEAL_STATUS,
  PROJECT_STATUS,
  RECURRENCE,
  REMINDER_KIND,
  STUDY_LEVEL,
  TIME_MODULE,
  TIME_SOURCE,
} from './enums';

/** Schemas de entrada (create/update), validados na API e reaproveitados nos formulários. */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)');
const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)');
const weekdayMask = z.number().int().min(0).max(127);
const optionalText = z.string().trim().max(10_000).nullish();
const title = z.string().trim().min(1, 'Obrigatório').max(200);

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const ideaCreate = z.object({
  title,
  description: optionalText,
  status: z.enum(IDEA_STATUS).default('organized'),
  priority: z.number().int().min(1).max(3).default(2),
});
export const ideaUpdate = ideaCreate.partial().extend({ position: z.number().optional() });

const projectBase = z.object({
  title,
  description: optionalText,
  status: z.enum(PROJECT_STATUS).default('idea'),
  devLevel: z.number().int().min(1).max(3).nullish(),
  repoUrl: z.string().url().nullish(),
  deployUrl: z.string().url().nullish(),
});
export const projectCreate = projectBase.refine(
  (p) => (p.status === 'development') === (p.devLevel != null),
  {
    message: 'Nível de desenvolvimento é obrigatório somente no status "development"',
    path: ['devLevel'],
  },
);

export const financeActivityCreate = z.object({
  title,
  description: optionalText,
  status: z.enum(FINANCE_STATUS).default('idea'),
  kind: z.enum(FINANCE_KIND).default('business'),
  expectedMonthlyCents: z.number().int().nonnegative().nullish(),
  actualMonthlyCents: z.number().int().nonnegative().nullish(),
  currency: z.string().length(3).default('BRL'),
  projectId: z.number().int().positive().nullish(),
});

export const financeEntryCreate = z.object({
  type: z.enum(FINANCE_ENTRY_TYPE),
  content: z.string().trim().min(1),
  dueAt: isoDateTime.nullish(),
});

export const reminderCategoryCreate = z.object({ name: title, color: hexColor });

export const reminderCreate = z.object({
  title,
  description: optionalText,
  kind: z.enum(REMINDER_KIND).default('reminder'),
  categoryId: z.number().int().positive().nullish(),
  startAt: isoDateTime,
  endAt: isoDateTime.nullish(),
  allDay: z.boolean().default(false),
  recurrence: z.enum(RECURRENCE).default('none'),
  recurrenceWeekdays: weekdayMask.nullish(),
  recurrenceUntil: isoDate.nullish(),
  notifyMinutesBefore: z.number().int().nonnegative().nullish(),
});

export const studySubjectCreate = z.object({
  name: title,
  description: optionalText,
  color: hexColor.default('#6FE3FF'),
  level: z.enum(STUDY_LEVEL).default('beginner'),
  progress: z.number().int().min(0).max(100).default(0),
  targetHours: z.number().positive().nullish(),
});

export const timeEntryCreate = z.object({
  module: z.enum(TIME_MODULE),
  refId: z.number().int().positive().nullish(),
  startedAt: isoDateTime,
  endedAt: isoDateTime.nullish(),
  durationSec: z.number().int().nonnegative(),
  source: z.enum(TIME_SOURCE).default('manual'),
  note: optionalText,
});

export const workoutCreate = z.object({
  date: isoDate,
  type: title,
  durationMin: z.number().int().positive().nullish(),
  intensity: z.number().int().min(1).max(5).nullish(),
  notes: optionalText,
});

export const mealPlanCreate = z.object({
  name: title,
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish(),
  description: optionalText,
  weekdays: weekdayMask.default(127),
});

export const mealLogUpsert = z.object({
  mealId: z.number().int().positive(),
  date: isoDate,
  status: z.enum(MEAL_STATUS),
  note: optionalText,
});

export const dailyGoalCreate = z.object({
  title,
  weekdays: weekdayMask.default(127),
  icon: z.string().max(40).nullish(),
});

export type IdeaCreate = z.infer<typeof ideaCreate>;
export type ProjectCreate = z.infer<typeof projectCreate>;
export type FinanceActivityCreate = z.infer<typeof financeActivityCreate>;
export type ReminderCreate = z.infer<typeof reminderCreate>;
export type StudySubjectCreate = z.infer<typeof studySubjectCreate>;
export type TimeEntryCreate = z.infer<typeof timeEntryCreate>;
export type DailyGoalCreate = z.infer<typeof dailyGoalCreate>;
