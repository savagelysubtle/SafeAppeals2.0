---
name: Switch Mode Tool P1a
overview: "First micro-slice: ship bidirectional `safeappeals_switchMode` in safeappeals-authentication (Agent↔Plan), wire allowlist/package.json/setting, and leave Copilot's Plan provider in place until Phase 2."
todos:
  - id: p1a-tool-impl
    content: Add switchModeTool.ts + register in tools.ts
    status: completed
  - id: p1a-allowlist
    content: toolAllowlist constant, ENSURED, descriptors, copilot_switchAgent substitution
    status: completed
  - id: p1a-package
    content: package.json languageModelTools + vscode toolset + safeappeals.chat.switchMode.enabled + nls
    status: completed
  - id: p1a-tests
    content: Allowlist/agentLoop tests for new tool + substitution
    status: completed
  - id: p1a-verify
    content: Typecheck auth extension + run affected tests
    status: completed
isProject: false
---

# P1a — `safeappeals_switchMode` (Agent ↔ Plan)

Parent program: [Copilot → SafeAppeals Migration](copilot_to_safeappeals_845b71d5.plan.md). This slice is **Phase 1 / P1a only**. Plan destination still requires Copilot’s `PlanAgentProvider` until Phase 2. **P1b** (disable Copilot’s `copilot_switchAgent`) is a follow-up PR.

## Deliverable

LM tool `safeappeals_switchMode` (`toolReferenceName`: `switchMode`) that switches chat mode between **Plan** and **Agent** via core command `workbench.action.chat.toggleAgentMode`.

## Implementation

### 1. New tool module

Add [`extensions/safeappeals-authentication/src/chat/switchModeTool.ts`](extensions/safeappeals-authentication/src/chat/switchModeTool.ts):

- Class `SwitchModeTool implements vscode.LanguageModelTool<SwitchModeInput>`
- Input: `{ mode: 'Plan' | 'Agent' }`
- `prepareInvocation`: short message (“Switching to Plan agent” / “Switching to Agent”)
- `invoke`:
  - Read `safeappeals.chat.switchMode.enabled` (default true); if false, return error text
  - Map `Plan` → `modeId: 'Plan'`, `Agent` → `modeId: 'agent'`
  - `await vscode.commands.executeCommand('workbench.action.chat.toggleAgentMode', { modeId, sessionResource: options.chatSessionResource })`
  - Return confirmation text (no Copilot `PlanAgentProvider.buildAgentBody` — keep P1a thin; Plan’s own system prompt loads after switch)
- `chatSessionResource` is on `LanguageModelToolInvocationOptions` via proposed APIs ([`vscode.proposed.chatParticipantAdditions.d.ts`](src/vscode-dts/vscode.proposed.chatParticipantAdditions.d.ts) / private) — same field Copilot’s tool uses

### 2. Register

- Export `registerSwitchModeTool(): vscode.Disposable` from the new file
- Wire into [`registerSafeAppealsAgentTools`](extensions/safeappeals-authentication/src/chat/tools.ts) (~309) alongside `registerWebAgentTools()` / etc.
- Activation already calls this from [`extension.ts`](extensions/safeappeals-authentication/src/extension.ts) (~84)

### 3. Allowlist

In [`toolAllowlist.ts`](extensions/safeappeals-authentication/src/chat/toolAllowlist.ts):

- `SAFEAPPEALS_SWITCH_MODE_TOOL = 'safeappeals_switchMode'`
- Add to `ENSURED_AGENT_TOOL_NAMES` + `ENSURED_AGENT_TOOL_DESCRIPTORS` (intentional force-include so SafeAppeals Agent always sees the switcher unless picker disables it; `safeappeals_*` already passes `isAgentToolAllowed`)
- `AGENT_TOOL_NAME_SUBSTITUTIONS`: `copilot_switchAgent: SAFEAPPEALS_SWITCH_MODE_TOOL`
- `chatSessionResource` comes from enabled `chatParticipantPrivate` proposal (already in auth `enabledApiProposals`) — pass as `sessionResource` to `toggleAgentMode`

### 4. package.json + nls

In [`extensions/safeappeals-authentication/package.json`](extensions/safeappeals-authentication/package.json):

- `languageModelTools` entry (mirror `safeappeals_runVscodeCommand` in [`webTools.ts`](extensions/safeappeals-authentication/src/chat/webTools.ts)): `name`, `toolReferenceName: "switchMode"`, display/model/user descriptions via `%tool.switchMode.*%`, `canBeReferencedInPrompt: true`, `icon: "$(arrow-swap)"`, `inputSchema` with `mode` enum `["Plan","Agent"]`
- Optional `"when": "config.safeappeals.chat.switchMode.enabled"` — first `when` on a SafeAppeals auth tool (siblings omit it); fine to add for parity with Copilot’s gate, or rely on invoke-time config check only
- Add `"switchMode"` to `languageModelToolSets` → `"vscode"` tools array (~694); toolsets reference **`toolReferenceName`**, not `name`
- Configuration property:

```json
"safeappeals.chat.switchMode.enabled": {
  "type": "boolean",
  "default": true,
  "scope": "machine",
  "markdownDescription": "%config.chat.switchMode.enabled.description%"
}
```

- Strings in [`package.nls.json`](extensions/safeappeals-authentication/package.nls.json)

### 5. Tests

Extend [`src/test/agentLoop.test.ts`](extensions/safeappeals-authentication/src/test/agentLoop.test.ts) (or small dedicated test):

- `isAgentToolAllowed('safeappeals_switchMode')` true
- `resolveAgentToolName('copilot_switchAgent')` → `safeappeals_switchMode`
- `ENSURED_AGENT_TOOL_NAMES` includes the new tool
- Optional: unit-test invoke with stubbed `commands.executeCommand` if the suite already mocks vscode (follow existing preload pattern)

### 6. Validation

- `bunx tsgo --noEmit -p extensions/safeappeals-authentication/tsconfig.json` (or project’s established extension typecheck path)
- Run the auth extension agentLoop / allowlist tests

## Out of scope (this PR)

- Disabling Copilot’s `copilot_switchAgent` (**P1b**)
- Porting `PlanAgentProvider` (**Phase 2**)
- Ask/Edit modes
- Injecting full Plan agent body on switch (Copilot does this today; defer unless smoke shows models need it)

## Manual smoke (after implement)

1. Agent mode → call tool with `mode: "Plan"` → mode picker shows Plan
2. Plan mode → call tool with `mode: "Agent"` → back to Agent (`safeappeals.agent` path when that is current)
3. Setting `safeappeals.chat.switchMode.enabled: false` → tool returns disabled error
