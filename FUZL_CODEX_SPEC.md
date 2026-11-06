# Fuzl — Codex Product and Implementation Specification

Version 1.0 • November 6, 2026 • Prepared for Jace Joseph

## 0. Read this first: current assignment and product context

**CURRENT AUTHORIZATION: IMPLEMENT SECTION 1 ONLY — FOUNDATION.**

Read this entire document to understand Fuzl. Then implement only Section 1. Sections 2–12 and the appendices are future product context, not permission to build those features now. Complete the foundation, verify it, explain it to Jace, and STOP. Do not start Section 2 until Jace explicitly requests it.

This document is a self-contained handoff. It consolidates the earlier Hangout Assistant project plan, the Fuzl build roadmap, and subsequent decisions. If older product documents disagree about the current name or milestone, use **Fuzl** and this document's **Section 1 foundation** scope. Normal higher-priority environment instructions and applicable repository instructions still apply. A later direct instruction from Jace can change scope.

### 0.1 What Fuzl is

Fuzl is a mobile-friendly assistant that helps existing friend groups turn messy planning conversations into realistic decisions and completed hangouts. People continue using Messages or another messaging service they already use. One organizer deliberately supplies relevant screenshots, pasted messages, or activity links. Fuzl extracts an editable understanding, obtains missing information through account-free guest links, proposes grounded options, helps resolve conflicts, and remembers approved feedback for next time.

Product promise: **Make a plan with the friends you already have, using the conversation you already started.**

The first audience is Jace and existing friend groups around Columbus/Ohio State. The initial user is the informal organizer who otherwise collects everyone's answers manually. Other participants should be able to benefit without installing anything or making accounts.

The long-term vision is an assistant for shared decisions and coordination: everyday choices, saved discoveries, study groups, gifts, clubs, and eventually trips. These are expansion opportunities, not the first release.

### 0.2 Why this project exists

Jace wants a useful flagship project that he can work on over months, learn from, share, and improve with real users. He has worked on DueCue and DevVault using full-stack TypeScript tools. This project should develop deeper engineering judgment rather than accumulate impressive-sounding features.

Success means people voluntarily reuse Fuzl, the system behaves dependably, and Jace can explain the important design choices. No résumé rating, internship outcome, originality claim, or user-adoption result is guaranteed. Do not invent metrics, partnerships, model training, or capabilities.

### 0.3 Working style

- Work in small, reviewable slices within the active section.
- Give a concise implementation plan before changing code, then proceed with routine authorized work without asking permission for every file.
- Explain important concepts and the data flow in plain language. Jace is learning while building.
- Prefer understandable code and a few purposeful components over abstractions for hypothetical future needs.
- Verify the actual behavior, report the checks honestly, and record what remains unfinished.
- Keep future features documented. Do not create placeholder implementations for them.
- If a genuine blocker changes the requested architecture or prevents the current milestone, explain the blocker precisely and ask only the necessary question.
- Do not treat a broad instruction such as “finish the foundation” as permission to complete the entire roadmap.

### 0.4 Platform boundary

Do not promise automatic access to Apple Messages history. Standard keyboard APIs expose the active text-input context; Full Access does not grant the transcript. Standard Messages-extension APIs also do not provide an unrestricted ordinary-message archive. A normal website cannot directly read the Messages conversation. The product must work with user-supplied context. A later native share extension may reduce sharing friction.

These boundaries were checked against Apple documentation during planning; recheck official capabilities when implementing native work. Do not seek private APIs, scraping of local message databases, or platform workarounds to fulfill an unsupported transcript-access promise.

### 0.5 Milestone index

| Section | Milestone | Authorization now |
| --- | --- | --- |
| 1 | Foundation: local web app and connected API | **Implement** |
| 2 | Editable planning summary using labeled sample data | Future only |
| 3 | AI extraction from pasted conversations | Future only |
| 4 | Screenshot input and extraction | Future only |
| 5 | Organizer accounts, persistence, and saved groups | Future only |
| 6 | Account-free guest responses | Future only |
| 7 | Grounded local recommendations | Future only |
| 8 | Voting, confirmation, and first real outing | Future only |
| 9 | Approved group memory and feedback | Future only |
| 10 | Distinctive planning capabilities | Future only |
| 11 | Independent use, reliability, and evaluation | Future only |
| 12 | Optional iPhone sharing companion | Future only |

## 1. FOUNDATION — IMPLEMENT THIS SECTION ONLY

### 1.1 Objective

Create a small, clean, working local Fuzl application with a React frontend and an Express backend. The user can open the page, type or load a synthetic conversation into a textarea, and see a genuine backend connectivity result.

This section establishes development structure and the frontend-to-backend request path. It does not interpret the conversation, generate summaries, recommend venues, or store plans.

### 1.2 Inspect the target workspace first

1. Identify the actual target directory and read applicable repository instructions.
2. Inspect existing files, package manifests, lockfiles, runtime versions, and Git status. Use targeted reads; do not expose unrelated files or secrets.
3. If this is an empty/new project, use the default structure below.
4. If Fuzl already exists, extend compatible foundations instead of overwriting or regenerating them. Preserve unrelated user changes. If the directory is clearly a different project, ask where Fuzl belongs before placing files there.
5. Determine a compatible supported Node/npm toolchain using the installed environment and current official package requirements. Document the chosen versions. Do not guess version requirements or silently install an incompatible latest release.

Do not assume that code already exists simply because this document describes it. Conversely, do not claim to start from scratch without inspecting.

### 1.3 Default stack and dependency policy

| Concern | Foundation default |
| --- | --- |
| Language | TypeScript, strict checking |
| Web | React + Vite |
| API | Node.js + Express |
| Repository | One private npm-workspace root with `apps/web` and `apps/api` |
| Styles | Small, maintainable CSS files; no large component framework required |
| Development | One root command runs both servers concurrently with clean shutdown |
| API development | A small TypeScript watch runner such as `tsx` |
| API build | Compile TypeScript to JavaScript; run the compiled entry with Node |
| Quality | Type checking, linting, builds, and HTTP/browser smoke verification |
| Persistence | None in Section 1 |

Use one package manager and one committed root lockfile. Choose compatible stable releases when executing and record them through manifests/lockfile. Avoid dependency overrides or force flags merely to suppress conflicts. Add dependencies only for work performed in this section; explain non-obvious additions.

Do not add Prisma, a database driver, auth SDKs, AI SDKs, maps SDKs, upload services, native packages, vector databases, queues, Redis, Docker, Kubernetes, microservices, or a monorepo task framework for future use. Ordinary npm workspaces are sufficient.

### 1.4 Files and responsibilities

The following is the default shape, not a demand to create unnecessary empty files. Adapt names if an existing compatible setup warrants it and document the reason.

| Path | Purpose |
| --- | --- |
| `package.json` | Private root, workspaces, development and quality scripts |
| `package-lock.json` | Reproducible dependency resolution |
| `.gitignore` | Ignore dependencies, builds, real environment files, logs, and local artifacts |
| `.nvmrc` or equivalent | A supported toolchain choice, consistent with the README |
| `README.md` | Product context, current scope, setup, commands, verification, and limitations |
| `FUZL_CODEX_SPEC.md` | This handoff, preserved as context if supplied outside the repository |
| `docs/PROGRESS.md` | Honest completed/pending status and the next section |
| `apps/web/package.json` | Web scripts and dependencies |
| `apps/web/index.html` | HTML shell and Fuzl page title |
| `apps/web/vite.config.ts` | Local dev server and API proxy |
| `apps/web/tsconfig*.json` | Frontend/tool configuration appropriate for Vite |
| `apps/web/src/main.tsx` | React entry |
| `apps/web/src/App.tsx` | Small foundation page |
| `apps/web/src/styles.css` | Responsive styling and visible focus states |
| `apps/web/src/lib/api.ts` | Small health-fetch helper if separation is useful |
| `apps/api/package.json` | Watch, type-check, compile, and compiled-start scripts |
| `apps/api/tsconfig.json` | Consistent server compilation/module configuration |
| `apps/api/src/app.ts` | Express app and health handler |
| `apps/api/src/server.ts` | Port handling, listen, and process startup/shutdown |
| `apps/api/.env.example` | Optional safe port configuration, if supported |

Use a consistent API module strategy. For example, if using native ESM with NodeNext, emitted imports must resolve correctly when running compiled JavaScript. The web compiler's bundler settings and API runtime settings need not be identical. Confirm the built API runs; a successful development runner alone is insufficient.

### 1.5 Foundation UI specification

Build one responsive page, not a marketing site or a simulated full dashboard.

Required elements:

1. A simple text wordmark: **Fuzl**. No final logo is selected. Logo exploration is paused; do not generate or implement one.
2. Short product description: “Turn your group chat into a plan.” This describes the eventual product.
3. Clear current-stage explanation: “Foundation preview. AI planning is not connected yet. Your draft stays in this tab.”
4. A visibly labeled multiline textarea, such as “Conversation draft.” Its placeholder asks for a synthetic example and does not claim that analysis occurs.
5. A working **Load sample** button that places the synthetic conversation from 1.6 into the textarea.
6. A working **Clear** button that clears the draft.
7. A separate compact development connection panel with a **Check connection** or **Retry connection** button and truthful loading/connected/error status.

The textarea is local React state only. Do not submit its contents to the API, log it, write it to localStorage, or persist it in Section 1. Reloading may clear it; state this when explaining the demo.

Do not include a fake Analyze button, fake plan cards, nonfunctional upload area, sign-in control, imaginary saved groups, artificial progress bar, fabricated metrics, or disabled navigation for future features. Future work belongs in documentation. Every interactive control on this page must do what its label says.

The connection panel is development-only product scaffolding; keep it modest and note that it can be removed from the primary user flow later. Do not expose internal implementation details as permanent product onboarding.

### 1.6 Synthetic sample

Use this sample verbatim or with formatting-only adjustments:

```text
Alex: Anyone free this Friday evening?
Sam: Maybe after 7. I can spend up to $20.
Jordan: I'd like to try something new, but keep the drive under 20 minutes.
Alex: Bowling could be fun. Nothing is booked yet.
```

Section 1 only loads and edits this text. It does not parse it. In later sections, “maybe” remains tentative, “Friday” may need an exact reference date, and bowling remains an idea rather than a booking.

### 1.7 Visual and accessibility requirements

Use restrained neutral styling with CSS variables so branding can change later. Jace rejected previous logo/color concepts; no palette or icon has been approved. Prioritize spacing, readable typography, clear hierarchy, and functional states over elaborate effects.

- Fit narrow mobile and desktop widths without horizontal overflow.
- Use semantic HTML, actual buttons, and an explicitly associated textarea label.
- Provide visible keyboard focus and readable contrast.
- Make status understandable through text, not color alone.
- Announce connection-state updates appropriately without aggressive repeated alerts.
- Avoid unnecessary animation, remote font dependencies, and ornamental dashboards.
- Keep components small enough to understand; do not build a generic design system.

### 1.8 API contract

Expose exactly the needed health route:

```http
GET /api/health
```

Successful response:

```json
{
  "status": "ok",
  "service": "fuzl-api"
}
```

Return HTTP 200 with JSON. This means the API process is reachable; it does not mean AI, databases, or external integrations are available. Do not claim otherwise.

The web application fetches `/api/health` through Vite's development proxy. A relative URL keeps the browser request on the frontend origin during development. Suggested local ports are web 5173 and API 3001. Document actual ports and any occupied-port behavior. Prefer clear failure for the API rather than secretly using an unexpected port that breaks the proxy.

A small frontend helper should handle non-2xx results, malformed/unexpected responses, and connection failure. Use a finite request timeout (for example five seconds). Support idle/checking/connected/error states and a real retry. Prevent a late response from overriding a newer check if repeated requests are possible. Do not automatically retry forever.

The connection status must reflect an actual request. Stop the API during verification and confirm the UI reports a failure instead of retaining a misleading success state after a new check.

Do not add conversation POST routes, extraction stubs, future API route registries, or generic service layers. The API receives no draft text in this section.

### 1.9 Environment and networking

- No accounts, paid services, credentials, or secrets are needed to run the foundation.
- An optional API `.env` may set `PORT=3001`; if included, implement/document how it is actually loaded.
- The app must start with documented defaults without requiring an environment file.
- Vite's dev proxy target must match the configured API port. Explain how to change both if necessary.
- Environment examples contain safe examples only. Never put future secrets into `VITE_` variables; those are exposed to frontend code.
- No blanket wildcard CORS is needed when using the local proxy.
- Default to local development. If an existing preview environment requires another host/port, adapt only the necessary configuration and document it.
- The Vite dev proxy is not a production routing solution. Deployment configuration is future work.

### 1.10 Root commands

Provide and verify these commands, or document exact equivalent names if extending an existing repository:

| Command | Expected behavior |
| --- | --- |
| `npm install` | Install root/workspace dependencies from the selected manifests |
| `npm ci` | Reproduce installation from the committed lockfile |
| `npm run dev` | Start both web and API concurrently; Ctrl+C stops both |
| `npm run dev:web` | Start only the frontend |
| `npm run dev:api` | Start only the backend |
| `npm run typecheck` | Check web/tool and API TypeScript without hiding failures |
| `npm run lint` | Lint implemented source using a compatible configuration |
| `npm run build` | Build frontend assets and compile API JavaScript |
| `npm run start:api` | Run the compiled API after build |

Use a small process runner or an existing reliable orchestration approach for concurrent long-running dev servers. Do not assume a sequential workspace command will start both simultaneously. Ensure one failed startup does not leave an orphan process silently running.

Do not add fake test scripts that merely print success. A large automated UI suite is unnecessary for this small foundation. Use the smoke checks below and any meaningful tests required by the actual implementation or repository.

### 1.11 Documentation and progress record

README must include:

- What Fuzl aims to do and exactly what this section implements.
- Toolchain prerequisites and how they were selected.
- Installation, startup, local URLs, build, lint, type-check, and compiled API commands.
- The health endpoint and a sample expected response.
- The difference between frontend state and backend connectivity.
- Draft data is temporary and not transmitted or stored by this section.
- Troubleshooting for a stopped API, occupied ports, and proxy/port mismatch.
- No AI, extraction, database, auth, or venue integration exists yet.
- Section 2 is the next proposed task and requires a new user instruction.

Keep the progress file brief. List implemented items and actual checks, pending items, known issues, and the next milestone. Preserve the supplied spec; do not rewrite future goals as completed features. If dates are recorded, use the actual execution date, not this document's preparation date.

### 1.12 Verification and acceptance checklist

Run checks appropriate to the implementation. Record exact commands and results. A check that could not run is blocked or unverified, not passed.

- [ ] A fresh installation works using the documented toolchain and root lockfile.
- [ ] Root dev command starts the frontend and backend together.
- [ ] The Fuzl page loads and its title/labels are correct.
- [ ] Typing, Load sample, and Clear all work.
- [ ] The connection panel obtains success from an actual API request.
- [ ] Direct `GET /api/health` returns the specified status/body.
- [ ] Stopping the API and checking again produces an actionable error; restarting and retrying recovers.
- [ ] Draft text is absent from requests, backend logs, and persistent browser storage created by this app.
- [ ] Reload behavior matches the documented temporary-state design.
- [ ] Mobile/narrow and desktop layouts are usable without horizontal overflow.
- [ ] Keyboard interaction, visible focus, labels, and textual status work.
- [ ] Type checking, linting, and builds pass.
- [ ] The compiled API starts and responds correctly.
- [ ] Ctrl+C shuts down both development processes cleanly.
- [ ] Git diff contains only intended foundation work; no secrets or generated dependency/build directories are tracked.
- [ ] No later-section feature has been implemented or presented as working.

Use available browser tooling for the visual/interaction checks. If it is unavailable, verify HTTP/build behavior and give Jace precise manual steps for the remaining checks. Do not claim visual verification from a successful build alone.

### 1.13 Git and external actions

If a new local Git repository is needed, initialize it in the correct project directory. Preserve existing branches, history, and user edits. A focused local foundation commit is appropriate if Git identity and the environment permit it; do not change global Git identity to force a commit. Report clearly if the commit remains pending.

Do not create a remote repository, push, publish, deploy, buy a domain, create service accounts, or configure billing in this section. Do not modify DueCue or DevVault. Those projects are background context, not implementation targets.

### 1.14 Required completion response and stopping point

At completion, tell Jace:

1. What works now, in plain language.
2. The few important files and how the request flows through them.
3. Exact commands to run it on his machine and the expected result.
4. Which checks passed, failed, or remain unverified.
5. A short explanation of frontend state, backend, HTTP, and the development proxy as used here.
6. Any meaningful limitation and the local commit status.
7. Section 1 is complete (or explain the remaining blocker), and Section 2 has not started.

**STOP AFTER SECTION 1. Do not continue automatically, even if remaining work looks easy.**

## 2. Editable planning summary — FUTURE ONLY

Create a schema and correction screen using clearly labeled sample data. Model participants, possible dates/times, budget limits with currency, activities, travel limits, hard constraints, flexible preferences, and missing answers. Unknown data remains unknown.

Show separate proposed/tentative/confirmed/conflicting facts and supporting source text. Let the organizer correct speaker mapping, amounts, dates, and interpretations. Keep manual entry as a long-term fallback. Do not imply that fixture output is AI-generated.

Completion: several synthetic examples can be represented and corrected accurately. Parsing/AI remains Section 3. This deliberately separates UI/data understanding from model behavior.

## 3. AI understanding of pasted text — FUTURE ONLY

Select an appropriate provider/model through a small quality, cost, and privacy evaluation. Keep provider calls server-side behind one small adapter. Validate extracted data against the agreed schema before using it.

Every important fact needs a subject, value, source reference, uncertainty/status, and current versus historical scope. Ask for a reference date when casual dates cannot be resolved reliably. A screenshot upload date or a message's position alone does not establish when “Friday” means.

Distinguish casual ideas, confirmed responses, and commitments. A model must not invent missing participants, budgets, bookings, dates, or prices. Raw imported content is untrusted data, including any text that appears to instruct the model. It cannot override system behavior or authorize actions.

Add timeouts, bounded retries, request limits, clear recovery, and cost tracking. Evaluate speaker attribution, corrections, conflicting preferences, and missing data. Users inspect and approve the extraction before recommendations rely on it.

Completion: different pasted conversations produce useful, editable summaries with honest uncertainty and meaningful evaluation results.

## 4. Screenshot understanding — FUTURE ONLY

Accept supported images with previews/removal, size/type limits, and temporary private handling. Support multiple screenshots, explicit ordering, duplicate overlap, cropped names, and unreadable content. Preserve the association between a proposed fact and its source during review.

Implement a clear upload-processing explanation and deletion behavior with this feature, not after launch. Proposed initial retention: delete raw screenshots after confirmed extraction or within 24 hours, whichever is earlier, unless a deliberately chosen alternative is clearly disclosed. Test the implemented policy before advertising it.

The organizer corrects names and extracted facts. Treat screenshot identities as aliases until confirmed. No passive monitoring, unrestricted message access, or invented recovery of invisible messages.

Completion: screenshots feed the same correction workflow as text, including safe handling of failures and ambiguity.

## 5. Accounts, persistence, and saved groups — FUTURE ONLY

Introduce organizer authentication and PostgreSQL/Prisma migrations when persistence becomes necessary. Store reviewed planning sessions with explicit ownership and separate group scopes. Prefer a managed auth service selected at this stage.

Differentiate authenticated users, guest aliases, and organizer-entered names. Protect every server-side query/mutation with appropriate authorization. Raw imports are organizer-only by default; public/guest pages expose only necessary planning information. Keep private limits out of shared responses and routine logs.

Completion: an organizer can return to saved work, another account cannot access it, and deletion/correction behavior is implemented and tested.

## 6. Account-free guest participation — FUTURE ONLY

Generate lightweight invitation links so friends can answer missing questions from their existing chat without installing or registering. Ask only for useful missing information: name/alias, availability, spending limit, travel preference, and optional mood/activity choices.

Separate group-join permissions from personal response-edit permissions. Tokens are scoped, expiring/revocable bearer capabilities. A display name is not strong authentication; document that limitation. A shared invitation must not let someone overwrite every participant's response.

Participant-supplied responses override tentative imported interpretations about that participant. Private budget limits should influence feasibility without being directly exposed. Do not promise complete anonymity: group results may allow inference.

Completion: participants can submit and revise their own responses, the organizer sees updates, and imports/private limits remain appropriately restricted. Polling is acceptable initially.

## 7. Grounded local recommendations — FUTURE ONLY

Start around Columbus/OSU with one supported venue-data source plus manually supplied sources. Retrieve candidates, then use application code for hard constraints and ranking. The AI can explain supported results; it cannot invent venues or make an unavailable option feasible.

Return up to three useful cards showing activity/place, time, applicable cost estimate, source link, last checked time, relevant travel information where available, why it fits, and remaining verification needs.

Differentiate verified fits, options requiring checks, and excluded options. Unknown hours, age eligibility, accessibility, dietary suitability, price, or capacity must not pass a required check as if confirmed. A dollar-sign category is not an exact budget guarantee. Free admission does not establish zero total cost for every plan.

Start ranking with understandable configurable rules: participant preferences, novelty, cost confidence, travel burden, and source quality. Do not present uncalibrated match percentages as precise probabilities. Provider selection must account for attribution, storage, access, and cost requirements; do not assume a full venue catalog can be copied permanently.

Completion: recommendations reflect reviewed constraints, cite sources, and handle no feasible result and provider failure honestly.

## 8. Decision, confirmation, and first real outing — FUTURE ONLY

Add voting and explicit attendance responses, then organizer confirmation of a plan version. Votes express preferences, not permission to violate constraints or proof of attendance. Keep an authoritative shareable plan page with time, place, sources, cost uncertainty, confirmed responses, and outstanding actions.

Plan lifecycle: proposed, confirmed, completed, cancelled. Track changes so stale edits do not silently replace a confirmed agreement. User confirmation in Fuzl does not create a real reservation, ticket, payment, or calendar booking by itself.

Deploy a suitable alpha after checking permissions, private data handling, costs, and public endpoints. Use the product for one real outing and observe friction. External actions and messaging require their own explicit user action/authorization; the default is preparing a link or draft for the organizer to send.

Completion: the end-to-end loop works for actual participants, and outcomes are recorded honestly.

## 9. Memory that improves repeat use — FUTURE ONLY

Collect explicit completion and quick feedback: enjoyment, value, noise/crowding, travel burden, and willingness to repeat. Store approved memories, not a speculative personality generated from one message.

Separate user-level preferences from group observations. Separate stable preferences from outing-specific moods. Use the actual attending subset, not every historical group member. One group's data must not silently appear in another.

Members can inspect/correct/delete memories within their ownership permissions. Proposed plans and saved ideas are distinct from visited places. Preserve minimal permitted provenance without retaining whole conversations indefinitely.

Completion: a second outing benefits from explicit prior feedback, and the improvement is understandable to the user.

## 10. Signature capabilities — FUTURE ONLY, ONE AT A TIME

### 10.1 “Make this work”

When confirmed hard constraints cannot all be met, explain the conflict and search a bounded set of adjustments to flexible preferences. Example: “Starting 30 minutes earlier produces two supported options.” Derive such counts and changes from actual retrieved candidates/calculations.

Firm limits remain firm until the affected user changes them. Do not silently exclude a member or reveal private limits to justify a recommendation. Explain that the search covers supported candidates; do not claim global mathematical optimality.

### 10.2 Saved discoveries

Accept screenshots, links, or manual ideas for cafés, markets, workshops, hikes, and other activities. Extract and verify candidate details, retain sources and interested participants, and track date-specific expiry.

Surface relevant saved activities when the right people and conditions align. Do not promise automated extraction from every social platform. Manual correction and screenshot input cover inaccessible links.

### 10.3 Familiarity versus exploration

Let groups favor reliable repeats or suitable new experiences. “Hidden gem” means unfamiliar to this group and well matched, not guaranteed obscure or exclusive. Use actual visits and feedback to avoid repetition without automatically discarding good favorites.

### 10.4 Participation modes

“Everyone together” seeks agreement for the intended full group. “Who's available?” uses an explicitly opted-in subset and expiring availability windows. Show the mode clearly; do not quietly shrink a group to make feasibility look better. Continuous location tracking is unnecessary.

### 10.5 Fairness over time

Test balancing travel burden and preferences across completed outings, with understandable controls. Respect firm constraints. Do not assign public friendship/reliability scores, shame decliners, or infer interpersonal relationships from missing responses.

### 10.6 Backup plans

Offer alternatives when relevant weather, hours, cancellation, or user changes disrupt a plan. Preserve agreed constraints where possible and show what changed. Ask the group to confirm meaningful changes. Do not imply continuous monitoring unless that feature exists and is enabled.

### 10.7 History, recaps, and optional reminders

Show last completed outings, saved interests, and future wishes. Optional photos, recaps, and low-frequency reminders can add value after the core works. Reminders require explicit preferences. A shared memory view must respect visibility and deletion settings.

## 11. Reliability, independent users, and evidence — FUTURE ONLY

Reliability begins with each feature; this section expands evaluation and independent usage rather than postponing essential safeguards.

Maintain synthetic or explicitly consented extraction examples. Cover cropped/overlapping screenshots, tentative responses, relative dates, corrections, sarcasm, pronouns, currencies, and conflicts. Measure field accuracy, attribution, missing-data detection, unsupported claims, and correction effort.

Test decision logic separately from generated explanations: timezones, budgets, participant subsets, unknown facts, no-feasible-option behavior, explicit relaxations, and stale state. Test group isolation, guest token revocation, private limits, duplicate actions, and concurrent edits. Add end-to-end tests for important real journeys.

Measure import effort, guest completion, confirmation, reported actual completion, group return use, organizer interventions, latency, external failures, and cost per successful session. Keep analytics minimal and exclude raw chats, private budgets, and precise personal addresses.

An early experiment can involve roughly 3–5 groups over several weeks, adjusted to actual access. Distinguish Jace's own group, developer-assisted sessions, and independently completed sessions. Small trials give directional evidence; do not claim statistical significance or causality without an appropriate design.

Compare the experience with ordinary group planning, simple shortlist baselines, and relevant competitor workflows. Publish only supported claims. Build an honest demo using synthetic/permitted material and document implemented versus planned behavior.

## 12. Optional iPhone sharing companion — FUTURE ONLY

After validating web usefulness, prototype a containing iPhone app and share extension on a real device. Receive deliberately shared screenshots/links, choose a saved group, review extraction, and continue planning. Measure whether it meaningfully reduces effort.

Evaluate on-device OCR with Apple's Vision framework. If extracted text goes to a server, disclose that clearly; local OCR alone does not make all processing local. Recheck current platform requirements and distribution requirements when executing this milestone.

Keyboard and iMessage interfaces may later insert drafts or present planning controls. They are optional and must not be sold as unrestricted access to ordinary Messages history.

## Appendix A. Eventual full product journey

1. Friends discuss an outing in their usual chat.
2. The organizer deliberately supplies the relevant messages/images and selects a group.
3. Fuzl proposes a structured understanding with evidence, uncertainty, conflicts, and missing answers.
4. The organizer corrects that understanding.
5. A guest link collects missing participant-owned responses.
6. Fuzl retrieves real candidates, applies constraints, and presents a short grounded shortlist.
7. The group evaluates options; supported compromises appear if necessary.
8. The organizer confirms a plan and shares the result through the existing chat.
9. Participants report whether it happened and provide optional feedback.
10. Approved group memory improves the next planning session.

The app should feel useful before users configure profiles or integrations. Screenshot import is a hypothesis to test, not guaranteed effortless adoption. Preserve manual summaries when they are faster.

## Appendix B. Later architecture and data concepts

Do not implement these components or database tables in Section 1.

Use a single repository and backend initially. Add PostgreSQL/Prisma when persistence is needed, private temporary uploads with screenshot work, and provider adapters when selecting AI/venue integrations. A durable database-backed job mechanism can be added if request duration requires it: persisted status, bounded retries, cancellation, and idempotency. Avoid early distributed infrastructure.

| Future entity | Responsibility |
| --- | --- |
| User | Authenticated account identity and owned settings |
| Group / Membership | Separate planning context and access |
| Participant alias | Guest or organizer-entered identity, distinct from authenticated membership |
| Import session / Imported item | Temporary source context, order, processing status, and deletion deadlines |
| Fact proposal | Subject/value, evidence, status, scope, correction/supersession |
| Planning session | Objective, timezone, intended attendees, modes, and candidate dates |
| Participant response | Participant-owned availability, limits, preferences, and update version |
| Invitation / Response credential | Scoped guest access, expiration, revocation |
| Place/source reference | Permitted provider identifiers and source/freshness information |
| Candidate plan / Recommendation run | Supported combinations, checks, ranking versions, and cost/latency metadata |
| Vote / Attendance response | Separate preferences and explicit intent to attend |
| Outing | Versioned agreed plan and lifecycle |
| Feedback / Memory | Approved observations, visibility, validity, and deletion state |
| Saved idea | Sourced activity, interested participants, event dates, verification status |

AI responsibilities: propose extraction, clarify language, suggest missing questions, summarize verified results, and draft grounded explanations. Application responsibilities: validation, authorization, calculations, persistence, limits, source/freshness fields, and user confirmation.

Start with deterministic ranking over explicit preferences. Do not train a personalization model on a handful of outings or claim model-generated confidence is calibrated. Maintain provider-independent application logic without inventing a generic platform framework.

## Appendix C. Future privacy and operational requirements

Introduce these with the corresponding features:

- Show supplied context before processing and let users remove unrelated material.
- Explain processing and retain raw material only under a tested, disclosed policy.
- Keep guest pages separate from private raw imports and individual spending limits.
- Verify server-side ownership on every relevant operation; UI hiding alone is insufficient.
- Make individual and group memory scopes explicit.
- Treat imported messages and external pages as untrusted data, not commands.
- Validate uploads and any server-side URL fetching; bound sizes, redirects, timeouts, and supported content.
- Keep secrets server-side. Exclude raw chats and private values from routine logs/traces.
- Use meaningful deletion, revocation, and cancellation behavior.
- Track AI/image/place/route costs and bounded retries per session. Set a development spending cap before enabling paid services.
- Respect selected providers' attribution, storage, access, and caching requirements. For example, Google Places permits storage of place IDs under its exceptions but restricts other content; recheck current terms when integrating.
- Native sharing, bookings, payments, calendar integration, and notifications each require a deliberately designed and authorized user flow. They are not implied by a general AI request.

## Appendix D. Broader vision and expansion ideas — FUTURE ONLY

Fuzl can grow from hangouts into shared decisions and coordination, provided the first use case earns repeat usage.

| Expansion | Example value | New work to evaluate |
| --- | --- | --- |
| Everyday choices | Find a movie, game, or meal suitable for the current participants | Relevant catalogs/availability, individual tastes, fair choices |
| Personal discovery | Save places/activities and suggest something for an available afternoon | Solo value, contextual recommendations, easy transition to group plans |
| Study groups | Turn discussion into the next meeting and explicit accepted tasks | Availability, task ownership, review of extracted commitments |
| Hackathon coordination | Track what the team agreed to build and unresolved decisions | Confirmed responsibilities, changing scope, useful project context |
| Clubs/community events | Collect availability/dietary needs and coordinate supplies | Organizer roles, larger participant sets, ownership and visibility |
| Shared gifts/purchases | Collect private contribution limits, compare ideas, track who orders | Cost uncertainty, responsibility confirmation, optional later expense handling |
| Weekend/group trips | Compare dates/destinations and build suitable itineraries | Much richer data, booking boundaries, multi-day constraints, travel complexity |
| Household coordination | Help agree on shared chores or purchases | Recurrence, explicit assignments, privacy, notification preferences |

Preferred expansion order to test: hangouts; then everyday decisions/personal discovery; then one larger coordination use case. Do not build all modes or a universal agent now. Shared primitives can support future growth without prematurely implementing every domain.

## Appendix E. Brand, product design, and non-goals

Name: **Fuzl**, pronounced informally “fuzzle.” Use “Fuzl” as the displayed product name unless Jace later chooses otherwise. The assistant may share the product name.

No final logo or colors have been selected. Previous concepts were exploratory and mostly rejected. Fuse + puzzle-piece imagery and a small piece clicking into a main form were discussed, but no mark is approved. Logo work is paused and must not delay implementation. Use a text wordmark and neutral styling now.

Use warm, direct, ordinary language. Keep navigation shallow and interfaces calm. Jace dislikes fake controls, excessive tabs, empty space without purpose, and implementation terminology in product flows. Display uncertainty clearly rather than generating confident-sounding filler.

Fuzl is not a replacement messaging network in its first release. It does not read private chats automatically, infer attendance from bookings, make purchases on its own, rank friendship quality, or establish verified identities from screenshots.

Nearby products already advertise AI planning, preferences, polls, private budgets, fairness, and memory. No one feature should be presented as a unique invention without research. The proposed advantage is an easy organizer-led flow from explicit conversation context to a grounded, group-aware plan, with evidence that it works.

## Appendix F. Long-term demonstration and engineering goals

An eventual demonstration could show a synthetic messy conversation, correct uncertainty, one account-free guest response, a real sourced shortlist, an actual constraint conflict, a computed adjustment, a confirmed plan, and feedback changing a subsequent recommendation.

The résumé story should be grounded in shipped behavior and evidence: independent repeat use, measured extraction/correction quality, tested constraint correctness, private guest collaboration, reliable source handling, and bounded costs. Do not equate a large feature count or infrastructure list with professional quality.

Jace should be able to explain the important logic, debug failures, and defend tradeoffs. Codex should help him learn through the implementation rather than generate an opaque full product in one pass.

## Appendix G. Official implementation references

Use primary documentation and recheck relevant requirements at execution time. These links provide context; following them does not expand Section 1's authorization.

- Vite guide and requirements: https://vite.dev/guide/
- Vite development server/proxy: https://vite.dev/config/server-options
- Vite environment exposure: https://vite.dev/guide/env-and-mode
- npm workspaces: https://docs.npmjs.com/cli/using-npm/workspaces/
- Express starter: https://expressjs.com/en/starter/hello-world.html
- Apple custom keyboards: https://developer.apple.com/documentation/uikit/creating-a-custom-keyboard
- Apple keyboard Full Access: https://developer.apple.com/documentation/uikit/configuring-open-access-for-a-custom-keyboard
- Apple Messages conversation: https://developer.apple.com/documentation/messages/msconversation
- Apple selected extension message: https://developer.apple.com/documentation/messages/msconversation/selectedmessage
- Apple share extensions: https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html
- Apple on-device text recognition: https://developer.apple.com/documentation/vision/recognizing-text-in-images
- Google Places attribution/storage policies: https://developers.google.com/maps/documentation/places/web-service/policies

---

## Final execution reminder

**Implement Section 1 only.** Understand the rest, preserve it as context, and stop after a verified foundation and clear handoff. Do not implement an editable summary, AI extraction, screenshots, accounts, persistence, guest links, recommendations, memory, native extensions, or future expansion features until Jace explicitly requests the corresponding work.
