import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import SummaryReview from './SummaryReview';
import FactEditor from './FactEditor';
import { examples } from './examples';

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
