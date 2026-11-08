import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FinanceActivity,
  FinanceActivityCreate,
  FinanceActivityUpdate,
  FinanceEntry,
  FinanceEntryCreate,
  FinanceEntryUpdate,
  FinanceStatus,
} from '@kortex/shared';
import { api } from '../../lib/api';
import { reorderOptimistic } from '../../lib/kanban';
import { toast } from '../../stores/toast';

const KEY = ['finance'] as const;
const entriesKey = (id: number) => ['finance', id, 'entries'] as const;

export const useFinance = () =>
  useQuery({ queryKey: KEY, queryFn: () => api.get<FinanceActivity[]>('/finance') });

export const useFinanceEntries = (id: number | null) =>
  useQuery({
    queryKey: entriesKey(id ?? 0),
    queryFn: () => api.get<FinanceEntry[]>(`/finance/${id}/entries`),
    enabled: id != null,
  });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useFinanceMutations() {
  const qc = useQueryClient();
  /** Invalida a lista e todos os históricos (prefixo ['finance']). */
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (body: Partial<FinanceActivityCreate> & { title: string }) =>
      api.post<FinanceActivity>('/finance', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: FinanceActivityUpdate & { id: number }) =>
      api.patch<FinanceActivity>(`/finance/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/finance/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  const moveMutation = useMutation({
    mutationFn: (v: { id: number; status: FinanceStatus; index: number }) =>
      api.post<FinanceActivity>(`/finance/${v.id}/move`, { status: v.status, index: v.index }),
    onError: (e: Error) => {
      onError(e);
      invalidate();
    },
    onSettled: () => invalidate(),
  });

  const move = (id: number, status: FinanceStatus, index: number) => {
    qc.setQueryData<FinanceActivity[]>(KEY, (list) =>
      list ? reorderOptimistic(list, id, (a) => a.status === status, { status }, index) : list,
    );
    moveMutation.mutate({ id, status, index });
  };

  // ---- histórico / observações / avisos ----
  const addEntry = useMutation({
    mutationFn: ({ activityId, ...body }: FinanceEntryCreate & { activityId: number }) =>
      api.post<FinanceEntry>(`/finance/${activityId}/entries`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, ...body }: FinanceEntryUpdate & { id: number }) =>
      api.patch<FinanceEntry>(`/finance/entries/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const removeEntry = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/finance/entries/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  return { create, update, remove, move, addEntry, updateEntry, removeEntry };
}
