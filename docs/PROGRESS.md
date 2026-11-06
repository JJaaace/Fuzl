# Fuzl progress

Updated November 6, 2026. Active authorization: **Section 3 only**. Sections 4–12 remain future context. The supplied specification is preserved unchanged.

## Current Gemini diagnosis — complete extraction succeeded

- Scope: Section 3 only, no push or deployment. Preserved existing local changes, OpenAI selection, strict schema/source validation, temporary state, editor/acceptance controls, unreviewed labels, and stale-result protections. Private environment contents were not printed or changed.
- Before live work, introduced distinct safe provider HTTP, network/TLS, timeout/cancelled, response parsing, validation, and unexpected adapter diagnostics. Server-only structured errors carry category/operation, recognized upstream status/code and safe message interpretation, known transport code or local exception frame, and controlled validation stage/path/rule as applicable. Unknown raw provider text and exception messages are withheld. The UI receives only a useful controlled message/code plus matching error reference. API-owned deadlines also retain timeout classification.
- Reviewed official Google model/structured-output, GenerateContent, and troubleshooting documentation. The existing native REST endpoint and responseMimeType/responseJsonSchema format are supported by gemini-3.5-flash-lite. No Google SDK or endpoint switch was necessary. Nulls, required kind-specific fields, enums, unexpected fields, truncation, and exact quotes remain checked independently after generation. No earlier failure cause was assumed from the previously demonstrated schema mismatch.
- **Live request 1**: normal synthetic zero-budget extraction, HTTP 502 / invalid_output, 1672 ms. Error reference `41d1870e-e760-4b06-9873-b9dc5c952303`. Category validation; operation/stage source_validation; path speakers[0].label; rule speaker_not_in_source. The response reached and passed envelope/JSON/wire checks, so connectivity and model request-format access worked on this attempt. There was no upstream HTTP error code/message. The actual rejected label was not retained; the exact causes of older generic failures remain unknown.
- Demonstrated cause: source validation rejects a generated speaker label absent as a prefix in the input, while the outgoing generation schema previously allowed arbitrary strings. Fixed only the generation constraint: request-specific literal speaker-label enums derive from existing prefixes, names use those labels or null, and Unknown is allowed for unlabeled content. Over 20 labels fails before calling Google. Source-owned enum strings remain untrusted data. Returned claims are still checked without repair or silent deletion. Added regressions for the exact failing rule, non-mutated global schema, unknown attribution, and literal embedded instructions.
- **Live request 2**: targeted fix verification through Vite/API, HTTP 200, 1531 ms total / 1497 ms adapter latency. 713 input tokens / 168 output tokens; estimatedCostUsd null. Complete extraction returned one USD 0 budget with one validated source; all facts unreviewed, zero confirmed, one review warning. Cost and project tier are unknown. **Used 2 of the maximum 3 live requests**. No minimal probe, third request, automatic retry, paid fallback, billing action, or bulk evaluation.
- Offline checks: **93 tests passed**; npm run typecheck, npm run lint, npm run build passed. Added HTTP/status/code privacy, network/TLS, timeout/cancel, malformed JSON, adapter exception, server-only logging, API deadline, safe UI reference, and attribution regressions. Existing OpenAI/provider selection, review/acceptance/state, unknown/tentative/correction/conflict, quote/currency/numeric and stale-source tests still pass. API and Vite-proxied health/config checks return HTTP 200 with expected public metadata. git diff --check passes.
- Browser discovery again returned `[]`. Analyze → preview → acceptance → editable summary, rendered 320px layout, actual confirmation dialogs and race interactions remain **unverified**. Exact manual flow is in GEMINI_SETUP; the HTTP success is not claimed as browser verification. Broad live extraction quality, Free Tier account eligibility, historical-failure cause, and failed-call usage remain unknown.
- README, AI_INTEGRATION, and GEMINI_SETUP updated to match actual behavior. New diagnosis work remains local/uncommitted. Development servers are available at http://127.0.0.1:5173 and http://127.0.0.1:3001. Section 4 has not started.

## Historical invalid-output diagnosis follow-up

- Committed and pushed the preceding Gemini/credential-containment work first, as requested: `0f15422` — Add optional Gemini extraction provider with private configuration. Checked the actual private key against all candidate tracked/untracked source files before staging; no key match, and the example was empty. Private `.env` was not staged.
- The original rejected synthetic response was not retained. Its exact failing field cannot be recovered, so the following reproduced contract defect is not claimed as a forensic reconstruction of that response.
- Offline reproducer demonstrated a concrete mismatch at `facts[0].fact.comparison`: the old Gemini wire schema accepted a budget fact with `at-most`, but conversion rejected it as a travel-only field (non-travel comparison must be unknown). Other irrelevant fields were also unconstrained by kind at generation time.
- Fixed generation/wire rules to match the already-strict conversion rules: each fact kind has its relevant nullable fields, all irrelevant fields must be null, and non-travel comparison is a literal unknown. Preserved the flat subject representation and internal summary format. Adapted Zod oneOf to Google's equivalent anyOf for disjoint kind branches, and const to enum. Tests verify the actual outgoing schema, not just successful mocked responses. No source or application rule was relaxed, and no invalid claims are silently discarded.
- Added sanitized diagnostics for provider envelope/JSON, wire/conversion, canonical schema, source checks, fact fields, and response contract. At that time errors returned a controlled stage, allowlisted schema field path/array index, and controlled rule. The current follow-up keeps these details server-side and returns a matching reference to the UI. No raw Zod messages, unexpected key names, quotes, IDs, model responses, or credentials are serialized/logged. Existing editor validation reports field/rule alongside its unchanged error text.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` passed. **79 tests passed**. Focused regressions cover the reproduced comparison mismatch, generated literals/nulls, missing versus null fields, unknowns, unexpected fields, exact-source/prefix failures, JSON/envelope failures, truncation, and diagnostic privacy. Existing OpenAI, review, source, quota, cancellation and stale-result tests still pass.
- Browser discovery before live testing returned `[]`. No extra extraction was used to attempt browser verification.
- After offline checks, made **one additional live synthetic POST** through Vite/API, using the same zero-budget sentence and expectedProvider=gemini. Result: **HTTP 502, provider_failure, 1701 ms**; no summary accepted. This differs from the original invalid_output. The current handler collapses upstream HTTP, transport, and unexpected adapter failures into that code, so the exact cause cannot be determined from this result. No validation-stage diagnostic was reported for the new failure.
- Stopped live work immediately after the failed request as instructed. No automatic retry, second additional request, paid fallback, billing change, or bulk evaluation. Provider tokens/cost are unavailable; do not infer free usage or successful live extraction.
- Remaining limitations: exact original-response cause and successful live extraction remain unverified. The demonstrated schema mismatch is fixed offline; the next diagnosis would first need safe upstream-status/transport diagnostics before any separately authorized request. Browser Analyze → preview → accept → editable-summary flow remains unverified; use the manual checks below/in GEMINI_SETUP with a separately authorized successful analysis. New diagnosis changes remain local/uncommitted. Section 4 has not started.

## Credential containment and one live check

- At the start of this request, the accessible `.env.example` already contained an empty Gemini placeholder and `.env` did not exist. There was no key to migrate. The user then configured it directly in the private file after being told not to send it in chat.
- Prepared/retained `apps/api/.env` with `AI_PROVIDER=gemini`, `AI_ENABLED=true`, owner-only 0600 permissions, and other settings preserved. The example's key is empty; the private file is ignored and untracked. No credential was printed, added to frontend code, or passed in command arguments.
- Exact configured-key comparison found zero matches in tracked working files, staging, and stored Git blobs/commits, including unreachable objects. Initial Google-format scans of tracked/staged content and all four available history/reflog snapshots also found none. No committed exposure was found for this key; no history rewrite, push, or billing operation was performed.
- Inspected the implementation: Gemini support already existed. OpenAI option, full schema/source checks, temporary editable summaries, acceptance confirmations, stale-result handling, and unreviewed AI claims remain unchanged. Re-fetched official model/pricing pages and confirmed `gemini-3.5-flash-lite` structured output and documented Free Tier input/output; project eligibility/billing tier was not inspected.
- Reran `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`: all passed, 73 offline tests. Restarted root development so the API loads the private environment; health and public configuration were checked before submission.
- Made **exactly one live synthetic POST** through Vite `/api/analyze`, with expectedProvider=gemini and the zero-budget sentence. Result: **HTTP 502, invalid_output, 2081 ms end-to-end**. The provider-response path returned data that did not pass application validation; no summary was accepted. The raw response was not logged or retained, so the precise rejected field is unknown. Provider token usage and cost were not available.
- No automatic retry, second live request, bulk evaluation, paid-provider fallback, billing enablement, or Section 4 work. The validator was not weakened to accept a bad response. Live extraction remains unsuccessful/unverified; investigating the rejected output needs a separately authorized future live attempt with safe diagnostics. Existing browser acceptance remains unverified.

The following earlier sections are retained as history; their missing-key statements describe earlier checks, not the current private configuration.

## Section 3 — optional Gemini provider

The preceding OpenAI work was committed and pushed first, as requested: `1b8754f` — Add Section 3 AI conversation extraction with validated review workflow. Local HEAD and origin/main matched after pushing. The Gemini option was implemented afterward and remains local/uncommitted; no billing or deployment action occurred.

- Inspected the existing adapter, schemas/source validation, configuration, editor/client, tests, and documentation. Internal summary/evidence/uncertainty format is preserved.
- Explicit `AI_PROVIDER=openai|gemini`; omitted setting preserves OpenAI as default, invalid/empty setting fails. Only the selected credential is required. No fallback to another provider or model.
- Selected stable `gemini-3.5-flash-lite` using current official Google model/pricing/structured-output documentation: structured output and Free Tier input/output are documented, but project access and quotas were not verified. Google restricts 2.5 models for new projects; they were not chosen.
- Native stateless Gemini REST, private x-goog-api-key header, fixed host, no redirects/tools/retries. Flattened wire schema converts back through the unchanged full Zod/source checks; no application checks were removed. The existing OpenAI SDK/model/settings remain intact in `openai.ts`.
- Public provider/model-only configuration enables accurate disclosure and expectedProvider checks. Changed providers reject submission with 409 before extraction. Existing staging, correction, cancellation, and stale-result protections remain.
- Gemini 429 reports quota exhaustion and manual retry; no paid fallback. API request limits remain unchanged. Live evaluations are opt-in, support one synthetic case, and stop on quota/access failure. Gemini usage cost stays unknown, not a fabricated zero.
- Backend example/configuration instructions, Free Tier verification/quota steps, unpaid-data handling, and one synthetic live test are documented in [GEMINI_SETUP.md](GEMINI_SETUP.md). Never paste keys into chat.

| Gemini follow-up check | Actual result |
| --- | --- |
| `AI_PROVIDER=gemini npm run typecheck` | Passed: shared, web/tool, API |
| `AI_PROVIDER=gemini npm run lint` | Passed, zero warnings |
| `AI_PROVIDER=gemini npm test` | 73 offline tests passed, zero failed, including OpenAI regressions, selected credentials, invalid config, schema conversion, source validation, public metadata, mismatch rejection, quota/errors, no fallback/retries, cancellation, client state, fixtures/editor markup |
| `npm run build` | Shared, web, and API passed |
| `AI_PROVIDER=gemini AI_ENABLED=true PORT=3002 npm run start:api` | Compiled entry starts; no key required for health/config |
| HTTP GET health/config on compiled API | Health 200 exact contract; config 200 exactly provider/model with Gemini; no credential fields |
| Synthetic Analyze on compiled API without Gemini key | HTTP 503 selected-Gemini configuration message, no fallback or fixture response |
| GET configuration through running Vite proxy | HTTP 200 OpenAI/default metadata, preserving the existing installation |
| `AI_PROVIDER=gemini AI_ENABLED=true npm run eval:live -- --confirm-live-eval --case=zero-budget` | Exits 1 before provider requests: missing GEMINI_API_KEY. No live call, usage, cost, or extraction result measured |
| Browser connection/discovery | No browser available; discovery `[]`. Provider disclosure/click/race/layout/storage checks remain unverified |

The one-request live test and exact manual acceptance checks are in the Gemini guide. Actual Google's schema acceptance, project Free Tier eligibility/quotas, model quality, latency, usage, and billing status remain unverified. Google provider handling differs from OpenAI; no zero-retention or free-usage guarantee is claimed. Section 4 remains unstarted.

## Original OpenAI integration verification (before Gemini)

## Section 3 — integration implemented, live acceptance blocked

- Initial working tree was clean. Existing focused Section 2 commit `f22e040` is the checkpoint; no duplicate/empty commit or global identity changes. No push/deployment in this milestone.
- Section 2's 21 offline checks passed again before integration. Browser runtime again reported no available browser (`[]` discovery); relevant browser checks remain unverified. No blocking Section 2 defect was found. Summary replacement/removal now requires confirmation, protecting applied and unapplied edits.
- OpenAI Responses with pinned GPT-5.4 mini, strict structured output, backend-only credentials, optional backend `.env`, explicit enabling, `store: false`, no tools, no retries. Provider selection/configuration/data-handling limitations are documented in README and [AI_INTEGRATION.md](AI_INTEGRATION.md), using current official sources.
- Shared planning workspace retains the previous model/editor and adds a validated request/response contract plus optional AI provenance. New dependencies are OpenAI's server SDK and shared Zod validation. Installation/dev/build prepare the shared package.
- Explicit Analyze disclosure/action, optional conversation reference date, staged results, cancellation, draft/reference mismatch protection, and confirmation before replacing existing work. Samples/manual fallback/health remain available. AI claims stay unreviewed; reported confirmation is demoted to proposed until manual review.
- Server checks schema, exact source substrings, identities/references, numeric evidence, date/time fields, and scope/supersession references. Unsupported date/time boundaries become unknown with warnings. Quoted evidence does not establish semantic truth; human correction remains essential.
- Limits: 6000 characters/32 KB body, one request at a time, three attempts/minute, ten attempts/API process, 6000 output tokens, 45-second server/55-second client timeout. Provider failures/cancellations count. No durable dollar-budget claim; enabling requires reviewing development spend. No raw-conversation/credential logging or persistence.

## Section 3 checks actually run

| Check | Result |
| --- | --- |
| `npm ci` | Passed from root lockfile; prepare builds shared package |
| `npm run typecheck` | Passed for shared, web/tooling, and API |
| `npm run lint` | Passed, zero warnings |
| `npm test` | 43 passed, zero failed (includes parent/subtests); no paid calls |
| Six synthetic offline evaluation cases | 6/6 hand-authored candidates pass deterministic checks: tentative/unknown, zero, correction, conflicting requirements, ambiguous Friday, embedded instructions; **not live model evaluation** |
| SDK/HTTP tests | Strict request shape/privacy settings, no credential in prompt, no tools/retries, 401/429/500/refusal sanitization, missing config, malformed output, request/reference/body limits, concurrency/rate/session limits, timeout, disconnect cancellation |
| State/markup tests | Draft/reference mismatch detection, explicit body transmission, candidate provenance/disclosure, existing fixture/manual/unknown/attribution/validation tests; no claim of browser interaction coverage |
| Early validation tests | Exposed sentence-final `0.` number-check edge; fixed number handling. Mock SDK response corrected to include the required response discriminator. Reruns passed |
| `npm run build` | Passed: shared declarations/JS, Vite assets, API ESM |
| `npm run start:api`; direct health and Analyze | Compiled entry starts; HTTP 200 exact health; HTTP 503 actionable missing-AI configuration error, no fixture fallback |
| `npm run dev`; direct/proxied health/Analyze | Both servers start with shared preparation; health HTTP 200 on 3001 and 5173; proxied Analyze HTTP 503 as expected without credentials |
| Ctrl+C on updated root dev; TCP probes on 3001/5173 | Both servers stop and both ports refuse connections; app restarted for local use afterward |
| `npm run eval:live -- --confirm-paid-eval` | Exits 1 before requests: missing key and AI disabled. Zero live-provider requests; latency/token usage/cost and extraction quality unmeasured |
| `git diff --check`; source/file review; env ignore check | Passed; real `.env` ignored, example safe, generated builds/dependencies untracked |
| `npm audit --omit=dev` | Zero runtime findings; existing 10 moderate lint-tool findings remain |

Browser checks remain **unverified**: page interactions, actual confirmation dialogs/unsaved edits, loading/cancel/race/error flows, narrow-screen layout, keyboard/screen reader, and live browser request/storage observations. The combined precise manual checklists are in README and AI_INTEGRATION. Source/static rendering/HTTP checks do not substitute for a browser.

This original acceptance blocker remains for OpenAI: configure OPENAI_API_KEY privately, review budget, enable, and restart. The current Gemini alternative has its own key/Free Tier checks above. Provider retention controls/account access were not verified. The original Section 3 changes are now committed/pushed as `1b8754f`; the Gemini follow-up is local. Section 4 has not started.

## Historical Section 2 record

The following was recorded before the Section 3 instruction and is retained as verification history, not the active scope.

## Section 2 — implemented

- Typed participants, speaker mappings, source quotes, date/time windows, individual amount/currency limits, activities, strict/inclusive travel bounds, constraints/preferences, missing questions, and conflicts.
- Explicit nullable unknowns; status (proposed/tentative/confirmed/conflicting) and firmness are independent.
- Three synthetic conversation/summary fixtures, prominently labeled manually authored sample data. The original Foundation sample remains the default selection.
- Participant rename/add, linked speaker remapping, editable fact attribution/values/status/firmness, original quote inspection, manual additions/removal, and editable question resolutions.
- Draft edits preserve the summary and show a mismatch warning. Arbitrary text is never parsed. Blank manual summaries infer nothing. Loading a sample clones and replaces local state; reload clears everything.
- Original page structure, neutral styling, and real backend connectivity preserved; no dependencies or API routes added.

## Section 2 verification

| Check | Result |
| --- | --- |
| Initial Git inspection | Clean working tree; no pre-existing edits to overwrite |
| Section 1 acceptance review | Reused recorded fresh install, compiled API, stop/restart, ports, shutdown, and lockfile checks below; runtime/package configuration unchanged apart from the test command |
| `npm run typecheck` | Passed for web/tooling and API |
| `npm run lint` | Passed, zero warnings |
| `npm test` | 21 passed, zero failed: existing health checks plus fixture references, clone/reset, manual/draft state, unknown vs zero, tentative/conflicting facts, corrected limit, attribution, field/question validation, and static review/form markup |
| Initial static-render test attempt | Failed because root test runner used classic JSX; corrected the test command to use the web tsconfig and reran successfully |
| `npm run build` | Passed for Vite assets and compiled API |
| `curl -i -s http://127.0.0.1:3001/api/health` | HTTP 200 and required JSON |
| `curl -i -s http://127.0.0.1:5173/api/health` | HTTP 200 and required JSON through unchanged proxy |
| Network/storage source inspection | Only the existing bodyless health GET; no planning-data requests, persistence, or logging added |
| Mobile CSS/semantic review | One-column forms below 540px, shrinkable fields, text wrapping, real controls, visible-focus rules and labels present; rendered usability is unverified |
| Browser check | Runtime reports “No browser is available”; discovery returns `[]`. No browser interaction, visual, keyboard/screen-reader, or live storage/network claims |

Foundation’s outstanding browser checks remain pending, including sample/Clear/reload, connection panel interaction during failure/recovery, narrow-screen overflow, focus, and browser storage/network observations. The README has a combined Foundation/Section 2 manual checklist. No foundation defect was found that blocks this milestone.

## Section 2 limitations and handoff

- Local state only; loading another sample or starting a blank summary explicitly replaces edits. Unapplied form edits can be cancelled. No automatic extraction, conflict detection, or constraint feasibility checks.
- Original quotes are retained and may no longer support edited facts. Question resolutions and fact edits are deliberately separate. Currency validation checks three-letter format, not conversion or a supported-currency catalog. Date/time windows are same-day; use multiple facts for overnight plans. Unknown participant names remain explicit.
- Browser acceptance remains unverified. The existing development-tool audit findings recorded below were not changed by this milestone.
- Section 2 implementation and available automated/HTTP checks were completed and committed as `f22e040`. Its subsequent push was authorized in the previous turn; this historical action does not authorize pushing Section 3.

## Historical Foundation verification record

The following checks were recorded for Section 1 on November 6, 2026 and reused above where the underlying code/toolchain is unchanged.

## Implemented

- Private npm workspaces: strict TypeScript React/Vite web and Express API; one root lockfile.
- Neutral responsive page, text wordmark, labeled temporary draft, exact synthetic sample, Clear, visible focus styles, and polite connection announcements.
- Real `/api/health` request through Vite's proxy, response validation, five-second timeout, idle/checking/connected/error states, retry, cancellation, and protection against stale results.
- Compiled ESM API, port validation, watch development, concurrent startup/shutdown, and preflight for occupied API ports.
- Setup/troubleshooting/manual verification documentation; supplied spec copied unchanged.

## Checks run

| Command or check | Result |
| --- | --- |
| `node --version`; `npm --version` | v24.18.0; 11.16.0 |
| `npm install` (workspace dependencies); `npm ci` | Passed; single root lockfile reproduced installation |
| `npm run typecheck` | Passed for web, Vite tooling, and API |
| `npm run lint` | Passed, zero warnings |
| `npm test` | Passed: 9 health cases plus parent test; actual five-second timeout, cancellation, HTTP/network failures, invalid JSON/contract, request shape |
| `npm run build` | Passed: Vite assets and API JavaScript emitted |
| `npm run dev` | Both servers start on documented ports |
| `curl -i http://127.0.0.1:3001/api/health` | HTTP 200, exact specified JSON |
| `curl -i http://127.0.0.1:5173/api/health` | HTTP 200, exact specified JSON through proxy |
| `curl -fsS http://127.0.0.1:5173/` | HTML served with Fuzl title and React entry |
| `npm run start:api` after build | Compiled API starts; health returns required JSON |
| Actual health helper via `node --import tsx --input-type=module`, adapting relative fetch to local Vite origin | Accepts live response; rejects HTTP 502 when API stops; succeeds after API restart |
| Stopped-API smoke assertion | Initial harness incorrectly expected HTTP 500; corrected to observed Vite HTTP 502 and reran successfully. Helper rejected both correctly; no app change needed |
| `npm run dev` while compiled API occupies 3001 | Exits with actionable port error; concurrently terminates frontend |
| `PORT=invalid npm run dev:api` | Correctly exits 1 with port validation message |
| Ctrl+C on root dev; TCP probes on 3001 and 5173 | Both commands stop; both ports refuse connections, no orphan listeners |
| Source inspection (`rg`) | Only health fetch; no draft route, request logging, or browser storage code |
| `cmp FUZL_CODEX_SPEC.md /Users/jacejoseph/Downloads/FUZL_CODEX_SPEC.md` | Identical |
| `git diff --check`; intended-file review | Passed; dependencies, builds, env files, local artifacts ignored |
| `npm audit --omit=dev` | Zero runtime vulnerabilities |
| `npm audit` | 10 moderate development-tool findings through minimatch; unresolved upstream dependency ranges |

## Unverified and known limitations

Browser runtime setup succeeded but selection reported “No browser is available”; discovery returned an empty list. Browser typing/sample/Clear/reload interactions, rendered narrow/desktop layouts, keyboard/focus and screen-reader behavior, and network/storage observations remain **unverified**. Follow the precise manual checklist in README. Source and HTTP checks do not establish visual verification.

Drafts clear on reload. Health is a snapshot of reachability, with no automatic polling. No `.env` loading or production routing exists. Development lint tooling depends on affected minimatch 10; patched 11.0.1 is outside upstream ranges. No overrides or force flags were used.

## Handoff

Foundation implementation and available automated/HTTP checks are complete; manual browser acceptance remains pending. A focused local foundation commit records this work. No remote was created, pushed, published, or deployed.

This historical stopping boundary was advanced by Jace’s later instructions. The active boundary is now **after Section 3**.
