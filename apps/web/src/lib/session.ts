export interface ConsoleSession {
  tenantId: string;
  team: string;
  keyName: string;
  role: string;
  scope: string;
  isSandbox: boolean;
}
let apiKey = '';
let session: ConsoleSession | null = null;
const listeners = new Set<() => void>();
export function getApiKey() {
  return apiKey;
}
export function getSession() {
  return session;
}
export function setSession(key: string, identity: ConsoleSession | null) {
  apiKey = key;
  session = identity;
  for (const listener of listeners) listener();
}
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requireSession(): ConsoleSession {
  if (!session) throw new Error('Sign in to continue');
  return session;
}
