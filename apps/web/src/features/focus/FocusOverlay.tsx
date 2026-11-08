import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Maximize2, Minimize2, Pause, Play, Plus, Square, X } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDuration } from '../../lib/duration';
import {
  clock,
  enterFullscreen,
  exitFullscreen,
  keepScreenAwake,
  playAlarm,
} from '../../lib/focusDevice';
import { elapsedMs, localTimestamp, useFocus } from '../../stores/focus';
import { toast } from '../../stores/toast';

const MIN_SAVE_SEC = 60;
const IDLE_MS = 3000;

/** Tela cheia escura com o cronômetro/timer. Sempre em tema escuro. */
export function FocusOverlay() {
  const { session, pause, resume, finish, extend, clear } = useFocus();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [idle, setIdle] = useState(false);
  const [isFull, setIsFull] = useState(Boolean(document.fullscreenElement));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const idleTimer = useRef<number>(undefined);

  const active = session != null;
  const running = session?.status === 'running';

  // Relógio: re-renderiza 4x por segundo enquanto roda.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Fim do timer → finaliza e toca o alarme (inclusive se terminou com a aba fechada).
  useEffect(() => {
    if (
      session?.status === 'running' &&
      session.mode === 'timer' &&
      elapsedMs(session, now) >= session.targetSec * 1000
    ) {
      finish();
      playAlarm();
    }
  }, [now, session, finish]);

  // Tela acesa enquanto há sessão.
  useEffect(() => (active ? keepScreenAwake() : undefined), [active]);

  // Controles somem após alguns segundos sem interação (voltam ao mexer).
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  useEffect(() => {
    if (!active) return;
    wake();
    const onFs = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.clearTimeout(idleTimer.current);
    };
  }, [active, wake]);

  // Título da aba mostra o tempo.
  useEffect(() => {
    if (!session) return;
    const base = 'Kortex';
    const shown =
      session.mode === 'timer'
        ? session.targetSec - elapsedMs(session, now) / 1000
        : elapsedMs(session, now) / 1000;
    document.title =
      session.status === 'finished' ? `✦ Foco concluído · ${base}` : `${clock(shown)} · Foco`;
    return () => {
      document.title = base;
    };
  }, [session, now]);

  // Atalhos: Espaço pausa/retoma.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      wake();
      if (e.code === 'Space') {
        e.preventDefault();
        if (session?.status === 'running') pause();
        else if (session?.status === 'paused') resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, session?.status, pause, resume, wake]);

  if (!session) return null;

  const elapsedSec = elapsedMs(session, now) / 1000;
  const shownSec = session.mode === 'timer' ? session.targetSec - elapsedSec : elapsedSec;
  const progress =
    session.mode === 'timer' && session.targetSec
      ? Math.min(1, elapsedSec / session.targetSec)
      : null;
  const finished = session.status === 'finished';

  async function saveAndExit() {
    if (!session) return;
    const sec = Math.round(elapsedMs(session) / 1000);
    if (sec < MIN_SAVE_SEC) {
      toast.info('Menos de 1 minuto', 'A sessão não foi registrada.');
      return close();
    }
    setSaving(true);
    try {
      await api.post('/time', {
        module: session.target.module,
        refId: session.target.refId,
        startedAt: session.startedAtLocal,
        endedAt: localTimestamp(),
        durationSec: sec,
        source: 'focus',
        note: session.note || null,
      });
      await qc.invalidateQueries(); // estudos, dashboard, etc.
      toast.success(`${formatDuration(sec)} de foco registrados`, session.target.label);
      close();
    } catch (e) {
      toast.error('Não foi possível salvar a sessão', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setConfirmDiscard(false);
    void exitFullscreen();
    clear();
  }

  const ctrl =
    'grid place-items-center rounded-full transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent outline-none';

  return createPortal(
    <div
      data-theme="dark"
      role="dialog"
      aria-modal="true"
      aria-label="Modo Foco"
      onPointerMove={wake}
      onPointerDown={wake}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B0D11] px-6 text-[#E6EAF0] select-none"
    >
      {/* brilho ambiente */}
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute size-[70vmin] rounded-full blur-[120px] transition-opacity duration-1000',
          session.status === 'paused' ? 'opacity-5' : 'opacity-15',
        )}
        style={{ background: 'var(--k-accent)' }}
      />

      <button
        type="button"
        onClick={() => (isFull ? exitFullscreen() : enterFullscreen())}
        aria-label={isFull ? 'Sair da tela cheia' : 'Tela cheia'}
        className={clsx(
          ctrl,
          'absolute top-[max(1.25rem,env(safe-area-inset-top))] right-5 size-10 text-white/40 hover:text-white/80',
          idle && 'opacity-0',
        )}
      >
        {isFull ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
      </button>

      <p
        className={clsx(
          'relative mb-4 text-sm tracking-[0.25em] text-white/45 uppercase transition-opacity',
          idle && !finished && 'opacity-60',
        )}
      >
        {finished ? 'Sessão concluída ✦' : session.target.label}
      </p>

      <time
        aria-live="off"
        className={clsx(
          'relative font-extralight tracking-tight tabular-nums transition-opacity duration-500',
          session.status === 'paused' && 'animate-pulse opacity-60',
        )}
        style={{
          fontSize: 'min(22vw, 12rem)',
          lineHeight: 1,
          textShadow: finished
            ? '0 0 40px rgb(111 227 255 / 0.55)'
            : '0 0 30px rgb(111 227 255 / 0.18)',
        }}
      >
        {finished ? formatDuration(Math.round(elapsedSec)) : clock(shownSec)}
      </time>

      {progress != null && !finished && (
        <div
          className="relative mt-8 h-1 w-[min(60vw,24rem)] overflow-hidden rounded-full bg-white/10"
          aria-hidden
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${progress * 100}%`,
              background: 'var(--k-accent)',
              boxShadow: '0 0 12px var(--k-accent)',
            }}
          />
        </div>
      )}
      {session.status === 'paused' && (
        <p className="relative mt-6 text-sm text-white/50">Pausado · Espaço para retomar</p>
      )}

      {/* Controles */}
      <div
        className={clsx(
          'relative mt-14 flex items-center gap-5 transition-opacity duration-500',
          idle && !finished && session.status === 'running' && 'opacity-0',
        )}
      >
        {finished ? (
          <>
            <button
              type="button"
              onClick={() => extend(5 * 60)}
              className={clsx(
                ctrl,
                'h-12 gap-2 px-5 text-sm text-white/60 ring-1 ring-white/15 hover:text-white',
              )}
              style={{ display: 'inline-flex' }}
            >
              <Plus className="size-4" /> 5 min
            </button>
            <button
              type="button"
              onClick={saveAndExit}
              disabled={saving}
              className={clsx(
                ctrl,
                'h-14 gap-2 bg-accent px-7 font-semibold text-on-accent shadow-glow',
              )}
              style={{ display: 'inline-flex' }}
              autoFocus
            >
              <Check className="size-5" /> Salvar
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Descartar sessão"
              className={clsx(ctrl, 'size-12 text-white/40 hover:text-white/80')}
            >
              <X className="size-5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => (confirmDiscard ? close() : setConfirmDiscard(true))}
              aria-label={confirmDiscard ? 'Confirmar: descartar sessão' : 'Descartar sessão'}
              title="Descartar"
              className={clsx(
                ctrl,
                'size-12',
                confirmDiscard
                  ? 'text-[#FF6B6B] ring-1 ring-[#FF6B6B]/60'
                  : 'text-white/35 hover:text-white/70',
              )}
            >
              <X className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => (running ? pause() : resume())}
              aria-label={running ? 'Pausar' : 'Retomar'}
              className={clsx(
                ctrl,
                'size-20 bg-white/[0.06] text-white ring-1 ring-white/15 hover:ring-accent',
              )}
              style={{ boxShadow: running ? undefined : '0 0 24px rgb(111 227 255 / 0.4)' }}
            >
              {running ? <Pause className="size-8" /> : <Play className="size-8" />}
            </button>
            <button
              type="button"
              onClick={finish}
              aria-label="Encerrar sessão"
              title="Encerrar e salvar"
              className={clsx(ctrl, 'size-12 text-white/35 hover:text-white/70')}
            >
              <Square className="size-4.5" />
            </button>
          </>
        )}
      </div>
      {confirmDiscard && !finished && (
        <p className="relative mt-4 text-xs text-[#FF6B6B]/80">Toque no ✕ de novo para descartar</p>
      )}
    </div>,
    document.body,
  );
}
