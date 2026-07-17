# CRITICAL FIX: Clean Rebuild Required

## The Problem

The old build artifacts in `out/` were built from `src2/` (scoped CSS with `void-` prefix).
The new code uses `src/` (global CSS without prefix), but `out/` was never rebuilt.

## The Solution

**You MUST delete old build artifacts and rebuild from scratch.**

## Steps to Fix

### Option 1: Run the cleanup script (RECOMMENDED)

```bash
cd src/vs/workbench/contrib/void/browser/react
clean-rebuild.bat
```

### Option 2: Manual cleanup

```bash
cd src/vs/workbench/contrib/void/browser/react

# Remove old build artifacts
rmdir /s /q src2
rmdir /s /q out

# Rebuild
node build.js
```

### Option 3: npm script

```bash
npm run buildreact
```

## What Changed

### Files Modified

1. **`tailwind.config.js`**
   - ✅ Removed `prefix: 'void-'`
   - ✅ Changed `content` from `src2/**/*` to `src/**/*`
   - ✅ Removed extra config options

2. **`src/styles.css`**
   - ✅ Changed `.void-scope { }` to `& { }` (global scope)
   - ✅ Removed fallback colors and custom button colors
   - ✅ Removed scrollbar styling

3. **`tsup.config.js`**
   - ✅ Changed entry from `src2/` to `src/`
   - ✅ Changed `outbase` from `src2` to `src`

4. **`build.js`**
   - ✅ Removed `scope-tailwind` step
   - ✅ Removed `src2` generation
   - ✅ Now builds directly from `src/`

5. **`sidebarPane.ts`**
   - ✅ Removed `parent.style.height = '100%'`
   - ✅ Removed `parent.style.overflow = 'hidden'`

6. **`SidebarChat.tsx`**
   - ✅ Removed wrapper div, return Fragment directly
   - ✅ Removed double `requestAnimationFrame`
   - ✅ Classes now use standard Tailwind (no `void-` prefix)

## After Rebuilding

1. Reload VSCode: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Test the chat panel - it should now scroll correctly!

## Why This Fixes It

The working fork uses:

- Global CSS variables (`& { }`)
- No Tailwind prefix
- Direct build from `src/`

Our old build was using:

- Scoped CSS variables (`.void-scope { }`)
- `void-` prefix on all classes
- Intermediate `src2/` with scope-tailwind

The mismatch meant Tailwind classes weren't being applied, causing layout/scroll issues.
