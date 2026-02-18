---
name: PDF Viewer Bug Fixes
overview: "Fix three PDF viewer bugs: thumbnails showing wrong PDF content, unprofessional toolbar/ribbon UI, and sidebar outline/bookmarks content being cut off."
todos:
  - id: fix-thumbnails
    content: Fix stale thumbnails by clearing DOM at start of handleLoadPDF and in clearPDF handler
    status: completed
  - id: fix-ribbon
    content: "Redesign toolbar: remove emojis, use text-only buttons, clean colored circles for highlights, consistent sizing"
    status: in_progress
  - id: fix-outline-cutoff
    content: "Fix outline text truncation: change white-space to normal, allow word wrapping"
    status: pending
  - id: rebuild-bundle
    content: Rebuild pdfRustViewer.js bundle and compile to out/
    status: pending
isProject: false
---

# PDF Viewer Bug Fixes

## Bug 1: Sidebar Thumbnails Showing Wrong PDF

**Symptom**: Thumbnails show a different PDF than the main view. Screenshot
shows 2 thumbnails from a previous document while the main view displays a
14-page "REVIEW DECISION" document.

**Root Cause**: When the editor pane is reused for a different PDF, the webview
(which has `retainContextWhenHidden: true`) retains its DOM state including old
thumbnails. The new `loadPDF` message triggers `handleLoadPDF` which calls
`generateThumbnails()`, but if thumbnail generation fails silently for any
reason (WASM error, race condition), stale thumbnails persist.

Additionally, the `_pdfDataCache` in
[pdfViewerEditor.ts](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerEditor.ts)
persists data for ONE PDF. When switching between PDFs, the cache-hit path
(line 149) sends the data with `skipPreload: true`, but the webview still
regenerates thumbnails. The issue is that the webview may already have DOM
thumbnails from a previous load and `generateThumbnails()` must run to
completion to replace them.

**Fixes** (in
[media/main.ts](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/main.ts)):

1. Clear thumbnail DOM immediately at the start of `handleLoadPDF()` before any
   async work, so stale thumbnails never persist:

```typescript
// At start of handleLoadPDF:
const thumbnailsContainer = document.getElementById("thumbnails-container");
if (thumbnailsContainer) thumbnailsContainer.innerHTML = "";
```

1. Add error handling around `generateThumbnails()` with a visible fallback if
   it fails
2. In the `clearPDF` handler, also explicitly clear thumbnails:

```typescript
   case 'clearPDF':
       // ...existing cleanup...
       const tc = document.getElementById('thumbnails-container');
       if (tc) tc.innerHTML = '';


```

1. Add a diagnostic log in `generateThumbnails` that includes the loaded PDF URI
   so you can verify which document is being thumbnailed

---

## Bug 2: Toolbar/Ribbon Looks Unprofessional

**Symptom**: The toolbar uses emoji icons, has inconsistent sizing, poor visual
grouping, and colored highlight circles with emoji overlays that look
unpolished.

**Current State** (in
[pdfViewerEditor.ts](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerEditor.ts)
lines 662-681): The toolbar HTML uses emojis as icons and has no clear visual
grouping hierarchy.

**Fixes** (in
[pdfViewerEditor.ts](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerEditor.ts)
and
[pdfViewer.css](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.css)):

1. Replace all emoji icons with text-only buttons for a professional look:

- `🖨️ Print` -> `Print`
- `✍️ Signature` -> `Signature`
- `📧 DocuSign` -> `DocuSign`
- `🖍️` highlight buttons -> colored circles (no emoji, just the background
  color)
- `🗑️` delete -> `x` or just a styled delete icon

1. Restructure the toolbar HTML into two rows or logical groups:

- **Row 1 (Navigation)**:
  `[< Prev] Page X of Y [Next >]  |  [- Zoom +]  |  [Fit Width] [Fit Page]`
- **Row 2 (Tools)**:
  `[Print] [Signature] [DocuSign]  |  [highlight colors] [Delete]` Or keep
  single row but with clearer grouping via CSS.

1. Update CSS for highlight buttons: remove emoji content, use clean colored
   circles (border-radius: 50%, fixed small size, no text content), keep the
   `.active` ring indicator.
2. Use consistent `font-size: 12px`, padding, and button heights across all
   toolbar controls. Align with VSCode's native widget styling by using
   `var(--vscode-*)` CSS variables throughout.

---

## Bug 3: Outline / Bookmarks Content Cut Off

**Symptom**: Outline items in the sidebar are truncated and not fully readable.

**Root Cause** (in
[pdfViewer.css](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.css)
lines 151-178):

```css
.outline-item {
	white-space: nowrap; /* <-- prevents text wrapping */
	overflow: hidden; /* <-- hides overflow */
	text-overflow: ellipsis; /* <-- shows "..." */
}
```

This combination truncates any outline title longer than the sidebar width
(250px). For legal documents with long section titles, most entries will be cut
off.

**Fixes** (in
[pdfViewer.css](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.css)):

1. Change outline items to allow wrapping:

```css
.outline-item {
	white-space: normal;
	overflow: visible;
	text-overflow: unset;
	word-break: break-word;
}
```

1. Keep `title` attribute (already set in `sidebar.ts` line 112) as a tooltip
   fallback for very long titles.
2. Ensure `#sidebar-content` properly scrolls when content overflows (it already
   has `overflow: auto` so this should work once text wraps).

---

## Build Step

After all changes, rebuild the webview bundle:

```bash
cd src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer
node media/build.mjs
```

Then ensure the new `pdfRustViewer.js` and `pdfViewer.css` are copied to `out/`:

```bash
bun run compile
```

Then reload the window: `Ctrl+Shift+P` -> "Developer: Reload Window"
