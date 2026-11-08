# Section 7A — one live Columbus verification

This is the historical Section 7A result. [Section 7B](PLACES_7B.md) now uses its address discrepancies as fixtures; no new live search was made.

Verified November 7, 2026. **Provider connection/extraction passed; catalog accuracy and actual outing feasibility remain partial/unverified.** This is not a booking, a confirmed plan or hosted-account acceptance.

## Setup and scope

Jace reported completing the Free-plan verification and private key setup. A private configuration check confirmed `GEOAPIFY_API_KEY` and `VENUE_SEARCH_ENABLED=true`; Gemini remains selected. The real `apps/api/.env` remains ignored, untracked and 0600. No key, connection string, token or private certificate is recorded here. The app cannot independently certify the project's subscription or dashboard credit usage.

Exactly **one search** went through the existing private HTTP route, normal Geoapify adapter, strict result validation and deterministic evaluator, against an owned disposable PostgreSQL cluster with the existing migrations. Organizer identity verification used a controlled synthetic verifier; database ownership checks were real. No hosted Supabase authentication, record or guest migration was exercised. The cluster was stopped/removed afterward. The temporary verification runner is ignored under `artifacts/places`; it refuses a second attempt using an exclusive sentinel. No normal test command calls it.

Only location/filter parameters went to Geoapify. Synthetic local planning details: confirmed firm USD 20/person, flexible museum preference, confirmed firm 20-minute driving limit; November 14, 2026, 15:00–17:00 America/New_York. No personal name, raw conversation, screenshot or spending limit was sent to the provider. No guest-private amount was seeded in this live run; private-budget redaction remains covered by separate offline/disposable tests.

## Actual request and result

| Item | Observed result |
| --- | --- |
| Area/filter | US ZIP **43210**, Columbus/Ohio State; **5 km**, **museum** |
| Start / result retrieval | 2026-11-07 **23:50:09.559 UTC** / **23:50:10.619 UTC** |
| App HTTP status / elapsed | **200**, **987 ms** |
| Geocoding | `/v1/geocode/search`: **200**, **397 ms**; one result, requested ZIP matched |
| Places | `/v2/places`: **200**, **537 ms**; **11 provider records** |
| Shortlist | **3 needs-checking**, **0 verified fits**, **0 exclusions** |
| Requests / retries | **2 provider HTTP requests**; no retry, fallback, detail/routing request, second search or AI call |
| Credits/cost | Expected **2 credits** under the documented simple-geocoding and ≤20-place rules. Project dashboard usage and invoiced cost were not independently inspected; no billing/plan change was made |
| Unknowns | Every card retains `price.amount=null`, unknown currency/basis/coverage and `hours.kind=unknown`. Timing and budget checks remain `needs-checking`. The 20-minute drive limit remains unchecked; only straight-line distances from the provider's reported center are calculated |

## Place and source checks

Checked independently against primary OSU pages after the single provider search. These read-only website/map checks were not additional Geoapify calls, and their findings were **not** injected into the app as if supplied by its adapter.

| Returned place | Independent evidence and limitation |
| --- | --- |
| **University Museum** | OSU's [campus feature](https://www.osu.edu/impact/life-at-ohio-state/hidden-in-plain-sight) corroborates the museum in University Hall. The [Alumni Magazine description](https://alumnimagazine.osu.edu/story/our-collective-keepsakes) gives **230 North Oval Mall**, while Geoapify reports **281 West Lane Avenue**. The museum is corroborated, but current visitor hours and the provider address/pin must not be treated as verified. Historical opening information does not prove access for the selected Saturday |
| **Museum of Classical Archaeology** | Its [official site](https://moca.osu.edu/) places the collection in **028 Dulles Hall** and says it does not maintain open hours; a special visit must be arranged. Geoapify reports **281 West Lane Avenue**. Existence is corroborated; the supplied location and ordinary walk-in suitability are not. Do not treat this as an available public outing |
| **Orton Geological Museum** | The [OSU directory](https://artsandsciences.osu.edu/academics/departments-centers/orton-geological-museum) corroborates **155 South Oval Mall / Orton Hall**, matching the provider's street address. The [visit page](https://ortonmuseum.osu.edu/visit) asks visitors to confirm access, especially Saturdays. Its hours differ from the [about page](https://ortonmuseum.osu.edu/about-museum); neither establishes the chosen date/window. Free admission is not a verified zero total outing cost |

The three exact returned [University Museum map pin](https://www.openstreetmap.org/?mlat=40.0006456&mlon=-83.0144603#map=17/40.0006456/-83.0144603), [MOCA map pin](https://www.openstreetmap.org/?mlat=40.0010711&mlon=-83.0142055#map=17/40.0010711/-83.0142055), and [Orton map pin](https://www.openstreetmap.org/?mlat=39.998208&mlon=-83.01192#map=17/39.998208/-83.01192) each returned **HTTP 200 / HTML**. Their query coordinates match the adapter's records. They are useful as provider-location pointers, **not verified directions, venue identities, prices, hours or official venue pages**. The address discrepancies limit their usefulness. Visual map rendering and actual clicks remain unverified because no browser is connected.

This check exposed misleading link labeling: the card's price-check next step pointed only to a map. The UI now separates **Next: Check total per-person prices** from an accurately named **Open source map** link and labels the provider location as needing confirmation. No city-specific override, scraper, extra provider, stored venue correction or silent feasibility upgrade was added. Official evidence remains in this review record; the temporary manual-candidate workflow can accept organizer-entered corrections separately.

## Acceptance and checkpoint

- **Passed:** one real provider search through real disposable persistence/HTTP; strict response parsing; known-source IDs; unknown cost/hours/drive-time checks; no false verified fit; all three map URLs respond; primary OSU sources corroborate the three entities with the limitations above.
- **Partial:** address/pin accuracy, walk-in suitability and source-link utility. Two provider addresses are inconsistent with OSU information. Entity existence does not establish availability or a correct arrival location.
- **Unverified:** rendered desktop/phone/browser source-link flow; real hosted callback/signed-in save/search; exact selected-date hours, capacity, total expense and actual travel time. No dashboard credit/cost verification beyond Jace's Free-plan report.
- **Deferred:** hosted Section 6 migration and pending Section 5/6 manual checks remain unchanged. Section 7B and later work have not started.

Fresh checkpoint checks: **178 offline tests passed, three intentional DB-suite skips; type checking, zero-warning lint and builds passed**. The prior 19-test disposable backend suite is reused because backend logic is unchanged, supplemented by this current real-HTTP/disposable/live-provider run. React static markup from all three actual returned DTOs shows **Price unknown**, **Hours unknown**, **Travel time unknown**, unverified-location notices and separately named source-map links; this is not browser/layout verification. Development workspace, guest route, places preview and proxied health all return 200.

Two ordered checkpoint review patches are prepared under `artifacts/checkpoints`: Section 6 first, Section 7A second. An isolated index proves that together they reconstruct the current candidate tree. The actual index and working files remain untouched; **no commit or push was made**. The patches are reviewed for configured secret values along with source and frontend assets. Detailed sensitive-file/checkpoint status is in PROGRESS. Section 6 and Section 7A are kept separately reviewable; this verification does not authorize pushing or deployment.
