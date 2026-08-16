import { Outlet } from '@tanstack/react-router';
import type React from 'react';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { CommandPalette } from './CommandPalette';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans">
      {/* Sidebar with TanStack Router Link navigation */}
      <Sidebar />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-grid-pattern">{children || <Outlet />}</main>
      </div>

      {/* ⌘K Command Palette Modal */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Toast Notification Container */}
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}
