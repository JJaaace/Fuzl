import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { answersFit, guestSourceText, guestAnswerSchema, guestQuestionSchema, guestTokenSchema } from '@fuzl/planning';
import type { GuestForm, GuestOrigin, GuestReply, InviteInfo, InviteInput, OrganizerReply, ResponseInput, SessionInput } from '@fuzl/planning';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { ExtractionError } from '../extraction/errors.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const deny = () => new ExtractionError(404, 'guest_unavailable', 'This link or response is unavailable, expired or revoked. Ask the organizer for a current link.');
const conflict = () => new ExtractionError(409, 'guest_conflict', 'This reply changed. Refresh responses and review the latest version; your editor was kept.');
const questions = (value: unknown) => z.array(guestQuestionSchema).parse(value);
const scope = (subject: string, id: string) => ({ id, group: { owner: { authSubject: subject } } });
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const rowSelect = { id: true, alias: true, revision: true, answers: true, updatedAt: true } as const;
export function redactAnswers(value: unknown): OrganizerReply['answers'] {
    return z.array(z.unknown()).max(5).parse(value).map(raw => {
        const marker = z.strictObject({ questionId: z.string().uuid(), kind: z.literal('budget'), state: z.literal('private') }).safeParse(raw);
        if (marker.success)
            return marker.data;
        const answer = guestAnswerSchema.parse(raw);
        return answer.kind === 'budget' && answer.visibility === 'private' && answer.state !== 'blank' ? { questionId: answer.questionId, kind: 'budget' as const, state: 'private' as const } : answer;
    });
}
export class GuestStore {
    constructor(private db: PrismaClient, private now = Date.now) { }
    private async owner(tx: Prisma.TransactionClient, subject: string, sessionId: string) {
        const session = await tx.planningSession.findFirst({ where: scope(subject, sessionId), select: { id: true, revision: true } });
        if (!session)
            throw deny();
        return session;
    }
    private info(row: {
        id: string;
        title: string;
        questions: unknown;
        expiresAt: Date;
        revokedAt: Date | null;
    }): InviteInfo {
        return { id: row.id, title: row.title, questions: questions(row.questions), expiresAt: row.expiresAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null };
    }
    async inviteInfo(subject: string, sessionId: string) {
        await this.owner(this.db, subject, sessionId);
        const row = await this.db.guestInvite.findFirst({ where: { sessionId, session: scope(subject, sessionId) }, orderBy: { createdAt: 'desc' } });
        return row ? this.info(row) : null;
    }
    async createInvite(subject: string, sessionId: string, input: InviteInput) {
        return this.db.$transaction(async (tx) => {
            await this.owner(tx, subject, sessionId);
            await tx.$queryRaw `SELECT id FROM fuzl.fuzl_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
            const session = await this.owner(tx, subject, sessionId);
            if (session.revision !== input.sessionRevision)
                throw new ExtractionError(409, 'session_changed', 'The saved session changed. Reopen the latest saved session before approving a link.');
            const active = await tx.guestInvite.findFirst({ where: { activeSessionId: sessionId } });
            if (active && !active.revokedAt && active.expiresAt.getTime() > this.now() && !input.replace)
                throw new ExtractionError(409, 'invite_exists', 'An active link already exists. Replace it explicitly to revoke its link and response-edit access.');
            await tx.guestInvite.updateMany({ where: { activeSessionId: sessionId }, data: { activeSessionId: null, revokedAt: new Date(this.now()) } });
            const token = randomBytes(32).toString('base64url');
            const row = await tx.guestInvite.create({ data: { sessionId, activeSessionId: sessionId, tokenDigest: digest(token), title: input.title, questions: json(input.questions), expiresAt: new Date(this.now() + input.days * 86400000) } });
            return { invite: this.info(row), token };
        });
    }
    async revoke(subject: string, sessionId: string) {
        await this.owner(this.db, subject, sessionId);
        await this.db.guestInvite.updateMany({ where: { activeSessionId: sessionId, session: scope(subject, sessionId) }, data: { activeSessionId: null, revokedAt: new Date(this.now()) } });
    }
    private async invite(tx: Prisma.TransactionClient, token: string, lock = false) {
        if (!guestTokenSchema.safeParse(token).success)
            throw deny();
        let row = await tx.guestInvite.findUnique({ where: { tokenDigest: digest(token) } });
        if (!row)
            throw deny();
        if (lock) {
            await tx.$queryRaw `SELECT id FROM fuzl.fuzl_guest_invites WHERE id = ${row.id}::uuid FOR UPDATE`;
            row = await tx.guestInvite.findUnique({ where: { id: row.id } });
        }
        if (!row || row.revokedAt || row.activeSessionId !== row.sessionId || row.expiresAt.getTime() <= this.now())
            throw deny();
        return row;
    }
    async form(token: string): Promise<GuestForm> { const row = await this.invite(this.db, token); return { title: row.title, questions: questions(row.questions), expiresAt: row.expiresAt.toISOString() }; }
    private async own(tx: Prisma.TransactionClient, inviteId: string, editToken: string): Promise<GuestReply> {
        if (!guestTokenSchema.safeParse(editToken).success)
            throw deny();
        const row = await tx.guestResponse.findFirst({ where: { inviteId, editDigest: digest(editToken) }, select: { ...rowSelect, privateAnswers: true } });
        if (!row)
            throw deny();
        const answers = z.array(z.unknown()).parse(row.answers).map(raw => {
            const marker = z.object({ questionId: z.string(), state: z.literal('private') }).safeParse(raw);
            if (!marker.success)
                return guestAnswerSchema.parse(raw);
            const secret = row.privateAnswers.find(a => a.questionId === marker.data.questionId);
            if (!secret)
                throw deny();
            return guestAnswerSchema.parse({ questionId: secret.questionId, kind: 'budget', state: secret.state, amount: secret.amount === null ? null : Number(secret.amount), currency: secret.currency, visibility: 'private' });
        });
        return { id: row.id, alias: row.alias, revision: row.revision, updatedAt: row.updatedAt.toISOString(), answers };
    }
    async readOwn(inviteToken: string, editToken: string) { const invite = await this.invite(this.db, inviteToken); return this.own(this.db, invite.id, editToken); }
    private split(payload: ResponseInput) {
        const secrets = payload.answers.flatMap(a => a.kind === 'budget' && a.visibility === 'private' && a.state !== 'blank' ? [{ questionId: a.questionId, state: a.state, amount: a.amount, currency: a.currency }] : []);
        const answers = payload.answers.map(a => secrets.some(s => s.questionId === a.questionId) ? { questionId: a.questionId, kind: 'budget', state: 'private' } : a);
        return { secrets, answers };
    }
    private fit(form: unknown, payload: ResponseInput) { if (!answersFit(questions(form), payload))
        throw new ExtractionError(400, 'invalid_answers', 'Answer each listed question, using unknown when unsure. Required questions cannot be left blank.'); }
    async submit(token: string, input: {
        submissionId: string;
        editToken: string;
        payload: ResponseInput;
    }) {
        return this.db.$transaction(async (tx) => {
            const invite = await this.invite(tx, token, true);
            if (same(invite.tokenDigest, digest(input.editToken))) throw new ExtractionError(400, 'separate_edit_permission', 'Response editing requires a separate private credential, never the shared invite.');
            const existing = await tx.guestResponse.findUnique({ where: { inviteId_submissionId: { inviteId: invite.id, submissionId: input.submissionId } } });
            if (existing) {
                if (!same(existing.editDigest, digest(input.editToken)))
                    throw deny();
                return this.own(tx, invite.id, input.editToken);
            }
            this.fit(invite.questions, input.payload);
            if (await tx.guestResponse.count({ where: { invite: { sessionId: invite.sessionId } } }) >= 200)
                throw new ExtractionError(429, 'invite_limit', 'This session has reached its response limit. Contact the organizer.');
            const { secrets, answers } = this.split(input.payload);
            await tx.guestResponse.create({ data: { inviteId: invite.id, submissionId: input.submissionId, editDigest: digest(input.editToken), alias: input.payload.alias, answers: json(answers), privateAnswers: { create: secrets } } });
            return this.own(tx, invite.id, input.editToken);
        });
    }
    async edit(token: string, editToken: string, input: {
        revision: number;
        payload: ResponseInput;
    }) {
        return this.db.$transaction(async (tx) => {
            const invite = await this.invite(tx, token, true);
            const old = await this.own(tx, invite.id, editToken);
            this.fit(invite.questions, input.payload);
            const { secrets, answers } = this.split(input.payload);
            const result = await tx.guestResponse.updateMany({ where: { id: old.id, revision: input.revision, inviteId: invite.id, editDigest: digest(editToken) }, data: { alias: input.payload.alias, answers: json(answers), revision: { increment: 1 } } });
            if (result.count !== 1)
                throw conflict();
            await tx.guestPrivateAnswer.deleteMany({ where: { responseId: old.id } });
            if (secrets.length)
                await tx.guestPrivateAnswer.createMany({ data: secrets.map(s => ({ ...s, responseId: old.id })) });
            return this.own(tx, invite.id, editToken);
        });
    }
    async replies(subject: string, sessionId: string): Promise<OrganizerReply[]> {
        await this.owner(this.db, subject, sessionId);
        const rows = await this.db.guestResponse.findMany({ where: { invite: { session: scope(subject, sessionId) } }, select: { ...rowSelect, inviteId: true, invite: { select: { questions: true } } }, orderBy: { updatedAt: 'desc' }, take: 200 });
        return rows.map(row => ({ id: row.id, alias: row.alias, revision: row.revision, updatedAt: row.updatedAt.toISOString(), inviteId: row.inviteId, questions: questions(row.invite.questions), answers: redactAnswers(row.answers) }));
    }
}
// Validate new guest provenance at explicit Save. Existing accepted snapshots may
// remain historical; a newer reply never rewrites them or unrelated local edits.
export async function validateGuestOrigins(tx: Prisma.TransactionClient, subject: string, input: SessionInput, previous?: SessionInput, sessionId?: string) {
    async function check(origin: GuestOrigin, cites: (quote: string) => boolean) {
        const row = await tx.guestResponse.findFirst({ where: { id: origin.responseId, invite: { session: { ...(sessionId ? { id: sessionId } : {}), group: { owner: { authSubject: subject } } } } }, select: { ...rowSelect, invite: { select: { questions: true } } } });
        if (!row || row.revision !== origin.revision)
            throw conflict();
        await tx.$queryRaw `SELECT id FROM fuzl.fuzl_guest_responses WHERE id = ${row.id}::uuid FOR SHARE`;
        const latest = await tx.guestResponse.findUnique({ where: { id: row.id }, select: { revision: true } });
        if (!latest || latest.revision !== row.revision)
            throw conflict();
        const answer = redactAnswers(row.answers).find(a => a.questionId === origin.questionId);
        if (!answer || answer.state === 'private' || answer.state === 'blank')
            throw new ExtractionError(422, 'private_answer', 'Private or blank answers cannot enter a planning summary.');
        const quote = guestSourceText({ alias: row.alias, revision: row.revision, questions: questions(row.invite.questions) }, answer);
        if (origin.alias !== row.alias || origin.updatedAt !== row.updatedAt.toISOString() || origin.sourceText !== quote || !cites(quote))
            throw new ExtractionError(422, 'guest_source_invalid', 'The guest source does not match the submitted response. Refresh and apply it again.');
    }
    for (const fact of input.summary.facts) {
        const old = previous?.summary.facts.find(f => f.id === fact.id);
        if (old?.guest && JSON.stringify(old.guest) !== JSON.stringify(fact.guest))
            throw new ExtractionError(422, 'guest_source_immutable', 'An accepted guest origin cannot be rewritten. Apply the updated response as a new fact.');
        if (fact.guest && !old?.guest)
            await check(fact.guest, quote => fact.sourceIds.some(id => input.summary.sources.some(s => s.id === id && s.text === quote)));
    }
    for (const question of input.summary.questions) {
        const old = previous?.summary.questions.find(q => q.id === question.id);
        if (question.guest && JSON.stringify(old?.guest) !== JSON.stringify(question.guest))
            await check(question.guest, quote => question.resolution === quote);
    }
}
