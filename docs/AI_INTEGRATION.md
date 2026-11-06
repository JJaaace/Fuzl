# Section 3 integration

Implemented November 6, 2026. Browser and live-provider acceptance remain unverified. Section 2 checkpoint: `f22e040` (already committed on entry; no duplicate/empty commit, push, or deployment).

## Provider choice and setup

One provider/adapter: OpenAI Responses, pinned `gpt-5.4-mini-2026-03-17`, reasoning effort `none`, maximum 6000 output tokens. It offers a documented structured-output interface and moderate token cost without needing external tools. Selection is provisional until measured on these extraction cases; no quality superiority claim is made. The model page was checked for current availability, snapshot, features, and pricing. Older GPT-4.1 mini was considered but its official page marks it deprecated. [Model](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Backend-only configuration:

```sh
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env locally: OPENAI_API_KEY=<your key>, AI_ENABLED=true
npm run dev
```

Copy the example only if the real file does not already exist. Set a small development project budget before enabling paid requests; start with USD 1 and inspect the provider's actual spend controls. The in-memory API guard is ten attempts per process, not a persistent monetary cap; restarting resets it. The separate evaluation command is limited to six calls. Neither command creates accounts, changes billing, or claims a hard provider-enforced dollar cap. Keep synthetic inputs during initial verification.

Node loads the optional `.env` from the API workspace for preflight, watch, compiled start, and evaluation. Existing process variables override file values. Restart after changing it. `.env` is ignored; `.env.example` is safe and tracked. Defaults have AI disabled; health/samples/manual entry work without a file. No key was present during implementation; no real provider request was made.

The README describes provider data handling. `store: false`, foreground operation, no previous response/conversation IDs, and no tools reduce application-state storage. These settings are not a promise of zero provider retention. Account-specific controls were not inspected. [Official data controls](https://developers.openai.com/api/docs/guides/your-data).

## Request and validation flow

1. `AnalysisPanel.tsx` discloses transmission before submission. The user may provide the conversation's reference date; current execution time is never supplied as a substitute.
2. `lib/analysis.ts` sends `POST /api/analyze` through Vite. Body: `{ "conversation": "Sam: Maybe Friday?", "referenceDate": null }`. Only this explicit action sends pasted text. Health remains unchanged.
3. `app.ts` validates JSON, rejects non-local browser origins, checks configuration, and enforces limits: 6000 UTF-16 characters, 32 KB body, one active request, three/minute, ten/provider attempts per API process. Missing configuration and invalid input do not consume an attempt. Provider failures, timeouts, and cancellations do. This local guard is not public deployment protection or authentication.
4. `provider.ts` calls only the fixed official OpenAI endpoint using the server-side SDK/key. `maxRetries: 0`, a 45-second deadline, no tools, and strict `zodTextFormat` bound the operation. Conversation text is a separate untrusted user-data envelope; developer instructions explicitly prohibit following embedded commands. The key is an authorization header, never prompt content. Provider exception bodies are neither logged nor returned.
5. `packages/planning/src/contract.ts` validates request/output shapes. The existing editor model lives in that package to share types and validation with compiled Node; its original web import is preserved. Optional provenance is the only model extension. Dependencies added: server-only `openai` and shared `zod`; no new framework or service layer.
6. `validate.ts` checks unique IDs, references, speaker/participant attribution, exact contiguous source quotes against the submitted text, cited numbers/currency, and date/time field validity. Named participants require explicit speaker labels; unlabeled prose can remain unattributed. Unsupported exact dates or times are cleared with warnings. It never resolves Friday using the execution date. A missing reference date produces a question. Supported explicit dates are ISO or common English full dates with a year; other formats require manual correction. Numeric/evidence checks are lexical, not proof that a number means a budget or that an interpretation is true.
7. AI facts carry uncertainty, current/historical/unknown scope, supersession references, and the model-reported status. Server-assigned `reviewed: false` cannot be supplied by the model. Model-reported confirmed facts become proposed candidates; tentative/conflicting status remains visible. All extracted questions remain unresolved until manual action. Shape/source failures reject the response with HTTP 502 and preserve existing work.
8. Results are staged separately, never auto-applied. Choosing Use extracted summary confirms replacement whenever an existing summary is present, protecting applied and unapplied form edits. Draft/reference mismatch disables acceptance. Cancel aborts the fetch and asks the backend to stop; late/superseded responses cannot overwrite work. Applying a fact in the editor marks it reviewed; it does not automatically confirm it. Quotes and original AI uncertainty remain distinguishable from your changes.

Response: `{ summary, warnings, metrics }`. Metrics include the pinned model, successful adapter latency, input/output tokens when provided, and an estimated USD token cost. Estimation uses standard model rates and ignores cached-input discounts; it is not a billing record and cannot account for unavailable failed/cancelled-call usage. No raw text or results are written to disk, browser storage, routine logs, or a database.

## Evaluation

`npm test` runs entirely offline. Six synthetic cases in `cases.ts` cover tentative/unknown information, a true zero budget, a later correction, incompatible requirements, ambiguous Friday, and embedded instructions. Hand-authored candidate outputs test deterministic validation/invariants. **Six passing authored candidates do not measure six successful model extractions.** HTTP/SDK tests use explicitly mocked providers; they are never wired into the live app as fallback output.

After configuring credentials and reviewing budget:

```sh
npm run eval:live -- --confirm-paid-eval
```

This explicitly sends six synthetic cases, sequentially, with no retries. Without the flag/key/enabling setting, it exits before requests. Output is one JSON line per case with pass/fail and available latency/token/cost metrics; no raw conversation, model response, or key is logged. The invariant checks are a narrow screen, not comprehensive semantic evaluation. Inspect actual extracted source attribution, tentative statements, omissions, corrections, conflicts, and date uncertainty in the editor as well. Do not claim accuracy percentages from this small set.

Actual live result in this environment: **blocked by missing key and disabled AI; zero requests sent.** Live latency, tokens, cost, semantic extraction quality, and injection resistance are not measured. See PROGRESS for offline results.

## Manual browser acceptance — unverified

1. At desktop and 320px width, load each sample. Confirm labels, wrapped text, no horizontal overflow, keyboard focus/labels/disclosures, and normal health behavior. Repeat Section 2 edits, unknown/zero budgets, speaker remapping, tentative/conflicting status, date/time validation, manual entry, and reload clearing.
2. Without configuration, Analyze should show a useful configuration error and retain the sample/manual summary. No fake analysis result should appear. Then configure the backend key privately and restart; confirm the disclosure precedes the Analyze button and sample data is still labeled separately.
3. Analyze the original Foundation sample. Inspect tentative Sam, unknown Alex/Jordan budgets and currency, unresolved Friday, proposed/unbooked bowling, source quotes, and travel strictly under 20. Confirm all AI facts are unreviewed and no AI-reported confirmation becomes user confirmation.
4. While a request runs, edit the draft/reference date: a mismatch warning must appear and the stale result must not be usable. Cancel and immediately retry; late responses must not change the new request's state. Double submission must not create duplicate requests. Edit existing summary fields while analysis runs: results must stage separately, and declining replacement must retain both applied and unapplied edits.
5. Accept a current result, inspect provenance/scope/source text, edit and apply a fact, and confirm it changes to Reviewed by you. Source text stays unchanged. Historical corrected values must not be mistaken for current limits. Edit the source afterward and confirm its mismatch warning.
6. With developer tools, test empty/oversized input, the 3/minute/10-attempt limits, stopped API, provider quota/access error, refusal, invalid output, timeout, cancellation, and recovery. Some failures need a controlled test provider/account; do not manufacture passing results. All must preserve existing work and avoid fixture fallback/retry loops.
7. Confirm only Analyze POSTs the draft/reference date; all other editing stays local. The key must never appear in frontend assets, requests, responses, logs, or storage. Verify no app browser persistence is created; reload clears planning data. Test embedded-instruction text only with synthetic examples, and inspect that it neither creates invented facts nor alters extraction rules.

Section 4 has not started. No screenshot, account, guest-link, venue, recommendation, memory, or native feature is included.
