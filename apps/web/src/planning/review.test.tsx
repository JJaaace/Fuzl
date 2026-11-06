import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import SummaryReview from './SummaryReview';
import FactEditor from './FactEditor';
import { examples } from './examples';
import AnalysisPanel from './AnalysisPanel';
import App from '../App';

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
  assert.ok(panel.indexOf('sends this draft') < panel.indexOf('<form'));
  assert.match(panel, /sends this draft.*OpenAI/);
  assert.match(panel, /Date of the conversation \(optional reference\)/);
  assert.match(panel, /Analyze conversation/);
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
