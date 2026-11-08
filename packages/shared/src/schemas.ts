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
export const reminderCategoryUpdate = reminderCategoryCreate.partial();

/**
 * Horário "flutuante" (local, sem fuso): "2026-11-20T15:00".
 * Como uma agenda de papel: 15h é 15h, independente de fuso/horário de verão.
 */
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Data/hora inválida (YYYY-MM-DDTHH:mm)');

const reminderFields = z.object({
  title,
  description: optionalText,
  kind: z.enum(REMINDER_KIND),
  categoryId: z.number().int().positive().nullable(),
  startAt: localDateTime,
  endAt: localDateTime.nullable(),
  allDay: z.boolean(),
  recurrence: z.enum(RECURRENCE),
  /** Bitmask Dom=1..Sáb=64; obrigatório (>0) em "weekly". */
  recurrenceWeekdays: weekdayMask.nullable(),
  /** Último dia (inclusivo) da repetição. */
  recurrenceUntil: isoDate.nullable(),
  notifyMinutesBefore: z.number().int().nonnegative().nullable(),
});

type ReminderShape = Partial<z.infer<typeof reminderFields>>;
const reminderRules = (r: ReminderShape, ctx: z.RefinementCtx) => {
  if (r.endAt && r.startAt && r.endAt < r.startAt)
    ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'O fim deve ser depois do início' });
  if (r.recurrence === 'weekly' && !r.recurrenceWeekdays)
    ctx.addIssue({
      code: 'custom',
      path: ['recurrenceWeekdays'],
      message: 'Escolha ao menos um dia',
    });
  if (r.recurrenceUntil && r.startAt && r.recurrenceUntil < r.startAt.slice(0, 10))
    ctx.addIssue({
      code: 'custom',
      path: ['recurrenceUntil'],
      message: 'Deve ser depois do início',
    });
};

export const reminderCreate = reminderFields
  .extend({
    description: optionalText,
    kind: z.enum(REMINDER_KIND).default('reminder'),
    categoryId: z.number().int().positive().nullish(),
    endAt: localDateTime.nullish(),
    allDay: z.boolean().default(false),
    recurrence: z.enum(RECURRENCE).default('none'),
    recurrenceWeekdays: weekdayMask.nullish(),
    recurrenceUntil: isoDate.nullish(),
    notifyMinutesBefore: z.number().int().nonnegative().nullish(),
  })
  .superRefine(reminderRules);

/** PATCH parcial; as regras cruzadas são revalidadas no servidor com o estado final. */
export const reminderUpdate = reminderFields.partial();
export const reminderRulesCheck = reminderFields.partial().superRefine(reminderRules);

/** Intervalo de datas para expandir ocorrências (máx. ~1 ano). */
export const occurrenceRange = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.from <= r.to, { message: '"from" deve ser <= "to"', path: ['to'] });

export const occurrenceToggle = z.object({ done: z.boolean() });
export const occurrenceDateParam = z.object({
  id: z.coerce.number().int().positive(),
  date: isoDate,
});

export const studySubjectCreate = z.object({
  name: title,
  description: optionalText,
  color: hexColor.default('#6FE3FF'),
  level: z.enum(STUDY_LEVEL).default('beginner'),
  progress: z.number().int().min(0).max(100).default(0),
  targetHours: z.number().positive().max(100_000).nullish(),
});

/** PATCH parcial (sem defaults). */
export const studySubjectUpdate = z
  .object({
    name: title,
    description: optionalText,
    color: hexColor,
    level: z.enum(STUDY_LEVEL),
    progress: z.number().int().min(0).max(100),
    targetHours: z.number().positive().max(100_000).nullable(),
    archived: z.boolean(),
  })
  .partial();

/**
 * Instante local "flutuante" com segundos opcionais: "2026-11-08T21:30" ou "…:30:15".
 * Agrupar por dia = os 10 primeiros caracteres, sem conversão de fuso.
 */
const localTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Data/hora inválida (YYYY-MM-DDTHH:mm[:ss])');

export const timeEntryCreate = z.object({
  module: z.enum(TIME_MODULE),
  refId: z.number().int().positive().nullish(),
  startedAt: localTimestamp,
  endedAt: localTimestamp.nullish(),
  /** 1 s a 24 h */
  durationSec: z.number().int().min(1).max(86_400),
  source: z.enum(TIME_SOURCE).default('manual'),
  note: optionalText,
});

export const timeEntryQuery = z.object({
  module: z.enum(TIME_MODULE).optional(),
  refId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/** Resumo de estudos: o cliente informa o "hoje" local para semana/sequência. */
export const studySummaryQuery = z.object({ today: isoDate });

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
export type ReminderUpdate = z.infer<typeof reminderUpdate>;
export type StudySubjectCreate = z.infer<typeof studySubjectCreate>;
export type StudySubjectUpdate = z.infer<typeof studySubjectUpdate>;
export type TimeEntryCreate = z.infer<typeof timeEntryCreate>;
export type DailyGoalCreate = z.infer<typeof dailyGoalCreate>;
