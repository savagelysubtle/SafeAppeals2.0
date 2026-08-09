# SafeAppeals Secure Filesystem Native Helper

This Linux x64 N-API helper is the narrow filesystem primitive used by a cooperative, single-writer legal-data migration. Windows and macOS are intentionally unsupported: loading/building there fails closed.

## Security boundary

`SecureDirectory(trustedRoot, relativePath)` requires both the root and resolved directory to be effective-UID-owned, exact mode-0700 directories. It opens the root without following a symlink, then resolves the relative directory with Linux `openat2(RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS)`. Child APIs accept only one validated basename. All mutation APIs live on a `DirectoryLock` token created by `flock(LOCK_EX | LOCK_NB)` on the directory descriptor itself. Lock acquisition re-resolves the directory path and verifies its device/inode identity.

`openRegularFile` returns a held FD and rejects symlinks, non-regular files, and files whose link count is not one. Activation is deliberately unprivileged: `activateStagedNoReplace` reopens a manifest-owned staging basename, verifies it against the held FD under the directory lock, then uses `renameat2(RENAME_NOREPLACE)` and verifies the destination identity. A mismatch or occupied destination preserves staging.

Destructive work uses a staged protocol:

1. `quarantineCurrent` atomically renames the current basename to a unique `.safeappeals-tx-*` name without replacement.
2. It opens the staged entry and compares it to the expected held FD. A mismatch leaves the staged file intact and fails closed.
3. `deleteQuarantine` accepts only `.safeappeals-tx-*` names, reopens and verifies the entry, then unlinks it while the directory lock is held.

There is deliberately no general `unlinkExpected` or identity-bound pathname rename API.

## Threat-model limit

The directory lock coordinates SafeAppeals processes. Linux does not provide an atomic “unlink this inode only if this pathname still identifies it” operation. A malicious or noncooperative process running as the same UID can mutate the directory namespace between verification and unlink; preventing that requires privilege separation or a private mount/namespace. The helper assumes the trusted 0700 root is not writable by an adversarial same-UID process during migration. It detects cooperative races and common replacement attacks and never silently falls back to path joining.

All handles use RAII and expose idempotent `close`/`dispose`. Errors expose stable machine-readable `error.code` values such as `SA_FS_LOCKED`, `SA_FS_CLOSED`, and `SA_FS_STAGING_MISMATCH`.

`bootstrapPrivateDirectory` accepts a same-UID trusted anchor such as a non-writable `0755` home directory and creates/validates an exact chain of `0700` descendants with parent fsyncs. `openLegacyWorkspace` applies the same no-symlink, non-group/other-writable ancestor rules to the fixed legacy workspace family. `enumerateChildren` performs bounded no-follow immediate enumeration, and `openPrivateChild` returns a validated child handle.

While holding `DirectoryLock`, `createStagedFile` reserves an exclusive `0600` candidate and exposes its held `/proc/self/fd/<fd>` path for SQLite-like writers; `validateStagedFile` revalidates identity and link state. `writeEncryptedManifest` is restricted to `.timetracker-migration-v1.saenc`, writes and fsyncs an owned exclusive temporary, commits with `renameat2`, fsyncs the directory, and requires an expected identity token for updates.

`writeSensitiveState` uses the same locked CAS and durability protocol and is separately restricted to the exact `sensitive-state.saenc` basename and `.safeappeals-tx-sensitive-state-*` temporary family.

`openLegacyWorkspaces` exposes only the fixed navigator workspace family and filters discovery/opening to validated 16-hex private children. `openLegacyCodesWorkspace` resolves an absolute workspace without symlinks and first probes only the fixed `time-tracker-codes.json` target. An absent file returns no capability even when the legitimate workspace is shared. Historical `0600`, `0640`, and `0644` files are accepted only when same-UID, owner-readable, non-group/other-writable, regular, and single-link. A file with any group/other visibility (`0640`/`0644`) additionally requires an exact-0700 workspace; an exact-0600 file may be cleaned from a same-UID non-writable `0755` workspace. The selected policy is revalidated under the cleanup lock. Unrelated workspace files cannot be selected through that API.

```sh
bun run build-secure-fs
bun run test-secure-fs
```
