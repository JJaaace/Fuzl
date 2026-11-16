**Follow-up:** These fixes are carried into the authorized Plan/People checkpoint. The step/recovery action is now **Plan / Open Plan**, and the three-column overview has been replaced. See [PLAN_PEOPLE.md](PLAN_PEOPLE.md) for current behavior and checks. Evidence below records the earlier sub-pass.

# Section 11A — analysis recovery and final summary labels

November 15, 2026. Starts from clean, pushed `03c9e9d` (summary review/compact scenery control). This pass remains local and unstaged. No commit, push, deployment, migration, credential/configuration change or provider call was made. The existing local-origin restriction and all review/save/ownership boundaries remain.

## Error diagnosis

The exact former message **“Analysis is available only from this local development app.”** was thrown by `apps/api/src/app.ts`, in the shared `/api/analyze` / `/api/transcribe` origin guard. It runs **before JSON/input validation, configuration checks, attempt accounting and provider invocation**. The unchanged rule accepts HTTP origins on `127.0.0.1` or `localhost` with a port; it rejects LAN IP origins. This error is a local 403, not a Gemini API rejection.

The frontend posts to relative **`/api/analyze`**. The primary Vite app is **http://127.0.0.1:5173**, the existing LAN preview is **http://192.168.1.105:5174**, and both use the project's `/api` proxy to **http://127.0.0.1:3001**. A proxy does not convert the LAN browser Origin into a trusted loopback Origin. No proxy/allowlist change is needed or made: the supported local origin is accepted.

No error screenshot/reference was attached in this turn, so the original specific request could not be correlated. Previously, this guard returned a reference but did not log its rejection. It now emits a safe **`analysis_origin_rejected`** record with only event, reference, code, HTTP status and `providerCalled: false`. No origin, request URL, headers, credentials or conversation is logged. Logging sits at the guard itself: the full suite caught an initial overly broad placement in the common error handler also matching private-route origin errors; it was corrected, preserving those routes' existing logging behavior.

Actual running-app HTTP probes, using synthetic text:

| Request URL | Explicit Origin | Actual result | What this establishes |
| --- | --- | --- | --- |
| `http://192.168.1.105:5174/api/analyze` | `http://192.168.1.105:5174` | 403 `origin_rejected` | LAN reaches the API proxy but stops before Gemini |
| `http://127.0.0.1:5173/api/analyze` | `http://127.0.0.1:5173` | 400 `invalid_input` with deliberately invalid reference date | Correct local origin passes the guard and reaches request validation; no provider called |
| `http://127.0.0.1:5173/api/analyze` | `http://localhost:5173` | 400 `invalid_input` with deliberately invalid reference date | Localhost Origin also passes; no provider called |

These are explicit-header HTTP probes, not browser observations or complete extraction tests. Their URLs/statuses/references are saved in ignored `artifacts/design/origin-before-check.json` and `origin-after-check.json`, without conversation bodies. Valid loopback extraction is exercised separately with an authored **mock extractor**. **Zero live Gemini calls** were made; current provider availability, live model output, latency, usage and cost were not measured. Prior live Gemini evidence remains historical, not rerun here.

## Usability changes

- The API error now explains the correct local URL and offline-sample fallback. `AnalysisRequestError` carries only safe code/status/message/reference into the client. The inline error immediately follows **Analyze conversation**, before provider details. For origin rejection it links to **http://127.0.0.1:5173 on the Mac running Fuzl**, explains that drafts do not transfer between addresses, keeps the reference visible, and offers **Review summary** when an existing summary is loaded. It neither overwrites the draft nor substitutes fixture output. Other provider/network failures keep their own message. Generic request states, cancellation, no automatic retry, acceptance and stale-source controls remain.
- All gallery/dropdown sample openings use the card's title: **Saturday bowling**, **Friday, maybe**, **Indoors or outdoors?** The label is **Sample plan · manually authored**. Manual, AI and saved summaries display their existing review/session title. No activity title is inferred, fixture facts/quotes rewritten or new schema introduced.
- **Review save options** names the shortcut's actual behavior: it focuses the existing save section. **Sign in to save session** still opens sign-in there, and the real save button still explicitly saves. Excerpts/raw-import disclosure, unapplied-editor protection and publication/ownership checks are unchanged.
- The empty overview says **No open questions recorded** once. Generic duplicate empty-list text/counts are removed from that summary. An open issue leads with the existing specific question/conflict, including unresolved Friday and Maya/Leo's incompatible requirements. Confirmed availability remains separate from the proposed, unbooked activity. Direct date/conflict controls retain tentative/unknown/status/review labels and original evidence.
- Scenery, pause icon, cards, cursor ribbon, brand, title/favicon and palette are preserved.

## Actual checks

- **`npm test`: 335 passed, 13 intentional DB-suite skips, 348 total, zero failures.** New regression cases cover safe error metadata; LAN/untrusted origins blocking before configuration/provider; both loopback origins succeeding with a mock; scoped redacted rejection logs; retaining draft/current sample and reference after failure; no-summary recovery without fake fallback; specific issue ordering; titles; one empty-state message; and truthful save/sign-in navigation. Existing all-three-sample tests run normal/reduced-motion DOM paths, decline/accept replacement and verify no Analyze/save call on gallery loading. The existing Try an example path also stays offline.
- Full typecheck, lint and production builds passed. Existing Vite main-chunk size advisory remains. No new dependency or database work. Initial type-check errors were confined to the new test's unknown JSON response and fixed with its expected response type; application validation was not loosened.
- Real HTTP origin/input probes above passed. Public provider configuration reports Gemini; that does not establish key/quota/model access. Health and served source checks are separate from extraction.
- **Browser unavailable:** selection returned `No browser is available`, discovery `[]`. No rendered desktop, phone-width/emulated viewport, physical phone or Safari check ran. DOM simulations are not layout/device verification. No new app screenshots or recording were captured. The new strings' wrapping, touch targets, real keyboard focus, full landscape loop/ribbon behavior and real account save/reopen still require browser review.
- Earlier hosted account/guest/ballot/shared-plan/migration gaps remain pending. This pass adds no hosted verification.

## Working flow and remaining manual checks

1. **On the Mac running Fuzl**, open **http://127.0.0.1:5173/?review=recovery**. Use **Try a sample plan → Saturday bowling**. The heading must match, be focused/in view and say **Sample plan**. Confirm activity is proposed/unbooked, availability confirmed, and **No open questions recorded** appears once. **Review save options** must reach the existing disclosure/section; it must not save. **Sign in to save session** should show account entry, without sending email until deliberately submitted.
2. Open **Friday, maybe** (also from **Try an example**): find the exact-Friday question first and **Review the date**. The existing exact-date input is blank; Sam remains tentative. Open **Indoors or outdoors?** and **Review the conflict**: the existing conflict question opens without resolving either firm requirement. Repeat all three at **1440×900**, **390×844**, and 320px. Preserve/decline unsaved replacement and unapplied editors; check paste/upload switching and keyboard navigation. These rendered checks are pending.
3. On the LAN/phone preview **http://192.168.1.105:5174/?review=recovery**, use those same offline samples. Clicking Analyze with synthetic text should show the actionable local-only error, preserve text and reference and offer Review summary if loaded. That error should be adjacent to Analyze. **127.0.0.1 on a phone means the phone**, so open that address on the Mac instead. Keep the original tab open; copy a synthetic draft manually if changing addresses. No automatic draft transfer or browser persistence was added.
4. If deliberately testing real analysis later, read the provider disclosure on the Mac's local URL, use a small synthetic conversation and valid optional date, then click Analyze once. Preview/accept/review remain explicit. No such live request was part of this pass. Original screenshot-specific correlation needs its actual reference; newly rejected requests can be matched to the API's `analysis_origin_rejected` entry.

Functional/offline checks and the origin diagnosis pass. Real desktop/phone/Safari acceptance remains pending; changes stay local for review.
