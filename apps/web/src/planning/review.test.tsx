import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import SummaryReview from './SummaryReview';
import FactEditor from './FactEditor';
import { examples } from './examples';
import AnalysisPanel from './AnalysisPanel';
import App from '../App';
import { supportingSummary } from '@fuzl/planning';
import { validateLoadedSession } from '../accounts/api';
import { summaryNextStep } from './summaryNextStep';

// Static rendering verifies labels/content, not browser interaction or layout.
test('all three reviews render with explicit status, provenance, mapping, and manual controls', () => {
  for (const example of examples) {
    const html = renderToStaticMarkup(<SummaryReview summary={example.summary} onChange={() => {}} />);
    for (const text of ['Participants &amp; speaker mappings', 'Planning facts', 'Add information', 'Add participant', 'Supporting sample text', 'Edit fact', 'Missing answers &amp; conflicts']) {
      assert.ok(html.includes(text), `${example.id}: ${text}`);
    }
    assert.ok(html.includes('Speaker “'));
  }
  const tentative = renderToStaticMarkup(<SummaryReview summary={examples[1].summary} onChange={() => {}} />);
  assert.match(tentative, /Amount unknown/);
  assert.match(tentative, /Exact date unknown/);
  assert.match(tentative, />tentative</);
  const conflicts = renderToStaticMarkup(<SummaryReview summary={examples[2].summary} onChange={() => {}} />);
  assert.match(conflicts, /status-conflicting/);
  assert.match(conflicts, /Resolved manually/);
});

test('fact forms expose labeled editable values and explicit unknown/firm/status controls', () => {
  for (const fact of examples[1].summary.facts) {
    const html = renderToStaticMarkup(<FactEditor fact={fact} summary={examples[1].summary} onApply={() => {}} onCancel={() => {}} />);
    for (const text of ['Applies to', 'Fact status', 'Firm or flexible', 'Blank values mean unknown', 'Apply changes', 'Cancel']) assert.ok(html.includes(text));
    if (fact.kind === 'budget' && fact.amount === null) assert.ok(html.includes('value=""'));
  }
});

test('analysis disclosure precedes submission, reference date is optional, and samples stay distinct', () => {
  const panel = renderToStaticMarkup(<AnalysisPanel draft="Sam: Maybe Friday" onAccept={() => {}} />);
  const disclosureIndex = panel.toLowerCase().indexOf('sends this draft');
  assert.ok(disclosureIndex >= 0 && panel.includes('Privacy &amp; provider details') && panel.includes('aria-describedby="analysis-disclosure"'));
  assert.match(panel, /sends this draft.*the configured AI provider/i);
  assert.match(panel, /Date of the conversation \(optional reference\)/);
  assert.match(panel, /Make the plan/);
  assert.match(panel, /6000 characters/);
  const app = renderToStaticMarkup(<App />);
  assert.ok(app.includes('manually authored summary, not AI analysis'));
  assert.ok(!app.includes('Not sent or saved'));
});

test('AI provenance renders unreviewed claims, historical scope, and submitted quotes', () => {
  const summary = structuredClone(examples[0].summary);
  summary.facts[0].status = 'proposed';
  summary.facts[0].extraction = { reviewed: false, reportedStatus: 'confirmed', uncertainty: 'Could refer to an earlier plan.', scope: 'historical', supersedes: [] };
  const html = renderToStaticMarkup(<SummaryReview summary={summary} sourceKind="ai" onChange={() => {}} />);
  assert.match(html, /AI claim — unreviewed/);
  assert.match(html, /historical/);
  assert.match(html, /Supporting submitted text/);
});

test('a validated synthetic saved payload uses the same review layout without losing unknowns, excerpts or save/share entry', () => {
  // Component/content check only, not a hosted sign-in/save/reopen observation.
  const saved = validateLoadedSession({ id: 'synthetic-saved', groupId: 'synthetic-group', title: 'Saved Friday fixture', revision: 3,
    createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-02T12:00:00Z',
    payload: { title: 'Saved Friday fixture', origin: 'sample', summaryVersion: 1, summary: supportingSummary(structuredClone(examples[1].summary)), provenance: [] },
  });
  const before = JSON.stringify(saved.payload);
  const html = renderToStaticMarkup(<SummaryReview summary={saved.payload.summary} sourceKind={saved.payload.origin} provenance={saved.payload.provenance} onChange={() => {}} saveAction={{ label: 'Save & sharing', onClick() {} }}/>);
  for (const text of ['Bowling', 'People', 'Suggest a plan', 'Review the date', 'Save &amp; sharing', 'Which Friday works for everyone?', 'Tentative', 'Amount unknown', 'Supporting sample text']) assert.ok(html.includes(text), text);
  assert.equal(JSON.stringify(saved.payload), before);
});

test('next action ignores superseded evidence, treats zero as known, and never manufactures missing dates or activities', () => {
  const summary = structuredClone(examples[0].summary);
  summary.facts = summary.facts.map(fact => fact.kind === 'budget' ? { ...fact, amount: 0 } : fact);
  assert.equal(summaryNextStep(summary).kind, 'save', 'zero is a known amount');
  summary.facts.unshift({ id: 'old-date', kind: 'schedule', subject: {kind:'group'}, description: 'Old unresolved date', exactDate: null, startTime: null, endTime: null, status: 'proposed', strength: 'unknown', sourceIds: ['a1'], extraction: { reviewed: true, scope: 'historical', reportedStatus: 'tentative', uncertainty: 'Superseded', supersedes: [] } });
  assert.equal(summaryNextStep(summary).kind, 'save', 'old availability cannot drive the current shortcut');
  summary.facts = summary.facts.filter(fact => fact.kind !== 'schedule');
  assert.deepEqual(summaryNextStep(summary), {kind:'add',factKind:'schedule',label:'Add availability',hint:'Date and time are unknown. Add only what you know.'});
  const unknownActivity = structuredClone(examples[0].summary); const activity = unknownActivity.facts.find(fact => fact.kind === 'activity')!;
  if (activity.kind === 'activity') activity.description = null;
  const next = summaryNextStep(unknownActivity); assert.equal(next.kind, 'fact'); assert.equal(next.label, 'Review the activity');
});

test('a disjoint confirmed firm window leads to availability review without relabeling a known date as unknown',async()=>{
  const {availabilityHeading,overviewQuestion}=await import('./planPresentation');const summary=structuredClone(examples[0].summary);
  const timing=summary.facts.find(f=>f.id==='s-date');if(timing?.kind==='schedule'){timing.startTime='21:00';timing.endTime='22:00';}
  assert.equal(availabilityHeading(summary),'Confirmed availability does not overlap');assert.match(overviewQuestion(summary).text,/does not overlap/);
  assert.equal(summaryNextStep(summary).label,'Review availability');assert.equal(timing?.status,'confirmed');assert.equal(summary.questions.length,0);
});

test('source-linked, complete extraction facts lead to planning tools without requiring per-card approval',()=>{
  const summary=structuredClone(examples[0].summary);for(const f of summary.facts){f.extraction={reviewed:false,reportedStatus:f.status,scope:'current',uncertainty:'Synthetic source-validated claim',supersedes:[]};if(f.status==='confirmed')f.status='proposed';}
  const before=JSON.stringify(summary);assert.equal(summaryNextStep(summary).kind,'tools');assert.equal(JSON.stringify(summary),before);
  const date=summary.facts.find(f=>f.kind==='schedule');if(date?.kind==='schedule')date.exactDate=null;for(const f of summary.facts)if(f.kind==='schedule')f.exactDate=null;
  assert.equal(summaryNextStep(summary).label,'Review the date');
});
