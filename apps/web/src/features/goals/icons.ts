import {
  Apple,
  BedDouble,
  BookOpen,
  Brain,
  CalendarCheck,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  PenLine,
  Pill,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react';

/** Ícones disponíveis para metas (o nome é salvo no banco). */
export const GOAL_ICONS: Record<string, LucideIcon> = {
  target: Target,
  droplet: Droplet,
  'book-open': BookOpen,
  dumbbell: Dumbbell,
  footprints: Footprints,
  'calendar-check': CalendarCheck,
  brain: Brain,
  'pen-line': PenLine,
  apple: Apple,
  leaf: Leaf,
  pill: Pill,
  coffee: Coffee,
  'bed-double': BedDouble,
  moon: Moon,
  sun: Sun,
  heart: Heart,
  music: Music,
};

/** Nomes acessíveis em português. */
export const GOAL_ICON_LABEL: Record<string, string> = {
  target: 'Alvo',
  droplet: 'Água',
  'book-open': 'Livro',
  dumbbell: 'Halter',
  footprints: 'Passos',
  'calendar-check': 'Agenda',
  brain: 'Mente',
  'pen-line': 'Escrita',
  apple: 'Fruta',
  leaf: 'Folha',
  pill: 'Remédio',
  coffee: 'Café',
  'bed-double': 'Sono',
  moon: 'Lua',
  sun: 'Sol',
  heart: 'Coração',
  music: 'Música',
};

export const goalIcon = (name: string | null | undefined): LucideIcon =>
  (name && GOAL_ICONS[name]) || Target;
