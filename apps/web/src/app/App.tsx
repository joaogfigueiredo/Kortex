import { lazy } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { CalendarDays, ChartColumn, GraduationCap, HeartPulse } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui';
import { HomePage } from '../features/home/HomePage';
import { ComingSoon } from '../features/placeholder/ComingSoon';

// Módulos carregados sob demanda: o app abre rápido no celular.
const IdeasPage = lazy(() =>
  import('../features/ideas/IdeasPage').then((m) => ({ default: m.IdeasPage })),
);
const ProjectsPage = lazy(() =>
  import('../features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const FinancePage = lazy(() =>
  import('../features/finance/FinancePage').then((m) => ({ default: m.FinancePage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

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
          <Route path="ideias" element={<IdeasPage />} />
          <Route path="projetos" element={<ProjectsPage />} />
          <Route path="financas" element={<FinancePage />} />
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
