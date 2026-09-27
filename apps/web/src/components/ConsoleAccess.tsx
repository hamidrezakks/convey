import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { coreClient } from '../lib/http';
import { queryClient } from '../lib/queryClient';
import { type ConsoleSession, getSession, setSession, subscribeSession } from '../lib/session';

export function ConsoleAccess({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) queryClient.clear();
  }, [session]);
  if (session) return children;
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
      <form
        className="w-full max-w-md space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            setSession(key.trim(), null);
            const identity = await coreClient.get('auth/session', { retry: 0 }).json<ConsoleSession>();
            if (identity.scope !== 'platform')
              throw new Error('Use a platform operator credential to open this console.');
            setSession(key.trim(), identity);
            setKey('');
          } catch (failure) {
            setSession('', null);
            setError(failure instanceof Error ? failure.message : 'Unable to sign in');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-3xl font-semibold">Sign in to Convey</h1>
        <p className="text-slate-300">
          Enter your platform operator API key. It stays in this tab’s memory and is cleared when you reload or sign
          out.
        </p>
        <label className="block" htmlFor="operator-key">
          Operator API key
        </label>
        <input
          id="operator-key"
          type="password"
          autoComplete="off"
          required
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-900 p-3"
        />
        {error && (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="rounded bg-emerald-600 px-5 py-3 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
