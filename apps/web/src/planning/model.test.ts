import assert from 'node:assert/strict';
import { test } from 'node:test';
import { examples } from './examples';
import { applyFields, blankFact, editFields, factValue, loadExample, sourceChanged, startManualReview, subjectLabel, updateDraft, validateQuestion } from './model';
import type { FactKind, PlanningFact } from './model';

test('fixtures have valid references and never treat an unknown amount as zero', () => {
  assert.equal(examples.length, 3);
  for (const example of examples) {
    const summary = loadExample(example).review!.summary;
    for (const fact of summary.facts) {
      const result = applyFields(fact, editFields(fact));
      assert.equal(result.ok, true);
      if (result.ok) assert.deepEqual(result.fact, fact);
      for (const id of fact.sourceIds) assert.ok(summary.sources.some((source) => source.id === id));
      if (fact.subject.kind === 'speaker') {
        const subject = fact.subject;
        assert.ok(summary.speakers.some((speaker) => speaker.id === subject.speakerId));
      }
    }
    for (const question of summary.questions) {
      for (const id of question.relatedFactIds) assert.ok(summary.facts.some((fact) => fact.id === id));
    }
  }
  const tentative = examples[1].summary;
  const unknown = tentative.facts.find((fact) => fact.id === 'b-abudget')!;
  assert.equal(unknown.kind === 'budget' && unknown.amount, null);
  assert.match(factValue(unknown), /Amount unknown/);
  const maybe = tentative.facts.find((fact) => fact.id === 'b-time')!;
  assert.equal(maybe.status, 'tentative');
  assert.equal(maybe.kind === 'schedule' && maybe.exactDate, null);
  assert.equal(maybe.kind === 'schedule' && maybe.startTime, null);
  assert.ok(tentative.facts.some((fact) => fact.kind === 'activity' && fact.status === 'proposed'));
});

test('corrected budget uses the latest statement while preserving conflicting source text', () => {
  const summary = examples[2].summary;
  const budget = summary.facts.find((fact) => fact.id === 'c-budget')!;
  assert.equal(budget.kind === 'budget' && budget.amount, 15);
  assert.equal(budget.sourceIds.length, 2);
  assert.ok(summary.facts.filter((fact) => fact.status === 'conflicting').length >= 2);
  assert.ok(summary.questions.some((question) => question.kind === 'conflict' && question.resolution === null));
  assert.ok(summary.questions.some((question) => question.resolution?.includes('correction')));
});

test('loading clones fixtures and reloading resets edits without mutating other examples', () => {
  const state = loadExample(examples[0]);
  state.review!.summary.participants[0].name = 'Corrected name';
  state.review!.summary.facts[0].status = 'conflicting';
  assert.equal(examples[0].summary.participants[0].name, 'Alex');
  assert.equal(loadExample(examples[0]).review!.summary.facts[0].status, 'confirmed');
  assert.equal(loadExample(examples[2]).review!.summary.participants[0].name, 'Maya');
});

test('draft editing/clearing preserves summary edits and flags mismatch; arbitrary text creates nothing', () => {
  let state = loadExample(examples[1]);
  const summary = state.review!.summary;
  assert.equal(sourceChanged(state), false);
  state = updateDraft(state, 'Any arbitrary pasted message.');
  assert.equal(state.review!.summary, summary);
  assert.equal(sourceChanged(state), true);
  state = updateDraft(state, '');
  assert.equal(sourceChanged(state), true);
  state = updateDraft(state, state.review!.sourceDraft);
  assert.equal(sourceChanged(state), false);
  const arbitrary = updateDraft({ draft: '', review: null }, 'Unparsed chat');
  assert.equal(arbitrary.review, null);
  const manual = startManualReview(arbitrary);
  assert.equal(manual.draft, 'Unparsed chat');
  assert.equal(manual.review!.origin, 'manual');
  assert.deepEqual(manual.review!.summary.facts, []);
});

test('rename and speaker remapping change displayed attribution without modifying original quotes', () => {
  const summary = loadExample(examples[1]).review!.summary;
  const fact = summary.facts.find((fact) => fact.id === 'b-sbudget')!;
  const originalQuote = summary.sources[1].text;
  summary.participants[1].name = 'Samuel';
  assert.equal(subjectLabel(fact.subject, summary), 'Samuel');
  summary.speakers[1].participantId = summary.participants[0].id;
  assert.equal(subjectLabel(fact.subject, summary), 'Alex');
  summary.speakers[1].participantId = null;
  assert.equal(subjectLabel(fact.subject, summary), 'Participant unknown');
  assert.equal(summary.sources[1].text, originalQuote);
});

function edited(kind: FactKind, fields: Partial<ReturnType<typeof editFields>>, metadata?: Partial<PlanningFact>) {
  const fact = { ...blankFact(kind, 'manual'), ...metadata } as PlanningFact;
  return applyFields(fact, { ...editFields(fact), ...fields });
}

test('budget validation preserves unknown vs zero, currency, status, strength, and source evidence', () => {
  for (const amount of ['', '0', '19.99']) {
    const result = edited('budget', { amount, currency: ' usd ' }, { status: 'tentative', strength: 'firm', sourceIds: ['source'] });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.fact.kind === 'budget' && result.fact.amount, amount === '' ? null : Number(amount));
      assert.equal(result.fact.kind === 'budget' && result.fact.currency, 'USD');
      assert.equal(result.fact.status, 'tentative');
      assert.equal(result.fact.strength, 'firm');
      assert.deepEqual(result.fact.sourceIds, ['source']);
    }
  }
  for (const amount of ['-1', 'NaN', 'Infinity', '1.234', '1e3', '9007199254740993']) {
    assert.equal(edited('budget', { amount }).ok, false, amount);
  }
  assert.equal(edited('budget', { currency: '$' }).ok, false);
  assert.equal(edited('budget', { currency: 'USDD' }).ok, false);
});

test('schedule validation rejects impossible dates and inverted windows without resolving relative dates', () => {
  for (const fields of [
    { exactDate: '2026-02-30' }, { exactDate: 'Friday' }, { startTime: '25:00' },
    { startTime: '19:00', endTime: '18:00' }, { startTime: '19:00', endTime: '19:00' },
  ]) assert.equal(edited('schedule', fields).ok, false);
  for (const fields of [
    { exactDate: '2028-02-29' }, { startTime: '19:00', endTime: '' },
    { description: 'This Friday, reference unknown', exactDate: '' },
  ]) assert.equal(edited('schedule', fields).ok, true);
});

test('manual activity/preferences and travel limits stay editable; strict travel bound is retained', () => {
  for (const kind of ['activity', 'preference'] as const) {
    const result = edited(kind, { description: '  New idea  ' }, { status: 'proposed', strength: 'flexible' });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal('description' in result.fact && result.fact.description, 'New idea');
  }
  assert.equal(edited('travel', { maxMinutes: '-2' }).ok, false);
  assert.equal(edited('travel', { maxMinutes: '2.5' }).ok, false);
  assert.equal(edited('travel', { maxMinutes: '0' }).ok, true);
  assert.equal(edited('travel', { maxMinutes: '' }).ok, true);
  const strict = examples[1].summary.facts.find((fact) => fact.kind === 'travel')!;
  assert.match(factValue(strict), /Under 20 minutes/);
});

test('an issue needs a question and an explicit answer to be marked resolved', () => {
  assert.ok(validateQuestion('', false, ''));
  assert.ok(validateQuestion('Which Friday?', true, '   '));
  assert.equal(validateQuestion('Which Friday?', false, ''), null);
  assert.equal(validateQuestion('Which Friday?', true, '2026-11-13, confirmed manually'), null);
});
