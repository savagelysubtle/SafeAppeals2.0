# XLSX Rust Viewer — Feature Tracker

> **Last updated**: 2026-02-21
>
> This document tracks all implemented features and catalogs features from Excel/Google Sheets that could be implemented next. Organized into two sections: what we **have** and what we **could add**.

---

## PART 1: IMPLEMENTED FEATURES

### File Operations

- Open `.xlsx` files (Rust WASM parser, calamine-based)
- Save `.xlsx` files (Rust WASM writer, rust_xlsxwriter-based)
- Print (canvas snapshot → temp HTML → system print dialog)
- Export as PNG image (canvas snapshot → native save dialog)
- Dirty state tracking (marks document as modified on mutations)

### Sheet Management

- Sheet tab bar at bottom showing all sheets
- Add new sheet ("+" button, creates blank 100×26 grid)
- Delete sheet (right-click menu, enforces minimum 1 sheet)
- Rename sheet (custom modal dialog, since webview blocks `prompt()`)
- Duplicate sheet (deep clone with "(Copy)" suffix)
- Sheet tab right-click context menu (Rename, Delete, Duplicate, Add)
- Sheet switching (resets scroll, selection, filters, formula results)

### Ribbon Toolbar

- 4 tabs: Home, Insert, View, Data
- Always-visible file buttons: Save, Print, Export
- **Home tab**: Clipboard, History, Font, Alignment, Number, Cells, Formulas
- **Insert tab**: Tables (Create, Style Picker, Convert to Range), Rows & Columns
- **View tab**: Gridlines toggle, Headers toggle, Freeze Panes
- **Data tab**: Sort A→Z / Z→A, Filter toggle, Totals toggle, Clear
- 30+ hand-drawn SVG icons

### Cell Editing

- Inline cell editor (positioned HTML input overlay on double-click, Enter, or F2)
- Type-to-edit (pressing any printable character starts editing)
- Tab / Shift+Tab navigation between cells during editing
- Formula bar showing cell reference and raw value/formula
- Formula bar is editable (Enter to commit, Escape to revert)
- Bidirectional sync between inline editor and formula bar
- Auto data type detection (numeric vs. string) on commit

### Selection & Navigation

- Single cell selection (click, blue border)
- Range selection by drag (semi-transparent highlight)
- Shift+Click to extend selection
- Arrow key navigation (with Shift+Arrow to extend)
- Ctrl+A to select all
- Column header click to select entire column (drag for multi-column)
- Row header click to select entire row (drag for multi-row)
- Scroll-into-view on keyboard navigation, Find, and other actions
- Fill handle indicator (small blue square at selection corner)
- Escape to collapse selection to anchor

### Font Formatting

- Bold (toggle, Ctrl+B)
- Italic (toggle, Ctrl+I)
- Underline (toggle, Ctrl+U, rendered as line below text)
- Strikethrough (toggle, rendered as line through text center)
- Font family dropdown (system-ui, Arial, Calibri, Courier New, Georgia, Helvetica, Times New Roman, Verdana)
- Font size dropdown (8–72pt, 14 sizes)
- Text color (color picker with visual indicator)
- Fill/background color (color picker with visual indicator)

### Alignment & Layout

- Align left / center / right
- Wrap text toggle
- Merge cells (toggle: re-selecting unmerges; handles overlapping merges)

### Number Formatting

- Format dropdown: General, Number, Currency, Percentage, Date, Text
- Quick-apply buttons: Currency ($), Percentage (%), Comma separators
- Excel format pattern parsing: percentage, date (m/d/y), currency ($€£), comma-separated (#,##0), fixed decimal, scientific notation
- Excel serial date → locale date string conversion (1899-12-30 epoch)

### Row & Column Operations

- Insert row (shifts down, preserves styles)
- Delete row (shifts up)
- Insert column (shifts right, preserves styles)
- Delete column (shifts left)
- Clear contents (Delete key or ribbon button)
- Clear entire column / row (header context menu)
- Hide column (sets width to 0)
- Hide row (sets height to 0)
- Auto-fit column width (reset to 100px default)
- Auto-fit row height (reset to 24px default)

### Column & Row Resizing

- Drag-to-resize columns (column header border, min 20px, col-resize cursor)
- Drag-to-resize rows (row header border, min 10px, row-resize cursor)
- Variable width/height layout (per-column/row dimensions stored sparsely, cumulative pixel position cache)
- Dimension persistence (synced to model for save/load round-tripping)
- `mouseToCanvas()` coordinate mapping for accurate mouse-to-canvas alignment

### Sorting

- Sort A→Z (ascending) by selected column, numeric-aware
- Sort Z→A (descending) by selected column
- Table-scoped sort (only within table data range, excludes header/totals)

### Table Features (Rust WASM TableOps)

- Create table from selected range (auto-generates column names from header row)
- 60 built-in table styles: Light (21), Medium (28), Dark (11)
- Table style picker (categorized dropdown with mini SVG previews, 7-column grid)
- Banded rows rendering (alternating row shading)
- Banded columns rendering (alternating column shading)
- Styled header row (bold text on colored background)
- Totals row toggle (with per-column aggregation function config)
- Table filter toggle (enable/disable filter arrows)
- Apply table style (immediate re-render)
- Rename table (custom dialog → Rust WASM)
- Resize table (to current selection range)
- Add table column
- Remove table column
- Convert table to range (removes structure, keeps data)
- Delete table (convert to range + clear cells)
- Table header sync (editing a header cell updates the column definition)

### Table Filtering

- Real HTML filter arrow buttons (▼) positioned absolutely over table headers
- Filter buttons reposition on scroll/layout changes
- Filter dropdown UI: Sort A→Z, Sort Z→A, Clear Filter
- Search box to narrow checkbox list
- Select All / Deselect All master checkbox
- Individual value checkboxes (unique column values)
- Multi-column filtering (AND logic across columns)
- Hidden row system (filtered-out rows get height=0)
- Clear filter per column

### Formula Support

- Formula engine (Rust WASM) with 20 functions:
  - Math: `SUM`, `AVERAGE`/`AVG`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ABS`, `ROUND`
  - Logical: `IF`, `AND`, `OR`, `NOT`
  - Text: `LEN`, `UPPER`, `LOWER`, `CONCATENATE`/`CONCAT`
  - Lookup: `VLOOKUP` (exact match)
  - Operators: `+`, `-`, `*`, `/`, `^`, `&`, `=`, `<>`, `<`, `>`, `<=`, `>=`
- Formula evaluation with caching and dependency invalidation
- Formula bar shows raw formula; cell shows computed result
- Quick formula buttons: SUM, AVERAGE, COUNT, MIN, MAX
- Formula point-mode (click cells while editing a formula to insert references)
- Point-mode drag to create range references (e.g., "A1:C5")
- Color-coded formula range highlighting (8-color palette, dashed rectangles)
- Cell reference parsing: A1, $B$3, AA100, ranges (A1:B5, $A$1:$Z$99)
- Error values: `#VALUE!`, `#DIV/0!`, `#N/A`, `#REF!`, `#CIRC!`, `#NAME?`, `#ERROR!`
- Circular reference detection

### Find & Replace

- Find bar (floating overlay, Ctrl+F)
- Match counter ("1 of N")
- Find Next / Find Previous (wrapping, auto-scroll)
- Replace (Ctrl+H) with Replace and Replace All
- Yellow highlight for matches, orange for active match

### View Controls

- Toggle gridlines (show/hide)
- Toggle row/column headers (show/hide)
- Freeze panes (rows above + columns left of selection; blue separator lines)
- Loading state ("Loading..." during WASM init)
- Empty state ("No data to display")

### Scrolling & Virtualization

- Mouse wheel vertical scroll
- Shift+Wheel / trackpad horizontal scroll
- Canvas-drawn vertical scrollbar (rounded thumb, click-to-jump, drag)
- HTML horizontal scrollbar (drag thumb, click-to-jump)
- Virtualized rendering (only visible cells drawn)

### Context Menus

- Cell context menu: Cut, Copy, Paste, Insert Row/Column, Delete Row/Column, Clear, Format Cells, Sort
- Column header context menu: Insert/Delete Column, Clear, Hide, Auto-Fit Width, Sort
- Row header context menu: Insert/Delete Row, Clear, Hide, Auto-Fit Height
- Table context menu items: Insert/Delete Table Column, Rename/Resize Table, Toggle Headers/Totals/Filter, Convert to Range, Delete Table
- Automatic table detection (shows table items when inside a table)
- Viewport clamping (repositions if overflow)

### Undo / Redo

- Full model + styles snapshot undo stack (max 50 entries)
- Redo stack (cleared on new edits)
- Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
- Ribbon buttons

### Clipboard

- Cut (Ctrl+X): copy as tab-delimited text, then clear cells
- Copy (Ctrl+C): copy as tab-delimited text (rows separated by newlines)
- Paste (Ctrl+V): parse tab/newline-delimited data, insert at selection
- Fallback copy (hidden textarea + `execCommand` when Clipboard API fails)

### Merged Cells

- Merge detection and tracking
- Merge/unmerge toggle (re-selecting exact range unmerges)
- Merged cell rendering (single large cell, text from top-left, clipped)
- Model sync for save persistence

### Rendering & Theming

- HiDPI / Retina support (canvas at devicePixelRatio)
- Responsive resize (window resize → `getBoundingClientRect`)
- Text clipping to cell bounds
- Context-aware cursor styles (cell, pointer, col-resize, row-resize)
- Corner box at row/column header intersection
- VSCode theme integration (all UI uses `var(--vscode-*)` custom properties)
- Per-cell style overlay system (overlay priority > model styles)
- Model style sync on save
- Selected header highlight (blue tint)

### Keyboard Shortcuts

| Shortcut              | Action                           |
| --------------------- | -------------------------------- |
| Ctrl+Z                | Undo                             |
| Ctrl+Y / Ctrl+Shift+Z | Redo                             |
| Ctrl+S                | Save                             |
| Ctrl+X                | Cut                              |
| Ctrl+C                | Copy                             |
| Ctrl+V                | Paste                            |
| Ctrl+B                | Bold                             |
| Ctrl+I                | Italic                           |
| Ctrl+U                | Underline                        |
| Ctrl+A                | Select All                       |
| Ctrl+F                | Find                             |
| Ctrl+H                | Find & Replace                   |
| Arrow Keys            | Move selection                   |
| Shift+Arrow           | Extend selection                 |
| Delete / Backspace    | Clear cells                      |
| Enter / F2            | Start editing                    |
| Escape                | Cancel edit / collapse selection |
| Tab / Shift+Tab       | Next / previous cell             |

### Rust WASM Backend

- `XlsxParser`: load XLSX bytes → JSON workbook model (calamine + quick-xml OOXML parsing for charts, conditional formats, sparklines)
- `XlsxWriter`: serialize model → XLSX bytes with custom OOXML chart injection (generates `xl/charts/*.xml`, `xl/drawings/*.xml`, patches `[Content_Types].xml` and worksheet relationships for Excel round-trip compatibility)
- `TableOps`: 9 table mutation methods (create, rename, resize, add/remove column, set style, set totals, toggle filter, convert to range)
- `FormulaEngine`: evaluate_all, evaluate_cell, get_dependents, invalidate — 20 built-in functions
- `ViewportManager`: viewport-based cell extraction for virtual scrolling
- JSON serialization boundary (all data passes as JSON strings)
- Data model includes: cells with styles, tables, merged cells, column widths, row heights, conditional formatting rules, charts (with OOXML round-trip), and sparklines

---

## PART 2: FEATURES WE DON'T HAVE (from Excel & Google Sheets)

> Prioritized by impact. Features marked with ⭐ are high-priority for a spreadsheet viewer/editor. Features marked with 🔬 are advanced/niche.

### ⭐ Conditional Formatting

- [x] Highlight cells rules (greater than, less than, equal to, between, text contains, dates)
- [x] Top/Bottom rules (top 10 items, top 10%, bottom 10)
- [x] Data bars (horizontal bars inside cells proportional to value)
- [x] Color scales (2-color and 3-color gradient fills based on value)
- [x] Icon sets (arrows, traffic lights, flags, stars, ratings)
- [x] Custom formula-based rules
- [x] Multiple rules per range with priority ordering
- [x] Rule management dialog (create, edit, delete, reorder)

### ⭐ Charts & Visualization

- [x] Bar / Column charts
- [x] Line charts
- [x] Pie / Donut charts
- [x] Scatter / XY plots
- [x] Area charts
- [x] Combo charts (mixed types)
- [x] Sparklines (mini in-cell charts: line, column, win/loss)
- [x] Chart wizard / insert dialog
- [x] Chart titles, legends, axis labels
- [x] Chart data range selection
- [x] Resize and move charts
- [x] Chart style/color presets

### ⭐ Data Validation

- [x] Dropdown lists in cells (list validation)
- [x] Whole number validation (min/max)
- [x] Decimal validation
- [x] Date validation
- [x] Text length validation
- [x] Custom formula validation
- [x] Input message (tooltip on cell focus)
- [x] Error alert (Stop, Warning, Information icons)
- [x] Circle invalid data
- [x] Validation rule manager

### ⭐ Cell Comments & Notes

- [ ] Add comment to cell (threaded comments)
- [ ] Edit / delete comment
- [ ] Comment indicators (red triangle corner)
- [ ] Show/hide all comments
- [ ] Reply to comments
- [ ] Notes (legacy simple notes)
- [ ] @mention in comments

### ⭐ Hyperlinks

- [x] Insert hyperlink (URL, email, other sheet, named range)
- [x] Click to follow hyperlink
- [x] Edit / remove hyperlink
- [x] Visual styling for hyperlink cells (blue underline)
- [x] `HYPERLINK()` formula function

### ⭐ Named Ranges

- [x] Define named range (Name Box or dialog)
- [x] Use named ranges in formulas
- [x] Name Manager dialog (create, edit, delete, scope)
- [x] Navigate to named range by clicking in Name Box
- [x] Named range autocomplete in formula bar

### ⭐ More Formula Functions (we have ~120, Excel has 500+)

- [x] **Math/Trig**: `SUMIF`, `SUMIFS`, `SUMPRODUCT`, `PRODUCT`, `MOD`, `INT`, `CEILING`, `FLOOR`, `POWER`, `SQRT`, `LOG`, `LOG10`, `LN`, `EXP`, `PI`, `RAND`, `RANDBETWEEN`, `SIGN`, `TRUNC`
- [x] **Statistical**: `COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`, `MEDIAN`, `MODE`, `STDEV`, `VAR`, `LARGE`, `SMALL`, `RANK`, `PERCENTILE`, `QUARTILE`
- [x] **Lookup**: `HLOOKUP`, `INDEX`, `MATCH`, `XLOOKUP`, `CHOOSE`, `INDIRECT`, `OFFSET`, `ROW`, `COLUMN`, `ROWS`, `COLUMNS`
- [x] **Text**: `LEFT`, `RIGHT`, `MID`, `FIND`, `SEARCH`, `SUBSTITUTE`, `REPLACE`, `TRIM`, `CLEAN`, `TEXT`, `VALUE`, `EXACT`, `REPT`, `PROPER`, `CHAR`, `CODE`, `TEXTJOIN`, `TEXTBEFORE`, `TEXTAFTER`
- [x] **Date/Time**: `TODAY`, `NOW`, `DATE`, `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `DATEVALUE`, `TIMEVALUE`, `EDATE`, `EOMONTH`, `NETWORKDAYS`, `WORKDAY`, `DATEDIF`, `WEEKDAY`, `WEEKNUM`
- [x] **Logical**: `IFS`, `SWITCH`, `IFERROR`, `IFNA`, `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `ISNONTEXT`, `ISERR`, `XOR`, `NA`, `TRUE`, `FALSE`
- [x] **Financial**: `PMT`, `PV`, `FV`, `NPV`, `IRR`, `RATE`, `NPER`, `SLN`, `DB`
- [x] **Information**: `TYPE`, `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `CELL` (stub), `INFO` (stub)

### ⭐ Auto-Fill / Fill Series

- [x] Drag fill handle to extend selection with pattern
- [x] Number series (1, 2, 3... or 2, 4, 6...)
- [x] Date series (day, weekday, month, year increments)
- [x] Text series with numbers ("Item 1", "Item 2"...)
- [x] Copy cell content by drag-filling
- [x] Fill Down (Ctrl+D) / Fill Right (Ctrl+R)
- [x] Custom lists (Mon, Tue, Wed... / Jan, Feb, Mar...)
- [x] Flash Fill (auto-detect pattern from examples)

### ⭐ Column/Row Auto-Fit (Content-Based)

- [x] Double-click column border to auto-fit to content width
- [x] Double-click row border to auto-fit to content height
- [x] Auto-fit selected columns/rows menu option
- [x] Calculate text width using canvas `measureText()`

### ⭐ Paste Special

- [x] Paste Values only
- [x] Paste Formatting only
- [x] Paste Formulas only
- [x] Paste Column Widths
- [x] Transpose on paste
- [x] Paste as operation (Add, Subtract, Multiply, Divide)
- [x] Skip blanks option

### ⭐ Status Bar

- [x] Show Sum of selected cells
- [x] Show Average of selected cells
- [x] Show Count of selected cells
- [x] Show Min / Max
- [x] Show Count of non-empty cells
- [x] Customizable status bar items

### Cell Borders

- [x] Border style picker (thin, medium, thick, dashed, dotted, double)
- [x] Border color picker
- [x] Apply border to: top, bottom, left, right, all, outside, inside
- [x] Draw borders mode
- [x] Erase borders mode
- [x] Diagonal borders

### Pivot Tables

- [x] Create PivotTable from data range
- [x] Drag-and-drop field builder (Rows, Columns, Values, Filters)
- [x] Value aggregation (Sum, Count, Average, Min, Max)
- [x] Group rows by date/text
- [x] Drill down (double-click to see source data)
- [x] PivotTable styles
- [x] Refresh data
- [x] Calculated fields

### Page Layout & Print Setup

- [x] Page margins (top, bottom, left, right)
- [x] Page orientation (portrait/landscape)
- [x] Paper size selection
- [x] Headers and footers
- [x] Print area selection
- [x] Page breaks (insert, remove, preview)
- [x] Print titles (repeat rows/columns on every page)
- [x] Scale to fit (width, height, percentage)
- [x] Print preview
- [x] Gridline printing toggle

### Freeze / Split Panes Enhancements

- [ ] Split panes (independent scrolling quadrants without freezing)
- [ ] Freeze top row only (quick action)
- [ ] Freeze first column only (quick action)
- [ ] Unfreeze all panes

### Multi-Sheet Formula References

- [ ] Cross-sheet references (`Sheet2!A1`)
- [ ] 3D references across sheet ranges (`Sheet1:Sheet3!A1`)
- [ ] Sheet name autocomplete in formula bar

### Import / Export Formats

- [x] Export as CSV
- [x] Export as PDF
- [x] Import CSV (with delimiter options)
- [x] Import TSV
- [x] Export as HTML table
- [x] Import from clipboard (HTML table paste)

### Conditional Row/Column Visibility

- [x] Unhide column (right-click hidden column boundary)
- [x] Unhide row (right-click hidden row boundary)
- [x] Unhide all rows/columns
- [x] Group rows/columns (outline) with collapse/expand

### Cell Protection & Sheet Protection

- [ ] Lock/unlock cells
- [ ] Protect sheet (password optional)
- [ ] Allow specific operations on protected sheet
- [ ] Protected cell visual indicator

### Zoom

- [x] Zoom in / out (slider or dropdown: 50%, 75%, 100%, 125%, 150%, 200%)
- [x] Zoom to fit selection
- [x] Zoom to fit page width
- [x] Ctrl+Mouse wheel to zoom

### Advanced Selection

- [ ] Ctrl+Click to add non-contiguous cells to selection
- [ ] Ctrl+Shift+End to select to last used cell
- [ ] Ctrl+Shift+Home to select from current to A1
- [ ] Ctrl+Arrow to jump to edge of data region
- [ ] Go To dialog (Ctrl+G) — navigate to cell reference
- [ ] Go To Special (select blanks, formulas, constants, errors, etc.)

### Formula Auditing

- [ ] Trace Precedents (show arrows to source cells)
- [ ] Trace Dependents (show arrows to dependent cells)
- [ ] Remove arrows
- [ ] Evaluate Formula step-by-step
- [ ] Show Formulas mode (display formulas instead of values)
- [ ] Error checking

### 🔬 Advanced Table Features

- [ ] Table calculated columns (auto-fill formula for entire column)
- [ ] Structured references (`[@Column1]`, `Table1[Column1]`)
- [ ] Slicer controls for tables
- [ ] Table auto-expansion (add data below auto-extends table)
- [ ] Multiple sort levels

### 🔬 Images & Objects

- [ ] Insert image into cell
- [ ] Insert image floating over cells
- [ ] Resize / move images
- [ ] IMAGE() function
- [ ] Shapes (rectangles, circles, arrows, lines)
- [ ] Text boxes

### 🔬 Array Formulas & Dynamic Arrays

- [ ] CSE array formulas (Ctrl+Shift+Enter)
- [ ] Dynamic array spill ranges
- [ ] `SORT`, `FILTER`, `UNIQUE`, `SEQUENCE`, `RANDARRAY`
- [ ] `SORTBY`, `CHOOSECOLS`, `CHOOSEROWS`, `HSTACK`, `VSTACK`
- [ ] Spill range visual indicator (blue border)
- [ ] `#SPILL!` error handling

### 🔬 Checkboxes & Form Controls

- [ ] Checkbox in cell (Excel 2024 feature)
- [ ] Linked cell for checkbox value
- [ ] Dropdown list (data validation based)
- [ ] Spin button
- [ ] Scroll bar control

### 🔬 Data Tools

- [ ] Text to Columns (delimited or fixed width)
- [ ] Remove Duplicates
- [ ] Consolidate
- [ ] What-If Analysis (Goal Seek, Data Tables, Scenario Manager)
- [ ] Group/Outline (row/column grouping with +/- collapse)

### 🔬 Power Query / Data Connections

- [ ] Import data from external sources (CSV, JSON, database)
- [ ] Transform data pipeline (filter, sort, merge, pivot)
- [ ] Refresh data on demand
- [ ] Query editor

### 🔬 Collaborative Features (Google Sheets-inspired)

- [ ] Cell-level commenting with threads
- [ ] Version history / revision tracking
- [ ] @mentions in comments
- [ ] Share and permissions
- [ ] Real-time multi-user editing indicators

### 🔬 Accessibility

- [ ] Screen reader support (ARIA labels on interactive elements)
- [ ] Keyboard-only navigation for all features
- [ ] High contrast mode
- [ ] Tab focus management
- [ ] Accessible color contrast in themes

---

## Feature Count Summary

> Phase 2 implemented features are included below. Counts reflect all `[x]` items in Part 2 plus all Part 1 sections.

| Category                        | Implemented        | Not Implemented                            |
| ------------------------------- | ------------------ | ------------------------------------------ |
| File Operations                 | 11                 | ~4 (templates, recent files, advanced PDF) |
| Sheet Management                | 7                  | ~5 (unhide, protect, group/outline)        |
| Cell Editing                    | 23                 | ~3 (structured refs, multi-cell fill)      |
| Auto-Fill / Fill Series         | 8 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Paste Special                   | 7 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Selection & Navigation          | 10                 | ~10 (Ctrl+Click, Go To, advanced)          |
| Formatting (Font/Align/Borders) | 20                 | ~4 (text rotation, indent levels)          |
| Cell Borders                    | 6 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Number Formatting               | 5                  | ~5 (custom format editor)                  |
| Row/Column Ops                  | 15                 | ~5 (unhide, outline groups, multi-sort)    |
| Column/Row Auto-Fit             | 4 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Tables                          | 17                 | ~5 (calculated cols, slicers, auto-expand) |
| Table Filtering                 | 9                  | 0 (feature-complete)                       |
| Formulas                        | ~120 functions     | ~380+ (Excel has 500+)                     |
| Named Ranges                    | 5 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Find & Replace                  | 5                  | 0 (feature-complete)                       |
| View Controls & Status Bar      | 13                 | ~8 (zoom, split panes)                     |
| Charts & Visualization          | 12                 | ~3 (advanced styling)                      |
| Sparklines                      | 3                  | 0 (feature-complete)                       |
| Conditional Formatting          | 8                  | 0 (feature-complete)                       |
| Data Validation                 | 10 ✅ (Phase 2)    | 0 (feature-complete)                       |
| Hyperlinks                      | 5 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Pivot Tables                    | 8 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Page Layout & Print Setup       | 10 ✅ (Phase 2)    | 0 (feature-complete)                       |
| Import / Export Formats         | 6 ✅ (Phase 2)     | 0 (feature-complete)                       |
| Comments / Notes                | 0                  | ~7 (entire feature area)                   |
| Formula Auditing                | 0                  | ~6 (trace precedents, evaluate steps)      |
| Advanced Selection              | 0                  | ~6 (Ctrl+Click, Go To Special)             |
| Cell Protection                 | 0                  | ~4 (lock cells, protect sheet)             |
| Zoom                            | 0                  | ~4 (slider, Ctrl+wheel)                    |
| Array / Dynamic Formulas        | 0                  | ~6 (SORT, FILTER, UNIQUE, spill)           |
| Images & Objects                | 0                  | ~6 (insert image, shapes, text boxes)      |
| Form Controls                   | 0                  | ~5 (checkbox, dropdown, spinner)           |
| Data Tools                      | 0                  | ~5 (Text to Columns, Remove Duplicates)    |
| Power Query / Connections       | 0                  | ~4 (external import, transform pipeline)   |
| Collaborative / Accessibility   | 0                  | ~10 (comments, sharing, screen reader)     |
| **TOTAL**                       | **~310+ features** | **~90+ potential features remaining**      |
