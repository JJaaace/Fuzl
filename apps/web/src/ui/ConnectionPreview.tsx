import { useEffect, useRef, useState } from 'react';
import { checkHealth } from '../lib/api';

type Connection =
  | { status: 'idle' | 'checking' | 'connected' }
  | { status: 'error'; message: string };

export default function ConnectionPreview() {
  const [connection, setConnection] = useState<Connection>({ status: 'idle' });
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function connect() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setConnection({ status: 'checking' });

    try {
      await checkHealth(controller.signal);
      if (pending.current === controller && !controller.signal.aborted) {
        setConnection({ status: 'connected' });
      }
    } catch (error) {
      if (pending.current !== controller || controller.signal.aborted) return;
      const message = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The check timed out after 5 seconds. Check that the API is running, then retry.'
        : error instanceof TypeError
          ? 'Could not reach the API. Start it with npm run dev:api, then retry.'
          : error instanceof Error ? error.message : 'Connection failed. Check that the API is running, then retry.';
      setConnection({ status: 'error', message });
    }
  }

  return <div className="page"><header className="app-header"><a href="/">Fuzl workspace</a><span className="eyebrow">Development diagnostic</span></header><main><h1>API connection</h1><p>This checks reachability, not AI, authentication or saved storage.</p><p role="status" aria-live="polite">{connection.status === 'idle' ? 'Not checked.' : connection.status === 'checking' ? 'Checking…' : connection.status === 'connected' ? 'API reachable.' : connection.status === 'error' ? connection.message : 'Not checked.'}</p><button onClick={() => void connect()} disabled={connection.status === 'checking'}>Check connection</button></main></div>;
}
