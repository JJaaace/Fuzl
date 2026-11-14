# Section 10.2 — Saved ideas

Section 10.1 was checkpointed and normally pushed as `6616d6be9ef5931409c9a810052a33985fc3bfd7` before this work. Saved ideas were subsequently committed and normally pushed as **01ec983 — Add group saved ideas and checked reuse in future plans**. The separate local 10.3 preference extension is documented in [DISCOVERY_PREFERENCES.md](DISCOVERY_PREFERENCES.md). No provider request, hosted migration, sign-in email, billing change or deployment was made for 10.2.

## Exact no-account demo

The local app is available at **http://127.0.0.1:5173/?design=ideas**. If stopped, run `npm run dev` and open that URL. This development-only page uses the real library, forms, candidate checks, cards and shortlist controls with a synthetic in-memory transport. It makes no API, database, provider or sign-in request. Reload resets it; a simulated preview is not a working shared link.

1. Leave **Demo Group A · Session 1** selected. Enter **Synthetic night market** under **Idea name**, optional link `https://example.com/night-market`, and private note **Sam wants to try this**. Choose **Save idea**. A name alone also works; blank link/check date mean unknown.
2. Choose **Open second session for this group → Add idea to candidates → Evaluate saved ideas (no provider call)**. The card keeps the link, labels organizer-entered information, and shows **Needs checking**, **Price unknown** and **Hours unknown**. It does not assume free admission, opening hours, ticket inventory or a journey duration. The private note is absent.
3. On that card choose **Add to shortlist → Save shortlist → Preview ballot**. Inspect the exact public fields, source link and unknown cost. The private note is absent. Do not interpret a shortlist vote as a booking or attendance confirmation.
4. Select **Demo Group B**. Group A’s ideas and shortlist are absent. Return to A, then **Session 1 · save ideas**. Use **Edit idea → Save idea changes**, **Archive idea → Show archived ideas → Restore idea**, and **Remove idea**. Removal is confirmed. Archived ideas remain in the library but leave active discovery choices.
5. In Session 1 use **Save for later** on **Existing sample result → Save reference to group**. Open Session 2, add that saved sample, then evaluate. Its sample origin and source survive; its original free price and dated hours do not become current evidence. The card still needs checking.
6. Choose **Session 1 · save ideas → Add expired event fixture**. The library marks **Past event — not an active suggestion**. Open Session 2 and choose **Dated events**: that event is absent from active choices. For your own future-event fixture, choose **Idea type → Dated event**, enter a future date and a reliable time zone under **Optional location and source-check details**, then save and evaluate under Dated events. The simulator’s search window is explicitly November 14, 2026, so another date is correctly outside its range.
7. Save the same link again: the server/demo warns about an existing reference. Review it, then deliberately check **Allow a separate repeat or another date…** to save a legitimate second occurrence. Normalization removes common tracking parameters/fragments, but preserves meaningful query differences. The same non-manual provider item also warns across dates; a warning is not a permanent prohibition.

The simulator is not proof of real account isolation. Real ownership/persistence paths were tested separately on disposable PostgreSQL. Browser rendering and phone usability remain unverified.

## Normal organizer flow

**Saved groups → select a group → Saved ideas** provides a compact name, optional link, private note and type. Optional address, category, paired coordinates, time zone and last-checked date are expandable. Links are never fetched or analyzed. Edit, archive/restore and removal use the current idea revision. Group/session navigation and workspace unload/sign-out protection retain the existing unsaved-work warnings; a failed request preserves entered fields.

From an owned saved session’s Places/Events cards, **Save for later** opens the same small editor. The server identifies the card from its owner/session-bound search snapshot and checks the saved revision; a fabricated client card cannot become a provider record. An expired/replaced snapshot asks for a deliberate new search. Saving an idea does not change the session, published ballot, shared plan, RSVPs, actual outing or approved memory.

Open another saved session in the same group, then discovery’s **From your saved ideas**. Ongoing venues/other ideas appear under Places; dated events appear under Events. Add up to three saved/manual additions combined, then **Evaluate saved ideas (no provider call)** after resolving an area with the existing search. This reuses that bounded candidate page and current saved references. New searches also accept selected ideas. A changed radius/date/area still uses the established deliberate search and stale-result controls; no typing-time provider call or automatic retry is introduced. Saved additions have a separate checked result even if the ordinary top three rank above them. Review before using the existing **Add to shortlist** action; the shortlist remains limited to three.

Selected references include their revision. Refresh and remove/re-add an edited idea; an archived, deleted, wrong-group, stale or past/unclear-date idea is rejected rather than silently substituted. Provider baselines can be reused after an idea edit, but current idea versions join context fingerprints for in-flight searches and Make this work previews. Changes to session/private answers/approved memory still invalidate their baseline. Rechecking reloads saved ideas instead of resurrecting cached copies.

## What is stored and what remains unknown

`IdeaContent` stores the organizer’s label, optional safe reference URL, private note, type, optional event date/local clocks/time zone, stable location/category fields and optional last-check date. A separate origin records manual, synthetic sample, Geoapify or Ticketmaster provenance and a stable item reference. Revision, archive/edit markers and request identities protect changes and retries. There is no price, opening-hours, inventory or travel-time snapshot field.

When imported, an idea becomes an **organizer-entered** candidate with visible saved-origin/check-date metadata. Its private note is omitted. Cost is unknown, hours are unknown, ticket/booking status is unknown and no old route estimate is copied, even if the source was checked recently. The existing source-correction workflow can record new, dated place evidence for this outing; its same constraints and private-budget checks apply. Event schedules entered by the organizer remain claims, with unknown provider status. Source-check dates are not automatic freshness guarantees.

No link is represented as `null`, never a made-up URL. Distinct unlinked ideas are not deduplicated or treated as the same memory. Source labels and Geoapify attribution survive shortlist/public conversion. Attribution links are typed separately so an attribution homepage cannot become a venue-memory match. Public option/plan link capacity is narrowly increased to four so the specific source, a matched official page and both required credit links survive together; the three-option shortlist limit is unchanged. Public ballot/plan snapshots contain only allowlisted public fields; they never receive the note, idea edit metadata or private budget. The existing explicit preview/approval/revision workflow controls any later publication.

Ongoing venues do not expire by date. Events past their known local calendar date remain in the library marked Past and are excluded from active suggestions. A missing date is inactive. With no reliable time zone, dates near the current-day boundary remain **date / zone needs checking** and inactive rather than being assigned an invented zone. Future dates still require the normal search-range/time-zone/status checks. Same-day events are not inferred to have finished from a missing end time. Archived and past ideas remain separate from completed outings and approved memories.

### Provider storage choices

Official documentation was consulted for the new durable storage behavior. [Geoapify’s Places API FAQ](https://www.geoapify.com/places-api/) permits storing/caching its OSM-backed place results with attribution; [its terms](https://www.geoapify.com/terms-and-conditions/) also apply. Saving a Geoapify card retains its reference and permitted stable address/category/coordinates/zone fields, labels organizer edits, and preserves Geoapify/OpenStreetMap credits on imported cards and public shortlist snapshots. It does not store raw provider payloads, photographs or volatile price/hours/journey evidence.

[Ticketmaster’s API terms](https://www.developer.ticketmaster.com/support/terms-of-use/) limit caching/storing Event Content to reasonable periods for the service and require removal within 24 hours of a content-owner request; that is not a blanket 24-hour caching allowance. This feature therefore uses a narrower **reference-only** bookmark: specific listing URL/item ID plus the organizer’s own label, intended date and manually entered details. The dialog shows the source title temporarily for orientation but does not prefill/store the API title, schedule, venue, status, prices, images or inventory. Existing temporary search caches remain bounded at ten minutes. There is no durable API-content cache or automatic link extraction added here. An organizer-entered intended date does not prove that an event is still scheduled; confirm at its specific source before shortlisting. No new live-provider check was needed or performed.

## Request and privacy boundaries

New backend routes, all behind existing Supabase identity verification, origin restrictions and private/no-store headers:

- `GET/POST /api/private/groups/:id/ideas` — owner library/create.
- `GET /api/private/groups/:id/ideas/candidates` — active, minimal picker fields; no note.
- `PUT/DELETE /api/private/groups/:id/ideas/:ideaId` — revision-checked edit/remove.
- `POST /api/private/groups/:id/ideas/:ideaId/archive` — revision-checked archive/restore.
- `POST /api/private/sessions/:sessionId/ideas/from-card` — owned, current-snapshot reference saving.

The group owner is checked on every path, including cross-group IDs owned by the same account. Group locks serialize duplicate/cap checks and concurrent mutations; card saving also locks/rechecks the saved session. Creates use a stable request ID/hash, updates/archive use revision plus request ID/hash, and repeated removal is safe. Double-click locks and abort guards protect the client. List refresh does not cancel an independent save or overwrite its accepted row with an older list response. Safe errors preserve fields without logging raw database/auth errors, notes, source conversations or credentials.

Current-group candidates are resolved on the server before any provider call, with active-date/type/revision checks. Evaluation receives only the sanitized candidate plus current server-held private checks and approved group memory. Provider request allowlists are unchanged: no idea IDs, private notes, conversations, attendee data, private budgets or saved reference URLs are forwarded. Ranking/memory stays subordinate to firm constraints. A group-level revision fingerprint reads only idea identity/revision/archive/date/type/zone, not private notes.

Bounds: 100 stored ideas per group including archived ones; name 160 characters, note 500, safe optional link 1,000; at most three saved/manual additions and three shortlist options. Input dates, paired coordinates, clocks, time zones and URLs are validated. Authentication URLs/embedded credentials are rejected. There is no bulk link fetch, background search, new key, environment setting or dependency.

Important code: `packages/planning/src/ideas.ts` and `idea-reference.ts` (model, expiry, conversion); `apps/api/src/ideas/` (owned persistence/routes); existing Places/Events routers/evaluators (current reference resolution and checks); `apps/web/src/ideas/` (library, picker, Save for later, fixture demo). Source URLs became explicitly nullable so no-link ideas use the existing evaluation/card/ballot flow honestly.

## Migration, verification and remaining checks

New additive migration **`202611140003_saved_ideas`** adds `fuzl.fuzl_saved_ideas`, with group cascade, unique creation identity, index, RLS and revoked public/anon/authenticated direct access. Applied/reapplied only on the owned disposable PostgreSQL test cluster without resetting unrelated data; that cluster was removed afterward. **Not applied to Supabase.** No hosted configuration or data was changed.

Before eventual hosted use, review/authorize the intended database rollout and apply the existing migrations with `npm run db:migrate` using the privately configured backend environment, without reset. Pending predecessors remain `202611070001_guest_responses`, `202611120001_ballots`, `202611140001_plans`, `202611140002_outings`, followed by the new saved-ideas migration. Preserve existing TLS, Supabase, Gemini, Geoapify and Ticketmaster settings. No new credential is needed.

Actual command results are in [PROGRESS](PROGRESS.md). Deterministic/HTTP tests, React DOM simulations and disposable SQL are separate evidence from rendered browsers and hosted identity. The browser client had no connected browser (discovery `[]`), so no screenshots, phone/Safari or real keyboard/focus/navigation result is claimed. The local preview and API health returning HTTP 200 establish serving only.

Manual checks still needed:

1. At desktop and 320–360px/Safari, follow the exact demo above. Check long names/links, form labels, date/number controls, focus after Save for later, Enter/Tab, confirmation dialogs, scrolling and unknown/source labels. Test invalid URLs, duplicate overrides and declining replacement.
2. After separately authorized hosted migrations and real callback/identity verification, create two sessions in one controlled group. Save a manual idea and a provider reference deliberately, reload, reopen the other session, select/evaluate and preview a shortlist. Confirm notes absent from public preview. Edit/archive/remove in a second tab and verify stale selected revisions/previews cannot apply; refresh/re-add explicitly.
3. With a second controlled group/account, verify foreign IDs do not read/write/resolve ideas. Verify account switch/sign-out clears private work and protects unsaved fields. Real hosted two-account isolation remains pending despite passing disposable SQL authorization tests.
4. Carry forward existing hosted guest, voting, shared plan/RSVP/reconfirmation, outing/feedback/memory and privacy checks. Saving/importing an idea must not alter a published snapshot or RSVP; a published material change still requires the existing plan revision workflow. Intended reachable HTTPS origins/restricted redirects and real mobile guest checks remain pending before sharing with friends.

The saved-ideas implementation stopped after 10.2 and is preserved in pushed checkpoint `01ec983`. The separately authorized 10.3 preference extension adds no migration. Automated link extraction, notifications and deployment remain deferred; hosted/browser checks above remain pending.
