import { z } from 'zod';
import {
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
/** PATCH sem defaults: campos ausentes não são alterados. */
export const ideaUpdate = z
  .object({
    title,
    description: optionalText,
    status: z.enum(IDEA_STATUS),
    priority: z.number().int().min(1).max(3),
  })
  .partial();

/** Mover card no Kanban: coluna de destino + índice dentro dela. */
export const ideaMove = z.object({
  status: z.enum(IDEA_STATUS),
  index: z.number().int().min(0),
});

/** URL http(s); string vazia vira null (campo limpo no formulário). */
const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/\S+$/i, 'URL inválida (use http:// ou https://)')
    .nullish(),
);
const devLevel = z.number().int().min(1).max(3);
const devLevelRule = {
  message: 'Nível (1–3) é obrigatório somente em "Desenvolvimento"',
  path: ['devLevel'],
};
const devLevelOk = (p: { status?: string; devLevel?: number | null }) =>
  (p.status === 'development') === (p.devLevel != null);

export const projectCreate = z
  .object({
    title,
    description: optionalText,
    status: z.enum(PROJECT_STATUS).default('idea'),
    devLevel: devLevel.nullish(),
    repoUrl: optionalUrl,
    deployUrl: optionalUrl,
  })
  .refine(devLevelOk, devLevelRule);

/** PATCH parcial. Se `status` vier, `devLevel` precisa ser coerente com ele. */
export const projectUpdate = z
  .object({
    title,
    description: optionalText,
    status: z.enum(PROJECT_STATUS),
    devLevel: devLevel.nullable(),
    repoUrl: optionalUrl,
    deployUrl: optionalUrl,
  })
  .partial()
  .refine((p) => p.status === undefined || devLevelOk(p), devLevelRule);

export const projectMove = z
  .object({
    status: z.enum(PROJECT_STATUS),
    devLevel: devLevel.nullish(),
    index: z.number().int().min(0),
  })
  .refine(devLevelOk, devLevelRule);

const cents = z.number().int().nonnegative().max(1e12);

export const financeActivityCreate = z.object({
  title,
  description: optionalText,
  status: z.enum(FINANCE_STATUS).default('idea'),
  kind: z.enum(FINANCE_KIND).default('business'),
  expectedMonthlyCents: cents.nullish(),
  actualMonthlyCents: cents.nullish(),
  currency: z.string().length(3).default('BRL'),
  projectId: z.number().int().positive().nullish(),
});

/** PATCH parcial (sem defaults). */
export const financeActivityUpdate = z
  .object({
    title,
    description: optionalText,
    status: z.enum(FINANCE_STATUS),
    kind: z.enum(FINANCE_KIND),
    expectedMonthlyCents: cents.nullable(),
    actualMonthlyCents: cents.nullable(),
    projectId: z.number().int().positive().nullable(),
  })
  .partial();

export const financeMove = z.object({
  status: z.enum(FINANCE_STATUS),
  index: z.number().int().min(0),
});

/** Entradas criadas pelo usuário: observação ou aviso (edições/status são automáticos). */
export const financeEntryCreate = z
  .object({
    type: z.enum(['note', 'alert']),
    content: z.string().trim().min(1, 'Escreva algo').max(5000),
    dueAt: isoDateTime.nullish(),
  })
  .refine((e) => e.type === 'alert' || !e.dueAt, {
    message: 'Só avisos têm data',
    path: ['dueAt'],
  });

export const financeEntryUpdate = z
  .object({
    content: z.string().trim().min(1).max(5000),
    dueAt: isoDateTime.nullable(),
    resolved: z.boolean(),
  })
  .partial();

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

export type IdeaCreate = z.input<typeof ideaCreate>;
export type IdeaUpdate = z.infer<typeof ideaUpdate>;
export type IdeaMove = z.infer<typeof ideaMove>;
export type ProjectCreate = z.infer<typeof projectCreate>;
export type ProjectUpdate = z.infer<typeof projectUpdate>;
export type ProjectMove = z.infer<typeof projectMove>;
export type FinanceActivityCreate = z.infer<typeof financeActivityCreate>;
export type FinanceActivityUpdate = z.infer<typeof financeActivityUpdate>;
export type FinanceMove = z.infer<typeof financeMove>;
export type FinanceEntryCreate = z.infer<typeof financeEntryCreate>;
export type FinanceEntryUpdate = z.infer<typeof financeEntryUpdate>;
export type ReminderCreate = z.infer<typeof reminderCreate>;
export type StudySubjectCreate = z.infer<typeof studySubjectCreate>;
export type TimeEntryCreate = z.infer<typeof timeEntryCreate>;
export type DailyGoalCreate = z.infer<typeof dailyGoalCreate>;
