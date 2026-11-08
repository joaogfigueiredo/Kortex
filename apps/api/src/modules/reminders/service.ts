import { and, asc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import {
  reminderRulesCheck,
  type Occurrence,
  type ReminderCreate,
  type ReminderUpdate,
} from '@kortex/shared';
import type { DB } from '../../db/client';
import { reminderCategories, reminderCompletions, reminders } from '../../db/schema';
import { HttpError, notFound } from '../../plugins/error-handler';
import { daysBetween, expandDates, occursOn } from './recurrence';

const MAX_RANGE_DAYS = 400;

function getOrThrow(db: DB, id: number) {
  const row = db.select().from(reminders).where(eq(reminders.id, id)).get();
  if (!row) throw notFound('Lembrete');
  return row;
}

function assertCategory(db: DB, categoryId: number | null | undefined) {
  if (categoryId == null) return;
  const exists = db
    .select({ id: reminderCategories.id })
    .from(reminderCategories)
    .where(eq(reminderCategories.id, categoryId))
    .get();
  if (!exists) throw new HttpError(400, 'Categoria não existe');
}

/** Normaliza campos dependentes da recorrência. */
function normalize<T extends Partial<ReminderCreate>>(r: T): T {
  const out = { ...r };
  if (out.recurrence && out.recurrence !== 'weekly') out.recurrenceWeekdays = null;
  if (out.recurrence === 'none') out.recurrenceUntil = null;
  return out;
}

// ---------- Categorias ----------
export const listCategories = (db: DB) =>
  db.select().from(reminderCategories).orderBy(asc(reminderCategories.id)).all();

export const createCategory = (db: DB, input: { name: string; color: string }) =>
  db.insert(reminderCategories).values(input).returning().get();

export function updateCategory(db: DB, id: number, patch: { name?: string; color?: string }) {
  const row = db
    .update(reminderCategories)
    .set(patch)
    .where(eq(reminderCategories.id, id))
    .returning()
    .get();
  if (!row) throw notFound('Categoria');
  return row;
}

export function deleteCategory(db: DB, id: number) {
  // FK: lembretes ficam sem categoria (ON DELETE SET NULL)
  const res = db.delete(reminderCategories).where(eq(reminderCategories.id, id)).run();
  if (res.changes === 0) throw notFound('Categoria');
}

// ---------- Lembretes ----------
export const listReminders = (db: DB) =>
  db.select().from(reminders).orderBy(asc(reminders.startAt)).all();

export const getReminder = getOrThrow;

export function createReminder(db: DB, input: ReminderCreate) {
  assertCategory(db, input.categoryId);
  return db.insert(reminders).values(normalize(input)).returning().get();
}

export function updateReminder(db: DB, id: number, patch: ReminderUpdate) {
  const current = getOrThrow(db, id);
  assertCategory(db, patch.categoryId);
  // Revalida as regras cruzadas sobre o estado FINAL (atual + patch).
  const merged = normalize({ ...current, ...patch });
  reminderRulesCheck.parse(merged);
  const changes = normalize(patch);
  if (changes.recurrence) {
    changes.recurrenceWeekdays = merged.recurrenceWeekdays;
    changes.recurrenceUntil = merged.recurrenceUntil;
  }
  return db.update(reminders).set(changes).where(eq(reminders.id, id)).returning().get();
}

export function deleteReminder(db: DB, id: number) {
  const res = db.delete(reminders).where(eq(reminders.id, id)).run();
  if (res.changes === 0) throw notFound('Lembrete');
}

// ---------- Ocorrências ----------

/** Expande todos os lembretes no intervalo [from, to] (datas locais). */
export function listOccurrences(db: DB, from: string, to: string): Occurrence[] {
  if (daysBetween(from, to) > MAX_RANGE_DAYS)
    throw new HttpError(400, `Intervalo máximo de ${MAX_RANGE_DAYS} dias`);

  // Candidatos: começam até `to` e (não repetem e começam a partir de `from`) ou repetem.
  const rows = db
    .select()
    .from(reminders)
    .where(
      and(
        lte(reminders.startAt, `${to}T23:59`),
        or(
          gte(reminders.startAt, from),
          inArray(reminders.recurrence, ['daily', 'weekly', 'monthly']),
        ),
      ),
    )
    .all();
  if (!rows.length) return [];

  const colors = new Map(listCategories(db).map((c) => [c.id, c.color]));
  const completions = db
    .select()
    .from(reminderCompletions)
    .where(
      and(
        inArray(
          reminderCompletions.reminderId,
          rows.map((r) => r.id),
        ),
        gte(reminderCompletions.occurrenceDate, from),
        lte(reminderCompletions.occurrenceDate, to),
      ),
    )
    .all();
  const doneSet = new Set(completions.map((c) => `${c.reminderId}|${c.occurrenceDate}`));

  const out: Occurrence[] = [];
  for (const r of rows) {
    for (const date of expandDates(r, from, to)) {
      out.push({
        reminderId: r.id,
        date,
        time: r.allDay ? null : r.startAt.slice(11, 16),
        endTime: r.allDay || !r.endAt ? null : r.endAt.slice(11, 16),
        title: r.title,
        description: r.description,
        kind: r.kind,
        categoryId: r.categoryId,
        color: r.categoryId ? (colors.get(r.categoryId) ?? null) : null,
        recurrence: r.recurrence,
        allDay: r.allDay,
        done: r.recurrence === 'none' ? r.done : doneSet.has(`${r.id}|${date}`),
      });
    }
  }
  // Dia; depois "dia todo" primeiro; depois horário.
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.time ?? '').localeCompare(b.time ?? '') ||
      a.reminderId - b.reminderId,
  );
}

/** Marca/desmarca uma ocorrência como concluída. */
export function setOccurrenceDone(db: DB, id: number, date: string, done: boolean) {
  const r = getOrThrow(db, id);
  if (!occursOn(r, date)) throw new HttpError(400, 'O lembrete não ocorre nesta data');
  if (r.recurrence === 'none') {
    db.update(reminders).set({ done }).where(eq(reminders.id, id)).run();
  } else if (done) {
    db.insert(reminderCompletions)
      .values({ reminderId: id, occurrenceDate: date })
      .onConflictDoNothing()
      .run();
  } else {
    db.delete(reminderCompletions)
      .where(
        and(eq(reminderCompletions.reminderId, id), eq(reminderCompletions.occurrenceDate, date)),
      )
      .run();
  }
  return { reminderId: id, date, done };
}
