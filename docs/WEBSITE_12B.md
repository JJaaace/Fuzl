# Section 12B — Website usability and reliability

Verified November 24, 2026. Prior work was checkpointed and pushed as `54e6540` on `origin/main` before this pass. These Section 12B changes remain local. No hosted migration, sign-in email, deployment, billing change or live AI request was made.

## Blank-screen cause and repair

Before the fix, open the HTTP LAN preview, then **Try a sample plan → Friday, maybe**. Chrome and Playwright WebKit both reproduced `TypeError: crypto.randomUUID is not a function` in `PlanOutings` while constructing idea-card display values. React unmounted the root: its child count became zero and only the dark background remained. This was a rendering exception, not an empty response, an AI access restriction or a Gemini failure. The reproduction did not send a provider request.

On loopback, `isSecureContext` was true and `crypto.randomUUID` existed. On the HTTP LAN address it was false and that method was absent; `crypto.getRandomValues` remained available in both browsers. The [Web Crypto specification](https://www.w3.org/TR/webcrypto/) marks `randomUUID` as a secure-context method. The shared `newRecordId` helper now uses the native method when available, otherwise secure random bytes with UUID v4 version/variant bits. It never substitutes `Math.random`. Browser ID call sites and the shared guest-ID default use it; guest credential entropy and backend origin checks are unchanged. Many files contain this same small replacement because their buttons had the same unsupported API call.

`RenderBoundary` catches rendering failures around the Plan content while the workspace owns the draft and applied summary outside it. Recovery keeps the shell visible, offers **Retry this panel** and **Back to conversation**, and shows a sanitized diagnostic reference. A root boundary also provides a readable fallback for other render failures; a root-level failure may unmount temporary work inside the failed tree, so its wording does not promise restoration. Neither boundary catches every event-handler, module-loading or transport failure; those retain their existing error handling.

Original exceptions and component stacks stay in a bounded, ten-entry in-memory diagnostic map, cleared on account identity changes. Console output contains the reference and error class, not arbitrary exception content. During local debugging, import `getRenderFailure` from `/src/ui/RenderBoundary.tsx` in DevTools and pass the displayed reference. Do not copy private exception content into shared logs.

## Navigation and usability

- One shared primary navigation component marks exactly one **visible** destination with `aria-current="page"` and the same active styling. Workspace and Conversations remain mounted during primary navigation; drafts and unapplied editors stay in memory. History stores only destination/stage metadata, never conversation content. Back from Plan to a workspace URL without a stage now restores Conversation. Account boundaries still clear private state.
- A pending analysis uses the latest preview callback. Finishing after navigation cannot pull the visitor out of Saved groups. Explicitly opening the preview still works. Existing acceptance, stale-source checks and unreviewed labels remain intact.
- The hero preview opens **Friday, maybe** through the existing guarded, offline sample flow. Its activity is suggested, Friday evening is tentative, and the exact date stays unresolved.
- Enabled Analyze is ivory (`#F5F0E7`) with espresso text (`#24170B`), with hover and keyboard-focus feedback. Empty/whitespace input remains disabled; loading prevents duplicate submission. Failed requests keep the draft and diagnostic reference and require explicit retry.
- Each AI action has a short payload-specific disclosure and expandable **Privacy & provider details** before submission. Text analysis sends the draft/optional date; screenshot reading sends selected images; planning choices send eligible idea labels/window; native-chat extraction retains its distinct disclosure. These edits do not change provider payloads or privacy rules.
- Email has `you@email.com`, retaining its visible label, email type, input mode and autocomplete. No email was submitted.
- The phone composer now wraps its mode switch and sample picker without overlapping hit targets. Successful sample loading closes the picker; declining replacement preserves the draft.

Raw pasted drafts and temporary images are still not persisted or restored after a full reload. Changing between loopback and LAN addresses also does not transfer drafts.

## Actual checks

The configured **fuzl_playwright** Microsoft MCP server was used through the same standard MCP client bridge documented in [Section 12A](BROWSER_SETUP.md). No app browser dependency was added. Chrome reported `158.0.8127.37`; separately installed Playwright WebKit reported a Version 27.2 user agent. WebKit is **not real Safari**.

| Check | Result |
| --- | --- |
| Chrome and WebKit; loopback and LAN | Four passing matrices: 11 sample loads each through hero preview, Try an example and all three gallery cards, including repeated replacements. No uncaught exceptions, HTTP failures or failed requests in those matrices. |
| Navigation | Workspace, Plan, Conversation, Conversations, Saved groups/sign-in, Back/Forward, Group details and paste/upload switching worked. Draft retained. Exactly one visible primary destination active. |
| 390×844 viewport | Both browsers passed the navigation matrix without horizontal overflow. Additional Chrome checks opened all three samples, focused each title, used keyboard Group details, reached Friday's date editor, typed/validated email without submitting, and enabled reduced motion. These are emulated viewports, not phones. |
| Analyze, loopback | Intercepted synthetic responses: loading/duplicate prevention, 503 failure and reference, preserved draft across pending navigation, explicit retry, validated preview, explicit acceptance and unreviewed claims, then stale-response rejection. **Mocked; no Gemini call.** Separate settled-style check confirmed enabled ivory colors and a solid keyboard-focus outline. |
| Analyze, LAN | Exactly one real `POST http://192.168.12.248:5174/api/analyze`, HTTP **403**. Reference `da2e256f-42d0-4372-9bc0-8ea9c8d30d55`. The pre-provider origin guard returned actionable loopback guidance; draft intact, **no provider called**. This expected restriction is separate from the fixed blank screen. |
| Recovery | Deliberately injected a synthetic render exception in Chrome. Shell/reference/recovery appeared without the private canary; Back preserved the draft and retry restored the cards after removing the fault. This is a fault-injection test, not a new spontaneous failure. |
| Replacement safeguards | Actual WebKit modal declined; synthetic unsaved draft and original Friday sample stayed intact. Stress matrices deliberately accepted replacement of synthetic fixtures only. |
| `npm test` | **406 passed, 15 intentional database skips, 421 total**, zero failures. New tests cover missing UUID API, secure fallback, all samples/manual entry, boundary recovery/sanitization, Back stage restoration and background-preview navigation. |
| `node scripts/test-database.mjs` | **101 passed**, zero skips/failures, owned disposable PostgreSQL only; existing migrations applied twice, seed retained, cluster removed. No new migration. |
| `npm run typecheck`; `npm run lint`; `npm run build` | Passed; zero lint warnings. Existing Vite large-chunk advisory remains. |

Initial harness runs encountered modal handling, overly broad/hidden locators and screenshots taken during transitions; these were corrected before the passing runs. Development rebuilds also triggered Vite reload/beforeunload guards, so final browser matrices ran after builds settled. The only errors in the deliberate final failure tests were the mocked HTTP 503, expected LAN HTTP 403, and sanitized injected-render diagnostic; do not combine these with successful-navigation console results.

## Evidence and replay

Artifacts follow the existing ignored convention: `artifacts/design/section12b/`.

- Before: `lan-before-blank.png`, `before-console-errors.txt`.
- After: `desktop-home-final.png`, `desktop-friday-final.png`, `phone-home-final.png`, `phone-friday-final.png`, `phone-plan-viewport-final.png`, `phone-signin-final.png`.
- Failure views: `render-recovery-final.png`, `analysis-recoverable-error.png`, `lan-analysis-restriction.png`, `analysis-keyboard-focus-final.png`.
- Browser evidence: `chrome-loopback-results.json`, `chrome-lan-results.json`, corresponding `webkit-*` files, `phone-checks-results.json`, `analysis-browser-results.json`, `final-capture-results.json`, `recovery-browser-results.json`, `replacement-decline-results.json`, `lan-analysis-results.json` and `lan-analysis-network.txt`. The settled style/focus evidence supersedes the transient style snapshot in the analysis scenario.
- Check logs: `all-tests.log`, `database-tests.log`, `typecheck.log`, `lint.log`, `build.log`. Earlier development console logs are historical, not zero-error acceptance evidence.

Open **http://127.0.0.1:5173/** on the Mac, then click the hero preview or **Try a sample plan → Friday, maybe**. Plan opens with the unresolved Friday question and its date-review action. Conversation returns to the retained draft; try all samples, details, and primary navigation. The current LAN preview is **http://192.168.12.248:5174/** on the same network; AI remains loopback-only. These processes/addresses are local and may change after restart.

## Checklist status and pending verification

| Requested item | Status |
| --- | --- |
| Blank-screen diagnosis, secure-ID repair, shell recovery and targeted regression | **Implemented**; reproduced before and checked after in Chrome/WebKit. |
| Compact hero result preview | **Implemented**. |
| Analyze disabled/loading/duplicate/retry/draft protections | **Already working**, browser-verified with synthetic mocks; enabled visual treatment/focus verified. |
| One active navigation destination, retained workspace and Back/Forward | **Implemented**. |
| Short action-specific disclosures and accessible full details | **Implemented**. |
| Email placeholder | **Implemented**; label/autocomplete/validation were **already working**. |
| Automated checks, desktop/phone-sized Chrome and WebKit evidence | **Implemented**. |
| Actual Safari and physical phones | **Blocked**: no real Safari/device control through this MCP setup; still pending. Hosted workflows were not exercised in this signed-out synthetic pass. |

For real Safari: open both addresses in fresh tabs, enable Web Inspector's Console and Network with Preserve Log, then repeat all sample entry points and Back/Forward. Confirm the page stays mounted, Plan/title agree, and no new uncaught error appears. If a recovery view appears, keep the tab open and record only its reference and the sanitized exception class; inspect the original locally. Confirm decline/accept guards, keyboard focus and reduced motion. On a real phone, repeat gallery, mode switching, date review and sign-in typing without sending. Hosted account, two-account isolation, guest voting/RSVP and native conversation acceptance remain the separately recorded pending work; local fixtures and disposable database tests do not establish them. No live AI success or provider latency/cost was measured in this pass.
