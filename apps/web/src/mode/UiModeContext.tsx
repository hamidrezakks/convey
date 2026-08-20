import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type UiMode = 'engineer' | 'ops';

export interface UiModeContextValue {
  mode: UiMode;
  setMode: (mode: UiMode) => void;
  toggleMode: () => void;
  isEngineer: boolean;
  isOps: boolean;
}

const STORAGE_KEY = 'convey_ui_mode';

function getStoredMode(key: string, defaultMode: UiMode): UiMode {
  if (typeof window === 'undefined') return defaultMode;
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'engineer' || stored === 'ops') {
      return stored;
    }
  } catch {
    // Ignore storage read errors
  }
  return defaultMode;
}

const defaultContext: UiModeContextValue = {
  mode: 'engineer',
  setMode: () => {},
  toggleMode: () => {},
  isEngineer: true,
  isOps: false,
};

export const UiModeContext = createContext<UiModeContextValue>(defaultContext);

export interface UiModeProviderProps {
  children: React.ReactNode;
  defaultMode?: UiMode;
  storageKey?: string;
}

export function UiModeProvider({ children, defaultMode = 'engineer', storageKey = STORAGE_KEY }: UiModeProviderProps) {
  const [mode, setModeState] = useState<UiMode>(() => getStoredMode(storageKey, defaultMode));

  const setMode = (newMode: UiMode, notify = true) => {
    setModeState(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch {
      // Ignore storage write errors
    }
    if (notify) {
      if (newMode === 'engineer') {
        toast.info('Switched to Engineering Mode', {
          description: 'Deep diagnostic telemetry, W3C distributed traces & circuit matrix active.',
          icon: '🛠️',
        });
      } else {
        toast.success('Switched to Operations Mode', {
          description: 'Simplified human-friendly dashboard, delivery timelines & plain explanations active.',
          icon: '📊',
        });
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === 'engineer' ? 'ops' : 'engineer');
  };

  // Keyboard shortcut listener: Shift + E to toggle mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea/select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.shiftKey && (e.key === 'E' || e.key === 'e') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const value = useMemo<UiModeContextValue>(
    () => ({
      mode,
      setMode: (m) => setMode(m, true),
      toggleMode,
      isEngineer: mode === 'engineer',
      isOps: mode === 'ops',
    }),
    [mode],
  );

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode(): UiModeContextValue {
  const context = useContext(UiModeContext);
  if (!context) {
    throw new Error('useUiMode must be used within a UiModeProvider');
  }
  return context;
}
