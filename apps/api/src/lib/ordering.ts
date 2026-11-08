/**
 * Ordenação fracionária para Kanbans.
 * Cada card tem `position REAL`; inserir entre A e B = (A + B) / 2, então mover
 * um card costuma ser 1 UPDATE. Quando o espaço entre vizinhos fica pequeno
 * demais, a coluna inteira é renumerada.
 */
export const POSITION_STEP = 1024;
const MIN_GAP = 1e-6;

export interface Positioned {
  id: number;
  position: number;
}

/**
 * Calcula as atualizações necessárias para colocar `movingId` no índice `index`
 * de uma coluna. `siblings` são os outros cards da coluna de destino, já
 * ordenados e SEM o card que está sendo movido.
 */
export function planMove(siblings: Positioned[], movingId: number, index: number): Positioned[] {
  const i = Math.max(0, Math.min(index, siblings.length));
  const before = siblings[i - 1]?.position;
  const after = siblings[i]?.position;

  let position: number;
  if (before === undefined && after === undefined) position = POSITION_STEP;
  else if (before === undefined) position = after! - POSITION_STEP;
  else if (after === undefined) position = before + POSITION_STEP;
  else position = (before + after) / 2;

  const tooTight =
    (before !== undefined && position - before < MIN_GAP) ||
    (after !== undefined && after - position < MIN_GAP);
  if (!tooTight) return [{ id: movingId, position }];

  // Renumera a coluna inteira com espaçamento uniforme.
  const ordered = [
    ...siblings.slice(0, i).map((s) => s.id),
    movingId,
    ...siblings.slice(i).map((s) => s.id),
  ];
  return ordered.map((id, n) => ({ id, position: (n + 1) * POSITION_STEP }));
}

/** Posição para adicionar ao fim de uma coluna. */
export const positionAfter = (maxPosition: number | null | undefined) =>
  (maxPosition ?? 0) + POSITION_STEP;
