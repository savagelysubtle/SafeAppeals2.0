# TODO (Windows dev): rebuild time-tracker native prebuilds

**Status: Windows time tracking is broken on branch `update-vscode` until this is
done.** Linux is fine. Nothing else in the app is affected.

Owner: whoever has a Windows box with MSVC.
Introduced by: `fa3fddf3` "Security: encrypt local data at rest".
Detail reference: [`extensions/time-tracker/PREBUILDS.md`](extensions/time-tracker/PREBUILDS.md).

## What happened

The time-tracker's billing database (client names, matter numbers, hourly rates,
time-entry descriptions) used to be stored as **plaintext SQLite** in
`~/.safe-appeals-navigator`. It is now encrypted with SQLCipher, which meant
swapping the `better-sqlite3` dependency for `better-sqlite3-multiple-ciphers`.

That package ships a **native addon**, and we commit prebuilt binaries per
platform and ABI. The committed `win32-x64` binaries were builds of the *old*
package, so they were deleted rather than left in place — see below for why.
There are currently no Windows binaries at all, so on Windows the extension
fails to initialize with a message pointing at the missing binding path.

## Why the old Windows binaries were deleted instead of reused

This is the part worth understanding before you "fix" it by restoring them from
git history. **Don't.**

The old `.node` files export the same symbols and would load fine against the
new JavaScript. But they contain no cipher implementation, so the
`PRAGMA cipher` / `PRAGMA legacy` calls would be silently ignored and `db.key()`
would not encrypt anything. The database would look keyed and still be written
to disk as **plaintext** — a fail-open security hole, and a silent one.

A missing binary fails loudly. A mismatched binary fails open. We chose loud.

As a backstop, `StorageService.assertEncryptedOnDisk()` reads the first 16 bytes
after opening and refuses to use the database if they are still the plaintext
SQLite magic (`SQLite format 3\0`). So even if a wrong binary is introduced
later, it will hard-fail rather than quietly leak. Do not weaken that check.

## Prerequisites

- Windows with **MSVC build tools** (Visual Studio C++ workload) and Python, as
  `node-gyp` requires. Cross-compiling from Linux is not possible.
- **Node 24.x — this matters.** `.nvmrc` pins `24.18.0`.

The second point is a real trap. The rebuild script names the output folder from
whatever ABI the host Node reports:

```js
copyBinding(`node-${process.versions.modules}`);
```

Node 24 reports `137`, which is the folder the extension looks in. If you build
on Node 22 you will get a `node-127` folder instead, the commit will look
correct, and Windows will still be broken. Check first:

```bat
node -p "process.version + ' abi=' + process.versions.modules"
```

Expect `v24.x` and `abi=137`. Use `fnm use 24.18.0` if not.

## Steps

```bat
cd extensions\time-tracker
npm install
npm run rebuild-prebuilds
```

`npm install` builds the Electron ABI 146 binary (the extension's local `.npmrc`
pins Electron 42.6.0 headers and forces `build_from_source`), then
`rebuild-prebuilds` rebuilds for host Node and copies both into place.

## Verify before committing

1. Both files exist and are ~2.7 MB, not ~1.9 MB. The old plain builds were
   about 1.9 MB; the ciphers builds are noticeably larger:

   - `prebuilds\win32-x64\electron-146\better_sqlite3.node`
   - `prebuilds\win32-x64\node-137\better_sqlite3.node`

2. The Node binding actually has the cipher API — this is the check that
   distinguishes a correct build from the old one:

   ```bat
   node -e "const D=require('better-sqlite3-multiple-ciphers');const db=new D(':memory:',{nativeBinding:'prebuilds/win32-x64/node-137/better_sqlite3.node'});console.log(typeof db.key)"
   ```

   Expect `function`. If it prints `undefined`, you built the wrong package.

3. End to end in the app: launch the desktop build, open the Time Tracker, add a
   matter and a time entry, then confirm the database does **not** begin with
   `SQLite format 3`. For an installed build it lives at:

   ```
   %APPDATA%\Safe Appeals\User\globalStorage\safeappeals.time-tracker\workspaces\<hash>\timetracker.db
   ```

   Running from sources it is under your `--user-data-dir` instead (by default
   `.build\user-data`), same `User\globalStorage\...` suffix. `<hash>` is the
   first 16 hex characters of the SHA-256 of the workspace folder path, so there
   is one database per workspace.

   ```powershell
   $fs = [System.IO.File]::OpenRead("timetracker.db")
   $b = New-Object byte[] 16
   $fs.Read($b, 0, 16) | Out-Null
   $fs.Close()
   -join ($b | ForEach-Object { [char]$_ })
   ```

   You should see binary noise. Seeing `SQLite format 3` means encryption is not
   active — stop and report it rather than shipping.

## Also worth checking while you're on Windows

The migration path only runs on machines that have the old plaintext database.
If you have a real `%USERPROFILE%\.safe-appeals-navigator\databases\workspaces\<hash>\timetracker.db`
with data in it, confirm your entries survive the upgrade: the code copies the file,
rekeys it, verifies row counts for `matters` / `billing_rates` / `time_entries`,
and only then deletes the original. A count mismatch rolls back and leaves the
old file alone. Worth exercising once with real data on Windows, since Linux
testing used a synthetic database.

## Commit

Commit only the two binaries. Suggested message:

```
Fix: add win32-x64 SQLCipher prebuilds for time-tracker

Restores Windows time tracking after the switch to
better-sqlite3-multiple-ciphers. Built on Windows with MSVC, Node 24.18.0.
```

Delete this file once both binaries are committed and verified.
