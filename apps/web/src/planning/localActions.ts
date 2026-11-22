// UX hint only. The API remains authoritative and enforces the same origin rule.
export const localWorkspaceUrl='http://127.0.0.1:5173';
export function localActionsAvailable(origin: string) {
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
}
