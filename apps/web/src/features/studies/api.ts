import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StudySubject,
  StudySubjectCreate,
  StudySubjectUpdate,
  StudySummary,
  TimeEntry,
} from '@kortex/shared';
import { api } from '../../lib/api';
import { todayStr } from '../../lib/dates';
import { toast } from '../../stores/toast';

const ROOT = ['studies'] as const;

export const useSubjects = () =>
  useQuery({
    queryKey: [...ROOT, 'list', todayStr()],
    queryFn: () => api.get<StudySubject[]>(`/studies?today=${todayStr()}`),
  });

export const useStudySummary = () =>
  useQuery({
    queryKey: [...ROOT, 'summary', todayStr()],
    queryFn: () => api.get<StudySummary>(`/studies/summary?today=${todayStr()}`),
  });

export const useSessions = (subjectId: number | null) =>
  useQuery({
    queryKey: [...ROOT, 'sessions', subjectId],
    queryFn: () => api.get<TimeEntry[]>(`/time?module=study&refId=${subjectId}&limit=50`),
    enabled: subjectId != null,
  });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useStudyMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ROOT });

  const create = useMutation({
    mutationFn: (body: Partial<StudySubjectCreate> & { name: string }) =>
      api.post<StudySubject>(`/studies?today=${todayStr()}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: StudySubjectUpdate & { id: number }) =>
      api.patch<StudySubject>(`/studies/${id}?today=${todayStr()}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/studies/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  const addSession = useMutation({
    mutationFn: (body: {
      refId: number;
      startedAt: string;
      durationSec: number;
      note?: string | null;
    }) => api.post<TimeEntry>('/time', { module: 'study', source: 'manual', ...body }),
    onSuccess: () => invalidate(),
    onError,
  });

  const removeSession = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/time/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  return { create, update, remove, addSession, removeSession };
}
