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

From `extensions/safeappeals-time-tracker`:

```bash
npm install
npm run rebuild-prebuilds
```

That builds both ABIs for `process.platform`-`process.arch` and copies them into `prebuilds/<platform>-<arch>/`.

### Manual commands (one per ABI)

Electron 146 (uses extension `.npmrc` / Electron 42.6.0 headers):

```bash
cd extensions/safeappeals-time-tracker/node_modules/better-sqlite3-multiple-ciphers
npx node-gyp rebuild --release --target=42.6.0 --dist-url=https://electronjs.org/headers --runtime=electron
cp build/Release/better_sqlite3.node ../../prebuilds/<platform>-<arch>/electron-146/better_sqlite3.node
```

Node 137 (host Node, no Electron flags):

```bash
cd extensions/safeappeals-time-tracker/node_modules/better-sqlite3-multiple-ciphers
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

Windows must be built on a Windows host with MSVC (node-gyp cannot cross-compile). Use **Node 24.x** (`abi=137` — check with `node -p "process.versions.modules"`).

```bat
cd extensions\safeappeals-time-tracker
npm install
npm run rebuild-prebuilds
```

`rebuild-prebuilds` builds Electron 146 first, then host Node 137. The Node pass explicitly overrides the extension `.npmrc` Electron pins so both ABIs are real (not two copies of electron-146).

Commit:

- `prebuilds/win32-x64/electron-146/better_sqlite3.node`
- `prebuilds/win32-x64/node-137/better_sqlite3.node`

Smoke-check before committing: `typeof db.key` must be `function` when loading the `node-137` binding under Node 24 (see command above).
