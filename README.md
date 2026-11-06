# Fuzl

Turn your group chat into a plan.

Fuzl aims to help existing friend groups turn deliberately supplied conversation context into realistic hangout plans. **Section 3 is integrated with explicit OpenAI or Gemini selection:** send pasted text for AI extraction, then correct candidate facts in the existing editor. Samples, manual entry, and health remain available without credentials. **The latest single Gemini live response was rejected by application validation; successful live extraction remains unverified.**

No uploads, database, auth, guest links, venue recommendations, memory, or native integrations exist. The complete [specification](FUZL_CODEX_SPEC.md) is preserved unchanged; Jace explicitly advanced its original boundary through Section 3. Sections 4 onward remain out of scope.

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

At http://127.0.0.1:5173, select a **Sample example**, then click **Load sample**:

| Example | What to inspect |
| --- | --- |
| Straightforward plan | Explicit November 14, 2026 availability, individual USD budgets, travel limits, and an unbooked bowling idea |
| Missing & tentative details | Original Foundation conversation: “Friday” has no invented exact date, “maybe” stays tentative, missing budgets and currency stay unknown |
| Conflicts & a correction | Indoor/outdoor requirements conflict; Ren’s corrected USD 15 limit is used and both original statements remain inspectable |

Each is prominently labeled **Manually authored sample data**, never AI analysis. Loading replaces the current draft and summary, including edits; an existing summary requires confirmation. Merely selecting another example does not replace anything. To test live extraction of a sample conversation, explicitly use Analyze conversation; the sample summary is never substituted for a provider response.

Rename participants directly, or change a speaker mapping to correct attribution across linked facts. Select **Edit fact**, change its fields/status/firmness, and **Apply changes**; Cancel discards unapplied edits. Expand **Supporting sample text** to inspect original quotes. These quotes never silently change to justify your corrections.

Use **Add participant** and **Add information** for missing details. For a manual fallback, choose **Start blank summary**, which preserves the draft and starts with no inferred facts. **Clear** clears only the conversation, **Remove summary** removes only the summary, and reload clears all planning state. Replacing/removing an existing summary requires confirmation.

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
| `npm run typecheck` | Strictly check frontend, Vite config, and API TypeScript |
| `npm run lint` | Lint source and tooling with zero warnings allowed |
| `npm test` | Offline contract/provider-mock/HTTP/evaluation/state/markup tests; no paid calls |
| `npm run eval:live -- --confirm-live-eval --case=zero-budget` | One explicit synthetic request to the selected provider; check tier/quota/budget first |
| `npm run build` | Build web assets and compile API JavaScript |
| `npm run start:api` | Run the compiled API after building |

Stop the development API before starting the compiled API on the same port. Output lives in each app's ignored `dist/` directory. The web build produces static assets. Deployment and production API routing are future work; Vite's development proxy does not ship in that build.

## Request flow and draft privacy

1. [App.tsx](apps/web/src/App.tsx) holds draft/summary in temporary React state. Reload clears everything. Samples/manual edits transmit no planning text and create no browser storage. A bodyless `GET /api/ai-config` supplies only public provider/model metadata. Analyze POSTs draft/reference date/expected provider through Vite to `/api/analyze`; the backend calls only that provider and validates the result. See [AnalysisPanel.tsx](apps/web/src/planning/AnalysisPanel.tsx) and [provider.ts](apps/api/src/extraction/provider.ts).
2. Check connection calls [api.ts](apps/web/src/lib/api.ts), which makes an **HTTP GET** to `/api/health` without a body. It validates the response, times out after five seconds, supports cancellation, and rejects network, HTTP, and response-format failures. A new check replaces the previous result; there are no automatic retries.
3. The browser sends the relative request to Vite on port 5173. The **development proxy** in [vite.config.ts](apps/web/vite.config.ts) forwards `/api` to port 3001. Browser requests stay on the frontend origin without CORS configuration.
4. The **backend**, [app.ts](apps/api/src/app.ts), returns health JSON and handles bounded analysis requests. [server.ts](apps/api/src/server.ts) starts Express and handles shutdown. The API key stays on the backend and is never sent to the frontend or included in the model prompt.

The compact connection panel is development scaffolding that can leave the main flow later. “Connected” means the API answered the last check; it is not continuous monitoring or evidence of AI availability.

```sh
curl -i http://127.0.0.1:3001/api/health
curl -i http://127.0.0.1:5173/api/health
```

Both should return HTTP 200 with:

```json
{"status":"ok","service":"fuzl-api"}
```

## Troubleshooting

- **Stopped API:** start `npm run dev:api` and select Retry connection. For failure/recovery testing, run web and API in separate terminals, stop the API, check again, then restart it and retry.
- **Occupied ports:** both fail clearly instead of silently moving. Stop the conflicting process or change the port. The API preflight makes an occupied/invalid API port fail before watching, allowing the combined command to stop the frontend too. Change the web port in `apps/web/vite.config.ts` if needed.
- **Different API port:** use `PORT=3002 npm run dev` (or `PORT=3002 npm run dev:api` / `PORT=3002 npm run start:api`) and change the Vite proxy target to `http://127.0.0.1:3002`. Restart Vite after editing configuration. The API now loads optional `apps/api/.env` through Node's environment-file support; exported process variables take precedence. Defaults require no file. Never use `VITE_` variables for secrets.
- **AI errors:** missing configuration is HTTP 503, invalid input 400/413, throttling/quota 429, unusable provider output 502, and timeout 504. No sample is returned on failure. API limits are global to this local process: one in flight, three attempts/minute, ten attempts until restart. Failed/cancelled provider attempts count. Review spend before restarting; this is not a durable dollar budget. Provider timeout is 45 seconds; client timeout is 55 seconds; retries are manual.
- **Gemini quota:** HTTP 429 asks you to check this project's active model limits and retry manually after reset. No automatic retries, billing changes, model changes, or provider fallback occur. A different backend provider than the displayed selection yields HTTP 409 before calling a provider; reload the page. Gemini's USD cost is unknown rather than reported as zero.
- **Dependency audit:** `npm audit` reports 10 moderate development-tool findings through minimatch 10 in ESLint/typescript-eslint. Their current dependency ranges do not accept fixed minimatch 11.0.1. No forced upgrades or overrides were applied. `npm audit --omit=dev` reports zero vulnerabilities. Recheck upstream updates before later work.

## Verification and manual browser checks

See [docs/PROGRESS.md](docs/PROGRESS.md) for exact results. Offline tests cover validation, mocked provider requests, real local HTTP, state, and static markup—not browser clicks or model quality. **Browser checks remain unverified. One live Gemini request returned HTTP 502 / invalid_output after about 2.1 seconds; no summary was accepted and no retry/fallback ran.** End-to-end successful extraction, model quality, provider token usage/cost, and rendered browser behavior remain unverified. CSS uses one-column forms below 540px; source review is not visual verification.

With the app running:

1. Confirm the page title is Fuzl and the textarea has the Conversation draft label. Try all three examples, type/edit/clear the draft, and confirm the mismatch warning appears without changing the summary. Reload and confirm draft and summary are gone. Pasting arbitrary text alone must never create a summary.
2. Check connection. Using separate web/API terminals, stop the API and check again, then restart and retry. Confirm checking, failure, and recovery messages.
3. Rename Sam, remap that speaker, and check linked fact attribution changes while the quote stays unchanged. Edit a budget from unknown to `0` and back to blank. Try `-1`, `12.345`, and currency `US` to check errors. Confirm tentative statements and conflicting requirements do not silently become confirmed. Change firmness/status explicitly and apply, then test Cancel.
4. Edit date/time/activity/travel fields. Try an end time before the start. Add a participant, a missing budget, an activity, and a question manually. Resolve/reopen a question; confirming a resolution requires written text and does not update facts. Reload the same sample to confirm edits reset. Test Start blank summary and manual entry without a sample.
5. In browser developer tools, confirm sample/manual edits send no planning text, configuration/health are bodyless GETs, and only Analyze POSTs conversation/reference date/expected provider. Configuration must contain only provider/model. Confirm keys never appear in browser requests/responses, no browser persistence is created, and API logs contain no raw planning text. Follow [AI integration](docs/AI_INTEGRATION.md) and [Gemini checks](docs/GEMINI_SETUP.md).
6. Inspect all examples with a fact editor open at desktop and mobile widths, including 320px, for readable layout and no horizontal overflow. Tab through buttons, inputs, selects, supporting-text disclosures, and the textarea; check visible focus and keyboard activation. With a screen reader, check labels and polite connection/mismatch announcements.

**Stop after Section 3.** Screenshot work and all later milestones require a new instruction.
