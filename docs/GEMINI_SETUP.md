# Gemini option within Section 3

Checked November 6, 2026. The prior OpenAI implementation was committed and pushed as `1b8754f` before this optional provider was added. The Gemini option was subsequently committed/pushed as `0f15422`; current diagnostics and fixes remain local and have not been pushed. No billing, deployment, or Section 4 work was performed.

## Model and Free Tier checks

Fuzl uses stable **`gemini-3.5-flash-lite`** for Gemini. Google documents structured output and Free Tier input/output for it. Its model alias can evolve; one synthetic extraction has passed, without a broad quality evaluation. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [standard pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey), sign in, and choose **Create API key / Get API key**. Create/select the project deliberately; an existing Cloud account may need to import a project. The key belongs to that project. Keep it private. [Official key instructions](https://ai.google.dev/gemini-api/docs/api-key).
2. Open [Projects](https://aistudio.google.com/projects). Check the selected project's **Billing Tier** is **Free**, and check the associated key points to that same project. A **Set up billing** action indicates no linked billing account; leave it unselected. Avoid Paid/Tier 1+ projects, prepay, or billing upgrades for this test. A free AI Studio page alone does not establish that a particular API key uses free quota. Fuzl cannot inspect your project's tier. [Billing/tier documentation](https://ai.google.dev/gemini-api/docs/billing).
3. If **Verification needed** appears, use **Verify project** and Google's device-verification instructions. Some projects/accounts require this to access free quota. A different key in the same project does not bypass verification. Choose the free verification path rather than the billing alternative. Region/account restrictions may still prevent access. [Project verification](https://ai.google.dev/gemini-api/docs/verification).
4. Open [active rate limits](https://aistudio.google.com/rate-limit) for that project. Find `gemini-3.5-flash-lite`; check requests/minute, tokens/minute, and requests/day, including remaining quota. Limits are project-wide, not per key, and capacity can vary. Daily request quota resets at midnight Pacific time. If the model has no free allocation or is unavailable, stop and inspect eligibility; do not enable billing to finish this free test. [Quotas](https://ai.google.dev/gemini-api/docs/rate-limits).

No fixed Google quota is hardcoded or promised. Fuzl's own 1-concurrent / 3-per-minute / 10-per-process attempt limits still apply, and Google may impose lower limits. Switching keys in the same project does not create a new project quota. There is no automatic retry or provider fallback.

## Configure the backend privately

If `apps/api/.env` does not exist, copy `apps/api/.env.example` to it. Edit that local ignored file:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=replace_with_your_key_locally
AI_ENABLED=true
PORT=3001
```

The placeholder above is not a credential. Do not paste the real key into chat or commit it. An OpenAI key is not required when Gemini is selected; any existing OpenAI key can stay private in the backend file and is not used by Gemini. Only the selected provider's key is read. Never use frontend or `VITE_` credentials.

Stop the running development command with Ctrl+C, then run from the root:

```sh
npm run dev
```

Node loads `apps/api/.env` for the API only. Exported shell variables override `.env`; remove an old exported AI_PROVIDER if the displayed provider does not match your file. Refresh [Fuzl](http://127.0.0.1:5173/) and confirm **Selected provider: Google Gemini** and the unpaid-service disclosure before submitting. A safe check is:

```sh
curl http://127.0.0.1:3001/api/ai-config
```

Expected metadata only: `{"provider":"gemini","model":"gemini-3.5-flash-lite"}`. A configured name is not proof of valid credentials, free-tier eligibility, or remaining quota. Analyze reports an actionable error if access is unavailable.

To return deliberately to OpenAI, set `AI_PROVIDER=openai` and configure `OPENAI_API_KEY`, then restart. If AI_PROVIDER is omitted, OpenAI remains the compatibility default. Invalid/empty settings fail; errors never switch providers. A changed provider between page load and submission causes HTTP 409 without a provider call; refresh and read the new disclosure.

## Run one synthetic live test

After verifying the project/tier/quota and configuring the backend, run:

```sh
npm run eval:live -- --confirm-live-eval --case=zero-budget
```

This opts into **one** request containing the authored synthetic sentence `Alex: My firm spending limit is USD 0 per person.` It uses only the configured provider and never falls back. The check looks for a known zero budget, distinct from unknown; AI facts still remain unreviewed. The JSON report contains case pass/fail and available model/latency/token metrics, not raw text or credentials. Gemini cost is `null` (unknown), not a claim of $0. It does not verify billing tier or semantic quality comprehensively.

Alternatively, paste that same synthetic sentence in Fuzl, click **Analyze conversation**, inspect the candidate warnings, choose **Use extracted summary**, and review the evidence. This is one additional request if you already ran the CLI test. Do not send real chats to test unpaid Google handling.

Omitting `--case=zero-budget` deliberately evaluates all six synthetic cases. `--confirm-live-eval` is required; the old `--confirm-paid-eval` flag remains accepted for compatibility. Evaluation stops on quota/access failures instead of running through the remaining cases; no automatic retries occur. The CLI is separate from the API's per-process counter and performs at most six calls. Check project quotas before running it.

## Data handling

Google's unpaid-service terms allow submitted content and generated responses to be used for product/model improvement and processed by human reviewers. Google instructs users not to submit personal, sensitive, or confidential information. Use synthetic conversations only. The terms describe different handling for the EEA, Switzerland, and UK; review what applies to your account. Fuzl promises neither zero provider retention nor the OpenAI data policy for Gemini. [Official terms](https://ai.google.dev/gemini-api/terms#unpaid-services).

Fuzl itself still keeps drafts/summaries temporary without database, browser persistence, or raw-text logging. It uses stateless `generateContent`, no uploaded files, tools, caches, or stored conversation resources. These app settings do not change Google's terms or your project tier. [Stateless endpoint guidance](https://ai.google.dev/gemini-api/docs/migrate-to-interactions).

## Adapter and verification

- `configuration.ts` validates AI_PROVIDER and the selected credential; `provider.ts` dispatches once to `openai.ts` or `gemini.ts`. OpenAI's existing model/SDK/privacy settings remain intact.
- Gemini uses the official REST endpoint with the key in `x-goog-api-key`, never the URL, prompt, frontend, or logs. Redirects are rejected. HTTP 429 clearly reports project quota/rate exhaustion; 400/401/403/404, network errors, malformed output, refusal/truncation, and cancellation are handled without raw provider error details or fallback.
- `gemini-schema.ts` flattens nested fact/subject unions for Google's generation grammar. Unsupported or expensive grammar constraints are omitted only from the generation schema. The wire output is converted back and validated by the full existing Zod and source-reference checks. Unknowns, exact quotes, uncertainty, human review, dates, corrections, and stale-result protections are unchanged. Irrelevant non-null wire fields are rejected, not silently discarded. [Structured-output guidance](https://ai.google.dev/gemini-api/docs/structured-output).
- `GET /api/ai-config` exposes provider/model only. The UI waits for it before enabling Analyze; the POST includes expectedProvider. The backend checks that consent still matches its current setting, and the client validates returned provider/model metadata.

### Latest diagnosis and live result

Reviewed the current [GenerateContent reference](https://ai.google.dev/api/generate-content), [structured-output guide](https://ai.google.dev/gemini-api/docs/structured-output), and [troubleshooting reference](https://ai.google.dev/gemini-api/docs/troubleshooting) on November 6, 2026. The model supports structured output. This adapter uses native REST, not a Google SDK: POST `v1beta/models/gemini-3.5-flash-lite:generateContent`, private key header, systemInstruction/contents, and generationConfig with `responseMimeType: application/json`, `responseJsonSchema`, one candidate and 6000 output tokens. The guide documents those schema settings, enum/anyOf, and nulls. The successful request below verifies this precise format for the selected model. No endpoint, SDK, or paid model change was needed.

The original 2081 ms invalid_output response and the later generic provider_failure response were not retained. Their exact causes remain unknown. A prior offline contract defect (budget with travel-only comparison) was fixed, but does not establish the original live cause.

This follow-up used **two synthetic requests of the three authorized**, with no automatic retries:

| Request | Result |
| --- | --- |
| 1: normal extraction, improved diagnostics | HTTP 502 / invalid_output in 1672 ms. Category validation, operation source_validation, stage source_validation, path speakers[0].label, rule speaker_not_in_source. Google returned a successful envelope, JSON, and wire shape. No upstream HTTP error code/message existed for this rejection. The actual label was not retained. |
| 2: targeted schema correction | HTTP 200 in 1531 ms total; adapter latency 1497 ms. 713 input / 168 output tokens, cost null. Complete schema/source-validated extraction of one USD 0 budget, one supporting source, all facts unreviewed, zero confirmed facts, one review warning. |

Generation now constrains speaker labels to the prefixes actually present in the submitted draft. Participant names use those same explicit labels or null; unlabeled text can use Unknown. More than 20 distinct labels causes an input error before sending. The schema enum values are untrusted text, not instructions. This prevents arbitrary attribution during generation without rewriting returned claims or weakening the unchanged source validator. Regression tests reproduce the exact failing source rule with representative invalid labels; the original rejected label itself is unknown.

Failures are separated into provider HTTP, network/TLS, timeout/cancelled, response parsing, validation, and unexpected adapter categories. HTTP server diagnostics retain upstream status, recognized provider status code, and a fixed safe message interpretation; unknown free-form text is withheld. Server logs contain only controlled details and a matching UI error reference. They never include raw exceptions, provider bodies, credentials, headers, URLs, or conversations. API deadline errors remain classified as timeout. Inspect the API terminal's matching analysis_failure reference when diagnosing; never enable raw-body logging.

All **93 offline tests**, type checking, linting, and builds pass. Tests cover provider selection, missing selected credentials, no fallback, HTTP/quota/account errors, transport/TLS codes, timeouts/cancellation, envelope/JSON/truncation, unexpected exceptions, schema conversion, source checks, unknowns, tentative/corrected/conflicting claims, and review/stale-state safeguards. There was no minimal probe, third request, bulk evaluation, paid fallback, billing change, push, or deployment. The key remains in ignored/untracked `.env`, with an empty example placeholder.

Browser discovery returned no connected browser. Rendered flow remains unverified. One passing zero-budget case is not proof of general model reliability, account Free Tier eligibility, exact provider retention, or zero cost.

### Exact browser flow still to check manually

1. Open http://127.0.0.1:5173 and check the selected provider is Google Gemini. Load any sample and make a fact edit without applying it.
2. Replace the draft with `Alex: My firm spending limit is USD 0 per person.` Leave the reference date empty. Read the Google disclosure, then click **Analyze conversation** once. This is an additional live request; do it only deliberately after checking tier/quota.
3. The result must appear as a preview and leave the existing editor untouched. Click **Use extracted summary**, decline the replacement confirmation, and confirm both applied and unapplied edits survive. Click it again and confirm replacement.
4. In the editor, confirm Alex's budget is USD 0 (not unknown), the submitted source line is inspectable, the claim says **AI claim — unreviewed**, and it is not automatically confirmed. Choose **Edit fact**, change the budget, and **Apply changes**; it should say **Reviewed by you**, preserving the original source.
5. Edit the draft or reference date after another deliberate analysis and confirm a stale preview cannot replace newer work. Cancel a running request and confirm late results cannot be applied. Verify at 320px width that preview, acceptance, source text, and editor controls wrap and remain usable. These race/layout checks may require another separately authorized live request; do not consume quota automatically.

Manual checks still needed: selected-provider disclosure on desktop/mobile; disabled analysis if configuration cannot load; private-header behavior via backend-only inspection; broad live source/unknown/tentative/conflict quality; cancellation/draft mismatch; declined replacement preserving edits; quota-error recovery; absence of keys/raw text from frontend/logs/storage. Switch the backend provider after loading the page and confirm submission is rejected before refresh. Reuse the detailed editor checklist in [AI_INTEGRATION.md](AI_INTEGRATION.md).

Stop after this Section 3 option. Section 4 remains unstarted.
