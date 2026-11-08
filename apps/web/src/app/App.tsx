import { lazy } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui';
import { HomePage } from '../features/home/HomePage';

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
const AgendaPage = lazy(() =>
  import('../features/reminders/AgendaPage').then((m) => ({ default: m.AgendaPage })),
);
const StudiesPage = lazy(() =>
  import('../features/studies/StudiesPage').then((m) => ({ default: m.StudiesPage })),
);
const HealthPage = lazy(() =>
  import('../features/health/HealthPage').then((m) => ({ default: m.HealthPage })),
);
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
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
          <Route path="lembretes" element={<AgendaPage />} />
          <Route path="estudos" element={<StudiesPage />} />
          <Route path="saude" element={<HealthPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
