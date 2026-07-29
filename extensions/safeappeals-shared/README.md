# safeappeals-shared

Canonical source for SafeAppeals cross-extension helpers (encrypted store, secure FS).

This folder must **never** gain a `package.json` or `tsconfig.json` — the build globs `extensions/*/package.json` and would ship it as a built-in extension / unregistered compilation unit.

Edit sources here, then run `npm run sync-safeappeals-shared` to copy into consuming extensions' `src/shared/`.
