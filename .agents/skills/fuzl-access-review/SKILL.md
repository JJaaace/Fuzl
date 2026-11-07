---
name: fuzl-access-review
description: Review Fuzl Supabase authentication, Prisma persistence and saved-group/session access; also review sharing or guest-link boundaries when those features exist.
---

# Fuzl access review

## Workflow

- Read [account architecture and checks](../../../docs/ACCOUNTS.md), affected UI/API/database code and the relevant diff. Trace the real request from UI through server identity verification to every affected read/write and ownership filter.
- Check signed-out access, expired identities, cross-account IDs, sign-out/account-switch cleanup, stale writes and late responses as relevant. For guest links only when implemented, also check token scope, expiry, revocation and exposure of private fields; do not implement future sharing features as part of review.
- Verify saved summaries contain only intended fields and supporting excerpts, with review/unknown/source provenance preserved. Use synthetic records, controlled accounts or an owned disposable database within the requested scope, never unrelated user records.
- Use `npm test` for offline authorization/lifetime checks. For a relevant database change, inspect `npm run test:db` and prerequisites in ACCOUNTS before running its disposable database suite. Do not point a disposable test or reset at the hosted project. Hosted sign-in/email or record changes need task authorization; inspection alone does not imply it.
- Keep tokens, callback links, private excerpts and connection strings out of reports/logs. Distinguish mocks, real disposable PostgreSQL results and hosted-account observations. Fix confirmed access defects only within the requested scope and rerun the checks that cover them.

## Expected result

A concise map of affected caller/ownership boundaries, reproducible findings, verification by evidence type, and unverified access paths with controlled manual checks. Never mark real two-account isolation or hosted callback/save behavior passed from mocks alone.
