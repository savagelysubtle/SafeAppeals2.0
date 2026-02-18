---
name: XLSX Responsive Resize Fix
overview: Fix the XLSX viewer so the spreadsheet canvas dynamically grows/shrinks when VSCode panels (sidebar, chat) are opened/closed or the window is resized, filling all available space without overlap.
todos:
  - id: fix-resize
    content: Update resize() to read from wrapper element instead of canvas
    status: completed
  - id: add-observer
    content: Add ResizeObserver on wrapper div in constructor, replacing window.resize
    status: completed
  - id: layout-message
    content: Post 'layout' message from editor pane and handle in main.ts
    status: completed
  - id: build
    content: Run the esbuild bundle (node media/build.mjs)
    status: completed
isProject: false
---

# XLSX Viewer Responsive Resize Fix

## Root Cause Analysis

There are two interrelated bugs:

**Bug 1 -- Canvas never grows after first render:** In
`[renderer.ts` line 1776-1777](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/renderer.ts),
`resize()` sets explicit pixel dimensions on the canvas:

```typescript
this.canvas.style.width = `${this.width}px`;
this.canvas.style.height = `${this.height}px`;
```

This **overrides the `flex:1` CSS** on the canvas, locking it at a fixed size.
When the container grows (panel closed), the canvas stays the same size because
it has hardcoded pixel dimensions, leaving black gaps.

**Bug 2 -- No detection of container size changes:** The renderer only listens
for `window.addEventListener('resize')`
([line 339](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/renderer.ts)).
Inside a webview iframe, `**window.resize` does not fire when VSCode changes
the iframe dimensions due to panel toggles. The canvas never learns its
container grew/shrank.

Both bugs together mean the grid is permanently stuck at whatever width it had
when first loaded.

## Fix (2 changes, both in `renderer.ts`)

### 1. Read dimensions from wrapper, not canvas

The wrapper div (`display:flex; width:100%; height:100%`) correctly tracks
available space. The canvas does not (it has explicit pixel dimensions). Change
`resize()` to read from the wrapper:

```typescript
resize() {
    // Read available space from the wrapper (which is % sized),
    // not the canvas (which has explicit pixel dimensions)
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scrollbarH = this._hScrollbar?.offsetHeight ?? 0;
    this.width = Math.round(rect.width);
    this.height = Math.round(rect.height) - scrollbarH;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);

    this._layoutDirty = true;
    this.render();
    this.updateHScrollbar();
}
```

### 2. Add ResizeObserver on the wrapper

Replace the `window.resize` listener with a `ResizeObserver` on the wrapper
element. This fires whenever the wrapper's actual rendered size changes --
whether from window resize, panel toggle, or any other layout change:

In the constructor, after `window.addEventListener('resize', ...)` on
[line 339](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/renderer.ts):

```typescript
// Replace window.resize with ResizeObserver for reliable container tracking
const ro = new ResizeObserver(() => this.resize());
ro.observe(wrapper);
```

Remove or keep the `window.resize` listener as a fallback (optional, since
ResizeObserver covers it).

### 3. Belt-and-suspenders: post layout message from editor pane

In
`[xlsxRustViewerEditor.ts` layout()](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/xlsxRustViewerEditor.ts)
(line 338), also post a message to the webview so it can trigger a resize even
if ResizeObserver is slow:

```typescript
override layout(dimension: Dimension): void {
    this._dimension = dimension;
    if (this.webview && this._element) {
        this.webview.layoutWebviewOverElement(this._element, dimension);
        this.webview.postMessage({ type: 'layout' });
    }
}
```

In
`[main.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/main.ts)`,
handle this message:

```typescript
case 'layout':
    renderer?.resize();
    break;
```

## Why the grid will fill visible space automatically

Once `this.width` correctly reflects the full available width, the render loop's
visible column calculation (line 1822-1827) will naturally compute a larger
`endCol`, drawing gridlines and empty cells to fill the entire viewport. No
changes needed to the render loop or `ensureLayout()` -- the 200-column position
cache is already more than enough.

## Files Changed

- `[media/renderer.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/renderer.ts)`
-- `resize()` method + add ResizeObserver in constructor
  - `[xlsxRustViewerEditor.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/xlsxRustViewerEditor.ts)`
  -- post `layout` message in `layout()` method
- `[media/main.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/main.ts)`
-- handle `layout` message

