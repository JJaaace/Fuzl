import { evaluationCases } from './cases.js';
import { ensureAIConfigured, extractConversation } from './provider.js';
import { getAIConfiguration } from './configuration.js';
import { ExtractionError } from './errors.js';

// Explicit opt-in only. npm test never calls a provider or reads credentials.
try { ensureAIConfigured(); } catch (error) {
  console.error(`Live evaluation blocked: ${error instanceof ExtractionError ? error.message : 'Check backend provider configuration.'} No requests were made.`);
  process.exit(1);
}
const configuration = getAIConfiguration();
const caseOption = process.argv.find((argument) => argument.startsWith('--case='));
const cases = caseOption ? evaluationCases.filter((item) => item.id === caseOption.slice(7)) : evaluationCases;
if (cases.length === 0) {
  console.error('Unknown synthetic case. Use --case=zero-budget for one test. No requests were made.');
  process.exit(1);
}
if (!process.argv.includes('--confirm-live-eval') && !process.argv.includes('--confirm-paid-eval')) {
  console.error(`Live evaluation would send ${cases.length} synthetic case(s) to ${configuration.provider} (${configuration.model}). Verify the project tier/quotas or budget first, then opt in with --confirm-live-eval. No requests were made.`);
  process.exit(1);
}
let passed = 0;
let totalEstimatedCost = 0;
let completeEstimate = true;
let attempted = 0;
for (const item of cases) {
  attempted += 1;
  try {
    const result = await extractConversation(item.request, AbortSignal.timeout(45000));
    const ok = item.check(result.summary);
    if (ok) passed += 1;
    if (result.metrics.estimatedCostUsd === null) completeEstimate = false;
    else totalEstimatedCost += result.metrics.estimatedCostUsd;
    console.log(JSON.stringify({ case: item.id, passed: ok, ...result.metrics }));
  } catch (error) {
    completeEstimate = false;
    console.log(JSON.stringify({ case: item.id, provider: configuration.provider, passed: false, error: error instanceof ExtractionError ? error.code : 'provider_failure' }));
    if (error instanceof ExtractionError && (error.status === 429 || error.status === 503)) break;
  }
}
console.log(JSON.stringify({ passed, attempted, total: cases.length, totalEstimatedCostUsd: completeEstimate ? totalEstimatedCost : null, note: 'Automated checks only. Gemini billing tier and failed-call cost are not known; no free-usage guarantee.' }));
if (passed !== cases.length) process.exitCode = 1;
