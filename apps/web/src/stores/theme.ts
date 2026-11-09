import { create } from 'zustand';
import { api } from '../lib/api';

export type ThemeMode = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'kortex-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

const readLocal = (): ThemeMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
};

const resolve = (mode: ThemeMode): Resolved =>
  mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;

function apply(resolved: Resolved) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#1E2128' : '#EEF1F5');
}

interface ThemeState {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (mode: ThemeMode, opts?: { persist?: boolean }) => void;
  /** Alterna rapidamente entre claro e escuro (botão do header mobile). */
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: readLocal(),
  resolved: resolve(readLocal()),
  setMode: (mode, { persist = true } = {}) => {
    const resolved = resolve(mode);
    apply(resolved);
    set({ mode, resolved });
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* armazenamento indisponível: segue só em memória */
    }
    if (persist) api.put('/settings/theme', { value: mode }).catch(() => {});
  },
  toggle: () => get().setMode(get().resolved === 'dark' ? 'light' : 'dark'),
}));

/** Sincroniza com o sistema e com o valor salvo no banco. Chamar uma vez no boot. */
export function initTheme() {
  const { setMode } = useTheme.getState();
  setMode(readLocal(), { persist: false });

  media.addEventListener('change', () => {
    const { mode } = useTheme.getState();
    if (mode === 'system') setMode('system', { persist: false });
  });

  syncThemeFromServer();
}

/** Lê o tema salvo no banco (chamar também depois de desbloquear com o PIN). */
export function syncThemeFromServer() {
  api
    .get<{ theme?: ThemeMode }>('/settings')
    .then(({ theme }) => {
      if (theme && theme !== useTheme.getState().mode)
        useTheme.getState().setMode(theme, { persist: false });
    })
    .catch(() => {});
}
