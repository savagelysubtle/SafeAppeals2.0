---
name: SafeAppeals R9 Audio (production)
overview: "Production-grade legal case audio recorder: NEW extensions/safeappeals-audio — MediaRecorder webview, Whisper GGML via @kutalia/whisper-node-addon in the extension host, ffmpeg BYO convert/import, encryptedStore + SecretStorage DEK under context.globalStorageUri. Hard-disable transcription/import-convert when model/ffmpeg missing. Asset bundling deferred to rung 14. Evaluate upstream speech/agentsVoice only after this works."
todos:
  - id: p0-scaffold-abi
    content: "P0: Scaffold extensions/safeappeals-audio (package.json, nls, gulp/dirs wiring); P0 ABI smoke load @kutalia/whisper-node-addon in Electron 42 EH (linux + windows gate); capability probe skeleton; document B-pivot criteria if smoke fails"
    status: completed
  - id: p1-encrypted-store
    content: "P1: RecordingStore — SAENC1 metadata + sealed audio blobs under context.globalStorageUri/workspaces/<hash>/; DEK in SecretStorage; fail-closed if DEK unavailable; Clear Audio Cache purge command; 0700/0600 + atomic writes"
    status: completed
  - id: p2-recorder-ui
    content: "P2: Activity-bar webview sidebar (timeline/converter pattern) + MediaRecorder capture/pause/resume/stop; playback; recordings list; title-case nls commands (Open Audio Recorder, Start/Stop Recording, Import Audio File)"
    status: completed
  - id: p3-ffmpeg-import
    content: "P3: BYO/dev-path ffmpeg+ffprobe detect; hard-disable non-WAV import/convert + non-WAV transcription when missing; install guidance UI; convert to 16kHz mono PCM WAV for Whisper; supported formats parity with void"
    status: completed
  - id: p4-whisper-progress
    content: "P4: Whisper transcription via kutalia in EH; BYO/dev model path; progress stages loading_model/processing/finalizing; status machine pending→transcribing→completed|failed; cancel/error UX"
    status: completed
  - id: p5-export-commands
    content: "P5: Export txt/srt/json/docx (docx lib in EH); Save dialog + optional workspace transcripts/; command palette + recording card actions; title-case nls"
    status: completed
  - id: p6-tests-docs
    content: "P6: Unit tests (store/gates/export/progress) + fixture smoke with mocked whisper; optional real-model smoke behind env; update master r9-audio pointer + ADDED_FEATURES_TRACKER; copyright headers Safe Appeals"
    status: completed
  - id: p7-rung14-deferrals
    content: "P7: Explicit rung-14 deferral note only — resources/ffmpeg|models packaging, download-whisper-model script productization, prebuild CI matrix; do not pretend bundled in v1"
    status: completed
isProject: true
---

# SafeAppeals R9 Audio — Production Implementation Plan

## Recommendation

Ship **`extensions/safeappeals-audio`** as a full product extension (activity-bar webview + commands + tests): **Architecture A** — MediaRecorder in the webview, Whisper + ffmpeg in the **extension host**. Use **`@kutalia/whisper-node-addon`** (GGML / whisper.cpp bindings — **not** ONNX/Xenova from older docs) and **`spawn` ffmpeg/ffprobe** with v1 **BYO / machine-scoped settings paths**. Persist all user content with **`encryptedStore` (SAENC1) + SecretStorage DEK** under **`context.globalStorageUri` only** — never `~/.safe-appeals-navigator`, never plaintext WAV/transcripts on disk. **Hard-disable** (not soft-fallback) transcription and format conversion when model or ffmpeg is missing, with install guidance (converter precedent). **Trade-off accepted:** faster void-reference port and no new Rust crate; accept a third-party N-API native dependency and a **P0 Electron-42 load smoke**. If that smoke fails (especially Windows), **pivot to Architecture B** (`rust/audio` → `sa-audio` NDJSON sidecar with linked whisper.cpp) — do **not** invent dual-ABI node-gyp prebuilds for whisper (see `WINDOWS-PREBUILDS-TODO.md`). Evaluate upstream `speech` / `agentsVoice` **only after** this legal case recorder works. Bundled `resources/ffmpeg` + `resources/models` land with **rung 14**.

## Prior session notes (how this builds on them)

Locked from master plan / prior product decisions (honored, not reopened):

- Extension-first under `extensions/` — **not** `src/vs/workbench/contrib`.
- Master `r9-audio`: recorder + Whisper + ffmpeg; upstream speech evaluation **after** it works; packaging with **rung 14**.
- Local data security (AGENTS.md): encryptedStore + SecretStorage; managed paths only; fail closed.
- Converter R8 established BYO + hard-disable + install guidance; timeline/converter established activity-bar webview wiring (`build/gulpfile.extensions.ts`, `build/npm/dirs.ts`).
- Void-reference uses GGML + kutalia in electron-main; older `docs/features/audioRecorder/*` ONNX/Xenova wording is **outdated** — prefer reference code.

This plan is the source of truth for `r9-audio`.

---

## Architecture pick (committed)

| Option | Verdict |
|--------|---------|
| **A — EH + kutalia + ffmpeg spawn** | **PICK** — kutalia ships N-API / Electron-oriented prebuilds; closest port of void main service into EH; ffmpeg is process spawn (no native ABI). |
| **B — Rust `sa-audio` NDJSON** | **Fallback** if P0 ABI/load smoke fails or Windows cannot load kutalia DLLs. Same UI/storage; whisper.cpp + ffmpeg inside sidecar. |
| **C — Hybrid** | **Reject** — splitting whisper (EH) vs ffmpeg (sidecar) adds protocol cost without removing native surface; full sidecar *is* B. |

### Sizing / ABI / Windows

| Dimension | A (pick) | B (fallback) |
|-----------|----------|--------------|
| Effort | ~port void EH + rewrite storage/UI (~1.5–2.5 eng-weeks for full production bar) | A surface + Rust whisper.cpp crate (~+1–2 weeks) |
| ABI risk | Medium-low **if** N-API load works on Electron 42 EH; P0 must prove it | Low for Node/Electron (static/sidecar binary); packaging like converter |
| Electron 42 / Node 24 | EH = Electron ABI; kutalia claims runtime detection — **verify**, do not assume dual `electron-146`/`node-137` folders | Sidecar independent of EH ABI |
| Windows pain | kutalia ships win32 prebuilds; risk is DLL search path / GPU backends — verify on real win32-x64 | Own `sa-audio.exe` CI matrix (rung 14); no node-gyp |

**P0 pivot criteria (automatic, evidence-based):**

1. `require('@kutalia/whisper-node-addon')` throws or returns unusable API in SafeAppeals EH on Linux **or** Windows.
2. Transcribe of a short fixture WAV crashes EH / GPU init with no CPU fallback path we can enable.
3. Package cannot be vendored/resolved under the extension install layout.

On pivot: stop investing in kutalia dual-ABI; implement B with the same TS UI/store/capability contracts.

```
┌──────────────────────────────────────────────────────────────┐
│ extensions/safeappeals-audio                                 │
│  - extension.ts (activate, commands, views)                  │
│  - AudioService (façade ≈ IAudioRecorderService)             │
│  - RecordingStore (encrypted metadata + sealed blobs)        │
│  - CapabilityService (ffmpeg / model / whisper probe)        │
│  - WhisperHost (kutalia wrapper; mockable)                   │
│  - FfmpegHost (spawn convert/ffprobe)                        │
│  - ExportService (txt/srt/json/docx)                         │
│  - webview-src/sidebar (MediaRecorder + list + progress)     │
└───────────────┬───────────────────────────┬──────────────────┘
                │ postMessage               │ spawn / require
                ▼                           ▼
         MediaRecorder (webview)     ffmpeg (BYO) + kutalia (EH)
                                            │
                                            ▼
                         context.globalStorageUri / workspaces / <hash> /
                           recordings.json (SAENC1)
                           recordings/<id>.saenc (sealed audio)
```

**On-machine only** — no cloud transcription. Confidential legal audio never leaves the host.

### Copyright (new product code)

New SafeAppeals-owned files under `extensions/safeappeals-audio/` (and any `rust/audio/` if pivoted) use:

```
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/
```

Do **not** put Microsoft headers on new SafeAppeals product code. Tabs in all TypeScript samples.

---

## Product placement (committed)

**NEW `extensions/safeappeals-audio`.**

Reasons:

1. Legal **case recorder** (hearings, client notes, imports) — not chat dictation; needs its own activity-bar surface.
2. Matches heavy-feature pattern (converter, future RAG).
3. Extension-first stays clean; no workbench contrib hub.
4. Void’s IPC-to-main becomes EH services — same product behavior, safer storage.

Wire like timeline/converter:

- `build/gulpfile.extensions.ts` — add `extensions/safeappeals-audio/tsconfig.json`
- `build/npm/dirs.ts` — add `extensions/safeappeals-audio`
- `package.json` — `viewsContainers.activitybar`, webview view, commands, `package.nls.json`
- Optional later: agent tools for list/transcribe/export (not blocking P0–P5)

---

## Source of truth to port

| Area | Path | Notes |
|------|------|-------|
| Types / interface | `void-reference/common/audioRecorder/` | `RecorderState`, `Recording`, `TranscriptionProgress`, `ExportFormat`, `SUPPORTED_AUDIO_*` |
| Main logic | `void-reference/electron-main/audioRecorder/audioRecorderMainService.ts` (~1072 lines) | kutalia, ffmpeg convert, export — **rewrite storage paths + encryption** |
| Browser bridge | `void-reference/browser/audioRecorder/` | Adapt to webview message protocol, not DI services |
| React UI | `void-reference/browser/react/src/audio-recorder-tsx/` | Port into `webview-src/` + esbuild like timeline |
| Docs | `docs/features/audioRecorder/` | Historical only; **ignore ONNX/Xenova** |

**Forbidden from void:** `~/.safe-appeals-navigator/.../audio_recordings.db` and plaintext `recordings/*.wav`. Soft-continue when ffmpeg missing (void) → **hard-disable** in production.

---

## Storage schema + encryption + purge

### Layout (managed paths only)

```
{context.globalStorageUri}/
  workspaces/{workspaceHash}/
    recordings.json              # SAENC1 encrypted JSON catalog
    recordings/{id}.saenc        # SAENC1 sealed original audio bytes
    tmp/                         # 0700; ephemeral decrypt/convert; wiped after job
```

- `workspaceHash` = first 16 hex of SHA-256 of workspace folder URI (time-tracker precedent).
- No workspace folder → extension inactive or shows “Open a folder” (match converter/timeline).
- DEK: SecretStorage key e.g. `safeappeals-audio.dek` via `acquireDek` from `safeappeals-shared` (or synced `src/shared/` copy pattern).
- Durability marker in `globalState`.
- DEK unavailable → **in-memory only** + user-visible warning; **never** plaintext on disk (AGENTS.md).

### Catalog schema (`recordings.json`)

```typescript
interface RecordingCatalog {
	version: 1;
	recordings: StoredRecording[];
}

interface StoredRecording {
	id: string;
	filename: string; // display name
	blobRelativePath: string; // recordings/{id}.saenc
	createdAt: string; // ISO
	duration: number;
	status: 'pending' | 'transcribing' | 'completed' | 'failed';
	mimeType: string;
	isImported: boolean;
	originalFilename?: string;
	transcript?: string;
	transcriptSegments?: { start: number; end: number; text: string }[];
	language?: string;
	fileSizeBytes?: number;
}
```

Do **not** store absolute filesystem paths to plaintext audio. Playback: decrypt to memory / short-lived blob URL in webview; revoke after use. Transcription: decrypt to `tmp/` 0600 file (or pcmf32 in-memory if kutalia accepts) → wipe in `finally`.

### Purge

Command: **Clear Audio Cache** (`safeappeals-audio.clearCache`)

- Deletes catalog + all `.saenc` + `tmp/` for current workspace (confirm modal).
- Optional: clear DEK only if no remaining envelopes (dangerous — default leave DEK).
- Must be discoverable in Command Palette; nls title-case.

### Settings (machine-scoped)

```json
"safeappeals.audio.ffmpegPath": { "type": "string", "scope": "machine", "default": "" },
"safeappeals.audio.ffprobePath": { "type": "string", "scope": "machine", "default": "" },
"safeappeals.audio.whisperModelPath": { "type": "string", "scope": "machine", "default": "" }
```

Detection order: setting override → (future) bundled resources (rung 14) → `PATH` (`ffmpeg` / `ffprobe`). Model: setting only until rung 14.

---

## Capability gates (hard-disable)

Mirror converter’s `available` + `install_hint`:

| Capability | Required for | If missing |
|------------|--------------|------------|
| `whisperAddon` | Transcribe | Transcribe button/commands disabled; guidance: native module failed to load (P0 pivot if systemic) |
| `whisperModel` | Transcribe | Disabled + set `safeappeals.audio.whisperModelPath` / download guidance (rung 14 will bundle) |
| `ffmpeg` | Non-WAV import, convert-to-WAV, reliable duration via ffprobe | Non-WAV import/transcribe disabled; WAV-only path may remain if model+addon OK |
| `secretStorage` | Persist anything | Warn; memory-only; no disk writes of user content |

**Never** pretend convert succeeded without ffmpeg. **Never** soft-run non-WAV through Whisper hoping it works.

UI: capability banner in sidebar when any gate fails. Agent tools (if added later) refuse with structured `ENGINE_UNAVAILABLE`.

---

## UI / commands (nls, title case)

Activity bar container + webview sidebar (icon: mic / `$(mic)`).

| Command id | Title (nls) |
|------------|-------------|
| `safeappeals-audio.openRecorder` | Open Audio Recorder |
| `safeappeals-audio.startRecording` | Start Audio Recording |
| `safeappeals-audio.stopRecording` | Stop Audio Recording |
| `safeappeals-audio.importAudio` | Import Audio File |
| `safeappeals-audio.transcribe` | Transcribe Recording |
| `safeappeals-audio.exportTranscript` | Export Transcript |
| `safeappeals-audio.clearCache` | Clear Audio Cache |

Category: **SafeAppeals**. Labels title-case; prepositions ≤4 letters lowercase unless first/last.

Webview features (port from React reference):

- Record / pause / resume / stop + elapsed timer
- Recordings list with status colors
- Import (dialog + drag-drop)
- Playback bar
- Transcript viewer
- Transcription progress (stage + %)
- Capability/install guidance panel

---

## Import formats + ffmpeg convert

**Extensions (void parity):** `.wav`, `.mp3`, `.m4a`, `.ogg`, `.webm`, `.flac`
**MIME:** as in `SUPPORTED_AUDIO_FORMATS`.

Pipeline:

1. Validate extension.
2. Copy/seal original into `.saenc`.
3. For Whisper: if not already 16 kHz mono PCM WAV → ffmpeg:

```
ffmpeg -y -i <in> -ar 16000 -ac 1 -c:a pcm_s16le <tmp.wav>
```

4. Wipe temp after transcription.
5. Duration via ffprobe when available; else 0 / MediaRecorder-reported duration for live captures.

---

## Transcription progress UX

Events (void types):

```typescript
interface TranscriptionProgress {
	recordingId: string;
	progress: number; // 0-100
	stage: 'loading_model' | 'processing' | 'finalizing';
}
```

- Status → `transcribing` before work; `completed` / `failed` after.
- Webview shows determinate bar + stage label (nls).
- Clear progress overlay shortly after 100%.
- Errors: notification + card `failed` with retry.
- Optional cancel: best-effort abort flag; document if kutalia cannot cancel mid-call.

---

## Export formats

| Format | Behavior |
|--------|----------|
| `txt` | Full transcript text |
| `srt` | Segments with SRT timestamps |
| `json` | id, filename, duration, createdAt, transcript, segments, language |
| `docx` | Title + date + body via `docx` Packer |

Require completed transcript. Primary: Save dialog. Secondary: workspace `transcripts/` (create if needed). Exports to user-chosen workspace paths are **user-owned files** (plaintext by user choice) — do not re-encrypt lawyer-chosen export destinations; warn once that exports leave the encrypted store.

---

## Phases + exit criteria

### P0 — Scaffold + ABI smoke

**Work:** Extension skeleton; gulp/dirs; empty webview; CapabilityService stubs; try-load kutalia; Linux EH smoke + Windows sign-off.

**Exit:** Extension activates in product; kutalia loads **or** documented pivot to B opened with evidence; no silent plaintext storage.

### P1 — Encrypted store + purge

**Work:** Catalog + sealed blobs; DEK; fail-closed; Clear Audio Cache.

**Exit:** Unit tests prove envelope on disk (not plaintext WAV/JSON); purge removes artifacts; SecretStorage failure → memory-only + warning.

### P2 — Recorder UI

**Work:** MediaRecorder lifecycle; list/playback; commands + nls.

**Exit:** Record → sealed store → list → playback works in desktop EH; mic permission errors handled.

### P3 — ffmpeg import/convert

**Work:** Detect BYO ffmpeg; hard gates; import matrix; convert-to-WAV.

**Exit:** Missing ffmpeg → non-WAV actions blocked with guidance; with ffmpeg, import mp3/webm/m4a and convert succeeds.

### P4 — Whisper + progress

**Work:** BYO model path; WhisperHost; progress events; status machine.

**Exit:** Short WAV fixture transcribes with real model when configured; missing model hard-disables; progress visible in UI.

### P5 — Export

**Work:** Four formats; Save dialog; commands/card actions.

**Exit:** Each format golden-tested (string fixtures); docx opens in documents viewer or Word.

### P6 — Tests + docs pointers

**Work:** Full test suite; master plan + tracker updates; copyright audit.

**Exit:** `bun`/mocha suite green without real model; optional `SAFEAPPEALS_AUDIO_REAL_MODEL=1` smoke documented; tracker + master point here.

### P7 — Rung 14 deferrals (design note only)

**Work:** Short section in this plan / packaging checklist — no pretend bundling.

**Exit:** Explicit list deferred (below); v1 still BYO.

---

## Explicit deferrals → rung 14

1. Bundle `resources/ffmpeg/{platform}/` and ship beside app.
2. Bundle `resources/models/whisper/.../ggml-model.bin` + productized download script.
3. Prebuild / CI matrix for audio natives (kutalia verification **or** `sa-audio` binaries if B).
4. Download UX in-app for models (v1 = path setting + docs).
5. Upstream `speech` / `agentsVoice` evaluation (post-working recorder).
6. RAG indexing of transcripts (void cancelled; revisit after rung 10).

---

## Docs / tracker pointer updates (same PR as P6)

1. **Master plan** `r9-audio` todo → point at `safeappeals_audio_r9_production.plan.md` (converter style).
2. **Body** of master plan rung 9 section → one paragraph + this path.
3. **`docs/ADDED_FEATURES_TRACKER.md`** audio row → Partial/In progress + this plan path when implementation starts; Wired when gulped.

---

## Test strategy

| Layer | What | Real model? |
|-------|------|-------------|
| Unit | Capability gates, path detect mocks, catalog CRUD, seal/open round-trip, SRT/TXT/JSON formatters, progress reducer, import extension filter | No |
| Unit | WhisperHost with injected fake `transcribe` | No |
| Fixture smoke | Short silent/synthetic WAV → convert args construction; export snapshots | No |
| Integration (optional CI job) | Real kutalia + tiny GGML + system ffmpeg | Yes — gated env |
| Manual | Mic record, long import, Windows load, DEK loss warning | Yes |

Minimize assertions: prefer one `assert.deepStrictEqual` snapshot per export/formatter case (AGENTS.md learnings).

---

## Risks and blast radius

| Risk | Mitigation |
|------|------------|
| kutalia fails on Electron 42 / Windows | P0 smoke; pivot to B. **Known:** npm `@kutalia/whisper-node-addon@1.1.0` prebuilds target Electron **37 / ABI 125**; SafeAppeals is Electron **42.6.0**. Also set `translate: false` (package default is true). macOS loader expects `darwin-*` but tarball may ship `mac-*`. |
| Large hearings / memory | Stream/chunk seal if needed; avoid holding multiple decrypts |
| Temp plaintext WAV during transcribe | `tmp/` under globalStorage, 0600, wipe in `finally`, purge covers orphans |
| EH freeze on long CPU transcription | Progress events; consider `setImmediate` yields; document GPU vs CPU |
| Accidental cloud/speech coupling | No upstream speech until post-ship eval |
| False completeness without ffmpeg/model | Hard-disable + guidance |
| Copyright / headers | Safe Appeals on new product files |

---

## Open questions for Steve

**Locked Aug 3 2026 (Steve green light):**

1. **Default BYO model** — `distil-large-v3.5` GGML via `safeappeals.audio.whisperModelPath`; smaller override allowed.
2. **Export destination** — Save dialog primary; workspace `transcripts/` secondary.
3. **Windows P0 sign-off** — Steve signs off kutalia load on win32 when a Windows box is available; Linux EH smoke proceeds now.

---

## Implementation order (coder checklist)

1. P0 scaffold + gulp/dirs + ABI smoke (gate pivot).
2. P1 RecordingStore + purge + settings contributions.
3. P2 webview MediaRecorder + AudioService message protocol.
4. P3 FfmpegHost + import gates.
5. P4 WhisperHost + progress + model gate.
6. P5 ExportService + commands.
7. P6 tests + master/tracker pointers.
8. P7 rung-14 deferral note only.

**Fallback path (only if P0 fails):** introduce `rust/audio` (`sa-audio`) NDJSON: `ping`, `dep_detect`, `convert_wav`, `transcribe` (progress lines), `shutdown`; TS keeps UI/storage/export; same capability contract.
