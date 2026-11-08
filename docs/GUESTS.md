# Section 6 — account-free guest answers

Section 6 collects answers for saved planning sessions. It does not recommend places, vote, confirm attendance, share a final plan, send messages or perform feasibility checks. The organizer distributes the prepared invite. No AI request or sign-in email is needed by a guest.

## Working flow

1. Open an owned saved session. Temporary summaries say **Save this session to create a link**. Saving/sign-in remain the existing Section 5 flow; its real hosted callback/save acceptance is still pending.
2. Choose **Ask the group**. Write a title guests may see and up to five questions. You can explicitly copy a missing question into this draft, but must review/edit the wording: missing questions may contain names or private details. Nothing from the summary or its sources is automatically published. Choose short answer, availability or spending limit, optional/required, and 1/7/14-day expiry.
3. **Preview guest form**, then explicitly approve the title and every question. The preview reuses the guest disclosure and input components. Changing wording/type/title/expiry invalidates that approval. **Create guest link** returns its secret once; **Copy link** is an explicit clipboard action, with a selectable-field fallback. Paste it into your existing chat yourself.
4. Guests open `/guest#invite=…`, see only the approved title/questions and answer visibility, and provide a display alias. Availability stays as written (including “maybe Friday”), with no invented exact dates. Optional blanks, explicit unknowns and known budgets of zero stay distinct. Currency can independently remain unknown.
5. **Send response** shows **Response sent**; **Save response changes** edits that same response. A failed request retains the entered values and offers deliberate retry. **Reload sent response** confirms before replacing unsent entries and recovers from an uncertain/stale update. No automatic retry runs.
6. In the owner's **Responses**, manually refresh. Aliases are labels, not verified identities. Explicitly match a reply to a participant, then apply a shareable answer as a new proposed fact, optionally resolve a missing question, or resolve only that question. Review the local result, then **Save session** explicitly. No incoming reply silently edits the summary.

If an invite already exists, replacement requires confirmation. Creating/replacing a link checks the saved session revision. One nullable unique active-session key and a session-row lock enforce one active invite even during concurrent creation. Copying the secret works only while it is present in this workspace; reopening cannot recover a digest. An existing distributed link remains usable, or the organizer can explicitly replace it to obtain a new one.

## Privacy and permission boundaries

| Credential or data | Access and storage |
| --- | --- |
| Organizer Supabase bearer | Existing remote `getUser` verification and group ownership scope protect every invite/list/revoke operation. Client-supplied owner IDs are not accepted |
| Shared invite | 32 random bytes (256 bits), base64url. DB stores only SHA-256 digest. Opens/submits to exactly one session; never grants access to another respondent's answer |
| Per-response editing permission | A separate 32-byte credential, generated before first POST and persisted before transmission. DB stores its digest with the unique invite/submission ID. The server also rejects using the shared invite itself as an editing credential. Read/update requires this credential **and** the matching still-active invite; a response ID or matching alias cannot authorize it |
| Guest browser storage | The invite fragment is removed from history synchronously before React/network work; sessionStorage keeps this tab's invite for reload. localStorage stores only the per-invite edit credential and submission ID, keyed by the invite's digest. Typed answer drafts are not stored. Same browser/profile can restore a successfully sent response; another profile cannot. Clearing storage loses editing permission; incognito storage ends with that private session |
| Guest form DTO | Explicit title/questions/expiry allowlist. No organizer summary, imported chat, image, supporting excerpt, group identity or other guests' answers |
| Private spending answer | Default privacy choice. Amount/currency/state live in a separate private-answer table. The respondent can recover their own values. Owner response DTOs return only a private-answer marker, with no amount, currency or unknown/known distinction. Defensive output validation also redacts a private value if it were accidentally placed in the response JSON |
| Shared spending answer | Only after the guest explicitly chooses **Share this amount with the organizer**. It can be reviewed/applied like another shareable answer. Changing it to private later cannot erase an amount already shared or accepted into a summary |

Anyone holding a shared invite may submit a new response, including using someone else's display name; names are deliberately not authentication. Anyone using a browser profile with its edit permission could edit that response. This is not complete anonymity or strong person verification. Backend/database administrators can access retained data; the UI's private-budget rule is not a claim of end-to-end encryption.

No portable edit link is generated. Do not share browser credentials. No guest cookie/session-account is created, and public requests omit cookies. The guest page renders outside AccountProvider, so it neither restores organizer credentials nor asks for account/AI configuration. Existing organizer sign-out/account-switch cleanup remains independent.

## Expiry, revocation and deletion

- Reading/previewing an invite never claims an identity, submits, consumes or revokes anything.
- Every guest form/read/write checks invite expiry/revocation/session existence on the server. Guest writes lock and recheck the invite, so replacement/revocation cannot race past a submission/edit authorization decision.
- Expiry, revocation or replacement stops **both** submissions and existing response-edit/read access. The owner can still review collected responses. A replacement uses a new invite row/secret; old edit credentials do not work with it.
- Existing owner-accepted summary facts/excerpts remain after revocation/expiry. This does not retract previously disclosed information. Respondent edits create a new response revision; previously accepted source snapshots stay unchanged and are flagged when a newer response is loaded.
- Deleting a session cascades to all its invites, responses and private-answer rows. Deleting the group cascades through its sessions. Old links/edit credentials then find nothing. Deliberate copies of shareable data in another saved session are separate owner records; provider backups have their own retention, as described in ACCOUNTS.
- Unused/expired browser credentials are not answers and may remain in browser storage until cleared; the server no longer honors them. There is no erasure/expiry cleanup promise for those local credentials or provider backups.

## Reconciliation and concurrency

`applyGuestAnswer` changes only the chosen answer/question in the latest eligible workspace. It retains original imported quotations and unrelated edits. A replacement of a tentative AI interpretation creates a new guest-sourced proposed fact and marks the selected original AI claim historical; its supporting quotation remains. Both stay inspectable. There is no automatic participant matching or automatic confirmation of availability/attendance. Applying the same answer version twice is rejected; an already resolved question cannot be overwritten through an old selection. Answers from the same matched alias reuse their guest speaker mapping.

A guest origin records response/question IDs, revision, alias, explicit participant match, timestamp and the original shareable excerpt. Question-only resolutions keep that original excerpt separately from editable resolution wording. Historical values do not turn into permanent group preferences. Private/blank answers cannot be applied through the UI or saved with forged guest provenance.

Before Apply, the organizer fetches the latest reply revision and checks that no workspace edits occurred while waiting. Open fact/question editors must be applied/cancelled first. Fresh guest origins are checked again at explicit Save; if the response changed after local Apply, Save rejects with a recoverable conflict. Existing accepted snapshots can remain unchanged while later replies are reviewed. Ordinary saved-session CAS revisions still protect parallel organizer saves; receiving a guest reply does not increment or overwrite the planning summary. Copies with newly introduced live guest references also require current reply versions; review stale replies before copying them.

## Code and request flow

- `packages/planning/src/guests.ts`: strict question/answer contracts, null/zero/blank distinctions and local reconciliation. Guest provenance is an optional **saved-summary** extension. Provider extraction schemas remain strict and unchanged.
- `apps/api/src/guests/router.ts`: bounded public APIs and authenticated organizer subrouter, sanitized errors and no-store headers. Organizer routes live under `/api/private/sessions/:sessionId/guest`; the existing private router verifies identity first.
- `apps/api/src/guests/store.ts`: owned-session queries, digest credentials, lock/idempotency behavior, private/shared splitting and output redaction. No raw token, answer or database exception is logged.
- `apps/web/src/guests/OrganizerGuests.tsx`: approval/preview/copy/revoke and manual response reconciliation. `GuestPage.tsx`/`AnswerFields.tsx` implement the focused phone form. The guest form reuses the field at 12% opacity behind its reading area, with the existing hidden-tab/offscreen pause and static reduced-motion behavior; it retains warm styling, a static header and visible focus. Actual phone composition remains unverified.
- `apps/web/src/guests/api.ts` and `main.tsx`: early fragment cleanup, browser edit permissions, bounded fetches and guest routing separate from organizer callback/auth.

Public endpoints are `GET /api/guest/form`, `POST /api/guest/responses`, and `GET`/`PUT /api/guest/response`. The form/create use the invite in Authorization; response read/edit use the edit credential there plus `X-Invite-Token`. Tokens are never query/path parameters in API requests. Guest API responses use no-store; guest requests and HTML use no-referrer. The generic HTML shell contains no private response data. No analytics or request-body logging was added.

Limits: five questions, 180 characters each; 100-character approved title; 80-character alias; 800-character short/availability answer; 16KiB public bodies; budget 0–1,000,000 with at most two decimals and optional three-letter currency; 200 responses total per session (across replaced invites, so every retained reply can be reviewed). Per-process public limits are 60 reads / 12 writes per IP per minute, with bounded expiring counters and no trusted proxy headers. They are development safeguards, not a distributed anti-abuse service. No automatic retries, identity-by-name lookup or paid provider fallback exists.

Submission ID + invite is unique. A lost first response can be retried with the same locally retained edit credential and submission ID, returning the existing row instead of creating another. Concurrent edits use response revisions; a lost update acknowledgement may need **Reload sent response** before trying another edit.

## Migration and actual verification

`202611070001_guest_responses` adds only three owned-schema tables and their indexes/FKs, enables RLS and revokes public/anon/authenticated grants. It does not reset existing tables/data. No new package/runtime dependency or credential was added.

**The migration was applied and reapplied only on an owned disposable local PostgreSQL cluster. It has not been applied to the configured hosted project.** After reviewing this change, apply it to your intended development database with `npm run db:migrate`, then run `npm run dev`. That command changes the configured database; keep DATABASE_URL/DIRECT_URL and certificate settings private and choose the intended Free project. No reset command is needed. The existing guest tables must exist before creating real links.

| Evidence | Actual result |
| --- | --- |
| Offline suite | 168 passed, two intentional real-DB-suite skips. Synthetic React guest send/reload/edit and failure/retry, owner approval/stale apply, contract validation, defensive redaction, public safe errors/limits and existing Section 1–5 behavior |
| `npm run test:db` | 16 passed, including the existing nine database checks and seven Section 6 parent/subtest results. Actual migrated PostgreSQL + HTTP owner-create → guest-submit/edit → owner-apply/save; private zero/unknown/blank, same-alias isolation, wrong-session credentials, cross-account IDs, concurrent duplicate sends, stale edits/saves, question-only resolution, explicit replacement/revoke/expiry, RLS/grants and session/group cascades |
| Types/lint/build | Passed; frontend/backend/shared checks. Build and runtime smoke are recorded in PROGRESS |
| Browser | No connected browser. Separate owner/guest profiles, actual narrow-phone usability/focus, visual timing, clipboard and hosted account flow remain unverified |

Backend identity verification is stubbed with two controlled UUIDs in disposable integration tests; real PostgreSQL queries, migrations and HTTP routes are exercised. This is not a claim of live Supabase callback or real two-account hosted verification. No AI call, sign-in email, billing change, push or deployment was performed.

Security mechanics use the installed Node 24 crypto and Prisma 7 APIs, without upgrading them. Primary references: [Node random bytes](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandombytessize-callback), [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS). An invite secret cannot be reconstructed from its stored digest.

## Short local manual check (pending)

After migration and existing organizer sign-in are ready:

1. Owner profile: **Try an example → Load sample**, edit/apply a fact, save under an owned group, then **Ask the group**. Choose a harmless title plus availability and budget questions. Preview, approve, create, copy. Confirm the title/fields contain no imported chat/quotes.
2. Separate browser profile/private window on the **same computer**: paste the complete local invite. No guest account is needed. Enter a synthetic alias, “Maybe Friday after 7,” and private amount **0**, leaving currency unknown. Send, reload and edit. The same profile should restore only that reply. Do not close an incognito window if you want its edit permission to persist.
3. Owner: Refresh responses. See the alias/availability and only the private-budget marker. Explicitly match the participant and apply availability, then Save session and reopen. Confirm proposed status, unknown exact date, guest origin and original imported excerpts. Optionally make the budget shared from the guest profile; owner sees it only after that explicit choice.
4. While editing the owner summary, send a guest change and refresh: local summary edits must remain. Apply a reply, change it again as guest, then Save: expect a conflict preserving local work. In two owner tabs verify ordinary stale-summary Save rejection too. Decline replacement/revocation once before testing it.
5. Revoke or replace: old guest page read/edit/send must fail; collected replies stay owner-visible. Delete the session/group: its invite/replies/edit access must be gone. Another controlled organizer must not read/manage its IDs. Keep these hosted checks pending until observed.
6. At 360×800 / 320px and desktop: inspect labels, focus, amount zero versus unknown/blank, long names/questions, retained input after failure, clipboard fallback, and lack of horizontal scrolling. Use keyboard-only traversal; an error should receive focus without clearing answers. Hosted account acceptance remains separate.

A `127.0.0.1` link works only on the machine serving Fuzl; on a friend's phone it points at that phone. For another device, the same frontend and `/api` must be reachable at an intended **HTTPS** origin (with SPA fallback for `/guest`), and backend `APP_ORIGIN` must match it exactly. Create the invite from that frontend so its copied origin is correct. Web Crypto/edit-permission storage requires localhost or a secure context; simply rebinding Vite to a LAN HTTP address is insufficient. A trusted HTTPS development reverse proxy/tunnel or a separately reviewed secure deployment can provide that address. Keep API/database secrets server-side, configure any owner Auth callback separately, and apply appropriate external request limits. No network exposure, tunnel, deployment, SMTP or billing setup was enabled by this milestone.
