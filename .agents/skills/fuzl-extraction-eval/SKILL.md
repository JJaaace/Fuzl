---
name: fuzl-extraction-eval
description: Evaluate Fuzl prompt, provider, extraction schema, screenshot transcription or source-validation changes with synthetic fixtures and explicit live-call limits.
---

# Fuzl extraction evaluation

## Workflow

- Inspect the affected provider/contract/validation code and existing tests. Read [AI integration](../../../docs/AI_INTEGRATION.md) for text work or [screenshot workflow](../../../docs/SCREENSHOTS.md) for transcription; consult [Gemini setup](../../../docs/GEMINI_SETUP.md) when provider configuration matters.
- Start with existing synthetic fixtures and mocked responses via `npm test`. Cover missing versus zero budgets, unknown currency, tentative/ambiguous dates, attribution, corrections, conflicts and screenshot overlap as relevant. Keep transcription quality separate from planning-extraction quality.
- Check source quotes/references, visible uncertainty and retained user corrections. Verify malformed output, stale drafts and late responses cannot replace current work or bypass explicit acceptance.
- Diagnose the failing stage, field and rule before changing prompts or validation. Do not weaken validation or silently discard unsupported claims to make an evaluation pass. Keep raw private conversations and credentials out of fixtures, logs and reports.
- Live calls require a task-specific, explicitly authorized request budget. Existing `npm run eval:live` and `npm run eval:screenshots` are opt-in live tools, not offline checks. Use synthetic data, count attempts, stop at the authorized cap or a quota/billing/account blocker, and never retry/fall back to a paid provider automatically.

## Expected result

Fixture/case outcomes and failure patterns, a focused regression check for a demonstrated fix, and offline versus live results clearly separated. Report actual live attempts, latency and usage/cost where available; otherwise label them unmeasured. Evaluation does not authorize provider, billing or unrelated feature changes.
