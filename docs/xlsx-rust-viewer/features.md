# XLSX Rust Viewer — Feature Tracker

> **Last updated**: 2026-02-20
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
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Save |
| Ctrl+X | Cut |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+U | Underline |
| Ctrl+A | Select All |
| Ctrl+F | Find |
| Ctrl+H | Find & Replace |
| Arrow Keys | Move selection |
| Shift+Arrow | Extend selection |
| Delete / Backspace | Clear cells |
| Enter / F2 | Start editing |
| Escape | Cancel edit / collapse selection |
| Tab / Shift+Tab | Next / previous cell |

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
- [ ] Dropdown lists in cells (list validation)
- [ ] Whole number validation (min/max)
- [ ] Decimal validation
- [ ] Date validation
- [ ] Text length validation
- [ ] Custom formula validation
- [ ] Input message (tooltip on cell focus)
- [ ] Error alert (Stop, Warning, Information icons)
- [ ] Circle invalid data
- [ ] Validation rule manager

### ⭐ Cell Comments & Notes
- [ ] Add comment to cell (threaded comments)
- [ ] Edit / delete comment
- [ ] Comment indicators (red triangle corner)
- [ ] Show/hide all comments
- [ ] Reply to comments
- [ ] Notes (legacy simple notes)
- [ ] @mention in comments

### ⭐ Hyperlinks
- [ ] Insert hyperlink (URL, email, other sheet, named range)
- [ ] Click to follow hyperlink
- [ ] Edit / remove hyperlink
- [ ] Visual styling for hyperlink cells (blue underline)
- [ ] `HYPERLINK()` formula function

### ⭐ Named Ranges
- [ ] Define named range (Name Box or dialog)
- [ ] Use named ranges in formulas
- [ ] Name Manager dialog (create, edit, delete, scope)
- [ ] Navigate to named range by clicking in Name Box
- [ ] Named range autocomplete in formula bar

### ⭐ More Formula Functions (we have 20, Excel has 500+)
- [ ] **Math/Trig**: `SUMIF`, `SUMIFS`, `SUMPRODUCT`, `PRODUCT`, `MOD`, `INT`, `CEILING`, `FLOOR`, `POWER`, `SQRT`, `LOG`, `LOG10`, `LN`, `EXP`, `PI`, `RAND`, `RANDBETWEEN`, `SIGN`, `TRUNC`
- [ ] **Statistical**: `COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`, `MEDIAN`, `MODE`, `STDEV`, `VAR`, `LARGE`, `SMALL`, `RANK`, `PERCENTILE`, `QUARTILE`
- [ ] **Lookup**: `HLOOKUP`, `INDEX`, `MATCH`, `XLOOKUP`, `CHOOSE`, `INDIRECT`, `OFFSET`, `ROW`, `COLUMN`, `ROWS`, `COLUMNS`
- [ ] **Text**: `LEFT`, `RIGHT`, `MID`, `FIND`, `SEARCH`, `SUBSTITUTE`, `REPLACE`, `TRIM`, `CLEAN`, `TEXT`, `VALUE`, `EXACT`, `REPT`, `PROPER`, `CHAR`, `CODE`, `TEXTJOIN`, `TEXTBEFORE`, `TEXTAFTER`
- [ ] **Date/Time**: `TODAY`, `NOW`, `DATE`, `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `DATEVALUE`, `TIMEVALUE`, `EDATE`, `EOMONTH`, `NETWORKDAYS`, `WORKDAY`, `DATEDIF`, `WEEKDAY`, `WEEKNUM`
- [ ] **Logical**: `IFS`, `SWITCH`, `IFERROR`, `IFNA`, `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT`
- [ ] **Financial**: `PMT`, `PV`, `FV`, `NPV`, `IRR`, `RATE`, `NPER`, `SLN`, `DB`
- [ ] **Information**: `TYPE`, `ISBLANK`, `ISERROR`, `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `CELL`, `INFO`

### ⭐ Auto-Fill / Fill Series
- [ ] Drag fill handle to extend selection with pattern
- [ ] Number series (1, 2, 3... or 2, 4, 6...)
- [ ] Date series (day, weekday, month, year increments)
- [ ] Text series with numbers ("Item 1", "Item 2"...)
- [ ] Copy cell content by drag-filling
- [ ] Fill Down (Ctrl+D) / Fill Right (Ctrl+R)
- [ ] Custom lists (Mon, Tue, Wed... / Jan, Feb, Mar...)
- [ ] Flash Fill (auto-detect pattern from examples)

### ⭐ Column/Row Auto-Fit (Content-Based)
- [ ] Double-click column border to auto-fit to content width
- [ ] Double-click row border to auto-fit to content height
- [ ] Auto-fit selected columns/rows menu option
- [ ] Calculate text width using canvas `measureText()`

### ⭐ Paste Special
- [ ] Paste Values only
- [ ] Paste Formatting only
- [ ] Paste Formulas only
- [ ] Paste Column Widths
- [ ] Transpose on paste
- [ ] Paste as operation (Add, Subtract, Multiply, Divide)
- [ ] Skip blanks option

### ⭐ Status Bar
- [ ] Show Sum of selected cells
- [ ] Show Average of selected cells
- [ ] Show Count of selected cells
- [ ] Show Min / Max
- [ ] Show Count of non-empty cells
- [ ] Customizable status bar items

### Cell Borders
- [ ] Border style picker (thin, medium, thick, dashed, dotted, double)
- [ ] Border color picker
- [ ] Apply border to: top, bottom, left, right, all, outside, inside
- [ ] Draw borders mode
- [ ] Erase borders mode
- [ ] Diagonal borders

### Pivot Tables
- [ ] Create PivotTable from data range
- [ ] Drag-and-drop field builder (Rows, Columns, Values, Filters)
- [ ] Value aggregation (Sum, Count, Average, Min, Max)
- [ ] Group rows by date/text
- [ ] Drill down (double-click to see source data)
- [ ] PivotTable styles
- [ ] Refresh data
- [ ] Calculated fields

### Page Layout & Print Setup
- [ ] Page margins (top, bottom, left, right)
- [ ] Page orientation (portrait/landscape)
- [ ] Paper size selection
- [ ] Headers and footers
- [ ] Print area selection
- [ ] Page breaks (insert, remove, preview)
- [ ] Print titles (repeat rows/columns on every page)
- [ ] Scale to fit (width, height, percentage)
- [ ] Print preview
- [ ] Gridline printing toggle

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
- [ ] Export as CSV
- [ ] Export as PDF
- [ ] Import CSV (with delimiter options)
- [ ] Import TSV
- [ ] Export as HTML table
- [ ] Import from clipboard (HTML table paste)

### Conditional Row/Column Visibility
- [ ] Unhide column (right-click hidden column boundary)
- [ ] Unhide row (right-click hidden row boundary)
- [ ] Unhide all rows/columns
- [ ] Group rows/columns (outline) with collapse/expand

### Cell Protection & Sheet Protection
- [ ] Lock/unlock cells
- [ ] Protect sheet (password optional)
- [ ] Allow specific operations on protected sheet
- [ ] Protected cell visual indicator

### Zoom
- [ ] Zoom in / out (slider or dropdown: 50%, 75%, 100%, 125%, 150%, 200%)
- [ ] Zoom to fit selection
- [ ] Zoom to fit page width
- [ ] Ctrl+Mouse wheel to zoom

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

| Category | Implemented | Not Implemented |
|----------|------------|-----------------|
| File Operations | 5 | ~10 (CSV, PDF export, import) |
| Sheet Management | 7 | ~5 (unhide, protect, group) |
| Cell Editing | 7 | ~8 (auto-fill, paste special) |
| Selection & Navigation | 10 | ~10 (advanced, Go To) |
| Formatting | 14 | ~12 (borders, diagonal) |
| Number Formatting | 5 | ~5 (custom formats) |
| Row/Column Ops | 12 | ~8 (unhide, group, auto-fit content) |
| Tables | 17 | ~8 (calculated cols, slicers) |
| Table Filtering | 9 | 0 (feature-complete for basic filtering) |
| Formulas | 20 functions | ~200+ (Excel has 500+) |
| Find & Replace | 5 | 0 (feature-complete) |
| View Controls | 5 | ~8 (zoom, split panes) |
| Charts & Visualization | 12 | ~3 (combo charts, advanced styling) |
| Data Validation | 0 | ~10 (entire feature area) |
| Comments | 0 | ~7 (entire feature area) |
| Hyperlinks | 0 | ~5 (entire feature area) |
| Conditional Formatting | 8 | 0 (feature-complete for basic rules) |
| Pivot Tables | 0 | ~8 (entire feature area) |
| **TOTAL** | **~130+ features** | **~170+ potential features** |
