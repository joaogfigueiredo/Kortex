/**
 * Schema Drizzle — espelho fiel de docs/DATABASE.sql.
 * Qualquer mudança aqui: `npm run db:generate` e depois `npm run db:migrate`.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
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
  TAG_ENTITY,
  TIME_MODULE,
  TIME_SOURCE,
} from '@kortex/shared';

const NOW = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const createdAt = () => text('created_at').notNull().default(NOW);
const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(NOW)
    .$onUpdate(() => new Date().toISOString());
const bool = (name: string) => integer(name, { mode: 'boolean' });

/** Gera `col IN ('a','b',...)` a partir de um enum compartilhado. */
const inList = (col: AnySQLiteColumn, values: readonly string[]) =>
  sql`${col} IN (${sql.raw(values.map((v) => `'${v}'`).join(','))})`;

// ========== CONFIG ==========
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6FE3FF'),
});

export const entityTags = sqliteTable(
  'entity_tags',
  {
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: TAG_ENTITY }).notNull(),
    entityId: integer('entity_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tagId, t.entityType, t.entityId] }),
    check('entity_tags_type_ck', inList(t.entityType, TAG_ENTITY)),
  ],
);

// ========== C. PROJETOS (antes de ideas por causa da FK) ==========
export const projects = sqliteTable(
  'projects',
  {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: PROJECT_STATUS }).notNull().default('idea'),
    devLevel: integer('dev_level'),
    position: real('position').notNull().default(0),
    repoUrl: text('repo_url'),
    deployUrl: text('deploy_url'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    deployedAt: text('deployed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_projects_col').on(t.status, t.devLevel, t.position),
    check('projects_status_ck', inList(t.status, PROJECT_STATUS)),
    check('projects_dev_level_ck', sql`${t.devLevel} IN (1,2,3)`),
    check(
      'projects_dev_level_required_ck',
      sql`(${t.status} = 'development') = (${t.devLevel} IS NOT NULL)`,
    ),
  ],
);

// ========== A. IDEIAS ==========
export const ideas = sqliteTable(
  'ideas',
  {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: IDEA_STATUS }).notNull().default('organized'),
    priority: integer('priority').notNull().default(2),
    position: real('position').notNull().default(0),
    promotedProjectId: integer('promoted_project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: text('completed_at'),
  },
  (t) => [
    index('idx_ideas_status_pos').on(t.status, t.position),
    check('ideas_status_ck', inList(t.status, IDEA_STATUS)),
    check('ideas_priority_ck', sql`${t.priority} BETWEEN 1 AND 3`),
  ],
);

// ========== B. LEMBRETES ==========
export const reminderCategories = sqliteTable('reminder_categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull(),
});

export const reminders = sqliteTable(
  'reminders',
  {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    kind: text('kind', { enum: REMINDER_KIND }).notNull().default('reminder'),
    categoryId: integer('category_id').references(() => reminderCategories.id, {
      onDelete: 'set null',
    }),
    startAt: text('start_at').notNull(),
    endAt: text('end_at'),
    allDay: bool('all_day').notNull().default(false),
    recurrence: text('recurrence', { enum: RECURRENCE }).notNull().default('none'),
    recurrenceWeekdays: integer('recurrence_weekdays'),
    recurrenceUntil: text('recurrence_until'),
    notifyMinutesBefore: integer('notify_minutes_before'),
    done: bool('done').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_reminders_start').on(t.startAt),
    check('reminders_kind_ck', inList(t.kind, REMINDER_KIND)),
    check('reminders_recurrence_ck', inList(t.recurrence, RECURRENCE)),
  ],
);

export const reminderCompletions = sqliteTable(
  'reminder_completions',
  {
    reminderId: integer('reminder_id')
      .notNull()
      .references(() => reminders.id, { onDelete: 'cascade' }),
    occurrenceDate: text('occurrence_date').notNull(),
    completedAt: text('completed_at').notNull().default(NOW),
  },
  (t) => [primaryKey({ columns: [t.reminderId, t.occurrenceDate] })],
);

// ========== D. ATIVIDADES FINANCEIRAS ==========
export const financeActivities = sqliteTable(
  'finance_activities',
  {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: FINANCE_STATUS }).notNull().default('idea'),
    kind: text('kind', { enum: FINANCE_KIND }).notNull().default('business'),
    expectedMonthlyCents: integer('expected_monthly_cents'),
    actualMonthlyCents: integer('actual_monthly_cents'),
    currency: text('currency').notNull().default('BRL'),
    position: real('position').notNull().default(0),
    projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_finance_col').on(t.status, t.position),
    check('finance_status_ck', inList(t.status, FINANCE_STATUS)),
    check('finance_kind_ck', inList(t.kind, FINANCE_KIND)),
  ],
);

export const financeEntries = sqliteTable(
  'finance_entries',
  {
    id: integer('id').primaryKey(),
    activityId: integer('activity_id')
      .notNull()
      .references(() => financeActivities.id, { onDelete: 'cascade' }),
    type: text('type', { enum: FINANCE_ENTRY_TYPE }).notNull(),
    content: text('content').notNull(),
    meta: text('meta', { mode: 'json' }),
    dueAt: text('due_at'),
    resolved: bool('resolved').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_fin_entries_act').on(t.activityId, t.createdAt),
    check('finance_entries_type_ck', inList(t.type, FINANCE_ENTRY_TYPE)),
  ],
);

// ========== E. ESTUDOS ==========
export const studySubjects = sqliteTable(
  'study_subjects',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('#6FE3FF'),
    level: text('level', { enum: STUDY_LEVEL }).notNull().default('beginner'),
    progress: integer('progress').notNull().default(0),
    targetHours: real('target_hours'),
    archived: bool('archived').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('study_level_ck', inList(t.level, STUDY_LEVEL)),
    check('study_progress_ck', sql`${t.progress} BETWEEN 0 AND 100`),
  ],
);

// ========== TEMPO ==========
export const timeEntries = sqliteTable(
  'time_entries',
  {
    id: integer('id').primaryKey(),
    module: text('module', { enum: TIME_MODULE }).notNull(),
    refId: integer('ref_id'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    durationSec: integer('duration_sec').notNull().default(0),
    source: text('source', { enum: TIME_SOURCE }).notNull().default('manual'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_time_module_date').on(t.module, t.startedAt),
    index('idx_time_ref').on(t.module, t.refId),
    check('time_module_ck', inList(t.module, TIME_MODULE)),
    check('time_source_ck', inList(t.source, TIME_SOURCE)),
  ],
);

// ========== SAÚDE ==========
export const workouts = sqliteTable(
  'workouts',
  {
    id: integer('id').primaryKey(),
    date: text('date').notNull(),
    type: text('type').notNull(),
    durationMin: integer('duration_min'),
    intensity: integer('intensity'),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_workouts_date').on(t.date),
    check('workouts_intensity_ck', sql`${t.intensity} BETWEEN 1 AND 5`),
  ],
);

export const mealPlan = sqliteTable('meal_plan', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  time: text('time'),
  description: text('description'),
  weekdays: integer('weekdays').notNull().default(127),
  position: real('position').notNull().default(0),
  active: bool('active').notNull().default(true),
});

export const mealLogs = sqliteTable(
  'meal_logs',
  {
    mealId: integer('meal_id')
      .notNull()
      .references(() => mealPlan.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status', { enum: MEAL_STATUS }).notNull(),
    note: text('note'),
  },
  (t) => [
    primaryKey({ columns: [t.mealId, t.date] }),
    check('meal_logs_status_ck', inList(t.status, MEAL_STATUS)),
  ],
);

// ========== METAS DIÁRIAS ==========
export const dailyGoals = sqliteTable('daily_goals', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  weekdays: integer('weekdays').notNull().default(127),
  icon: text('icon'),
  position: real('position').notNull().default(0),
  active: bool('active').notNull().default(true),
  createdAt: createdAt(),
});

export const goalChecks = sqliteTable(
  'goal_checks',
  {
    goalId: integer('goal_id')
      .notNull()
      .references(() => dailyGoals.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    checkedAt: text('checked_at').notNull().default(NOW),
  },
  (t) => [primaryKey({ columns: [t.goalId, t.date] })],
);
