---
name: Column/Row Auto-Fit
overview: "Implement content-based auto-fit for columns and rows: double-click on column/row header borders to auto-size, context menu auto-fit option, and multi-column/row selection support."
todos:
  - id: auto-fit-methods
    content: Add autoFitColumn() and autoFitRow() public methods to CanvasRenderer using measureText()
    status: completed
  - id: dblclick-border
    content: Modify handleDoubleClick to detect column/row border double-click via hitTestResize and trigger auto-fit
    status: completed
  - id: context-menu-fix
    content: Update colWidthAuto/rowHeightAuto handlers in main.ts to call the real auto-fit methods
    status: completed
  - id: selected-range-autofit
    content: Add auto-fit selected columns/rows context menu option and handler
    status: completed
  - id: build-bundle
    content: Run node media/build.mjs to bundle changes
    status: completed
isProject: false
---

# Column/Row Auto-Fit (Content-Based)

## Current State

- Manual drag resize exists via `hitTestResize` / `_resizeDragging` in
  `renderer.ts`
- Context menu items "Auto-Fit Column Width" and "Auto-Fit Row Height" exist but
  just reset to defaults (100px / 24px) in `main.ts` lines 1456-1471
- `handleDoubleClick` only opens cell editing; no border double-click handling
- `colWidths` / `rowHeights` are sparse `Record<number, number>` with
  `setColWidth()` / `setRowHeight()` setters already in place
- Cell font is built as `{bold?} {italic?} {fontSize}px {fontFamily}` (line
  2648-2652 in `renderer.ts`)

## Implementation

All changes are in TypeScript only (no Rust changes needed). Three files to
modify:

### 1. Add `autoFitColumn()` / `autoFitRow()` methods to `renderer.ts`

Add two new public methods to `CanvasRenderer`:

- `**autoFitColumn(col: number)**` -- Scans all rows with data in the given
  column. For each cell, builds the same font string used in rendering
  (fontSize, fontFamily, bold, italic from merged styles), calls
  `ctx.measureText(displayValue)`, and tracks the maximum width. Sets the column
  width to `max(maxTextWidth + padding, minWidth)`. Padding ~8px for cell
  margins, min width 20px.
- `**autoFitRow(row: number)**` -- Scans all columns with data in the given row.
  For each cell, determines the required height based on font size (and if
  `wrapText` is true, calculates wrapped line count using current column width).
  Sets the row height to `max(computedHeight, minHeight)`. Min height 10px.

Both methods use the existing `_resolvedCellStyle()` helper (line ~3769 in
`renderer.ts`) to get the merged cell style, and `formatCellValue()` for display
values including formula results.

### 2. Add double-click on column/row border in `renderer.ts`

Modify `handleDoubleClick` (line ~3555) to check for border proximity **before**
the cell edit logic:

- Call `hitTestResize(e)` at the start of `handleDoubleClick`
- If it returns `{ type: 'col', index }`, call `autoFitColumn(index)` and return
- If it returns `{ type: 'row', index }`, call `autoFitRow(index)` and return
- Otherwise, fall through to existing cell edit behavior

### 3. Wire context menu actions in `main.ts`

Update the `colWidthAuto` and `rowHeightAuto` cases (lines 1456-1471) to call
the new auto-fit methods instead of resetting to defaults:

- `colWidthAuto`: call `renderer.autoFitColumn(event.col)` then `markDirty()`
- `rowHeightAuto`: call `renderer.autoFitRow(event.row)` then `markDirty()`

### 4. Add "Auto-Fit Selected Columns/Rows" to context menu

In `contextMenu.ts`, add a multi-column/row auto-fit option to the cell context
menu for when a range is selected:

- Add `autoFitSelectedCols` / `autoFitSelectedRows` items
- In `main.ts`, handle these by looping over the selected range's columns/rows
  and calling `autoFitColumn`/`autoFitRow` for each

### Build

Run `node media/build.mjs` from the xlsxRustViewer directory to bundle the
changes.

## Files to Change

- `[renderer.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/renderer.ts)`
  -- add `autoFitColumn()`, `autoFitRow()`, modify `handleDoubleClick`
- `[main.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/main.ts)`
  -- update context menu action handlers
- `[contextMenu.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/contextMenu.ts)`
  -- add selected-range auto-fit items
