import { sessionInputSchema } from '@fuzl/planning';
import type { SavedSession } from '@fuzl/planning';
export class SavedWorkError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function privateRequest<T>(token: string, path: string, signal: AbortSignal, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/private${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), credentials: 'omit', cache: 'no-store' });
  if (response.status === 204) return undefined as T;
  const value = await response.json().catch(() => { throw new SavedWorkError('Saved storage returned an unreadable response. Your edits were kept.', response.status); });
  if (!response.ok) throw new SavedWorkError(value?.error?.message ?? 'Saved work could not be accessed. Your edits were kept.', response.status);
  return value as T;
}
export function validateLoadedSession(session: SavedSession): SavedSession {
  const parsed = sessionInputSchema.safeParse(session.payload);
  if (!parsed.success || !session.id || !Number.isInteger(session.revision) || session.revision < 1) throw new Error('The saved session format could not be read. Your workspace was kept.');
  return { ...session, payload: parsed.data };
}
// A new account lifetime cannot use a response from an earlier login, even if
// the same identity later signs in again. Also gates out-of-order list requests.
export class RequestLifetime {
  private controller = new AbortController();
  private serial = 0;
  get signal() { return this.controller.signal; }
  capture() { return ++this.serial; }
  current(serial: number) { return !this.controller.signal.aborted && serial === this.serial; }
  dispose() { this.controller.abort(); this.serial += 1; }
}

export class AccountIdentity {
  private previous: string | null = null;
  private epoch = 0;
  accept(next: string | null) {
    if (this.previous !== null && next !== this.previous) this.epoch += 1;
    this.previous = next;
    return this.epoch;
  }
}

// Updated synchronously by user actions, so delayed callbacks do not depend on
// a render/effect having caught up with newly typed or unapplied editor input.
export class WorkspaceEdits {
  private version = 0;
  change() { this.version += 1; }
  get revision() { return this.version; }
  hasWork() { return this.version > 0; }
  changedSince(revision: number) { return this.version !== revision; }
}
