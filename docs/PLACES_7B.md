# Section 7B — US areas and sourced venue details

Section 7B extends the existing Geoapify adapter, evaluator and cards. No extra live provider call, hosted migration, account email, billing change or deployment was performed. The earlier single Columbus search remains historical evidence in [PLACES_LIVE_CHECK](PLACES_LIVE_CHECK.md), not a new test of the changed adapter. Hosted Section 5/6 acceptance remains pending. Events, reviews and trends are outside this milestone.

## Short demo checklist

Run `npm run dev` and open **http://127.0.0.1:5173/?design=places**. This preview uses fixtures only, without sign-in, database or provider calls.

1. **Second metro / leading-zero ZIP:** enter **02108**, keep radius 5 km, choose **Show demo results**. The resolved area is Boston, MA; a Cambridge listing has its own city label. Try **02445** for the Brookline suburb. ZIPs remain text, including the initial zero.
2. **Sparse / empty:** enter **Marfa, TX** or **79843** and show the demo: one candidate and **Sparse coverage**. **Increase radius by 5 km** changes the control; it does not send a request. Search deliberately again for two candidates. Category **park** returns an empty list, with a separate no-listings message. The firm USD 20 budget stays intact.
3. **Ambiguous city:** enter **Springfield**, show the demo, choose MA or IL, then **Search selected area**. No center is silently chosen. Changing the input invalidates the old choices/results. Live clarification similarly revalidates the provider ID before using its coordinates.
4. **Cross-state boundary:** **Philadelphia, PA** / **19103** includes a synthetic Camden, NJ venue within 5 km. It is excluded by the fixture's firm price limit, not by the state line. Its actual listed city/state remains Camden, NJ.
5. **Columbus correction replay:** enter **43210**, category **museum**. These are dated recorded-name fixtures, clearly **Demo results**, not a repeat live search. University Museum and MOCA have **Address needs checking**, with the provider and previously checked OSU values under **Sources & verified details**. Confirm an official-source address. Without coordinates for that address, distance/radius remain unchecked; old coordinates, price and hours are not copied to it.
6. **Record a detail:** expand that place's sources, choose address, price, hours or official page, enter the supporting URL/check date and affirm that it matches this exact venue/location. Record the detail. The source/value/date stays inspectable; conflicting values stay visible. An official link additionally needs HTTPS and a specific identity-match note. Return to another area and back: corrections for the same listing ID/source survive. Nothing becomes a confirmed plan or permanent saved preference.

The source editor also works on organizer-entered manual candidates. Newly added manual candidates have stable local IDs, so removing another candidate cannot transfer their evidence. Results and recorded details remain temporary workspace state; **Save session does not persist them**. Reload/session change/account switch discards them. Existing workspace replacement/sign-out protections are preserved. Unsubmitted source fields trigger replacement confirmation before a search/input change can discard them; declining keeps the inputs. Recording one place also protects unsubmitted fields on other cards.

## Location resolution and request bounds

`place-location.ts` parses US City, State (full name or postal abbreviation), a city without a state for clarification, or an exact five-digit ZIP. Leading zeros are never converted to numbers. State matching supports the 50 states and DC; other US jurisdictions/catalog coverage have not been verified. Name matching normalizes case, accents, punctuation and Saint/Fort abbreviations. A non-exact match requires confirmation rather than inventing an alias.

The backend uses documented structured city/state/postcode geocoding, a US filter and up to five returned matches. It accepts documented city/suburb/district result types, but does not mistake a state/county result for the requested city. Optional missing/null locality fields remain unknown. Multiple plausible matches, state-less cities and non-exact names return choices; there is no extra places call at that stage. The selection is a provider ID, not caller-supplied trusted coordinates. A later explicit choice action geocodes again and checks that ID is still among the eligible matches.

Each deliberate live action makes **at most two** provider calls; initial ambiguity takes one, and a later choice action may take two more. There is no autocomplete, debounce request, automatic broadening, retry or paid fallback. Existing guards still allow one live action in flight, two/minute and ten per API process, with bounded responses and a shared deadline. The new `resolutionId` is used only locally to choose a verified geocoding result; it is not sent to Geoapify as an additional arbitrary parameter.

Places use the selected coordinates and circular radius plus US country filter, never the searched city/state as an exclusion. A venue can cross municipal/state boundaries. Each card uses its own supplied locality; missing locality is labeled unknown rather than copied from the search area. The resolved area is shown alongside results/choices. Invalid input, unmatched location, provider HTTP/network/timeout/output failure, empty results, sparse named listings and firm exclusions are different states. Sparse/empty controls offer deliberate radius/category changes, preserving firm constraints.

Primary references used for the adapter changes: [Geoapify Geocoding](https://apidocs.geoapify.com/docs/geocoding/) documents result types, structured inputs, optional fields and time zones; [Geoapify Places](https://apidocs.geoapify.com/docs/places/) documents circle/country/proximity filters. Provider pricing/attribution/key setup remains in PLACES. Live validation across the new areas is **not** claimed.

## Source and correction rules

The card keeps these distinctions visible:

- **Provider listing / original map:** reported location/ID, with no automatic official-site claim. Provider websites, when present in raw data, are not promoted to official identity matches. Map pins do not verify arrival addresses, prices or opening hours.
- **Organizer-entered candidate:** independently supplied details, not provider data.
- **Organizer-checked source:** each recorded address, price or hours value has a source URL and check date. Official-page versus other organizer-entered sources have distinct labels. Recording a detail requires an explicit exact-venue/source affirmation; Fuzl does not crawl or independently certify that page.
- **Official venue page — organizer matched:** only after an explicit HTTPS source, identity-match explanation and exact-venue attestation. An arbitrary URL or provider field alone cannot produce this label. This is a recorded organizer check, not third-party identity verification.

Different address values remain side by side, including original provider data. An unresolved/unconfirmed/conflicting address blocks the verified-fit category. Explicit confirmation selects a value and records its confirmation date. It does not delete the alternative. A newly selected address uses only its own supplied coordinates/zone. If absent, location-dependent checks stay unresolved. Price and hours evidence are bound to a particular address; old-branch values never silently become the new address's data. The original map is still labeled original even after an address changes.

If a later provider search changes the baseline listing, recorded details stay, but selections and official-link presentation require review again. Target identity is provider/source ID, not name or array position. Unknown/invalid selected references cannot silently pass. Recorded details are capped at eight/place, with an explicit clear action; original listing values remain. Up to 23 candidate corrections and three manual candidates are bounded by the strict API contract. Source URLs are never fetched automatically, preventing a manual URL from becoming a server-side fetch.

## Separate checks and venue-local time

Address, search radius, cost, dated hours, travel duration and booking availability are distinct checks. Firm constraints still run before ranking. Zero versus unknown, currency/basis/total-cost rules, unreviewed AI labels and guest provenance remain intact. A recorded zero with unresolved location is shown, but cannot establish affordability for an unconfirmed address. A price tier/free admission remains insufficient for total cost.

Date/time input is interpreted in the explicitly chosen IANA zone; a blank input zone uses a reliable zone attached to the selected venue/address or its address-bound dated hours. Windows are converted to venue-local date/clocks before comparison. No search-area zone is silently copied to a cross-zone venue. DST folds/gaps and unsupported overnight date-specific coverage remain unresolved. The bounded converter targets modern quarter-hour-offset IANA clocks; unsupported historical offsets do not receive invented instants.

Regular hours do not become date-specific, and booking is always explicitly unverified. Booking does not itself invalidate an otherwise verified *constraint* fit unless the plan has a corresponding firm requirement; generic firm reservation/capacity requirements still need evidence. Likewise travel time is shown as unknown even without a travel-duration constraint. Informational checks are marked separately; actual firm travel limits remain blocking. A constraint fit is never a reservation, ticket, attendance or confirmed-plan claim.

## Rechecking without provider calls

The server caches public venue baselines plus owner/session/revision bindings and an internal private-context hash. It stores **no summary, chat, screenshot, individual budget, respondent alias or organizer-entered evidence** in this cache. There are at most 50 entries, each expiring after ten minutes; expired entries are evicted on access. Cache/process restart or eviction requires a deliberate fresh search. No database schema or dependency was added.

`POST /api/private/sessions/:sessionId/places/evaluate` uses a random snapshot ID and the existing authenticated owner gate. It validates the current summary, correction claims, session revision, search boundary and fresh private-budget context before evaluating the cached candidates. It cannot use another owner's/session's snapshot, alter the radius silently, or make a provider call. Changed private replies or a saved revision reject stale snapshots. Only general private feasibility reaches cards; exact amounts/names/hash remain server-side. Existing inference limitations remain documented in PLACES.

The frontend keeps query/summary/correction fingerprints and synchronous workspace edit revisions. Late results or clarification lists cannot replace changed inputs. Recorded details are retained after a failed/expired recheck and applied only to matching returned listings. Boundary changes disable reuse and require a deliberate search; manual/source edits are never sent while typing. Sign-out/account switch still remounts/aborts private UI work.

## Actual verification

- `npm test`: **187 passed, three intentional real-DB-suite skips** (190 reported tests). Existing flow plus US/ZIP/state/suburb/ambiguity/cross-state/sparse fixtures, corrected address dependencies, source/official attestation, preserved dates, DST/time-zone conversion, cache scoping/expiry and React fixture workflows.
- `npm run test:db`: **20 passed**, with the owned cluster stopped/removed. Real disposable owner-scoped search/recheck tests cover source retention, private redaction, cross-owner/missing snapshot/changed boundary and stale private context, alongside all Section 5/6 tests. No hosted migration or real account test.
- Type checking, lint (zero warnings) and shared/web/API builds passed. Compiled health 200 and unauthenticated recheck 401/no-store; development workspace/guest/preview/module/health return 200. Configured-value scan covers candidates, frontend assets and all three review patches; no credential/private-file match, `.env` ignored/untracked/0600 and real index unchanged. Detailed results in PROGRESS.
- Browser discovery returned no connected browser. **Rendered desktop/phone layouts, keyboard/focus behavior and actual source-link navigation remain unverified**. React DOM tests are not a layout renderer. Use the checklist above at desktop and 320–360px width; tab through area choices, sparse controls and source editor, then change location during a throttled request and confirm the old list stays hidden.
- **No Section 7B live provider request was made.** The earlier two-request Columbus search was not repeated. Hosted guest migration/verification, actual managed-account flow and Section 7C remain deferred.

The Section 6 and 7A patches were verified to match the working tree before edits and remain byte-for-byte preserved. Section 7B is provided as a separate delta from that frozen tree; no commit, push or deployment is implied by its review patch.
