import { canPlanTransition, detailsFromOption, materialPlanKey, publicPlanSchema, publishablePlan, rsvpCreateSchema, rsvpEditSchema } from '@fuzl/planning';
import type { BallotDashboard, OwnRsvp, OwnerPlan, PlanDraft, PublicPlan } from '@fuzl/planning';
// Explicitly simulated UI transport; the actual store/credentials/SQL paths have
// separate disposable-database tests. No network or live provider is involved.
export function planDemo(ballots: () => Promise<unknown>, onLink: (token: string) => void) {
  let plan: OwnerPlan | null = null, token: string | null = null, expiresAt = '';
  let publishedDraft: PlanDraft | null = null;
  const rows = new Map<string, OwnRsvp & { id: string; submissionId: string; lastRequestId?: string }>();
  const key = async (d: PlanDraft) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(d))))].map(b => b.toString(16).padStart(2, '0')).join('');
  const current = () => {
    if (!plan) return null;
    plan.attendance = [...rows.values()].map(r => ({ id: r.id, alias: r.alias, choice: r.choice, revision: r.revision, answeredMaterialVersion: r.answeredMaterialVersion, needsReconfirmation: r.answeredMaterialVersion !== plan!.published?.materialVersion, updatedAt: r.updatedAt }));
    const active = plan.attendance.filter(r => !r.needsReconfirmation);
    plan.counts = { going: active.filter(r => r.choice === 'going').length, maybe: active.filter(r => r.choice === 'maybe').length, cant: active.filter(r => r.choice === 'cant').length, needsReconfirmation: plan.attendance.length - active.length, totalResponses: plan.attendance.length };
    return structuredClone(plan);
  };
  const records = new Map<string, { key: string; result: unknown }>();
  const owner = async (path: string, method: string, raw?: unknown): Promise<unknown> => {
    void method; if (!path) return current(); const input = raw as Record<string, unknown>;
    const request = String(input.requestId), fingerprint = JSON.stringify([path, input]);
    const old = records.get(request); if (old) { if (old.key !== fingerprint) throw Error('Demo request changed'); return structuredClone(old.result); }
    if ((plan?.revision ?? 0) !== input.revision) throw Error('Demo plan revision changed. Refresh and review.');
    if (path === '/select') {
      const data = await ballots() as BallotDashboard, b = data.ballots.find(b => b.id === input.ballotId), option = b?.options.find(o => o.id === input.optionId); if (!option) throw Error('Choose a published option');
      const draft = { ballotId: b!.id, option: structuredClone(option), details: detailsFromOption(option) };
      if (plan) { if (['cancelled', 'completed'].includes(plan.status)) throw Error('Terminal plan'); plan.draft = draft; plan.draftKey = await key(draft); }
      else plan = { id: crypto.randomUUID(), revision: 0, status: 'proposed', draft, draftKey: await key(draft), published: null, history: [], link: null, attendance: [], counts: { going: 0, maybe: 0, cant: 0, needsReconfirmation: 0, totalResponses: 0 } };
    } else {
      if (!plan) throw Error('Choose an option first');
      if (path === '/draft') { if (['cancelled', 'completed'].includes(plan.status)) throw Error('Terminal plan'); plan.draft.details = structuredClone(input.details) as PlanDraft['details']; plan.draftKey = await key(plan.draft); }
      else if (path === '/publish') {
        if (!canPlanTransition(plan.status, 'confirmed') || !publishablePlan(plan.draft.details) || input.previewKey !== plan.draftKey || input.approved !== true) throw Error('Review a complete saved plan before publishing');
        const material = !publishedDraft || materialPlanKey(publishedDraft) !== materialPlanKey(plan.draft), version = (plan.published?.version ?? 0) + 1, materialVersion = (plan.published?.materialVersion ?? 0) + Number(material);
        const notice = `${version > 1 && material ? 'Plan changed. Reconfirm your RSVP. ' : 'Plan confirmed. '}${input.notice}`;
        plan.status = 'confirmed'; plan.published = { id: plan.id, version, materialVersion, status: 'confirmed', details: structuredClone(plan.draft.details), sample: plan.draft.option.sample, changeNotice: notice, publishedAt: new Date().toISOString(), rsvpOpen: plan.published?.rsvpOpen ?? true }; publishedDraft = structuredClone(plan.draft);
        plan.history.unshift({ version, materialVersion, status: 'confirmed', changeNotice: notice, publishedAt: plan.published.publishedAt });
      } else if (path === '/control') {
        const action = input.action; if (action !== 'close-rsvps' && !canPlanTransition(plan.status, action as 'completed' | 'cancelled')) throw Error('Invalid lifecycle change');
        if (action !== 'close-rsvps') plan.status = action as 'completed' | 'cancelled';
        if (plan.published) { plan.published = { ...plan.published, version: plan.published.version + 1, status: plan.status as PublicPlan['status'], rsvpOpen: false, changeNotice: `${action === 'cancelled' ? 'CANCELLED. ' : action === 'completed' ? 'Plan completed. ' : 'RSVPs closed. '}${input.notice}` }; plan.history.unshift({ version: plan.published.version, materialVersion: plan.published.materialVersion, status: plan.status, changeNotice: plan.published.changeNotice, publishedAt: new Date().toISOString() }); }
      } else if (path === '/link') { if (!plan.published) throw Error('Publish first'); token = String(input.token); expiresAt = new Date(Date.now() + Number(input.days) * 86400000).toISOString(); plan.link = { expiresAt, revoked: false }; onLink(token); }
      else if (path === '/revoke') { if (plan.link) plan.link.revoked = true; token = null; }
    }
    plan!.revision++; const result = path === '/link' ? { plan: current(), token } : current(); records.set(request, { key: fingerprint, result: structuredClone(result) }); return result;
  };
  const guest = async (path: string, auth: string, signal: AbortSignal, method = 'GET', raw?: unknown, invite?: string): Promise<unknown> => {
    void signal;
    if (!token || (path === '/rsvp' ? invite : auth) !== token || !plan?.published || plan.link?.revoked || Date.parse(expiresAt) <= Date.now()) throw Error('Shared plan link expired or revoked');
    if (path === '/page') return publicPlanSchema.parse({ ...plan.published, expiresAt });
    const row = rows.get(auth);
    const dto = (r: OwnRsvp) => ({ alias: r.alias, choice: r.choice, revision: r.revision, answeredMaterialVersion: r.answeredMaterialVersion, needsReconfirmation: r.answeredMaterialVersion !== plan!.published!.materialVersion, updatedAt: r.updatedAt });
    if (path === '/rsvp' && method === 'GET') return row ? dto(row) : null;
    if (!plan.published.rsvpOpen) throw Error('RSVPs closed');
    if (path === '/rsvps') { const p = rsvpCreateSchema.parse(raw); if (p.payload.planVersion !== plan.published.version) throw Error('Plan changed. Reload and review.'); const old = rows.get(p.editToken); if (old) return dto(old); const r = { id: crypto.randomUUID(), submissionId: p.submissionId, alias: p.payload.alias, choice: p.payload.choice, revision: 1, answeredMaterialVersion: plan.published.materialVersion, needsReconfirmation: false, updatedAt: new Date().toISOString() }; rows.set(p.editToken, r); return dto(r); }
    const p = rsvpEditSchema.parse(raw); if (!row || p.payload.planVersion !== plan.published.version || row.revision !== p.revision && row.lastRequestId !== p.requestId) throw Error('Plan or RSVP changed. Reload.'); const next = { ...row, alias: p.payload.alias, choice: p.payload.choice, answeredMaterialVersion: plan.published.materialVersion, revision: row.lastRequestId === p.requestId ? row.revision : row.revision + 1, lastRequestId: p.requestId, updatedAt: new Date().toISOString() }; rows.set(auth, next); return dto(next);
  };
  return { owner, guest, ballots };
}
