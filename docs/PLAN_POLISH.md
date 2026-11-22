# Compact Plan polish and live suggestion diagnosis

November 15, 2026. Local changes above pushed **9297989**. No commit/push, deployment, migration, credential change, billing change or hosted write in this pass.

## Screen

- The overview is a single compact panel. Friday reads **Bowling suggested**, **Friday evening · tentative**, and **Which Friday works for everyone?**. **Review the date** is its primary action and opens/focuses the existing exact-date editor. The short question link separately opens the existing question editor. Save navigation stays adjacent. These are display labels, not changes to stored facts or evidence.
- Next actions still derive from actual facts. Conflicts lead to conflict review, blank summaries to manual entry, complete sample data to save options. Disjoint confirmed firm availability now leads to availability review, without claiming a known date is unknown. Proposed activities remain proposals; no booking is inferred. An original SVG ridge vignette follows the gallery’s sandstone illustration style.
- People cards show at most three useful fact rows, rather than repeated unknown placeholders. Sam’s Friday card reads **Maybe after 7 · AM/PM unclear** and **20/person · confirm currency**. Full facts, strength/status, historical evidence and source quotes remain under each card’s **More details & sources**. IDs and explicit mappings still determine attribution. Missing availability is shown when relevant. Unknown, zero, non-USD and unresolved currencies stay distinct.
- Initials use subtle warm accent variations. Card/row keys remain stable, Edit remains in the header, and an applied row receives feedback for 1.2 seconds. The feedback ends for reduced-motion users too, without removing the corrected value. A card edit restores a previously closed Sources disclosure and focuses the changed row. Existing validation, original excerpts, AI review labels and unapplied-edit guards remain.
- **Open questions (3)** uses the actual unresolved count and hides the long question list. **Sources & attribution** consolidates global facts, evidence and speaker mappings. **Planning tools** contains Suggest a plan, Check fit without AI, candidate entry, disclosure, results and errors. No AI action or provider disclosure occupies the overview.
- The same canvas, seeded particles and elapsed clock now project the working screen’s dots into side margins. Most are soft white; a few use the logo’s orange and yellow. The diagonal wave, small orbital drift, phone particle reduction, hidden/offscreen pauses and static reduced-motion rendering remain. The opening hero’s dot treatment is preserved. Native scrolling, logo, favicon, gallery and palette stay.

## What caused the LAN error

The old reference in the screenshot was **dd4e086c-447c-450c-b22b-af4d829a5434**. It was not found in retained local artifacts, so that individual log entry could not be correlated. Repeating the equivalent synthetic request reproduced the exact failure category:

**PlanSuggestions.run → relative /api/suggest-plan → Vite proxy to 127.0.0.1:3001 → local-origin guard → strict input contract → owned/scoped context and deterministic fit checks → Gemini adapter → strict ID-only response validation → client snapshot checks.**

The proxy forwards the browser Origin; it does not make a LAN Origin trusted. The LAN guard rejects before input parsing, provider configuration or Gemini. The existing rule remains unchanged. Browser-side origin detection is only a UX hint; it does not authorize anything on the server.

The LAN UI now explains **“To use AI suggestions, open Fuzl on the Mac running it at http://127.0.0.1:5173.”** before a click. It disables unsupported server actions and keeps samples, local edits, quotes and navigation available. Server fit checks also need the Mac URL. It never rewrites the API origin or transfers a draft to another address. Request failures retain safe references inside Planning tools.

The loopback request worked; no provider/model/key/proxy wiring repair was needed. Missing date/window information now has its own explicit prerequisite, rather than paying for a choice with no usable timing. Anonymous Friday cannot submit suggestions until an exact common window and reviewed availability exist; Check fit without AI can still inspect its unresolved facts on the Mac. Saved sessions defer this readiness check to the server’s current reviewed attendee scope, so unanswered people outside an opted-in subset do not incorrectly block that subset. No date, AM/PM or attendance is invented.

## Actual API results, distinct from UI/browser checks

These were deliberate HTTP requests using the existing synthetic sample payloads and actual browser-equivalent Origin headers. They were **not mocked**, and were not automated browser clicks.

| Case | Request address and Origin | Actual result | Provider |
| --- | --- | --- | --- |
| Saturday bowling, first LAN probe | http://192.168.1.105:5174 | HTTP 403, origin_rejected; reference 359e4249-0bbe-4703-bb09-75bac64b6d77 | Stopped at local guard |
| Saturday bowling, Mac | http://127.0.0.1:5173 | HTTP 200; selected existing activity ID a-activity; needs-checking | **Real Gemini**, gemini-3.5-flash-lite |
| Friday, maybe, Mac after prerequisite change | http://127.0.0.1:5173 | HTTP 422, proposal_details_required; reference a546ef5e-1597-4874-8f89-75edc9fc5a17 | Stopped before Gemini |

**Exactly one live Gemini request.** Provider latency **1,158 ms**, **151 input / 13 output tokens**, 1,186 ms observed HTTP duration. Cost and project billing tier are unknown. No retries, fallback, billing/account changes or bulk evaluation. No manual venue was needed: Saturday already supplies a reviewed proposed activity and explicit overlapping availability.

The successful response is an **unreviewed proposal**, not a verified venue fit or booking. Cost, venue hours, travel and booking details remain unresolved. Gemini receives only the existing allowed candidate labels/IDs/categories and derived group window. Participant records, source quotes, structured budget fields, private answers, credentials and personal history are excluded. Organizer-supplied labels can contain arbitrary text; do not put private notes in them. Source/schema checks and saved ownership/private-budget/scope/revision checks remain.

## Checks and limits

- **npm test: 360 passed, 13 intentional DB skips, 373 total, zero failures.** Includes all three sample/replacement paths, compact labels, direct question focus, card edits and timed feedback, full provenance, missing/zero/currency, duplicate/unmapped IDs, LAN preflight, retained error references, timing prerequisites, saved attendee projection, stale responses and field geometry/lifecycle. Provider failure paths also use explicit synthetic mocks; those are separate from the live request above.
- Type checking, lint and production builds pass. Existing Vite large-chunk advisory remains. No database schema/migration change, so no new migration/reset/disposable-DB run. Prior hosted account/guest/ballot/plan/migration checks stay pending.
- Browser selection returned **No browser is available**, and discovery **[]**. No rendered desktop/phone viewport, Safari or physical device check ran; screenshots and a motion/edit clip could not be captured. DOM and canvas simulations do not prove appearance or animation quality.

## Exact review path

1. On the Mac: **http://127.0.0.1:5173/** → **Try a sample plan → Friday, maybe**. See the compact activity/tentative Friday line, Sam’s concise rows and primary **Review the date**. Activate it with the keyboard; the existing blank date input should receive focus. Cancel without inventing a date.
2. Use **Review question →** in the overview. Open questions should expand and its actual question form receive focus. Applying a resolution still requires written text and does not change related facts automatically.
3. Open **Saturday bowling** and **Indoors or outdoors?** through the existing replacement confirmation. Saturday keeps proposed bowling separate from confirmed availability; the other sample leads to the real conflict control. Check a blank summary and a controlled saved session too.
4. On a People card: **Edit → Edit budget per person → 30 → Apply changes**. The same card should show the correction, briefly glow on that row and receive focus; original supporting chat text remains unchanged. Open **More details & sources**, then inspect its quotes.
5. Expand **Planning tools**. Disclosure precedes Suggest a plan; candidate details/results/errors remain in the panel. Friday asks for an exact date/window and reviewed availability without calling AI. **Check fit without AI** is deliberate and provider-free. Do not make another live request merely to inspect this UI.
6. On the same Wi-Fi: **http://192.168.1.105:5174/**. Open samples/edit locally. Expand Planning tools and verify the local-Mac explanation before the disabled AI action. The Mac address on a phone points to the phone, so keep this tab open and use the Mac for AI. No cross-origin draft transfer was added.
7. Render steps 1–5 at **1440×900**, **1024×768**, **390×844** and 320px. Check all cards, touch targets, focus, no overflow, paste/upload draft preservation and visible side drift. Enable reduced motion: dots stay static and row feedback uses color/border without movement. Hide/restore the tab and scroll in both directions. These real rendered/device observations remain pending.
