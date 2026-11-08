import type { ProjectStatus } from '@kortex/shared';

/** Ordem do fluxo de um projeto (usada para saber se ele "avançou" ou "voltou"). */
const STAGE: Record<ProjectStatus, number> = {
  idea: 0,
  started: 1,
  development: 2,
  done: 3,
  deployed: 4,
};

export interface LifecycleDates {
  startedAt: string | null;
  finishedAt: string | null;
  deployedAt: string | null;
}

/**
 * Datas automáticas conforme o status:
 * - startedAt: definido ao sair de "idea"; limpo se voltar para "idea".
 * - finishedAt: definido ao chegar em "done"/"deployed"; limpo se voltar antes disso.
 * - deployedAt: definido ao chegar em "deployed"; limpo ao sair de lá.
 * Datas já existentes são preservadas enquanto o projeto continuar naquela fase.
 */
export function lifecycleDates(
  current: LifecycleDates,
  next: ProjectStatus,
  now = new Date().toISOString(),
): LifecycleDates {
  const stage = STAGE[next];
  return {
    startedAt: stage >= STAGE.started ? (current.startedAt ?? now) : null,
    finishedAt: stage >= STAGE.done ? (current.finishedAt ?? now) : null,
    deployedAt: stage >= STAGE.deployed ? (current.deployedAt ?? now) : null,
  };
}
