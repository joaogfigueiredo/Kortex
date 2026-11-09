import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { Button } from '../../components/ui';
import { Logo } from '../../components/layout/Logo';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { syncThemeFromServer } from '../../stores/theme';

/** Tela cheia pedindo o PIN (aparece só quando o PIN está ativo e não há sessão). */
export function LockScreen() {
  const { numeric, unlock } = useAuth();
  const qc = useQueryClient();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.post('/auth/login', { pin });
      setPin('');
      unlock();
      syncThemeFromServer();
      await qc.invalidateQueries(); // recarrega tudo que falhou enquanto estava bloqueado
    } catch (err) {
      setPin('');
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível conectar ao Kortex. O servidor está rodando?',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-5 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl bg-bg p-8 text-center shadow-neu"
        aria-labelledby="lock-title"
      >
        <Logo className="mb-6" />
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl text-accent-ink shadow-neu-inset">
          <LockKeyhole
            className="size-7"
            style={{ filter: 'drop-shadow(0 0 6px var(--k-accent))' }}
          />
        </span>
        <h1 id="lock-title" className="text-xl font-bold tracking-tight">
          Kortex bloqueado
        </h1>
        <p className="mt-1 text-sm text-muted">Digite seu PIN para continuar.</p>

        <input
          type="password"
          aria-label="PIN"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'lock-error' : undefined}
          inputMode={numeric ? 'numeric' : 'text'}
          autoComplete="current-password"
          autoFocus
          maxLength={64}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(undefined);
          }}
          placeholder="••••••"
          className="mt-6 h-14 w-full rounded-2xl bg-bg px-5 text-center text-xl tracking-[0.4em] text-fg shadow-neu-inset-sm outline-none placeholder:tracking-[0.4em] placeholder:text-muted/60 focus:shadow-[inset_2px_2px_5px_var(--k-sh-dark),inset_-2px_-2px_5px_var(--k-sh-light),0_0_0_2px_var(--k-accent)] aria-invalid:shadow-[inset_2px_2px_5px_var(--k-sh-dark),inset_-2px_-2px_5px_var(--k-sh-light),0_0_0_2px_var(--k-red)]"
        />
        <p id="lock-error" role="alert" className="mt-3 min-h-5 text-sm text-danger">
          {error}
        </p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-3 w-full"
          disabled={!pin || busy}
        >
          {busy ? 'Verificando…' : 'Entrar'}
        </Button>
      </form>
    </main>
  );
}
