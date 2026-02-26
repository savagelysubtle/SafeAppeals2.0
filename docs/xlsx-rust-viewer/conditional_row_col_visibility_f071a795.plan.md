---
name: Conditional Row/Col Visibility
overview: Add true hide/unhide for rows and columns with proper 0-height/0-width rendering, context menu unhide options, unhide-all capability, and row/column grouping with collapsible outlines. Requires changes to Rust data model, parser, writer, and TypeScript UI.
todos:
  - id: rust-data-model
    content: Add OutlineGroupDef struct, hidden_cols/hidden_rows/outline_groups fields to SheetData in parser.rs
    status: completed
  - id: rust-parser
    content: Parse hidden and outlineLevel attributes from <col> and <row> XML elements, build outline groups
    status: completed
  - id: rust-writer
    content: Write hidden cols/rows and outline groups using rust_xlsxwriter APIs in writer.rs
    status: completed
  - id: ts-hidden-cols
    content: Add _hiddenCols set, fix ensureLayout, add hide/unhide public methods in renderer.ts
    status: completed
  - id: ts-hidden-indicators
    content: Render hidden boundary indicators (double-line) in column/row headers in renderer.ts
    status: completed
  - id: ts-outline-rendering
    content: Add outline gutter rendering with collapse/expand buttons and level indicators in renderer.ts
    status: completed
  - id: ts-context-menu
    content: Add Unhide, Unhide All, Group, Ungroup items to column/row context menus in contextMenu.ts
    status: completed
  - id: ts-main-wiring
    content: Wire all new actions (unhide, group, ungroup, collapse/expand) in main.ts, update save integration
    status: completed
  - id: ts-ribbon
    content: Add Outline group (Group/Ungroup buttons) to Data tab in ribbon.ts
    status: completed
  - id: wasm-build
    content: Run wasm-pack build for Rust changes
    status: completed
isProject: false
---
