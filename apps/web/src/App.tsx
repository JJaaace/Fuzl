import { useEffect, useRef, useState } from 'react';
import { checkHealth } from './lib/api';

const sample = `Alex: Anyone free this Friday evening?
Sam: Maybe after 7. I can spend up to $20.
Jordan: I'd like to try something new, but keep the drive under 20 minutes.
Alex: Bowling could be fun. Nothing is booked yet.`;

type Connection =
  | { status: 'idle' | 'checking' | 'connected' }
  | { status: 'error'; message: string };

export default function App() {
  const [draft, setDraft] = useState('');
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

  return (
    <div className="page">
      <header><span className="wordmark">Fuzl</span><span className="stage">Foundation preview</span></header>
      <main>
        <section className="intro" aria-labelledby="intro-title">
          <h1 id="intro-title">Turn your group chat<br className="desktop-break" /> into a plan.</h1>
          <p>Foundation preview. AI planning is not connected yet. Your draft stays in this tab.</p>
        </section>

        <section className="draft-panel" aria-labelledby="draft-label">
          <div className="draft-heading">
            <label id="draft-label" htmlFor="draft">Conversation draft</label>
            <div className="actions">
              <button onClick={() => setDraft(sample)}>Load sample</button>
              <button className="quiet" onClick={() => setDraft('')}>Clear</button>
            </div>
          </div>
          <textarea id="draft" value={draft} onChange={(event) => setDraft(event.target.value)}
            aria-describedby="draft-note" placeholder="Type a synthetic conversation here, or load the sample to try editing." />
          <p id="draft-note" className="note">Temporary draft · Not sent or saved · Cleared when you reload</p>
        </section>

        <section className="connection-panel" aria-labelledby="connection-title">
          <div>
            <h2 id="connection-title">Development connection</h2>
            <div className="connection-status" role="status" aria-live="polite" aria-atomic="true">
              {connection.status === 'idle' && <p>Not checked. Check whether the local API is reachable.</p>}
              {connection.status === 'checking' && <p>Checking connection…</p>}
              {connection.status === 'connected' && <p>Connected. The API responded to the last check. AI planning is not connected.</p>}
              {connection.status === 'error' && <p>Connection failed. {connection.message}</p>}
            </div>
          </div>
          <button onClick={() => void connect()} disabled={connection.status === 'checking'}>
            {connection.status === 'checking' ? 'Checking…' : connection.status === 'error' ? 'Retry connection' : 'Check connection'}
          </button>
        </section>
      </main>
      <footer>A small start for your next get-together.</footer>
    </div>
  );
}
