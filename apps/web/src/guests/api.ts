import { guestFormSchema, guestReplySchema, guestTokenSchema } from '@fuzl/planning';
import type { GuestReply, ResponseInput } from '@fuzl/planning';
export async function guestRequest<T>(path: string, token: string, signal: AbortSignal, method = 'GET', body?: unknown, inviteToken?: string): Promise<T> {
    const response = await fetch(`/api/guest${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(inviteToken ? { 'X-Invite-Token': inviteToken } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    const data = await response.json().catch(() => { throw new Error('The server returned an unreadable response. Your typed answers were kept.'); });
    if (!response.ok)
        throw new Error(data?.error?.message ?? 'The response could not be sent. Your typed answers were kept; retry deliberately.');
    if (path === '/response' || path === '/responses') {
        const parsed = guestReplySchema.safeParse(data);
        if (!parsed.success)
            throw new Error('The server returned an unsupported response. Your typed answers were kept.');
        return parsed.data as T;
    }
    return data as T;
}
export const readGuestForm = async (token: string, signal: AbortSignal) => {
    const parsed = guestFormSchema.safeParse(await guestRequest('/form', token, signal));
    if (!parsed.success)
        throw new Error('The approved form could not be read. Ask the organizer to check the current link.');
    return parsed.data;
};
export interface EditPermission {
    submissionId: string;
    editToken: string;
}
export function newEditPermission(): EditPermission {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return { submissionId: crypto.randomUUID(), editToken: btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') };
}
export function captureGuestEntry(href: string, replace: (path: string) => void, storage: Pick<Storage, 'getItem' | 'setItem'>): string | null {
    const url = new URL(href);
    const candidate = new URLSearchParams(url.hash.slice(1)).get('invite');
    replace('/guest'); // Before React/network work: no bearer in query, history or referrers.
    try {
        if (candidate && !url.search && guestTokenSchema.safeParse(candidate).success) {
            storage.setItem('fuzl-guest-invite', candidate);
            return candidate;
        }
        if (url.hash || url.search)
            return null;
        const stored = storage.getItem('fuzl-guest-invite');
        return guestTokenSchema.safeParse(stored).success ? stored : null;
    }
    catch {
        return candidate && guestTokenSchema.safeParse(candidate).success ? candidate : null;
    }
}
export async function permissionKey(invite: string) {
    if (!crypto.subtle)
        throw new Error('Guest editing needs localhost or HTTPS. Open the local link on this computer or ask for a secure shared address.');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(invite));
    return `fuzl-guest-edit-${Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')}`;
}
export function readPermission(storage: Pick<Storage, 'getItem'>, key: string): EditPermission | null {
    const text = storage.getItem(key);
    if (!text)
        return null;
    let data: unknown;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error('Stored edit permission is unreadable. Reopen the original invite in the browser that sent your response.');
    }
    if (typeof data !== 'object' || data === null || !('editToken' in data) || !('submissionId' in data) || !guestTokenSchema.safeParse(data.editToken).success || typeof data.submissionId !== 'string' || !/^[\da-f-]{36}$/i.test(data.submissionId))
        throw new Error('Editing permission could not be read. Use the original browser storage; a matching name cannot recover another response.');
    return { submissionId: data.submissionId, editToken: data.editToken as string };
}
export const replyPayload = (reply: GuestReply): ResponseInput => ({ alias: reply.alias, answers: reply.answers });
