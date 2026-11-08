/** Utilitários compartilhados pelos Kanbans (Ideias, Projetos, Finanças). */

/**
 * Reordena a lista local de forma otimista. As colunas são montadas filtrando
 * a lista na ordem do array, então basta reposicionar o item no array.
 * @param inTarget identifica os itens que pertencem à coluna de destino
 */
export function reorderOptimistic<T extends { id: number }>(
  list: T[],
  id: number,
  inTarget: (item: T) => boolean,
  patch: Partial<T>,
  index: number,
): T[] {
  const moving = list.find((i) => i.id === id);
  if (!moving) return list;
  const rest = list.filter((i) => i.id !== id);
  const column = rest.filter(inTarget);
  const others = rest.filter((i) => !inTarget(i));
  column.splice(Math.min(index, column.length), 0, { ...moving, ...patch });
  return [...others, ...column];
}

/**
 * Com busca ativa a coluna exibida é parcial: converte o índice visível em
 * índice real (o card fica antes do próximo card visível).
 */
export function toFullIndex<T extends { id: number }>(
  visible: T[],
  full: T[],
  movingId: number,
  visibleIndex: number,
): number {
  const vis = visible.filter((i) => i.id !== movingId);
  const all = full.filter((i) => i.id !== movingId);
  const next = vis[visibleIndex];
  return next ? all.findIndex((i) => i.id === next.id) : all.length;
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const matchesQuery = (q: string, ...fields: (string | null | undefined)[]) =>
  !q || fields.some((f) => f && normalize(f).includes(q));
