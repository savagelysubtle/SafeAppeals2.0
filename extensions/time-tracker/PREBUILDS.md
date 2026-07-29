# Time Tracker native prebuilds

`better-sqlite3-multiple-ciphers` ships a native addon. The extension loads it via `{ nativeBinding }` from committed binaries under `prebuilds/`, because the VS Code desktop shell is Electron (ABI 146) while integration tests and `code-web` use plain Node (ABI 137).

## ABI matrix

| Platform   | Runtime  | `process.versions.modules` | Path |
|------------|----------|----------------------------|------|
| linux-x64  | Electron 42.x | 146 | `prebuilds/linux-x64/electron-146/better_sqlite3.node` |
| linux-x64  | Node 24.x     | 137 | `prebuilds/linux-x64/node-137/better_sqlite3.node` |
| win32-x64  | Electron 42.x | 146 | `prebuilds/win32-x64/electron-146/better_sqlite3.node` |
| win32-x64  | Node 24.x     | 137 | `prebuilds/win32-x64/node-137/better_sqlite3.node` |

Why committed: gulp/`npm install` in CI and end-user installs must not compile native code with the Electron headers toolchain. Binaries are checked in so desktop and Node hosts both work out of the box.

**Critical:** these must be builds of `better-sqlite3-multiple-ciphers`, not plain `better-sqlite3`. A plain `.node` with the ciphers JS can silently ignore cipher pragmas and leave the database unencrypted. The runtime also hard-fails if the on-disk file still starts with the plaintext SQLite magic (`SQLite format 3\0`).

## Regenerating (current host platform)

From `extensions/time-tracker`:

```bash
npm install
npm run rebuild-prebuilds
```

That builds both ABIs for `process.platform`-`process.arch` and copies them into `prebuilds/<platform>-<arch>/`.

### Manual commands (one per ABI)

Electron 146 (uses extension `.npmrc` / Electron 42.6.0 headers):

```bash
cd extensions/time-tracker/node_modules/better-sqlite3-multiple-ciphers
npx node-gyp rebuild --release --target=42.6.0 --dist-url=https://electronjs.org/headers --runtime=electron
cp build/Release/better_sqlite3.node ../../prebuilds/<platform>-<arch>/electron-146/better_sqlite3.node
```

Node 137 (host Node, no Electron flags):

```bash
cd extensions/time-tracker/node_modules/better-sqlite3-multiple-ciphers
npx node-gyp rebuild --release
cp build/Release/better_sqlite3.node ../../prebuilds/<platform>-<arch>/node-137/better_sqlite3.node
```

Smoke-check the Node binding:

```bash
node -e "const Database=require('better-sqlite3-multiple-ciphers'); const db=new Database(':memory:',{nativeBinding:'prebuilds/<platform>-<arch>/node-137/better_sqlite3.node'}); console.log(typeof db.key);"
```

Expect `function`.

## Windows (win32-x64) — must build on Windows

Cross-compiling from Linux is not supported (node-gyp produces host-platform addons; Windows needs MSVC).

**As of the SQLCipher migration, both `prebuilds/win32-x64/**` binaries were deleted.** They were plain `better-sqlite3` builds and would fail-open to plaintext if left in place. Windows time tracking is unavailable until you regenerate both ABIs on a Windows machine:

```bat
cd extensions\time-tracker
npm install
npm run rebuild-prebuilds
```

Or the two manual `npx node-gyp rebuild` commands above with `win32-x64` in the destination path. Commit the resulting:

- `prebuilds/win32-x64/electron-146/better_sqlite3.node`
- `prebuilds/win32-x64/node-137/better_sqlite3.node`
