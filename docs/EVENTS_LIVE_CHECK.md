# Section 7C — one live Columbus weekend search

This is a dated verification record, not a current recommendation or an assurance that tickets remain available. Jace authorized one deliberate live Columbus-area search after private backend key setup. No second search, pagination, alternate date/radius, AI request, email, billing change, deployment or hosted migration was performed. Reviews and trend discovery remain outside this pass.

## Configuration and limits

Privately verified `TICKETMASTER_API_KEY` and `EVENT_SEARCH_ENABLED=true` in the existing `apps/api/.env`, alongside the existing Geoapify key/enabling flag. Gemini, Supabase, database and certificate settings were preserved. The file remains ignored, untracked and mode 0600. The tracked example has an empty key/disabled flag. No credential or credential-bearing provider URL appears in this record.

Rechecked the [official FAQ](https://developer.ticketmaster.com/support/faq/) and [Discovery API v2 reference](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/). Both document a 5,000/day default; FAQ says 2/second while the reference says 5/second. Fuzl respects the conservative rate and has lower local action limits. The actual Ticketmaster response supplied `Rate-Limit: 5000` and `Rate-Limit-Available: 4999`. This verifies reported quota metadata, not the account's billing plan, a promise of free access forever, or independently inspected invoicing. No paid plan was enabled. HTTP 429 still stops without retry/fallback.

## Actual request and outcome

| Item | Observed |
| --- | --- |
| Run | **2026-11-08 01:34:27–01:34:29 UTC** (November 7 evening in Columbus) |
| Search | **Columbus, OH**, **15 km** radius, inclusive event-local dates **November 14–15, 2026** |
| Resolved area | Columbus, OH, United States of America; 39.9622601, -83.0007065; America/New_York |
| Synthetic planning | Firm **USD 50 total per person**, flexible live music/local-event preference, firm **30-minute drive** limit. No participant data or raw conversation |
| Entry point | Real `POST /api/private/sessions/:sessionId/events/search`, real owned disposable PostgreSQL session/store; controlled synthetic identity verifier, **not real hosted Supabase authentication** |
| API result | **HTTP 200**, strict result validation passed; **2,245 ms** end-to-end |
| Provider API requests | **Exactly 2**: Geoapify geocoding **HTTP 200 / 1,804 ms**, then Ticketmaster event search **HTTP 200 / 361 ms** |
| Catalog result | **28** reported total matches; **20** records retrieved on page zero. **3 needs-checking cards, 0 verified fits**, **1 cancelled exclusion**. Remaining records are not all displayed; the other eight matches were not fetched |
| Retry/fallback | None. The single-attempt harness writes an exclusive attempt marker before calling providers, preventing accidental reruns |
| Data handling | Only area to Geoapify; resolved center/radius/local date range and fixed response filters to Ticketmaster. No summary, budgets, names, chats, screenshots or participant/home coordinates sent to either |
| Cleanup | Owned disposable cluster migrated locally for the test, then stopped and removed. No hosted data touched |

The response/result was recorded before any listing-page checks. There were useful candidates, but none could be verified against every firm constraint. No additional discovery request was made to improve the outcome.

## What the source actually supplied

All three useful options are on **Saturday, November 14, 2026**, in **America/New_York**. This is the returned shortlist, not a claim that Sunday has no events.

| Specific source listing | Event-local start / venue supplied | Source price range (USD) | Status / availability supplied |
| --- | --- | --- | --- |
| [Ohio State Doctor of Physical Therapy program fundraiser — Ft. Tricycle](https://www.ticketweb.com/event/ohio-state-doctor-of-physical-woodlands-tavern-tickets/14414074) | **19:00**, Woodlands Tavern, **1200 West Third Avenue**, Columbus OH. UTC start 2026-11-15T00:00:00Z | Standard **min=13.57, max=13.57**; card says **Starting at 13.57 USD** | `onsale`; public sales window supplied, **no ticket inventory** |
| [School of Rock Columbus — Fall Mid-Season Show](https://www.ticketweb.com/event/school-of-rock-columbus-rumba-cafe-tickets/14411674) | **11:00**, Rumba Cafe, **2507 Summit St**, Columbus OH. UTC start 2026-11-14T16:00:00Z | Standard **min=0, max=0**; card says **Starting at 0 USD** | `onsale`; public sales window supplied, **no ticket inventory** |
| [Liana Flores w/ Allie Sandt](https://www.ticketweb.com/event/liana-flores-w-allie-sandt-skullys-music-diner-tickets/14212634) | **19:00**, Skully's Music Diner, **1151 North High Street**, Columbus OH. UTC start 2026-11-15T00:00:00Z | Standard **min=26, max=26**; card says **Starting at 26 USD** | `onsale`; public sales window supplied, **no ticket inventory** |

For these records, `dateTBD`, `dateTBA`, `timeTBA` and `noSpecificTime` were false. Event and venue zones agree. End objects contained flags but **no end date/time**, so duration remains unknown. A public sales-end timestamp is **not** an event-end timestamp; it was not used to fill duration. A single equal min/max price range is **not** proof of an all-inclusive total or fee coverage. The zero price is preserved as zero, not null, and does not verify a zero total outing cost.

The real **Shuba** listing at **The Event Center at Hollywood Casino Columbus, 200 Georgesville Road**, November 14 at 20:00, had provider status **`cancelled`** and no price range. Fuzl excluded it and retained **Price unknown**; the 9.22 km straight-line distance did not override cancellation. This is actual live evidence of the exclusion path, not a fixture.

No source supplied a travel estimate. Every useful card keeps the 30-minute drive constraint unresolved. Venue addresses are provider-reported, not independently matched official pages. Total expense/fees, ticket inventory, group capacity and bookings remain separate unresolved checks. No card becomes a confirmed plan or verified fit.

## Card and source-link verification

Rendered the **actual returned DTOs** through the existing `EventCard` component as static React markup: three useful cards and the cancelled exclusion. Assertions passed for:

- **End time / duration unknown**, **Fees and total cost unresolved**, **Travel time unknown** and the explicit warning that onsale does not confirm tickets/group capacity.
- Starting prices of **13.57**, **0** and **26 USD** retained; the cancelled event's absent price stays **Price unknown**.
- No **Fits checked constraints** label, with cancelled status excluded.
- Each anchor's `href` exactly matches that record's provider-supplied URL and is labeled **Open specific event / ticket listing**. The three useful URLs have unique event-specific TicketWeb `/event/.../<numeric-id>` paths, not venue home pages, generic maps or API URLs.

**Limit:** attempts to read the three public TicketWeb pages through the web tool failed; direct public GET checks returned **HTTP 530 for all three**, without following redirects or bypassing access controls. These were separate listing-page reads, **not additional Geoapify/Ticketmaster API searches**. Provider association, specific URL structure and exact card hrefs are verified; successful page rendering, final destination/title/date corroboration and ticket checkout are **not verified**. No retry or alternative ticket-provider call ran. The HTTP result does not establish whether a normal browser on your network can open the listings.

## Browser verification — separate and pending

Browser discovery still returned `[]`, and selection for the local preview failed. **No real desktop/phone, Safari, keyboard/scroll or external-link browser check was performed.** Static markup is not browser rendering. Hosted sign-in, hosted saving and hosted guest migration/testing stay deferred.

Manual check without spending API quota: open the three exact listing links above in your browser and confirm title, November 14 date and venue. If unavailable or changed, leave that source unresolved. For cards, the ignored local `artifacts/events/live-cards.html` contains markup from this one response, with its real links/unknown labels and no new requests. It is an unstyled static artifact, not an interactive UI or fresh search. Use the normal `/?design=places` fixture demo for interaction/phone checks. Do not click **Search real events** again just to review this record.

## Checkpoint verification

Fresh offline suite: **199 passed, four intentional disposable-DB skips (203 total)**; type checking and zero-warning lint passed. An initial concurrent build/typecheck invocation raced Prisma regeneration and failed on temporarily missing generated types; sequential regeneration/build/typecheck passed without application changes. Prior **23-pass disposable DB suite** remains applicable because implementation is unchanged, supplemented here by the real disposable saved-session/live-provider flow. The live cluster was removed.

The event implementation stays local. Existing Sections 6–7B commits/patches are preserved. The separate Section 7C review patch/manifest is refreshed with this record and sensitive-file/configured-value checks. No commit, push or deployment is implied. Hosted Section 5/6 gaps and reviews/trends remain deferred.
