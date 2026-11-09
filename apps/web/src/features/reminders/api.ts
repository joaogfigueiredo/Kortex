import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Occurrence,
  Reminder,
  ReminderCategory,
  ReminderCreate,
  ReminderUpdate,
} from '@kortex/shared';
import { api } from '../../lib/api';
import { toast } from '../../stores/toast';

const ROOT = ['reminders'] as const;

export const useCategories = () =>
  useQuery({
    queryKey: [...ROOT, 'categories'],
    queryFn: () => api.get<ReminderCategory[]>('/reminders/categories'),
    staleTime: 5 * 60_000,
  });

export const useOccurrences = (from: string, to: string) =>
  useQuery({
    queryKey: [...ROOT, 'occ', from, to],
    queryFn: () => api.get<Occurrence[]>(`/reminders/occurrences?from=${from}&to=${to}`),
    placeholderData: (prev) => prev, // mantém o mês anterior enquanto carrega o próximo
  });

export const useReminder = (id: number | null) =>
  useQuery({
    queryKey: [...ROOT, 'one', id],
    queryFn: () => api.get<Reminder>(`/reminders/${id}`),
    enabled: id != null,
  });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useReminderMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ROOT });

  const create = useMutation({
    mutationFn: (body: Partial<ReminderCreate> & { title: string; startAt: string }) =>
      api.post<Reminder>('/reminders', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: ReminderUpdate & { id: number }) =>
      api.patch<Reminder>(`/reminders/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/reminders/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  /** Marca/desmarca uma ocorrência com atualização otimista em todas as listas. */
  const toggle = useMutation({
    mutationFn: (o: { reminderId: number; date: string; done: boolean }) =>
      api.put(`/reminders/${o.reminderId}/occurrences/${o.date}`, { done: o.done }),
    onMutate: async (o) => {
      await qc.cancelQueries({ queryKey: [...ROOT, 'occ'] });
      qc.setQueriesData<Occurrence[]>({ queryKey: [...ROOT, 'occ'] }, (list) =>
        list?.map((x) =>
          x.reminderId === o.reminderId && (x.date === o.date || x.recurrence === 'none')
            ? { ...x, done: o.done }
            : x,
        ),
      );
    },
    onError: (e: Error) => {
      onError(e);
      invalidate();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [...ROOT, 'occ'] }),
  });

  const createCategory = useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      api.post<ReminderCategory>('/reminders/categories', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; color?: string }) =>
      api.patch<ReminderCategory>(`/reminders/categories/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const removeCategory = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/reminders/categories/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  return { create, update, remove, toggle, createCategory, updateCategory, removeCategory };
}
