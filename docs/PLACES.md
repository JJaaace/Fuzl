# Places — Sections 7A and 7B

**Current extension: [Section 7B guide and demo checklist](PLACES_7B.md).** It adds reliable US area clarification, leading-zero ZIPs, sparse/cross-border fixtures, source-backed corrections, address conflict handling and authenticated rechecks without provider calls. The original Section 6/7A review patches remain frozen; 7B is a separate local delta.

This is an organizer-only search for an owned saved session. It collects a shortlist, not votes, events, trending activities, attendance, reservations or a confirmed plan. Section 6 is preserved. Its hosted migration/browser checks and the real Section 5 account workflow remain pending by choice.

## Try the deterministic demo now

With `npm run dev` running, open **http://127.0.0.1:5173/?design=places**, then click **Show demo results**.

This development-only preview needs no sign-in, database, key or network request. Its explicitly synthetic plan has a confirmed firm USD 20 per-person limit and a flexible park preference. The selected test window is November 14, 2026, 15:00–17:00 America/New_York. These dates and prices belong to the fixture, not your planning summary.

- **Demo Campus walk** fits the supplied test constraints: synthetic total USD 0/person and matching date-specific test hours.
- **Demo Campus bowling** needs checking: price and hours are unknown.
- Expand **Doesn’t fit**: the synthetic museum costs USD 40/person and exceeds the firm USD 20 limit.

Change the area to **Cleveland, OH** or **44114** and search again. The names, center and positions change; Columbus is not embedded in the provider/search logic. Fixtures also cover Boston / 02108, Brookline / 02445, Marfa / 79843, Springfield (MA/IL) and Philadelphia / 19103 with a Camden, NJ neighbor. Other locations need a separately deliberate live search. The 43210/museum fixture replays the earlier public Columbus address discrepancies, not current availability. `example.com/fuzl-fixtures/...` links identify synthetic fixture sources, not real venues or validated prices. The preview cannot make a live request or access private guest budgets.

## Saved-session flow

1. Open an owned saved session and choose **Find places**, below the existing saving/guest controls. Applied local edits are used without implicitly saving or overwriting the summary. Apply/cancel open fact/question editors first.
2. Enter a US **City, State** or five-digit **ZIP**, a 1–30 km radius and optional supported category. Use **43210** to center the first real search near Ohio State; city centroids can differ from campus. Search supports parks, museums, restaurants, cafés and bowling, without events.
3. Optionally supply an exact outing date, start/end and IANA time zone. Unknown controls stay blank. Search controls do not resolve an ambiguous planning “Friday” or rewrite a firm schedule. Correct/confirm the actual summary when appropriate.
4. **Show demo results** explicitly uses fixtures. **Search real places** separately calls Geoapify after owner authorization and setup checks. Ambiguous areas return a bounded choice before places; explicitly choose a match or add a state/ZIP. No search happens on open or while typing. The disclosure appears before the actions.
5. Up to three useful cards are separated into **Fits the verified constraints** and **Promising — needs checking**. Exclusions stay in a separate disclosure. Each card shows its source/type, retrieval time, uncertain price/hours/travel, a factual reason, checks/ordering and a factual next step and a separately labeled source link. No verified result is announced unless the required implemented checks pass.
6. Optionally **Add a place manually** with a name, source link, address, category and known price/regular hours/coordinates. Unknown fields stay null. Details are labeled **Organizer-entered**, not provider-verified. Unsafe links, negative/invalid costs and invalid coordinates are rejected. Up to three manual candidates are evaluated alongside retrieved ones. Source links are not fetched automatically. In **Sources & verified details**, retain an address/price/hours source and check date, explicitly confirm a conflicting address, or attest an official page identifies this exact venue. Unresolved location dependencies cannot verify a fit.

Results/manual candidates/corrections live only in component memory and are not part of Save session. Reload, opening another session or changing account clears them. Search errors keep the summary. Cancellation is deliberate; no retries/fallbacks run. Changes to the area, filters, timing, candidates, applied summary or saved revision hide previous cards as stale. During a request, the synchronous workspace edit counter also catches changes and edit-back. Private response/session changes are rechecked server-side before a result is returned. There is no background polling after a completed search: deliberately search again for newly arrived replies.

## One provider and private setup

**Geoapify Geocoding + Places**, using the backend REST endpoints `/v1/geocode/search` and `/v2/places`. Current official documentation was reviewed November 7, 2026:

- [Free plan/pricing](https://www.geoapify.com/pricing/) lists 3,000 credits/day, up to five requests/second and no credit card. [Credit costs](https://www.geoapify.com/pricing-details/) list one credit for geocoding and one for a Places request of at most 20 results. A completed Fuzl live search ordinarily uses two credits/two HTTP requests; early geocoding failures use fewer. No extra detail, routing or retry calls run.
- [Places coverage, reuse and attribution](https://www.geoapify.com/places-api/) describes worldwide OSM-based coverage, permits caching/storage/redistribution with required attribution, and requires OSM plus Geoapify attribution on Free. Fuzl retains results only temporarily and displays **Powered by Geoapify** and **© OpenStreetMap contributors (ODbL)** beside live results. One Columbus/OSU search now passed; two supplied addresses differ from official sources. Coverage/completeness is not established; see [the live check](PLACES_LIVE_CHECK.md). Retrieval time is not a guarantee of source freshness.
- [Geocoding reference](https://apidocs.geoapify.com/docs/geocoding/) documents structured city/state or postcode queries, US filtering and location/time-zone output. [Places reference](https://apidocs.geoapify.com/docs/places/) documents categories and circle/proximity filters. Both endpoints are used as documented; no SDK/dependency was added.
- [Terms](https://www.geoapify.com/terms-and-conditions/) apply. The app cannot independently verify your subscription or provider-side retention. Only the search location/filters and server credential are sent; raw chats, screenshots, names, dates and spending limits are never provider parameters.

To configure a deliberate live test:

1. Create a Geoapify account/project on **Free**, confirm its current quota/limits in the dashboard, and obtain a key. Do not add a card, upgrade or enable paid billing. Restrict the key appropriately for backend/server use if available; a browser-referrer restriction may reject server requests.
2. Privately append to the existing **apps/api/.env**, preserving every Gemini/Supabase/database/certificate setting:

   ```dotenv
   GEOAPIFY_API_KEY=your_private_key_here
   VENUE_SEARCH_ENABLED=true
   ```

   `.env.example` contains only an empty key and disabled flag. The real `.env` stays ignored/untracked and private. Do not put this key in `VITE_` variables, Git, URLs you share, logs or chat.
3. Restart the API, then use an owned saved session → **Find places** → **43210** → category/radius → **Search real places** once. The first authorized search has now run using a disposable database, not the hosted account workflow; see PLACES_LIVE_CHECK.md. Jace added the private key/flag; all Gemini/account/database/certificate settings were preserved. Do not rerun merely to view the existing recorded result.

Each deliberate action makes at most two provider calls; initial clarification uses one, and a later explicit selection may use two more. Rechecking the cached candidate set uses zero provider calls. App guards allow one live search in flight, two attempts/minute and ten attempts per API process. These are local development guards, not a substitute for provider dashboard quotas; restarting resets them. Missing setup, HTTP 401/403, HTTP 429, network/timeout, unreadable/malformed output and other HTTP errors have sanitized failures. Provider errors never become demo results. There is no paid provider, automatic fallback, automatic retry or billing action.

## Deterministic feasibility and ranking

`packages/planning/src/place-evaluation.ts` evaluates before scoring. It returns discrete checks with reasons, never an uncalibrated match percentage.

- **Fact trust:** historical AI facts are omitted. Unreviewed AI, tentative/conflicting facts and unknown attribution/firmness remain unresolved. Confirmed, reviewed, attributed firm facts can exclude/verify. Proposed facts cannot establish verified feasibility. Flexible confirmed preferences affect ordering; a flexible budget is not a firm exclusion. No fact's review/status is changed by searching.
- **Budget:** the summary's budget type and guest spending form are per-person limits. Compare only known numeric **total per-person** prices and limits in the same known currency. Zero remains zero; null remains unknown. Group prices are not divided by participant count. Admission-only/free admission, price tiers, unknown total expenses and currency mismatch do not pass affordability. No currency conversion or price inference from venue category.
- **Timing:** require exact chosen date/start/end and reliable venue-local, address-bound date-specific hours; explicit input-zone clocks are converted to venue-local clocks. Regular hours, unknown zones, ambiguous DST clocks or another date cannot pass. A conflicting confirmed firm schedule excludes; incomplete/tentative planning timing stays unresolved even if search timing was entered. There is no free-text hours parser, holiday guess or booking/capacity API. The bounded zone conversion does not resolve ambiguous/nonexistent local clocks or unsupported overnight coverage. Opening hours never establish seats/tickets/reservations.
- **Travel:** coordinates support a labeled Haversine **straight-line estimate from the area center**, enforcing the chosen search radius. It is not a drive distance, departure point or travel duration. A drive-time/other travel constraint remains unchecked without route evidence; unknown coordinates leave boundary membership unresolved.
- **Other requirements:** an exact, confirmed firm activity category can be checked. Free-text age/accessibility/diet/capacity requirements are not interpreted as satisfied by a category. Open questions remain unresolved. Unknown requirements are not passed silently.
- **Ranking:** exclusions first, verified candidates before unresolved ones, then exact confirmed flexible activity-category matches, supported flexible-budget preferences, confidence in supplied details and proximity. Reasons show the simple ordering inputs. Novelty, reviews, ratings and trend detection are not invented.

Live Places records supply names, IDs, addresses/categories and coordinates, but this adapter does **not** invent price or hours from optional raw fields. Those fields remain unknown, so initial live searches will generally return promising options needing verification rather than verified fits. Unnamed POIs are not presented as useful cards; malformed named records fail the search. Provider IDs and stable source URLs deduplicate results. The OSM source link is a map pin for the provider-reported location, not a verified address, venue/ticket page or official website. Cards separate the next step from this source-map link; confirm the current venue details independently. The first live check found two provider-address discrepancies.

### Private spending

`PlaceStore` scopes private-answer queries through the session's verified organizer ownership. It loads only amount/currency/state plus internal revision metadata, never respondent aliases for explanations. Every retained private response is a conservative session limit, including replies from replaced/expired/revoked invites; collection permissions expiring does not discard its retained limit. Editing/removing private data follows Section 6 semantics. No automatic identity/attendance matching occurs.

The evaluator folds private checks into one general **fits / needs checking / doesn’t fit** result per candidate. It never serializes thresholds, private amounts/currency, respondent names/IDs, whose limit mattered or counts. A private unknown/mismatched currency remains unchecked. The store rechecks its internal fingerprint after retrieval so changed limits cannot yield an apparently current response. No private row or fingerprint is returned or logged.

This is not complete anonymity: repeated feasibility queries at different prices can allow inference about a threshold. Manual candidates also pass the general check. Existing per-process live limits are not a mathematical privacy guarantee; there is no differential-privacy mechanism. Do not claim exact limits are unrecoverable or that changing visibility retracts previously shared information.

## Request flow and access review

`SaveSession` mounts `PlaceFinder` only for an owned saved-session workspace. `POST /api/private/sessions/:sessionId/places/search` remains behind existing remote Supabase `getUser` verification, exact-origin and JSON/body-size gates. No public search endpoint was added. `PlaceStore` scopes the session and private records through `group.owner.authSubject`, checks the saved revision and validates newly applied guest provenance using Section 6's source rules. New searches cannot silently accept forged private/blank guest claims.

`GeoapifyProvider` receives a freshly constructed `{ area, radiusKm, category }`, never the request summary. It makes at most two bounded, sequential requests with a shared 15-second provider deadline, no redirects/retries and bounded response bytes. Keys in upstream URLs and raw exceptions/messages are not logged/returned. HTTP errors preserve only status with fixed safe messages. Strict contracts validate candidates and result DTOs. Private results use no-store/no-referrer; frontend fetches omit cookies. Existing sign-out/account-switch remount/abort and save revision controls remain intact. No new database schema or runtime dependency was added. Section 7B adds a bounded ten-minute, owner/session-scoped cache of public venue baselines and an authenticated `/places/evaluate` action; no raw planning data or individual limits are cached. Evidence, original values and selection bindings are described in PLACES_7B.

## Historical Section 7A verification and remaining manual checks

The table below records Section 7A. Current Section 7B checks and limitations are in [PLACES_7B](PLACES_7B.md) and PROGRESS.

| Check | Evidence |
| --- | --- |
| Offline tests | 178 passed, three intentional real-DB-suite skips (181 reported tests). Fixture eligibility/unknowns/zero/group prices/currency/admission, private redaction, ambiguous dates, unreviewed/historical claims, provider URL allowlist/HTTP/quota/network/deadline/invalid responses, owned route/context change, UI demo/manual/error/stale handling plus all existing tests |
| Disposable real PostgreSQL | `npm run test:db`: 19 passed, including existing Section 5/6 and three Section 7A parent/subtest results. Real owner-scoped HTTP demo search evaluates a retained private budget without exposing it; wrong-owner/missing bearer/stale revision/deleted session are rejected. Existing migrations applied/reapplied to the owned cluster only, then stopped/removed |
| Types/lint/build/runtime | Shared/web/API type checking, lint (zero warnings) and builds passed. Compiled health 200 and unauthorized places POST 401; development workspace/guest/preview/module/health return 200. No configured private credential matches in changed files or frontend assets; `.env` stays ignored/untracked/0600. No remaining failed checks |
| Real provider | **One authorized search passed:** 43210, 5 km, museum; two HTTP 200 provider calls, 11 records, three unresolved cards, 987 ms app latency. No second search/retry. OSU corroborates the entities, but two provider addresses differ and date-specific access remains unknown. Exact dashboard usage/cost and broad catalog quality are unverified; see [live check](PLACES_LIVE_CHECK.md) |
| Browser/hosted | **Unverified:** no browser connected. No rendered cards/phone/focus/clipboard/real account result. Hosted Section 6 migration and all pending Section 5/6 manual checks remain pending |

Manual review after the preview path above:

1. At desktop and 320–360px width, tab through area/radius/category/timing, demo action, cards, source links and exclusions. Check labels, focus, wrapping and absence of horizontal scrolling. Inspect reduced motion; cards stay still while editing. Keyboard confirmation should focus the shortlist heading after successful search.
2. Set date blank or a firm zero limit in a controlled summary: unknown timing/cost must never become a verified fit, and an actual known total above zero must exclude for a confirmed firm zero. Add a manual zero admission-only price and leave currency blank: it remains unchecked.
3. In a real owned saved session (after the existing account/guest migration setup), use **Find places → Show demo results**. Apply a shareable guest answer first and confirm its provenance/unreviewed AI labels survive; only applied facts affect the search summary. Private replies affect general feasibility without displaying amounts or respondent identities in cards/API/logs.
4. Throttle a request, change area or edit/apply a planning fact: the old response must not appear current. Cancel, simulate a failure or leave live setup missing; summary edits must survive. Sign out/switch account during a pending request: private results must clear and not reappear.
5. Another controlled organizer cannot POST to that session ID. Verify live results only after separately configuring Free and deliberately pressing the live action. Hosted account isolation and actual provider behavior cannot be established by the disposable verifier stubs or DOM tests.

Changes remain local for checkpoint review. Exactly one Geoapify search was authorized and performed; no live AI call, email, hosted migration, billing change, deployment, push, voting or confirmed-plan feature was performed.
