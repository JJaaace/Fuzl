// Opt-in synthetic two-stage evaluation; no private key or raw-content logging.
import { readFile } from 'node:fs/promises';
import { transcriptDraft, analysisResponseSchema, transcriptionResponseSchema } from '@fuzl/planning';
const analyze = process.argv.includes('--analyze-reviewed');
if (!process.argv.includes('--confirm-live')) {
  console.error('No requests made. This sends one synthetic screenshot to Gemini. Add --confirm-live; --analyze-reviewed opts into a separate planning request after fixture review. Check project Free Tier/quota first.');
  process.exit(1);
}
const origin = 'http://127.0.0.1:5173';
let calls = 0;
async function post(route, payload) {
  calls += 1;
  const response = await fetch(`${origin}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(55000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.log(JSON.stringify({ phase: route === '/api/transcribe' ? 'read' : 'analyze', status: response.status, errorCode: body?.error?.code ?? 'local_http_failure', reference: body?.error?.reference, backendRequestsAttempted: calls }));
    process.exit(1); // No identical retry, automatic fallback, or further phase.
  }
  return body;
}
try {
  const configuration = await (await fetch(`${origin}/api/ai-config`)).json();
  if (configuration.provider !== 'gemini') throw new Error('Select Gemini deliberately before this evaluation. No provider requests made.');
  const data = (await readFile(new URL('../fixtures/screenshots/01-clear.png', import.meta.url))).toString('base64');
  const started = performance.now();
  const reading = transcriptionResponseSchema.parse(await post('/api/transcribe', { expectedProvider: 'gemini', images: [{ id: 'synthetic-clear', data }] }));
  const expected = [ ['Alex', 'My firm limit is USD 0 per person.'], ['Sam', 'My budget is unknown.'], ['Alex', 'Maybe Friday evening. Nothing booked.'] ];
  const exactReading = reading.messages.length === expected.length && reading.messages.every((message, index) => message.speakerLabel === expected[index][0] && message.text === expected[index][1] && message.visibleDateTime === null);
  console.log(JSON.stringify({ phase: 'read', status: 200, totalMs: Math.round(performance.now() - started), metrics: reading.metrics, messageCount: reading.messages.length, exactSyntheticFixtureMatch: exactReading, backendRequestsAttempted: calls }));
  if (!exactReading) { console.error('Synthetic transcript did not exactly match the fixture. Planning was not requested; inspect safe diagnostics before any additional live call.'); process.exit(1); }
  if (!analyze) process.exit(0);
  // Deliberate second action, only after review against the authored synthetic image.
  // This does not exercise browser acceptance or mark extracted facts reviewed.
  const conversation = transcriptDraft(reading.messages);
  const result = analysisResponseSchema.parse(await post('/api/analyze', { expectedProvider: 'gemini', referenceDate: null, conversation }));
  const facts = result.summary.facts;
  const who = (fact) => fact.subject.kind === 'speaker' ? result.summary.speakers.find((speaker) => speaker.id === fact.subject.speakerId)?.label : fact.subject.kind === 'participant' ? result.summary.participants.find((person) => person.id === fact.subject.participantId)?.name : null;
  const checks = {
    knownZeroBudget: facts.some((fact) => fact.kind === 'budget' && fact.amount === 0 && fact.currency === 'USD' && who(fact) === 'Alex'),
    unknownBudget: facts.some((fact) => fact.kind === 'budget' && fact.amount === null && fact.currency === null && who(fact) === 'Sam'),
    tentativeAvailability: facts.some((fact) => fact.kind === 'schedule' && fact.status === 'tentative' && fact.exactDate === null),
    allUnreviewed: facts.every((fact) => fact.extraction?.reviewed === false),
    noConfirmed: facts.every((fact) => fact.status !== 'confirmed'),
    exactSources: result.summary.sources.every((source) => conversation.includes(source.text)),
  };
  console.log(JSON.stringify({ phase: 'analyze', status: 200, metrics: result.metrics, checks, passed: Object.values(checks).every(Boolean), factCount: facts.length, warningCount: result.warnings.length, backendRequestsAttempted: calls }));
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ error: 'Synthetic evaluation stopped. Check the API terminal using any reported reference. No automatic retry or raw-content logging.', backendRequestsAttempted: calls }));
  process.exitCode = 1;
}
