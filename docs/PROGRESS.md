# Fuzl progress

Updated November 6, 2026. Active authorization: **Section 3 only**. Sections 4–12 remain future context. The supplied specification is preserved unchanged.

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

Remaining blocker: configure `OPENAI_API_KEY` privately in `apps/api/.env`, review a small project budget, set `AI_ENABLED=true`, and restart. Then run the explicitly opted-in synthetic live evaluation and inspect real candidate facts in the editor. Do not paste a key into chat. Provider retention controls/account access were not verified; `store: false` is not zero retention. Section 3 changes remain local and uncommitted. Section 4 has not started.

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
