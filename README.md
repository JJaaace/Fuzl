# Fuzl

Turn your group chat into a plan.

Fuzl helps one organizer turn selected conversation context into an editable plan. **Section 6 adds account-free guest answers to owned saved sessions**, alongside organizer sign-in, private groups and explicit saving/reopening. The temporary text/screenshot workspace remains usable without an account. Friends do not need accounts.

Supabase supplies managed email magic-link Auth and PostgreSQL; Prisma migrations and server ownership checks protect saved work. No voting, attendance confirmation, recommendations, final-plan sharing, group memory, messaging integrations or native features are implemented. The original [specification](FUZL_CODEX_SPEC.md) is unchanged; Jace authorized through Section 6. Stop before Section 7.

## Current design review

The local design milestone uses a warm charcoal, ivory and amber palette and existing Section 1–5 behavior. The opening workspace puts **Paste conversation / Upload screenshots**, the empty composer and **Try an example** first. Stage navigation appears when there is somewhere useful to return; pasted text skips transcript review. Results lead with availability, budgets and open questions, with names, full fact editors and sources in expandable sections.

Open http://127.0.0.1:5173 and choose **Try an example → Sample example → Load sample**. All three prepared examples reveal a **Sample summary** without an AI request. Open **Planning facts** to edit details, or **Participants & speaker mappings** to correct attribution. The provider disclosure stays visible before Analyze; live results still need explicit acceptance and remain labeled unreviewed.

The provisional **Spark** mascot has an ivory body, a wide filled espresso crescent and exactly three fuse dots (ember orange, golden yellow, then ivory toward the body). **Light the fuse** pulses brightness inward over 800ms and runs once on workspace opening and on deliberate logo hover; actual requests use only the waiting-dot sequence. Reduced motion uses immediate/static states. Compare Spark and Arc at 16/24/40 pixels, inspect the header/static favicon, and replay the animation in the development-only [design preview](http://127.0.0.1:5173/?design=logos). Run `node scripts/make-brand-assets.mjs` then `node scripts/preview-logos.mjs` to regenerate SVGs and ignored raster proofs.

**Historical design checkpoint verification:** 160 offline tests passed, one database-suite skip; type checking, lint and builds passed. These include 14 isolated DOM/navigation tests plus five field geometry/lifecycle checks with synthetic responses, not a real browser. SVG raster proofs were inspected; desktop/phone app rendering, screenshots and hosted account interactions remain unverified because no browser is connected. See [design decisions and precise manual checks](docs/DESIGN.md). This design checkpoint is not deployed; rendered visual review is still pending. Section 6 guest-response work is local; Section 7 has not started.

The opening composition includes a persistent canvas field: 760 desktop dots (240 on phones), a shared diagonal ripple that lifts nearby dots together, slight brightening and a weaker crossing wave. It stays visible around screenshot input and dims behind the summary. Rendering pauses offscreen, on hidden tabs and in Saved groups; reduced motion draws a static field. To see it locally, watch the opening workspace for 5–15 seconds, switch input modes, then load an example. No AI request is needed.

## Ask the group (Section 6)

Open an owned saved session and choose **Ask the group**. Write/review a guest-visible title and up to five questions, preview the form, approve its wording, then create/copy an expiring invite into your existing chat. Temporary work says **Save this session to create a link**. One link is active per session; replacement is explicit and revokes the old link and its edit permissions.

Guests need no account. The form preserves tentative wording, unknown currency, known zero, explicit unknown and optional blank answers. Private spending limits are the default: only the respondent sees the amount in this interface; the backend stores it separately and the organizer sees a marker. Other guests never receive replies. This browser retains separate response-edit permission so reload can restore a sent response; it does not store typed drafts. See [guest flow, privacy, routes, migration and exact manual checks](docs/GUESTS.md).

In **Responses**, refresh manually, match an alias explicitly and apply a shareable answer as a proposed fact or resolve a question. Original excerpts and unrelated edits remain; incoming replies do not autosave or overwrite the summary. Explicit Save rechecks fresh guest sources and existing session revisions. Revocation/expiry stops guest read/edit/submission access; collected owner-visible replies remain until session/group deletion.

**Setup/verification:** the new additive migration was applied/reapplied only to an owned disposable PostgreSQL cluster; the configured hosted project has not received it. After review, run `npm run db:migrate` against your intended development database before trying real links. No new credentials are required. Current checks: **168 offline tests passed, two intentional DB-suite skips; 16 disposable-database checks passed; types/lint/build passed.** Browser/mobile, real organizer sign-in/save and hosted owner/guest acceptance remain unverified. A copied `127.0.0.1` link works on the same computer; friends need a reachable HTTPS frontend/API and exact APP_ORIGIN configuration, described in GUESTS. No deployment or network exposure was enabled.

## Save and reopen a session

1. Follow [account/database setup](docs/ACCOUNTS.md). Add SUPABASE_URL, the designated public SUPABASE_PUBLISHABLE_KEY, private DATABASE_URL, and optional private migration-only DIRECT_URL to the existing apps/api/.env; preserve the AI settings. The local setup uses DIRECT_URL to avoid a demonstrated macOS pooler-certificate incompatibility while retaining strict TLS. Use the Free project and default magic-link sender/templates. Set Site URL to `http://127.0.0.1:5173` and allow only `http://127.0.0.1:5173/auth/callback` as the local redirect. No SMTP or billing setup is required. No credentials or email links go into chat or frontend environment variables.
2. Run `npm ci`, `npm run db:migrate`, then `npm run dev`. Open http://127.0.0.1:5173. **Saved groups** has sign-in and group creation; **Workspace** keeps the editor separate.
3. Sign in, create a group, then return to the workspace and load a sample. Edit/apply a fact, enter a session title/group, and choose **Save session**. Saving stores the applied summary, review labels and fact-linked supporting/correction excerpts. It does not store raw images or the full imported conversation, call AI, or confirm claims.
4. Reload, select the group, and **Open session** to continue editing. Later saves use revisions; stale edits produce a recoverable conflict. Sign-out/account switching clears loaded private work and cancels old responses. The auth SDK session cache persists in browser storage; planning data does not.

Database migrations/authorization/fidelity are tested against a disposable real PostgreSQL instance. Real hosted TLS connections, migration deployment/status and API adapter reads now pass; the app is running with account configuration available. Hosted email sign-in/save/reopen and full browser behavior remain unverified; browser tooling is unavailable. Jace reports the sign-in email was sent; callback completion, signed-in identity, original-tab edit preservation, hosted save/reopen, sign-out, real two-account isolation and remaining browser/mobile checks are still pending. See [ACCOUNTS](docs/ACCOUNTS.md) and [PROGRESS](docs/PROGRESS.md) for setup, deletion limits, actual checks and a precise manual test. Section 4 was pushed as a3dc405; the Section 5 checkpoint includes baseline 0fe4699 and explicitly leaves manual acceptance pending.

## Try screenshot reading

Select up to five PNG/JPEG screenshots (5 MiB each, 15 MiB total), check previews/order, and explicitly choose **Read screenshots**. Review/correct text and unknown aliases, then **Use reviewed transcript as draft**. Choose **Analyze conversation** separately, review the candidate summary, and accept it into the existing editor. Reading and analysis are separate AI requests; selecting or editing files sends nothing. Gemini is required for image reading; OpenAI remains available for pasted text. No automatic provider fallback occurs.

Use the five synthetic images in `fixtures/screenshots`. Pixel limits are 4096 per side, 8 megapixels per image and 20 total; very large encoded sets may also exceed Google's 20 MB inline-request budget. Raw images stay in browser/backend memory, with no raw image persistence. Explicit Save stores only the summary and required supporting/correction excerpts. Removed previews are revoked. Explicit Clear/reload releases screenshot/transcript state; existing draft/summary clearing has separate controls. Google's retention is separate from Fuzl's lifecycle.

See [Screenshot workflow, lifecycle, tests and exact manual checks](docs/SCREENSHOTS.md). At the Section 4 checkpoint, all 114 offline tests, type checking, linting, builds and health checks passed; current design checks are recorded above. A synthetic screenshot read matched its fixture, and final text extraction preserved separately attributed zero/unknown budgets and tentative dates with unreviewed claims. Three Gemini calls were used, including one planning completeness failure before a prompt correction; one extra local attempt failed before reaching the API. Full results and measured usage are in PROGRESS. Browser interactions remain unverified because no browser is connected. Section 3/4 are committed; Section 5 is checkpointed with manual verification pending.

## Configure and try AI extraction

1. Copy `apps/api/.env.example` to **`apps/api/.env`** if that file does not exist. Set `AI_PROVIDER=openai` with `OPENAI_API_KEY`, or `AI_PROVIDER=gemini` with `GEMINI_API_KEY`. Only the selected key is required. Keep keys out of chat, frontend code, `VITE_` variables, and Git. Omitted AI_PROVIDER defaults to OpenAI for compatibility; invalid values fail without fallback.
2. For **Gemini Free Tier testing**, follow [Gemini setup](docs/GEMINI_SETUP.md): obtain an AI Studio key, verify its project's Free Tier status, any required verification, and the model's current quotas. Do not enable billing. For OpenAI, review a small project budget first. Then set `AI_ENABLED=true` and restart `npm run dev`.
3. The page reads public provider/model metadata before enabling Analyze. Confirm the displayed provider and disclosure. **Analyze sends the draft and optional conversation date only to that provider.** A backend provider change requires reloading the disclosure; it cannot silently send to another provider. Editing alone does not send text. Use synthetic conversations for Gemini development.
4. The result is staged separately. Choose **Use extracted summary** to open it; replacing an existing summary requires confirmation, including for unapplied form edits. If the draft/reference date changed since submission, that result cannot be applied. Cancel stops waiting and requests backend cancellation; a provider call already started may still incur usage.
5. Inspect **AI claim — unreviewed**, uncertainty, scope, and **Supporting submitted text**. Use Edit fact and Apply changes to mark a fact reviewed; choose confirmed only when justified. AI-reported confirmation does not silently become user confirmation. Source quotes stay unchanged.

Provider: OpenAI Responses with pinned `gpt-5.4-mini-2026-03-17`, strict structured output, `store: false`, and no tools/retries. The model supports structured outputs and standard token pricing of $0.75/M input and $4.50/M output as checked November 6, 2026. This is an initial selection, not a measured quality claim. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

Optional Gemini model: stable `gemini-3.5-flash-lite`, documented with structured output and Free Tier input/output. Account eligibility and quota are not guaranteed or checked by Fuzl. No paid-provider fallback exists. [Google model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).

Fuzl keeps planning data in memory and does not log raw text or save it. Provider handling is separate: OpenAI says API content is not used for training by default unless opted in; standard abuse-monitoring logs may retain content for up to 30 days, with exceptions. `store: false` does **not** promise zero retention. Account-specific retention controls have not been verified. [Official data controls](https://developers.openai.com/api/docs/guides/your-data)

See [AI integration and evaluation](docs/AI_INTEGRATION.md) for the contract, validation limits, development request cap, offline/live evaluation, and manual browser checks.
Google's unpaid-service handling differs; use synthetic text and read [Gemini data handling/setup](docs/GEMINI_SETUP.md#data-handling).

## Try the three examples

At http://127.0.0.1:5173, open **Try an example** beside the composer, select a **Sample example**, then click **Load sample**:

| Example | What to inspect |
| --- | --- |
| Straightforward plan | Explicit November 14, 2026 availability, individual USD budgets, travel limits, and an unbooked bowling idea |
| Missing & tentative details | Original Foundation conversation: “Friday” has no invented exact date, “maybe” stays tentative, missing budgets and currency stay unknown |
| Conflicts & a correction | Indoor/outdoor requirements conflict; Ren’s corrected USD 15 limit is used and both original statements remain inspectable |

Each opens as **Sample summary**, labeled **Manually authored sample data**, never AI analysis. Loading replaces the current draft and summary, including edits; existing drafts, summaries or selected screenshots trigger replacement confirmation. Screenshot selections remain until separately cleared. Merely selecting another example does not replace anything. To test live extraction of a sample conversation, explicitly use Analyze conversation; the sample summary is never substituted for a provider response.

Expand **Participants & speaker mappings** to rename participants or change a speaker mapping to correct attribution across linked facts. Expand **Planning facts**, select **Edit fact**, change its fields/status/firmness, and **Apply changes**; Cancel discards unapplied edits. Expand **Supporting sample text** to inspect original quotes. These quotes never silently change to justify your corrections.

Use **Add participant** and **Add information** for missing details. For a manual fallback, choose **Start blank summary**, which preserves the draft and starts with no inferred facts. **Clear draft** clears only the conversation, **Remove summary** removes only the summary, and reload clears all planning state. Replacing/removing an existing summary requires confirmation.

Editing or clearing the draft after loading a summary shows a mismatch warning while preserving summary edits. Returning it exactly to the original snapshot clears the warning. Analysis runs only on explicit submission; edits never automatically reanalyze or resolve conflicts. Questions/conflicts remain separate: an issue needs a written resolution to be marked resolved, and an answer does not silently change related facts.

## Data model and local edits

[model.ts](packages/planning/src/model.ts) preserves the existing model in a small shared workspace so the web and compiled API use the same types and validators. The original web import path re-exports it. It defines stable participant IDs, speaker mappings, source text, typed facts, and questions. Facts carry **proposed / tentative / confirmed / conflicting** status separately from **firm / flexible / unknown** strength. Optional AI provenance adds review state, reported status, uncertainty, current/historical scope, and superseded fact IDs. Remapping a speaker updates linked attribution without rewriting quotes; direct person attribution stays with that person.

Unknown values are `null`, not zero or guessed text. A budget of zero is a known limit; a blank amount is unknown. Currency can remain unknown independently of the amount. Dates retain the conversational description separately from an optional exact date and optional time boundaries. An ambiguous Friday stays ambiguous. Travel distinguishes “under” from “at most.” Multiple date/time facts can represent different participants or possible windows.

[examples.ts](apps/web/src/planning/examples.ts) contains all three fixtures. Loading clones a fixture into React state, so edits cannot contaminate it or another sample. [SummaryReview.tsx](apps/web/src/planning/SummaryReview.tsx), [FactEditor.tsx](apps/web/src/planning/FactEditor.tsx), and [Questions.tsx](apps/web/src/planning/Questions.tsx) render the review and forms. Name/mapping changes update immediately; fact/question forms validate before applying changes. Blank fields mean unknown. Validation rejects negative/overprecise/unsafe budget amounts, malformed three-letter currency codes, fractional/negative travel minutes, invalid dates, and end times that precede or equal their same-day start. Currency format is checked; it is not a currency conversion or supported-currency service. Overnight windows need separate date/time facts. Status and questions never update automatically from content edits.

## Setup

Use **Node 24.18.0 and npm 11.16.0**, the installed and verified toolchain. `.nvmrc` pins Node; the root manifest accepts Node 24.18+ within version 24 and npm 11. With nvm:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API listens at **http://127.0.0.1:3001**. Samples, manual entry, and health require no credentials. AI requires the selected provider's key and explicit enabling; Gemini can use an eligible Free Tier project. Ctrl+C stops both servers. Installation builds the shared package automatically; root dev/test/typecheck/build commands also build it first. After editing shared source, restart root development to rebuild it.

Versions were selected after checking installed versions, the [Node LTS schedule](https://nodejs.org/en/about/previous-releases), [Vite requirements](https://vite.dev/guide/), [Express requirements](https://expressjs.com/en/starter/installing/), and npm engine/peer metadata. React 19, Vite 8, Express 5, and ESLint 10 are pinned in manifests and the root lockfile. TypeScript **6.0.3** is intentional: typescript-eslint 8.72.1 requires TypeScript below 6.1, so TypeScript 7 is incompatible. `concurrently` manages the two development processes; `tsx` watches API TypeScript. No future-feature dependencies are installed.

## Commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies and update the single root lockfile when needed |
| `npm ci` | Reproduce the locked installation from scratch |
| `npm run dev` | Start both servers; stop the other when either command exits |
| `npm run dev:web` | Run only Vite on port 5173 |
| `npm run dev:api` | Check port availability, then watch the API on port 3001 |
| `npm run db:generate` | Generate the server Prisma client without connecting |
| `npm run db:migrate` | Apply additive tracked migrations to the configured fuzl schema; never reset |
| `npm run test:db` | Exercise real migrations/CRUD/isolation on an owned disposable local PostgreSQL cluster |
| `npm run typecheck` | Strictly check frontend, Vite config, and API TypeScript |
| `npm run lint` | Lint source and tooling with zero warnings allowed |
| `npm test` | Offline contract/provider-mock/HTTP/evaluation/state/DOM tests; no provider calls |
| `npm run fixtures:screenshots` | Regenerate the five synthetic chat-image fixtures |
| `npm run eval:screenshots -- --confirm-live` | One deliberate synthetic screenshot read; add --analyze-reviewed for a second planning call after fixture review |
| `npm run eval:live -- --confirm-live-eval --case=zero-budget` | One explicit synthetic request to the selected provider; check tier/quota/budget first |
| `npm run build` | Build web assets and compile API JavaScript |
| `npm run start:api` | Run the compiled API after building |

Stop the development API before starting the compiled API on the same port. Output lives in each app's ignored `dist/` directory. The web build produces static assets. Deployment and production API routing are future work; Vite's development proxy does not ship in that build.

## Request flow and draft privacy

1. [App.tsx](apps/web/src/App.tsx) holds draft/summary in temporary React state. Reload clears the temporary workspace. Explicitly saved sessions can be reopened. Samples/manual edits send no planning text by themselves; only the auth SDK session cache persists in browser storage. A bodyless `GET /api/ai-config` supplies only public provider/model metadata. Analyze POSTs draft/reference date/expected provider through Vite to `/api/analyze`; the backend calls only that provider and validates the result. See [AnalysisPanel.tsx](apps/web/src/planning/AnalysisPanel.tsx) and [provider.ts](apps/api/src/extraction/provider.ts).
2. Check connection calls [api.ts](apps/web/src/lib/api.ts), which makes an **HTTP GET** to `/api/health` without a body. It validates the response, times out after five seconds, supports cancellation, and rejects network, HTTP, and response-format failures. A new check replaces the previous result; there are no automatic retries.
3. The browser sends the relative request to Vite on port 5173. The **development proxy** in [vite.config.ts](apps/web/vite.config.ts) forwards `/api` to port 3001. Browser requests stay on the frontend origin without CORS configuration.
4. The **backend**, [app.ts](apps/api/src/app.ts), returns health JSON and handles bounded analysis requests. [server.ts](apps/api/src/server.ts) starts Express and handles shutdown. The API key stays on the backend and is never sent to the frontend or included in the model prompt.

The connection panel is under **Development & details**; open it and choose **Check connection**. “Connected” means the API answered the last check; it is not continuous monitoring or evidence of AI availability.

```sh
curl -i http://127.0.0.1:3001/api/health
curl -i http://127.0.0.1:5173/api/health
```

Both should return HTTP 200 with:

```json
{"status":"ok","service":"fuzl-api"}
```

## Troubleshooting

- **Stopped API:** start `npm run dev:api` and choose **Development & details → Check connection**. For failure/recovery testing, run web and API in separate terminals, stop the API, check again, then restart it and retry.
- **Occupied ports:** both fail clearly instead of silently moving. Stop the conflicting process or change the port. The API preflight makes an occupied/invalid API port fail before watching, allowing the combined command to stop the frontend too. Change the web port in `apps/web/vite.config.ts` if needed.
- **Different API port:** use `PORT=3002 npm run dev` (or `PORT=3002 npm run dev:api` / `PORT=3002 npm run start:api`) and change the Vite proxy target to `http://127.0.0.1:3002`. Restart Vite after editing configuration. The API now loads optional `apps/api/.env` through Node's environment-file support; exported process variables take precedence. Defaults require no file. Never use `VITE_` variables for secrets.
- **AI errors:** missing configuration is HTTP 503, invalid input 400/413, throttling/quota 429, unusable provider output 502, and timeout 504. No sample is returned on failure. API limits are global to this local process: one in flight, three attempts/minute, ten attempts until restart. Failed/cancelled provider attempts count. Review spend before restarting; this is not a durable dollar budget. Provider timeout is 45 seconds; client timeout is 55 seconds; retries are manual.
- **Gemini quota:** HTTP 429 asks you to check this project's active model limits and retry manually after reset. No automatic retries, billing changes, model changes, or provider fallback occur. A different backend provider than the displayed selection yields HTTP 409 before calling a provider; reload the page. Gemini's USD cost is unknown rather than reported as zero.
- **Dependency audit:** `npm audit` reports 10 moderate development-tool findings through minimatch 10 in ESLint/typescript-eslint. Their current dependency ranges do not accept fixed minimatch 11.0.1. No forced upgrades or overrides were applied. `npm audit --omit=dev` reports zero vulnerabilities. Recheck upstream updates before later work.

## Verification and manual browser checks

See [docs/PROGRESS.md](docs/PROGRESS.md) for exact results. The Section 3 checkpoint passed 93 offline tests, type checking, linting, and builds. Current Section 4 verification is recorded in [PROGRESS](docs/PROGRESS.md) and [SCREENSHOTS](docs/SCREENSHOTS.md). The historical Section 3 diagnosis used **two live synthetic requests**: the first failed source validation at `speakers[0].label` (`speaker_not_in_source`); after constraining generated labels to source prefixes, the second completed with HTTP 200. It preserved the USD 0 budget, exact supporting source, and unreviewed status. Provider latency was 1497 ms, with 713 input / 168 output tokens; cost and project billing tier are unknown. No retry, fallback, billing change, or bulk evaluation ran. Earlier generic failures cannot be reconstructed because their responses were not retained. **Browser flow and broad live extraction quality remain unverified.**

Gemini failures now distinguish upstream HTTP errors, network/TLS failures, deadlines/cancellation, malformed responses, validation, and unexpected adapter exceptions. The UI shows a useful sanitized message and error reference; only server diagnostics include stage/path/rule, upstream status/recognized code, and a fixed safe interpretation of the provider message. Unknown provider text, raw exceptions, keys, URLs, headers, and conversations are never logged. Match the UI reference to the `analysis_failure` line in the API terminal; do not add raw-response logging.

With the app running:

1. Confirm the page title is Fuzl and the textarea has the Conversation draft label. Try all three examples, type/edit/clear the draft, and confirm the mismatch warning appears without changing the summary. Reload and confirm draft and summary are gone. Pasting arbitrary text alone must never create a summary.
2. Check connection. Using separate web/API terminals, stop the API and check again, then restart and retry. Confirm checking, failure, and recovery messages.
3. Rename Sam, remap that speaker, and check linked fact attribution changes while the quote stays unchanged. Edit a budget from unknown to `0` and back to blank. Try `-1`, `12.345`, and currency `US` to check errors. Confirm tentative statements and conflicting requirements do not silently become confirmed. Change firmness/status explicitly and apply, then test Cancel.
4. Edit date/time/activity/travel fields. Try an end time before the start. Add a participant, a missing budget, an activity, and a question manually. Resolve/reopen a question; confirming a resolution requires written text and does not update facts. Reload the same sample to confirm edits reset. Test Start blank summary and manual entry without a sample.
5. In browser developer tools, confirm sample/manual edits send no planning text, configuration/health are bodyless GETs, Analyze POSTs conversation/reference date/expected provider; Read screenshots separately sends selected images, and Save separately sends the structured summary/excerpts. AI configuration must contain only provider/model; account configuration exposes only designated public Supabase URL/publishable key. Confirm backend keys/database credentials are absent from frontend assets/responses, tokens travel only in private/auth transport and stay out of logs, planning data is absent from browser persistence, and API logs contain no raw planning text. Follow [AI integration](docs/AI_INTEGRATION.md) and [Gemini checks](docs/GEMINI_SETUP.md).
6. Inspect all examples with a fact editor open at desktop and mobile widths, including 320px, for readable layout and no horizontal overflow. Tab through buttons, inputs, selects, supporting-text disclosures, and the textarea; check visible focus and keyboard activation. With a screen reader, check labels and polite connection/mismatch announcements.

**Stop after Section 6.** Its implementation is local for review; hosted migration and browser acceptance remain pending. Section 5 manual acceptance also remains pending. Current results and guest checks are in [GUESTS](docs/GUESTS.md).
