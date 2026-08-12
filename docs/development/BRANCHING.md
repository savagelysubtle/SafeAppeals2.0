<!-- Copyright (c) Safe Appeals. All rights reserved. -->

# Branching — SafeAppeals 2.1 major overhaul

This is **not** an incremental merge of the old app into a side branch.  
`update-vscode` **is** the product: new Code - OSS base, rebuilt UI/app surface, upgraded Rust natives. We are **introducing that overhaul** as the new line of development.

## Branches

| Branch | Role |
| ------ | ---- |
| **`dev`** | **Integration / default engineering branch for the overhaul.** Same tip as the former long-lived `update-vscode` work. Day-to-day work and build dry-runs land here. |
| **`update-vscode`** | Historical working name of the overhaul. Kept in sync with `dev` until nothing still points at it; then optional delete. |
| **`main`** | **Stable / public default** (GitHub default branch). Still the **pre-overhaul** line until we deliberately promote. Do **not** merge old `main` into `dev`. When ready: replace `main` with `dev` (PR or fast-forward/force after release criteria), tag **`v2.1.0`**, cut installers. |

Old `main` / old `dev` history is **legacy**. It diverged before the VS Code import. Do not rebase the overhaul onto it or try to “reconcile” the 50+ commit split — that history is retired for product purposes.

## Promotion path

```
update-vscode  ──(already is)──►  dev  ──(when builds + smoke green)──►  main  + tag v2.1.0
```

1. **Now:** Point `origin/dev` at the overhaul tip (replace old `dev`).
2. **Build:** Package from `dev` (Linux first, then Windows with committed prebuilds). See [WINDOWS_PACKAGING.md](./WINDOWS_PACKAGING.md).
3. **Then main:** When installers and smoke pass, promote `dev` → `main` as the public overhaul. Release tag `v2.1.0` on that commit. Product version is already `2.1.0` in `package.json` / `product.json`.

## Rules

- New features after launch: branch off **`dev`**, PR back to **`dev`**.
- Never open a PR that merges legacy `main` into `dev` “to catch up.”
- Tag hygiene: historical `v2.0.0` stays on the old line; **`v2.1.0`** only on the overhaul release commit.
- Submodule / nested `safeappeals-cloud` ships on its own remote; pin gitlink on `dev` when cloud changes intentionally.

## Build readiness (overhaul)

| Gate | Notes |
| ---- | ----- |
| Dev run | `./scripts/code.sh` after `bun run transpile-client` (and extension compiles as needed) |
| Natives | `bun run verify-native-prebuilds` / `:win32` before Windows installer |
| Package | `npm run gulp vscode-linux-x64` / `vscode-win32-x64` (+ setup targets) from a clean tree on `dev` |
| Smoke | Sign-in, agent, email, docs, tracker, Private Search on packaged build |
| Promote | Only then move `main` and tag |

Microsoft Azure “distro” pipelines in-tree are upstream leftovers — not the SafeAppeals release path unless rewired later.
