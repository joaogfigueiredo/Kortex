import { describe, expect, it } from 'vitest';
import { clock } from './focusDevice';
import { elapsedMs, type FocusSession } from '../stores/focus';

describe('clock', () => {
  it.each([
    [0, '00:00'],
    [59.9, '00:59'],
    [1500, '25:00'],
    [3599, '59:59'],
    [3725, '1:02:05'],
    [-5, '00:00'],
  ])('%d s → %s', (s, out) => expect(clock(s)).toBe(out));
});

describe('elapsedMs', () => {
  const base: FocusSession = {
    status: 'running',
    mode: 'timer',
    targetSec: 1500,
    target: { module: 'work', refId: null, label: 'Trabalho' },
    note: '',
    startedAtLocal: '2026-11-08T10:00:00',
    accumulatedMs: 60_000,
    resumedAt: 1_000_000,
  };
  it('soma o acumulado com o trecho atual', () => {
    expect(elapsedMs(base, 1_030_000)).toBe(90_000);
  });
  it('pausado não avança', () => {
    expect(elapsedMs({ ...base, status: 'paused', resumedAt: null }, 9_999_999)).toBe(60_000);
  });
});
