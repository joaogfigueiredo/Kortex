import { describe, expect, it } from 'vitest';
import { planMove, POSITION_STEP } from './ordering';

const col = (...ps: number[]) => ps.map((position, i) => ({ id: i + 1, position }));

describe('planMove', () => {
  it('coluna vazia', () => {
    expect(planMove([], 99, 0)).toEqual([{ id: 99, position: POSITION_STEP }]);
  });

  it('início, meio e fim', () => {
    const c = col(1024, 2048, 3072);
    expect(planMove(c, 99, 0)).toEqual([{ id: 99, position: 0 }]);
    expect(planMove(c, 99, 1)).toEqual([{ id: 99, position: 1536 }]);
    expect(planMove(c, 99, 3)).toEqual([{ id: 99, position: 4096 }]);
  });

  it('índice fora do intervalo vai para o fim', () => {
    expect(planMove(col(10), 99, 50)).toEqual([{ id: 99, position: 10 + POSITION_STEP }]);
  });

  it('renumera quando não há espaço entre vizinhos', () => {
    const c = col(1, 1 + 1e-9);
    const updates = planMove(c, 99, 1);
    expect(updates.map((u) => u.id)).toEqual([1, 99, 2]);
    expect(updates.map((u) => u.position)).toEqual([1024, 2048, 3072]);
  });
});
