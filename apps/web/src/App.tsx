import { useState } from 'react';
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

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage onNavigateTab={setActiveTab} />;
      case 'messages':
        return <MessagesPage />;
      case 'providers':
        return <ProvidersPage />;
      case 'dlq':
        return <DlqPage />;
      case 'deliverability':
        return <DeliverabilityPage />;
      case 'policies':
        return <PoliciesPage />;
      case 'composer':
        return <ComposerPage />;
      case 'webhooks':
        return <WebhooksPage />;
      case 'architecture':
        return <ArchitecturePage />;
      case 'audit':
        return <AuditPage />;
      default:
        return <OverviewPage onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <AppLayout activeTab={activeTab} onSelectTab={setActiveTab}>
      {renderActivePage()}
    </AppLayout>
  );
}

export default App;
