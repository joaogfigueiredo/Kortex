import { Briefcase, Laptop, LineChart, Package, Store, Video, type LucideIcon } from 'lucide-react';
import type { FinanceKind, FinanceStatus } from '@kortex/shared';

export const FINANCE_COLUMN_COLOR: Record<FinanceStatus, string> = {
  idea: '#B79CFF',
  development: '#FFD166',
  active: '#4DF5B8',
};

export const KIND_ICON: Record<FinanceKind, LucideIcon> = {
  job: Briefcase,
  freelance: Laptop,
  business: Store,
  content: Video,
  investment: LineChart,
  other: Package,
};

/** Estado de um aviso para cores/textos. */
export type AlertState = 'overdue' | 'soon' | 'pending' | 'resolved';

export function alertState(dueAt: string | null, resolved = false, now = Date.now()): AlertState {
  if (resolved) return 'resolved';
  if (!dueAt) return 'pending';
  const diff = new Date(dueAt).getTime() - now;
  if (diff < 0) return 'overdue';
  if (diff < 3 * 24 * 3600 * 1000) return 'soon';
  return 'pending';
}

export const ALERT_COLOR: Record<AlertState, string> = {
  overdue: '#FF6B6B',
  soon: '#FFD166',
  pending: '#6FE3FF',
  resolved: '#4DF5B8',
};

/** "12/12" — data curta para badges. */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Converte "2026-12-10" (input date) para ISO ao meio-dia local (evita virar o dia por fuso). */
export const dateInputToIso = (d: string) => new Date(`${d}T12:00:00`).toISOString();
