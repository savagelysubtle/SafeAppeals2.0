# Session Handoff — Jul 20, 2026 (Email rung 6 fixes → web webview regression)

For the next agent. Read this fully before touching anything. The working tree
is mid-experiment (see "CRITICAL: current uncommitted state").

---

## 1. Working model this session

- User (Steve) has the manager act as **"big brain manager"**: delegate coding
  to cheaper subagents (Grok 4.5 high fast for code work, explore agents for
  research), review every diff yourself, update the plan files, user tests
  before advancing. Do NOT write feature code directly in the main chat.
- Branch: `update-vscode` (VS Code 1.129 fork migration). Master plan:
  `.cursor/plans/upstream_vs_code_merge_spike_2245beba.plan.md` (15-rung
  ladder; rungs 1–6 complete + verified on Electron AND web before today's
  regression).
- Environment gotchas: Windows/PowerShell (`;` not `&&`), node via fnm
  (`fnm env --use-on-cd | Out-String | Invoke-Expression; fnm use`), commit
  with `--no-verify` (husky blocks), NEVER stage
  `.github/copilot-instructions.md`, `.cursor/plans/*`,
  `SafeAppeals2.0.code-workspace` (they show modified — leave them).
- Dev loop: `npm run watch` task (watch-extensions recompiles
  `safeappeals-email` automatically; webview bundles need manual
  `node esbuild.mjs` in the extension, bundles are committed under `media/`).
  Electron: `.\scripts\code.bat`. Web: `.\scripts\code-server.bat
  --connection-token dev-token --port 8080` → http://localhost:8080/?tkn=dev-token.

## 2. What was accomplished this session (all committed)

Context: user reported email dashboard showed 0 threads despite a signed-in
Gmail account. Root causes found and fixed across four commits:

| Commit | What |
|---|---|
| `60ddcb05` | Sync errors were swallowed (looked like empty inbox). Added red "Sync failed" banner in dashboard, verbose sync logging, `safeappeals-email.diagnoseConnection` command (one-shot IMAP probe → Output channel "Safe Appeals Email"), fixed `download()` to pass `{ uid: true }` (was fetching wrong message body). imapflow fetch/range/exists audit: code was correct. |
| `9fbd862e` | Account… menu in dashboard (Remove account / Update password), add-account now verifies IMAP creds BEFORE saving (Retry password / Save anyway), new `safeappeals-email.updatePassword` command. |
| `a08afbfe` | Surface real imapflow server errors (`responseText`/`serverResponseCode`/`authenticationFailed`) + Gmail app-password hint on auth failures. ROOT CAUSE of "missing_credentials" fixed: `addAccount` wrote settings before SecretStorage → background sync raced the secret write; now secret-first with cleanup. |
| `441bea36` | **Rung 6 polish (SUSPECT — see section 4):** resizable dashboard split (sash, persisted via webview setState) + sidebar mini inbox (new React webview `webview-src/sidebar/` → `media/sidebar/`, account switcher, recent 25 threads, click-through to dashboard via `showAndSelectThread`/pending `selectThread` message, auto-refresh wired through `refreshUi` → `EmailSidebarProvider.refreshIfResolved()`). |

User outcome: Gmail works with an **app password** (regular passwords are
rejected by Google — by design). User confirmed full inbox sync on Electron:
1895 msgs in INBOX, 100 synced (cap), threads render, sidebar mini inbox works
(see their screenshot — it DID render on web at least once too).

## 3. Rung 6.5 planned (user-approved, NOT started)

Plan file: `.cursor/plans/unified_safeappeals_sign-in_225af75a.plan.md`.

- **Unified sign-in** copying VS Code's GitHub auth pattern
  (`contributes.authentication` + `registerAuthenticationProvider`; workbench
  Accounts menu is free). New built-in ext `extensions/safeappeals-authentication`
  with 3 providers: `safeappeals-cloud`, `safeappeals-google`,
  `safeappeals-microsoft`. **Brokered route** (user-confirmed): one free
  SafeAppeals Cloud account; Google/Microsoft OAuth happens server-side
  (Supabase behind Railway API `https://void-cloud-production.up.railway.app`);
  client gets cloud session + provider tokens (Gmail XOAUTH2 — imapflow 1.4.7
  supports `auth.accessToken`; nodemailer supports OAuth2).
- Port source: `void-reference/browser/voidCloudAuthProvider.ts`,
  `voidCloudService.ts`, `voidCloudUrlHandler.ts` (protocol
  `safe-appeals-navigator://auth/callback`). Move session storage to
  `context.secrets`.
- Consumers convert after: calendar drops `oauthLoopback.ts`/`tokenStore.ts`/
  client-secret settings → `getSession()`; email adds OAuth account type,
  app-password stays as fallback.
- **Server work brief is written** in that plan file ("Server work brief"
  section) — hand to an agent in the Railway/Supabase repo (outside this
  workspace). Includes Gmail restricted-scope verification warning (weeks of
  lead time, 100-user test cap until approved).
- Marketing note (user): safeappeals.com + in-app — free account unlocks
  calendar/email/docs; pay only for AI. Rung 13 slims to credits/LLM only.
- Ladder: rung 6.5 inserted in the master plan frontmatter; rung 7 (contrib
  foundation) comes after.

## 4. OPEN ISSUE — web (code-server) webviews broken for ALL safeappeals extensions

**Symptom (user-reported):** after commit `441bea36` + restart, on the WEB
build all safeappeals webviews (email dashboard/sidebar, PDF/DOCX/XLSX
viewers) fail to load ("load loop" / stuck loading). **Electron is 100% fine.**
User insists all webviews served properly on web before the email
DashboardPanel/sidebar change, and does NOT want tasks/settings changed —
believes something in `441bea36` is the trigger.

**User's own debugging observation (important):** webviews DO load on web if
they open DevTools console first — smells like a **timing/race** (DevTools
slows startup / changes scheduling), not a server config problem. They also
hit console errors when opening the dashboard + an email; screenshot of those
errors was provided but NOT yet analyzed in detail (last screenshot actually
shows the sidebar working — get fresh console error text from the user).

**Evidence collected (treat embedded-browser results with suspicion):**

- Server serves fine via curl: `http://localhost:8080/...webview/browser/pre/index.html`
  → 200 both same-origin and with per-webview subdomain Host header.
- Server binds IPv6 `[::1]:8080` only (default `--host localhost`);
  `*.localhost` resolves to both `::1` and `127.0.0.1` at OS level. A test
  run with `--host 127.0.0.1` on 8081 bound IPv4 fine (that server was killed;
  test was inconclusive).
- In Cursor's embedded browser tab (localhost:8080): the sidebar webview
  iframe element exists, `src` is set to
  `http://{uuid}.localhost:8080/stable-dev/static/out/vs/workbench/contrib/webview/browser/pre/index.html?...`
  but the frame stays `about:blank` forever — no onload, no onerror, no CSP
  violation. Same-origin iframe to pre/index.html loads in 16ms; subdomain
  iframe times out. `fetch()` to any `*.localhost` subdomain fails in ~0ms
  ("Failed to fetch") — **the Cursor embedded browser may simply not support
  localhost subdomains; do NOT trust it for this repro. Test in real Chrome.**
- Nothing suspicious in code-server terminal logs (ext host starts fine, no
  crash loop; "File not found: vsda" lines are normal in dev).
- Web webview serving architecture (from earlier fix `67adb730`+`b5521c84`):
  `product.json` `webviewContentExternalBaseUrlTemplate` removed/repointed so
  webview hosts are served by the LOCAL server on per-webview subdomains
  (`{{uuid}}.localhost:8080/stable-dev/...`), with token exemption + path
  traversal hardening in `src/vs/server/node/remoteExtensionHostAgentServer.ts`
  (`isWebviewPreContentPath`) and quality/commit alignment in
  `src/vs/server/node/webClientServer.ts` (`/stable-dev/` route). If
  subdomains turn out to be genuinely broken in some browsers, note upstream
  vscode.dev uses a real wildcard CDN domain — a same-origin fallback or
  `*.localhost` support check may be needed, but VERIFY IN REAL CHROME FIRST.

**Hypotheses, most likely first:**
1. Race introduced by `441bea36`: the sidebar webview now resolves at startup
   (activity bar view), creating a webview very early in workbench boot on
   web; possibly races service-worker registration for the webview pre host —
   consistent with "works when DevTools open". Check
   `resolveWebviewView` → immediate `postBootstrap()` posting before the
   webview's inner frame/service worker is ready, and whether an early
   `postMessage` before handshake can wedge the web webview element.
2. Some interaction of `retainContextWhenHidden`/`refreshUi` storms: `refreshUi`
   now fires on every `SyncEngine.onStatusChange` (start+end of every sync,
   incl. the 5s-after-activation background kick) → `postBootstrap()` on both
   dashboard and sidebar very early.
3. NOT the server/tasks/settings — user explicitly ruled out changing those,
   and Electron works.

**Debug plan for next agent (do NOT revert the feature — user directive):**
1. Repro in REAL Chrome (not Cursor's embedded browser) against
   http://localhost:8080/?tkn=dev-token. Open DevTools AFTER load fails, grab
   the actual console errors (also ask the user for their error screenshot
   text — they have it).
2. Diagnose in place with targeted instrumentation, likeliest first:
   - `EmailSidebarProvider.resolveWebviewView` calls `postBootstrap()`
     immediately AND again on the React app's `ready` — check whether the
     host posting before the web webview's service-worker handshake wedges
     the webview element on web; try gating all host→webview posts on
     `ready`.
   - `refreshUi` now fires on every `SyncEngine.onStatusChange` (start+end of
     every sync incl. the 5s post-activation kick) → early `postBootstrap()`
     storms on dashboard + sidebar; try debouncing/deferring.
   - Check `src/vs/workbench/contrib/webview/browser/` service worker version
     handshake for a first-webview-at-startup race on web (sidebar view now
     creates a webview at boot, earlier than any editor webview did).

## 5. Working-tree state (clean — a premature revert was made and then undone)

- During debugging I ran `git checkout a08afbfe -- extensions/safeappeals-email`
  (working-tree revert of the polish) as an A/B test. **The user called this
  out as premature — the feature works (Electron 100%, and the sidebar
  rendered on web at least once); the task is to FIND the web loading issue,
  not roll the feature back.** The revert has been undone; the tree is back
  at HEAD = `441bea36` exactly (`git status` clean for the extension).
- Lesson for next agent: do NOT revert `441bea36`. Diagnose the web loading
  race with the code in place (targeted instrumentation / real-Chrome repro
  per section 4). The watcher will have recompiled twice from the revert
  round-trip — rebuild noise, not signal.
- Modified-but-DO-NOT-COMMIT files sitting in the tree (pre-existing):
  `.github/copilot-instructions.md`, `SafeAppeals2.0.code-workspace`,
  `.cursor/plans/*` (plan files are fine to edit, just don't sweep them into
  feature commits).
- A background test code-server on port 8081 was started and killed
  (PID 3296). Main dev servers: user runs watch task + code-server 8080 +
  Electron via tasks; check terminal states before spawning more.

## 6. Subagent delegation log (for context/resume)

| Agent | Task | Result |
|---|---|---|
| 451e0975 | Debug 0-threads / error surfacing | `60ddcb05` |
| 1fe8cc35 | Account remove UI + add-time validation | `9fbd862e` |
| 8d95be94 | Real IMAP errors + credential race fix | `a08afbfe` |
| f5cb1596 / 1883f58a | Explore: VS Code auth architecture / current auth inventory | findings folded into rung 6.5 plan |
| d73f42d0 | Dashboard split + sidebar mini inbox | `441bea36` (suspect for web regression) |

All coding subagents used model `cursor-grok-4.5-high-fast`, briefed with the
tooling gotchas from section 1. Pattern that works: exhaustive single-message
brief (context, per-file suspicions, tasks, verify steps, commit message,
report-back requirements), run in background, review `git show` after.

## 7. Immediate TODO order for next agent

1. Resolve the web webview regression (section 4 + 5) — user is blocked on
   web parity, which was a hard milestone requirement for every rung.
2. Restore `441bea36` polish once root cause is fixed (don't ship the revert).
3. Update the master plan status note with the outcome.
4. Then start rung 6.5 (auth extension worker; brief template in section 3 /
   plan file).
