---
name: SafeAppeals Chat Whisper Dictation
overview: "ChatExecute hold-to-talk mic → IMicCaptureService PCM16 → safeappeals-audio.transcribePcm (withLease + kutalia pcmf32) → _chat.dictation.insertText (setInput append, never acceptInput). Local-only; setting safeappeals.dictation.enabled."
todos:
  - id: e1-transcribe-pcm
    content: "Extension: pcm16Base64→pcmf32 (+resample), AudioService.transcribePcm via withLease('whisper'), command safeappeals-audio.transcribePcm + package.json/nls + tests"
    status: pending
  - id: w1-insert-setting
    content: "Workbench: _chat.dictation.insertText + safeappeals.dictation.enabled config in safeappealsDictation contrib"
    status: pending
  - id: w2-ptt-session
    content: "Workbench: dictation session (prepare/pttDown/collect chunks/pttUp/onPttEnd → executeCommand → insert); sampleRate from mic"
    status: pending
  - id: w3-menu-hold-ux
    content: "ChatExecute mic + hold ActionViewItem + keybinding hold mode; context keys; failure toasts; wire workbench.common.main"
    status: pending
  - id: w4-verify
    content: "Unit tests (insert + pcm conversion); typecheck extension + contrib; manual PTT smoke"
    status: pending
isProject: true
---

# SafeAppeals — Chat Whisper Dictation (local)

## Recommendation

Implement **hold-to-talk (PTT) chat dictation**: new workbench contrib `safeappealsDictation` on `MenuId.ChatExecute` captures mic via existing `IMicCaptureService`, ships concatenated PCM to `safeappeals-audio.transcribePcm`, inserts transcript into the focused chat input with **`setInput` only**. Never call `_chat.voice.acceptInput` / `acceptInput` (those auto-submit).

**Trade-off:** small workbench surface for ChatExecute + PTT UX, while ASR remains in the audio extension behind `MlResourceEngine`.

## Prior session notes

| Source | Status |
|--------|--------|
| Vault Tech/Audio + session 2026-08-04 | “Dictation extension — parked” → this plan unparks as workbench+command |
| R9 Architecture A | kutalia EH Whisper, `translate:false`, 16 kHz pcmf32 — keep |
| ML engine plan | All Whisper via `withLease('whisper')` — keep |
| Steve (approved) | ChatExecute mic → PCM → extension → insert without send |

Do **not** reopen: Agents Voice Mode, cloud speech, auto-submit.

## Out of scope

- Agents Voice Mode / `_chat.voice.acceptInput` behavior changes
- Cloud / VS Code speech provider dictation
- Auto-submit after transcript
- Sessions/Agents-window composer bridge (v1 = workbench `lastFocusedWidget` only)

---

## Architecture (committed)

```
ChatExecute mic (hold)
 │
 ▼
IMicCaptureService.pttDown → onPttAudioChunk(base64 PCM16) → pttUp → onPttEnd
 │
 ▼
concat chunks + sampleRate
 │
 ▼
commandService.executeCommand('safeappeals-audio.transcribePcm', { pcm16Base64, sampleRate })
 │
 ▼
AudioService.transcribePcm → mlEngine.withLease('whisper') → WhisperHost({ kind:'pcmf32', pcmf32 })
 │
 ▼
_chat.dictation.insertText(text)
 │
 ▼
lastFocusedWidget.setInput(existing + spacer + text) // NEVER acceptInput
```

### Rejected alternatives

| Option | Verdict |
|--------|---------|
| Click-toggle primary UX | Reject — mic service is PTT-oriented; hold matches drain/`onPttEnd` |
| Reuse `_chat.voice.acceptInput` | Reject — submits (or Agents composer `sendQuery`) |
| Separate dictation extension | Reject — Steve approved workbench + audio command |
| Stream chunks to Whisper live | Defer — batch after `onPttEnd` for v1 |

---

## PCM format (`IMicCaptureService` → pcmf32)

### What the mic emits

From `micCaptureService.ts`:

| Property | Value |
|----------|--------|
| Capture request | `channelCount: 1`, `sampleRate: 16000` on getUserMedia + `AudioContext({ sampleRate: 16000 })` |
| Internal processing | `ScriptProcessor` **Float32** channel 0 |
| Event payload | **`onPttAudioChunk`: base64 of raw little-endian Int16 PCM** (no WAV header) via `encodeRawPcm16Base64` |
| Channels | Mono |
| Actual rate | **`AudioContext.sampleRate` may not be 16000** on some devices — do not hardcode without reading ctx |

### Conversion (extension)

1. `Buffer.from(pcm16Base64, 'base64')` → Int16LE samples
2. Float32: `sample / 32768` (match `wavPcm.ts` Int16 path)
3. If `sampleRate !== 16000`: linear resample (or ffmpeg) to `WHISPER_PCM_SAMPLE_RATE` before Whisper — wrong rate → hallucinations
4. `WhisperHost.transcribe(jobId, { kind: 'pcmf32', pcmf32 })` with **`translate: false`** (already hard-coded in host)

### Command payload (JSON-safe across EH boundary)

```ts
// args
{ pcm16Base64: string; sampleRate: number }
// result
string // transcript text (empty string OK)
```

Do **not** pass `Float32Array` through `executeCommand` (JSON loses typed arrays).

### Mic API tweak

**Edit** `IMicCaptureService` / `MicCaptureService`: add `readonly sampleRate: number | undefined` → `_micCtx?.sampleRate`. Retain **Microsoft** header on that file.

---

## UX: Hold-to-talk (PTT) — committed

`IMicCaptureService` is PTT (`pttDown` / `pttUp` / drain / `onPttEnd`). Primary UX = **hold**.

| Surface | Behavior |
|---------|----------|
| **Keyboard** | Keybinding + `keybindingService.enableKeybindingHoldMode(id)`: start → `pttDown`; release → `pttUp`; await `onPttEnd`; transcribe; insert |
| **Toolbar mic** | Custom `ActionViewItem` on `MenuId.ChatExecute`: `pointerdown` → start PTT; `pointerup`/`pointerleave`/`blur` → end PTT (same pipeline). Not click-toggle. |
| **Cancel** | Escape while holding/active → `abortPtt()` / discard chunks; no insert |
| **Visual** | Context key `safeappealsDictationActive`; mic icon; optional brief “Transcribing…” after release |
| **Min hold** | Ignore / toast if `samplesSent` ~0 or hold &lt; ~200ms |

Suggested keybinding (avoid Agents Voice `CtrlCmd+Shift+Space`): **`CtrlCmd+Alt+Space`**, when `config.safeappeals.dictation.enabled` + `ChatContextKeys.inChatInput`.

---

## Menu registration pattern

Copy **`agentsVoice.contribution.ts`** (`registerAction2` + `MenuId.ChatExecute`, `group: 'navigation'`), not cloud `voiceChatActions` speech-provider path.

| Action | Icon | Order | `when` |
|--------|------|-------|--------|
| `safeappeals.dictation.holdToDictate` | `Codicon.mic` | `-8` | `config.safeappeals.dictation.enabled` + Chat location + `!currentlyEditing` + `!safeappealsDictationActive` + prefer `AGENTS_VOICE_LISTENING.negate()` |
| (optional stop affordance) | — | — | Usually unnecessary if hold view item owns pointerup |

Also register `IActionViewItemService` factory for the hold action id (same pattern as other ChatExecute custom view items).

Wire: `import './contrib/safeappealsDictation/browser/safeappealsDictation.contribution.js'` next to agentsVoice in `workbench.common.main.ts`.

---

## Settings

Register in the **workbench** contrib (so the mic can appear before EH work):

```ts
'safeappeals.dictation.enabled': {
	type: 'boolean',
	default: true, // or false if product wants opt-in; assume true for SA desktop
	scope: ConfigurationScope.APPLICATION,
	description: localize(...), // "Enable local Whisper dictation in chat (insert without sending)."
}
```

Reuse existing audio settings for model path (`safeappeals.audio.whisperModelPath`); no duplicate model setting.

---

## Failure toasts

| Condition | Toast |
|-----------|--------|
| Extension missing / command not found | Error: Audio extension required for dictation |
| `canTranscribe()` false / model missing | Error: Whisper unavailable — install/choose model (reuse host reason string) |
| Mic permission denied | Existing mic permission notify from `IMicCaptureService` |
| `MlBusyError` | Warning: Whisper busy — try again |
| Empty transcript | Soft info optional; no insert |
| Transcribe throw | Error with message |

Check: `IExtensionService.getExtension('safeappeals.safeappeals-audio')` (confirm publisher.id from package) and/or catch command failure.

---

## Insert command (critical)

Register always (not gated on `agents.voice.enabled`):

```ts
CommandsRegistry.registerCommand('_chat.dictation.insertText', (accessor, text: string) => {
	const widget = accessor.get(IChatWidgetService).lastFocusedWidget;
	if (!widget || !text) { return; }
	const existing = widget.getInput();
	const spacer = existing.length > 0 && !/\s$/.test(existing) ? ' ' : '';
	widget.setInput(existing + spacer + text);
});
```

**Forbidden:** `widget.acceptInput`, `_chat.voice.acceptInput`.

---

## Exact files

### Create (Safe Appeals copyright)

| File | Role |
|------|------|
| `src/vs/workbench/contrib/safeappealsDictation/browser/safeappealsDictation.contribution.ts` | Setting, actions, menus, keybinding, insert command, toasts, main import side-effects |
| `src/vs/workbench/contrib/safeappealsDictation/browser/dictationSession.ts` | PTT session: prepare window, collect chunks, call extension, insert |
| `src/vs/workbench/contrib/safeappealsDictation/browser/dictationHoldActionViewItem.ts` | Pointer hold ActionViewItem |
| `src/vs/workbench/contrib/safeappealsDictation/browser/pcmChunks.ts` | Concat base64 PCM16 chunks → single base64 |
| `src/vs/workbench/contrib/safeappealsDictation/test/browser/dictationInsert.test.ts` | insert append / no acceptInput |
| `extensions/safeappeals-audio/src/pcm16.ts` (or extend `wavPcm.ts`) | `pcm16Base64ToPcmf32`, `resampleTo16kMono` |
| `extensions/safeappeals-audio/src/test/pcm16.test.ts` | Conversion/resample unit tests |
| `extensions/safeappeals-audio/src/test/transcribePcm.test.ts` | withLease + mock WhisperHost |

### Edit

| File | Change | Header |
|------|--------|--------|
| `extensions/safeappeals-audio/src/audioService.ts` | `transcribePcm({ pcm16Base64, sampleRate })` → withLease + WhisperHost pcmf32 | SA |
| `extensions/safeappeals-audio/src/extension.ts` | Register `safeappeals-audio.transcribePcm` | SA |
| `extensions/safeappeals-audio/package.json` | Command contribute (palette: hide / `"enablement": "false"` OK for internal) | — |
| `extensions/safeappeals-audio/package.nls.json` | Command title string | — |
| `src/vs/workbench/contrib/chat/browser/voiceClient/micCaptureService.ts` | `sampleRate` getter | **Microsoft** (existing) |
| `src/vs/workbench/workbench.common.main.ts` | Import dictation contribution | Microsoft |

### Do not edit (v1)

- `voiceSessionController.ts` / Agents Voice bridge
- `voiceChatActions.ts` (cloud speech)
- `_chat.voice.acceptInput` handlers

---

## Extension `transcribePcm` sketch

```ts
async transcribePcm(args: { pcm16Base64: string; sampleRate: number }): Promise<string> {
	// gate whisperHost.canTranscribe()
	const pcmf32 = pcm16Base64ToPcmf32(args.pcm16Base64, args.sampleRate); // resamples to 16k
	const jobId = `dictation:whisper:${randomUUID()}`;
	const result = await this.mlEngine.withLease('whisper', { jobId, rejectIfBusy: true }, async () =>
		this.whisperHost!.transcribe(jobId, { kind: 'pcmf32', pcmf32 })
	);
	return result.text.trim();
}
```

No recording-store persist for dictation PCM (ephemeral; legal audio not written plaintext).

---

## Implementation order (coder)

1. **E1 — Extension PCM + command**
	`pcm16` helpers → `AudioService.transcribePcm` → `extension.ts` + package.json/nls → mocha tests (`translate:false` already in host; assert withLease used).

2. **W1 — Insert + setting**
	Create contrib skeleton: `_chat.dictation.insertText`, `safeappeals.dictation.enabled`, unit test insert append.

3. **W2 — Dictation session**
	`dictationSession.ts`: `mainWindow` prepare, PTT lifecycle, concat, `executeCommand`, insert; surface errors as toasts.

4. **W3 — Menu / hold UX**
	Actions + ChatExecute menu + hold ActionViewItem + keybinding hold mode; `sampleRate` getter on mic service; import in `workbench.common.main.ts`.

5. **W4 — Verify**
	Extension tests; contrib tests; `bunx tsgo` / extension compile; manual: hold mic → text appears → Send still manual.

**Parallelism:** E1 and W1 can start together; W2 needs E1 command contract; W3 needs W2.

---

## Risks & blast radius

| Risk | Mitigation |
|------|------------|
| Wrong sample rate → garbage ASR | Pass `mic.sampleRate`; resample ≠16k |
| Dual mic vs Agents Voice | Hide dictation while Agents Voice listening; different icon/order/keybinding |
| Large base64 on long holds | Soft max duration (~60s) or toast; v1 OK for short dictation |
| Whisper exclusive lane busy | Toast `MlBusyError`; do not queue silently without UX |
| Command arg size limits | Unlikely for short PTT; if hit, temp managed WAV path (later) |
| Mic Microsoft file edit | Minimal getter only |

### Tests

- pcm16 → pcmf32 + resample
- `transcribePcm` uses `withLease('whisper')` and returns text
- `insertText` appends with space; does not call `acceptInput`
- Manual: enabled/disabled setting; missing extension toast; hold insert without send

---

## Assumptions (non-blocking)

1. Default `safeappeals.dictation.enabled` = **true** on SafeAppeals desktop product.
2. v1 targets main workbench chat widget only (not Agents composer).
3. Extension id for presence check matches package `publisher.name` (verify at impl: typically `safeappeals.safeappeals-audio`).
4. Copyright: **Safe Appeals** on all new `safeappealsDictation/**` and audio files; **Microsoft** only on edited existing VS Code files (`micCaptureService`, `workbench.common.main`).
