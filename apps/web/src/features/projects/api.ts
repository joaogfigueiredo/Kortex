import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectCreate, ProjectStatus, ProjectUpdate } from '@kortex/shared';
import { api } from '../../lib/api';
import { reorderOptimistic } from '../../lib/kanban';
import { toast } from '../../stores/toast';

const KEY = ['projects'] as const;

export const useProjects = () =>
  useQuery({ queryKey: KEY, queryFn: () => api.get<Project[]>('/projects') });

const onError = (e: Error) => toast.error('Não foi possível salvar', e.message);

export function useProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (body: Partial<ProjectCreate> & { title: string }) =>
      api.post<Project>('/projects', body),
    onSuccess: () => invalidate(),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: ProjectUpdate & { id: number }) =>
      api.patch<Project>(`/projects/${id}`, body),
    onSuccess: () => invalidate(),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/projects/${id}`),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['ideas'] }); // ideia de origem é liberada
    },
    onError,
  });

  const moveMutation = useMutation({
    mutationFn: (v: {
      id: number;
      status: ProjectStatus;
      devLevel: number | null;
      index: number;
    }) =>
      api.post<Project>(`/projects/${v.id}/move`, {
        status: v.status,
        devLevel: v.devLevel,
        index: v.index,
      }),
    onError: (e: Error) => {
      onError(e);
      invalidate();
    },
    onSettled: () => invalidate(),
  });

  /** Otimista e síncrono: o card não "volta" depois de solto. */
  const move = (id: number, status: ProjectStatus, devLevel: number | null, index: number) => {
    qc.setQueryData<Project[]>(KEY, (list) =>
      list
        ? reorderOptimistic(
            list,
            id,
            (p) => p.status === status && (status !== 'development' || p.devLevel === devLevel),
            { status, devLevel },
            index,
          )
        : list,
    );
    moveMutation.mutate({ id, status, devLevel, index });
  };

  return { create, update, remove, move };
}
