# Section 12A — Playwright MCP setup and real-browser verification

For the later LAN/Chrome/WebKit reliability pass and current screenshots, see [Section 12B](WEBSITE_12B.md). The setup evidence below remains scoped to Section 12A.

Verified November 22, 2026. This pass configures browser testing only. It preserves all pre-existing local conversation work and makes no Section 12B website changes.

## Configured connection

- **Server:** `fuzl_playwright`, stdio, enabled in the project-only [`.codex/config.toml`](../.codex/config.toml).
- **Package:** Microsoft `@playwright/mcp@0.0.86`, pinned to the npm version inspected during this pass. It reports Playwright `1.66.0-alpha-2026-11-18` during MCP initialization.
- **Browser:** installed Google Chrome **157.0.8103.79**, headless, isolated in-memory context. This is Chromium browser evidence, not Safari/WebKit or a real phone. No extension or personal Chrome profile is used.
- **Environment:** Node `24.18.0`, npm `11.16.0`; Microsoft requires Node 20+. Existing project trust was already `trusted`; global Codex configuration and its existing servers were not changed.
- **Viewport:** 1440×1000 desktop; 390×844 phone-sized viewport. The latter changes viewport dimensions, not touch input, a software keyboard, or device hardware.
- **Output:** `artifacts/design/section12a/`, under the existing ignored artifact directory. No authentication state/trace/HAR is saved. Screenshots contain only a signed-out workspace, built-in sample facts and a reserved synthetic email address.

The server is launched with `--browser chrome --headless --isolated --caps devtools`, URL-parameter redaction, a 1440×1000 initial viewport and the project artifact output directory. Startup/tool timeouts are 60 seconds. The working directory is explicitly this checkout; **update `cwd` if you move the checkout**. No app dependencies or lockfile changed; npx cached the pinned tool separately.

Official sources checked: [Microsoft Playwright MCP setup, Node requirement and isolation](https://github.com/microsoft/playwright-mcp/blob/main/README.md), [Codex project MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), and [Codex `cwd`/timeout configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). Isolation discards this test profile on browser close; it does not make actions on a website harmless or bypass Fuzl's access checks.

## What actually ran

This was a real MCP session: initialization, `tools/list`, then `browser_navigate`, `browser_click`, `browser_select_option`, `browser_type`, `browser_snapshot`, `browser_evaluate`, `browser_resize`, `browser_take_screenshot`, console/network inspection and browser close. These were **not** DOM simulations, mock fetches or a direct standalone Playwright test substituted for MCP.

The current Codex turn predates the new server registration, so a temporary standard MCP SDK client connected to the **same configured stdio server** for this verification. Its helper/SDK are under the ignored artifact directory, not app dependencies or a new production service. The initial SDK lookup failed because the MCP npm package does not ship its development SDK dependency. Installing the SDK in that temporary artifact directory fixed the client setup; MCP then initialized and the browser interactions below succeeded. The server configuration itself needs only npx and Chrome, not this helper. `codex mcp list/get` also confirmed the project server is enabled with the intended working directory.

The browser and temporary MCP client were closed after evidence collection. Fuzl's existing web/API processes remain running.

## Observed interactions

All app navigation used **http://127.0.0.1:5173/**. Sample, Plan and sign-in views use that same URL with internal UI state. No LAN origin, auth callback URL or token-bearing link was used.

| Check | Actual result |
| --- | --- |
| Homepage, desktop | Rendered split hero, composer, animated dot canvas, sandstone scenery and sample cards. Browser title exactly **Fuzl**. |
| Try an example | Opened the composer popover, selected **Saturday bowling**, clicked **Load sample**. |
| Matching Plan | **Saturday bowling** heading received focus and the **Plan** stage became current. Sample labels and unresearched/unknown details remained visible. |
| Details | **Group details · 2 people** expanded to Alex/Sam cards and collapsed again. |
| Sign-in, desktop | Clicked **Sign in**, filled Email with `fuzl-browser-check@example.com`; validity was true. **Send sign-in link was never clicked**, and Enter was not submitted. |
| Phone-sized navigation | At 390×844 returned to Workspace, saw the retained Saturday Plan; then accepted the unsaved-work beforeunload guard only to reload this synthetic sample and open the homepage. |
| Phone gallery and Plan | Clicked **Open sample: Friday, maybe**; matching heading received focus. Friday stayed tentative, with the exact-date question and **Review the date** visible. |
| Phone details/stages | **Group details · 3 people** opened to Alex/Sam/Jordan. **Conversation → Plan** returned to the same sample. |
| Phone sign-in | Clicked **Sign in** again and filled the same reserved synthetic address without submitting. |
| Horizontal overflow | Homepage, Saturday Plan, Friday Plan with People expanded, and sign-in each had `innerWidth = document.documentElement.scrollWidth = 390`. No document-level horizontal overflow observed at this width. |
| Console | Final collection: **0 errors, 0 warnings** across both navigations. Six total informational/debug entries. |
| Network | **376 recorded requests, 0 HTTP 4xx/5xx, 0 POSTs**. Six aborted reads: four `/api/ai-config`, two `/api/account-config`, all `net::ERR_ABORTED`. Subsequent configuration reads returned 200. |

The aborted configuration reads align with React development StrictMode mounting/cleanup and the components' explicit AbortController cleanup. They did not become UI error states, and the later reads succeeded. This is distinct from a provider failure or Fuzl's intentional LAN-origin restriction. The browser stayed on the supported loopback origin; no LAN guard failure or live provider call was exercised here. No AI analysis, email, authenticated account workflow, database write/migration or external discovery request was made.

## Saved evidence

All images were captured through MCP and visually inspected:

- [Desktop homepage, full page](../artifacts/design/section12a/desktop-home.png)
- [Desktop Saturday bowling Plan, viewport](../artifacts/design/section12a/desktop-saturday-plan.png)
- [Phone-sized Saturday Plan, full page](../artifacts/design/section12a/phone-saturday-plan.png)
- [Phone-sized Friday Plan, viewport](../artifacts/design/section12a/phone-friday-plan.png)
- [Phone-sized sign-in, full page](../artifacts/design/section12a/phone-sign-in.png)

Supporting local files: `browser-runtime.json`, `configured-server.json`, `verification.json`, `console-warnings-errors.txt`, `network-requests.txt` and accessibility snapshots in the same artifact directory. Network evidence lists request URLs/statuses, not response bodies or authorization headers. Artifacts remain ignored and unstaged; do not commit a future authenticated capture without checking its contents.

## Use in future Codex sessions

1. Keep Node/npm and Chrome installed. Start Fuzl with `npm run dev` if the existing services are stopped; Vite uses **127.0.0.1:5173**, proxying `/api` to **127.0.0.1:3001**.
2. Open a new Codex conversation in this trusted checkout. Project `.codex/config.toml` registers **fuzl_playwright** automatically. Existing conversations may retain their original tool catalog; start a new conversation or reload the Codex client if the server is absent.
3. Check configuration with `codex mcp get fuzl_playwright` or `codex mcp list` from the repository. Do not copy private global configuration into a report.
4. Ask: **“Use fuzl_playwright to open http://127.0.0.1:5173 and inspect the sample Plan flow.”** Use its snapshots/click/type/resize/screenshot/console/network tools. Capture into the existing artifact location. The temporary SDK bridge from this task is not required in a fresh native Codex MCP session.
5. Keep test data synthetic and email unsent unless a later task explicitly authorizes sending. An isolated context starts signed out; membership/account/AI access restrictions still apply. Close the browser when finished.

No browser-setup blocker remains for the demonstrated MCP connection. Automatic exposure as native tools in a **new** Codex conversation was not separately observed; the configuration was parsed by Codex and the configured server was exercised via MCP in this session. Safari, real mobile devices/software keyboards, live Gemini, hosted sign-in/callback and saved-group/guest workflows remain separately unverified. These screenshots do not verify the entire previous native-chat milestone or motion quality. Section 12B remains untouched.
