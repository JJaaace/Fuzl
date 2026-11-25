# Nashville friends beta

Public app: **https://fuzl-nashville.vercel.app**. Vercel Hobby serves the built React app and Express API together; Supabase provides Auth and PostgreSQL. No Mac/LAN process is needed. This is a beta, not a completed hosted acceptance claim.

## Verified so far

- Public homepage/API respond over HTTPS without a Vercel login. Hosted API connects to Supabase through its transaction pooler with certificate and hostname verification.
- All 11 reviewed migrations applied using Prisma `migrate deploy` over the verified direct connection. Existing organizer/group/session counts remained unchanged; app tables retain RLS and direct-role revocations.
- Google authorization's unique scopes are exactly `openid`, `email`, `profile`. The user completed real sign-in using an account absent from Google's test-user list and reported Saved groups stayed signed in after reload. This is user-observed hosted authentication, not a simulated browser login.
- Offline checks: 419 passed, 16 database-only skips; disposable PostgreSQL: 102 passed, including one-connection chat application, cross-instance quotas, idempotency, stale revisions and access boundaries. Type checking, lint and build passed.
- One hosted Gemini request succeeded: `gemini-3.5-flash-lite`, **3,681 ms**, **1,039 input / 1,343 output tokens**; cost unavailable. The receipt passed schema/source/attribution and fit validation. Database metadata confirms two account memberships and persisted messages from both identities. Application is still awaiting a committed receipt, independently of the user-visible preview.
- Official Playwright MCP / Chrome and WebKit exercised the hosted three samples, Conversation/Plan/Conversations navigation and sign-in rendering. No page exceptions or failed requests; 390px sample/sign-in viewports had no horizontal overflow. Sample replacement confirmation was separately observed. No email was sent. Viewports are not real phones.

## Two-person check

1. Sign in with Google. **Saved groups → Create group → Nashville beta check → Save group**.
2. **Conversations → New outing thread**: select that group; use **Nashville trip**, your display name, **Nashville, TN**, **America/Chicago**. Create it.
3. **People → Create 7-day chat invitation**. Copy privately into your existing chat. The friend opens it, signs in with Google, reviews history disclosure and explicitly joins with their account.
4. Send a synthetic message each. Reload both browsers and reopen the conversation through **Conversations**. The friend's shared conversation appears there; **Saved groups** remains their own organizer-only library.
5. The single authorized synthetic Gemini check is coordinated separately. Do not automatically repeat it. **Make a plan → Open proposed plan → Review proposed update → approve → Apply shared summary**. Applying shared facts is separate from publishing a confirmed/booked outing.
6. Both reopen the same conversation and its Plan panel on phones. Choosing a final plan and making a public RSVP page still uses the existing explicit shortlist/ballot/plan publication workflow.

## Operational boundaries

- Google redirects to `https://ioeqjkckyolrnqkleqli.supabase.co/auth/v1/callback`. Supabase returns to `https://fuzl-nashville.vercel.app/auth/callback`; the exact local callback remains allowed separately. No wildcard redirect is needed.
- Sign-in opens a separate tab. Destination metadata and an existing invitation credential are preserved; raw drafts/imports are never put in browser storage or automatically saved. First sign-in preserves the original tab; sign-out/account switches clear its private state.
- Native messages persist. Reads/writes/polling verify current membership; retries reuse submission IDs. Hosted polling replaces a persistent stream. Public/guest pages keep existing credential scopes.
- Hosted Gemini planning requires a verified account plus AI-enabled thread membership. Database-backed limits are **3/minute/account**, **20/24 hours/account**, **2 concurrent generations globally**, with 60-second leases. Usage survives thread deletion and expires from the ledger after 24 hours on a later request. No automatic AI retry or paid fallback. Local pasted-import AI endpoints stay restricted; the hosted composer points to Conversations.
- The explicit approval controls now precede the long review details and receive focus when opened; the persisted shared revision is visible to both roles. A local 390px fixture check moved the approval from y≈2,981 to y≈397; this test made no provider request.
- Eligible shared messages go to Gemini; private saved-session answers, raw imports and organizer notes do not. Unpaid Google content may be used for improvement/human review. Source checks, unreviewed labels, explicit application and stale protection remain enforced. Operational logs contain only request references and usage metrics, not messages or credentials.
- Destination and time zone are organizer-selected, never inferred from device position. Activity ideas and map **search** links are labelled as such; no venue, price, opening time, drive time or booking is invented. Venue/event search remains a separate deliberate action.
- Runtime keys, database URL and CA contents are privately configured in Vercel. `apps/api/.env`, local certificates, `.env.local`, artifacts and generated output are excluded from deployment uploads and Git. No billing upgrade, domain purchase or automatic Git deployment was enabled.

## Still pending

Explicit hosted shared-plan application/reopening, hosted non-member account isolation, sign-out on both controlled accounts, and the full flow on real phones/Safari. Do not infer these from disposable SQL or offline fixtures. Current live Gemini verification count: **1**, successful; no further live request authorized or made. Update this record with actual observations before calling the beta complete.

Official references: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Google identity-scope testing exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [Supabase serverless pooling](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Checkpoint before Conversations redesign

The next authorized pass will investigate the reported false conflict between per-person USD maximum budgets of $25 and $20, raw `Member_…` identifiers in generated text, extraction versus actual outing proposals, and the cramped conversation/review layout. These are open issues at this checkpoint, not verified fixes. No redesign changes have been made yet. The shared-plan application status above records the last verified database observation; it is not a fresh assertion about later organizer actions.
