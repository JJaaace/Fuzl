# Foundation progress

Updated November 6, 2026. Scope: Section 1 only.

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

Section 2 — Editable planning summary using labeled sample data — is next only after an explicit new instruction. Sections 2–12 have not started.
