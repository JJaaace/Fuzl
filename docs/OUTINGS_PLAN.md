# Outings-first Plan workspace — local review

November 21, 2026. Built on the existing local Plan/People/sign-in work above pushed `9297989`. Changes remain local. No new migration, dependency, environment setting, hosted write, sign-in email, billing change, deployment or push.

## What visitors see

The actual session/sample title leads, followed by a compact group/window line and up to three illustrated outing cards. The first suggestions are explicitly **Sample activity idea** or **General activity idea**. They are hand-authored comparisons, not researched venues or AI output. Unknown venue, cost, hours, travel and booking details remain unknown. The Saturday sample includes a clearly synthetic $25 total to exercise Sam’s $20 firm limit; that option is in **Excluded options**, with Add disabled. Real imported conversations never inherit that fixture price, even when their wording matches a sample.

Friday’s exact date stays unresolved and Sam remains tentative. General ideas work now; **Review the date** opens the original editor. Events and date-specific hours/availability still require explicit dates/windows. The conflicting indoor/outdoor sample leads with the disagreement and opens its existing question editor. Questions do not automatically edit the related facts.

**Add to shortlist** uses the existing public option snapshots and three-option maximum. **More general ideas** compares another small authored set without a provider request or clearing selections. Choices stay temporary until the organizer saves the session and explicitly saves the shortlist. Loading ballot controls preserves any choices already made on Plan, while retaining the saved revision for conflict-safe writes. Published options, votes, plan revisions and RSVPs retain their existing workflows.

People, availability, budgets, firm requirements, preferences and editing are under **Group details**. **Open questions** and **Sources** keep existing editors, mappings, full facts and excerpts reachable. Successful person edits return focus to the changed row and retain the brief row feedback. Saving is reachable beside the suggestion actions. Advanced manual-candidate and fit controls remain under **Planning tools**.

## Request and state flow

- `PlanOutings.tsx` renders the same cards for samples, accepted imports and reopened sessions. `ideaCatalog.ts` supplies explicitly labelled general comparisons; `OutingArt.tsx` is original decorative SVG artwork. Neither fabricates venue evidence.
- `assessIdeaOptions` extracts the existing deterministic proposal checks into shared code. It reuses Places fit categories, participation, private spending, approved memory, visit evidence and travel checks. Memory cannot bypass a firm failure. Known total costs fail closed against firm budgets; unknown prices never establish affordability.
- Owned sessions use `/api/check-plan` to load identity-verified, ownership-filtered, revision-checked context before enabling general-idea selection. Missing/expired context disables Add instead of presenting public-only checks as sufficient. These checks make no provider request. Attendance-scope changes invalidate prior results; choices remain visible.
- **Choose with Fuzl → Ask Gemini to choose** is deliberate. It reuses `/api/suggest-plan` and the configured backend Gemini adapter: only candidate IDs/names/categories and a derived known window leave Fuzl. The model returns one allowlisted ID, visibly an unreviewed proposal. It does not invent venues, prices, dates or confirmations. General activity selection no longer requires an exact date; that does not weaken event/time-specific checks. Existing timeout, request limits, no automatic retries/fallback and local-origin controls remain.
- **Find local places or events** opens the existing saved-session search. Saving is requested there if needed; the organizer can keep using general ideas meanwhile. Area resolution, ZIP preservation, date validation, explicit provider disclosures and live-search actions remain in the original finders. Accepted results feed Plan using the existing place/event shortlist mappers, retaining useful links and unknown details. Search input, mode, scope or summary changes hide old results. Empty listings have a separate state; they are not silently replaced with supposed provider results.
- `ShortlistProvider` lifts the existing temporary shortlist state above Plan and saved-session discovery. Provider-independent typed `DiscoveryProvider` carries only existing result DTOs to the cards. No new private fields, persistence or guest endpoint are introduced.
- Requests capture facts, manual candidates, saved revision, scope revision and edit revision. Duplicate submissions are locked; malformed, stale, failed or timed-out responses cannot replace current work. Old chosen snapshots remain selections, not fresh fit claims.

## Ask Fuzl

Try **When is Sam available?**, **What is our budget?**, or **Who wants something indoors?** This is a bounded recorded-facts question tool, not an open-ended chatbot or web search. It supports availability, public budgets and preferences; other questions explain that scope. Duplicate names require a stable participant choice. Unmapped speakers and missing answers remain unknown. Tentative wording, current dates, currencies, firm/flexible labels and unreviewed extraction status stay visible.

`plan-questions.ts` answers deterministically from the current applied summary. Original quotes remain behind **Source**; current corrections win over older text. A request to change a value returns an **Open correction editor** action, never a mutation. The input limit is 300 characters. Answers have validated fact/source references and disappear as current answers after facts change.

Unsaved sample questions run the same helper offline. Imported and saved questions POST `/api/ask-plan` on the backend. Saved questions verify organizer identity and ownership, session revision and guest provenance through the existing Places context loader, then recheck its version. Retained private budget answers/history are never arguments to the answer function, response fields or provider input. Nothing is published or persisted. Only the existing organizer-authorized summary excerpts are reachable. Guest routes remain separate. LAN previews can use sample questions; backend questions retain the Mac-origin restriction.

## Sign-in motion

The existing illustration now has a closed 30-second curved firefly route, a small cabin loop and smoothly varying speed/brightness. Closely spaced control points create the cabin linger. Paused time does not accumulate. The existing journey lifecycle stops frames offscreen/hidden and places a static light for reduced motion.

The existing canvas has an optional broad oval projection for sign-in. Stable angular positions, equal thirds of ivory/ember/gold, bounded local drift, responsive density, capped pixel ratio and the established visibility/reduced-motion lifecycle keep the form unobstructed. The workspace’s normal field and pointer ribbon are preserved. No email is sent on opening sign-in or its preview.

## Verification evidence

Automated results are recorded in PROGRESS.md. DOM simulations cover all samples, imported facts, optional details, direct clarification/source links, correcting budgets, temporary shortlist preservation and saved revision handling, Places/Events fixture handoff, search invalidation, private-context failures/redaction and late answers. Service tests cover missing/expired credentials, other-owner contexts, context revision changes, duplicate names, missing/tentative statements, corrected/zero/unknown budgets, indoor conflict and read-only embedded instructions. Motion tests cover route continuity/linger/brightness and oval geometry/colors/pause lifecycle. These tests do not measure rendered layouts or certify hosted auth.

Actual HTTP smoke checks against the running Vite/API proxy:

| Check | Actual result | Provider use |
| --- | --- | --- |
| Loopback `/api/ask-plan`, synthetic Sam question | 200 `recorded-facts`, references `b-time` | None |
| Same request with LAN origin | 403 `origin_rejected` | None |
| Loopback `/api/check-plan`, synthetic Friday | 200 `checks`, exact date null | None |
| Workspace, sign-in preview, API health, LAN page | 200 | None |

The HTTP observations are not browser clicks. **Zero live Gemini, Geoapify, Ticketmaster or authentication requests** ran for this pass. Gemini tests inject a synthetic selector; search tests use labelled fixtures. Earlier live results remain historical, not retested here.

Browser discovery returned `[]`. No rendered desktop/phone screenshots or recording could be captured. Safari, real mobile, desktop/phone overflow, measured composition, keyboard focus/scroll, full sign-in animation and reduced-motion appearance remain **unverified**. Hosted callback completion, identity/original-tab preservation, save/reopen/edit/delete/conflicts, real two-account isolation, guest/ballot/RSVP/memory and hosted migrations remain pending as previously recorded.

## Exact local review path

1. Open **http://127.0.0.1:5173/** on the Mac. In **Try a sample plan**, open **Friday, maybe**. The title, three people, tentative Friday and illustrated ideas should appear together. No Analyze action is needed.
2. Add Bowling to the shortlist; click **More general ideas**. The selection must remain. Use **Review the date**: the exact date is blank; Cancel keeps it unknown.
3. Ask **When is Sam available?** Read “Maybe after 7,” AM/PM uncertainty and unresolved exact date. **Source** should open the original quote without starting an edit. Ask about Jordan to see missing availability.
4. Open **Group details**, Sam → **Edit budget per person**, Apply an explicit correction. Ask about the budget again; the current value should change and original text stay accessible. For a full affordability example, open **Saturday bowling**: the $25 synthetic mini-golf option starts excluded against Sam’s $20; changing Sam to $30 moves it to Still needs checking, never a verified venue.
5. Open **Indoors or outdoors?**, then **Review the conflict**. Inspect both requirements and Ren’s current $15 correction. Cancelling must leave the disagreement open. Gallery replacement confirmations must preserve another sample’s unapplied edits when declined.
6. In an owned saved session on the Mac, **Find local places or events** opens the existing controls. Choose **02108** and **Show demo results** (fixture); the sourced fixture cards should appear on Plan. Change area: old results must become stale, with shortlist choices retained. Events demo fixtures are fixed to **2026-11-14** (historical sample date); choose explicit dates and **Show demo events**, never Search real events for this review. Save/reopen a real controlled session only as a separate hosted acceptance check.
7. Open **http://127.0.0.1:5173/?design=signin**. Watch the full 30-second firefly cycle, especially the cabin loop and return. Hide/show the tab, scroll the form offscreen, resize and turn reduced motion on. The form must remain still/readable. This preview uses mock sending states; it performs no real authentication.
8. Repeat samples and Group details at 390px then 320px widths; Tab through cards, questions, source actions and editors. Check 1/2/6/12/20 people at **/?design=people**. Inspect real Safari/phone separately and record the observations before claiming those checks passed.

Same-Wi-Fi fixture preview: **http://192.168.12.248:5174/** while the Mac and servers remain running. Temporary planning data does not transfer between addresses. Real AI, saved-context checks and backend questions use the supported loopback app. No public hosting link was created.
