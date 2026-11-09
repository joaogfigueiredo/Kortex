import { create } from 'zustand';
import type { AuthStatus } from '@kortex/shared';
import { api, setAuthRequiredHandler } from '../lib/api';

/**
 * loading → ainda consultando a API · locked → PIN ativo e sem sessão · open → liberado.
 * Se a API estiver fora do ar, segue "open": as telas mostram o erro de conexão.
 */
type Phase = 'loading' | 'locked' | 'open';

interface AuthState {
  phase: Phase;
  pinEnabled: boolean;
  /** O PIN é só números? (define o teclado da tela de bloqueio) */
  numeric: boolean;
  refresh: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  phase: 'loading',
  pinEnabled: false,
  numeric: false,
  refresh: async () => {
    try {
      const s = await api.get<AuthStatus>('/auth/status');
      set({
        pinEnabled: s.pinEnabled,
        numeric: s.numeric,
        phase: s.pinEnabled && !s.authenticated ? 'locked' : 'open',
      });
    } catch {
      if (get().phase === 'loading') set({ phase: 'open' });
    }
  },
  lock: () => {
    if (get().phase === 'locked') return;
    set({ phase: 'locked', pinEnabled: true });
    void get().refresh(); // descobre se o PIN é numérico
  },
  unlock: () => set({ phase: 'open' }),
}));

// A API avisa (401 AUTH_REQUIRED) quando a sessão some ou expira: volta para a tela de PIN.
setAuthRequiredHandler(() => useAuth.getState().lock());
