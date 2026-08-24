import { useEffect, useState } from 'react';
import { DocsLayout } from './components/docs/DocsLayout';
import { ArchitectureVisualizer } from './components/landing/ArchitectureVisualizer';
import { BenchmarkSection } from './components/landing/BenchmarkSection';
import { FeatureGrid } from './components/landing/FeatureGrid';
import { HeroSection } from './components/landing/HeroSection';
import { OmnichannelPlayground } from './components/landing/OmnichannelPlayground';
import { ProviderMatrixSection } from './components/landing/ProviderMatrixSection';
import { WhatsAppRoiCalculator } from './components/landing/WhatsAppRoiCalculator';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { SearchModal } from './components/layout/SearchModal';
import { allDocs } from './docs-content';

export function App() {
  const [view, setView] = useState<'landing' | 'docs'>('landing');
  const [currentDocId, setCurrentDocId] = useState<string>('quickstart');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Sync state with URL hash and history
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('docs/')) {
        const docId = hash.replace('docs/', '');
        if (allDocs[docId]) {
          setCurrentDocId(docId);
          setView('docs');
        }
      } else if (hash === 'docs') {
        setView('docs');
      } else {
        setView('landing');
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateToDocs = (docId = 'quickstart', headingId?: string) => {
    setCurrentDocId(docId);
    setView('docs');
    window.location.hash = headingId ? `docs/${docId}#${headingId}` : `docs/${docId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (headingId) {
      setTimeout(() => {
        const el = document.getElementById(headingId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const navigateToHome = () => {
    setView('landing');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070b12] text-slate-100 selection:bg-sky-500/20 selection:text-sky-300">
      {/* Top Navigation Bar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onNavigateHome={navigateToHome}
        onNavigateDocs={navigateToDocs}
        isDocsView={view === 'docs'}
      />

      {/* Main View Area */}
      <div className="flex-1">
        {view === 'landing' ? (
          <>
            <HeroSection
              onExploreDocs={() => navigateToDocs('quickstart')}
              onOpenPlayground={() => {
                document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenArchitecture={() => {
                document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <ArchitectureVisualizer />
            <OmnichannelPlayground />
            <WhatsAppRoiCalculator />
            <ProviderMatrixSection />
            <BenchmarkSection />
            <FeatureGrid />
          </>
        ) : (
          <DocsLayout
            currentDocId={currentDocId}
            onSelectDoc={(id) => navigateToDocs(id)}
            onNavigateHome={navigateToHome}
          />
        )}
      </div>

      {/* Global Footer */}
      <Footer onNavigateDocs={navigateToDocs} />

      {/* Global Cmd+K Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(docId, headingId) => navigateToDocs(docId, headingId)}
      />
    </div>
  );
}
export default App;
