---
name: Local Storage Security Hardening
overview:
  "Encrypt-at-rest for all SafeAppeals local data stores, per the Jul 29 2026
  storage audit. Credentials already live in SecretStorage (good); the gap is
  content: email cache, time-tracker billing DB, calendar cache, and PDF
  signatures are plaintext on disk. Strategy: one shared crypto helper
  (AES-256-GCM, data-encryption key in SecretStorage), applied store by store
  in risk order, with plaintext migration + purge commands, plus config/secrets
  hygiene and a permanent AGENTS.md rule so new stores are born secure."
todos:
  - id: sec0-agents-rule
    content: "Phase 0: AGENTS.md 'Local Data Security' rule — encryption-at-rest
      mandatory for new DBs/caches; secrets in SecretStorage; managed storage
      paths only; purge paths required"
    status: completed
  - id: sec1-crypto-helper
    content: "Phase 1: shared encryptedStore helper (canonical
      extensions/safeappeals-shared/src + committed per-extension copies kept
      in sync by build/npm/sync-safeappeals-shared.ts and a hygiene check) —
      DEK in SecretStorage, AES-256-GCM envelope, atomic 0600 writes,
      plaintext-migration reader, 8 unit tests"
    status: completed
  - id: sec2-email-index
    content: "Phase 2: encrypt EmailIndex (all 5 JSON files) + in-place
      migration + fail-safe in-memory mode when keychain unavailable +
      'Clear Local Email Cache' command"
    status: completed
  - id: sec3-time-tracker
    content: "Phase 3: time-tracker — relocate DB under globalStorageUri,
      switch to better-sqlite3-multiple-ciphers (SQLCipher) keyed from
      SecretStorage, regenerate prebuilds (electron-146 + node-137, win32/linux
      x64), migrate + delete ~/.safe-appeals-navigator"
    status: completed
  - id: sec4-calendar-cache
    content: "Phase 4: encrypt calendar events-cache.json + sync-meta.json via
      shared helper, with migration + 'Clear Local Calendar Cache' command"
    status: completed
  - id: sec5-signatures
    content: "Phase 5: move saved PDF signatures from workspaceState to
      SecretStorage; move annotations (text + imageData) to encrypted file
      under storageUri, falling back to globalStorageUri when no folder is open"
    status: completed
  - id: sec6-config-hygiene
    content: "Phase 6: machine-scope sensitive settings (google/outlook client
      credentials, email account metadata); gate addAccount/connect in web
      builds (uiKind === Web) until a persistent encrypted secret provider exists"
    status: completed
  - id: sec7-docs
    content: "Phase 7: user-facing docs — plaintext-by-design surfaces (case
      folders, profile rule) + full-disk-encryption recommendation"
    status: pending
---

# Local Storage Security Hardening

Source audit: chat session Jul 29 2026 (canvas: `local-storage-security-audit.canvas.tsx`).
Findings recap — HIGH: email cache plaintext JSON, time-tracker plaintext SQLite in
`~/.safe-appeals-navigator`; MEDIUM: calendar cache, PDF signatures in workspaceState,
web-mode secrets; LOW: `google.clientSecret` in synced settings, profile PII rule file.

## Design decisions (locked)

- **One global email store stays global.** No per-workspace partitioning for the
  inbox — the time-tracker's workspace id is a partitioning key, not a security
  boundary, and would fragment mail for no gain.
- **Key management pattern for every store:** random 256-bit data-encryption key
  (DEK) generated on first use, stored base64 in `context.secrets` under
  `<ext>.dek.<storeName>`. The DEK encrypts files; SecretStorage never holds bulk
  data. Node built-in `crypto` only — no new runtime dependency for JSON stores.
- **Envelope format:** `SAENC1` magic + version byte + 12-byte IV + 16-byte GCM
  auth tag + ciphertext. Version byte allows future key rotation / format changes.
- **Fail-safe, never fail-open:** if SecretStorage is unavailable or in-memory
  (headless Linux without keyring, browser builds), stores run in-memory (email:
  headers-only) with a one-time warning. Plaintext is never written as a fallback.
- **Migration is one-way:** on load, if a legacy plaintext file parses, re-save
  encrypted, then delete the plaintext file. Log the migration.
- **File hygiene everywhere:** directories 0700, files 0600 (POSIX; no-op on
  Windows), atomic write via tmp-file + rename.
- **Purge paths are part of the feature:** every store gets/keeps a clear-cache
  command and cleans up on account/provider removal.

## Implementation deviations from the original design (approved Jul 29)

1. **Sharing is by committed copies, not esbuild bundling.** Extension-host code
   compiles via gulp/tsgo with `rootDir: "./src"`, so a cross-extension relative
   import does not compile; esbuild only builds webview bundles here. Canonical
   source lives in `extensions/safeappeals-shared/src/` (deliberately no
   `package.json` and no `tsconfig.json`, or the build would ship it as a bogus
   built-in extension), and `build/npm/sync-safeappeals-shared.ts` copies it into
   each consumer's `src/shared/` with a GENERATED banner. Drift is caught by
   `npm run check-safeappeals-shared` and a `build/hygiene.ts` staged-files check.
2. **Encrypt in place; no write-then-delete.** The encrypted file reuses the same
   path, so the atomic overwrite *is* the deletion of the plaintext.
3. **Fail-safe is in-memory, not headers-only.** Nothing reaching disk is the
   security goal; keeping data in RAM keeps the product usable and leaves
   `syncEngine.ts` untouched.
4. **Corrupt files are quarantined, not discarded** — renamed to
   `<name>.corrupt-<ISO>` before anything overwrites them. Load-bearing for PDF
   annotations, which are not regenerable from a server.
5. **Never mint a key over existing data.** If the DEK is missing while encrypted
   files exist, stores enter fail-safe and tell the user to run the clear-cache
   command, rather than silently generating a new key and orphaning the data.
6. **PDF annotations fall back to `globalStorageUri`** when no folder is open.
   The original spec's memory-only path silently lost annotations for
   single-file PDF sessions, which previously persisted via `workspaceState`.

## Phase 1 — Shared crypto helper

Canonical source `extensions/safeappeals-shared/src/encryptedStore.ts`
(+ `secureFs.ts`), copied into each consuming extension's `src/shared/` by
`build/npm/sync-safeappeals-shared.ts`. Built-in extensions cannot share a
runtime package, so this is compile-time sharing with one source of truth.

API sketch:

- `getOrCreateDek(secrets: vscode.SecretStorage, keyId: string): Promise<Buffer | undefined>`
  — undefined means SecretStorage unusable (round-trip probe failed) → caller
  enters fail-safe mode.
- `seal(plaintext: Buffer, dek: Buffer): Buffer` / `open(envelope: Buffer, dek: Buffer): Buffer`
  — AES-256-GCM, throws on auth failure (tamper detection).
- `readEncryptedJson<T>(path, dek): Promise<T | undefined>` — handles: missing
  file, encrypted envelope, legacy plaintext JSON (returns parsed + flags
  `needsMigration`).
- `writeEncryptedJson(path, value, dek)` — atomic, 0600.

Tests (extension unit tests, per repo test runner): round-trip, tampered tag
rejected, plaintext migration path, missing-keyring probe. One snapshot-style
assertion per behavior.

## Phase 2 — Email index (HIGH)

`extensions/safeappeals-email/src/emailIndex.ts`:

- `initialize()` acquires the DEK; `load()`/`save*()` go through the helper for
  all five files (`email-index.json`, `email-drafts.json`, `email-sync-meta.json`,
  `email-case-links.json`, `email-tags.json`).
- Fail-safe mode: no DEK → in-memory only, sync limited to headers, warning with
  a "Learn more" link. `saveDraft` still works in-memory (warn drafts won't persist).
- New command `safeappeals-email.clearLocalCache` — deletes all five files +
  resets in-memory state (accounts/credentials untouched).
- Keep `clearAccount()` behavior on account removal (already implemented).
- Optional follow-up (separate toggle, default on): `safeappealsEmail.cacheBodies`
  — when off, bodies are fetched per-open and never persisted.

## Phase 3 — Time tracker (HIGH)

`extensions/time-tracker/src/storageService.ts`:

- **Relocate:** `~/.safe-appeals-navigator/databases/workspaces/<id>/timetracker.db`
  → `context.globalStorageUri/workspaces/<id>/timetracker.db`. Keep the
  workspace-hash partitioning (it's the product model), lose the bare home-dir path.
- **Encrypt:** swap `better-sqlite3` → `better-sqlite3-multiple-ciphers`
  (drop-in, SQLCipher-compatible); `PRAGMA key` from a DEK via the shared helper
  (hex keyspec, so the DB never sees a passphrase-derived key).
- **Prebuilds:** regenerate all four binaries (win32-x64 + linux-x64 ×
  electron-146 + node-137) — same pipeline that produced the current
  `prebuilds/` tree. This is the bulk of the phase's effort.
- **Migrate:** on init, if the legacy plaintext DB exists: open both, copy
  tables, verify row counts, delete legacy file, best-effort remove empty
  `~/.safe-appeals-navigator` tree.
- Fail-safe: no DEK → extension reports "time tracking unavailable" rather than
  opening plaintext.

## Phase 4 — Calendar cache (MEDIUM)

`extensions/safeappeals-calendar/src/eventCache.ts`: same helper treatment for
`events-cache.json` + `sync-meta.json` (sync-meta holds sync tokens — mildly
sensitive), migration included. Clear-on-disconnect already exists
(`clearProvider`); keep it.

## Phase 5 — Signatures & annotations (MEDIUM)

`extensions/safeappeals-documents/src/pdf/annotationStore.ts`:

- Saved signatures (`void.pdfSavedSignatures`) → SecretStorage (small base64
  PNGs, high forgery value). Migrate from workspaceState, then delete the key.
- Annotations (`void.pdfAnnotations` — text + document-snapshot `imageData`) →
  encrypted JSON file under `context.storageUri` (per-workspace) via the helper.
  workspaceState keeps only the trivial last-page keys.

## Phase 6 — Config & secrets hygiene (MEDIUM/LOW)

- `safeappealsCalendar.google.clientSecret` and `safeappealsEmail.accounts`
  (host/username metadata): add `"scope": "machine"` in each `package.json`
  configuration contribution so Settings Sync never uploads them. Longer term:
  PKCE-only loopback for Google (drop the distributed secret).
- Web/serve-web: `BrowserSecretStorageService` is in-memory without an embedder
  provider → detect web extension host and disable add-account / connect
  commands with an explanatory message, until a persistent encrypted
  `secretStorageProvider` is wired into `webClientServer.ts`. Decide that
  provider's design before shipping web mode to clients.

## Phase 7 — Docs

- User-facing security note: what is encrypted, what is plaintext by design
  (case folders, `~/.copilot/instructions` profile rule — injected into every
  chat request), and the recommendation to run full-disk encryption on client
  machines.

## Phase 3 outcome — follow-ups carried out of scope

- `prebuilds/win32-x64/**` was **deleted**, not updated: those were plain
  `better-sqlite3` builds, and pairing one with the ciphers JS makes the cipher
  pragmas no-ops, so the DB would stay plaintext while appearing keyed (fail
  open). Windows time tracking is unavailable until both ABIs are rebuilt on a
  Windows host with MSVC — see `extensions/time-tracker/PREBUILDS.md`. Guard
  against a recurrence: `assertEncryptedOnDisk()` reads the first 16 bytes after
  open and refuses the DB if they are the `SQLite format 3\0` magic.
- Two lockout paths found in review and fixed: an unreadable legacy DB is
  quarantined (`.corrupt-<stamp>`) so startup can continue with a fresh
  encrypted DB rather than failing forever, and a
  `timeTracker.clearLocalDatabase` command is registered *before* `initialize()`
  so it remains usable when the DEK is missing and init throws.

## Explicit non-goals

- No encryption of case workspace folders (`.safeAppeals/case.json`, AGENTS.md,
  documents) — they must stay user-editable files; disk encryption is the
  control there.
- No key rotation UI in v1 (format supports it via the version byte).
- No re-architecture of the email index (JSON files stay; only the envelope
  changes).
