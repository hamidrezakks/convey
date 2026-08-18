import { Outlet } from '@tanstack/react-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useTheme } from '../../theme';
import { CommandPalette } from './CommandPalette';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  // Responsive breakpoint listener: auto-collapse on tablet viewports (< 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    // Initial check
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-150">
      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          role="presentation"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar with responsive collapse & mobile drawer */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
          {children || <Outlet />}
        </main>
      </div>

      {/* ⌘K Command Palette Modal */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Toast Notification Container with dynamic theme matching */}
      <Toaster position="bottom-right" theme={resolvedTheme} richColors />
    </div>
  );
}
