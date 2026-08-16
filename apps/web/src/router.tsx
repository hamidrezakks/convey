import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppLayout } from './components/layout/AppLayout';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { AuditPage } from './pages/AuditPage';
import { ComposerPage } from './pages/ComposerPage';
import { DeliverabilityPage } from './pages/DeliverabilityPage';
import { DlqPage } from './pages/DlqPage';
import { MessagesPage } from './pages/MessagesPage';
import { OverviewPage } from './pages/OverviewPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { WebhooksPage } from './pages/WebhooksPage';

// 1. Root Route
const rootRoute = createRootRoute({
  component: AppLayout,
});

// 2. Individual Page Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewPage,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overview',
  component: OverviewPage,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  component: MessagesPage,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers',
  component: ProvidersPage,
});

const dlqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dlq',
  component: DlqPage,
});

const deliverabilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deliverability',
  component: DeliverabilityPage,
});

const policiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/policies',
  component: PoliciesPage,
});

const composerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/composer',
  component: ComposerPage,
});

const webhooksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/webhooks',
  component: WebhooksPage,
});

const architectureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/architecture',
  component: ArchitecturePage,
});

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/audit',
  component: AuditPage,
});

// 3. Route Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  overviewRoute,
  messagesRoute,
  providersRoute,
  dlqRoute,
  deliverabilityRoute,
  policiesRoute,
  composerRoute,
  webhooksRoute,
  architectureRoute,
  auditRoute,
]);

// 4. Create and Export Router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// 5. Register module for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
