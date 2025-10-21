# 🔍 Debug Guide - Chat Scroll Issue

## Current Status

After multiple fixes, the chat is still not scrolling properly. Let's systematically debug this.

## ✅ Fixes Applied So Far

1. **Scroll Timing** - Double RAF for content rendering
2. **Flex Layout** - `void-flex-1` with `minHeight: 0`
3. **Scrollbar Styling** - Custom scrollbar CSS
4. **Root Container** - `void-h-full void-overflow-hidden`
5. **Input Area** - `flex-shrink-0` to prevent shrinking
6. **Tailwind Prefix** - All classes corrected to `void-*`
7. **VSCode Container** - Added `height: 100%` and `overflow: hidden` to parent

## 🔧 Build & Test Steps

### Step 1: Full Clean Build

```bash
# Clean any cached builds
rm -rf src/vs/workbench/contrib/void/browser/react/out

# Rebuild React components
npm run buildreact

# Compile TypeScript
npm run compile
```

### Step 2: Restart VSCode

- **Close VSCode completely** (not just reload window)
- Reopen the project
- Open DevTools: `Help` → `Toggle Developer Tools`

### Step 3: Check Console

Look for any errors in the Console tab. Common issues:

- React mount errors
- Missing CSS classes
- Height calculation errors

## 🔍 Debugging Checklist

### 1. Verify React Bundle Built

Check if file exists:

```
src/vs/workbench/contrib/void/browser/react/out/sidebar-tsx/index.js
```

If missing, `npm run buildreact` failed.

### 2. Inspect Elements in DevTools

**Check Root Container** (`.void-chat-panel`):

```html
<!-- Should have these classes: -->
<div class="void-chat-panel void-w-full void-h-full void-overflow-hidden">
```

**Check Computed Styles**:

- Right-click → Inspect → Computed tab
- Verify:
  - `height: XXXpx` (should be a fixed pixel value)
  - `overflow: hidden`
  - `display: flex`

**Check Messages Container**:

```html
<!-- Should have: -->
<div class="void-flex void-flex-col void-flex-1 void-overflow-y-auto" style="min-height: 0px;">
```

**Computed Styles Should Show**:

- `flex: 1 1 0%` (from void-flex-1)
- `min-height: 0px`
- `overflow-y: auto`
- `height: XXXpx` (calculated by flex)

### 3. Check Container Hierarchy

Use DevTools Elements panel to verify structure:

```
<div class="monaco-pane-view"> (VSCode pane)
  ↓ style="height: 100%; overflow: hidden" ← FROM LATEST FIX
  <div class="void-scope void-dark">
    ↓ style="width: 100%; height: 100%"
    <div class="void-w-full void-h-full void-bg-void-bg-2">
      ↓
      <div class="void-w-full void-h-full">
        ↓
        <div class="void-chat-panel void-w-full void-h-full void-overflow-hidden">
          ↓
          <div class="void-w-full void-h-full void-flex void-flex-col void-overflow-hidden">
            ↓
            ├─ <div class="void-flex-1 void-overflow-y-auto" style="min-height: 0px">
            └─ <div class="flex-shrink-0"> (input area)
```

**Each level should have height constraints!**

### 4. Check for Height = 0

In DevTools, check each container's computed height:

- If any container shows `height: 0px`, that's the problem
- Trace up the tree to find which parent is missing height

### 5. Test Without Content

Try with an empty chat (no messages):

- Does the input area appear?
- Is the container sized correctly?
- If input area is visible, layout is working

## 🐛 Common Issues & Solutions

### Issue 1: Classes Not Applied

**Symptom**: Elements don't have `void-*` classes in DevTools
**Solution**:

```bash
npm run buildreact  # Must rebuild React!
```

### Issue 2: Height = 0

**Symptom**: Container has `height: 0px`
**Solution**: Check parent containers have explicit height or flex properties

### Issue 3: Overflow Visible

**Symptom**: Content spills out of container
**Solution**: Verify `void-overflow-hidden` on parent, `void-overflow-y-auto` on scroll container

### Issue 4: Tailwind Classes Don't Exist

**Symptom**: Classes shown in HTML but no styles applied
**Solution**: Check `tailwind.config.js` has `prefix: 'void-'` and rebuild

### Issue 5: VSCode Pane Has No Height

**Symptom**: All containers show `height: 0px`
**Solution**: Check `sidebarPane.ts` sets `parent.style.height = '100%'`

## 📊 Expected Behavior

### What Should Happen

1. VSCode pane has fixed height from layout (e.g., 800px)
2. React root inherits this height (100% = 800px)
3. Messages container gets flex-1 (grows to fill space minus input)
4. When content > container height, scrollbar appears
5. Messages stay within bounds, scroll smoothly

### What Should NOT Happen

- Container growing infinitely
- Content cascading beyond bounds
- No scrollbar appearing
- Height calculating as 0px

## 🎯 Files to Check

### Modified Files

1. `src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx`
2. `src/vs/workbench/contrib/void/browser/react/src/styles.css`
3. `src/vs/workbench/contrib/void/browser/sidebarPane.ts` ← **NEW**

### If Changes Reverted

Run `git diff` on these files to verify changes are still there.

## 💡 Alternative Debugging

### Try Inline Styles

Temporarily add inline styles to bypass Tailwind:

```tsx
// In SidebarChat.tsx return statement:
<div
  className="void-chat-panel"
  style={{
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  }}
>
```

If this works, it confirms Tailwind classes aren't being generated.

### Check Tailwind Output

Look at the compiled CSS:

```
src/vs/workbench/contrib/void/browser/react/out/styles.css
```

Search for `void-h-full`. Should see:

```css
.void-h-full {
  height: 100%;
}
```

If not found, Tailwind build is broken.

## 🚨 Last Resort

If nothing works, let's verify the entire chain:

1. **Check TypeScript compiled**: Look for `.js` files in `out/` directory
2. **Check React compiled**: Look for files in `react/out/` directory
3. **Check Tailwind compiled**: Look for CSS in `react/out/styles.css`
4. **Check VSCode loaded**: Check console for React mount message
5. **Check DOM exists**: Use DevTools to verify elements exist

---

**Next Steps**:

1. Run full build commands above
2. Check each item in the checklist
3. Report which specific check fails
