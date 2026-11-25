import { newRecordId } from '@fuzl/planning';
import { ballotSourceUrl, demoPlaces, demoPlaceQuery, demoPlaceSummary, evaluatePlaces, feedbackCreateSchema, feedbackEditSchema, feedbackSentiment, outingOwnerSchema, ownFeedbackSchema, publicOutingSchema, recordOutingSchema, outingEditSchema, memoryEditSchema } from '@fuzl/planning';
import type { GroupMemory, OwnerOuting, OwnerPlan, OwnFeedback, PlaceResults } from '@fuzl/planning';
import type { OutingRequest } from './OrganizerOuting';
import type { BallotGuestRequest } from '../ballots/GuestBallot';
// Deliberate synthetic simulator: no network, authentication or SQL proof.
export function outingDemo(plans: { owner: OutingRequest; guest: BallotGuestRequest }) {
  let row: OwnerOuting | null = null, actualVersion = 1;
  const feedback = new Map<string, OwnFeedback & { id: string; actualVersion: number; submissionId: string; lastRequestId?: string }>();
  const records = new Map<string, string>();
  const current = () => { if (!row) return null; row.feedback = [...feedback.values()].map(f => ({ id: f.id, answers: f.answers, revision: f.revision, updatedAt: f.updatedAt, needsReview: f.actualVersion !== actualVersion })); return outingOwnerSchema.parse(structuredClone(row)); };
  const owner: OutingRequest = async (path, _method, raw) => {
    if (!path) return current(); const p = await plans.owner('', 'GET') as OwnerPlan, input = raw as Record<string, unknown>, fingerprint = JSON.stringify([path, raw]);
    const prior = records.get(String(input.requestId)); if (prior) { if (prior !== fingerprint) throw Error('Demo request changed.'); return current(); }
    if ((row?.revision ?? p.revision) !== input.revision) throw Error('Outing changed; reload before saving.');
    if (path === '/complete') {
      const v = recordOutingSchema.parse(raw); if (row || p.status !== 'confirmed' || !p.published) throw Error('Confirm a plan first.');
      await plans.owner('/control', 'POST', { requestId: v.requestId, revision: p.revision, action: 'completed', notice: 'Actual outing recorded; attendance reported separately.' });
      row = { id: newRecordId(), sessionId: newRecordId(), revision: 1, actual: v.actual, original: { ...structuredClone(p.draft), details: structuredClone(p.published.details) }, originalVersion: p.published.version, sameListing: v.sameListing, confirmedAttendees: v.confirmedAttendees, feedbackVersion: 0, feedback: [], privateNotes: '', proposedTakeaway: '', approvedTakeaway: null, memoryActive: false, createdAt: new Date().toISOString() };
    } else if (row && path === '/actual') { const v = outingEditSchema.parse(raw); row.actual = v.actual; row.sameListing = v.sameListing; row.confirmedAttendees = v.confirmedAttendees; row.revision++; row.feedbackVersion++; row.memoryActive = false; actualVersion++; }
    else if (row && path === '/memory') { const v = memoryEditSchema.parse(raw); if (v.feedbackVersion !== row.feedbackVersion) throw Error('Feedback changed.'); row.privateNotes = v.privateNotes; row.proposedTakeaway = v.proposedTakeaway; if (v.action !== 'notes') { row.approvedTakeaway = v.approvedTakeaway; row.memoryActive = v.action === 'approve'; } row.revision++; }
    else throw Error('Record an outing first.');
    records.set(String(input.requestId), fingerprint); return current();
  };
  const guest: BallotGuestRequest = async (path, auth, signal, method = 'GET', raw, invite) => {
    await plans.guest('/page', path === '/feedback' ? invite! : auth, signal); if (!row) throw Error('No actual outing recorded.');
    if (path === '/outing') return publicOutingSchema.parse({ id: row.id, revision: actualVersion, actual: row.actual });
    const old = feedback.get(auth), dto = (f: OwnFeedback & { actualVersion: number }) => ownFeedbackSchema.parse({ answers: f.answers, revision: f.revision, needsReview: f.actualVersion !== actualVersion, updatedAt: f.updatedAt });
    if (path === '/feedback' && method === 'GET') return old ? dto(old) : null;
    if (path === '/feedbacks') { const v = feedbackCreateSchema.parse(raw), prior = feedback.get(v.editToken); if (prior) return dto(prior); if (v.payload.outingRevision !== actualVersion) throw Error('Actual outing changed. Reload.'); const f = { id: newRecordId(), actualVersion, submissionId: v.submissionId, answers: v.payload.answers, revision: 1, updatedAt: new Date().toISOString(), needsReview: false }; feedback.set(v.editToken, f); row.feedbackVersion++; row.revision++; row.memoryActive = false; return dto(f); }
    const v = feedbackEditSchema.parse(raw); if (!old || v.payload.outingRevision !== actualVersion || old.revision !== v.revision && old.lastRequestId !== v.requestId) throw Error('Feedback changed. Reload.'); if (old.lastRequestId === v.requestId) return dto(old); const f = { ...old, actualVersion, answers: v.payload.answers, revision: old.revision + 1, lastRequestId: v.requestId, updatedAt: new Date().toISOString() }; feedback.set(auth, f); row.feedbackVersion++; row.revision++; row.memoryActive = false; return dto(f);
  };
  function next(): PlaceResults {
    const memories: GroupMemory[] = row?.memoryActive && row.approvedTakeaway ? [{ sourceUrl: row.sameListing ? ballotSourceUrl(row.original.option) : null, date: row.actual.date!, takeaway: row.approvedTakeaway, sentiment: feedbackSentiment([...feedback.values()].filter(f => f.actualVersion === actualVersion).map(f => f.answers)) }] : [];
    const f = demoPlaces(demoPlaceQuery, new Date().toISOString()); if (!('area' in f)) throw Error('Invalid demo area.');
    return { mode: 'demo', retrievedAt: new Date().toISOString(), ...evaluatePlaces(f.candidates, f.area, demoPlaceQuery, demoPlaceSummary(), [], memories) };
  }
  return { owner, guest, next, current };
}
