# Section 12C — Code cleanup and project documentation

Completed locally November 24, 2026, above pushed checkpoint `54e6540` and the existing uncommitted Section 12B work. No commit, push, deployment, provider call, email or hosted migration was made. Section 12D email setup remains next.

## Starting point

The starting tree contained 60 changed/new Section 12B files. Their bytes and a starting Git diff were preserved under ignored `artifacts/maintenance/section12c/starting-files/`, `starting-manifest.json` and `starting.diff` before editing. The final `section12c.patch` compares this pass against that local baseline, so it does not require treating the pushed checkpoint as the complete starting state.

The [Section 12B report](WEBSITE_12B.md) recorded 406 passing tests, 15 intentional database skips, 101 disposable-database passes, passing types/lint/build and Chrome/WebKit verification. No existing failed check was reported. The 850.06 kB main bundle triggered the existing >500 kB advisory. Real Safari, physical phones and hosted account/guest/native-conversation acceptance were pending and remain pending.

Entry-point inspection covered:

| Entry | Purpose |
| --- | --- |
| `apps/web/src/main.tsx` → `SiteWorkspace` → `App` | Temporary workspace, Plan, saved groups and native conversation navigation; account provider and URL credential capture |
| `/auth/callback` | Captures/clears magic-link parameters before async rendering, then uses the existing account completion workflow |
| `/chat` | Native membership/credential-scoped conversations |
| `/guest`, `/vote`, `/plan` | Separate credential-scoped public response, voting and shared-plan entries |
| `?design=` | Sixteen development-only design/feature previews, including synthetic conversation, place/event, ballot/plan, history, people, brand and API diagnostic flows |
| `apps/api/src/server.ts` / `src/app.ts` | Express startup and route construction; Node env-file loading, provider and access checks |
| Root npm scripts | Shared build, offline API/DOM tests, disposable PostgreSQL runner, typecheck, lint, build and development startup |

No `AGENTS.md` existed in the checkout or its parent directories, including hidden/ignored reference searches. One canonical root file was added rather than inventing an update to a nonexistent file or creating overlapping per-directory instructions.

## Cleanup performed

- Replaced `main.tsx`'s repeated StrictMode/render branches with one root boundary/StrictMode/Suspense tree and a readable screen selector. Existing entry precedence, credential capture timing, storage keys, account providers and capture helpers remain unchanged. Identical storage/history adapters are shared.
- Centralized development demo selection in `ui/DesignDemos.tsx`, loaded through `DevelopmentPreview.tsx` only in development. All existing fixtures/components remain available. App's four inline design branches now use the same loader. Guest response/vote/plan entries load on demand; `LoadingView.tsx` supplies readable loading feedback inside the existing recovery boundary.
- Removed 74 obsolete/empty CSS rules for the retired overview columns, development/details panel, old connection panel and button-only primary navigation. Removed seven exact duplicate root declarations. Differing fallback values, shorthand ordering, responsive rules for active components, current anchors, motion/reduced-motion styles and the Section 12B composer fix were preserved. Removal was checked against JSX, dynamic class construction, scripts and previews, not just one route.
- Excluded ignored `artifacts/` from ESLint's source scan. The initial baseline-copy artifact included an old inline hooks-rule directive outside the web glob and caused a harness-only lint error; generated evidence is not application source. Existing lint rules and source coverage were not relaxed.
- Rewrote the 301-line chronological README as a 93-line product introduction, verified current screenshot, main flow, actual commands/configuration names, architecture/data handling, setup links and explicit limitations. Added root `AGENTS.md` and updated gallery provenance/progress notes. The README screenshot was captured through the running browser, visually checked, and copied unchanged to `docs/images/fuzl-workspace.png`; it contains a signed-out workspace and labelled synthetic examples, no credentials or real conversation.

### Removed files and reference evidence

| File | Why removal is safe |
| --- | --- |
| `apps/web/public/brand/favicon-dark-16.png` | Byte-identical unused alias of `fuzl-mark-v3-dark-16.png` |
| `apps/web/public/brand/favicon-dark-32.png` | Byte-identical unused alias of `fuzl-mark-v3-dark-32.png` |
| `apps/web/public/brand/favicon-light-16.png` | Byte-identical unused alias of `fuzl-mark-v3-light-16.png` |
| `apps/web/public/brand/favicon-light-32.png` | Byte-identical unused alias of `fuzl-mark-v3-light-32.png` |
| `apps/web/public/gallery/sunset-ridges.webp` | Unused 114 KiB raster banner; current scenery is generated, trusted inline SVG in `journeyArtwork.ts`. Only the historical provenance note referred to it. |

The brand generator no longer emits the four aliases. HTML, runtime tab switching, manifests, preview scripts and computed asset paths use the retained v3 files. The implicit `/favicon.ico` fallback, transparent theme ICOs, gallery thumbnails, standalone SVG marks, replayable fuse and original logo explorations remain. The older logo variants are referenced by `?design=logos`; they were not dead assets. No source component was removed: all candidate modules had normal, demo, test, CSS-import or generator references. Useful fixtures/tests, backend/schema contracts, migrations and provider logic were retained.

## Bundle result

Measurements use the actual Vite production build, uncompressed and gzip sizes:

| Asset | Before 12C | After 12C |
| --- | --- | --- |
| Main JavaScript | 850.06 / 246.11 kB gzip | **823.37 / 238.77 kB gzip** |
| CSS | 85.92 / 17.21 kB gzip | **80.68 / 16.38 kB gzip** |
| On-demand guest chunks | In main entry | 5.57, 9.02 and 12.70 kB; loaded for the relevant public entry |

Development fixture labels/chunks were checked absent from production output. This is a modest main-entry reduction (~3.1%) and CSS reduction (~6.1%), not a claim about total download or runtime speed. The main chunk still exceeds 500 kB. A separate performance pass should profile the organizer/save/discovery modules and shared-contract graph before introducing finer state-sensitive loading boundaries. The warning limit was not raised and the remaining chunk was not merely renamed to hide the advisory.

## Verification after cleanup

| Check | Actual result |
| --- | --- |
| `npm test` | **406 passed, 15 intentional database-only skips, 421 total**, zero failures. Section 12B secure UUID, recovery, navigation, background preview and privacy regressions retained. |
| `npm run test:db` | **101 passed**, zero skips/failures; owned disposable PostgreSQL, migrations applied twice, unrelated seed retained, cluster stopped and removed. No hosted connection used. |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed; zero lint warnings. Existing large-chunk advisory remains as measured above. |
| Fresh install | Temporary source copy with no `.env` or private certificates, provider/database environment removed: **`npm ci --offline` including prepare/Prisma generation, then `npm run build`, passed**. Copy removed afterward. No dependency or lockfile change was needed. |
| Chrome 158.0.8127.37 and Playwright WebKit 27.2 through Microsoft MCP | Both passed loopback and LAN sample/gallery/Try-an-example loading, Plan/People details, active navigation/Back/Forward, draft preservation, mode switching and sign-in rendering/typing without sending. Twenty sample loads across four matrices; no page/console errors, failed requests or HTTP failures in those matrices. |
| LAN UUID regression | Both browsers reported HTTP LAN `crypto.randomUUID` absent and secure random bytes available; all samples rendered without recovery/blank screen. Loopback retained native UUID support. |
| Phone-sized viewport | 390×844 Plan/composer, keyboard details and reduced motion passed in both browsers, no horizontal overflow. Conversation demo also fit at 390px. Not a physical-phone test. |
| Development routes | All **16 previews** rendered in both browsers. In `?design=chat`, **Make a plan** produced labelled fixture proposals and the shortlist control. Simulated providers only. |
| Public entries | `/guest`, `/vote`, `/plan` loaded their chunks and showed their expected missing-link guidance in both browsers, not a blank screen or unintended fixture. No real guest credentials used. |
| Loading failure | Deliberately blocked a guest-plan module in Chrome. Existing root recovery showed a sanitized reference and usable shell; Workspace navigation recovered. Expected injected network/render errors are separate from successful-navigation diagnostics. |
| Built app | Local Vite preview on 127.0.0.1:5175, WebKit: `?design=chat` correctly rendered the normal production workspace, offline Friday sample worked, and all three public chunks rendered their missing-link states with zero page errors. This was a local build check, not deployment or hosted acceptance. |
| Documentation/assets/private review | Relative Markdown/image links, engine/scripts/configuration names, retained favicon proofs, diff whitespace and private-file/value checks recorded with the artifacts. No new credentials/configuration or staged files. |

Browser verification used the existing project `fuzl_playwright` server through the standard MCP client bridge described in [BROWSER_SETUP.md](BROWSER_SETUP.md). The temporary client/output location changed, not the server configuration or app dependencies. A harness blocked unexpected non-GET API requests during fixtures; **none occurred**. No live AI/Places/Events call or email was made. There were no new uncovered application regressions requiring extra implementation-mirroring unit tests; the existing suite plus explicit lazy-route/failure browser checks covered the cleanup risk.

Artifacts: `artifacts/maintenance/section12c/` contains baseline/delta, inventories, test/database/type/lint/build logs, isolated-install result, production-asset checks and documentation checks. `browser/` holds Chrome/WebKit workspace/demo result ledgers, production/failure ledgers and current screenshots. README's image is the only new screenshot added to versioned docs.

## Remaining checks and replay

Open **http://127.0.0.1:5173/** → gallery **Friday, maybe** → **Group details** → **Conversation** → **Saved groups** → **Workspace**. Then open **http://127.0.0.1:5173/?design=chat** → **Make a plan** and inspect the labelled fixture proposal. The ordinary dev/API processes were reused. The temporary production-preview server and isolated browser contexts were stopped after testing.

Real Safari and physical-device verification remain pending. WebKit and a narrow viewport do not replace them. Hosted magic-link callback/identity, original-tab edits, save/reopen/sign-out, real two-account isolation, guest ballot/RSVP and native conversation rollout remain the earlier controlled acceptance work. No migration was added or applied to Supabase; later migrations remain subject to the rollout notes in [progress](PROGRESS.md). Live-provider success, latency/cost and production hosting were not retested. Keep Section 12D email setup as a separate following task.
