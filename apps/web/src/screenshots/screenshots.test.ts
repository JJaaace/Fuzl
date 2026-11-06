import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, transcriptDraft, transcriptSources } from '@fuzl/planning';
import type { TranscriptMessage, TranscriptSnapshot } from '@fuzl/planning';
import { sameAnalysisSource } from '../lib/analysis';
import { moveImage, selectionError, selectionKey, readStillCurrent, releaseRemovedUrls, prepareFiles, imageDimensions } from './files';
import type { ScreenshotFile } from './files';
import { readScreenshotImages } from './api';
import { updateDraft } from '../planning/model';
import { examples } from '../planning/examples';
import { loadExample } from '../planning/model';

test('browser limits match file counts, formats and byte totals before preview or upload', () => {
  const png = { type: 'image/png', size: 100 };
  assert.equal(selectionError([png]), null);
  assert.ok(selectionError(Array(6).fill(png)));
  assert.ok(selectionError([{ ...png, type: 'image/heic' }]));
  assert.ok(selectionError([{ ...png, size: MAX_IMAGE_BYTES + 1 }]));
  assert.ok(selectionError(Array(4).fill({ ...png, size: MAX_IMAGE_BYTES })));
  assert.equal(selectionError(Array(3).fill({ ...png, size: MAX_IMAGE_BYTES })), null);
  assert.equal(MAX_TOTAL_IMAGE_BYTES, 3 * MAX_IMAGE_BYTES);
});
test('image order is explicit and every edit, including reorder back, prevents a stale read replacing work', () => {
  const files = [{ id: 'a' }, { id: 'b' }];
  const submitted = { revision: 1, key: selectionKey(files) };
  assert.deepEqual(moveImage(files, 0, 1), [{ id: 'b' }, { id: 'a' }]); assert.deepEqual(files, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(readStillCurrent(submitted, 1, files), true);
  assert.equal(readStillCurrent(submitted, 1, moveImage(files, 0, 1)), false);
  assert.equal(readStillCurrent(submitted, 2, files), false);
  assert.equal(readStillCurrent(submitted, 2, []), false);
});
test('preview URLs are revoked only for removed/replaced files and all on cleanup', () => {
  const files = [{ id: 'a', url: 'blob:a' }, { id: 'b', url: 'blob:b' }] as ScreenshotFile[];
  const revoked: string[] = [];
  releaseRemovedUrls(files, [files[1]], (url) => revoked.push(url)); assert.deepEqual(revoked, ['blob:a']);
  releaseRemovedUrls(files, moveImage(files, 0, 1), (url) => revoked.push(url)); assert.deepEqual(revoked, ['blob:a']);
  releaseRemovedUrls([files[1]], [], (url) => revoked.push(url)); assert.deepEqual(revoked, ['blob:a', 'blob:b']);
});
test('local image preparation inspects dimensions before decode and cleans a partial failure', async (t) => {
  const bytes = await readFile(new URL('../../../../fixtures/screenshots/01-clear.png', import.meta.url));
  const file = new File([bytes], 'synthetic.png', { type: 'image/png' });
  assert.equal(imageDimensions(bytes).width, 680);
  const revoked: string[] = []; let created = 0; let decoded = 0;
  t.mock.method(URL, 'createObjectURL', () => `blob:${++created}`);
  t.mock.method(URL, 'revokeObjectURL', (url: string) => revoked.push(url));
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async () => { decoded += 1; return { close() {} }; } });
  t.after(() => { Reflect.deleteProperty(globalThis, 'createImageBitmap'); });
  await assert.rejects(prepareFiles([file, new File(['broken'], 'bad.png', { type: 'image/png' })], []));
  assert.equal(decoded, 1); assert.deepEqual(revoked, ['blob:1']);
  const huge = new Uint8Array(bytes); new DataView(huge.buffer, huge.byteOffset).setUint32(16, 100000);
  await assert.rejects(prepareFiles([new File([huge], 'huge.png', { type: 'image/png' })], []), /Crop or resize/);
  assert.equal(decoded, 1);
});
test('correcting a linked transcript makes old planning results stale while preserving accepted summary edits', () => {
  const original = loadExample(examples[0]);
  const before = structuredClone(original.review);
  const message: TranscriptMessage = { id: 'm1', screenshotId: 's1', speakerLabel: null, text: 'My budget is unknown.', visibleDateTime: null, uncertainty: 'Name cropped', possibleDuplicateOf: null };
  const draft = transcriptDraft([message]);
  const submitted = { conversation: draft, referenceDate: null };
  const messages = [{ ...message, speakerLabel: 'Sam', text: 'My limit is USD 0.' }];
  const updated = updateDraft({ ...original, draft }, transcriptDraft(messages));
  assert.equal(sameAnalysisSource(submitted, updated.draft, null), false); assert.deepEqual(updated.review, before);
  const snapshot: TranscriptSnapshot = { id: 't1', draft: updated.draft, messages, original: { messages: [message], screenshots: [{ id: 's1', notes: ['Cropped alias'] }] } };
  assert.equal(transcriptSources(snapshot, transcriptDraft(messages))[0].screenshotId, 's1');
  assert.equal(snapshot.original.messages[0].speakerLabel, null);
});
test('screenshot HTTP client validates responses and never substitutes fixture output', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Gemini quota exhausted.' } }, { status: 429 }));
  await assert.rejects(readScreenshotImages({ expectedProvider: 'gemini', images: [{ id: 's1', data: 'YQ==' }] }, new AbortController().signal), /quota exhausted/);
});
