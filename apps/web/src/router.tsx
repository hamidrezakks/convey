import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { AppLayout } from './components/layout/AppLayout';

// 1. Root Route
const rootRoute = createRootRoute({
  component: AppLayout,
});

// 2. Individual Page Routes with Dynamic Code-Splitting
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./pages/OverviewPage'), 'OverviewPage'),
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overview',
  component: lazyRouteComponent(() => import('./pages/OverviewPage'), 'OverviewPage'),
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  component: lazyRouteComponent(() => import('./pages/MessagesPage'), 'MessagesPage'),
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers',
  component: lazyRouteComponent(() => import('./pages/ProvidersPage'), 'ProvidersPage'),
});

const providerConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers/configure',
  component: lazyRouteComponent(() => import('./pages/ProviderConfigPage'), 'ProviderConfigPage'),
});

const dlqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dlq',
  component: lazyRouteComponent(() => import('./pages/DlqPage'), 'DlqPage'),
});

const deliverabilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deliverability',
  component: lazyRouteComponent(() => import('./pages/DeliverabilityPage'), 'DeliverabilityPage'),
});

const policiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/policies',
  component: lazyRouteComponent(() => import('./pages/PoliciesPage'), 'PoliciesPage'),
});

const composerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/composer',
  component: lazyRouteComponent(() => import('./pages/ComposerPage'), 'ComposerPage'),
});

const webhooksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/webhooks',
  component: lazyRouteComponent(() => import('./pages/WebhooksPage'), 'WebhooksPage'),
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: lazyRouteComponent(() => import('./pages/ReportsPage'), 'ReportsPage'),
});

const architectureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/architecture',
  component: lazyRouteComponent(() => import('./pages/ArchitecturePage'), 'ArchitecturePage'),
});

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/audit',
  component: lazyRouteComponent(() => import('./pages/AuditPage'), 'AuditPage'),
});

const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/templates',
  component: lazyRouteComponent(() => import('./pages/TemplateStudioPage'), 'TemplateStudioPage'),
});

const preferencesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/preferences',
  component: lazyRouteComponent(() => import('./pages/PreferencesPage'), 'PreferencesPage'),
});

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: lazyRouteComponent(() => import('./pages/InboxPage'), 'InboxPage'),
});

// 3. Route Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  overviewRoute,
  reportsRoute,
  messagesRoute,
  templatesRoute,
  preferencesRoute,
  inboxRoute,
  providersRoute,
  providerConfigRoute,
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
