import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton, Segmented } from '../ui';
import { useTheme, type ThemeMode } from '../../stores/theme';

/** Seletor completo: Claro / Escuro / Sistema. */
export function ThemeSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const { mode, setMode } = useTheme();
  return (
    <Segmented<ThemeMode>
      ariaLabel="Tema"
      value={mode}
      onChange={setMode}
      className={className}
      iconOnly={compact}
      options={[
        { value: 'light', label: 'Claro', icon: <Sun className="size-4 shrink-0" /> },
        { value: 'dark', label: 'Escuro', icon: <Moon className="size-4 shrink-0" /> },
        { value: 'system', label: 'Auto', icon: <Monitor className="size-4 shrink-0" /> },
      ]}
    />
  );
}

/** Botão compacto que alterna claro/escuro (header mobile). */
export function ThemeQuickToggle() {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <IconButton
      label={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      size="sm"
      onClick={toggle}
    >
      {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </IconButton>
  );
}
