import { useState } from 'react';
import { Palette, Plus, Trash2, Zap } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dot,
  IconButton,
  Input,
  Modal,
  Progress,
  Select,
  Textarea,
  Toggle,
} from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { ThemeSwitch } from '../../components/layout/ThemeSwitch';
import { AccessCard } from './AccessCard';
import { DataCard } from './DataCard';
import { SecurityCard } from './SecurityCard';

const PALETTE = [
  { name: 'Accent', hex: '#6FE3FF', use: 'Botões, ativos, seleção' },
  { name: 'Violeta', hex: '#B79CFF', use: 'Pessoal' },
  { name: 'Menta', hex: '#4DF5B8', use: 'Saúde / sucesso' },
  { name: 'Âmbar', hex: '#FFD166', use: 'Estudos / atenção' },
  { name: 'Rosa', hex: '#FF8FC7', use: 'Finanças' },
  { name: 'Vermelho', hex: '#FF6B6B', use: 'Urgente / erro' },
];

export function SettingsPage() {
  const [modal, setModal] = useState(false);
  const [notify, setNotify] = useState(true);
  const [selected, setSelected] = useState(1);

  return (
    <>
      <PageHeader title="Configurações" subtitle="Aparência, dados e backup" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Palette className="size-5" />}
            title="Aparência"
            subtitle="Tema claro, escuro ou automático"
          />
          <ThemeSwitch />
          <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
            {PALETTE.map((c) => (
              <div key={c.hex} className="text-center" title={c.use}>
                <div
                  className="mx-auto mb-2 size-12 rounded-2xl"
                  style={{ background: c.hex, boxShadow: `0 0 18px ${c.hex}88` }}
                />
                <p className="text-xs font-medium">{c.name}</p>
                <p className="text-[10px] text-muted uppercase">{c.hex}</p>
              </div>
            ))}
          </div>
        </Card>

        <SecurityCard />
        <AccessCard />
        <DataCard />

        {/* Vitrine do design system — útil para conferir os dois temas */}
        <Card>
          <CardHeader
            icon={<Zap className="size-5" />}
            title="Sistema visual"
            subtitle="Prévia dos componentes"
          />
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setModal(true)}
              >
                Abrir modal
              </Button>
              <Button>Neumórfico</Button>
              <Button variant="ghost">Ghost</Button>
              <IconButton label="Excluir" variant="danger">
                <Trash2 className="size-4.5" />
              </IconButton>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Título" placeholder="Nova ideia…" />
              <Select label="Status" defaultValue="started">
                <option value="organized">Organizada</option>
                <option value="started">Iniciada</option>
              </Select>
            </div>

            <Toggle
              checked={notify}
              onChange={setNotify}
              label="Avisos"
              description="Notificar antes dos compromissos"
            />
            <Progress label="Progresso do estudo" value={68} showValue />

            <div className="flex flex-wrap gap-2">
              <Badge color="#6FE3FF">Trabalho</Badge>
              <Badge color="#B79CFF">Pessoal</Badge>
              <Badge color="#4DF5B8">Saúde</Badge>
              <Badge variant="solid">Ativa</Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Card
                  key={i}
                  interactive
                  selected={selected === i}
                  onClick={() => setSelected(i)}
                  className="p-4 text-center text-xs"
                >
                  <Dot color={['#6FE3FF', '#FFD166', '#FF8FC7'][i]!} />
                  <p className="mt-2 font-medium">Card {i + 1}</p>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Exemplo de modal"
        description="No celular abre como folha inferior; no desktop fica centralizado."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Título" placeholder="Ex.: Canal no YouTube" autoFocus />
          <Textarea label="Observações" placeholder="Detalhes, links, próximos passos…" />
        </div>
      </Modal>
    </>
  );
}
