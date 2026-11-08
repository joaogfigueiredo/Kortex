/** Recursos do dispositivo usados pelo Modo Foco (todos opcionais/tolerantes a falha). */

/** Alarme curto e suave (3 bipes) via Web Audio — sem arquivo de som. */
export function playAlarm() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    };
    beep(0, 880);
    beep(0.45, 880);
    beep(0.9, 1175);
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    /* sem áudio */
  }
  // Vibrar sem interação prévia gera erro no Chrome; só vibra após um toque/clique.
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([200, 120, 200, 120, 400]);
}

/** Mantém a tela acesa enquanto o foco roda; reaquire ao voltar para a aba. */
export function keepScreenAwake() {
  let lock: WakeLockSentinel | null = null;
  let stopped = false;
  const acquire = async () => {
    try {
      if (!stopped && document.visibilityState === 'visible' && 'wakeLock' in navigator)
        lock = await navigator.wakeLock.request('screen');
    } catch {
      /* sem permissão / não suportado */
    }
  };
  const onVisible = () => void acquire();
  void acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => {});
  };
}

export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    /* navegador pode recusar sem gesto do usuário */
  }
}

export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

/** 1500 s → "25:00"; 3725 s → "1:02:05" */
export function clock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h
    ? `${h}:${mm}:${String(sec).padStart(2, '0')}`
    : `${mm.padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
