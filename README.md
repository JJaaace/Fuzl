# Fuzl

Turn your group chat into a plan.

Fuzl aims to help existing friend groups turn deliberately supplied conversation context into realistic hangout plans. **Sections 1 and 2 are implemented:** type a temporary draft, review and correct one of three manually authored sample summaries, enter information manually, and check a real Express API connection. The original Foundation layout and connectivity remain in place.

No AI, automatic parsing, uploads, database, auth, guest links, venue recommendations, memory, or native integrations exist. The complete [specification](FUZL_CODEX_SPEC.md) is preserved unchanged. Its original Section 1 boundary was advanced by Jace’s explicit Section 2 instruction; Section 3 and all later sections remain unauthorized.

## Try the three examples

At http://127.0.0.1:5173, select a **Sample example**, then click **Load sample**:

| Example | What to inspect |
| --- | --- |
| Straightforward plan | Explicit November 14, 2026 availability, individual USD budgets, travel limits, and an unbooked bowling idea |
| Missing & tentative details | Original Foundation conversation: “Friday” has no invented exact date, “maybe” stays tentative, missing budgets and currency stay unknown |
| Conflicts & a correction | Indoor/outdoor requirements conflict; Ren’s corrected USD 15 limit is used and both original statements remain inspectable |

Each is prominently labeled **Manually authored sample data**, never AI analysis. Loading replaces the current draft and summary, including edits. Merely selecting another example does not replace anything.

Rename participants directly, or change a speaker mapping to correct attribution across linked facts. Select **Edit fact**, change its fields/status/firmness, and **Apply changes**; Cancel discards unapplied edits. Expand **Supporting sample text** to inspect original quotes. These quotes never silently change to justify your corrections.

Use **Add participant** and **Add information** for missing details. To work from arbitrary pasted text, choose **Start blank summary**, which preserves the draft and starts with no inferred facts. Enter everything manually. **Clear** clears only the conversation, **Remove summary** removes only the summary, and reload clears all planning state.

Editing or clearing the draft after loading a summary shows a mismatch warning while preserving summary edits. Returning the draft exactly to its original snapshot clears that warning. No automatic analysis or conflict detection runs. Questions/conflicts are recorded separately: an issue needs a written resolution to be marked resolved, and recording an answer does not silently change related facts.

## Data model and local edits

[model.ts](apps/web/src/planning/model.ts) defines participants with stable IDs, source speaker mappings, original source text, typed facts, and missing/conflicting questions. Facts carry **proposed / tentative / confirmed / conflicting** status separately from **firm / flexible / unknown** strength. A fact can apply to a person directly, a mapped speaker, the group, or an unknown person. Remapping a speaker updates linked attribution without rewriting quotes; direct person attribution stays with that person.

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

Open **http://127.0.0.1:5173**. The API listens at **http://127.0.0.1:3001**. No environment file, account, credential, or paid service is required. Ctrl+C stops both development servers.

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
| `npm test` | Check health behavior, summary fixtures/state/validation, and static React markup |
| `npm run build` | Build web assets and compile API JavaScript |
| `npm run start:api` | Run the compiled API after building |

Stop the development API before starting the compiled API on the same port. Output lives in each app's ignored `dist/` directory. The web build produces static assets. Deployment and production API routing are future work; Vite's development proxy does not ship in that build.

## Request flow and draft privacy

1. [App.tsx](apps/web/src/App.tsx) holds the draft and planning summary in **frontend state**, temporary memory in this browser tab. Loading a sample sets both; manual edits change local state. Reloading clears everything. The app does not transmit, log, or persist planning data and creates no browser storage.
2. Check connection calls [api.ts](apps/web/src/lib/api.ts), which makes an **HTTP GET** to `/api/health` without a body. It validates the response, times out after five seconds, supports cancellation, and rejects network, HTTP, and response-format failures. A new check replaces the previous result; there are no automatic retries.
3. The browser sends the relative request to Vite on port 5173. The **development proxy** in [vite.config.ts](apps/web/vite.config.ts) forwards `/api` to port 3001. Browser requests stay on the frontend origin without CORS configuration.
4. The **backend**, [app.ts](apps/api/src/app.ts), returns health JSON. [server.ts](apps/api/src/server.ts) validates the port, starts Express, and handles shutdown. No conversation route exists.

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
- **Different API port:** use `PORT=3002 npm run dev` (or `PORT=3002 npm run dev:api` / `PORT=3002 npm run start:api`) and change the Vite proxy target to `http://127.0.0.1:3002`. Restart Vite after editing configuration. `PORT` comes from the process environment; `.env` loading is not implemented. Defaults require no file. Future secrets must never use `VITE_` variables, which are exposed to the browser.
- **Dependency audit:** `npm audit` reports 10 moderate development-tool findings through minimatch 10 in ESLint/typescript-eslint. Their current dependency ranges do not accept fixed minimatch 11.0.1. No forced upgrades or overrides were applied. `npm audit --omit=dev` reports zero vulnerabilities. Recheck upstream updates before later work.

## Verification and manual browser checks

See [docs/PROGRESS.md](docs/PROGRESS.md) for exact results. Type checking, linting, 21 tests (including the parent health test), build, and direct/proxied health checks pass. Tests cover the model and static markup, not browser clicks or layout. **Browser tooling still reported no available browser**, so interaction, rendered narrow-screen layout, keyboard focus, and browser storage/network observations remain unverified. CSS uses one-column forms below 540px, wrapping text and shrinkable inputs; that source review is not visual verification.

With the app running:

1. Confirm the page title is Fuzl and the textarea has the Conversation draft label. Try all three examples, type/edit/clear the draft, and confirm the mismatch warning appears without changing the summary. Reload and confirm draft and summary are gone. Pasting arbitrary text alone must never create a summary.
2. Check connection. Using separate web/API terminals, stop the API and check again, then restart and retry. Confirm checking, failure, and recovery messages.
3. Rename Sam, remap that speaker, and check linked fact attribution changes while the quote stays unchanged. Edit a budget from unknown to `0` and back to blank. Try `-1`, `12.345`, and currency `US` to check errors. Confirm tentative statements and conflicting requirements do not silently become confirmed. Change firmness/status explicitly and apply, then test Cancel.
4. Edit date/time/activity/travel fields. Try an end time before the start. Add a participant, a missing budget, an activity, and a question manually. Resolve/reopen a question; confirming a resolution requires written text and does not update facts. Reload the same sample to confirm edits reset. Test Start blank summary and manual entry without a sample.
5. In browser developer tools, confirm all draft/summary edits send no requests, health uses GET without a body, and the app creates no localStorage, sessionStorage, or IndexedDB data. Confirm no planning text appears in API logs.
6. Inspect all examples with a fact editor open at desktop and mobile widths, including 320px, for readable layout and no horizontal overflow. Tab through buttons, inputs, selects, supporting-text disclosures, and the textarea; check visible focus and keyboard activation. With a screen reader, check labels and polite connection/mismatch announcements.

**Stop after Section 2.** Section 3 — AI understanding of pasted text — has not started and requires a new instruction.
