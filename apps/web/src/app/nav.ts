import {
  CalendarDays,
  ChartColumn,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  House,
  Lightbulb,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Aparece direto na barra inferior do celular (máx. 4 + "Mais"). */
  mobilePrimary?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: House, mobilePrimary: true },
  { to: '/ideias', label: 'Ideias', icon: Lightbulb, mobilePrimary: true },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban, mobilePrimary: true },
  { to: '/lembretes', label: 'Agenda', icon: CalendarDays, mobilePrimary: true },
  { to: '/financas', label: 'Finanças', icon: Wallet },
  { to: '/estudos', label: 'Estudos', icon: GraduationCap },
  { to: '/saude', label: 'Saúde', icon: HeartPulse },
  { to: '/dashboard', label: 'Dashboard', icon: ChartColumn },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];
