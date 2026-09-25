import ky from 'ky';
import { toast } from 'sonner';
import { getStoredEnvironment } from '../mode/EnvironmentContext';
import { getApiKey, setSession } from './session';

export const coreApiPrefix = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/v1`;
export const pluginApiPrefix = `${(import.meta.env.VITE_PLUGINS_URL || '').replace(/\/$/, '')}/api/v1/plugins`;
export function createApiClient(prefix: string) {
  return ky.create({
    prefix,
    timeout: 20000,
    retry: { limit: 2, methods: ['get', 'head', 'options'], statusCodes: [408, 429, 500, 502, 503, 504] },
    headers: { Accept: 'application/json' },
    hooks: {
      beforeRequest: [
        ({ request }) => {
          const key = getApiKey();
          if (key) request.headers.set('Authorization', `Bearer ${key}`);
          const environment = getStoredEnvironment();
          request.headers.set('x-convey-environment', environment);
          request.headers.set('x-convey-sandbox', String(environment === 'sandbox'));
        },
      ],
      afterResponse: [
        ({ response }) => {
          if (response.status === 401) {
            setSession('', null);
            toast.error('Session expired. Please sign in again.');
          }
          if (response.status === 403) toast.error('This credential or environment does not permit this operation.');
          if (response.status === 503) toast.error('Service unavailable. Please retry shortly.');
        },
      ],
    },
  });
}
export const coreClient = createApiClient(coreApiPrefix);
export const pluginClient = createApiClient(pluginApiPrefix);
