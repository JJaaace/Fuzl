# Fuzl progress

Updated November 7, 2026. Active authorization: **Section 6 — account-free guest responses**. Sections 7–12 remain future context. The supplied specification is preserved unchanged. Section 5 remains incompletely verified.

## Section 6 — local implementation and verification

- Read the full specification and new request; its Section 6 authorization supersedes the original document's Section 1-only boundary. Used **fuzl-access-review**, **fuzl-ui-review** and **milestone-check**. The design code was already committed as a2d9f5c; separately checkpointed the prior skill/review documentation as **923deb3**, with a clean credential scan. No push. Section 6 remains uncommitted/local.
- Existing synthetic sample/edit/save-control flow remains available and is covered by React DOM checks. Hosted sign-in callback, identity, original-tab preservation, save/reopen, sign-out and real two-account isolation remain unverified; no extra email was sent.
- Added organizer-approved **Ask the group** for owned saved sessions: explicit title/question wording, shared input preview, approval reset on changes, one active invite, 1/7/14-day expiry, one-time copy/manual clipboard fallback, explicit replacement/revoke. Temporary summaries clearly require saving first. No messages are sent.
- Guest route renders outside account/provider initialization and offers alias, short answer/availability/spending fields, optional blank/explicit unknown/known zero and unknown currency. Replies can be edited after reload using a separate browser-held response credential. Failed sends keep typed values and explicitly reuse the original idempotency key/credential. No raw guest draft is persisted.
- Server invite tokens and response tokens use separate 256-bit capabilities, with only SHA-256 digests in the database. Guest DTOs allowlist approved title/questions/expiry or one respondent's own reply. Scoped edit credentials, server-side expiry/revocation, invite-row write locks, request-size/rate limits, no-store/no-referrer, safe errors and no raw token/answer logging protect the routes. Existing verified organizer ownership gates every invite/response management operation.
- Private spending values are kept in a separate private-answer table; organizer DTOs return only a private-answer marker. Output validation also redacts accidentally misplaced private values. A guest can instead explicitly share an amount with the owner. Previously shared/accepted data cannot be retracted by changing visibility later. No feasibility engine was added.
- **Responses** refreshes manually and never alters summary state automatically. Explicit matching/apply or question-only resolution records guest origin and its original excerpt, preserving imported sources and unrelated edits. Tentative AI claims can remain historical behind the new proposed guest fact. Reply and workspace revisions are rechecked before Apply; newly accepted provenance is revalidated at Save while existing session CAS protection remains. Private/blank answers cannot be accepted as guest-sourced summary values. Duplicate answer-version application is rejected; stale question selections cannot replace a resolution, and repeated answers reuse their matched guest speaker.
- Added migration **202611070001_guest_responses**: invites, responses and separate private answers, cascading FKs, active/submission uniqueness, RLS and revoked public grants. Applied and reapplied **only to an owned disposable PostgreSQL cluster**, preserving unrelated sentinel data. The configured hosted project is untouched and still needs this migration before real guest links work. No reset/deletion of hosted data, new runtime dependency, credential or provider/configuration change.

| Section 6 check | Actual result |
| --- | --- |
| `npm test` | **168 passed, 2 intentional DB-suite skips** (170 reported tests), including synthetic guest send/reload/edit, failed send/idempotent retry, approval/private DTOs, stale response rejection then fresh Apply, zero/unknown/blank contracts, source preservation and existing workspace tests |
| `npm run test:db` | **16 passed**: existing nine plus seven Section 6 parent/subtest results. Real migrated PostgreSQL and actual HTTP routes cover owner create → guest submit/edit → owner apply/save; private-budget redaction, concurrent duplicate sends, same-alias/wrong-session/cross-owner isolation, stale guest/summary revisions, question-only resolution, replacement/expiry/revocation, RLS/grants and session/group deletion with no accessible orphans. Own cluster stopped/removed |
| Type checking, lint, build | Passed for shared/web/API; zero lint warnings |
| Compiled API / development smoke | Compiled API started on an owned temporary port and stopped: health 200/no-store, missing guest bearer 400/no-store/private, unauthenticated private guest management 401/no-store. Existing development workspace, `/guest` and guest component modules return 200. One proxied health probe during the shared-package/watch rebuild returned 502; after the restart, direct API and proxied health both return 200 with the exact required JSON/no-store. No valid invite or hosted guest-table query was used |
| Sensitive-file / diff review | No configured private credential matches in changed/untracked candidate files or emitted frontend assets. API `.env` stays ignored, untracked and 0600; no private certificate/configuration change. `git diff --check` passed. Nothing staged |
| Browser/manual | **Unverified:** no browser available. Narrow phone layout, focus/clipboard feel, separate real owner/guest profiles and hosted account workflow require the short checklist in GUESTS. No browser success is inferred from mocks or HTTP checks |
| Scope | No AI/provider request, sign-in email, billing, deployment, network exposure, Section 6 push or Section 7 feature. The prior skill/design-doc checkpoint is local |

See [GUESTS.md](GUESTS.md) for code flow, credential/storage lifetimes, expiry/deletion/privacy limits, migration instructions and the same-computer versus another-device setup. Existing design and Section 5 records below are historical evidence, not current hosted acceptance.

## Local skills and first UI/milestone review

- Created instruction-only **code-cleanup** and **milestone-check** under `~/.agents/skills/`, and **fuzl-ui-review**, **fuzl-extraction-eval**, **fuzl-access-review** under the repository's `.agents/skills/`. Existing system/plugin/user discovery was inspected first; none of the five names existed, so there were no cleanup instructions to overwrite. Automatic discovery remains enabled by default; no Codex configuration was changed.
- All five pass the bundled skill validator (temporary PyYAML environment only), and every repo-document link resolves. Installed Codex CLI **0.151.0** discovery was tested directly with `skills/list`/forceReload: all five enabled at the root and apps/web, only the two user skills in an outside directory, no loader errors. Temporary tooling used no model turn/provider call and is not a committed skill helper.
- Applied **fuzl-ui-review**, then **milestone-check**, to current design commit **a2d9f5c**. No new confirmed source/DOM/SVG defect was found, so the app implementation is unchanged. Warm tokens, orange/yellow/ivory fuse and filled crescent are implemented; fresh SVG proofs were inspected at 16/24/40/header/favicon sizes. Shared wave/quiet-center/pausing invariants pass offline tests; actual motion quality cannot be judged without a browser.
- Reran **npm test: 160 passed, one intentional DB-suite skip**, type checking, lint and build. Local workspace/preview/modules/favicon/health returned 200. Existing synthetic built-in sample and failure-path DOM tests establish draft/editor retention, cancellation/stale/replacement and explicit acceptance protections, not rendered browser acceptance.
- **Unverified:** no browser is connected; running wave/ignition, actual sample journey, desktop/narrow layout, reduced-motion rendering and keyboard/scroll feel still need observation. Hosted Section 5 auth/save/two-account checks remain separately unverified. No live AI call, email, hosted database mutation, commit, push, deployment or Section 6 work. New skills and review documentation stay local.
- Full first-review findings, passed/failed/unverified status and exact manual replay steps are in [DESIGN.md](DESIGN.md#first-skill-driven-review--november-7-2026).

## Local ripple and crescent refinement

- Started from clean **083d78b**. This follow-up is checkpointed at the user's request and changes only background/mascot rendering, its focused tests, exported assets and documentation. Charcoal/ivory/amber tokens, visible density (760 desktop / 240 phone points), page layout and all planning/account/provider flows remain unchanged.
- Reused the canvas controller and stable point positions. Nearby points now share a broad diagonal spatial phase: a smooth 13-second rise/settle ripple, slight brightening/warmth and a weaker 19-second crossing echo. Lift is bounded to 6px combined, with a smooth falloff around the quiet center. Elapsed-time evaluation has no explicit loop reset; typing and workspace mode changes preserve the renderer/clock. Existing hidden-tab/offscreen pausing and static reduced motion remain.
- Resting fuse colors are **#FF944D → #FFD36A → warm ivory**, outside toward the body. An 800ms soft brightness pulse follows that order without replacing the resting hues. Body/crescent lift/open slightly and settle together. The smile is a symmetrical, closed filled espresso crescent, thickest at its low center, with rounded tapered tips and no stars. Header/static favicon share the vector geometry. Reference moon pixels were not accessible; no exact-reference-match claim.
- Generated and inspected actual 16/24/40px SVG raster proofs and the header/favicon comparison. The existing **/?design=logos → Replay Light the fuse** control replays the animation without an AI request. Static proofs do not establish observed app motion.
- Verification: **160 tests passed, one intentional DB-suite skip**, type checking/lint/build passed, diff check passed. Five field checks include spatial coherence, few-second displacement, smooth cycle boundaries, density/quiet-center invariants, lifecycle pause/cleanup and reduced motion; existing DOM checks cover stable canvas/header nodes during editing/navigation, resting fuse colors, filled mouth and one-shot ignition. No live AI requests, emails, database changes or deployment. The user subsequently requested a normal commit and push.
- Browser connection/discovery returned no available browser. **Actual app wave timing, Safari/phone rendering and assistive-technology checks remain unverified**; local modules/preview and health are served successfully. Exact replay/manual checks are in [DESIGN.md](DESIGN.md). All pending hosted Section 5 checks remain pending; Section 6 has not started.

## Local design milestone — refinement for review

- Started from clean pushed Section 5 checkpoint **77b5638**. Reused the recorded foundation/account checks and reran the 141-test baseline (one intentional DB-suite skip) and type checking. The previous local design pass had 154 passing tests and one intentional skip. The user then authorized a warm-palette/dot-field refinement and a normal checkpoint commit/push afterwards. No deployment, AI request, sign-in email, database migration or billing change was made.
- Refined the actual React workspace with charcoal surfaces, warm white text, muted amber controls and bright amber primary actions, shared tokens, system typography, consistent buttons/focus, compact mobile rules and optional details. Empty headline: **Turn your group chat into a plan.** One support line, higher composer, honest **Paste your group chat here.** placeholder, zero count, paste/upload switch and adjacent **Try an example**. Empty step navigation is deferred; pasted conversations skip Transcript. Provider disclosure remains visible before submission.
- Compact availability/budget/open-question summary cards share a short staggered reveal for prepared samples and AI previews, then settle. Samples explicitly say **Sample summary** and **Manually authored sample data**. Names/mappings, fact editing, source quotes and request diagnostics remain accessible in disclosures; unknown amounts, tentative dates, conflicts and visibly unreviewed claims are preserved. Explicit AI acceptance, replacement confirmation, errors and stale warnings remain active.
- Screenshot selection/order/limits, separate Read and Analyze requests, corrections and provenance retain their established behavior. Transcript messages are readable rows with focused editors. Panels remain mounted across modes/stages/groups to retain in-progress edits; distinct component key prefixes fix sibling-key collisions discovered during interaction testing. A stale asynchronous result leaves the current editor/focus in place and cannot replace newer work. Supporting screenshot links open the relevant stage and focus the thumbnail.
- Two refined repo-native rounded mascots, **Spark** (provisional) and **Arc**, use exactly three fuse dots: amber farthest, warm ivory toward the body. Wider/heavier smiles and visible fuse attachments were inspected as actual rasterized SVGs at 16/24/40 in color/monochrome on light/dark; static favicon/header proofs inspected. Original three explorations are archived in the local development preview at **/?design=logos**. No application screenshot or real CSS animation timing is claimed from those static proofs.
- **Light the fuse** is an 800ms SVG/CSS inward spark sequence with a small body lift and deeper smile opening. Workspace opening plays once; deliberate header hover replays after 140ms. The header stays steady while reading/editing. Actual requests reuse only the three-dot waiting cue, removed on success/error/cancel. Summary cards settle within 340ms. Reduced motion uses immediate/static states, hidden-page motion pauses, a persistent animated dot field dims behind reading, favicon stays static. Preview includes replay and actual header/favicon sizes.
- Added one lightweight canvas with 760 stable oval points (240 on phones), independent breathing, a diffuse 26-second amber wave and a few-pixel outer drift. Rendering is capped at 30/24fps and 1.5× density; offscreen, hidden-tab and inactive-workspace states pause it, and reduced motion draws a static field. Input/stage changes retain the same canvas. Geometry proofs were inspected at desktop/phone sizes. Removed competing summary/surface/details entrances, fixed quick-stage-return reveal restarts and stabilized the Analyze loading layout. No real browser timing claim.
- Added a development-only Happy DOM registrator for meaningful isolated interaction coverage; resource/script loading is disabled and all network responses are synthetic mocks. No runtime dependency, backend behavior, provider configuration/schema validation, authentication architecture or database schema changed. Existing account ownership, expiration/sign-out, persistence and stale-save controls remain; their hosted manual acceptance is still pending.

| Design verification | Actual result |
| --- | --- |
| `npm test` | **159 passed, one intentional DB-suite skip** (160 reported tests). 14 new navigation/DOM checks and four field geometry/lifecycle checks cover explicit empty input, sample reveal with no provider requests, keyboard disclosure/heading focus, one-shot/hover/reduced-motion state, retained exact editor nodes, cancelled replacement, AI acceptance/unreviewed labels, late results in both input modes, cancellation/error stopping dots, and corrected screenshot transcript retention |
| Type checking, lint, builds | Passed all workspaces; zero lint warnings |
| Local HTTP smoke | Workspace, development preview, static favicon, animated SVG and proxied health returned 200 |
| Contrast tokens | Warm-white/canvas 16.50:1, muted/surface 7.73:1, placeholder/surface 5.60:1, primary button 10.66:1; calculations do not establish whole-page accessibility |
| Field lifecycle checks | Four passed: deterministic quiet-center desktop/phone geometry, smooth phases, DPR/rate limits, visibility/inactive pause, cleanup and reduced-motion preference changes |
| SVG proof generation/inspection | Both refined marks, 16/24/40 color/monochrome/light/dark; header/static favicon inspected. Proofs remain ignored under artifacts/design |
| Secret and diff review | No private configured credential match in candidate source or emitted frontend assets. API .env remains 0600, ignored and untracked. Candidate/staged files are checked before the requested checkpoint. Backend/shared source and private configuration untouched |
| Browser/desktop/mobile captures | **Unverified:** browser discovery returned no browser. Safari is installed but no controllable browser is connected. No real application desktop/phone render, screenshot capture, layout, animation-timing or assistive-technology verification. DOM simulation does not render layout |
| Hosted account workflow | **Unverified:** callback completion, signed-in identity, original-tab edit preservation, hosted save/reload/reopen, edit/delete, sign-out/expiry, two-account isolation, stale-save and remaining browser/mobile checks. Existing successful database/migration and automated results below remain historical evidence, not full Section 5 acceptance |

See [DESIGN.md](DESIGN.md) for code/state decisions, logo assets, exact local motion replay, and desktop/320–360px checks. README, screenshot navigation and account review instructions were updated to the actual labels. **Stop before Section 6.**

## Section 5 — organizer accounts and saved groups

- Reviewed the specification, repository instructions, current code, README and Section 4 history. Started from clean a3dc405, reran the 114-test baseline, checked secrets, and made the requested local Section 4 checkpoint **0fe4699**. No push. Jace's reported manual screenshots establish only the described preview/transcript/editor/zero/unknown/tentative/unreviewed observations; replacement, stale, keyboard and mobile checks remain independently unverified. Browser discovery returned []. The optional conversation reference date already defaults empty; explicit entered values and existing behavior were preserved.
- Chose Supabase managed Auth + PostgreSQL to use one Free development project, after checking current official docs/pricing/SMTP restrictions. Initially implemented typed email codes; now adapted to the **default email magic link**, because Jace's default-sender dashboard requires SMTP for template edits. Added supabase-js 2.119.0 and stable Prisma/client/pg adapter 7.10.1 (latest Prisma 8 was an RC), using the existing React/Vite + Express architecture. No app password store/auth cryptography, service-role frontend credentials, paid resources, project creation by Codex, billing changes or AI calls.
- Private schema **fuzl** contains organizer identity (verified Supabase UUID), organizer-owned groups, separate participant aliases, and exactly-one-group sessions with schema-versioned existing summary JSON, text correction provenance and CAS revisions. The migration creates only its own schema/tables/history, enables RLS, and revokes public/anon/authenticated table access. It does not reset unrelated existing data; a real test preserved a pre-existing public sentinel table.
- Every private route verifies the bearer with Supabase getUser, rejecting anonymous/unconfirmed/invalid/expired identities. Queries scope group/session/alias/source operations to that verified subject, including create and move targets. Client owner IDs are rejected. Private requests omit cookies, require authorized origins/headers, use no wildcard CORS and return no-store. No private budgets, excerpts, tokens, SQL payloads or database URLs are logged. The public config route exposes only the designated project URL/publishable key, or configured=false.
- Added compact Workspace / Saved groups navigation. Session lists select metadata only, not source/budget JSON. A synchronous workspace edit revision closes the delayed-Open stale-closure race and guards save acknowledgments against newer/unapplied edits. Sign in/out, group creation/renaming/alias edits, group/session lists/deletion, titled explicit Save, reopen/edit/save, Save as new session and conflict recovery are implemented. Switching views preserves workspace/form state; opening a different session confirms replacement. Open fact/question forms must be applied/cancelled before Save. beforeunload guards supported browser navigation. Failed saves preserve editor input; same-account reauthentication can retain it. Auth SDK restore/refresh uses only its designated browser session cache; sign-out/account switch remounts the workspace, aborts old requests and releases private UI data. SDK disposal closes background listeners/channels. Browser interactions remain unverified.
- Saving sends only the applied structured summary and fact-cited excerpts, not raw images, full draft/transcript or unused source text. Required quote/correction provenance remains immutable under retained source IDs; deleting facts can remove unused saved excerpts. Zero/null, firmness/status/uncertainty, speaker mappings and review metadata round-trip. A dedicated saved-summary validator allows evidence-free manually entered facts; AI provider and analysis-response evidence schemas stay unchanged and strict. Group aliases never authenticate people or become permanent budgets/preferences.
- Saved screenshot provenance keeps original/reviewed text, alias, visible-time corrections, uncertainty and stable screenshot references only for cited sources. Reopened evidence explicitly says the raw image was temporary/not saved, with no broken image links or claim of pixel verification. Accepting or saving AI claims does not mark them reviewed/confirmed automatically.
- Magic-link adaptation: checked current official Supabase passwordless, implicit-flow, session SDK, redirect and default-SMTP documentation. This browser SPA explicitly uses implicit flow and default templates. A fixed `http://127.0.0.1:5173/auth/callback` receives fragment credentials, removes them from history synchronously before React/configuration loading, then uses SDK setSession for remote verification/refresh and cross-tab session notification. Query/unsupported/recovery/duplicate/error links are rejected safely. No custom template, SMTP, server auth cookie, arbitrary return destination or token logging was introduced. Callback completion is once-only; success requires an established session, not an email-send response. Existing backend getUser/ownership/revision checks, workspace account lifetimes, sign-out/expiry cleanup and editor protections are unchanged. Original-tab/new-tab guidance preserves temporary work; navigation cannot restore unsaved memory.

## Section 5 verification and remaining setup

**Checkpoint status: Section 5 is not fully verified.** Hosted database connection/migrations and automated checks passed. Jace reports that the sign-in email was sent; callback completion and the real account workflow have not yet been verified. This checkpoint does not establish manual acceptance of Section 5.

| Check | Actual result |
| --- | --- |
| npm ci | Passed fresh locked installation; prepare builds shared package and generates Prisma client with no service credentials |
| npm test | **141 passed, 1 intentional DB-suite skip** (142 reported tests), rerun after DIRECT_URL selection. Six migration-configuration tests cover strict TLS translation, credential/CA preservation, direct precedence/empty fallback, invalid selected-direct failure, offline/local configuration and safe errors, plus existing SDK magic-link/text/screenshot/ownership tests |
| npm run test:db | **9 passed**, rerun after the runner explicitly overrides both DATABASE_URL and DIRECT_URL to prevent Prisma dotenv selecting the hosted DB. Real Homebrew PostgreSQL 16.14 owned disposable cluster, real tracked migration/reapply, unrelated-existing-data preservation, HTTP bearer/origin checks, A/B read/list/create/move/update/delete isolation, synthetic-summary round trips, manual source-free facts, immutable quotes/provenance, stale concurrent saves, alias edits and cascade deletion; own cluster stopped/removed |
| npm run typecheck; npm run lint | Passed; strict workspace types and zero lint warnings |
| npm run build | Passed shared/web/compiled API; auth SDK lazy-loaded separately from temporary workspace |
| npm audit --omit=dev | Zero runtime findings; fresh install still reports the previously documented 10 moderate development-tool findings, no force/override used |
| Compiled API/HTTP smoke | Compiled API started on temporary port 3002: health 200, account configured=false, unauthenticated private groups 401; development proxy health 200 and Gemini still selected. Temporary compiled process stopped |
| Current runtime smoke / browser | API's actual Prisma adapter read hosted fuzl tables successfully; no groups/sessions created by verification. Local `/auth/callback`, proxied health/account metadata return 200; account configured=true and public values match private config. Unauthenticated private groups return 401. Existing dev API/web remain running. Browser discovery: `[]`; rendered callback/new-tab behavior and real account flow remain unverified |
| Sign-in email | **Sent, as reported by Jace.** No additional email was sent while preparing this checkpoint; email sending does not establish callback completion or a signed-in identity |
| Pending real/manual acceptance | **Not yet verified:** callback completion, signed-in identity, original-tab edit preservation, hosted save/reload/reopen, sign-out behavior, real two-account isolation, and remaining browser/mobile/keyboard/accessibility, edit/delete, replacement, expiration and stale-save checks |
| git diff --check / final secret scan | Passed; no credential match in candidate sources or emitted frontend assets; generated client/builds ignored |
| Secrets/configuration | Password privately updated by Jace and verified through successful database authentication. .env remains 0600, ignored/untracked; examples have blank credential values. Gemini/settings preserved; added private DIRECT_URL for migration-only direct access to the same project, retaining pooler DATABASE_URL. Downloaded CA kept outside Git, runtime verify-full/rootcert and native CLI require/strict/sslcert retain verification. No credentials, private connection strings/certificates or tokens belong in this checkpoint; no live AI call |
| Real hosted TLS/migration | Pooler client TLS 1.3 certificate/hostname verification and read-only queries passed. Prisma pooler preflight failed; read-only native diagnostics exposed P1011 certificate-not-trusted. Local macOS trust evaluation identified leaf validity/ServerAuthEKU failures (1,825-day legacy leaf). Direct endpoint's 730-day/server-auth leaf passed Node + native Prisma checks over IPv6. DIRECT_URL resolved the failure with no verification bypass, global trust change or billing action. Existing migration 202611060001_organizer_sessions applied in 2,502 ms; db:status exits 0/up-to-date |
| Hosted post-migration checks | Expected 5 tables including history; all RLS enabled; anon/authenticated have no table privileges; exactly one completed migration with matching local SQL SHA-256; unrelated relation catalog hash unchanged; no application records seeded/created. Direct socket certificate/hostname and PostgreSQL SSL checks passed. No reset or deletion performed |

A real database test caught bodyless DELETE being rejected by the JSON content-type guard; corrected it and verified successful owned deletes plus cross-owner 404s. Managed-auth verification tests use the official SDK with mocked known-provider responses; the database ownership suite uses controlled A/B verifier identities with real PostgreSQL, not a mocked repository. This distinction does not establish hosted Supabase/JWT/account setup.

Jace reports the project is on Free and the exact local auth URLs are saved. Hosted authentication of database credentials, strict client TLS, additive migration deployment/status, grants/RLS/history and API adapter reads are now verified. The original pooler attempt failed before migration application; CLI's generic error hid a native P1011. No TLS validation was weakened. My initial preflight incorrectly also treated backend pg_stat_ssl as a client TLS test; the actual socket confirmed client TLS, while the statistic described the separate pooler-to-database hop (ssl=false). Direct PostgreSQL reported SSL=true. This does not establish provider internal-network guarantees; details are in ACCOUNTS.md.

Jace reports that **the sign-in email was sent**. Next: observe the existing link's callback and signed-in identity, confirm original-tab edits survive, then verify hosted save/reload/reopen, edits/deletion/conflicts, sign-out and controlled-account isolation. Do not send another email as part of this checkpoint. No authenticated organizer/group/session data was manufactured to claim a real workflow pass. App health/account configuration is ready, with no paid resource or AI call. Exact manual steps are in [ACCOUNTS.md](ACCOUNTS.md).

**Unverified:** callback completion, signed-in identity, preservation of original-tab edits, hosted save/reload/reopen, sign-out behavior, real two-account isolation, and remaining browser/mobile/keyboard/accessibility, replacement/stale-save/expiration/close/edit/delete flows. Browser discovery is empty. The email was sent (user-reported), and hosted migration/client TLS is verified as described above; neither proves these manual checks. No account-delete UI/full revision history/server-idempotent creates or provider backup-erasure guarantee is implemented. Source quotes verify correspondence to their reviewed transcript, not screenshot pixels. Documentation separates temporary imports, explicitly saved excerpts and the provider auth cache.

Section 5 is recorded as a **checkpoint with manual acceptance still pending**. Jace explicitly authorized this checkpoint commit and a normal push of the current branch, including the existing 0fe4699 baseline checkpoint. This does not mark Section 5 fully verified. No deployment, billing change, additional email, invitations, guest links, voting, recommendations, memory, messaging integration or Section 6 work is included.

## Section 4 checkpoint before Section 5

- Section 4 is already committed/pushed as a3dc405; the working tree was clean. Reran all 114 offline tests successfully and reused unchanged type/lint/build/health verification. No AI request made.
- Jace reports manual screenshots showing previews/transcription, transcript-to-draft, editable AI summary, zero versus unknown budgets, tentative dates and unreviewed labels. These are user-reported observations, not independent verification of every browser interaction. Declining replacement, stale-result protection, keyboard and narrow layout remain unverified; browser discovery returns [].
- Optional conversation reference date is already initialized to an empty string; no change needed and explicitly entered dates stay.
- Exact private-key scan passed; existing .env ignored/untracked. This local documentation checkpoint records the reviewed Section 4 baseline before account/persistence changes. No Section 5 push was authorized at that time; Jace's later request now authorizes the Section 5 checkpoint push described above.

## Section 4 implementation

- Baseline: reviewed the specification/instructions, README, progress and Section 3 diff. Reused recent unchanged checks, reran the 93-test baseline and type check, and confirmed browser discovery returns `[]`. No interactive Analyze/accept/edit, replacement-dialog or mobile claim is made. Exact current private key matched zero project candidates; `.env` remains ignored/untracked. Created local Section 3 checkpoint **9e9383a — Fix Gemini attribution and add safe extraction diagnostics**. No push.
- Added deliberate image selection → preview/order/remove → Read screenshots → editable transcript → Use reviewed transcript as draft → separate Analyze conversation → existing explicit summary acceptance. Selection/reordering/removal never call AI. Existing samples, manual editor, pasted-text analysis, Gemini selection and separate OpenAI option stay. Screenshot reading requires the selected Gemini option; there is no fallback or billing change.
- Shared screenshot/transcript types retain stable screenshot/message references, visible aliases/timestamps, uncertainty and uncertain duplicates. Original readings, organizer corrections/manual additions and planning claims remain distinct. Source quotes lead to reviewed messages, original readings and available screenshots; a quote match is explicitly not pixel verification. Unknown attribution stays Unknown unless the organizer supplies an alias. Overlaps, corrections and conflicts are retained, not merged or resolved automatically.
- Browser/server limits: 5 files, 5 MiB each / 15 MiB total, 4096 pixels per side, 8 MP each / 20 MP total. Backend Sharp 0.35.5 checks actual PNG/JPEG type and full decoding, rejects animations/corrupt/truncated files and bounds pixels independently. Encoded JSON is capped and uncompressed; provider inline payload is checked against Google's 20 MB budget before sending. No file uploads to disk, cloud storage, Files API or database.
- Both routes share bounded attempts/concurrency/deadlines and existing sanitized failure diagnostics. Read results bind to exact order plus revision; edits/clear invalidate old results. Linked transcript edits, including reference-only edits, invalidate pending planning results through an additional source revision. Draft/summary replacement confirmations and visibly unreviewed claims stay. Invalid transcript inputs block planning; manual textarea edits detach image traceability clearly.
- Temporary handling: browser object URLs revoked on removal/replacement/cleanup, including abandoned previews. Backend uses Buffer input, disables Sharp's cache, zeroes decoded input Buffers and releases references in success/failure/cancel finally paths. Route body references are released. Native operations can finish before release and JS strings await garbage collection; no immediate secure erasure guarantee. Full screenshot/transcript Clear clears its trail but retains the separately editable draft/summary as disclosed. Removing individual images retains reference-only provenance.
- Added five reproducible synthetic image fixtures and generator, offline mocked image/provider/HTTP tests, source-trace/editor markup tests, selection/revision/URL cleanup tests and opt-in two-stage evaluation. Broader visual accuracy on overlap/cropped/correction/conflict/hostile images remains unmeasured live. README, SCREENSHOTS, AI_INTEGRATION and GEMINI_SETUP document current lifecycle/configuration and exact manual checks.


## Actual Section 4 verification

| Check | Result |
| --- | --- |
| npm test | Passed: **114 offline tests**, mocked provider calls; no live requests from tests |
| npm run typecheck | Passed for shared package, web, Vite tooling and API |
| npm run lint | Passed, zero warnings |
| npm run build | Passed, compiled shared/API and Vite assets |
| API and Vite-proxied health; public provider config | HTTP 200; Gemini / gemini-3.5-flash-lite remains selected |
| Compiled API runtime on temporary port 3002 | Started compiled ESM API, health HTTP 200; stopped cleanly, existing dev servers kept |
| Screenshot eval without opt-in | Exited 1 before any requests with explicit opt-in instructions |
| npm audit --omit=dev | Zero runtime vulnerabilities |
| git diff --check; exact-key candidate scan | Passed; zero private-key matches, .env ignored/untracked; no secret printed |
| Browser discovery | `[]`; interactive and rendered checks **unverified** |

### Live synthetic results — stopped at three Gemini calls

All raw conversations/images stayed out of logs. Metrics below were actually reported; estimated USD cost is null for each call, with project tier/remaining quota unknown. No billing changes, fallback, automatic retries, or bulk evaluation.

| Attempt | Result |
| --- | --- |
| Gemini call 1: Read fixtures/screenshots/01-clear.png | HTTP 200, 2049 ms total / **2019 ms provider-adapter**. 1408 input / 276 output tokens. Three transcribed messages/aliases/texts/timestamps matched the authored synthetic fixture exactly. |
| Local planning attempt after that read | Failed before reaching the API/provider: Vite reported ECONNREFUSED because a shared-package type check restarted the watched API during evaluation. No Gemini request or token metrics for this attempt. Corrected test procedure: finish checks before live work, verify health, and do not rebuild from the screenshot-evaluation command. No image reread. |
| Gemini call 2: planning from the reviewed, fixture-matched text | HTTP 200, 2411 ms total / **2376 ms adapter**. 730 input / 707 output tokens. Schema/source validation passed and claims stayed unreviewed, but the semantic evaluation **failed**: no explicit null-budget fact for Sam (two facts total). This result is not reported as a fully passing extraction. |
| Gemini call 3: targeted planning verification | Clarified the extraction prompt to retain an explicitly stated unknown budget as a per-speaker null fact plus question; application validation unchanged. Added a deterministic regression for separate zero/null budgets and attribution. Offline checks passed before the final call. HTTP 200, 2281 ms total / **2245 ms adapter**, 792 input / 493 output tokens. Three facts; Alex USD 0 and Sam amount/currency null were correctly attributed, tentative availability had no invented date, all claims remained unreviewed, none confirmed, all source quotes matched the reviewed transcript. All six evaluation checks passed. |

This demonstrates a synthetic image read → review against its fixture → text extraction → validated planning summary through the API. It does **not** establish an uninterrupted browser journey, arbitrary-image accuracy, or robust semantics from one case. The first two-stage script stopped on the local failure; subsequent planning checks used the manually reviewed text whose image reading had matched exactly, not fixture planning output substituted for AI. There were **four local POST attempts total, three reached Gemini**. No further requests were made after the final success.

Browser selection/order/removal, actual transcript edits and dialogs, acceptance/edit/keyboard behavior, narrow viewport, live network/storage observations and cancellation races remain unverified. Follow [SCREENSHOTS manual checks](SCREENSHOTS.md#manual-browser-checks--unverified). Overlap, cropped identities, corrections, conflicts and embedded instructions have synthetic fixtures/offline validation coverage but were not sent in further live image requests. Remaining semantic limitations include omissions despite prompts and unverified visual transcription: organizer review/manual fallback remains necessary.

Section 3 checkpoint **9e9383a** is local and unpushed. Section 4 changes remain **uncommitted** for review. No push, deployment, database, account, saved-group, recommendation, voting, memory, messaging integration, or Section 5 work.

## Historical Section 3 Gemini diagnosis — complete extraction succeeded

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

This historical stopping boundary was advanced by Jace’s later instructions. The active boundary is now **after Section 6**, as authorized by the latest attached request.
