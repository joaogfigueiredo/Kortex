import { Palette } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { ThemeSwitch } from '../../components/layout/ThemeSwitch';
import { AccessCard } from './AccessCard';
import { CategoriesCard } from './CategoriesCard';
import { DataCard } from './DataCard';
import { SecurityCard } from './SecurityCard';

/** Cores do app e para que servem (as categorias da agenda têm cartão próprio). */
const PALETTE = [
  { name: 'Destaque', hex: '#6FE3FF', use: 'Botões, itens ativos, seleção' },
  { name: 'Violeta', hex: '#B79CFF', use: 'Pessoal, ideias' },
  { name: 'Menta', hex: '#4DF5B8', use: 'Saúde, sucesso' },
  { name: 'Âmbar', hex: '#FFD166', use: 'Estudos, atenção' },
  { name: 'Rosa', hex: '#FF8FC7', use: 'Finanças' },
  { name: 'Vermelho', hex: '#FF6B6B', use: 'Urgente, erro' },
];

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Aparência, segurança, dados e backup" />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<Palette className="size-5" />}
              title="Aparência"
              subtitle="Tema claro, escuro ou automático"
            />
            <ThemeSwitch />
            <ul
              className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6"
              aria-label="Paleta de cores"
            >
              {PALETTE.map((c) => (
                <li key={c.hex} className="text-center" title={c.use}>
                  <div
                    aria-hidden
                    className="mx-auto mb-2 size-12 rounded-2xl"
                    style={{ background: c.hex, boxShadow: `0 0 18px ${c.hex}88` }}
                  />
                  <p className="text-xs font-medium">{c.name}</p>
                  <p className="text-[10px] text-muted">{c.use}</p>
                </li>
              ))}
            </ul>
          </Card>
          <CategoriesCard />
          <DataCard />
        </div>
        <div className="space-y-6">
          <SecurityCard />
          <AccessCard />
        </div>
      </div>
    </>
  );
}
