# Competitor Strategies Analysis

## What to Steal from Each Project

### 1. Quadratic - The Performance King

**Spatial Hashing Strategy:**
```typescript
// Instead of checking all 1M cells on edit
// Check only the 450-cell bucket containing the edited cell

class SpatialHash {
    private BUCKET_COLS = 15;
    private BUCKET_ROWS = 30;
    private buckets = new Map<string, CellBucket>();
    
    getBucketKey(row: number, col: number): string {
        const hashRow = Math.floor(row / this.BUCKET_ROWS);
        const hashCol = Math.floor(col / this.BUCKET_COLS);
        return `${hashRow},${hashCol}`;
    }
    
    updateCell(row: number, col: number, value: any) {
        const key = this.getBucketKey(row, col);
        const bucket = this.buckets.get(key);
        
        // Only recalculate THIS bucket
        bucket.recalculate();
        
        // All other 99.9% of buckets untouched
        // Result: 5-10ms latency regardless of total cells
    }
}
```

**Multi-Worker Architecture:**
```
Main Thread: UI + Input
├─ Render Worker: Text layout, glyph batching
└─ Core Worker: Data model, formulas (Rust WASM)

Benefit: 60fps guaranteed, never blocks
```

**Custom Shader Batching:**
```glsl
// Pack all backgrounds into texture atlas
// Pack all text glyphs into texture atlas
// Pack all borders into instanced geometry

// Result:
// 3 GPU draw calls (not 3M)
// 60fps with 1M cells
```

**What to Copy:**
- ✅ Spatial hashing for >100k cells
- ✅ Multi-worker if targeting 60fps
- ✅ Canvas rendering minimum

### 2. Univer - The Architecture Master

**Command Pattern (Perfect Undo/Redo):**
```typescript
interface Command {
    do(): void;
    undo(): void;
    redo(): void;
}

class EditCellCommand implements Command {
    constructor(
        private sheet: Sheet,
        private row: number,
        private col: number,
        private oldValue: any,
        private newValue: any
    ) {}
    
    do() {
        this.sheet.setCell(this.row, this.col, this.newValue);
    }
    
    undo() {
        this.sheet.setCell(this.row, this.col, this.oldValue);
    }
    
    redo() {
        this.do();
    }
}

// Usage
const history: Command[] = [];

function executeCommand(cmd: Command) {
    cmd.do();
    history.push(cmd);
}

function undo() {
    const cmd = history.pop();
    if (cmd) cmd.undo();
}
```

**Dependency Injection:**
```typescript
// Instead of tight coupling:
// class App {
//     private engine = new FormulaEngine();
// }

// Use DI:
interface IFormulaEngine {
    evaluate(formula: string): any;
}

class App {
    constructor(private engine: IFormulaEngine) {}
}

// Benefit: Swap implementations, easy testing
```

**What to Copy:**
- ✅ Command pattern (Day 1)
- ✅ Virtual viewport (essential)
- ✅ Plugin system (if extensibility needed)

### 3. Polars - The Data Processing Expert

**Lazy Evaluation:**
```rust
// Traditional eager:
let filtered = df.filter(condition);  // Execute now
let sorted = filtered.sort("age");    // Execute now
let result = sorted.select(cols);     // Execute now
// 3 full table scans

// Polars lazy:
let result = df
    .lazy()
    .filter(condition)    // Add to plan
    .sort("age")          // Add to plan
    .select(cols)         // Add to plan
    .collect();           // Execute optimized
    
// Polars reorders: select FIRST → filter → sort
// Result: 1 table scan, 3x faster
```

**Columnar Storage:**
```
Row-oriented:
[John, 30, 50000]
[Jane, 28, 60000]
Problem: Jump through memory to sum salaries

Columnar:
Names:   [John, Jane]
Ages:    [30, 28]
Salaries: [50000, 60000]  ← Sequential!
Benefit: Cache hits, SIMD vectorization
```

**What to Copy:**
- ✅ Use Polars for tables (don't reinvent)
- ✅ Think columnar not row-based
- ✅ Lazy evaluation for complex queries

### 4. EtherCalc - The Server Lessons

**What They Learned (The Hard Way):**
```javascript
// WRONG: Use jsdom for server-side rendering
const doc = new jsdom.JSDOM().window.document;
doc.createElement('div');  // Slow!
// Result: Server lockup

// RIGHT: Manual HTML strings
let html = '<table>';
data.forEach(cell => html += `<tr><td>${cell}</td></tr>`);
html += '</table>';
// Result: 4x throughput, 20x faster export
```

**Web Workers Solution:**
```javascript
// One background thread per spreadsheet
// Each worker: Independent CPU core
// Result: N spreadsheets = N cores utilized
```

**What to Learn:**
- ❌ Don't parse full DOM for rendering
- ✅ Use Web Workers for parallelism
- ✅ Keep rendering stateless

### 5. Jspreadsheet - The UX Expert

**Virtual Viewport:**
```typescript
class VirtualGrid {
    private VISIBLE_ROWS = 20;
    
    onScroll(offsetY: number) {
        const startRow = Math.floor(offsetY / cellHeight);
        const endRow = startRow + this.VISIBLE_ROWS;
        
        // Only render 20 rows, not 1M
        const visible = cells.filter(c => 
            c.row >= startRow && c.row < endRow
        );
        
        this.render(visible);
    }
}

// Result: 1M rows feel like 20 rows
// Memory: Constant
// Performance: 60fps
```

**What to Copy:**
- ✅ Virtual viewport (essential for scale)
- ✅ Lazy cell creation
- ✅ Smooth scrolling

---

## Your Competitive Advantage

### What Others Don't Do:
❌ Most: Render all cells (always slow)
❌ Most: Eager evaluation (wasted compute)
❌ Most: Row-oriented (cache unfriendly)
❌ Most: Monolithic (hard to extend)

### What YOU Should Do:
✅ Quadratic's rendering (WebGL + spatial hash)
✅ Univer's architecture (modular + commands)
✅ Polars' computation (columnar + lazy)
✅ EtherCalc's scaling (workers + stateless)
✅ Jspreadsheet's UX (virtual viewport)

### Expected Result:
- Parse 10MB: **500ms** (vs 5s)
- Display 1M rows: **60fps** (vs sluggish)
- Complex query: **<500ms** (vs 5s+)
- Memory: **50MB** (vs 500MB)

---

## Phase-by-Phase Steal Strategy

**Phase 1 (Week 1):**
- Copy: Jspreadsheet's virtual viewport
- Copy: Univer's command pattern
- Build: Rust Excel parser
- **Result:** 2x faster, perfect undo

**Phase 2 (Week 2-3):**
- Copy: Polars' lazy evaluation
- Copy: Quadratic's spatial hashing
- Build: Table operations
- **Result:** 5-10x faster, instant queries

**Phase 3 (Week 4-5):**
- Copy: Quadratic's multi-threading
- Copy: Quadratic's WebGL rendering
- Build: Canvas grid
- **Result:** 60fps, 1M cells

**Phase 4 (Week 6):**
- Copy: Univer's plugin system
- Polish: Professional UX
- **Result:** Production-ready
