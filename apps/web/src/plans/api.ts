import { ownRsvpSchema, publicPlanSchema } from '@fuzl/planning';
import { guestRequest } from '../guests/api';
export async function planRequest(path: string, token: string, signal: AbortSignal, method = 'GET', body?: unknown, invite?: string): Promise<unknown> { const raw = await guestRequest(path, token, signal, method, body, invite, '/api/plan'); return path === '/page' ? publicPlanSchema.parse(raw) : raw === null ? null : ownRsvpSchema.parse(raw); }
