import { evaluationCases } from './cases.js';
import { ensureAIConfigured, extractConversation } from './provider.js';

// Explicit opt-in only. npm test never calls a provider or reads credentials.
try { ensureAIConfigured(); } catch {
  console.error('Live evaluation blocked: configure OPENAI_API_KEY and AI_ENABLED=true in apps/api/.env. Review the development budget before enabling paid requests. No requests were made.');
  process.exit(1);
}
if (!process.argv.includes('--confirm-paid-eval')) {
  console.error('Live evaluation sends six synthetic cases to OpenAI and incurs usage. Run npm run eval:live -- --confirm-paid-eval to opt in. No requests were made.');
  process.exit(1);
}
let passed = 0;
let totalEstimatedCost = 0;
for (const item of evaluationCases) {
  try {
    const result = await extractConversation(item.request, AbortSignal.timeout(45000));
    const ok = item.check(result.summary);
    if (ok) passed += 1;
    totalEstimatedCost += result.metrics.estimatedCostUsd ?? 0;
    console.log(JSON.stringify({ case: item.id, passed: ok, ...result.metrics }));
  } catch {
    console.log(JSON.stringify({ case: item.id, passed: false, error: 'Provider request or output validation failed. No raw content logged.' }));
  }
}
console.log(JSON.stringify({ passed, total: evaluationCases.length, totalEstimatedCostUsd: totalEstimatedCost, note: 'Automated checks only; inspect extraction quality separately. Failed-call usage may be unavailable.' }));
if (passed !== evaluationCases.length) process.exitCode = 1;
