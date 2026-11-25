# Working on Fuzl

## Scope and structure

Fuzl is an existing planning app. Preserve working flows and unrelated edits; inspect `git status` and the actual diff first. Read the current request and `docs/PROGRESS.md` for scope and unverified work. The spec is historical context, not permission to implement later sections. Section 12D email setup follows Section 12C; do not start it during cleanup.

- npm workspaces, TypeScript, Node **24.18+ within 24.x**, npm **11.x**; pinned versions are in `package.json` and `package-lock.json`.
- `apps/web`: React 19 + Vite 8. `src/main.tsx` captures guest/auth URL data before rendering. `/` is the temporary workspace; `/chat` is native conversations; `/auth/callback` completes magic-link sign-in; `/guest`, `/vote`, `/plan` are credential-scoped public entry points. Saved groups use `/?view=groups`; workspace stages use `?stage=plan` or `?stage=transcript`.
- `apps/web/src/ui`: brand, motion, navigation, loading/recovery and development previews. `DevelopmentPreview` loads `DesignDemos` only in development. Keep useful `?design=` fixtures (see README); they are not production backends. Workspace and chat owners stay mounted across primary navigation to preserve temporary work.
- `apps/api`: Express 5, provider adapters and authenticated/guest routes. `src/server.ts` is the startup entry; `src/app.ts` builds the API. Supabase verifies organizer identity; Prisma 7 with the PostgreSQL driver handles server-only persistence.
- `packages/planning`: shared Zod contracts, source/uncertainty rules, deterministic fit/ranking and privacy projections. Keep unknown amounts/dates explicit. Fact status, organizer review, votes, RSVPs and actual attendance are different records.
- `docs`: setup and feature guides; `docs/PROGRESS.md` records actual evidence. `scripts`: disposable database tests, offline evaluation and brand/scenery generation.

## Commands

Run from the repository root unless a guide says otherwise:

```sh
npm ci
npm run dev
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```

`npm ci` prepares the shared package and generates Prisma; generation does not connect to a database. `npm run dev` starts web **http://127.0.0.1:5173** and API **127.0.0.1:3001**. Vite proxies `/api`. `npm run dev:web` and `npm run dev:api` start them separately. Both enforce their configured ports. A deliberate LAN preview can use `npm run dev --workspace @fuzl/web -- --host 0.0.0.0 --port 5174`; loopback-only API restrictions remain intentional.

`npm test` includes offline API/unit/DOM fixture tests; database-only cases skip without the disposable runner. `npm run test:db` creates and destroys its own PostgreSQL cluster and needs `initdb`, `pg_ctl`, and `psql` on PATH. Never substitute a hosted URL or reset a real database. `npm run db:migrate` applies additive migrations with `migrate deploy`; inspect `docs/ACCOUNTS.md`, Prisma configuration and migration SQL before using a real connection. Do not infer hosted verification from local database tests.

## Browser verification

Project `.codex/config.toml` configures Microsoft's pinned **fuzl_playwright** MCP server with isolated Chrome. See `docs/BROWSER_SETUP.md`; update its `cwd` if the checkout moves. Reuse healthy app processes. Open the actual loopback URL for local API actions; LAN previews cannot call AI/private local endpoints. A WebKit result is not a real Safari result; a narrow viewport is not a real phone.

Capture console/page errors and failed requests before interacting. Check samples, Plan, navigation/Back/Forward, conversation fixture and sign-in without submitting email. Use synthetic data and keep artifacts under ignored `artifacts/`; never capture tokens/auth callbacks. Record mocks, local browser observations, live calls, disposable database checks and hosted checks separately.

Preserve Section 12B's `newRecordId` secure LAN fallback, Plan/root recovery boundaries, draft-retaining navigation and regression tests. Never replace secure randomness with `Math.random`, weaken source/schema checks, auto-accept AI claims, or use fixture output to hide a provider error. Lazy content must show a loading view and remain inside a recovery boundary.

## Fixtures, providers and private configuration

Samples and `?design=chat` use manually authored data and simulated identities. Keep their labels and replacement guards. Provider tests are offline by default. Live AI, Geoapify, Ticketmaster, real emails and hosted data mutations require explicit task authorization; a visual or cleanup task does not imply it. No paid fallback, automatic retries, billing changes or bulk live evaluation.

Backend settings belong in ignored, untracked `apps/api/.env`; preserve existing values. `.env.example` contains only empty credential placeholders and disabled optional features. Never print keys, tokens, credential URLs, private certificates or raw conversations; never put secrets in frontend/VITE variables, screenshots, logs or Git. Public Supabase URL/publishable key may be served through the explicit API configuration allowlist; database credentials remain secret.

Raw pasted conversations and uploaded images stay temporary. Explicit save stores a summary and supporting excerpts; native Fuzl messages are deliberately persisted in their separate membership-checked conversation flow. Do not add browser persistence for raw imports. Provider inputs and public views must preserve their existing allowlists and private-budget protections.

## Cleanup and generated assets

Trace imports, CSS URLs, dynamic class names, demo parameters, generator scripts and public/implicit fallback URLs before deleting files. Preserve tests and useful demos; do not remove a file only because static import search misses it. Keep the root lockfile and avoid dependency churn.

`node scripts/make-brand-assets.mjs` regenerates the transparent favicons/marks; `node scripts/make-journey-art.mjs` regenerates trusted scenery. Preserve title **Fuzl**, native scrolling, reduced motion, exactly three fuse dots and the current favicon geometry. Follow `.agents/skills/fuzl-ui-review/SKILL.md` for rendered UI work and `.agents/skills/fuzl-access-review/SKILL.md` when changing access boundaries. Leave changes local unless the current request explicitly authorizes a commit/push.
