import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Idea, IdeaCreate, IdeaStatus, IdeaUpdate, Project } from '@kortex/shared';
import { api } from '../../lib/api';
import { toast } from '../../stores/toast';

const KEY = ['ideas'] as const;

export const useIdeas = () => useQuery({ queryKey: KEY, queryFn: () => api.get<Idea[]>('/ideas') });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useIdeaMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (body: IdeaCreate) => api.post<Idea>('/ideas', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: IdeaUpdate & { id: number }) =>
      api.patch<Idea>(`/ideas/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/ideas/${id}`),
    onSuccess: () => invalidate(),
    onError,
  });

  const promote = useMutation({
    mutationFn: (id: number) => api.post<{ idea: Idea; project: Project }>(`/ideas/${id}/promote`),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status, index }: { id: number; status: IdeaStatus; index: number }) =>
      api.post<Idea>(`/ideas/${id}/move`, { status, index }),
    onError: (e: Error) => {
      onError(e);
      invalidate(); // desfaz o otimista recarregando do servidor
    },
    onSettled: () => invalidate(),
  });

  /**
   * Atualização otimista SÍNCRONA (antes do request) para o card não "voltar"
   * por um frame depois de solto.
   */
  const move = (id: number, status: IdeaStatus, index: number) => {
    qc.setQueryData<Idea[]>(KEY, (list) => (list ? reorder(list, id, status, index) : list));
    moveMutation.mutate({ id, status, index });
  };

  return { create, update, remove, promote, move };
}

/** Reordena a lista local: as colunas são montadas na ordem do array. */
function reorder(list: Idea[], id: number, status: IdeaStatus, index: number): Idea[] {
  const moving = list.find((i) => i.id === id);
  if (!moving) return list;
  const rest = list.filter((i) => i.id !== id);
  const column = rest.filter((i) => i.status === status);
  const others = rest.filter((i) => i.status !== status);
  const updated: Idea = {
    ...moving,
    status,
    completedAt: status === 'done' ? (moving.completedAt ?? new Date().toISOString()) : null,
  };
  column.splice(Math.min(index, column.length), 0, updated);
  return [...others, ...column];
}
