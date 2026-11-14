import { ballotViewSchema, voteSchema } from '@fuzl/planning';
import { guestRequest } from '../guests/api';
export async function ballotRequest(path: string, token: string, signal: AbortSignal, method = 'GET', body?: unknown, inviteToken?: string) {
  const data = await guestRequest(path, token, signal, method, body, inviteToken, '/api/ballot');
  return path === '/form' ? ballotViewSchema.parse(data) : data === null ? null : voteSchema.parse(data);
}
