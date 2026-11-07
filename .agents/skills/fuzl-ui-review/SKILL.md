---
name: fuzl-ui-review
description: Inspect and improve Fuzl's real layout, colors, logo, animation, accessibility or workspace flow while preserving the existing planning and save behavior.
---

# Fuzl UI review

## Workflow

- Read the current request, Git diff/relevant design commit, [design notes](../../../docs/DESIGN.md), and applicable repository instructions. Stay within the authorized design scope; do not add later milestone features.
- Open the real local app, normally http://127.0.0.1:5173, using available browser tooling and its instructions. Start `npm run dev` only if needed. Inspect the empty workspace, paste/upload controls and **Try an example → Load sample**. Sample loading requires no AI call or sign-in email.
- For motion work, watch the field and logo running on desktop, then inspect a narrow viewport and reduced motion. Check the obvious next action, text/controls, keyboard focus and jumps/resets while typing, scrolling and switching panels. Use `/?design=logos` and **Replay Light the fuse** for logo-size/motion comparisons.
- Preserve drafts/unapplied edits, explicit Analyze/Read actions, visible provider disclosures, AI review labels, acceptance/stale/replacement controls, source links and saved-session behavior. Use built-in synthetic samples and existing mocks; no live AI request or email is implied by visual review.
- Give findings tied to a screen or interaction. Fix demonstrated issues within scope and run the relevant existing checks: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` as applicable. `node scripts/preview-logos.mjs` and `node scripts/preview-dot-field.mjs` provide static vector/geometry proofs, not app-motion verification.
- If browser access is unavailable, continue source/offline checks, explicitly mark the unavailable visual/motion observations, and give exact local replay steps. Keep hosted account checks separately unverified unless actually observed.

## Expected result

A short evidence-based UI review, scoped fixes where confirmed, actual verification results and replay/manual steps. Do not claim layout/motion quality from source, DOM simulations or static proofs alone. Leave changes local unless the current task authorizes a checkpoint or external action.
