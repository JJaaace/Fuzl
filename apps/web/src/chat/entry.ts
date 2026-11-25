import { captureGuestEntry } from '../guests/api';
export function captureChatEntry(href: string, replace: (path: string) => void, storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const url = new URL(href);
  // A thread/group/session URL is navigation, not an invitation credential.
  // Scrubbing it would lose the selected thread on refresh or OAuth return.
  if (url.pathname !== '/chat' || url.search && !url.hash) return null;
  return captureGuestEntry(href, replace, storage, '/chat', 'fuzl-chat-invite');
}
