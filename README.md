# Fuzl

Turn your group chat into a plan.

Fuzl aims to help existing friend groups turn deliberately supplied conversation context into realistic hangout plans. **Only Section 1 — Foundation is implemented:** type a temporary draft, load a synthetic conversation, clear it, and check a real Express API connection.

No AI, interpretation, planning summary, uploads, database, auth, guest links, or venue integrations exist yet. The complete [specification](FUZL_CODEX_SPEC.md) is preserved as future context. Section 2 requires a new user instruction.

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
| `npm test` | Check health validation, errors, timeout, cancellation, and request shape |
| `npm run build` | Build web assets and compile API JavaScript |
| `npm run start:api` | Run the compiled API after building |

Stop the development API before starting the compiled API on the same port. Output lives in each app's ignored `dist/` directory. The web build produces static assets. Deployment and production API routing are future work; Vite's development proxy does not ship in that build.

## Request flow and draft privacy

1. [App.tsx](apps/web/src/App.tsx) holds the textarea value in **frontend state**, temporary memory in this browser tab. Load sample and Clear change only that value. Reloading clears it. The app does not transmit, log, or persist the draft and creates no browser storage.
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

See [docs/PROGRESS.md](docs/PROGRESS.md) for exact results. **Browser tooling reported no available browser**, so browser interaction, visual layout, keyboard focus, and browser storage/network observations remain unverified.

With the app running:

1. Confirm the page title is Fuzl and the textarea has the Conversation draft label. Type, load the synthetic sample, edit it, and clear it. Reload and confirm an empty draft.
2. Check connection. Using separate web/API terminals, stop the API and check again, then restart and retry. Confirm checking, failure, and recovery messages.
3. In browser developer tools, confirm editing sends no requests, health uses GET without a body, and the app creates no localStorage, sessionStorage, or IndexedDB data. Confirm no draft text appears in API logs.
4. Inspect desktop and mobile widths, including 320px, for readable layout and no horizontal overflow. Tab through the buttons and textarea, check visible focus, and activate controls with the keyboard. With a screen reader, check the label and polite status announcements.

Next proposed milestone: **Section 2 — Editable planning summary using labeled sample data**, only after a new instruction. Section 2 has not started.
