---
name: SafeAppeals Audio ML Resource Engine
overview: "Process-local MlResourceEngine in safeappeals-audio coordinating exclusive heavy slots (Whisper, Diarization, future Embedding/RAG) with queue, cancellation, idle eviction, and peak RSS budget. Spike: minimal engine + sherpa-onnx post-Whisper diarization (no re-ASR). Long-term: Rust sidecar owns heavy backends; RAG registers the embedding slot without OOM fights."
todos:
  - id: e0-engine-core
    content: "E0: Add src/ml/resourceEngine.ts (+ types/errors/events) — exclusive heavy lane, FIFO queue, lease acquire/release, cancel, idle eviction timer, estimated peakRssBudget; unit tests for races/cancel/evict"
    status: pending
  - id: e1-whisper-adapter
    content: "E1: Wrap WhisperHost behind WhisperSlotAdapter — acquire before transcribe, explicit unload/release after job (best-effort GC + drop warm cache); AudioService routes all ASR through engine"
    status: pending
  - id: e2-diar-host-align
    content: "E2: DiarizationHost (sherpa-onnx CLI spawn for spike) + alignSpeakers(segments, intervals); extend TranscriptSegment with optional speaker; pipeline Whisper→unload→diarize→persist; capability gate + hard-disable if models missing"
    status: pending
  - id: e3-ui-export
    content: "E3: Sidebar/command Identify Speakers (or auto after transcribe setting); TXT/SRT/JSON speaker-aware export; progress events via engine snapshot"
    status: pending
  - id: e4-budget-telemetry
    content: "E4: Record estimated RSS + optional child-process peak from /proc; settings for peakRssBudgetMb + idleUnloadMs; document measured numbers from spike (~126MB diar)"
    status: pending
  - id: e5-rag-hook
    content: "E5 (later/rung10): Reserve embedding slot + registration API; extract shared contract before safeappeals-rag ships; prefer sa-ml / rag-core process ownership for real RSS"
    status: pending
isProject: true
---

# SafeAppeals — Local ML Resource Engine + Diarization

## Recommendation

Build a **process-local `MlResourceEngine`** under **`extensions/safeappeals-audio/src/ml/`** that owns **acquire/release leases**, a **single exclusive “heavy” lane** (Whisper XOR Diarization XOR Embedding), a **FIFO wait queue**, **cancellation**, **idle eviction**, and a **peak RSS budget** (estimated now, process-true later). Wire **WhisperHost** and a new **DiarizationHost** through that API so ASR and speaker labeling never race or double-load. Keep **Whisper (kutalia GGML) for words**; add **sherpa-onnx OfflineSpeakerDiarization** (seg ONNX + CAM++ ~28MB) **after** Whisper, assign speakers by **max time overlap**, **no re-ASR**. Spike backend for diarization: **spawn the proven CLI** from `.spike-diarization/` (npm `sherpa-onnx` OK as EH fallback). **Trade-off accepted:** EH-resident Whisper cannot hard-enforce RSS the way a Rust sidecar can, so the spike engine uses **lease serialization + estimated budgets + explicit unload**; when RAG (`safeappeals-rag` / `rust/rag-core`) lands, promote real process ownership to a **Rust ML sidecar** (or expand rag-core) while keeping this TypeScript API stable. Reject workbench DI and a new host extension for the spike.

## Prior session notes (how this builds on them)

Honored (not reopened):

| Source | Decision |
|--------|----------|
| R9 audio plan | Architecture A: kutalia Whisper + ffmpeg spawn in EH; encryptedStore; extension-first; no workbench contrib |
| Research (Aug 4) | Keep Whisper ASR; sherpa-onnx diarization after; overlap-assign; unload Whisper before diar; leave RAG headroom; Rust sidecar long-term |
| Steve (Aug 4) | Spike approved; also wants a proper load/unload engine because RAG will share the machine |
| Spike results | CLI `sherpa-onnx-offline-speaker-diarization` v1.13.4; ~**126 MB** peak RSS; ~14× realtime on test clip; models under `.spike-diarization/` |
| Master plan rung 10 | RAG is **separate** `safeappeals-rag` + `rust/rag-core` (napi-rs); not built inside audio |
| Obsidian vault | No durable notes found for this engine topic; session transcript + R9/R8 plans are the source of truth |

R9 plan owns the **recorder product**; it does **not** own diarization/engine. This file is the SoT for the engine + diarization spike. Cross-link from R9 “deferred” only when wiring docs.

**Gap today (must fix via engine):** `WhisperHost` caches the addon `transcribe` fn with **no unload**, `AudioService.transcribeRecording` has **no mutex** — two UI actions can overlap Whisper loads and OOM an 8GB laptop.

---

## Architecture pick (committed)

| Option | Verdict |
|--------|---------|
| **A — TS `MlResourceEngine` in `safeappeals-audio` + adapters** | **PICK (now)** — ships with diarization; fixes races immediately; API shaped for RAG registration later |
| **B — New `safeappeals-ml` extension as singleton host** | **Defer** — correct for multi-extension process sharing, overkill before RAG activates |
| **C — Workbench `IMlResourceService`** | **Reject** — violates extension-first product stance |
| **D — Shared package singleton only** | **Reject as sole owner** — esbuild/bundling duplicates modules across extensions; unreliable singleton |
| **E — Rust `sa-ml` sidecar owns all heavy models** | **Long-term target** — real RSS, crash isolation; Whisper may stay EH until Architecture B pivot |

```
┌─ extensions/safeappeals-audio ─────────────────────────────────────┐
│  AudioService (pipeline orchestrator)                               │
│       │                                                             │
│       ▼                                                             │
│  MlResourceEngine  ←── lease / queue / cancel / evict / budget      │
│       │                                                             │
│       ├── WhisperSlotAdapter → WhisperHost (kutalia, EH)            │
│       ├── DiarizationSlotAdapter → DiarizationHost (CLI/npm)        │
│       ├── EmbeddingSlotAdapter → (stub / future rag-core)           │
│       └── FfmpegLane (separate semaphore; short-lived spawn)        │
│                                                                     │
│  alignSpeakers(whisperSegments, diarIntervals) → speaker tags       │
│  RecordingStore (encrypted) + ExportService                         │
└────────────────────────────────────────────────────────────────────┘
         future: same engine contract imported by safeappeals-rag
         (extract package / host extension when second consumer ships)
```

---

## 1. Engine responsibilities

The engine is the **only** component allowed to transition heavy model residency.

| Responsibility | Behavior |
|----------------|----------|
| **Acquire / release** | Callers obtain a `MlLease` for a `ResourceKind`. Work runs only while lease held. `release` / `Symbol.dispose` mandatory; `try/finally` via `withLease`. |
| **Exclusive vs shared** | **Heavy kinds** (`whisper`, `diarization`, `embedding`) share one **exclusive heavy lane** (capacity 1). Same-kind re-entrant acquire by the *same job* is allowed (refcount). Cross-kind heavy acquire waits or fails per policy. |
| **Queue** | FIFO waiters when lane busy. Optional later: priority (`user` > `background`). Fairness: no starvation — idle eviction cannot jump the queue ahead of waiters. |
| **Cancellation** | Each acquire takes `AbortSignal`. Cancel removes queued waiter **or** asks active adapter to abort; lease rejects with `MlCancelledError`. |
| **Idle eviction** | After last release, start `idleUnloadMs` timer (default **30s**). On fire: adapter `unload()`, mark slot cold. Cancel timer if new acquire arrives. |
| **Peak RSS budget** | `peakRssBudgetMb` (default **2048** for EH+children on 8GB class machines; machine-scoped setting). Before load, `currentEstimate + kind.estimateMb <= budget` or evict cold/idle slots; if still over → `MlBudgetExceededError` (never soft-ignore). Spike: estimates from table below; optional child `/proc` RSS for CLI. |
| **Crash recovery** | Adapter `onCrash` → engine marks slot cold, fails active lease, drains waiters with `MlBackendCrashedError`, does **not** auto-reload until next acquire. |
| **Telemetry / UI** | `getSnapshot()` + `onDidChange` for sidebar (“Whisper loaded”, “Queued behind diarization…”). |
| **Non-goals** | Not a job scheduler for UI; not a vector DB; not responsible for encrypting audio (RecordingStore stays owner). |

### Concurrency model (JS)

Single-threaded EH + async: protect with an **async mutex** around state transitions (no parallel `load`/`unload`). Adapters may run native work off-thread; engine never assumes unload is instant — `unload()` returns a Promise and lane stays held until complete.

### Default policy: serialize heavies

```
at most one of {whisper, diarization, embedding} resident+running
ffmpeg convert: separate lane (max 1), may run before whisper within the same job
  after whisper lease is held or as a pre-step that does not keep whisper warm
```

---

## 2. Resource types / slots

| Kind | Lane | Est. RSS (spike) | Backend now | Backend later |
|------|------|------------------|-------------|---------------|
| `whisper` | heavy exclusive | **800** MB (ggml-base.en + runtime; tune after measure) | kutalia in EH | optional `sa-audio` if Arch B |
| `diarization` | heavy exclusive | **200** MB (spike measured ~126 MB CLI) | sherpa-onnx **CLI spawn** | Rust sidecar / npm / speakrs |
| `embedding` | heavy exclusive | **400** MB reserved (rag-core MiniLM class; tune at rung 10) | **stub adapter** (refuse acquire with clear error until registered) | `rust/rag-core` napi or sidecar |
| `ffmpeg` | utility lane | process RSS; short-lived | existing `FfmpegHost` spawn | unchanged |

**Affinity rules (committed):**

1. Acquiring `diarization` **requires** whisper unloaded first (engine evicts whisper even if idle timer not fired).
2. Acquiring `embedding` **requires** whisper + diarization unloaded.
3. Acquiring `whisper` evicts diarization/embedding if cold or idle; if another heavy job is active, queue.
4. Never load whisper + diarization concurrently (even if budget “fits”) — **policy**, not just math — old laptops fragment under dual native heaps.

---

## 3. TypeScript-facing API sketch

Files: `src/ml/types.ts`, `src/ml/errors.ts`, `src/ml/resourceEngine.ts`, `src/ml/adapters/*.ts`.

```typescript
type ResourceKind = 'whisper' | 'diarization' | 'embedding' | 'ffmpeg';

interface MlEngineOptions {
	peakRssBudgetMb: number;          // default 2048
	idleUnloadMs: number;             // default 30_000
	acquireTimeoutMs: number;         // default 15 * 60_000
	estimatesMb: Record<ResourceKind, number>;
}

interface MlLease {
	readonly id: string;
	readonly kind: ResourceKind;
	readonly jobId: string;
	release(): Promise<void>;
}

interface MlEngineSnapshot {
	heavyKindLoaded?: ResourceKind;
	activeJobId?: string;
	queueLength: number;
	estimatedRssMb: number;
	budgetMb: number;
	slots: Record<ResourceKind, {
		state: 'cold' | 'loading' | 'ready' | 'running' | 'unloading' | 'crashed';
		refCount: number;
		lastUsedAt?: number;
	}>;
}

interface ResourceAdapter {
	readonly kind: ResourceKind;
	readonly estimateMb: number;
	load(signal: AbortSignal): Promise<void>;
	unload(): Promise<void>;
	/** Optional: cooperative cancel of in-flight native work */
	cancel?(reason: string): void;
	isLoaded(): boolean;
}

interface AcquireOptions {
	jobId: string;
	signal?: AbortSignal;
	/** When true, fail fast instead of queue (UI double-click) */
	rejectIfBusy?: boolean;
}

declare class MlResourceEngine {
	constructor(options: MlEngineOptions, adapters: ResourceAdapter[]);
	acquire(kind: ResourceKind, options: AcquireOptions): Promise<MlLease>;
	withLease<T>(kind: ResourceKind, options: AcquireOptions, fn: (lease: MlLease) => Promise<T>): Promise<T>;
	/** Register/replace adapter (RAG later) */
	registerAdapter(adapter: ResourceAdapter): void;
	requestUnload(kind: ResourceKind): Promise<void>;
	cancelJob(jobId: string, reason?: string): void;
	getSnapshot(): MlEngineSnapshot;
	readonly onDidChange: vscode.Event<MlEngineSnapshot>;
	dispose(): Promise<void>;
}

// Errors (instanceof checks in AudioService / UI)
class MlError extends Error { readonly code: string; }
class MlCancelledError extends MlError {}
class MlBusyError extends MlError {}              // rejectIfBusy
class MlAcquireTimeoutError extends MlError {}
class MlBudgetExceededError extends MlError {}
class MlBackendUnavailableError extends MlError {}
class MlBackendCrashedError extends MlError {}
```

### Host usage (Whisper / Diar / future RAG)

```typescript
// AudioService.transcribeRecording
await engine.withLease('whisper', { jobId, signal }, async () => {
	// optional: ffmpeg convert outside or under ffmpeg lane
	return whisperHost.transcribe(id, input);
});
// release → idle eviction → unload whisper

// AudioService.diarizeRecording (after transcript exists)
await engine.withLease('diarization', { jobId, signal }, async () => {
	const intervals = await diarizationHost.diarize(wavPath, { numSpeakers });
	return alignSpeakers(segments, intervals);
});

// Future RAG extension (same process contract)
await engine.withLease('embedding', { jobId, signal }, async () => {
	return ragCore.embedBatch(chunks);
});
```

### Pipeline (product path)

```
decrypt audio → [ffmpeg if needed] → acquire whisper → ASR → persist segments
  → release/unload whisper → acquire diarization → intervals → align
  → persist speaker on segments → release/unload diarization → export
```

---

## 4. Where it lives

| Placement | Verdict |
|-----------|---------|
| **`extensions/safeappeals-audio/src/ml/`** | **PICK now** |
| Extract to `extensions/safeappeals-shared` or tiny `safeappeals-ml-runtime` | **When RAG becomes second consumer** (before rag ships concurrent jobs) |
| New `safeappeals-ml` extension exporting activation API | **Optional** if shared-package singleton proves unreliable |
| `src/vs/workbench/...` | **Never** for this feature |

**Rationale:** Audio is the first (and currently only) heavy ML consumer; R9 already owns kutalia lifecycle. Putting the engine beside WhisperHost avoids premature package extraction. The API is **adapter-based and AudioService-free** so RAG can later `registerAdapter('embedding')` after extract. Bundled-module singleton risk is acknowledged — **extract trigger** is “second extension needs concurrent coordination,” not “nice to have.”

Ownership: **safeappeals-audio** owns the EH singleton for spike/v1. Master plan rung 10 must **call into this contract** (or the extracted package) rather than loading embeddings ad hoc.

---

## 5. Sequencing — NOW vs later

### NOW (spike → shippable slice)

1. **E0 Engine core** + unit tests (queue, cancel, exclusive eviction, budget fail).
2. **E1 Whisper adapter** — all transcription goes through `withLease('whisper')`; add best-effort unload (drop caches / document kutalia limits if addon keeps process RSS).
3. **E2 DiarizationHost** — spawn CLI (paths from settings or managed model dir); `alignSpeakers`; extend `TranscriptSegment` with `speaker?: string` (`Speaker 1`…); persist on `StoredRecording`.
4. Capability gate: hard-disable Identify Speakers when seg/emb models or binary missing (converter pattern).
5. Measure: wall + peak RSS with Whisper unloaded; English 2-speaker sample.
6. Minimal export: JSON/TXT/SRT include speaker when present.

### Later (not spike)

- Rust `sa-ml` / speakrs / npm sherpa-onnx promotion; Windows/macOS packaging (rung 14).
- Idle eviction tuning from real field RSS; `/proc` or Windows WorkingSet sampling.
- `embedding` adapter + extract shared package; cross-extension host if needed.
- Auto speaker naming / enrollment; maxSpeakers UX polish beyond 2–4 default.
- Agent tools for diarize; RAG indexing of speaker-tagged transcripts.
- Moving Whisper itself into sidecar (only if kutalia unload proves insufficient).

---

## 6. Failure modes

| Scenario | Behavior |
|----------|----------|
| **Mid-job model switch** (user starts diarize while ASR running) | Diarize **queues**; UI shows “Waiting for transcription…”. `rejectIfBusy` on explicit second Transcribe → toast, no second Whisper. |
| **Crash during unload / native abort** | Adapter reports crash → slot `crashed` → active lease fails → queue gets `MlBackendCrashedError` → next acquire attempts fresh `load()`. EH may still hold leaked native RSS — surface warning to restart window if budget trips repeatedly. |
| **EH restart** | All state cold. Catalog/transcripts remain in encryptedStore. In-flight jobs lost; statuses that were `transcribing` recover to `failed` or `pending` on activate (existing store rules — reconcile once). |
| **Two UI actions at once** | Engine serializes. Auto-transcribe + manual transcribe same id: second acquire same jobId refcounts or no-ops if status already `transcribing`. Different recordings: FIFO. |
| **Budget exceeded** | Fail with actionable message (“Unload failed / not enough memory; close other AI features or restart”). Never load “anyway.” |
| **Diarization CLI nonzero exit** | Lease releases; recording keeps ASR text; status/diarize error surfaced; no partial speaker overwrite unless align fully succeeds. |
| **Cancel** | AbortSignal → kill CLI child (`SIGTERM` then `SIGKILL`); Whisper cancel best-effort (kutalia may not support — document; at least stop chaining to diarize). |

---

## 7. Out of scope for spike

- Shipping bundled sherpa/ffmpeg/models (rung 14).
- Full RAG / embeddings / indexing / agent RAG tools.
- Cloud diarization; WhisperX; pyannote-Torch; NeMo.
- Speaker identity / voice enrollment / cross-recording speaker consistency.
- Workbench service; new `safeappeals-ml` extension.
- Replacing kutalia with whisper.cpp in Rust (unless Arch B pivot criteria from R9 fire).
- Perfect RSS accounting inside EH for kutalia (best-effort unload only).
- Multi-GPU / CUDA product paths (CPU-first).

---

## Implementation order (coder checklist)

1. `src/ml/errors.ts`, `src/ml/types.ts`, `src/ml/resourceEngine.ts` + `src/test/resourceEngine.test.ts`
2. `src/ml/adapters/whisperAdapter.ts` — integrate in `extension.ts` / `AudioService`
3. `src/diarizationHost.ts`, `src/alignSpeakers.ts`, `src/ml/adapters/diarizationAdapter.ts`
4. Types + store fields for `speaker`; export updates
5. CapabilityService + settings (`safeappeals.audio.diarization*`, `peakRssBudgetMb`, `idleUnloadMs`) — **machine scope**
6. Sidebar protocol + nls strings
7. Spike artifacts stay gitignored (`.spike-diarization/`); product paths under `globalStorageUri/models/diarization/` when download lands (post-spike)

---

## Risks and blast radius

| Risk | Mitigation |
|------|------------|
| kutalia does not free RAM on “unload” | Serialize + warn + optional window reload; track Arch B |
| CLI path/ABI on Windows | Spike Linux-first; Windows gate before product default-on |
| pyannote seg license | Confirm model card before shipping (research caveat) |
| Double-encryption / temp WAV leaks | Reuse RecordingStore tmp + `finally` wipe; diarize reads same 16 kHz mono WAV as Whisper |
| Engine forgotten by RAG | Master-plan rung 10 must reference this file; E5 todo |
| Tests flake on real RSS | Unit-test engine with fake adapters; RSS tests opt-in env |

**Test plan (minimum):** fake adapters prove exclusive lane + cancel + eviction + budget; alignSpeakers pure function tests; one optional integration behind `SAFEAPPEALS_DIAR_SPIKE=1`.

---

## Docs / plan links

- Detail SoT: **this file**
- Recorder SoT: `safeappeals_audio_r9_production.plan.md` (add one-line pointer to this plan under deferred/follow-ons when editing docs)
- RAG future: master plan rung 10 — must use engine contract before concurrent embed
- Spike dir (dev only): `extensions/safeappeals-audio/.spike-diarization/`

---

## Open assumptions (non-blocking)

1. Default `peakRssBudgetMb = 2048` is appropriate for target 8GB laptops with OS+Electron overhead — tune after field measure.
2. Spike ships Identify Speakers as **explicit action or post-transcribe setting** (default off until models managed); not blocking engine merge.
3. `Speaker N` labels are per-recording only for v1.
