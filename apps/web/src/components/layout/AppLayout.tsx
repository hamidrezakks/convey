import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { CommandPalette } from './CommandPalette';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export interface AppLayoutProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
  onRefresh?: () => void;
  isLiveStreaming?: boolean;
}

export function AppLayout({
  activeTab,
  onSelectTab,
  children,
  onRefresh,
  isLiveStreaming = true,
}: AppLayoutProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={onSelectTab} />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onRefresh={onRefresh}
          isLiveStreaming={isLiveStreaming}
        />

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-grid-pattern">
          {children}
        </main>
      </div>

      {/* ⌘K Command Palette Modal */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectTab={onSelectTab}
      />

      {/* Toast Notification Container */}
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}
