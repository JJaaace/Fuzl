# Group planning conversations

Native outing conversations are implemented locally above checkpoint `6ee0ec0` on `main`. They reuse owned groups, saved sessions, verified Supabase identities, the Gemini extraction adapter, the editable summary, fit checks, shortlist, ballots and shared-plan/RSVP screens. New work is **uncommitted**. Hosting and real-account acceptance are pending.

## Try the offline demo

Open **http://127.0.0.1:5173/?design=chat** after `npm run dev`. No sign-in, email, database or provider call is needed. The banner and responses identify a hand-authored fixture; arbitrary demo text is stored in memory, not analyzed. Reload resets it.

1. Read Alex, Sam and Jordan's **Friday night** messages. They include a public budget, tentative availability, and a firm drive limit. Send a normal message: it does not start AI.
2. Click **Make a plan**. The simulated mascot thinks, then the response reveals up to three general ideas. Costs, venue hours, travel and booking stay unknown. Click **Add to shortlist** on one or two ideas.
3. Click **Open proposed plan →**, then **Review proposed update**. Inspect People, questions, evidence and existing editors. Check the shared-summary approval and click **Apply shared summary**. This does not publish a plan or book anything.
4. Open **Chat**, send `@Fuzl when is Sam available?`, and open **Source →**. This recorded-fact answer uses the approved shared summary, with uncertainty; it does not call a model. Duplicate names require an explicit person selection.
5. Use **Sam shares later availability**. The prior proposal becomes out of date. Click **Make a plan** again, review and explicitly apply the later proposal. Existing published details and RSVPs stay unchanged.
6. In **Plan → Shortlist, voting & next steps**, click **Save shortlist → Preview ballot**, approve the exact public preview, then **Publish ballot**. In the fixture controls open **Guest ballot demo**, choose an option and submit/change a vote. Return to **Alex · organizer**, open Plan and **Refresh tallies**.
7. Click **Confirm final plan demo**, explicitly select a published option, fill a clear date/time/meeting point, save, preview/approve and publish through the existing controls. Create its plan link, then open **Guest RSVP demo** and respond. These are the existing in-memory ballot and plan engines sharing the same fixture; their generated demo URLs are not real invitations.
8. Try **Quick success**, **Provider error**, **Cancel request**, and **Interrupt fixture connection / Restore fixture connection**. Switch between the three fixture identities. **People** can simulate removal. These identity controls simulate clients; they are not a real two-browser/account test.

The normal workspace at `/`, screenshot imports at their usual entry, and `/guest`, `/vote`, `/plan` routes remain separate and usable. Opening **full workspace** from a real thread reopens its owned session. A demo does not create a matching real account/session; remain inside the demo controls.

## Local setup for real persisted conversations

Keep the existing backend-only Supabase, database/TLS and Gemini settings in ignored `apps/api/.env`. No new provider or secret is needed. Never put tokens or credentials in frontend variables or chat.

Migration **`202611210001_group_conversations`** adds five `fuzl` tables: threads, members, invitations, messages and request receipts. It enables RLS and revokes direct PUBLIC/anon/authenticated access. It changes no existing table data. Deleting an owned group/session cascades its native thread; the UI must treat that as deletion of its history too.

The migration was applied by `npm run test:db` to a disposable PostgreSQL cluster owned and removed by the test runner, including repeat `migrate deploy` and preservation of unrelated data. **It has not been applied to Supabase.** Do not run a reset. When separately authorized to use a persistent local or hosted database, review the target privately, retain the existing certificate/connection setup, then use `npm run db:migrate` (deploy existing migrations) and `npm run db:generate`. `npm run dev` starts Vite 5173 and API 3001; health is `/api/health`. Until its migration is applied, real conversation routes return a safe storage/setup error; the fixture remains available.

For a controlled real local test, sign in using the existing flow (no email was sent during this task). Open **Conversations → New outing thread**, choose an owned group, name the outing and your conversation identity. Or use **Saved groups → session → Start outing conversation**. Each session has at most one thread. The shared plan starts empty: connecting a private session never publishes its imported sources, notes or private answers.

In **People**, create a seven-day invitation and copy it privately. The fragment is scrubbed before rendering; only its digest is persisted. Open the link in a second controlled browser profile on the same supported local origin, review exactly which history is shared and explicitly join. The local API accepts the configured exact `APP_ORIGIN`, or the documented loopback origins when unset; it does not broaden this boundary for a LAN preview. The fixture can be viewed over the LAN. Do not share real links with friends before hosted/account/browser verification and appropriate hosting configuration.

## Identity and audience boundaries

- The organizer must own the group/session. Signed-in membership uses server-verified Supabase identity, including expiration and verified email. An editable alias or equal display name grants no access.
- Guests use a **dedicated chat credential**, distinct from survey, vote and RSVP credentials. Only its digest is stored server-side. The browser keeps the credential in per-thread `sessionStorage`; no message text is cached there. Closing that browser session can lose edit/access permission. Account switch/sign-out clears chat credential slots and remounts the view, aborting old work.
- Every history, message, source, sync stream, question and plan request checks current membership. Organizer-only actions include invitations/revocation, identity mapping, rename, moderation, shared-summary approval, shortlist saves and publishing. AI is organizer-only by default; the invitation can explicitly grant members generation permission. All members may ask recorded shared-fact questions.
- Leaving or removal disables that membership immediately. Expiry or invitation revocation disables all identities joined through that invitation. Membership does not imply attendance, opt-in, vote or RSVP. A still-valid forwarded invitation can create a **new** identity; revoke the invitation to close that route. Removed memberships cannot be reclaimed by matching names or retrying the same join.
- **People → Connect conversation identities** lets the organizer explicitly map a native identity to an existing planning participant, uniquely. This does not rename or authenticate that person. Imported participants are not matched by name. Until reviewed, distinct IDs remain distinct and incomplete attendee scopes remain unresolved.
- All thread members can read its entire native history and approved shared facts. Imported chats/screenshots, private saved-session sources, notes, individual feedback, travel history and private spending answers are never copied into that view. Private constraints are checked server-side; a failure is reduced to a generic exclusion without its owner, value or private explanation. Public/shared facts can include budgets people deliberately post to the thread.

## Request and state flow

`packages/planning/src/chat.ts` defines strict requests, shared DTOs and version checks. `apps/api/src/chat/store.ts` serializes changes under a thread-row lock. Messages get a server timestamp, ordered sequence and change version; `(thread, member, submission ID)` is unique. A retry with identical text returns the original; changed text with the same ID fails. Native chat text is persisted. Imported text/screenshots retain their previous temporary/supporting-excerpt behavior.

`router.ts` exposes bounded, no-store JSON and fetch-based SSE. Credentials travel only in headers, not query strings. Streams carry **version metadata only**; clients fetch authorized changes. Short 15-second leases reverify account credentials on renewal; membership is checked on each one-second tick. Reconnect uses bounded backoff (four failures), then an explicit reconnect action. Pages contain 50 messages; incremental sync deduplicates IDs/versions, retains order and applies tombstones. More than 100 changed records requires an explicit reload rather than showing an unsafe incomplete history. The wire format follows the [HTML server-sent event specification](https://html.spec.whatwg.org/multipage/server-sent-events.html).

`ChatRoom` keeps an optimistic outbox and draft per open thread in local React state. Failed sends retain exact IDs/text for retry. Near-bottom readers follow new messages; older-history readers get **New messages**. Loading older pages compensates the scroll height. In-app navigation and browser exit guard unapplied Plan edits; changing accounts clears the old view. No offline background delivery or push notification is implemented.

**Make a plan / @Fuzl make a plan** runs the existing Gemini extractor once, deliberately, using a bounded snapshot of recent native messages (at most 40 rows, 6,000 characters). Stable neutral sender labels and JSON-quoted message text prevent embedded newlines from impersonating senders. Existing extraction treats all conversation instructions as untrusted data. The same schema/source checks apply; native binding also verifies each quote belongs to its sender/message and personal claims have that identity's evidence. Unknown amounts/currency/date/time remain unknown; tentative claims and AI review labels persist. Unsupported output fails as a whole rather than dropping claims. No live venue/event search runs from this action.

Applied shared facts are merged into the proposal and used by the existing deterministic catalogue/fit pipeline. Private saved-session constraints, reviewed attendee scope, approved memories and travel history are loaded/checksummed server-side, never sent to Gemini. General ideas have no invented provider evidence or known price/hours/travel/booking. Thread/fact/session/private-context versions bind the receipt. A later message, edit, scope/history/private-answer change cannot silently apply an older proposal. A shared correction uses **Edit shared plan**, then the existing editors and explicit approval, without an AI request.

Focused `@Fuzl` availability/public-budget/preference questions use the deterministic recorded-fact answer service over the **shared** applied summary only. They do not reveal imported or private facts. All other messages are ordinary chat. No request runs on typing, receiving, reopening or reconnecting. There is one generation lease per thread, a 50-second generation bound, three generations/minute/member, ten per API process and bounded route/read/stream limits. There are no automatic model retries or paid fallback. A timed-out client can **Check previous request** using the same ID without another generation. Cancellation is creator-scoped; an already-started provider call may consume quota.

**Review proposed update → Apply shared summary** explicitly merges reviewed shared facts into the owned session, keeping imported/manual/private constraints. Earlier native facts superseded by the update become historical. Shared corrections and source quotes have server allowlists. Unapplied working edits remain visible when context changes and cannot apply until reviewed against a current proposal. Saving/publishing a shortlist, choosing a final plan and material RSVP-reconfirmation remain their existing separate actions; chat never silently revises a published snapshot.

Authors can delete their native messages; organizers can moderate. This tombstones message text, removes derived sources/facts from the working shared/private summaries, withdraws prior Fuzl response payloads and invalidates pending proposals. Existing immutable published plan snapshots are not rewritten. Deletion cannot undo a provider request or erase copies already read by other people. Native history is retained until moderated or its owned session/group is deleted; there is no automated retention cleanup.

## Mascot and layout

The existing bomb/crescent/three dots appear in chat and compatible explicit Plan AI actions. `AIActivity` ties thinking to actual request state, success to a usable response and errors/cancel to a settled mark. A bounded completion event adds 24 sparks (12 on phones, maximum 48) to the existing canvas, cleans them after 1.25 seconds and ignores hidden/reduced-motion bursts. Reduced motion uses dot brightness and a simple completion state. It is decorative and never delays showing a response. Existing header/favicon remain unchanged.

Desktop has owned groups/threads, central conversation and a collapsible Plan panel. Phone CSS offers Chat/Plan/People and a safe-area multiline composer. These layouts and animations still need rendered/device verification; DOM tests do not establish their visual quality or keyboard behavior.

## Verification and remaining checks

Automated results and limitations are recorded in `PROGRESS.md`. Offline UI tests use DOM simulation and hand-authored responses, not a browser or Gemini. Database tests use actual disposable PostgreSQL, synthetic subjects and a mocked identity verifier/provider; they are not hosted Supabase tests. No live provider requests, sign-in emails, billing changes, hosted migration, deployment or new-work push occurred.

Pending manual checks:

- Two real browser profiles: create/invite/join, simultaneous sends, reload, disconnect/reconnect, duplicate retry, >50-message paging while reading older history, own deletion, organizer moderation, leave/removal/expiry/revocation and cross-group denial. Confirm sign-out/account-switch cleanup.
- Desktop and narrow phone: Chat/Plan/People, keyboard focus, accessible status, composer with software keyboard/safe areas, reader position/new messages, source links, approval guards and shortlist→ballot→vote change→final plan→RSVP.
- Reduced motion, hidden/offscreen pause and cleanup; record normal/quick success, failure, cancellation and repeated mascot requests. Check real Safari and phone performance.
- Separately authorize a bounded live synthetic Gemini test; verify structured native labels/quotes and provider data handling in the configured unpaid project. No latency/token/cost was measured here. Quota/configuration errors must stay recoverable and never return fixture output.
- Apply hosted migrations only with separate authorization and a privately checked target. All earlier hosted guest, account callback/save/isolation and real mobile checks remain pending.
