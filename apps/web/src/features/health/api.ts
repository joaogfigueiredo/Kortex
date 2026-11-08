import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Meal,
  MealPlanCreate,
  MealPlanUpdate,
  MealStatus,
  WellnessDay,
  WellnessSummary,
  Workout,
  WorkoutCreate,
} from '@kortex/shared';
import { api } from '../../lib/api';
import { todayStr } from '../../lib/dates';
import { toast } from '../../stores/toast';

const ROOT = ['health'] as const;

export const useWellnessDay = (date: string) =>
  useQuery({
    queryKey: [...ROOT, 'day', date],
    queryFn: () => api.get<WellnessDay>(`/wellness/day?date=${date}`),
    placeholderData: (prev) => prev,
  });

export const useWellnessSummary = () =>
  useQuery({
    queryKey: [...ROOT, 'summary', todayStr()],
    queryFn: () => api.get<WellnessSummary>(`/wellness/summary?today=${todayStr()}`),
  });

export const useMeals = () =>
  useQuery({ queryKey: [...ROOT, 'meals'], queryFn: () => api.get<Meal[]>('/meals') });

export const useWorkoutTypes = () =>
  useQuery({ queryKey: [...ROOT, 'types'], queryFn: () => api.get<string[]>('/workouts/types') });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useHealthMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ROOT });

  const addWorkout = useMutation({
    mutationFn: (body: WorkoutCreate) => api.post<Workout>('/workouts', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const removeWorkout = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/workouts/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  /** Marca (ou limpa, com status null) uma refeição no dia — otimista. */
  const setMealLog = useMutation({
    mutationFn: ({
      mealId,
      date,
      status,
    }: {
      mealId: number;
      date: string;
      status: MealStatus | null;
    }) =>
      status
        ? api.put(`/meals/${mealId}/logs/${date}`, { status })
        : api.delete(`/meals/${mealId}/logs/${date}`),
    onMutate: async ({ mealId, date, status }) => {
      const key = [...ROOT, 'day', date];
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<WellnessDay>(
        key,
        (d) =>
          d && {
            ...d,
            meals: d.meals.map((m) =>
              m.id === mealId
                ? { ...m, log: status ? { mealId, date, status, note: m.log?.note ?? null } : null }
                : m,
            ),
          },
      );
    },
    onError: (e: Error) => {
      onError(e);
      invalidate();
    },
    onSettled: () => invalidate(),
  });

  const createMeal = useMutation({
    mutationFn: (body: Partial<MealPlanCreate> & { name: string }) =>
      api.post<Meal>('/meals', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const updateMeal = useMutation({
    mutationFn: ({ id, ...body }: MealPlanUpdate & { id: number }) =>
      api.patch<Meal>(`/meals/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const removeMeal = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/meals/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  return { addWorkout, removeWorkout, setMealLog, createMeal, updateMeal, removeMeal };
}
