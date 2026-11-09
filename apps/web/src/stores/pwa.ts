import { create } from 'zustand';

/** Evento (ainda não padronizado) que o Chrome/Edge disparam quando o app pode ser instalado. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

interface PwaState {
  /** O navegador está oferecendo a instalação agora. */
  canInstall: boolean;
  /** Já está rodando como app instalado. */
  installed: boolean;
  install: () => Promise<boolean>;
}

let deferred: InstallPromptEvent | null = null;

export const usePwa = create<PwaState>((set) => ({
  canInstall: false,
  installed: isStandalone(),
  install: async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null; // o evento só vale uma vez
    set({ canInstall: false, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
}));

// Registrado na importação do módulo (no boot), para não perder o evento.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // guarda para oferecer no momento certo (Configurações)
  deferred = e as InstallPromptEvent;
  usePwa.setState({ canInstall: true });
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  usePwa.setState({ canInstall: false, installed: true });
});

/** Registra o service worker (só no build de produção; em dev atrapalharia o hot reload). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sem HTTPS/localhost o navegador recusa: o app segue funcionando normalmente */
    });
  });
}
