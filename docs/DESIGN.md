# Local design review

November 7, 2026. This is a visual and usability milestone between Sections 5 and 6, based on checkpoint `77b5638`. The initial design checkpoint was pushed as `083d78b`; the current ripple/crescent refinement is included in the requested follow-up checkpoint. Local preview remains available; there is no deployment. Section 6 has not started. No provider request, sign-in email, billing change, migration or deployment was made for this milestone.

## Direction and navigation

Warm charcoal surfaces, ivory text, muted amber selected controls and bright amber primary actions/fuse sparks use shared CSS tokens and the system font. No external font or animation library is loaded. The headline is “Turn your group chat into a plan.” with one supporting line. The composer is higher on the page, starts with an honest empty placeholder, has a subtle focused edge and a bright filled Analyze button when enabled. **Try an example** sits beside the composer. The disclosure names the configured provider before submission; expanded privacy details do not replace that visible disclosure.

The empty workspace shows the paste/upload switch without an idle stepper. Navigation appears when a transcript, preview or summary makes returning useful. Pasted conversations have Conversation and Understanding; screenshot journeys also have Transcript. Switching modes retains the draft, image selection and in-progress editors.

Summary previews and accepted summaries lead with three cards: availability, per-person budgets and open questions. Their content comes from existing facts, with null budgets and ambiguous dates preserved. Participants, planning facts and sources expand separately. AI review state remains separate from fact status. AI previews require **Use extracted summary** before entering the editor; samples say **Sample summary** and **Manually authored sample data** and never call a provider.

Screenshot reading remains a separate deliberate request. Thumbnails show order; transcript rows show wording, aliases and uncertainty, with **Edit message** opening the fields. **Source & original** preserves the original reading and reference. **Use reviewed transcript as draft** returns to Conversation without automatically analyzing it. Supporting screenshot links reveal the image stage and focus the relevant thumbnail.

**Development & details** contains health checks and the design-preview link. Saved groups, sign-in, save/reopen, conflict recovery and sign-out remain the established workflows. Raw imports remain temporary; saving is explicit.

## State and protections

`planning/navigation.ts` tracks only visible stage, input mode and availability of transcript/preview stages. Existing planning, screenshot, account and save state still belong to their original components. Hidden panels remain mounted, including unapplied fact/question editors. Distinct `screenshots-`, `analysis-` and `summary-` key prefixes prevent React sibling-key collisions; summary replacements reset only the intended editor. Stage switches do not reset it.

Loading a sample uses the existing replacement confirmation, extended to protect a nonempty draft or selected images as well as summary edits. A late result never replaces newer work. The submitted source revision is compared with the latest draft/reference/provider before activating a preview; stale results show a warning immediately without taking focus away from the editor. Explicit acceptance independently checks the source again. Cancel/error clears the waiting cue and retains the draft and accepted summary. There are no automatic retries or substitute sample responses.

The example disclosure supports Escape and restores focus to its trigger. Loading/accepting a summary focuses its heading. Asynchronous transcript/preview focus runs after the new panel renders; a focused regression check caught and corrected an earlier handoff that ran too soon. A current asynchronous preview focuses its heading only when focus remains at submission or the document body; it does not interrupt another active control. Native buttons, disclosures, labeled fields, focus outlines and live status regions remain keyboard accessible. These interactions have DOM tests, but real browser focus/scroll and assistive-technology behavior still need inspection.

## Mascot and motion

**Spark** is selected provisionally. Its rounded body has an angled fuse attachment; three dots grow toward the body. Resting fuse colors are ember orange `#FF944D`, golden yellow `#FFD36A`, then warm ivory toward the body. The espresso mouth is a custom closed, filled crescent: wide and low, symmetrical, thickest at the bottom center, with two gently rounded, upward-sweeping tapered tips. It contains no stars or stroke. The supplied moon image was not accessible in this turn; the shape follows the described silhouette. **Arc** explores a fuse curving in from the right. Both are shown at 16, 24 and 40 pixels, in color and monochrome on light/dark backgrounds. The original three explorations remain archived in the preview.

Open <http://127.0.0.1:5173/?design=logos> in development. It includes the actual 40px header, static 16/24px favicons, both variants and **Replay Light the fuse**. The production workspace does not expose this preview. `src/ui/brand.ts` selects the provisional mark and shares geometry between inline and exported SVGs.

**Light the fuse** is an 800ms CSS/SVG sequence: a soft brightness pulse passes far → middle → near while their resting hues stay fixed, then the body lifts slightly and the smile opens briefly before settling. It plays once when the workspace mounts. Hovering deliberately over the header mark for 140ms replays it; typing, editing and changing stages leave the header steady. The standalone asset is `/brand/light-the-fuse.svg`. The favicon is always static.

Actual analysis and screenshot requests use the same three-dot sequence, without bouncing the header. It stops when the request finishes, fails or is cancelled. Loading reflects waiting, never a percentage or invented provider progress. Summary cards reveal over 220ms with 55ms offsets and settle within 340ms; edits do not replay them. Prepared samples use this same reveal. The canvas field below supplies the ambient motion, dimmed behind summary reading. Hidden-page motion pauses. Reduced-motion preferences disable animation/transitions and show readable results immediately.

Regenerate assets/proofs from the repository root:

```sh
node scripts/make-brand-assets.mjs
node scripts/preview-logos.mjs
```

The latter uses existing Sharp and writes ignored `artifacts/design/mascot-proof.png` and `header-favicon-proof.png`. These are actual SVG raster proofs, not application screenshots. Spark's small-size smile and attachment were inspected in those proofs. The ivory-on-light color version has little contrast; the app uses the dark version and monochrome is available for light backgrounds.

## Warm palette and canvas field

Shared tokens start with canvas `#121212`, cards `#1C1B19`, ivory `#F5F0E7`, secondary text `#B4ADA1`, primary/lit spark `#FFBE69` and filled-button text/smile `#24170B`. Links and selected controls use a quieter amber `#DFB982` with `#332A1D` selected surfaces. Warm focus outlines replace lavender. Red error surfaces/text are separate from yellow warning surfaces; labels remain explicit. The body/fuse assets share the warm palette and geometry, and the static favicon contains no animation.

`ui/DotField.tsx` owns one decorative, pointer-transparent canvas. `fieldGeometry.ts` creates 760 deterministic oval points, with a quieter center and a minority of crisp bright points. Phone canvases use a stable 240-point subset. `dotFieldCanvas.ts` keeps positions and elapsed time through typing, input-mode switches and summary editing. Subtle independent breathing remains beneath a shared 13-second diagonal ripple from top-left to bottom-right. Spatial phase gives neighboring dots the same rise/settle timing; lift reaches 5px, with a 1px crossing echo on a 19-second period. A smooth radial falloff keeps the center quiet. Warmth and slight brightening follow the crest. There is no timer reset or synchronized blinking at a cycle boundary.

The controller caps backing density at 1.5× and painting at 30fps (24fps on phones), uses requestAnimationFrame, and pauses while offscreen, in a hidden tab or outside Workspace. ResizeObserver updates the canvas only when its size/density changes; IntersectionObserver gates visibility. Resume resets the frame timestamp, preserving accumulated animation time without catching up across a pause. Reduced motion draws a static phase with no frame loop and reacts to preference changes. Cleanup removes every observer/listener/frame. The field dims to 23% opacity behind summary/transcript stages, while opaque editor surfaces keep reading areas quiet.

Inspection of the existing animation code found overlapping summary/panel/card entrances and changing loading icon space. Generic surface and details entrances were removed, leaving the short stagger on new summary cards. The reveal timer now completes even if you briefly leave the stage; editing or returning does not restart it. Analyze reserves the same icon/arrow slots and minimum width while waiting; its waiting state uses a dark amber surface so the lit dot remains visible. Header ignition transforms only SVG internals; the wordmark anchor never moves. These code/lifecycle checks are not a substitute for observing actual Safari timing.

`node scripts/preview-dot-field.mjs` writes ignored desktop/phone geometry proofs and a second wave phase, using the same point/color calculation as the canvas. These and the SVG mascot proofs were rasterized and inspected. They are not screenshots or a recording of the app. The referenced Google screenshot was not available as an image in the accessible attachment; density/distribution follows the requested warped-oval description rather than a claimed pixel match.

## Verification actually completed

| Check | Result |
| --- | --- |
| Baseline | Clean `77b5638`; existing 141 tests passed, one intentional DB-suite skip; type checking passed |
| `npm test` | **160 passed, one intentional DB-suite skip**; no live provider/account requests |
| New interaction coverage | 14 isolated navigation/DOM tests: empty input/count, sample-only reveal, Escape/heading focus, 800ms one-shot/hover/reduced-motion state, mode/stage/group navigation preserving exact draft/editor nodes, declined replacement, explicit AI acceptance/unreviewed labels, stale results in both modes, cancellation/error stopping dots, and compact corrected transcript retention |
| Field motion coverage | Five offline tests: deterministic desktop/mobile positions and quiet center; smooth bounded elapsed-time phases and spatially coherent diagonal motion; density/rate limits, visibility/active pause and cleanup; reduced-motion static rendering/live preference changes |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed; zero lint warnings |
| HTTP smoke | Workspace, development logo preview, static favicon, animated SVG and proxied health return 200 |
| Static contrast calculation | Warm white on canvas 16.50:1; muted on surface 7.73:1; placeholder on surface 5.60:1; primary button 10.66:1; muted accent on selected surface 7.65:1. These token calculations do not establish whole-page accessibility |
| SVG inspection | Both refined variants rasterized and inspected at 16/24/40, color/monochrome/light/dark; header/favicon proof inspected |
| Browser / screenshots | **Unverified.** In-app browser discovery returned no browser; no desktop or phone app render/capture or visual timing verification was performed. DOM simulation does not perform layout or CSS animation |
| Hosted Section 5 workflows | **Still unverified.** Prior database/migration and automated checks stand; reported email delivery is not callback/account acceptance |

The small Happy DOM registrator is a development-only dependency for interaction tests. It disables resource loading and script evaluation, and every request is mocked. The runtime dependencies, backend behavior, provider validation/configuration, database schema and auth architecture are unchanged. The real disposable PostgreSQL suite was not rerun for this frontend milestone; its prior nine passing checks are recorded in PROGRESS.

## Exact local review, with no AI request or email

If needed, run `npm run dev` from the root, then open <http://127.0.0.1:5173>. The existing dev servers were reachable during verification.

1. In Safari (if installed) or your browser, at **1366×768** or **1280×800**, open a fresh empty workspace. Capture it. Confirm the exact headline, one support line, empty placeholder/zero count, paste/upload switch and no idle step navigation. Check that the composer and Analyze action are easy to find without scrolling; this placement is not visually verified yet.
2. Before typing, watch the field for **5–15 seconds**: nearby points should lift together as a broad diagonal ripple passes, brighten a little, then settle. A weaker crossing wave adds depth. Type `Sam: Maybe Friday. My budget is unknown.` Capture the active input. Check its focused edge, visible provider disclosure and filled enabled Analyze button. **Do not press Analyze** for this design review. Switch to Upload screenshots and back; the exact text and field pattern should remain, with dots still visible at the edges. Select a synthetic image from `fixtures/screenshots`, switch back and forth, and check the image remains too. Selecting images does not read them.
3. Open **Try an example**, select **Missing & tentative details**, choose **Load sample**, and cancel replacement once. Verify the draft remains. Repeat and confirm: focus should move to **Sample summary**, and Availability/Budgets/Open questions should reveal in a short stagger and stop. Capture this summary. The background should dim, the summary should settle once, and editing should not restart it. Check “Friday” has no invented date, tentative wording remains, and unknown budgets are not zero. Use Conversation → Try an example to try the other two existing fixtures and their correction/conflict sources. These actions make no provider requests.
4. Expand **Participants & speaker mappings**, rename someone, then expand **Planning facts → Edit fact** and type an unapplied change. Collapse/reopen details, switch stages and visit Saved groups → Workspace. Verify the same unapplied form is retained. Decline replacement of that summary once. Do not submit the sign-in form or send an email.
5. Using only the keyboard, Tab through navigation, mode buttons, composer and Try an example. Open it with Enter, move into its selector, then Escape: focus should return to the trigger. Load a sample and verify its focused heading, then continue to names/questions/facts/sources. Check visible focus and no unexpected jumps.
6. Open the design preview in a separate tab. Inspect both marks at 16/24/40, header and favicon sizes. Press **Replay Light the fuse**: far → middle → near, small lift/slightly opening filled crescent, then rest within a second. Back in the workspace, reload once with no unsaved work: the header plays once, stays still during reading/editing, and replays after a deliberate hover over the glyph. Moving past it briefly should not trigger a replay.
7. Switch to another tab for ten seconds and return, then scroll until the entire field is offscreen and return. It should resume without a jump or reset. Enable your operating system's Reduce Motion setting, or browser developer tools' `prefers-reduced-motion: reduce` emulation. Reload the empty workspace, replay the preview, and load a sample. The field and marks should be static, with results immediately readable. The field must remain visible rather than disappear. Restore your preference afterwards.
8. Repeat steps 1–5 at **360×800** and **320px wide**. Capture empty, active and sample-summary states. Check page-level horizontal scrolling, long participant names, expanded fields/sources, touch targets, account controls, and that warnings stay readable. Real viewport/layout screenshots and Safari motion remain pending until these steps are observed. Safari is installed locally but no controllable browser is connected; no recording or rendered app inspection was possible.

Real waiting/error/cancel/stale and screenshot-review paths were exercised with mocked synthetic responses in `npm test`. This milestone did not call a provider to demonstrate motion. Real hosted callback/identity, original-tab preservation, save/reload/reopen, edit/delete, expiry/sign-out, two-account isolation and stale-save conflict checks remain pending in [ACCOUNTS](ACCOUNTS.md); do not infer they passed from the redesigned UI or DOM tests.
