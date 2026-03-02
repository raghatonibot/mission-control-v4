import { Suspense, lazy, type ReactNode } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/layout/MainLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/Login';
import { AppErrorBoundary } from '@/components/app/AppErrorBoundary';

const Agents = lazy(() => import('@/pages/Agents').then((m) => ({ default: m.Agents })));
const AgentDetail = lazy(() => import('@/pages/AgentDetail').then((m) => ({ default: m.AgentDetail })));
const Missions = lazy(() => import('@/pages/Missions').then((m) => ({ default: m.Missions })));
const Stage = lazy(() => import('@/pages/Stage').then((m) => ({ default: m.Stage })));
const Chat = lazy(() => import('@/pages/Chat').then((m) => ({ default: m.Chat })));
const Gallery = lazy(() => import('@/pages/Gallery').then((m) => ({ default: m.Gallery })));
const Events = lazy(() => import('@/pages/Events').then((m) => ({ default: m.Events })));
const Analytics = lazy(() => import('@/pages/Analytics').then((m) => ({ default: m.Analytics })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const DoneTasks = lazy(() => import('@/pages/DoneTasks').then((m) => ({ default: m.DoneTasks })));
const TokensLive = lazy(() => import('@/pages/TokensLive').then((m) => ({ default: m.TokensLive })));
const RunsFinalizadas = lazy(() => import('@/pages/RunsFinalizadas').then((m) => ({ default: m.RunsFinalizadas })));
const WorkforcePlaybook = lazy(() => import('@/pages/WorkforcePlaybook').then((m) => ({ default: m.WorkforcePlaybook })));
const Orchestration = lazy(() => import('@/pages/Orchestration').then((m) => ({ default: m.Orchestration })));
const Stash = lazy(() => import('@/pages/Stash').then((m) => ({ default: m.Stash })));

function PageFallback() {
  return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;
}

function lazyElement(node: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

function ProtectedLayout() {
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === '1';
  const { token } = useAuth();
  if (!authDisabled && !token) return <Navigate to="/login" replace />;
  return <MainLayout />;
}

const router = createHashRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'agents', element: lazyElement(<Agents />) },
      { path: 'agents/:id', element: lazyElement(<AgentDetail />) },
      { path: 'missions', element: lazyElement(<Missions />) },
      { path: 'tasks-done', element: lazyElement(<DoneTasks />) },
      { path: 'runs-finalizadas', element: lazyElement(<RunsFinalizadas />) },
      { path: 'stage', element: lazyElement(<Stage />) },
      { path: 'chat', element: lazyElement(<Chat />) },
      { path: 'chat/:agentId', element: lazyElement(<Chat />) },
      { path: 'gallery', element: lazyElement(<Gallery />) },
      { path: 'events', element: lazyElement(<Events />) },
      { path: 'tokens', element: lazyElement(<TokensLive />) },
      { path: 'analytics', element: lazyElement(<Analytics />) },
      { path: 'settings', element: lazyElement(<Settings />) },
      { path: 'playbook', element: lazyElement(<WorkforcePlaybook />) },
      { path: 'orchestration', element: lazyElement(<Orchestration />) },
      { path: 'stash', element: lazyElement(<Stash />) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppErrorBoundary>
          <RouterProvider router={router} />
        </AppErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
