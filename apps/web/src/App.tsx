import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { I18nProvider } from './i18n';
import { queryClient } from './lib/queryClient';
import { EnvironmentProvider, UiModeProvider } from './mode';
import { router } from './router';
import { ThemeProvider } from './theme';

export function App() {
  return (
    <ThemeProvider>
      <EnvironmentProvider>
        <UiModeProvider>
          <I18nProvider>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
            </QueryClientProvider>
          </I18nProvider>
        </UiModeProvider>
      </EnvironmentProvider>
    </ThemeProvider>
  );
}

export default App;
