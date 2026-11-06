# Section 3 integration

Implemented November 6, 2026. One complete Gemini synthetic extraction passed through the API; browser acceptance and OpenAI live verification remain unverified. Section 2 checkpoint: `f22e040`. The original Section 3 OpenAI work was subsequently committed/pushed as `1b8754f`, and the Gemini option as `0f15422`, at Jace's request. The current diagnosis changes remain local. No deployment.

## Provider choice and setup

Explicit backend setting: `AI_PROVIDER=openai` or `AI_PROVIDER=gemini`, one selected provider per request, no fallback. OpenAI remains the compatibility default when the setting is omitted; invalid values fail. Its existing Responses model remains pinned `gpt-5.4-mini-2026-03-17`, reasoning `none`, 6000 output tokens, strict output, no tools/retries. [Model](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Gemini's model, Free Tier/project checks, credential setup, data policy, and one-request test are in [GEMINI_SETUP.md](GEMINI_SETUP.md). A single passing Gemini case is not a broad quality measurement.

Backend-only configuration:

```sh
cp apps/api/.env.example apps/api/.env
# Edit privately: AI_PROVIDER=openai, OPENAI_API_KEY=<your key>, AI_ENABLED=true
# Or use Gemini's separate setup guide. Never paste a key into chat.
npm run dev
```

Copy the example only if the real file does not already exist. Set a small development project budget before enabling paid requests; start with USD 1 and inspect the provider's actual spend controls. The in-memory API guard is ten attempts per process, not a persistent monetary cap; restarting resets it. The separate evaluation command is limited to six calls. Neither command creates accounts, changes billing, or claims a hard provider-enforced dollar cap. Keep synthetic inputs during initial verification.

Node loads the optional `.env` from the API workspace for preflight, watch, compiled start, and evaluation. Existing process variables override file values. Restart after changing it. `.env` is ignored; `.env.example` is safe and tracked. Defaults have AI disabled; health/samples/manual entry work without a file. No key was present during the original OpenAI implementation. The user subsequently configured Gemini privately; actual live results are recorded below.

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

Live history: earlier requests failed with `invalid_output` (2081 ms) and generic `provider_failure` (1701 ms); their exact causes were not retained. The earlier kind-specific wire-schema fix was demonstrated offline, not proven to explain those requests.

The current diagnostic run used **2 of at most 3 authorized live requests**, both synthetic. Request 1 reached source validation and failed `speakers[0].label` / `speaker_not_in_source` (HTTP 502, 1672 ms). Thus this attempt reached Google successfully and passed envelope/JSON/wire checks; it was not a connectivity failure. Generation previously allowed arbitrary speaker strings. Its request-specific schema now limits speaker labels and named participants to explicit prefixes from the submitted draft, with Unknown only for unlabeled content. The validator is unchanged; invalid claims still fail without repair or silent deletion. This lexical constraint is not a second extraction system. Drafts with over 20 distinct labeled speakers fail before a provider request.

Request 2 completed extraction (HTTP 200, 1531 ms total / 1497 ms adapter time, 713 input / 168 output tokens). The one fact preserved USD 0, cited an exact source, and stayed unreviewed; none was confirmed. Cost is null and project tier unknown. No third request, minimal probe, automatic retry, fallback, billing change, or bulk evaluation ran. All 93 offline tests pass, including separate HTTP/network/timeout/cancellation/parsing/adapter failures, source-label constraints, and server-only diagnostic privacy. Type checking, linting, build, and health checks pass. See PROGRESS for the historical distinction and remaining limitations.

## Safe failure diagnostics

`provider-diagnostics.ts` classifies provider HTTP, network/TLS, timeout/cancellation, response parsing, validation, and unexpected adapter failures. HTTP diagnostics retain upstream status, a recognized provider code, and a fixed interpretation of recognized technical messages. Unknown free-form provider text is withheld because it may echo private content. Transport diagnostics allowlist technical codes; unexpected errors retain only exception type and local adapter filename/line frames, never raw messages, URLs, or full stacks. The API's own deadline also receives an explicit timeout category.

The API logs a JSON `analysis_failure` with a random reference and these safe details. Validation diagnostics contain stage, schema-owned field path, and rule, never input values or raw Zod messages. UI responses contain only a useful controlled message, code, and matching reference. The client displays that reference; detailed diagnostics stay in the API terminal. No request/response bodies, conversations, authorization headers, keys, or credential-bearing URLs are logged. Existing summary replacement, unreviewed labels, manual corrections, and stale-result controls are unchanged.

## Manual browser acceptance — unverified

1. At desktop and 320px width, load each sample. Confirm labels, wrapped text, no horizontal overflow, keyboard focus/labels/disclosures, and normal health behavior. Repeat Section 2 edits, unknown/zero budgets, speaker remapping, tentative/conflicting status, date/time validation, manual entry, and reload clearing.
2. Without configuration, Analyze should show a useful configuration error and retain the sample/manual summary. No fake analysis result should appear. Then configure the backend key privately and restart; confirm the disclosure precedes the Analyze button and sample data is still labeled separately.
3. Analyze the original Foundation sample. Inspect tentative Sam, unknown Alex/Jordan budgets and currency, unresolved Friday, proposed/unbooked bowling, source quotes, and travel strictly under 20. Confirm all AI facts are unreviewed and no AI-reported confirmation becomes user confirmation.
4. While a request runs, edit the draft/reference date: a mismatch warning must appear and the stale result must not be usable. Cancel and immediately retry; late responses must not change the new request's state. Double submission must not create duplicate requests. Edit existing summary fields while analysis runs: results must stage separately, and declining replacement must retain both applied and unapplied edits.
5. Accept a current result, inspect provenance/scope/source text, edit and apply a fact, and confirm it changes to Reviewed by you. Source text stays unchanged. Historical corrected values must not be mistaken for current limits. Edit the source afterward and confirm its mismatch warning.
6. With developer tools, test empty/oversized input, the 3/minute/10-attempt limits, stopped API, provider quota/access error, refusal, invalid output, timeout, cancellation, and recovery. Some failures need a controlled test provider/account; do not manufacture passing results. All must preserve existing work and avoid fixture fallback/retry loops.
7. Confirm only Analyze POSTs the draft/reference date; all other editing stays local. The key must never appear in frontend assets, requests, responses, logs, or storage. Verify no app browser persistence is created; reload clears planning data. Test embedded-instruction text only with synthetic examples, and inspect that it neither creates invented facts nor alters extraction rules.

Section 4 has not started. No screenshot, account, guest-link, venue, recommendation, memory, or native feature is included.
