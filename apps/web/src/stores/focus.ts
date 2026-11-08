import { create } from 'zustand';
import type { TimeModule } from '@kortex/shared';

/**
 * Estado do Modo Foco. Baseado em timestamps (não em "ticks"): o tempo
 * continua certo mesmo com a aba em segundo plano, o celular bloqueado
 * ou a página recarregada (o estado fica no localStorage).
 */
export type FocusMode = 'timer' | 'stopwatch';
export type FocusStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface FocusTarget {
  module: TimeModule;
  refId: number | null;
  /** Texto exibido na tela cheia, ex.: "Estudo · Inglês". */
  label: string;
}

export interface FocusSession {
  status: FocusStatus;
  mode: FocusMode;
  /** Meta em segundos (só no modo timer). */
  targetSec: number;
  target: FocusTarget;
  note: string;
  /** Início da sessão em horário local flutuante (YYYY-MM-DDTHH:mm:ss). */
  startedAtLocal: string;
  /** Tempo acumulado de trechos já encerrados (pausas), em ms. */
  accumulatedMs: number;
  /** Date.now() do último "play"; null quando pausado/finalizado. */
  resumedAt: number | null;
}

const KEY = 'kortex-focus';
const pad = (n: number) => String(n).padStart(2, '0');
export const localTimestamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** Milissegundos efetivamente focados até `now`. */
export const elapsedMs = (s: FocusSession, now = Date.now()) =>
  s.accumulatedMs + (s.resumedAt != null ? now - s.resumedAt : 0);

function load(): FocusSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FocusSession) : null;
  } catch {
    return null;
  }
}
function save(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento: segue em memória */
  }
}

interface FocusState {
  session: FocusSession | null;
  /** Modal de configuração aberto? */
  setupOpen: boolean;
  /** Alvo pré-selecionado ao abrir o setup (ex.: a partir de uma matéria). */
  preset: FocusTarget | null;
  openSetup: (preset?: FocusTarget | null) => void;
  closeSetup: () => void;
  start: (p: { mode: FocusMode; targetSec: number; target: FocusTarget; note: string }) => void;
  pause: () => void;
  resume: () => void;
  /** Marca como finalizada (fim do timer ou "Encerrar"). */
  finish: () => void;
  /** Soma minutos à meta e volta a rodar (após o alarme). */
  extend: (sec: number) => void;
  clear: () => void;
}

export const useFocus = create<FocusState>((set, get) => {
  const update = (s: FocusSession | null) => {
    save(s);
    set({ session: s });
  };
  return {
    session: load(),
    setupOpen: false,
    preset: null,
    openSetup: (preset = null) => set({ setupOpen: true, preset }),
    closeSetup: () => set({ setupOpen: false }),
    start: ({ mode, targetSec, target, note }) => {
      update({
        status: 'running',
        mode,
        targetSec,
        target,
        note,
        startedAtLocal: localTimestamp(),
        accumulatedMs: 0,
        resumedAt: Date.now(),
      });
      set({ setupOpen: false });
    },
    pause: () => {
      const s = get().session;
      if (!s || s.status !== 'running') return;
      update({ ...s, status: 'paused', accumulatedMs: elapsedMs(s), resumedAt: null });
    },
    resume: () => {
      const s = get().session;
      if (!s || s.status !== 'paused') return;
      update({ ...s, status: 'running', resumedAt: Date.now() });
    },
    finish: () => {
      const s = get().session;
      if (!s || s.status === 'finished') return;
      // No timer, nunca registra mais do que a meta (o alarme pode tocar com atraso).
      const ms = s.mode === 'timer' ? Math.min(elapsedMs(s), s.targetSec * 1000) : elapsedMs(s);
      update({ ...s, status: 'finished', accumulatedMs: ms, resumedAt: null });
    },
    extend: (sec) => {
      const s = get().session;
      if (!s) return;
      update({ ...s, status: 'running', targetSec: s.targetSec + sec, resumedAt: Date.now() });
    },
    clear: () => update(null),
  };
});
