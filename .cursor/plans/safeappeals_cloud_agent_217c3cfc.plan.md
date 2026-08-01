---
name: SafeAppeals Cloud Agent
overview: "Make Agent mode run on SafeAppeals Cloud via a new SafeAppeals chat participant (not GitHub Copilot): void-cloud tool forwarding, cloud toolCalling, agent loop with host LM tools—Ask unchanged; no chat-body storage on SafeAppeals."
todos:
  - id: phase0-failfast
    content: "Phase 0: Keep/finish fail-fast until participant registers; clean unfinished edits"
    status: completed
  - id: phase1-void-tools
    content: "Phase 1 (rung 13): void-cloud forward tools/tool_calls on streaming /llm/chat + deploy"
    status: completed
  - id: phase2-toolcalling
    content: "Phase 2: CloudChatProvider toolCalling + messageMapping + SSE tool_calls"
    status: completed
  - id: phase3-participant
    content: "Phase 3: Register safeappeals.agent participant + agentLoop in auth extension"
    status: completed
  - id: phase4-gates
    content: "Phase 4: Tests, sentinel, pilot smoke, Ask regression"
    status: pending
  - id: later-tools-pass
    content: "Tools pass (ACTIVE / in progress, in-ladder with Cloud Agent): host surface phases A–F landing in safeappeals-authentication + documents + timer + email — not deferred; pilot/gates still pending"
    status: in_progress
isProject: false
---

# SafeAppeals Cloud Agent

## Goal

Cloud-signed-in **Agent** uses SafeAppeals (Cloud LM + tools). No GitHub Copilot. Ask unchanged. Privacy: no chat bodies in SafeAppeals DB; soft retention copy until provider “no training” terms verified.

## Architecture (architect recommendation)

**Register a SafeAppeals default chat participant** in [`extensions/safeappeals-authentication`](extensions/safeappeals-authentication) — id `safeappeals.agent`, `isDefault: true`, `modes: ["agent"]`, **not** `isCore`. Own tool loop: `request.model` (Cloud) → `vscode.lm.invokeTool` → repeat (cap ~25).

**Do not** turn core SetupAgent into a tool loop, and **do not** rebrand vendored [`extensions/copilot`](extensions/copilot) as the product path (GitHub-entitlement-gated; being removed). Core already fail-fasts Agent when no non-core default exists (`shouldFailFastCloudAgentMode`); once our participant registers, setup routing prefers it automatically.

Host tools: full agent surface via core (edit/terminal/todo/browser where owned) + SafeAppeals-owned wrappers/replacements for Copilot-owned tools. The **tools pass is in-ladder / in progress** alongside this Cloud Agent work: phases A–F land in `safeappeals-authentication` + `safeappeals-documents` + `time-tracker` + `safeappeals-email` (workspace edit/search/web first; then DOCX/XLSX; then timer/email). Production bar — pilot/gates still open.

```mermaid
flowchart LR
  AgentBtn[Agent_mode] --> SAAgent[safeappeals.agent]
  SAAgent --> CloudLM[safeappeals-cloud_LM]
  CloudLM --> VoidAPI[void-cloud_/llm/chat]
  SAAgent --> HostTools[vscode.lm.invokeTool]
```

## Master-plan mapping

| Phase | Master plan |
|-------|-------------|
| 1 | Rung 13 — void-cloud `tool_calls` + stream credits |
| 2 | Client `toolCalling: true` |
| 3 | Agent delivery (new participant; fuller `defaultChatAgent` string rebrand can follow) |
| Tools | Tools pass — ACTIVE / in progress (phases A–F in auth + documents + timer + email); not deferred |

Diverges from older “rebrand vendored copilot” wording: extension-first participant is smaller and avoids Copilot auth. Tell Steve if he prefers full copilot rebrand instead.

## Phases

### Phase 0 — Fail-fast until Agent ships

- Keep clear “use Ask” when Cloud signed in and no usable non-core Agent; finish/clean unfinished helper edits.

### Phase 1 — void-cloud (rung 13)

- [`void-cloud/api/src/routes/llm.ts`](void-cloud/api/src/routes/llm.ts): forward `tools`, `tool_choice`, `tool_calls`, `role: tool`; SSE deltas; no body persistence; streaming credits/`usage_logs`.
- Validation middleware; tests; Railway deploy.

### Phase 2 — Provider tool support

- [`messageMapping.ts`](extensions/safeappeals-authentication/src/llm/messageMapping.ts), [`cloudChatProvider.ts`](extensions/safeappeals-authentication/src/llm/cloudChatProvider.ts), [`sse.ts`](extensions/safeappeals-authentication/src/llm/sse.ts), api client: `toolCalling: true`, map tool parts, accumulate streamed tool_calls.
- Unit tests; E2E one tool call against deployed Phase 1.

### Phase 3 — Participant + loop

- `package.json`: `chatParticipants` + `defaultChatParticipant` proposal; `src/chat/agentParticipant.ts`, `agentLoop.ts`, `tools.ts`; register in `extension.ts`.
- DoD: Agent button → SafeAppeals; multi-step read→edit works; signed-out → Cloud sign-in not Copilot; Ask/Edit unchanged; fail-fast off when participant present.

### Phase 4 — Gates

- Reviewer, verifier, sentinel (logging), pilot smoke; Ask regression.

### Tools pass (ACTIVE / in progress)

- In-ladder with Cloud Agent (not deferred to end of migration). Phases A–F land in `safeappeals-authentication` (host workspace/edit/search/web tools + allowlist), `safeappeals-documents` (DOCX/XLSX), `time-tracker`, and `safeappeals-email`. Domain tools auto-appear in `vscode.lm.tools` with zero loop changes. Pilot/gates still pending — do not treat as done.

## Definition of done

1. Agent works on Cloud without Copilot; no hang.
2. Real tool round-trips for the host surface users expect (read/edit/create at minimum; expand to match Built-In sets the UI advertises).
3. Ask still works; no chat bodies in SafeAppeals DB.
4. Participant branded SafeAppeals.
5. Tool picker enablement and agent allowlist stay aligned — checking a Built-In set must not silently no-op.

## After you approve

Coder per phase → reviewer + verifier → sentinel → pilot → scribe. No code until you confirm.
