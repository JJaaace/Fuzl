import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ScreenshotPanel from './ScreenshotPanel';
import SourceTrace from './SourceTrace';
import { transcriptDraft } from '@fuzl/planning';
import type { TranscriptSnapshot } from '@fuzl/planning';
test('screenshot controls disclose two deliberate requests and preserve an accessible separate pasted-text workflow', () => {
  const html = renderToStaticMarkup(<ScreenshotPanel onUse={() => false} onTranscriptChange={() => {}} onFilesChange={() => {}} onClear={() => {}} />);
  assert.ok(html.includes('type="file"') && html.includes('multiple=""') && html.includes('accept="image/png,image/jpeg"'));
  assert.ok(html.includes('Read screenshots') && html.includes('separate AI requests'));
  assert.ok(html.includes('Google Gemini') && html.includes('provider-held data'));
  assert.ok(html.includes('5 MiB') && html.includes('15 MiB') && html.includes('4096'));
});
test('source trail distinguishes image-model text, organizer corrections and removed image references', () => {
  const message = { id: 'm1', screenshotId: 's1', speakerLabel: 'Sam', text: 'My limit is USD 0.', visibleDateTime: null, uncertainty: null, possibleDuplicateOf: null };
  const snapshot: TranscriptSnapshot = { id: 't1', messages: [message], draft: transcriptDraft([message]), original: { screenshots: [{ id: 's1', notes: [] }], messages: [{ ...message, speakerLabel: null, uncertainty: 'Cropped speaker' }] } };
  const present = renderToStaticMarkup(<SourceTrace snapshot={snapshot} quote={snapshot.draft} available={['s1']} />);
  assert.ok(present.includes('Organizer corrected') && present.includes('href="#screenshot-s1"') && present.includes('not against the pixels'));
  const removed = renderToStaticMarkup(<SourceTrace snapshot={snapshot} quote={snapshot.draft} available={[]} />);
  assert.ok(removed.includes('Image removed; reference only.'));
});
