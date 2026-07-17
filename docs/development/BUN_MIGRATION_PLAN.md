# Bun Migration Plan for SafeAppeals Navigator

## Executive Summary

Migrate from npm/Node.js to Bun for faster builds and better developer experience.

**Estimated Time Savings:**

- Package install: 5-10 min → 30-60 sec (10x faster)
- Script execution: ~20% faster due to Bun's optimized runtime

---

## Phase 1: Package Management (Day 1) ⚡

### 1.1 Replace npm install with bun install

**File: `package.json`**

```json
// Change preinstall/postinstall hooks
"preinstall": "bun run build/npm/preinstall.js",
"postinstall": "bun run build/npm/postinstall.js",
```

**File: `build/npm/postinstall.js`**

```javascript
// Line 11: Change from
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
// To:
const npm = "bun";
```

### 1.2 Create bunfig.toml for Electron Native Modules

**File: `bunfig.toml` (new file)**

```toml
[install]
# Use npm for native module compilation (Electron headers)
production = false

[install.scopes]
# Native modules that need special handling
"@vscode" = { token = "" }
```

### 1.3 Native Module Handling Script

**File: `build/npm/rebuild-native.js` (new file)**

```javascript
// Script to rebuild native modules for Electron after bun install
const cp = require("child_process");

const NATIVE_MODULES = [
	"native-keymap",
	"native-watchdog",
	"native-is-elevated",
	"node-pty",
	"better-sqlite3",
	"@vscode/sqlite3",
	"@vscode/spdlog",
	"@vscode/windows-mutex",
	"@vscode/windows-process-tree",
	"@vscode/windows-registry",
	"@parcel/watcher",
	"kerberos",
];

// Use electron-rebuild or npm rebuild with Electron headers
cp.execSync("npx electron-rebuild", { stdio: "inherit" });
```

---

## Phase 2: Script Migration (Day 2-3) 🔧

### 2.1 Gulp Scripts (51 scripts)

All gulp scripts use this pattern:

```json
"compile": "node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js compile"
```

**Change to:**

```json
"compile": "bun --smol ./node_modules/gulp/bin/gulp.js compile"
```

Note: `--smol` is Bun's equivalent to reducing memory footprint. For large builds, use:

```json
"compile": "NODE_OPTIONS='--max-old-space-size=8192' bun ./node_modules/gulp/bin/gulp.js compile"
```

### 2.2 Scripts to Update

| Original                         | Bun Equivalent                  |
| -------------------------------- | ------------------------------- |
| `node script.js`                 | `bun run script.js`             |
| `node --max-old-space-size=8192` | `bun` (auto-optimized)          |
| `npx command`                    | `bunx command`                  |
| `npm run script`                 | `bun run script`                |
| `npm install`                    | `bun install`                   |
| `npm ci`                         | `bun install --frozen-lockfile` |

### 2.3 Full Script Replacement Map

```json
{
	"preinstall": "bun run build/npm/preinstall.js",
	"postinstall": "bun run build/npm/postinstall.js && bun run build/npm/rebuild-native.js",
	"compile": "bun ./node_modules/gulp/bin/gulp.js compile",
	"watch": "npm-run-all -lp watch-client watch-extensions",
	"watch-client": "bun ./node_modules/gulp/bin/gulp.js watch-client",
	"watch-extensions": "bun ./node_modules/gulp/bin/gulp.js watch-extensions watch-extension-media",
	"precommit": "bun run build/hygiene.js",
	"gulp": "bun ./node_modules/gulp/bin/gulp.js",
	"compile-web": "bun ./node_modules/gulp/bin/gulp.js compile-web",
	"watch-web": "bun ./node_modules/gulp/bin/gulp.js watch-web",
	"watch-cli": "bun ./node_modules/gulp/bin/gulp.js watch-cli",
	"compile-build": "bun ./node_modules/gulp/bin/gulp.js compile-build-with-mangling",
	"compile-build-ci": "bun ./node_modules/gulp/bin/gulp.js compile-build-without-mangling",
	"compile-extensions-build": "bun ./node_modules/gulp/bin/gulp.js compile-extensions-build",
	"minify-vscode": "bun ./node_modules/gulp/bin/gulp.js minify-vscode",
	"hygiene": "bun ./node_modules/gulp/bin/gulp.js hygiene",
	"core-ci": "bun ./node_modules/gulp/bin/gulp.js core-ci",
	"extensions-ci": "bun ./node_modules/gulp/bin/gulp.js extensions-ci"
}
```

---

## Phase 3: Native Module Strategy (Day 4-5) 🔨

### The Challenge

Native modules must be compiled against Electron's Node.js headers, not system Node or Bun.

### Solution: Hybrid Approach

```
┌─────────────────────────────────────────────────────────────┐
│  bun install                                                 │
│  ├── Fast package resolution (~30 sec)                      │
│  └── Downloads all packages including native module sources │
├─────────────────────────────────────────────────────────────┤
│  electron-rebuild                                            │
│  ├── Recompiles native modules for Electron (~2 min)        │
│  └── Uses settings from .npmrc                               │
└─────────────────────────────────────────────────────────────┘
```

### New Install Script

**File: `scripts/install.ps1`**

```powershell
#!/usr/bin/env pwsh
Write-Host "🚀 Installing packages with Bun..." -ForegroundColor Cyan
bun install

Write-Host "🔨 Rebuilding native modules for Electron..." -ForegroundColor Yellow
npx electron-rebuild --version 34.3.2

Write-Host "✅ Installation complete!" -ForegroundColor Green
```

---

## Phase 4: Remove npm Dependencies (Day 6-7) 🧹

### 4.1 Files to Update

1. **`.npmrc`** → **`bunfig.toml`** (keep .npmrc for electron-rebuild)
2. **`package-lock.json`** → **`bun.lockb`** (binary, faster)
3. **`build/npm/postinstall.js`** → Use `bun` command

### 4.2 Remove These npm-Specific Things

- [ ] `package-lock.json` (use bun.lockb)
- [ ] npm cache clearing in CI
- [ ] npm audit (use `bun audit` or snyk)

---

## Phase 5: CI/CD Updates (Day 8) 🔄

### GitHub Actions Example

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest

- name: Install dependencies
  run: bun install --frozen-lockfile

- name: Rebuild native modules
  run: npx electron-rebuild --version 34.3.2

- name: Build
  run: bun run compile-build-ci
```

---

## Known Limitations & Workarounds

### 1. Memory Limits

**Issue:** Bun doesn't support `--max-old-space-size`
**Workaround:** Use `NODE_OPTIONS` env var or let Bun auto-manage

### 2. Native Modules

**Issue:** Bun can't compile native modules for Electron
**Workaround:** Use `electron-rebuild` after `bun install`

### 3. Some npm Scripts

**Issue:** Some scripts assume `npm` command
**Workaround:** Keep npm installed, use `bun` as primary

---

## Migration Checklist

### Day 1

- [ ] Add `bunfig.toml`
- [ ] Create `build/npm/rebuild-native.js`
- [ ] Test `bun install` + `electron-rebuild`

### Day 2-3

- [ ] Update all 51 gulp scripts to use `bun`
- [ ] Update `postinstall.js` to use `bun`
- [ ] Test full build pipeline

### Day 4-5

- [ ] Verify all native modules work
- [ ] Test on Windows, macOS, Linux

### Day 6-7

- [ ] Remove npm-specific files
- [ ] Update documentation

### Day 8

- [ ] Update CI/CD pipelines
- [ ] Final testing

---

## Expected Results

| Metric             | Before (npm) | After (bun) | Improvement    |
| ------------------ | ------------ | ----------- | -------------- |
| Package install    | 5-10 min     | 30-60 sec   | **10x faster** |
| Script startup     | ~500ms       | ~50ms       | **10x faster** |
| Watch mode restart | ~2 sec       | ~200ms      | **10x faster** |
| Total build        | ~4 min       | ~2 min      | **2x faster**  |

---

## Rollback Plan

If issues arise, revert by:

1. Delete `bun.lockb`
2. Run `npm install`
3. Revert package.json script changes

The `.npmrc` file remains compatible with both npm and bun.
