import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type Environment = 'production' | 'staging' | 'sandbox';

export interface EnvironmentContextValue {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  isProduction: boolean;
  isSandbox: boolean;
  isStaging: boolean;
}

const STORAGE_KEY = 'convey_active_env';

export function getStoredEnvironment(defaultEnv: Environment = 'production'): Environment {
  if (typeof window === 'undefined') return defaultEnv;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'production' || stored === 'staging' || stored === 'sandbox') {
      return stored;
    }
  } catch {
    // Ignore storage read errors
  }
  return defaultEnv;
}

const defaultContext: EnvironmentContextValue = {
  environment: 'production',
  setEnvironment: () => {},
  isProduction: true,
  isSandbox: false,
  isStaging: false,
};

export const EnvironmentContext = createContext<EnvironmentContextValue>(defaultContext);

export interface EnvironmentProviderProps {
  children: React.ReactNode;
  defaultEnvironment?: Environment;
}

export function EnvironmentProvider({ children, defaultEnvironment = 'production' }: EnvironmentProviderProps) {
  const [environment, setEnvState] = useState<Environment>(() => getStoredEnvironment(defaultEnvironment));

  const setEnvironment = (newEnv: Environment, notify = true) => {
    setEnvState(newEnv);
    try {
      localStorage.setItem(STORAGE_KEY, newEnv);
    } catch {
      // Ignore storage write errors
    }
    if (notify) {
      if (newEnv === 'sandbox') {
        toast.warning('Switched to Sandbox Environment', {
          description: 'Simulated safe dispatches active. No live customer messages or provider costs will occur.',
          icon: '🧪',
        });
      } else if (newEnv === 'production') {
        toast.success('Switched to Production Environment', {
          description: 'Live outbound provider wires active. Planetary deliverability routing enabled.',
          icon: '🟢',
        });
      } else {
        toast.info('Switched to Staging Environment', {
          description: 'Pre-production test pipelines active.',
          icon: '🟡',
        });
      }
    }
  };

  const value = useMemo<EnvironmentContextValue>(
    () => ({
      environment,
      setEnvironment: (env) => setEnvironment(env, true),
      isProduction: environment === 'production',
      isSandbox: environment === 'sandbox',
      isStaging: environment === 'staging',
    }),
    [environment],
  );

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

export function useEnvironment(): EnvironmentContextValue {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}
