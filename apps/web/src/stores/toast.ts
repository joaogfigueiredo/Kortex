import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ tone = 'success', ...t }) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-3), { id, tone, ...t }] });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Atalho fora de componentes: toast.success('Salvo'). */
export const toast = {
  success: (title: string, description?: string) =>
    useToasts.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ title, description, tone: 'error' }),
  info: (title: string, description?: string) =>
    useToasts.getState().push({ title, description, tone: 'info' }),
};
