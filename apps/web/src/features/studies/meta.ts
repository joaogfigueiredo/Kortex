import { STUDY_LEVEL, type StudyLevel } from '@kortex/shared';
import { daysBetweenStr } from '../../lib/dates';

export const SUBJECT_COLORS = ['#6FE3FF', '#B79CFF', '#4DF5B8', '#FFD166', '#FF8FC7', '#FF6B6B'];

export const levelIndex = (l: StudyLevel) => STUDY_LEVEL.indexOf(l);
export const nextLevel = (l: StudyLevel): StudyLevel | null =>
  STUDY_LEVEL[levelIndex(l) + 1] ?? null;

/** Quão "fria" está a matéria: dias desde a última sessão. */
export type Freshness = 'today' | 'recent' | 'cooling' | 'cold' | 'never';

export function freshness(lastStudiedAt: string | null, today: string): Freshness {
  if (!lastStudiedAt) return 'never';
  const days = daysBetweenStr(lastStudiedAt.slice(0, 10), today);
  if (days <= 0) return 'today';
  if (days <= 3) return 'recent';
  if (days <= 7) return 'cooling';
  return 'cold';
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  today: 'Estudou hoje',
  recent: 'Em dia',
  cooling: 'Esfriando',
  cold: 'Parada há mais de uma semana',
  never: 'Ainda não estudou',
};
