import { BrowserRouter, Link, Route, Routes } from 'react-router';
import {
  CalendarDays,
  ChartColumn,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Wallet,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui';
import { HomePage } from '../features/home/HomePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ComingSoon } from '../features/placeholder/ComingSoon';

function NotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <p className="text-5xl font-bold text-accent-ink">404</p>
      <p className="mt-2 text-muted">Página não encontrada.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center rounded-2xl bg-accent px-5 text-sm font-medium text-on-accent shadow-glow hover:bg-accent-hover"
      >
        Voltar ao início
      </Link>
    </Card>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route
            path="ideias"
            element={
              <ComingSoon
                title="Ideias"
                subtitle="Registre e evolua seus insights"
                icon={Lightbulb}
                step={3}
                features={[
                  'Kanban: Organizadas e arquitetadas → Iniciadas → Em desenvolvimento → Finalizadas',
                  'Arrastar e soltar (mouse e toque)',
                  'Promover ideia a projeto',
                ]}
              />
            }
          />
          <Route
            path="projetos"
            element={
              <ComingSoon
                title="Projetos"
                subtitle="Do rascunho ao deploy"
                icon={FolderKanban}
                step={4}
                features={[
                  'Ideias → Iniciados → Desenvolvimento (Nível 1, 2, 3) → Finalizado → Deployzado',
                  'Links de repositório e deploy',
                  'Datas automáticas de início, fim e deploy',
                ]}
              />
            }
          />
          <Route
            path="financas"
            element={
              <ComingSoon
                title="Atividades financeiras"
                subtitle="Fontes de renda e ideias de monetização"
                icon={Wallet}
                step={5}
                features={[
                  'Kanban: Ideias → Desenvolvimento → Ativas',
                  'Modal completo com histórico, observações e avisos',
                  'Renda esperada x real por atividade',
                ]}
              />
            }
          />
          <Route
            path="lembretes"
            element={
              <ComingSoon
                title="Agenda"
                subtitle="Lembretes, compromissos e avisos"
                icon={CalendarDays}
                step={6}
                features={[
                  'Recorrência diária, semanal e mensal',
                  'Calendário mensal com bolinhas coloridas por categoria',
                  'Mini-agenda na tela inicial',
                ]}
              />
            }
          />
          <Route
            path="estudos"
            element={
              <ComingSoon
                title="Estudos"
                subtitle="Acompanhe cada matéria"
                icon={GraduationCap}
                step={7}
                features={[
                  'Progresso visual e nível (Iniciante → Intermediário → Avançado)',
                  'Data da última sessão',
                  'Sessões cronometradas pelo Modo Foco',
                ]}
              />
            }
          />
          <Route
            path="saude"
            element={
              <ComingSoon
                title="Saúde"
                subtitle="Treinos e dieta"
                icon={HeartPulse}
                step={8}
                features={['Registro rápido de treinos', 'Plano de refeições com check diário']}
              />
            }
          />
          <Route
            path="dashboard"
            element={
              <ComingSoon
                title="Dashboard"
                subtitle="Sua produtividade em números"
                icon={ChartColumn}
                step={11}
                features={[
                  'Tempo estudado e investido em ideias/projetos',
                  'Continuidade (streaks) e frequência de trabalho',
                  'Treinos e cumprimento da dieta: dia, semana e mês',
                ]}
              />
            }
          />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
