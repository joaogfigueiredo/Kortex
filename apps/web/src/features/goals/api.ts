import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DailyGoal,
  DailyGoalCreate,
  DailyGoalUpdate,
  GoalOfDay,
  GoalsSummary,
} from '@kortex/shared';
import { api } from '../../lib/api';
import { todayStr } from '../../lib/dates';
import { toast } from '../../stores/toast';

const ROOT = ['goals'] as const;

export const useGoals = () =>
  useQuery({ queryKey: [...ROOT, 'all'], queryFn: () => api.get<DailyGoal[]>('/goals') });

export const useGoalsOfDay = (date: string) =>
  useQuery({
    queryKey: [...ROOT, 'day', date],
    queryFn: () => api.get<GoalOfDay[]>(`/goals/day?date=${date}`),
  });

export const useGoalsSummary = () =>
  useQuery({
    queryKey: [...ROOT, 'summary', todayStr()],
    queryFn: () => api.get<GoalsSummary>(`/goals/summary?today=${todayStr()}`),
  });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useGoalMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ROOT });

  const create = useMutation({
    mutationFn: (body: Partial<DailyGoalCreate> & { title: string }) =>
      api.post<DailyGoal>('/goals', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: DailyGoalUpdate & { id: number }) =>
      api.patch<DailyGoal>(`/goals/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/goals/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  /** Check otimista: o círculo acende na hora; a sequência vem do servidor. */
  const check = useMutation({
    mutationFn: ({ id, date, done }: { id: number; date: string; done: boolean }) =>
      api.put(`/goals/${id}/checks/${date}`, { done }),
    onMutate: async ({ id, date, done }) => {
      const key = [...ROOT, 'day', date];
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<GoalOfDay[]>(key, (list) =>
        list?.map((g) => (g.id === id ? { ...g, done } : g)),
      );
    },
    onError: (e: Error) => {
      onError(e);
      invalidate();
    },
    onSettled: () => invalidate(),
  });

  return { create, update, remove, check };
}
