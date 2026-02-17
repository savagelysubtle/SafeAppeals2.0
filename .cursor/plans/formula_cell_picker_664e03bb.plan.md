---
name: Formula Cell Picker
overview: Implement Excel-like formula cell reference selection ("point mode") where clicking/dragging cells while editing a formula inserts colored cell references and draws range highlights on the canvas.
todos:
  - id: formula-mode-state
    content: Add formula mode state tracking (isFormulaMode, formulaRanges) and reference extraction function in main.ts
    status: completed
  - id: renderer-formula-highlights
    content: Add setFormulaMode(), setFormulaRanges(), and draw colored dashed range highlights in renderer.ts render()
    status: completed
  - id: point-mode-clicks
    content: Modify renderer.ts handleMouseDown/handleMouseMove to route clicks to formula reference insertion when in formula mode
    status: completed
  - id: formula-bar-integration
    content: Wire formula bar and inline editor to enter/exit formula mode, insert cell references at cursor, and update ranges on each keystroke
    status: completed
  - id: build-and-verify
    content: Run build.mjs to bundle, run compile to type-check, provide test instructions
    status: completed
isProject: false
---
