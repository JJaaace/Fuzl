# Sparks, People cards and sign-in polish

November 21, 2026. Local work above pushed **9297989**, preserving the earlier uncommitted compact Plan pass. No commit/push, deployment, migration, dependency or private environment changes. The earlier baseline is retained in ignored local artifacts for comparison.

## Planning facts without per-card approval

The existing explicit **Use extracted summary** replacement/acceptance flow remains. Once accepted into the working session, current, attributed, source-linked extraction facts can guide a proposal automatically. No requirement to open People cards or mark every fact reviewed.

The new **proposalWindow** reads only explicit exact-date and clock fields. It never interprets “Friday” as a calendar date or “7” as evening. A coherent source-reported window can guide a proposed outing while attendance remains tentative/missing. It is labelled **proposed window · attendance still needs checking**. Different dates or non-overlapping windows require clarification; Friday still leads with the missing date. No missing budget becomes zero.

This is separate from **commonWindow** and the existing fit checks: unreviewed or tentative evidence cannot become a verified fit. Current source-linked activity ideas are eligible without per-card review; historical, unsupported or unmapped ideas are not. A source-reported confirmed firm budget can conservatively exclude an over-budget candidate without falsely labelling that claim reviewed. Known private limits and saved attendee/context/revision checks remain server-side. No provider contract or extraction/source validation was weakened.

**Plan with these facts** opens Planning tools and its disclosure; it does not send a request. Suggest a plan remains a deliberate action with the same Gemini adapter, ID-only output, privacy allowlist, request bounds and stale-response protection. No new Gemini call ran. The prior real Saturday success is recorded separately in [PLAN_POLISH.md](PLAN_POLISH.md).

## Continuous sparks

The existing single decorative canvas covers the viewport from its top edge on both hero and Plan. A stable, softer subset scatters across the header; brighter points concentrate around the margins. Hero and Plan share the actual logo’s ember and gold accents with mostly soft-white points. The opaque sandstone gallery remains visually separate.

The particle seed and elapsed clock persist while typing, scrolling, opening details or switching stages. Shape changes blend rather than remount; resizing uses a continuous target population and eases density changes over subsequent frames. Phones/touch use fewer points and a lower frame rate; pixel density remains capped. Hidden, inactive and offscreen rendering pauses. Reduced motion paints a static field. No per-frame React state or hundreds of animated DOM nodes.

## Uniform People cards

Collapsed cards have a shared flex structure and sizing, grid stretch, a tinted header, fine accent line, useful values/icons, and a bottom-aligned details control. Short cards such as Alex’s share their row’s top/bottom edges. All-collapsed grids share row sizing; explicitly opening details allows content to expand without clipping.

Desktop arrangements: one centered card, two columns for two/four people, three columns for three/five/six/larger groups. Incomplete final rows stay centered with the same widths. Tablets use two columns when needed; narrow phones stack. Names and quotes wrap, and native details preserve the complete facts/sources. Overflow firm details remain signposted at the details control.

Avatar/header/edge colors derive from participant ID, never the name or array index. Reordering or correcting names keeps the same accent. Entrance stagger is capped, hover/focus uses that accent, and applied-row feedback lasts 1.2 seconds with focus preserved. Reduced motion keeps color/border feedback. No new participant/fact copies or guest data exposure.

The development fixture now supports **1, 2, 3, 4, 5, 6, 12 and 20** people, with long-name and larger-text controls. Twenty remains within the existing 60-fact cap; its final participant intentionally has no recorded travel limit.

## Distinct sign-in, unchanged authentication

The former nested sign-in component is now **accounts/SignIn.tsx**, with a testable presentation seam and the same **requestMagicLink** call. Desktop uses an original sandstone/dusk SVG landscape beside the form. A winding path leads to a small warm destination light, with restrained fuse sparks, slow depth and travelling-light motion. The existing scenery lifecycle pauses it when hidden/offscreen and supplies static reduced motion. Phones use a short illustrated header so the form remains near the top.

The heading is **Your next plan starts here.** The form says **Sign in to save plans and return to your groups.** Email has a visible label, autocomplete, input mode, native validation and full-width submit. Sending locks duplicate submissions, sent explains opening the email in a new tab and returning without reload, **Edit email** restores the value/focus without resending, and failure allows an explicit retry. Development delivery is a compact setup disclosure. Account-switch guidance appears on reauthentication.

Callback capture/credential cleanup, the fixed redirect, SDK identity/session expiry, account-switch isolation, logout cleanup, backend ownership, intended navigation and original-tab workspace protections are unchanged. Link-request success is never presented as signed-in identity. No raw errors, links or tokens were added to logs. No SMTP, billing, Auth configuration or real email action.

## Verification

- **369 tests passed, 13 intentional database skips, 382 total, zero failures.** Covers fixture schema/content for every roster size above, stable accents under reordering, native details/evidence, edit/focus feedback, accepted extraction use without card approval, source-reported budget failures, Friday/date ambiguity, stale responses and saved context. New sign-in tests use mocked sends for validation, loading, duplicate protection, sent/edit-email, failures/retries, configuration reload and late responses. Existing SDK/callback/session/privacy tests remain in the suite.
- Type checking, lint and production builds pass; existing Vite large-chunk advisory remains. No database migration/reset was needed.
- **No new live Gemini request, real sign-in email or live authentication verification was initiated.** Sign-in state previews are explicitly synthetic. Previous real Gemini results are historical evidence, not a new quality measurement.
- Browser selection returned **No browser is available**, discovery **[]**. No rendered desktop/tablet/phone, actual Safari, physical-device observation, screenshot or motion clip was captured. DOM/content tests, grid metadata and canvas lifecycle/geometry are not measured visual alignment or motion acceptance.
- Prior hosted callback/account/save/reopen/two-account/guest/ballot/shared-plan/migration checks remain pending.

## Exact local review

1. **http://127.0.0.1:5173/** → **Try a sample plan → Friday, maybe**. Check the compact result and date action, matching card edges and bottom details controls, header/margin sparks, questions/tools/source disclosures and a card edit. Repeat Saturday and the indoor/outdoor conflict. Sample loading makes no AI request.
2. **http://127.0.0.1:5173/?design=people** → select **1, 2, 3, 4, 5, 6, 12, 20 people**. Toggle **Long names** and **Larger text**. Confirm 4 is 2×2, 6 is 3×2, and 5/other partial rows center without wider cards. Open details; no names, facts or quotes should clip.
3. **http://127.0.0.1:5173/?design=signin** is explicitly **mock-only**. Submit the prefilled synthetic address in **Success**, then use **Edit email**. Select **Sending** and submit to hold that state; **Error** tests a failed send/retry; **Not configured/Loading** test configuration states. It sends no email and creates no session.
4. The real form is **Saved groups / Sign in**. Inspect without submitting. Any later real sign-in should use the configured organization-member email and the existing controlled checklist in [ACCOUNTS.md](ACCOUNTS.md); its hosted acceptance remains unverified.
5. Same-Wi-Fi preview: **http://192.168.12.248:5174/**, with the same fixture query paths. Real AI and magic-link requests retain the canonical Mac-origin requirements. Refresh discards unsaved planning memory.
6. Render at **1440×900**, **1024×768**, **768×1024**, **390×844** and 320px, plus browser text zoom. Check the field at top/middle/bottom and while expanding sections; cards at all sizes; keyboard details/edit/retry focus; reduced motion; tab hide/restore and scrolling both ways. These rendered/device checks and a short sparks/edit/sign-in motion recording remain pending.
