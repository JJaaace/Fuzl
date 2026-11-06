# Section 3 integration

Implemented November 6, 2026. Browser and live-provider acceptance remain unverified. Section 2 checkpoint: `f22e040`. The original Section 3 OpenAI work was subsequently committed/pushed as `1b8754f` at Jace's request, before adding optional Gemini. No deployment.

## Provider choice and setup

Explicit backend setting: `AI_PROVIDER=openai` or `AI_PROVIDER=gemini`, one selected provider per request, no fallback. OpenAI remains the compatibility default when the setting is omitted; invalid values fail. Its existing Responses model remains pinned `gpt-5.4-mini-2026-03-17`, reasoning `none`, 6000 output tokens, strict output, no tools/retries. [Model](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Gemini's model, Free Tier/project checks, credential setup, data policy, and one-request test are in [GEMINI_SETUP.md](GEMINI_SETUP.md). Neither model has live quality measurements here.

Backend-only configuration:

```sh
cp apps/api/.env.example apps/api/.env
# Edit privately: AI_PROVIDER=openai, OPENAI_API_KEY=<your key>, AI_ENABLED=true
# Or use Gemini's separate setup guide. Never paste a key into chat.
npm run dev
```

Copy the example only if the real file does not already exist. Set a small development project budget before enabling paid requests; start with USD 1 and inspect the provider's actual spend controls. The in-memory API guard is ten attempts per process, not a persistent monetary cap; restarting resets it. The separate evaluation command is limited to six calls. Neither command creates accounts, changes billing, or claims a hard provider-enforced dollar cap. Keep synthetic inputs during initial verification.

Node loads the optional `.env` from the API workspace for preflight, watch, compiled start, and evaluation. Existing process variables override file values. Restart after changing it. `.env` is ignored; `.env.example` is safe and tracked. Defaults have AI disabled; health/samples/manual entry work without a file. No key was present during implementation; no real provider request was made.

The README describes OpenAI data handling: `store: false`, foreground operation, no previous response/conversation IDs, and no tools. These settings do not promise zero provider retention; account controls were not inspected. [Official data controls](https://developers.openai.com/api/docs/guides/your-data). Gemini is stateless but has a different unpaid-service policy; see its guide before testing.

## Request and validation flow

1. `AnalysisPanel.tsx` reads safe provider/model metadata from `GET /api/ai-config`, then discloses the selected recipient and relevant handling before enabling submission. No key is exposed. The user may provide the conversation's reference date; current time is never substituted.
2. `lib/analysis.ts` sends `POST /api/analyze` through Vite. Body: `{ "conversation": "Sam: Maybe Friday?", "referenceDate": null, "expectedProvider": "gemini" }`. The expected provider is validated before extraction; a changed setting yields 409. Only this explicit action sends pasted text. Health remains unchanged.
3. `app.ts` validates JSON, rejects non-local browser origins, checks configuration, and enforces limits: 6000 UTF-16 characters, 32 KB body, one active request, three/minute, ten/provider attempts per API process. Missing configuration and invalid input do not consume an attempt. Provider failures, timeouts, and cancellations do. This local guard is not public deployment protection or authentication.
4. `provider.ts` dispatches only to the explicitly configured provider. `openai.ts` retains its fixed official endpoint/SDK, `maxRetries: 0`, `store: false`, and strict `zodTextFormat`. `gemini.ts` uses stateless REST with a flat wire schema that converts back before full validation. Both have a 45-second deadline, no tools/retries/fallback, separate untrusted conversation data, and backend-only key headers. Provider exception bodies are neither logged nor returned.
5. `packages/planning/src/contract.ts` validates request/output shapes. The existing editor model lives in that package to share types and validation with compiled Node; its original web import is preserved. Optional provenance is the only model extension. Dependencies added: server-only `openai` and shared `zod`; no new framework or service layer.
6. `validate.ts` checks unique IDs, references, speaker/participant attribution, exact contiguous source quotes against the submitted text, cited numbers/currency, and date/time field validity. Named participants require explicit speaker labels; unlabeled prose can remain unattributed. Unsupported exact dates or times are cleared with warnings. It never resolves Friday using the execution date. A missing reference date produces a question. Supported explicit dates are ISO or common English full dates with a year; other formats require manual correction. Numeric/evidence checks are lexical, not proof that a number means a budget or that an interpretation is true.
7. AI facts carry uncertainty, current/historical/unknown scope, supersession references, and the model-reported status. Server-assigned `reviewed: false` cannot be supplied by the model. Model-reported confirmed facts become proposed candidates; tentative/conflicting status remains visible. All extracted questions remain unresolved until manual action. Shape/source failures reject the response with HTTP 502 and preserve existing work.
8. Results are staged separately, never auto-applied. Choosing Use extracted summary confirms replacement whenever an existing summary is present, protecting applied and unapplied form edits. Draft/reference mismatch disables acceptance. Cancel aborts the fetch and asks the backend to stop; late/superseded responses cannot overwrite work. Applying a fact in the editor marks it reviewed; it does not automatically confirm it. Quotes and original AI uncertainty remain distinguishable from your changes.

Response: `{ summary, warnings, metrics }`. The summary format is unchanged. Metrics add provider and validate its model pairing, successful adapter latency, and available token usage. OpenAI's USD estimate retains standard rates, ignoring cache discounts. Gemini's cost is null because project billing tier cannot be determined; output token totals include reported thought tokens. Estimates are not billing records and failed-call usage may be unavailable. No raw content is written to disk, browser storage, routine logs, or a database.

## Evaluation

`npm test` runs entirely offline. Six synthetic cases in `cases.ts` cover tentative/unknown information, a true zero budget, a later correction, incompatible requirements, ambiguous Friday, and embedded instructions. Hand-authored candidate outputs test deterministic validation/invariants. **Six passing authored candidates do not measure six successful model extractions.** HTTP/SDK tests use explicitly mocked providers; they are never wired into the live app as fallback output.

After configuring credentials and reviewing budget:

```sh
npm run eval:live -- --confirm-live-eval --case=zero-budget
```

This explicitly sends one synthetic case to the selected provider. Omit the case option to run all six sequentially without retries. The legacy `--confirm-paid-eval` flag is still accepted. Without opt-in/key/enabling it exits before requests, and quota/access failures stop the run. JSON reports include pass/fail and available metrics, never raw conversation, output, or key. Gemini aggregate cost remains null. These checks are not comprehensive semantic evaluation or proof of free-tier eligibility; inspect extraction in the editor too.

Latest live result: Gemini credentials are now configured privately and exactly one synthetic extraction was attempted. Fuzl returned HTTP 502 / `invalid_output` after 2081 ms; no summary was accepted, and no retry or fallback ran. This verifies neither successful extraction nor semantic quality. Provider tokens/cost were unavailable because the result was rejected. Earlier missing-key results are historical. See PROGRESS for the security audit and offline checks.

## Manual browser acceptance — unverified

1. At desktop and 320px width, load each sample. Confirm labels, wrapped text, no horizontal overflow, keyboard focus/labels/disclosures, and normal health behavior. Repeat Section 2 edits, unknown/zero budgets, speaker remapping, tentative/conflicting status, date/time validation, manual entry, and reload clearing.
2. Without configuration, Analyze should show a useful configuration error and retain the sample/manual summary. No fake analysis result should appear. Then configure the backend key privately and restart; confirm the disclosure precedes the Analyze button and sample data is still labeled separately.
3. Analyze the original Foundation sample. Inspect tentative Sam, unknown Alex/Jordan budgets and currency, unresolved Friday, proposed/unbooked bowling, source quotes, and travel strictly under 20. Confirm all AI facts are unreviewed and no AI-reported confirmation becomes user confirmation.
4. While a request runs, edit the draft/reference date: a mismatch warning must appear and the stale result must not be usable. Cancel and immediately retry; late responses must not change the new request's state. Double submission must not create duplicate requests. Edit existing summary fields while analysis runs: results must stage separately, and declining replacement must retain both applied and unapplied edits.
5. Accept a current result, inspect provenance/scope/source text, edit and apply a fact, and confirm it changes to Reviewed by you. Source text stays unchanged. Historical corrected values must not be mistaken for current limits. Edit the source afterward and confirm its mismatch warning.
6. With developer tools, test empty/oversized input, the 3/minute/10-attempt limits, stopped API, provider quota/access error, refusal, invalid output, timeout, cancellation, and recovery. Some failures need a controlled test provider/account; do not manufacture passing results. All must preserve existing work and avoid fixture fallback/retry loops.
7. Confirm only Analyze POSTs the draft/reference date; all other editing stays local. The key must never appear in frontend assets, requests, responses, logs, or storage. Verify no app browser persistence is created; reload clears planning data. Test embedded-instruction text only with synthetic examples, and inspect that it neither creates invented facts nor alters extraction rules.

Section 4 has not started. No screenshot, account, guest-link, venue, recommendation, memory, or native feature is included.
