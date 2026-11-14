import { Router } from 'express';
import { applyWorkChange, makeWork, recordWorkDecision, workApplySchema, workRequestSchema, workReportSchema, workKey, recordId, savedSummarySchema, summaryReferencesValid } from '@fuzl/planning';
import { database } from '../accounts/database.js';
import { PlaceStore } from '../places/store.js';
import type { PlaceContextStore } from '../places/store.js';
import { secure, guestErrors } from '../guests/router.js';
import { ExtractionError } from '../extraction/errors.js';
import { AdjustmentCache, workHash } from './cache.js';
export interface AdjustmentOptions { cache?: AdjustmentCache; store?: () => PlaceContextStore; now?: () => number }
const changed = () => new ExtractionError(409, 'adjustment_changed', 'Constraints, evidence, saved revision or recommendation context changed. Your current work was kept; recheck and preview again.');
export function adjustmentRouter(options: AdjustmentOptions = {}) {
  const r = Router({ mergeParams: true }), cache = options.cache ?? new AdjustmentCache(options.now), active = new Set<string>(), counts = new Map<string, { at: number; n: number }>(); r.use(secure);
  r.post(['/preview', '/apply'], async (req, res) => {
    const applying = req.path === '/apply', parsed = (applying ? workApplySchema : workRequestSchema).safeParse(req.body), id = recordId.safeParse(req.params.sessionId);
    if (!parsed.success || !id.success) throw new ExtractionError(400, 'invalid_adjustment', 'Check the saved search, applied planning facts and sourced visit details. No change was applied.');
    const input = parsed.data, subject = res.locals.organizer as string, now = (options.now ?? Date.now)();
    for (const [key, v] of counts) if (now - v.at >= 60000) counts.delete(key);
    const count = counts.get(subject) ?? { at: now, n: 0 };
    if (active.has(subject) || count.n >= 10 || counts.size >= 1000 && !counts.has(subject)) throw new ExtractionError(429, 'adjustment_limit', 'Wait before another adjustment: one in flight and ten deliberate requests per minute. No automatic retry ran.');
    active.add(subject); count.n++; counts.set(subject, count);
    try {
      const store = (options.store ?? (() => new PlaceStore(database())))(), context = await store.context(subject, id.data, input);
      const snapshot = cache.get(input.snapshotId, subject, id.data);
      if (snapshot.revision !== input.sessionRevision || snapshot.contextVersion !== context.version || snapshot.summaryKey !== workHash(input.summary)) throw changed();
      if (input.evidence.some(e => !snapshot.context.candidates.some(c => workKey(c) === e.key))) throw new ExtractionError(400, 'unknown_work_option', 'Sourced checks must refer to this exact search’s options.');
      const requestKey = workHash({ snapshotId: input.snapshotId, sessionRevision: input.sessionRevision, summary: input.summary, evidence: input.evidence });
      if (!applying) {
        const report = makeWork(snapshot.context, input.summary, input.evidence, context.memories, context.privateSpending.length > 0);
        const latest = await store.context(subject, id.data, input); if (latest.version !== context.version) throw changed();
        cache.get(input.snapshotId, subject, id.data);
        const previewId = cache.preview(subject, id.data, input.snapshotId, requestKey, report.suggestions);
        res.json(workReportSchema.parse({ ...report, previewId }));
      } else {
        const choice = workApplySchema.parse(input), preview = cache.getPreview(choice.previewId, subject, id.data);
        if (preview.snapshotId !== choice.snapshotId || preview.requestKey !== requestKey || context.privateSpending.length) throw changed();
        const suggestion = preview.suggestions.find(s => s.id === choice.suggestionId); if (!suggestion) throw changed();
        if ((input.summary.organizerDecisions?.length ?? 0) >= 20) throw new ExtractionError(409, 'decision_limit', 'This session has reached its 20-decision history limit. Review the history before adding another decision.');
        const adjusted = applyWorkChange(snapshot.context, input.summary, suggestion), stamp = cache.decision(preview, suggestion.id);
        const decision = recordWorkDecision(input.summary, suggestion, stamp.id, stamp.recordedAt, input.evidence);
        adjusted.summary.organizerDecisions = [...(input.summary.organizerDecisions ?? []), decision];
        if (!savedSummarySchema.safeParse(adjusted.summary).success || !summaryReferencesValid(adjusted.summary)) throw changed();
        const latest = await store.context(subject, id.data, input); if (latest.version !== context.version) throw changed(); cache.get(input.snapshotId, subject, id.data);
        res.json({ summary: adjusted.summary, query: adjusted.context.kind === 'places' ? adjusted.context.query : null, decision });
      }
    } catch (e) { if (e instanceof ExtractionError) throw e; throw new ExtractionError(503, 'adjustment_unavailable', 'Adjustment checks could not complete. Your summary was kept; check storage/migrations and retry deliberately.'); }
    finally { active.delete(subject); req.body = undefined; }
  });
  r.use(guestErrors); return r;
}
