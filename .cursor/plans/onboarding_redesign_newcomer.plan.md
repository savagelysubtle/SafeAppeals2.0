---
name: Onboarding Redesign for Agentic-AI Newcomers
overview: Rebuild the first-run wizard as a 4-step flow — SafeAppeals Cloud sign-in → Who You Are → Meet Your AI Assistant (approval literacy + hallucination inoculation) → Credits & First Steps (honest zero-credit handoff) — backed by a new extensions/safeappeals-authentication built-in that ports the void-reference cloud auth with two non-negotiable fixes (PKCE end-to-end, tokens in SecretStorage). Personalize step cut; dead AiPreference step repurposed into an approval-mode choice writing the REAL auto-approve settings; first value delivered credit-free via a bundled fake sample case + the existing spotlight-tour engine. Chat inference stays on Copilot plumbing until the final breaking workstream (cloud LLM provider + product.json swap).
todos:
  - id: onb-t0-cloud-pkce
    content: "T0 (void-cloud repo, DONE FIRST as standalone security fix — user decision Jul 29 2026): PKCE on /auth/google + /auth/callback (flowType:'pkce' flag is currently inert), state param, redirect-URI exact-match allow-list, disable implicit flow, close unauthenticated /auth/callback provider-token leak; plus /docs/credits pricing fix and AI-use/consent docs content. Blocks T1 outright."
    status: completed
  - id: onb-t1-auth-ext
    content: "T1 (deps: T0 — fails closed against today's server because it rejects fragment tokens): scaffold extensions/safeappeals-authentication — PKCE client, SecretStorage session envelope, registerUriHandler, paste fallback, balance/checkout commands, build wiring + trustedExtensionAuthAccess"
    status: completed
  - id: onb-t2-step-types
    content: "T2: onboardingTypes.ts — delete AiPreference + GHE machinery, add AgentIntro + CreditsHandoff steps, new order; update tests; extend IOnboardingService (onDidComplete/isShowing/dismiss reason)"
    status: completed
  - id: onb-t3-signin-step
    content: "T3: rewrite sign-in step — Google-only CTA via IAuthenticationService, SafeAppeals terms/privacy disclaimer, GHE UI removal, honest nudge reword"
    status: completed
  - id: onb-t4-profile-step
    content: "T4: profile step — role pills (Lawyer/Paralegal/Advocate/ Representing Myself), standing unverified-citation instruction in profile rule file"
    status: completed
  - id: onb-t5-agent-step
    content: "T5: new 'Meet Your AI Assistant' step — 3 cards, data-flow disclosure panel, inoculation block with gating checkbox, approval-mode choice writing the FULL default-shaped chat.tools.edits.autoApprove object with only '**/*' varied (see §4.1a)"
    status: completed
  - id: onb-t6-approval-default
    content: "T6: flip chat.tools.edits.autoApprove default '**/*' true→false in chat.shared.contribution.ts (own PR, behavioral)"
    status: completed
  - id: onb-t7-credits-step
    content: "T7: new 'Credits & First Steps' step — honest zero-credit copy, live balance when signed in, pricing/docs links, role-tailored first-action block"
    status: completed
  - id: onb-t8-dismissal
    content: "T8: startupPage.ts dismissal semantics — seen-flag only on explicit complete/skip; Esc uses attempt counter (cap 2)"
    status: completed
  - id: onb-t9-a11y
    content: "T9: accessibility pass — workbench.reduceMotion class, scroll-padding for WCAG 2.4.11, focus-restore verification, keyboard audit of new controls. ALSO FOLD IN the five deferred T5 review items: (a) add a localize() translator comment guarding the deliberately-fabricated citation so localizers do not substitute a real one, (b) add themed .onboarding-a-inline-link CSS incl. focus-visible (currently browser-default), (c) approval-card border-radius 12px -> 8px to match the control tier, (d) drop the always-empty div in _createFeatureCard, (e) log updateValue rejections in the approval-mode write."
    status: completed
  - id: onb-t10-walkthrough
    content: "T10: safeappeals-case — walkthrough becomes 5–7-item outcome checklist, profile prefill from safeappeals.profile.* settings, package.nls.json restructure"
    status: completed
  - id: onb-t11-core-consolidation
    content: "T11: watermark rewrite to case language, sessions TOS copy fix, Help menu 'How {0} Uses AI' command"
    status: completed
  - id: onb-t12-sample-case
    content: "T12: bundled fake sample case + openSampleCase command + spotlight-tour scenario (verify workbench-layer registration first)"
    status: completed
  - id: onb-t13-cloud-llm
    content: "T13 (phase B): cloud LLM provider over POST /llm/chat, zero-credit error UX with checkout link; SSE strongly preferred. DONE Jul 31 — Ask-mode only (toolCalling:false) until server tools; vendor safeappeals-cloud in safeappeals-authentication."
    status: completed
  - id: onb-t14-product-swap
    content: "T14 (phase B, BREAKING): product.json — remove GitHub.copilot-chat built-in, trim defaultChatAgent, suppress chatSetupRunner; regression pass on chatEntitlementService sentiment.hidden gate"
    status: pending
isProject: false
---

# Onboarding Redesign for Agentic-AI Newcomers

Audience: lawyers, paralegals, claimant advocates, and self-represented
claimants who have never used an agentic AI tool. Fixed scope decisions
(user, Jul 29 2026): (1) swap GitHub sign-in for SafeAppeals Cloud sign-in as
part of this work; (2) new users get ZERO credits — no starter grant, no
BYOK/Ollama — so onboarding must explain the credits model honestly, link
pricing, never promise sign-in "unlocks AI features", and cannot end in a live
agent demo.

Prior-session context: the Obsidian vault (`aivault`) has **no notes** on this
onboarding work. Carried-forward constraints come from the repo: the
local-storage-security plan (`local_storage_security_hardening.plan.md` —
profile instructions and case workspace files plaintext by design; everything
else SecretStorage/encrypted) and the unified sign-in plan
(`unified_safeappeals_sign-in_225af75a.plan.md`). That plan deferred the auth
extension to "rung 6.5, one shot"; the user's new in-scope decision
**un-defers only the `safeappeals-cloud` provider** — the
google/microsoft provider-token providers and email/calendar conversion stay
deferred.

## ⚠️ Defects confirmed during verification (Jul 29 2026)

1. **PKCE is absent end-to-end, and the deployed flow accepts implicit-flow
   bearer tokens in the URL fragment.**
   - `void-cloud/api/src/routes/auth.ts` line 39: the Supabase authorize URL is
     hand-built with only `provider`, `redirect_to`, `scopes`, `apikey` — no
     `code_challenge`/`code_challenge_method`. Precision, to head off the
     objection that PKCE "is configured": `flowType: "pkce"` DOES exist at
     `void-cloud/api/src/services/supabase.ts` line 74, but it is **inert for
     this flow** — the authorize URL bypasses `supabase-js`'s
     `signInWithOAuth`, so the flag never injects a challenge.
   - `void-cloud/api/src/routes/auth.ts` line 61: exchange is
     `supabase.auth.exchangeCodeForSession(code)` on a server-shared client —
     no per-user `code_verifier` can be bound.
   - `void-cloud/api/src/routes/auth.ts` line 39: no `state` parameter — no
     CSRF binding on the callback.
   - `void-cloud/api/src/routes/auth.ts` lines 13–22: `redirect_uri` is taken
     from the query with a presence check only — **no allow-list of the API's
     own**; the sole control is Supabase's out-of-repo dashboard allowlist.
   - `void-cloud/api/src/routes/auth.ts` lines 49–119: `POST /auth/callback`
     is **unauthenticated** and returns `accessToken`, `refreshToken`, AND
     `googleProviderToken`/`googleProviderRefreshToken` to any presenter of a
     code — this leaks the user's **Google Calendar credentials**, not just a
     SafeAppeals session.
   - `void-reference/browser/voidCloudUrlHandler.ts` lines 79–116: the client
     was written to read `access_token`/`refresh_token`/`provider_token` out
     of the URI fragment — evidence the implicit-flow path **occurs in
     practice**, not theoretically. Bearer tokens transiting the OS URI
     handler are interceptable by any local app that registers the scheme.
   - Bonus defect: the reference client persists the whole session in plain
     `IStorageService` — `void-reference/browser/voidCloudService.ts` lines
     29–30 (keys) and line 353 (store call). Violates Local Data Security;
     must NOT be ported as-is.
2. **File edits are auto-approved by default.**
   `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` lines
   613–615: `ChatConfiguration.AutoApproveEdits`
   (`chat.tools.edits.autoApprove`, declared in
   `src/vs/workbench/contrib/chat/common/constants.ts` line 50) defaults to
   `{ '**/*': true, ... }` — the agent applies edits without approval for a
   legal audience.
3. **The dead `AiPreference` step writes a setting that does not exist.**
   `src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts`
   lines 1265–1271 write `chat.agent.autoFix`; a repo-wide search finds no
   registration of that key anywhere in `src/vs` — it is a silent no-op. The
   step itself never renders (`AiPreference` missing from
   `ALL_ONBOARDING_STEPS`, `common/onboardingTypes.ts` lines 65–70).
4. **The profile rule is silently never written for fresh users (HIGH — T4).**
   `_writeProfileRule()` in `onboardingVariationA.ts` (~lines 931–967) writes
   `~/.copilot/instructions/safeappeals-profile.instructions.md` without
   creating the parent directory, and the write is wrapped in a catch that
   swallows the failure (~line 927). `extensions/safeappeals-case/src/profile.ts`
   (line 66) *does* create it. So for any user who has not previously run the
   extension's `setupProfile` command — i.e. every genuinely new user, the exact
   audience this plan targets — the step's one durable output never lands and
   nothing reports it. T4 must `createDirectory` first and surface failures.
5. **The two profile-rule writers emit non-identical files (T10).** §6 asks
   for byte-compatible frontmatter so the two writers never fight; they are not
   compatible today. Frontmatter, headings, and the closing AGENTS.md-precedence
   paragraph match, but the provenance line differs — onboarding says written
   "during the Safe Appeals welcome **onboarding**"
   (`onboardingVariationA.ts:955–956`), the extension says "through the Safe
   Appeals welcome **walkthrough**" (`profile.ts:51–52`) — so running
   `setupProfile` after the wizard silently overwrites the wizard's version.

**Already fixed in the working tree (uncommitted), keep it:** the
`safeappeals.profile.*` keys were registered only in
`extensions/safeappeals-case/package.json`, so the wizard wrote settings the
extension host had not yet registered. The 35-line `configuration` block was
deleted from the extension and re-registered in
`welcomeOnboarding.contribution.ts` (lines 28–64) at
`ConfigurationScope.APPLICATION`. This is the §6 consolidation already
half-done — T10 should treat core as the owner and not re-add the block.

## Recommendation

Rebuild the wizard as a **4-step flow — Sign In (SafeAppeals Cloud) → Who You
Are → Meet Your AI Assistant → Credits & First Steps** — inside the existing
`welcomeOnboarding` contrib, backed by a new
`extensions/safeappeals-authentication` built-in that ports the void-reference
cloud auth with PKCE and SecretStorage. Personalize is cut from the mandatory
path; the dead AiPreference step is repurposed into an honest approval-mode
choice writing the real auto-approve settings; first value is delivered
credit-free via a bundled fake sample case plus the existing spotlight-tour
engine — an explicit compromise forced by the zero-credits constraint (no live
agent demo; a scripted tour and canned approval preview instead). **Key
trade-off accepted:** chat inference remains on Copilot plumbing until the
final breaking workstream (cloud LLM provider + `product.json` swap) lands, so
there is a window where sign-in is SafeAppeals Cloud but the chat stack is
Copilot-shaped — mitigated by sequencing that workstream immediately after the
auth extension and never surfacing Copilot branding in the new wizard.

## 1. Design intent (Values → Principles → Moves)

What the current flow feels like to a first-time legal user: **not Calm** — it
speaks a foreign language ("keymaps", "GHE", "pull requests", "implementation
plans", a `⌘⌃I` chord as a subtitle), breaking *the interface explains itself,
plainly and kindly*. **Not Focused** on the final step — four equally-weighted
feature cards ("Plan" / "Agent" / "Run Agents Anywhere" / "Customize Your
Agents") give the eye nowhere to land, breaking *one thing leads*. **Not
Consistent** at the product level — two surfaces (the wizard Profile step and
the safeappeals-case walkthrough's `runProfileSetup`) collect the same profile
and write the same file, breaking *sameness signals sameness* one level above
CSS. And the promise "Sign in to sync settings and **unlock AI features**" is
false under the zero-credit model — a plain-spokenness (*Calm*) failure, not a
copy bug.

Moves that restore it:

- Case vocabulary replaces developer vocabulary throughout (words-and-casing
  move). Per the design-philosophy skill's known casing conflict, **keep
  title-style capitalization** for buttons/commands — shipped, non-experimental
  UI follows the repo coding guideline.
- Final step: one leading action (Open the Sample Case); everything else
  demoted to quiet secondary links (*one thing leads*).
- The inoculation exercise is the one place **deliberately allowed to break
  Calm** — a named exception: a warning that should seize attention.
- New CSS stays on the ramps: overlay card at the **Outer** tier
  (`--vscode-cornerRadius-large`), option cards at **Control** tier, headings
  `heading2`/`semiBold`, body `body1`, spacing on the ramp, colors only from
  theme tokens (existing `variationA.css` largely complies; new step CSS must
  match).
- Motion honors both `prefers-reduced-motion` and `workbench.reduceMotion`
  (§7) — *delight earns its keep*.

## 2. Step sequence (4 mandatory steps)

Count vs the 3–5 guidance: 4. **Kept:** SignIn (rewritten), Profile (light
rewrite). **Merged:** AgentSessions + dead AiPreference → "Meet Your AI
Assistant". **New:** "Credits & First Steps". **Cut:** Personalize (theme
default `dark-2026` already applies via product.json; keymap detection is
meaningless for legal users — deferred to the post-wizard checklist and
Settings). `AiPreference` step ID deleted from `onboardingTypes.ts`;
`ONBOARDING_AI_PREFERENCE_OPTIONS` copy replaced. `getOnboardingSteps` keeps
honoring `onboardingSkipSignInStep`. All strings via `vs/nls` with `{0}`
placeholders; buttons title-style.

### Step 1 — Sign In (rewrite `_renderSignInStep`)

Purpose: identity + first trust moment. Collects: a SafeAppeals Cloud session
or an explicit skip. Writes: session → SecretStorage (via auth extension).
Defers: everything about AI.

- Hero title (keep): `"Welcome to {0}"` (nameLong).
- Subtitle (replaces false promise): `"One workspace for your entire appeal —
  documents, evidence, email, and an AI assistant that drafts while you
  review."`
- Primary CTA: **"Continue with Google"** (only cloud IdP today). Remove
  GitHub, Apple, and all GHE UI (`_renderEnterpriseInstanceForm`,
  `_renderEnterpriseSignInProgress`, `_handleEnterpriseSignIn`,
  `parseGheInstanceInput` machinery + its tests).
- Account explainer: `"A free account keeps your settings and profile in sync.
  Creating cases and editing documents never requires an account."`
- Footer skip: **"Continue Without an Account"**.
- Disclaimer replaces the four GitHub/Copilot links: `"By signing in you agree
  to the {0} Terms of Service and Privacy Policy."` →
  `https://safeappeals.com/terms`, `https://safeappeals.com/privacy`. Drop
  "public code" and Copilot-settings links.
- `_handleSignIn` stops calling `defaultAccountService.signIn` and
  `workbench.action.chat.triggerSetup`; it awaits
  `IAuthenticationService.createSession('safeappeals-cloud', [])`, waiting on
  `onDidRegisterAuthenticationProvider` if the extension host is still
  starting (mirror chat-setup's pattern), then shows the signed-in
  confirmation with the account email.
- Last-step footer nudge (`onboarding.sessions.signInNudge`, currently "Sign in
  to unlock AI features", onboardingVariationA.ts line 483) → **"Sign In to
  Sync Your Profile"**.

### Step 2 — Who You Are (kept, light rewrite)

Purpose: practice scoping before AI + role segmentation. Collects: name,
organization, role, practiceArea, jurisdiction. Writes: `safeappeals.profile.*`
(APPLICATION scope, core-registered) and
`~/.copilot/instructions/safeappeals-profile.instructions.md` (plaintext by
design per the security plan). Defers: case creation.

- Keep the two-column layout + "Why we ask" panel (recent uncommitted work).
- **Role** changes from free text to four pills (radio semantics, reuse
  `_setupRadioGroupNavigation`): `"Lawyer"`, `"Paralegal"`, `"Advocate"`,
  `"Representing Myself"`. Stored in `safeappeals.profile.role`; drives the
  role-tailored copy in step 4.
- Keep the locality hint ("stay on this computer").

### Step 3 — Meet Your AI Assistant (new; merges AgentSessions + AiPreference)

Purpose: agent mental model, approval literacy, hallucination inoculation.
Collects: approval-mode choice + mandatory acknowledgment. Writes:
`chat.tools.edits.autoApprove` (USER target) and
`safeappeals.aiLiteracy.acknowledged` boolean in `StorageScope.APPLICATION`.
Defers: rules/MCP/custom agents (never mention "rules files"; the profile
instructions file is written silently).

- Title: `"Meet Your AI Assistant"`. Subtitle: `"It works like a junior
  colleague — it drafts, you review, you decide."`
- **Data-flow disclosure panel at top** titled `"Where your information goes"`
  (exact text in §3 below) — shown before any AI framing.
- Three plain-language cards (reuse `_createFeatureCard`), one leading:
  1. `"It reads your case file"` — `"When you ask a question, the assistant
     can read the documents in your case folder to answer with your facts —
     not generic law."`
  2. `"It asks before changing anything"` — `"The assistant never edits or
     creates a document without showing you the change first. You approve or
     reject every edit."` (Made true by T6.)
  3. `"It can be wrong"` — leads into the inoculation block.
- **Inoculation block** (deliberate Calm-breaker): static canned example of a
  fabricated citation. Exact user-facing strings:
  - Citation: *"Dowell v. Ridgeline Freight Systems Inc., 212 Work. Comp.
    App. Rep. 4th 519 (2018)"*
  - Caption: `"This case does not exist — and neither does the reporter it
    claims to come from. The AI assembled it from real-looking pieces; this
    is called a hallucination, and lawyers have been sanctioned for filing
    citations like it."`
  **Construction rule — do not "improve" this example (implementers read
  this):** the example must be unresolvable *by construction*. Both parties
  are fictitious AND the reporter series ("Work. Comp. App. Rep. 4th") does
  not exist, so a lookup fails at the name level and at the address level —
  no page of a nonexistent book can hold a real case. Never substitute a real
  reporter (Cal.App.5th, D.L.R., O.R., a CanLII number, etc.): real
  volume/page coordinates may collide with an actual case, which would
  discredit the single most important lesson in onboarding and assert a
  falsehood to lawyers inside a legal product. The shape stays
  Bluebook-plausible (parties, volume, series, page, year) so it teaches;
  the caption does the debunking. The citation deliberately names **no
  jurisdiction** — it must read plausibly to BC WCB, Ontario WSIB,
  California DWC, and US VA-benefits users alike, unlike the
  California-specific example it replaces.
  Below it, a checkbox gating
  Continue: `"I understand the assistant can cite cases and facts that do not
  exist. I will verify citations against a primary source before relying on
  them."` Keyboard-operable, no timing (WCAG 2.2.1). Rationale: awareness
  alone demonstrably fails (Thomson Reuters-documented cases of lawyers who
  knew and still filed fabrications); a forcing function creates a checkpoint.
  Honest limitation: one-time, not per-output — see §4.5.
- **Approval-mode choice** (repurposed AiPreference UI, two options). Both
  options write the **full default-shaped object** for
  `chat.tools.edits.autoApprove` — every deny key from the registered default
  (`**/.vscode/*.json`, `**/.git/**`, the package/project-file globs, lock
  files) copied verbatim — with **only the `'**/*'` key varied**. Never write
  a bare single-key object; see §4.1a for the verified merge semantics and
  why full-object is still required.
  - `"Review Every Change"` (default, marked *Recommended*) — `"The assistant
    shows each edit and waits for your approval."` → full object with
    `'**/*': false`.
  - `"Apply Routine Edits Automatically"` — `"The assistant applies small
    edits on its own; you can still undo. You can change this anytime in
    Settings."` → full object with `'**/*': true`; deny-list protections are
    never dropped.
- One quiet doc link replaces the VS Code tutorial URL: `"Learn more about the
  AI assistant"` → `https://safeappeals.com/docs/ai-assistant`.

### Step 4 — Credits & First Steps (new; honest handoff)

Purpose: the credits conversation + a concrete zero-cost first action.
Collects: nothing. Writes: nothing (completion flag on finish). Defers:
purchase (link out only).

- Title: `"What's Free, and What Isn't"`.
- Credits copy (matches the established cloud voice):
  - `"{0} is free to download and use. Organizing cases, editing documents,
    tracking time, email, and calendar never cost anything."`
  - `"AI drafting and research run on credits. Your account starts with zero
    credits — nothing runs, and nothing is charged, until you choose to buy a
    pack. There is no subscription."`
  - If signed in, live balance via `GET /credits/balance`: `"Your balance: {0}
    credits"`.
  - Links: **"View Pricing"** → `https://safeappeals.com/#pricing`; quiet link
    `"How credits work"` → `https://safeappeals.com/docs/credits`.
- First-action block, role-tailored heading from step 2 (e.g. lawyers: `"Try
  it on a sample matter — no credits needed"`). Primary: **"Open the Sample
  Case"** (T12: bundled fake case + spotlight tour showing the case-files
  list, where Chat opens, and a static mock of an approval prompt).
  Secondary: **"Start with My Own Case"** (`safeappeals-case.initCase`).
  Final: **"Get Started"** closes the wizard and opens the checklist (T10).
- **Compromise flag:** research rec 1 (live guided agent-edit in ≤10 min) is
  NOT achievable with zero credits. Sample case + scripted spotlight tour +
  static approval mock is the honest substitute; the first real agent run is
  the user's first credit spend, and step 4 says so plainly.

## 3. Credits / trust / ethics disclosure

Two touchpoints: (a) step 3 carries the AI-behavior half (approval,
hallucination); (b) the data-flow disclosure panel at the top of step 3 —
the ABA Op. 512 / Florida Bar 24-1-aligned moment, before any client-like data
could leave the machine. Exact text:

> "Your case files stay on this computer. When you ask the AI assistant a
> question, the text you send — and any documents you attach — go to
> SafeAppeals Cloud to generate the answer, then to the AI model provider.
> Your prompts and documents are used only to generate your answer and are
> handled under the model provider's retention policy. You remain
> responsible for reviewing everything the assistant produces: its output is
> a drafting aid, not legal advice and not a court-ready filing. Read our
> Privacy Policy for details."

Plus a quiet link `"Client-consent guidance for your practice"` → content on
`safeappeals.com/docs/ai-assistant` (cloud-side content task in T0). A Help
menu command `"How {0} Uses AI"` (T11) makes the disclosure re-findable.

**Hard rule (not a fallback):** the softened wording above is what ships by
default. The absolute sentence "Your prompts and documents are not used to
train AI models" may be substituted **only after** it has been verified
against the actual LiteLLM upstream providers' terms, with the verification
recorded in this plan's deviations section. Rationale: this is a factual
representation about confidentiality made to lawyers who will rely on it for
client data — an unverified absolute claim there is a liability, not a copy
nit. Verifying the provider terms is tracked as a standing task, not an open
question.

Post-wizard handoff given zero credits: sample case + tour (T12), the
re-pointed getting-started checklist (T10), the watermark rewrite (T11). No
surface anywhere says signing in unlocks AI.

## 4. Hallucination inoculation and approval defaults — mechanism

1. **Flip the fork default** (T6): in
   `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` (~613),
   change the `AutoApproveEdits` default `'**/*': true` → `false`, keeping
   every other (deny) key untouched. Guarantees approve-before-write for
   every user including onboarding skippers. Deliberate upstream deviation;
   mark with `// SafeAppeals:` comment; add a unit test pinning the default
   (see Risks — this line is a recurring upstream-merge conflict surface).
   `chat.tools.global.autoApprove` already defaults `false` — leave it.

   **1a. Merge semantics of the user value — verified, with one residual
   unknown.** Does a user value for this object-typed setting merge with the
   registered default or replace it wholesale? Verified on the core path: the
   effective value comes from
   `Configuration.getWorkspaceConsolidatedConfiguration()`, which merges the
   **default model** with application/user/workspace models
   (`src/vs/platform/configuration/common/configurationModels.ts` line 1024,
   `this._defaultConfiguration.merge(...)`), and `ConfigurationModel.merge` →
   `mergeContents` (same file, lines 219–228) **deep-merges key-wise when both
   sides are objects**. So a user value `{ '**/*': true }` overwrites only the
   `'**/*'` key inside the default object; the deny keys survive, and because
   the key is overwritten in place it keeps its first position, so the later
   deny patterns still win under the setting's documented "last matching
   pattern wins" rule (`chat.shared.contribution.ts` line 625). Extension-host
   reads (`vscode.workspace.getConfiguration().get()`) go through this same
   `Configuration` class. **Residual unknown:** nothing in `src/` consumes
   `chat.tools.edits.autoApprove` (repo-wide search finds only the enum in
   `constants.ts` line 50 and the registration) — the actual consumer is the
   closed-source `GitHub.copilot-chat` extension. If it reads per-scope via
   `inspect()` and merges manually, a bare single-key user value could drop
   the denylist; its source cannot be read to rule that out. **Therefore both
   wizard options write the full default-shaped object with only `'**/*'`
   varied** — correctness no longer depends on the consumer's read path, and
   the explicit object also pins the user's choice against future default
   drift (e.g. an upstream merge reverting T6). Coder verify-first test
   (mandatory in T5): in a dev build with user settings containing only
   `{ "**/*": true }` for this setting, ask the agent to edit a `.env` file
   and confirm the approval prompt still appears; then repeat with the
   full-object write and confirm identical behavior.

   **1b. T6 interaction:** after T6 the registered default already has
   `'**/*': false`, so the "Review Every Change" write is technically
   redundant with the default. Keep the explicit write anyway — it is cheap,
   self-documenting, and preserves the user's chosen mode if an upstream
   merge ever regresses the T6 default.
2. **Delete the no-op:** `_applyAiPreference` writing `chat.agent.autoFix`
   (onboardingVariationA.ts 1262–1274) removed with the step; new step 3
   writes the full-object `ChatConfiguration.AutoApproveEdits` value (§4.1a)
   via `IConfigurationService.updateValue(..., ConfigurationTarget.USER)`.
3. **One-time forcing function:** checkbox gating Continue in step 3;
   persists `safeappeals.aiLiteracy.acknowledged`
   (`StorageScope.APPLICATION`/`StorageTarget.USER`).
4. **Standing instruction** appended in `_writeProfileRule`: instruct the
   agent to flag every legal citation it produces as *unverified* and tell
   the user to confirm it in a primary source. Cheap, model-compliance-bound,
   but operationalizes uncertainty expression (the intervention Microsoft's
   2024 synthesis found outperforms static warnings).
5. **Per-output citation forcing function — explicitly deferred.** A real
   "acknowledge before copy/export of citation blocks" gate means new
   chat-response rendering in
   `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/` (citation
   detection + a confirmation sub-part like the terminal one). Top follow-up,
   not part of this plan.

## 5. SafeAppeals Cloud sign-in swap

**Home: `extensions/safeappeals-authentication`** (reaffirms the rung-6.5
plan's decision; not re-litigated). Vs a core
`src/vs/workbench/contrib/safeappealsCloud/` service: the extension gets the
Accounts-menu UI, session consent, `getSession()` plumbing, and
`context.secrets` for free via `contributes.authentication`, and is what
email/calendar conversions will consume later. The cost — onboarding (core)
must await extension-host provider registration — is a solved pattern
(`IAuthenticationService.onDidRegisterAuthenticationProvider`, used by chat
setup). Scope: **only the `safeappeals-cloud` provider**; the
google/microsoft provider-token providers stay deferred.

**Auth flow** — reuse the deployed `safe-appeals-navigator://auth/callback`
private-use scheme (manager's correction adopted), with the defect fixes:

- `signIn()`: generate `code_verifier` (crypto-random, 43–128 chars) and
  `state`; open the **system browser** (`vscode.env.openExternal`) at
  `{apiUrl}/auth/google?redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...`.
  RFC 8252-compliant; never a webview.
- Callback: `vscode.window.registerUriHandler` (extension-level, `onUri`
  activation — do NOT port the core `IURLService` handler class). Verify
  `state`, extract `code`, `POST /auth/callback` with `{ code,
  code_verifier }`. **Reject any fragment tokens.**
- **SecretStorage:** session (accessToken, refreshToken, user,
  googleProviderToken*) as one JSON envelope under a single `context.secrets`
  key. Credit balance in memory only. Nothing session-related ever touches
  `globalState` or settings.
- `contributes.authentication: [{ id: 'safeappeals-cloud', label:
  'SafeAppeals Cloud' }]`; implement AuthenticationProvider
  (getSessions/createSession/removeSession + change event). Port refresh
  logic (timer + 401 retry) minus console.logs and IMetricsService (output
  channel instead).
- Fallbacks: keep the dev paste command and **promote it to a production
  fallback**, surfaced automatically if no callback arrives within ~2 minutes
  ("Didn't get redirected back? Paste the code from your browser"). Answers
  the broken-OS-URI-handler case without a loopback rewrite.
- Commands for onboarding step 4: `safeappeals.cloud.getBalance`,
  `safeappeals.cloud.openCheckout` (wraps /credits/packs + /credits/checkout
  → openExternal).
- Build wiring: `build/gulpfile.extensions.ts`, `build/npm/dirs.ts`;
  `product.json` `trustedExtensionAuthAccess` for safeappeals-case/-email/
  -calendar against `safeappeals-cloud`.

**Cloud-side work (T0 — the entry point of the whole effort, done first as a
standalone security fix; `void-cloud/` is a separate, gitignored git
repository, so T0 can never share a commit or PR with desktop work. The
authoritative subtask breakdown and acceptance criteria live in §9 Phase 0;
the list below is the summary):**

- `GET /auth/google` accepts and forwards `code_challenge` +
  `code_challenge_method=S256` (Supabase PKCE flow) plus client `state`.
- `POST /auth/callback` (and `/exchange`) accepts `{ code, code_verifier }`
  and exchanges via Supabase's token endpoint (`grant_type=pkce`) instead of
  the shared-client `exchangeCodeForSession`.
- Disable the implicit flow (project flow type = PKCE) so tokens never appear
  in fragments.
- Exact-match redirect-URI allow-list in the API itself:
  `safe-appeals-navigator://auth/callback` + the dev-callback URL only.
- While in there: fix `docs/SafeAppealsCloud/configuration.md` pricing
  (1.4M/$60 vs live 2M/$65) before onboarding links `/docs/credits`; note
  `void_user_id` Stripe metadata rename as tech debt (non-blocking); add the
  "How SafeAppeals uses AI" / client-consent docs content; consider making
  the Calendar scopes incremental so sign-in consent isn't alarming.

**Copilot plumbing (`defaultChatAgent` / `chatSetupRunner` /
`GitHub.copilot-chat`) — phased:**

- *Phase 1 (with the wizard):* onboarding stops invoking
  `defaultAccountService.signIn` and `workbench.action.chat.triggerSetup`.
  Copilot stays installed so chat doesn't regress. Cosmetic inconsistency
  accepted and time-boxed.
- *Phase 2 (T13):* register a language-model chat provider backed by
  `POST /llm/chat` / `GET /llm/models` (port `sendCloudRequest`; reference is
  non-streaming — `stream: false // TODO` — land server SSE first or ship
  non-streaming and flag the UX cost). Zero-balance requests surface "You're
  out of credits — View Pricing" with the checkout link, never a sign-in
  prompt.
- *Phase 3 (T14, breaking):* `product.json` — remove `GitHub.copilot-chat`
  from `builtInExtensionsEnabledWithAutoUpdates`, trim/replace
  `defaultChatAgent`. Risk: `chatEntitlementService` and `chatSetupRunner`
  ("Sign in to use GitHub Copilot", chatSetupRunner.ts 303–304) are built
  around `defaultChatAgent`; the `sentiment.hidden` gate in
  `startupPage.tryShowOnboarding` (line 249) may misbehave when it's gone.
  Dedicated verification pass. Until then, guard `chatSetupRunner`'s trigger
  behind an active `safeappeals-cloud` session check (small core patch,
  marked temporary).

## 6. Consolidation of competing surfaces

- **Duplicate profile UX:** single source of truth = `safeappeals.profile.*`
  settings. `extensions/safeappeals-case/src/profile.ts` `runProfileSetup()`
  prefills from those settings and remains the canonical post-onboarding
  editor; its instructions-file writer stays (verify byte-compatible
  frontmatter with `_writeProfileRule` so the two writers never fight).
  Walkthrough step 1 gets
  `completionEvents: ["onSettingChanged:safeappeals.profile.name"]`
  (verify this fires for APPLICATION-scope settings; else `onCommand:`).
- **Walkthrough → post-wizard checklist:** rework `safeappealsCaseSetup` in
  `extensions/safeappeals-case/package.json` into 5–7 outcome items: Review
  your profile ✓ / Open the sample case / Take the tour / Read "How
  SafeAppeals uses AI" / Add credits / Create your first case / Connect email
  & calendar. Step 4's "Get Started" opens it. Existing
  `workbench.action.restartWelcomeWalkthrough` stays as the replay
  affordance.
- **Watermark:** `editorGroupWatermark.ts` — replace developer shortcuts with
  case-language entries (Show Chat, New Case, Open Case Folder, Take the
  Tour). `// SafeAppeals:` marked.
- **Tutorial URL:** the `code.visualstudio.com/docs/copilot/agents/...` link
  dies with the old AgentSessions step; step 3 links
  `safeappeals.com/docs/ai-assistant`.
- **Copilot walkthrough (`copilotWelcome`):** hide via product walkthrough
  suppression if available; else it disappears with T14. Interim: it is not
  auto-opened for new users anyway (featured auto-open suppressed when
  experimental onboarding is on, gettingStarted.ts ~1015).
- **Sessions TOS dialog** (`sessionsSetUpService.ts` 345–372): reword "Your
  AI-powered coding experience" to legal-workspace language.
- **Classic welcome page:** keep as the overlay backdrop (default
  `workbench.startupEditor` unchanged); its featured walkthrough becomes the
  checklist. Release notes: leave alone.
- **Esc-kills-onboarding fix (T8):** `startupPage.ts` stores the seen-flag
  only for explicit complete/skip; Esc/overlay dismissal stores an attempt
  counter (cap 2). Requires `onDidDismiss` to carry the reason; also add the
  missing `onDidComplete`/`isShowing` members to `IOnboardingService`
  (`common/onboardingService.ts`).

## 7. Accessibility + localization

- **`workbench.reduceMotion` gap:** only the CSS media query is honored
  (`variationA.css` line 1124). Fix: in `show()`, read
  `IAccessibilityService.isMotionReduced()` and toggle a `reduce-motion`
  class on the overlay root; duplicate the reduced-motion rules under
  `.onboarding-a-overlay.reduce-motion`; re-evaluate on the service's change
  event (disposable-registered).
- **WCAG 2.2 §2.4.11 Focus Not Obscured:** wizard is a single dialog (no
  nested modal+tour — good). ~~Sticky header (brand mark) and footer
  (buttons/progress dots) must never cover a focused control:
  `scroll-padding-top/bottom` on the step scroll container equal to
  header/footer heights.~~ **Corrected Jul 30 on implementation — the header
  and footer are not sticky.** `.onboarding-a-card` is a flex column with
  `overflow: hidden`, and the header, scroller (`flex: 1`) and footer are
  ordinary flex siblings, so the scroll area can never pass beneath the
  chrome and §2.4.11 is satisfied structurally. The shipped
  `scroll-padding-block` is a small comfort margin only, deliberately not a
  chrome measurement. Do not "fix" it to match header/footer heights. The
  step-4 spotlight tour runs after the dialog closes — no overlay stacking.
- **Focus lifecycle:** trap + `aria-modal` exist; verify focus restores to
  the invoker on dismiss (observable via the restart command) and add if
  missing. New checkbox/pills join `_registerStepFocusable` /
  `_setupRadioGroupNavigation`. Keep `aria-live` on async sign-in progress.
- **No timing dependence:** inoculation gate is a checkbox (2.2.1 ✓).
- **Localization:** all new wizard copy through `vs/nls` (contrib already
  compliant). The hard-coded English markdown in
  `extensions/safeappeals-case/media/walkthrough/` cannot use
  `package.nls.json`; restructure so titles/descriptions live in
  `package.nls.json` and markdown bodies shrink to media, with
  locale-suffixed markdown as the (deferred) translation path. Product ships
  English-only today; this keeps the door open.

## 8. Web / code-server

**Keep the `isWeb` early-return** (`startupPage.ts` 241–243); do not make
onboarding work on web in this effort. Rendering would mostly work (contrib is
browser-layer; the uncommitted IProductService work respects web-embedder
overrides), but sign-in needs a different callback transport
(`vscode.env.asExternalUri` + web callback route instead of the private-use
scheme), the extension URI handler needs web verification, and the paste
fallback becomes primary — a full extra test matrix for an audience with no
demonstrated demand. Cost if done: roughly the auth-extension workstream
again. Leave a `// SafeAppeals: web onboarding intentionally disabled — see
plan` comment at the early return.

## 9. Ordered implementation steps

**Phase 0 — T0, the entry point (separate git repository `void-cloud/`,
gitignored by this repo — never the same commit or PR as desktop work):**

**Decision (user, Jul 29 2026):** T0 is done **first, standalone, before any
desktop auth code** — it is a security fix on its own merits (the deployed
flow leaks Google provider tokens to any presenter of a code and permits
fragment-token delivery), irrespective of the onboarding work. It is a hard
blocker for T1, not merely a testability gap: T1's client is specified to
reject fragment tokens, and until T0.4 disables the implicit flow, fragment
tokens are what Supabase returns — so T1 built first would fail closed with
no working sign-in path at all.

- **T0.1 — PKCE, end to end.** `void-cloud/api/src/routes/auth.ts` line 39
  hand-builds the authorize URL with no `code_challenge`; the
  `flowType: "pkce"` option at `void-cloud/api/src/services/supabase.ts`
  line 74 is **inert for this flow** because the URL bypasses `supabase-js`'s
  `signInWithOAuth`. Change: `/auth/google` accepts and forwards
  `code_challenge` + `code_challenge_method=S256`; `/auth/callback` and
  `/exchange` accept `{ code, code_verifier }` and exchange via Supabase's
  token endpoint (`grant_type=pkce`). *Acceptance:* exchange with a missing
  or wrong verifier → 401; with the matching verifier → 200 session.
- **T0.2 — redirect-URI allow-list in the API.**
  `void-cloud/api/src/routes/auth.ts` lines 13–22 accept `redirect_uri` with
  a presence check only; the sole control today is Supabase's out-of-repo
  dashboard allowlist. Change: exact-match allowlist
  (`safe-appeals-navigator://auth/callback` + the dev-callback URL).
  *Acceptance:* any other URI → 400 before any redirect is issued.
- **T0.3 — `state` CSRF binding.** `auth.ts` line 39 sends no `state`.
  Change: pass the client's `state` through the authorize redirect
  unmodified. *Acceptance:* `state` round-trips byte-identical to the
  callback; the desktop client (T1) rejects mismatches.
- **T0.4 — disable the implicit flow.** Evidence it occurs in practice, not
  theoretically: the shipped client reads
  `access_token`/`refresh_token`/`provider_token` out of the URI fragment
  (`void-reference/browser/voidCloudUrlHandler.ts` lines 79–116). Change:
  Supabase project auth set so authorize never returns tokens in a fragment;
  only a code is ever delivered. *Acceptance:* completing sign-in yields a
  callback with `?code=` and an empty fragment.
- **T0.5 — close the unauthenticated callback leak.**
  `void-cloud/api/src/routes/auth.ts` lines 49–119: `POST /auth/callback`
  returns `accessToken`, `refreshToken`, **and
  `googleProviderToken`/`googleProviderRefreshToken`** to any presenter of a
  code — leaking the user's **Google Calendar credentials**, not just a
  SafeAppeals session. T0.1's verifier requirement is the fix (a stolen code
  is useless without the verifier). *Acceptance:* replaying a captured code
  without the verifier returns 401 and no tokens of any kind.
- **T0.6 — content + regression.** Fix
  `docs/SafeAppealsCloud/configuration.md` pricing (1.4M/$60 vs live 2M/$65)
  before onboarding links `/docs/credits`; add the "How SafeAppeals uses AI"
  / client-consent docs content; consider incremental Calendar scopes.
  *Acceptance:* dashboard web login (its own supabase-js flow, untouched by
  T0.1–T0.5) still works — explicit regression test.

**Phase A — incremental, non-breaking (T2, T4, T6, T8–T12 can start
immediately and in parallel; T1 requires T0; T3/T5/T7 follow their listed
deps):**

- **T1 — auth extension.** Files: new `extensions/safeappeals-authentication/`
  (package.json, src/extension.ts, src/cloudAuthProvider.ts, src/pkce.ts,
  src/uriHandler.ts, src/api.ts), `build/gulpfile.extensions.ts`,
  `build/npm/dirs.ts`, `product.json` (trustedExtensionAuthAccess). Deps:
  **T0 — hard blocker, not a testing convenience.** T1 rejects fragment
  tokens by specification, and until T0.4 lands, fragment tokens are what
  the deployed flow returns — so against today's server T1 fails closed
  with no sign-in path (an earlier draft of this plan called T0 "additive";
  that was wrong). T0 also lives in a separate gitignored repository, so it
  ships as its own piece of work beforehand.
  *Acceptance (against the T0-updated API):* Accounts menu shows "SafeAppeals
  Cloud"; Electron sign-in round-trips with PKCE + state verified; grep
  proves no token in globalState/settings;
  `bun run gulp compile-extensions` clean.
- **T2 — step types + service interface.** Files:
  `common/onboardingTypes.ts` (delete AiPreference + GHE machinery; add
  `AgentIntro`, `CreditsHandoff`; titles/subtitles; order),
  `common/onboardingService.ts` (add onDidComplete/isShowing; dismiss
  reason), `test/common/onboardingTypes.test.ts` (GHE tests removed,
  step-order snapshot added). Deps: none. *Acceptance:*
  `bun run typecheck-client` clean; `scripts/test.sh --grep onboarding`
  passes.
- **T3 — sign-in step rewrite.** Files: `browser/onboardingVariationA.ts`,
  `browser/media/variationA.css`. Deps: T1, T2. *Acceptance:* Google-only
  CTA; sign-in via IAuthenticationService with provider-registration wait;
  no GitHub/Copilot strings remain in the wizard; skip path works.
- **T4 — profile step tweaks.** Files: `browser/onboardingVariationA.ts`
  (role pills, `_writeProfileRule` standing instruction). Deps: T2.
  *Acceptance:* role persisted to `safeappeals.profile.role`; instructions
  file contains the unverified-citation paragraph.
  **Scope added Jul 30 (user request): structured location, and the jurisdiction
  field gets an honest label.** The profile step gains **Country**,
  **State / Province**, and **City** so the agent knows which body of law,
  appeals board, and local rules to work from instead of inferring it from one
  abbreviation.

  **Read this before touching the field: `UserProfile.jurisdiction` is the
  compensation board, not the province.** Its placeholder is
  `"e.g. BC WCB, Ontario WSIB, California DWC"` and it is backed by the
  `JURISDICTIONS` list and `pickJurisdiction()`. It is load-bearing in three
  places — `caseFiles.ts` prefills each new case's board from it,
  `skills/case-setup/SKILL.md` has the agent propose it when interviewing for a
  new case, and `sampleCase.ts` uses `'BC WCB'`. An initial review of this
  request wrongly assumed the field meant "province" and called for deleting it;
  that would have silently broken the new-case default. The actual defect is the
  **label**: it reads "Jurisdiction", which is why a real user typed `BC` (a
  province) into a field that wanted a board.

  Decisions taken:
  - **Keep the field, relabel it "Compensation Board / Tribunal"**, and render
    it as a dropdown over the existing `JURISDICTIONS` list, filtered by the
    selected province. Keep the setting key `safeappeals.profile.jurisdiction`
    unchanged so `caseFiles.ts` and the case-setup skill keep working with no
    migration. If no board matches the chosen province, fall back to the full
    list rather than showing an empty dropdown.
  - **Country and State/Province are dropdowns; City is free text.** The point
    of the change is values the agent can rely on, so `BC`, `B.C.`, and
    `British Columbia` must not be three spellings of one province. Ship
    province/state lists for at least Canada and the US, fall back to a
    free-text input for countries without a list, and keep every field optional
    like the existing ones.
  - **All `safeappeals.profile.*` settings move to `"scope": "machine"`.** They
    are `APPLICATION`-scoped today, so Settings Sync can upload them; adding a
    practice city makes that worse and contradicts the step's own "stays on this
    computer" copy.
  - Both profile-rule writers must be updated **together** and stay
    byte-identical: core's `_writeProfileRule` in `onboardingVariationA.ts` and
    the extension's `renderProfileRule` in `src/profile.ts`. They have **already
    drifted** — the extension emits the unverified-citation paragraph and core
    does not — so fix that drift in the same change.
  - **Fix the clear-all bug while here.** `_saveProfile()` returns early when no
    field has content, so clearing every field writes nothing and leaves stale
    settings plus a stale instructions file on disk. The step promises
    "change or clear it anytime", so clearing must actually clear.
- **T5 — "Meet Your AI Assistant" step.** Files:
  `browser/onboardingVariationA.ts`, `variationA.css`. Deps: T2, T6.
  *Acceptance:* Continue disabled until acknowledgment checked; approval
  choice writes the **full default-shaped** `chat.tools.edits.autoApprove`
  object with only `'**/*'` varied (§4.1a), including the mandatory
  verify-first test there (agent edit to `.env` still prompts under both
  values); telemetry `trustAccepted`/`approvalChoice` via `_logAction`.
- **T6 — approval default flip.** Files:
  `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts`
  (~613). Deps: none. Own PR — behavioral. *Acceptance:* default `'**/*'`
  is `false`; any tests asserting the old default updated.
- **T7 — "Credits & First Steps" step.** Files:
  `browser/onboardingVariationA.ts`, `variationA.css`. Deps: T1, T2 (buttons
  wire to T10/T12 when those land). *Acceptance:* balance shown when signed
  in, graceful when not; pricing/docs links open externally; role-tailored
  heading renders.
- **T8 — dismissal semantics.** Files:
  `welcomeGettingStarted/browser/startupPage.ts`,
  `common/onboardingService.ts`, `browser/onboardingVariationA.ts`. Deps:
  T2. *Acceptance:* Esc once → wizard reappears next launch; explicit skip
  or completion → never reappears; counter caps at 2.
- **T9 — accessibility pass.** Files: `onboardingVariationA.ts`,
  `variationA.css`. Deps: T3–T7. *Acceptance:* reduce-motion class follows
  the setting; keyboard-only completion of all 4 steps; focused controls
  never under sticky chrome; focus restored on dismiss.
- **T10 — safeappeals-case consolidation.** Files:
  `extensions/safeappeals-case/package.json`, `package.nls.json`,
  `src/profile.ts`, `media/walkthrough/*`. Deps: independent (step-4 button
  wiring in T7). *Acceptance:* walkthrough is the 5–7-item checklist;
  profile step self-completes for wizard users; profile quickpick prefills
  from settings; `bun run gulp compile-extensions` clean.
- **T11 — core consolidation.** Files:
  `browser/parts/editor/editorGroupWatermark.ts` (path per current tree),
  `src/vs/sessions/.../sessionsSetUpService.ts` (345–372), new Help command
  in `welcomeOnboarding.contribution.ts`. Deps: none. *Acceptance:*
  watermark shows case-language entries; TOS dialog has no "coding" copy;
  Help menu opens the AI-use page.
- **T12 — sample case + tour.** Files: `extensions/safeappeals-case`
  (bundled fake matter + `openSampleCase` command), spotlight scenario
  registration against `src/vs/workbench/contrib/onboarding/`. Deps: none.
  **Verify first** that scenario registration is possible from
  `vs/workbench` (existing scenarios live under `vs/sessions`, which may
  import workbench but not vice versa). *Acceptance:* sample case opens
  from step 4; tour highlights files list, chat entry, approval mock; all
  sample data clearly fake.

**Phase B — breaking (strictly ordered, after Phase A ships):**

- **T13 — cloud LLM provider.** Files: within
  `extensions/safeappeals-authentication` (or sibling module): port
  `sendCloudRequest`, register chat model provider from `GET /llm/models`,
  zero-credit error UX. Deps: T1; server SSE strongly preferred.
  *Acceptance:* chat completes a round-trip on cloud credits; zero-balance
  error links checkout, never sign-in.
- **T14 — product.json swap (BREAKING).** Files: `product.json`,
  `chatSetupRunner.ts` guard, entitlement regression pass. Deps: T13.
  *Acceptance:* no Copilot sign-in surfaces anywhere; onboarding trigger
  gate (`sentiment.hidden`, startupPage.ts 249) still behaves for new
  installs; chat functional on the cloud provider.

**Verifier gates** (per AGENTS.md; prefer `bun run`, `npm` only for
`npm install`): `bun run typecheck-client` for every `src/` task;
`bun run gulp compile-extensions` for T1/T10/T12/T13;
`bun run valid-layers-check` for T2/T3/T5/T12;
`scripts/test.sh --grep onboarding` plus chat-configuration suites touched by
T6. Never run tests before compilation is clean.

## 10. Risks, open questions, non-goals

**Risks**

- *chatEntitlementService coupling (highest):* the onboarding trigger gate and
  chat setup are Copilot-entitlement-shaped; T14 can break the wizard trigger
  itself. Mitigation: T14 isolated, last, with the gate regression test.
- *Supabase PKCE specifics:* the server-side PKCE exchange through a proxying
  API needs validation against the deployed Supabase version — T0 starts with
  a spike. (Verified what the code does, not what Supabase permits.)
- *T6 edits an upstream-shared default* (`chat.shared.contribution.ts`), so it
  is a **recurring merge-conflict surface** for the
  `upstream_vs_code_merge_spike` work: any upstream merge touching the chat
  settings block can silently revert the flip. Mitigations: the
  `// SafeAppeals:` marker comment (already planned), a unit test pinning the
  default's `'**/*'` to `false`, and the wizard's full-object write (§4.1a),
  which preserves already-onboarded users' choices even if the default
  regresses.
- *Google-only sign-in* excludes lawyers without Google accounts; unconditional
  Calendar scopes at sign-in will alarm privacy-conscious users (T0 should
  make them incremental). Google restricted-scope verification (100-user cap)
  remains a live business risk from the rung-6.5 plan.
- *Non-streaming `/llm/chat`* makes first real agent use feel broken; land SSE
  with or before T13 if at all possible.
- *Assumed-but-unverified:* `onSettingChanged` walkthrough completion for
  APPLICATION-scope settings (T10); spotlight-scenario registration from
  `vs/workbench` (T12). Both called out as verify-first.
- *One-time inoculation decays;* the per-output citation gate (§4.5) is the
  real control and is deliberately out of scope.

**Open questions (blocking only)**

1. Add email/password (Supabase native) as a second sign-in method for
   non-Google users? Assumption made: ship Google-only now.

(The former Q1 — whether the no-training/ZDR claim can be asserted — is no
longer an open question: §3 records it as a hard rule. The softened retention
wording ships by default; the absolute "not used to train AI models" sentence
may be used only once verified against the actual LiteLLM upstream provider
terms, with the verification recorded in the deviations section.)

**Non-goals**

- Web/code-server onboarding (§8).
- Per-output citation forcing function (§4.5).
- Hiding Terminal/Source Control/Extensions and renaming Explorer (a
  workbench-layout project of its own; nothing here depends on it).
- Microsoft/Google provider-token auth providers and email/calendar
  conversion (remain rung 6.5).
- Activation-funnel analytics beyond existing `_logAction` events.
- Any encryption change to the plaintext-by-design profile-instructions/case
  files (settled prior decision, unchanged).

## Implementation deviations from this plan

**Jul 29 2026 — T2 landed. Names and interim state for T3–T9.**

Step IDs and order as shipped: `onboarding.signIn` → `onboarding.profile` →
`onboarding.agentIntro` → `onboarding.creditsHandoff`.
`getOnboardingSteps` still honours `onboardingSkipSignInStep`.

`IOnboardingService` surface for T8:

```typescript
export type OnboardingDismissReason = 'complete' | 'skip' | 'dismiss';
readonly onDidDismiss: Event<OnboardingDismissReason>;
readonly onDidComplete: Event<void>;
readonly isShowing: boolean;
```

`onDidDismiss` now carries a reason: Esc/overlay → `'dismiss'`, close →
`'skip'`, finish → `'complete'`. **T5 must import the renamed options** —
`ONBOARDING_AI_PREFERENCE_OPTIONS` is now `ONBOARDING_APPROVAL_MODE_OPTIONS`
with an `ApprovalMode` type. `Personalize` and `AgentSessions` enum members
were deleted outright (not merely dropped from the array) to keep switches
exhaustive, so restoring either means restoring the enum member too.

**Interim state in `onboardingVariationA.ts` — the wizard is not
user-verifiable until T5 and T7 land.** `AgentIntro` temporarily renders the
old AgentSessions body (developer-facing copy, wrong for this audience) and
`CreditsHandoff` renders nothing. Both are marked in-file.

**Gap to close in T3:** the GHE tests were deleted with T2's test rewrite, but
the GHE parse helpers are still live (inlined locally in
`onboardingVariationA.ts`). That code is therefore live-but-untested until T3
deletes the enterprise sign-in UI — T3 must not skip the helper deletion.

**Rejected on review:** T2 initially added two calls whose only purpose was to
satisfy `noUnusedLocals` — a no-op `accessibilityService.isMotionReduced()` in
`show()` and `_setupRadioGroupNavigation([], 0)` in the `AgentIntro` case.
Both were removed; the unused service injection and helper are deleted
instead, and **T9 re-injects `IAccessibilityService`** while **T4 restores
`_setupRadioGroupNavigation` from git history** when each actually needs it.
House rule reaffirmed: do not write code to appease the compiler and label it
temporary.

**Jul 29 2026 — T0 landed (void-cloud, uncommitted). Three consequences for
later tasks.**

1. **`GET /auth/google` is now a BREAKING change** — it requires
   `code_challenge`, `code_challenge_method=S256`, and `state`, and
   `/auth/callback` + `/exchange` require `code_verifier`. Any client built
   before T1 cannot sign in once this deploys. Acceptable because the auth
   extension does not exist yet and the dashboard uses its own
   `signInWithOAuth` path (covered by a regression test), but **deploying T0
   without T1 leaves the desktop app with no working sign-in** — they must
   land together in time even though they are separate repositories.
2. **Calendar scopes are now opt-in**, not requested at sign-in: pass
   `include_calendar_scopes=true`. This resolves the plan's "consider making
   the Calendar scopes incremental" item in the user's favour, and it becomes a
   **requirement on rung 6.5** — the calendar extension's `getSession()`
   conversion must request that flag or it will hold a session with no
   Calendar authority. Also recorded against
   `unified_safeappeals_sign-in_225af75a.plan.md`.
3. **T0.4 is a NON-ISSUE — there is no such setting, and T1 is NOT blocked.
   Verified in the live dashboard, Jul 29 2026.** The plan's instruction to
   "disable the implicit flow" via a Supabase project setting was based on a
   setting that does not exist. Evidence:
   - Every page under Authentication was inspected on project
     `totnbmqhkonnqgqhimsy` (org Simpleflowworks, project SafeAppeals, branch
     main/Production): Users, OAuth Apps, Emails, Policies, Sign In/Providers,
     Passkeys, OAuth Server, Sessions, Rate Limits, Multi-Factor, URL
     Configuration, Attack Protection, Auth Hooks, Audit Logs, Performance.
     **No flow-type or implicit-flow control exists anywhere.** Sessions is
     access/refresh-token lifetimes only (and is Pro-plan gated; this org is
     Free).
   - Supabase docs confirm why: flow type is "an implementation detail handled
     for you by Supabase Auth", selected by the **client** (`flowType` in
     supabase-js), not a project toggle. The only `pkce_enabled` switch applies
     to **custom OAuth/OIDC providers** (Supabase acting as an OAuth *server*)
     — a different feature from the Google social login used here.
   - Mechanism: GoTrue's `/authorize` returns `?code=` when a `code_challenge`
     is present and fragment tokens when it is not. **T0.1 always sends the
     challenge, so T0.1 alone delivers T0.4's acceptance criterion** (callback
     with `?code=` and an empty fragment).

   Consequence: `void-cloud/supabase/AUTH_PKCE.md` documents a manual step that
   cannot be performed and should not be waited on. T1 may proceed. The only
   real deploy-time prerequisite is setting **`API_PUBLIC_URL`** so the
   API-side redirect allow-list resolves.

4. **Redirect URL allow-list verified in the live dashboard — one real
   misconfiguration found.** Site URL is `https://safeappeals.com`. The six
   allow-listed redirect URLs are:
   `safe-appeals-navigator://auth/callback` (**present — T1's desktop callback
   will work**), `safe-appeals-navigator-dev://auth/callback`,
   `https://safeappeals.com/auth/callback`,
   `https://api.safeappeals.com/auth/dev-callback`,
   `http://127.0.0.1:47294/auth/callback` (legacy loopback from the
   void-reference `oauthLoopback` the rung-6.5 plan deletes), and
   **`https://localhost:3000/auth/calback` — misspelled ("calback"), so the
   local dashboard dev callback silently fails.** Not blocking desktop work;
   worth fixing when someone is next in that screen.

Plan-path correction: `void-cloud/docs/SafeAppealsCloud/configuration.md` does
not exist. The stale 1.4M/$60 pricing lived in the **parent** repo's
`docs/SafeAppealsCloud/configuration.md` (fixed there — the one T0 change that
lands in a parent-repo commit) plus the dashboard FAQ and purchase cards. The
live `/docs/credits` page was already correct.

**Jul 29 2026 — T6 landed; the default object is now exported.** The default
lives in `src/vs/workbench/contrib/chat/common/constants.ts` as
`defaultChatToolsEditsAutoApprove`, and the contribution registers that
constant. Reason: the pinning test cannot import
`chat.shared.contribution.ts` in the unit harness (duplicate registration of
`workbench.action.chat.queueMessage`), so the tripwire test asserts the shared
constant instead. Two follow-on notes:

- **T5 should try to import it** rather than hand-copying the object, which
  removes the drift risk §4.1a worries about. But **no other contrib imports
  `chat/common/constants` today** (only `vs/workbench/api/` and test
  fixtures), so the cross-contrib import may be rejected by
  `code-import-patterns`. If it is, hand-copy the object and add a test
  asserting the copy deep-equals the exported default.

  **RESOLVED Jul 30 2026 — the import is allowed; do NOT hand-copy.**
  `code-import-patterns` does not restrict contrib→contrib imports within
  `vs/workbench`. Empirical proof rather than inference:
  `src/vs/workbench/contrib/files/browser/views/explorerView.ts:56-57` already
  imports `markOnboardingTarget` and `SAMPLE_CASE_TOUR_TARGETS` from the
  onboarding contrib, and `bunx eslint` on that file returns zero findings.
  T5 therefore imports `defaultChatToolsEditsAutoApprove` from
  `../../chat/common/constants.js` directly, and the hand-copy fallback plus
  its deep-equal drift test are unnecessary.
- The setting's `markdownDescription` still claimed the default was "to
  approve all edits except…", which the flip made false in the Settings UI.
  Corrected on review to say approval is required for every edit.

**Jul 29 2026 — T10 landed; command-ID contract for T1/T4/T11/T12.** The
checklist references four commands that did not exist when it shipped. These
IDs are now load-bearing: the owning task must register the ID exactly, or the
checklist item renders a dead link.

| Command ID | Owner | Referenced by |
| ---------- | ----- | ------------- |
| `safeappeals-case.openSampleCase` | T12 | checklist step `openSampleCase` |
| `safeappeals-case.takeTour` | T12 | checklist step `takeTour` |
| `safeappeals.help.howUsesAI` | T11 | checklist step `howUsesAI` |
| `safeappeals.cloud.openCheckout` | T1 | checklist step `addCredits` |

Consequence: **Phase A must not ship partially.** Until T1/T11/T12 land, four
of the seven checklist items are dead links, so the checklist is not
user-verifiable on its own.

**Profile-rule byte-compatibility (defect 5) — half-fixed, T4 owes the other
half.** `extensions/safeappeals-case/src/profile.ts` now matches the core
writer's provenance lines exactly:

```
This profile was set up during the Safe Appeals welcome onboarding
(rerun "Safe Appeals Case: Set Up Profile" to change it).
```

T10 also added the §4.4 standing citation instruction to the *extension*
writer ahead of T4 adding it to core, so the two writers currently diverge in
the opposite direction. **T4 must append these exact bytes** to
`_writeProfileRule` (including the line break) or the two writers keep
overwriting each other:

```
Flag every legal citation you produce as *unverified* and tell the user
to confirm it against a primary source before relying on it.
```

**Product-name form.** `product.json` `nameLong` is **"Safe Appeals"** (two
words). The plans' prose writes "SafeAppeals", which is correct only for the
**"SafeAppeals Cloud"** service brand and the `safeappeals-cloud` provider ID.
User-facing product references must use the two-word form so extension copy
matches the `{0}`-substituted core strings — T10's checklist was corrected on
review for exactly this (its "How SafeAppeals Uses AI" label would not have
matched T11's "How {0} Uses AI" rendering).

**`onSettingChanged` verified (was verify-first).** `onSettingChanged:` fires
for `APPLICATION`-scope settings: `gettingStartedService.ts` (~272–274)
listens to `onDidChangeConfiguration` and emits for every `affectedKeys` entry
with **no scope filter**. Shipped with `onCommand:` as a redundant fallback.

**Jul 29 2026 — T12 landed; two of T10's four command IDs are now live.**
`safeappeals-case.openSampleCase` and `safeappeals-case.takeTour` are
registered in `extensions/safeappeals-case/` (`package.json` contribution plus
`src/extension.ts`), so the checklist's `openSampleCase`/`takeTour` steps and
T11's "Take the Tour" watermark tip both resolve. Still outstanding from that
table: `safeappeals.help.howUsesAI` (T11) and
`safeappeals.cloud.openCheckout` (T1).

**Spotlight scenarios register from `vs/workbench`, not `vs/sessions` (was
verify-first).** `onboardingScenarioRegistry` lives in
`src/vs/workbench/contrib/onboarding/common/onboardingRegistry.ts`, and the
engine and spotlight presentation are in workbench too. The existing tours
under `src/vs/sessions/contrib/onboardingTours/` import *from* workbench to
register, so registering in workbench needs no workbench→sessions import.
Extensions cannot reach the registry (not exposed on the ext API), which is why
`safeappeals-case.takeTour` delegates to the workbench command
`workbench.action.safeappeals.sampleCaseTour` rather than driving the tour
itself. The extension keeps an info-message fallback if the core command is
absent.

**Two upstream files carry spotlight targets — merge surface for the upstream
rebase.** `markOnboardingTarget` calls were added to
`src/vs/workbench/contrib/files/browser/views/explorerView.ts` (the
`.explorer-folders-view` tree container) and
`src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts`
(the chat view pane container). Both are one marked line plus two imports,
`_register`-ed for disposal, and both import `SAMPLE_CASE_TOUR_TARGETS` from the
onboarding contrib — a files→onboarding and chat→onboarding cross-contrib
import that `valid-layers-check` and the eslint import-pattern rule both allow.
Any upstream merge touching those two files must preserve the marked lines or
the tour silently skips those steps.

**The sample case is generated code, not a checked-in fixture.** It
materializes into `context.globalStorageUri/sample-case/` (managed path, per the
local-data-security rule) with the same shape as a real case
(`.safeAppeals/case.json`, `AGENTS.md`, standard folders). Every user-visible
identity field carries a `SAMPLE` / `FICTIONAL` marker — case name
`[SAMPLE — NOT A REAL CASE] Fictional Worker v. Demo Employer Co.`, claim
`SAMPLE-0000-NOT-REAL`. Treat those markers as a **safety property**, not
cosmetics: practice data must never be mistakable for a live client matter.
The tour's step-3 approval prompt is a **static DOM mock** badged
"Practice Preview — AI Not Running" with Keep/Undo disabled; it invokes no
agent.

**Jul 29 2026 — T11 finding: core UI must check `MenuRegistry`, not
`CommandsRegistry`, to detect an extension command.** This applies to any core
surface that wants to show or hide UI based on whether an extension command
exists, so it is not specific to the watermark:

| Path | Populated when |
| ---- | -------------- |
| `contributes.commands` → `MenuRegistry.addCommand()` | Extension **point load**, before activation |
| `registerCommand()` in `activate()` → `CommandsRegistry` | **Only after** activation |

Filtering on `CommandsRegistry` alone therefore drops contributed tips on first
paint, because the extension has not activated yet. The watermark now checks
`MenuRegistry.getCommand(id) || CommandsRegistry.getCommand(id)`, which also
avoids forcing activation just to decide whether to draw a label.

Two timing consequences that any such surface inherits: extension contributions
land **after** the workbench first paints, and `when`-clause context keys are
often still unset at that moment. Upstream's `cachedWhen` storage in
`editorGroupWatermark.ts` existed to paper over the second case by reusing the
previous session's answer; it was removed here because a cache that outlives an
empty-window relaunch is worse than the race. Anything removing that kind of
cache **must** subscribe to the corresponding change events instead —
`MenuRegistry.onDidChangeMenu` / `CommandsRegistry.onDidRegisterCommand` for
command availability, and `IContextKeyService.onDidChangeContext` (scoped with
`affectsSome`) for `when` keys — and must diff the resulting entry list rather
than re-rendering on every event, since hundreds of commands register during
startup.

**Jul 29 2026 — T1 landed; T10's command table is now fully satisfied.**
`extensions/safeappeals-authentication/` provides the `safeappeals-cloud`
provider and contributes `safeappeals.cloud.openCheckout` and
`safeappeals.cloud.getBalance` (plus `pasteAuthCode` and `signOut`) in
`package.json`, not only in `activate()` — which matters for exactly the
`MenuRegistry` reason recorded above. With `safeappeals.help.howUsesAI` from
T11, all four checklist commands now resolve.

Security properties verified on review, all of which later changes must
preserve:

- The session lives in **one SecretStorage envelope** (`safeappeals-cloud.session`); no `globalState`, `workspaceState`, or settings writes. Credit balance is in-memory only.
- SecretStorage failure **degrades to in-memory** with a user-visible warning; it never falls back to plaintext.
- The URI handler **rejects fragment tokens** (matching T0's server-side implicit-flow hardening) and requires both `code` and `state`.
- Callback `state` is compared strictly against the pending in-memory value; the PKCE verifier and state never touch disk.
- Output-channel logging is **metadata only** — the received-URI line deliberately logs `scheme://authority/path` and omits query and fragment, so codes and tokens cannot leak into logs.
- `safeappeals.cloud.apiUrl` is `"scope": "machine"`, so Settings Sync cannot upload a redirected endpoint.
- `product.json` `trustedExtensionAuthAccess` grants silent session access to `safeappeals.safeappeals-case`, `-email`, and `-calendar`; the identifiers match each manifest's `publisher`/`name`, so the grant actually applies.

Open items carried forward (sign-in gap closed — see Jul 30 late deviation):

1. **Calendar scopes are not requested at sign-in** (`include_calendar_scopes` omitted) even though `safeappeals-calendar` holds a trusted-access grant, so that extension would receive a session lacking Google Calendar scopes. Recommended resolution is **incremental consent** — have the calendar feature request the added scopes when it first needs them — rather than widening the consent screen at first sign-in for users who never open the calendar. Needs an owner in the calendar workstream.
2. **The paste fallback skips the state check for a bare code.** `parsePastedAuthInput` returns `state: undefined` for a bare paste, and the guard is `if (state && state !== pending.state)`, so no CSRF state is enforced on that path. This is **accepted, not overlooked**: PKCE binds the code to the in-memory verifier, so a code an attacker obtained against their own `code_challenge` cannot be redeemed by this client. Do not "fix" it by requiring state on a bare paste — that removes the fallback's reason to exist. Do preserve the PKCE binding, which is what makes it safe.

**Jul 30 2026 — status audit corrected two wrong entries.** A code audit at the
start of this session found the previous status note ("REMAINING = T3, T4, T5,
T7, T8, T9") wrong in two places, and the frontmatter `status:` fields had never
been updated at all — every task still read `pending`, including the seven that
had shipped. Both are now fixed. Ground truth as audited:

| Task | Previously claimed | Actual |
| ---- | ------------------ | ------ |
| T3 | remaining | not started — full GHE/GitHub/Apple sign-in still live |
| T4 | remaining | ~80% done: settings, location fields, board dropdown and the clear-all fix had all landed |
| T5 | remaining | not started — `AgentIntro` still renders the old AgentSessions body |
| T7 | remaining | **DONE** — `_renderCreditsHandoffStep` is complete |
| T8 | remaining | half done — service fires reasons, `startupPage.ts` ignored them |
| T9 | remaining | not started |

Process note for whoever ships the next rung: the frontmatter statuses are what
a resuming agent reads first, and they were the single thing that misdirected
this session's start. Update them in the same edit that appends a deviation.

**Jul 30 2026 — T8's attempt counter is gated by `isNew`, which the plan did not
account for (found on review; the first implementation was inert).**
`startupPage.ts` `tryShowOnboarding()` checks
`storageService.isNew(StorageScope.APPLICATION)` *before* any onboarding-specific
state. That marker is true **only during the very first session ever**:
`updateIsNew` (`src/vs/platform/storage/electron-main/storageMain.ts:173-179`,
mirrored for web in `services/storage/browser/storageService.ts:153-160`) sets
`IS_NEW_KEY` to `true` when storage does not exist and flips it to `false` on the
next launch, permanently.

Consequence: the plan's T8 acceptance criterion — "Esc once → wizard reappears
next launch" — is **unreachable** behind that gate, because launch 2 returns at
the `isNew` check before reading any dismiss counter. The first T8 cut added a
correct counter that could never be read.

Resolution: the gate now admits a user when `isNew` is true **or** when a
recorded dismiss attempt exists below the cap. The safety property that makes
this sound — and that any future change here must preserve — is that the
dismiss-attempt counter can only become non-zero in a session that already
passed the `isNew` gate and actually displayed the wizard. So existing installs
upgrading into this build have no counter and stay gated out. **Do not "simplify"
this by deleting the `isNew` check**: that would show a first-run wizard to every
existing user.

Second-order note worth keeping: the original "Esc kills onboarding forever" bug
was over-attributed. `isNew` alone already guaranteed the wizard displayed in
exactly one session, so storing the seen-flag on Esc was a symptom one layer
above the real cause.

**Jul 30 2026 — sign-in cancellation had to be fixed in the extension, not the
wizard.** The wizard's `_handleSignIn` correctly branches on
`isCancellationError(error)`, but that check never matched: the
`safeappeals-authentication` provider rejected user-cancelled sign-ins with a
plain `Error`, so every cancellation surfaced as a "Sign-in failed" toast. Three
paths in `cloudAuthProvider.ts` / `uriHandler.ts` now reject with
`vscode.CancellationError` — dispose/`failPendingSignIn`, an OAuth
`error=access_denied` callback (the user clicking Cancel on Google's consent
screen), and a pending attempt superseded by a newer `createSession` (which
previously left the first promise unsettled forever). **Any new rejection path
added to that provider must classify itself as cancellation or failure**, or the
wizard will mislabel it.

Related: core no longer notifies on `createSession` rejection at all. The
extension already raises a specific, actionable toast, and both firing produced
a duplicate generic message. Core only logs telemetry now — so if the extension
stops notifying, the failure goes silent and core must take the toast back.

**Jul 30 2026 — sign-in is async, so every continuation is guarded.**
`_handleSignIn` can now be started from three places (sign-in step, footer
nudge, credits step) and awaits an unbounded user round-trip through a browser.
The user can change step or dismiss the wizard while it is pending, so the
handler captures `origin`, a `_showGeneration`, and the step index at call time
and re-checks them (`isSameShowing` / `isContinuationValid`) after *every*
await before touching UI. The first cut called `_nextStep()` unconditionally on
success, which advanced whatever step the user had since navigated to. **New
awaits inside this method need the same guard.**

**Jul 30 2026 — the wizard no longer borrows Copilot's Google logo.**
`variationA.css` pointed at `google.svg` inside the Copilot chat-setup media
folder, which T14 deletes; the sign-in button's logo would have silently
vanished. The asset now lives in `welcomeOnboarding/browser/media/`.

**Jul 30 2026 — T9 shipped; two of its premises were wrong and are corrected
above.** First, §7's "sticky header/footer" framing was false, so the
scroll-padding it prescribed was solving a problem the layout does not have; the
shipped padding is an honest comfort margin and the §7 bullet now says so.
Second, reduced motion had been enumerated selector-by-selector, which had
already drifted — the approval cards and role pills added during this milestone
were animating for reduced-motion users because nobody extended the list. Both
the `prefers-reduced-motion` media query and the `.reduce-motion` class now use
`.onboarding-a-overlay, .onboarding-a-overlay *` so new controls are covered by
default, with explicit `transform: none` on the two cards that lift on hover.
**Keep the two blocks identical**; they exist separately only because the CSS
media query cannot see the `workbench.reduceMotion` setting.

Also worth knowing: moving the scroll container from `.onboarding-a-credits` up
to `.onboarding-a-step-content` was not in the T9 brief but was necessary —
nested scroll containers defeat `scroll-padding`, and the review found the old
arrangement had been clipping content that keyboard users could not reach.

**"Unbound" never reaches the user.** `KeybindingLabel`'s
`renderUnboundKeybindings: true` renders the literal word "Unbound" when
`lookupKeybinding` returns nothing, which is developer jargon in a legal
product. The watermark now renders the `dt` label alone and skips the `dd` /
`KeybindingLabel` entirely when there is no shortcut. Case commands such as
`New Case` and `Take the Tour` ship without keybindings, so any future tip,
walkthrough, or hover that pairs a label with a keybinding chip must handle the
unbound case the same way.

**Jul 30 2026 (late) — Phase A ship gate closed; frontmatter synced.** User
confirmed SafeAppeals Cloud sign-in and the welcome/onboarding flow are working
end-to-end. The earlier T1 open item "no live sign-in round trip has ever run"
is closed. Frontmatter: `onb-t4-profile-step` flipped `in_progress` →
`completed` (code had already landed the Jul 30 expanded scope; only the status
field was stale). Phase A (T0–T12) is complete. **Next: Phase B — T13 then T14.**

**Jul 31 2026 — T13 landed (Ask-mode).** User chose ship-now over waiting for
server tools. `extensions/safeappeals-authentication` registers vendor
`safeappeals-cloud` via `vscode.lm.registerLanguageModelChatProvider` with
`capabilities.toolCalling: false` (agent mode stays on Copilot until void-cloud
forwards `tools`/`tool_calls`). SSE `POST /llm/chat` + `GET /llm/models`; 402 →
`safeappeals.cloud.openCheckout` (never Copilot sign-in). Server follow-ups:
stream credit deduction, native tools. **Next: T14.**
