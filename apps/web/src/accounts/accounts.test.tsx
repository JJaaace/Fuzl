import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import SavedSource from './SavedSource';
import SaveSession from './SaveSession';
import SavedGroups from './SavedGroups';
import { emptySummary } from '@fuzl/planning';
test('saving requires sign-in; temporary workspace and supported excerpts are explained without fake auth', () => {
  const html = renderToStaticMarkup(<SaveSession input={{ title: 'Test', summaryVersion: 1, summary: emptySummary(), provenance: [], origin: 'manual' }} loaded={null} onSaved={() => {}} onOpen={() => {}} onSignIn={() => {}} />);
  assert.ok(html.includes('Sign in to save session')); assert.ok(html.includes('supporting message excerpts')); assert.ok(html.includes('entire conversation are not saved'));
  const signIn = renderToStaticMarkup(<SavedGroups onOpen={() => {}} onWorkspace={() => {}} />);
  assert.ok(signIn.includes('Email') && signIn.includes('Send sign-in link') && signIn.includes('uploads no draft'));
  assert.ok(!signIn.includes('one-time-code') && !signIn.includes('Verify code'));
});
test('saved image provenance preserves correction text without broken image links', () => {
  const html = renderToStaticMarkup(<SavedSource sourceId="q1" provenance={[{ sourceId: 'q1', entries: [{ screenshotId: 's1', originalSpeaker: null, reviewedSpeaker: 'Alex', originalVisibleDateTime: null, reviewedVisibleDateTime: null, originalText: 'Read text', reviewedText: 'Corrected text', uncertainty: 'Cropped speaker' }] }]} />);
  assert.ok(html.includes('Organizer corrected') && html.includes('Original reading') && html.includes('was not saved'));
  assert.ok(!html.includes('<img') && !html.includes('href='));
});
