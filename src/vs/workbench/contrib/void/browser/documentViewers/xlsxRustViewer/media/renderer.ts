// Virtualized Canvas Renderer with formatting, undo/redo, cell operations, and table support

export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    fontFamily?: string;
    fontSize?: number;
    textColor?: string;
    fillColor?: string;
    alignment?: 'left' | 'center' | 'right';
    numberFormat?: string;
    wrapText?: boolean;
}

export interface SelectionRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
}

// --- Formula Range Highlight (for point-mode cell reference selection) ---

export interface FormulaRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    color: string;
    textStart: number;
    textEnd: number;
}

// --- Table Types (mirrors Rust parser::TableDefinition) ---

export interface TableRange {
    start_row: number;
    start_col: number;
    end_row: number;
    end_col: number;
}

export interface TableColumnDef {
    name: string;
    col_index: number;
    totals_function?: string;
    totals_label?: string;
}

export interface TableDefinition {
    name: string;
    display_name: string;
    range: TableRange;
    columns: TableColumnDef[];
    has_header_row: boolean;
    has_totals_row: boolean;
    style_name?: string;
    banded_rows: boolean;
    banded_cols: boolean;
    show_first_column: boolean;
    show_last_column: boolean;
    filter_enabled: boolean;
}

// Color palette per table style (header fill, band fill, border/accent)
interface TableColors { header: string; band: string; border: string; headerText: string }
const TABLE_COLORS: Record<string, TableColors> = {
    'TableStyleMedium2':  { header: '#4472c4', band: '#d6e4f0', border: '#4472c4', headerText: '#fff' },
    'TableStyleMedium1':  { header: '#a5a5a5', band: '#e0e0e0', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleMedium3':  { header: '#ed7d31', band: '#fce4cc', border: '#ed7d31', headerText: '#fff' },
    'TableStyleMedium4':  { header: '#ffc000', band: '#fff2cc', border: '#ffc000', headerText: '#333' },
    'TableStyleMedium5':  { header: '#5b9bd5', band: '#dce6f0', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleMedium6':  { header: '#70ad47', band: '#e2efda', border: '#70ad47', headerText: '#fff' },
    'TableStyleMedium7':  { header: '#264478', band: '#c5d0e0', border: '#264478', headerText: '#fff' },
    'TableStyleMedium9':  { header: '#7030a0', band: '#e1d5ec', border: '#7030a0', headerText: '#fff' },
    'TableStyleLight1':   { header: '#000000', band: '#f2f2f2', border: '#999999', headerText: '#fff' },
    'TableStyleLight2':   { header: '#4472c4', band: '#edf2fa', border: '#4472c4', headerText: '#fff' },
    'TableStyleLight9':   { header: '#ed7d31', band: '#fef4eb', border: '#ed7d31', headerText: '#fff' },
    'TableStyleLight14':  { header: '#70ad47', band: '#f0f7ec', border: '#70ad47', headerText: '#fff' },
    'TableStyleDark1':    { header: '#000000', band: '#404040', border: '#000000', headerText: '#fff' },
    'TableStyleDark2':    { header: '#4472c4', band: '#2b4a7a', border: '#4472c4', headerText: '#fff' },
    'TableStyleDark3':    { header: '#ed7d31', band: '#7a4018', border: '#ed7d31', headerText: '#fff' },
    'TableStyleDark11':   { header: '#7030a0', band: '#3d1a57', border: '#7030a0', headerText: '#fff' },
};
const DEFAULT_TABLE_COLORS: TableColors = { header: '#4472c4', band: '#d6e4f0', border: '#4472c4', headerText: '#fff' };

function getTableColors(styleName?: string): TableColors {
    if (styleName && TABLE_COLORS[styleName]) return TABLE_COLORS[styleName];
    return DEFAULT_TABLE_COLORS;
}

interface UndoSnapshot {
    data: any;
    styles: Record<string, Record<string, CellStyle>>;
}

export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number = 0;
    private height: number = 0;

    // Viewport state
    private scrollTop: number = 0;
    private scrollLeft: number = 0;

    // Config
    private rowHeight = 24;
    private colWidth = 100;
    private headerHeight = 30;
    private headerWidth = 50;

    private data: any = null;

    // Cell styles overlay (not persisted in WASM model yet)
    private styles: Record<string, Record<string, CellStyle>> = {};

    // Selection state
    private selectedCell: { row: number; col: number } | null = null;
    private selectionRange: SelectionRange | null = null;
    private _isDragging: boolean = false;

    // Inline edit state
    private editInput: HTMLInputElement | null = null;
    private editingCell: { row: number; col: number } | null = null;

    // View toggles
    private _showGridlines: boolean = true;
    private _showHeaders: boolean = true;

    // Freeze panes
    private _freezeRow: number = 0;
    private _freezeCol: number = 0;

    // Undo/Redo
    private undoStack: UndoSnapshot[] = [];
    private redoStack: UndoSnapshot[] = [];
    private maxUndoSize = 50;

    // Table definitions for the current sheet
    private tables: TableDefinition[] = [];

    // Formula display cache: "row:col" -> display string
    private formulaResults: Record<string, { display: string; is_error: boolean; numeric: number | null }> = {};

    // Merged cells: array of ranges
    private mergedCells: { startRow: number; startCol: number; endRow: number; endCol: number }[] = [];

    // Per-column widths and per-row heights (sparse, only overrides)
    private colWidths: Record<number, number> = {};
    private rowHeights: Record<number, number> = {};

    // Layout position cache (cumulative pixel positions for variable col/row sizes)
    private _layoutDirty = true;
    private _colPos: number[] = [0];
    private _rowPos: number[] = [0];

    // Column/row resize dragging state
    private _resizeDragging: 'col' | 'row' | null = null;
    private _resizeIndex: number = -1;
    private _resizeStartPos: number = 0;
    private _resizeStartSize: number = 0;

    // Active sheet index
    private _activeSheetIndex: number = 0;

    // Find state
    private _findMatches: { row: number; col: number }[] = [];
    private _findMatchIndex: number = -1;

    // Loading / empty state
    private _loading: boolean = true;

    // Scrollbar state
    private readonly _scrollbarSize = 14;
    private readonly _scrollbarMinThumb = 30;
    private _scrollbarDragging: 'h' | 'v' | null = null;
    private _scrollbarDragStart: number = 0;
    private _scrollbarDragScrollStart: number = 0;

    // Formula point-mode state
    private _formulaMode = false;
    private _formulaRanges: FormulaRange[] = [];
    private _formulaDragAnchor: { row: number; col: number } | null = null;
    private _formulaDragging = false;

    // Callbacks
    public onContextMenu?: (row: number, col: number, x: number, y: number, headerType?: 'col' | 'row') => void;
    public onSelectionChanged?: (row: number, col: number) => void;
    public onCellEdit?: (row: number, col: number, value: string) => void;
    public onSheetChanged?: (index: number) => void;
    public onFormulaRangeSelect?: (row: number, col: number) => void;
    public onFormulaRangeDrag?: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
    public onFormulaRangeDragEnd?: () => void;
    public onInlineEditInput?: (value: string) => void;
    public onInlineEditCommit?: () => void;
    public onInlineEditCancel?: () => void;

    // HTML scrollbar elements
    private _hScrollbar: HTMLDivElement;
    private _hScrollThumb: HTMLDivElement;
    private _hScrollDragging = false;
    private _hScrollDragStartX = 0;
    private _hScrollDragStartScroll = 0;

    constructor(container: HTMLElement) {
        // Wrap canvas and horizontal scrollbar in a flex layout
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';
        container.appendChild(wrapper);

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;outline:none;flex:1;min-height:0;';
        wrapper.appendChild(this.canvas);

        // Create horizontal scrollbar
        this._hScrollbar = document.createElement('div');
        this._hScrollbar.style.cssText = 'height:14px;flex-shrink:0;background:#e8e8e8;border-top:1px solid #ccc;position:relative;cursor:default;';
        wrapper.appendChild(this._hScrollbar);

        this._hScrollThumb = document.createElement('div');
        this._hScrollThumb.style.cssText = 'position:absolute;top:2px;height:10px;min-width:30px;background:#999;border-radius:5px;cursor:pointer;';
        this._hScrollbar.appendChild(this._hScrollThumb);

        // Scrollbar interactions
        this._hScrollThumb.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._hScrollDragging = true;
            this._hScrollDragStartX = e.clientX;
            this._hScrollDragStartScroll = this.scrollLeft;
            this._hScrollThumb.style.background = '#666';
        });
        this._hScrollbar.addEventListener('mousedown', (e) => {
            if (e.target === this._hScrollbar) {
                // Click on track (not thumb) — jump to that position
                const rect = this._hScrollbar.getBoundingClientRect();
                const clickRatio = (e.clientX - rect.left) / rect.width;
                const virtualW = this.getVirtualWidth();
                const viewW = this.width - (this._showHeaders ? this.headerWidth : 0);
                const hMaxScroll = virtualW - viewW;
                this.scrollLeft = Math.max(0, Math.min(hMaxScroll, clickRatio * hMaxScroll));
                this.updateHScrollbar();
                this.render();
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!this._hScrollDragging) return;
            const trackWidth = this._hScrollbar.clientWidth;
            const virtualW = this.getVirtualWidth();
            const viewW = this.width - (this._showHeaders ? this.headerWidth : 0);
            const hMaxScroll = virtualW - viewW;
            const hRatio = Math.min(1, viewW / virtualW);
            const thumbW = Math.max(30, trackWidth * hRatio);
            const trackSpace = trackWidth - thumbW;
            if (trackSpace > 0 && hMaxScroll > 0) {
                const delta = e.clientX - this._hScrollDragStartX;
                this.scrollLeft = Math.max(0, Math.min(hMaxScroll, this._hScrollDragStartScroll + (delta / trackSpace) * hMaxScroll));
                this.updateHScrollbar();
                this.render();
            }
        });
        window.addEventListener('mouseup', () => {
            if (this._hScrollDragging) {
                this._hScrollDragging = false;
                this._hScrollThumb.style.background = '#999';
            }
        });

        const context = this.canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Could not get 2D context');
        this.ctx = context;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        // mouseup on window so we catch releases outside the canvas
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));

        this.canvas.setAttribute('tabindex', '0');
        this.canvas.style.cursor = 'cell';
        this.canvas.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    /** Update the HTML horizontal scrollbar thumb position and size */
    private updateHScrollbar() {
        const virtualW = this.getVirtualWidth();
        const viewW = this.width - (this._showHeaders ? this.headerWidth : 0);
        const trackWidth = this._hScrollbar.clientWidth;
        const hRatio = Math.min(1, viewW / virtualW);
        const thumbW = Math.max(30, trackWidth * hRatio);
        const hMaxScroll = virtualW - viewW;
        const thumbLeft = hMaxScroll > 0
            ? (this.scrollLeft / hMaxScroll) * (trackWidth - thumbW)
            : 0;
        this._hScrollThumb.style.width = `${thumbW}px`;
        this._hScrollThumb.style.left = `${thumbLeft}px`;
    }

    // --- Public API ---

    setData(model: any) {
        this.data = model;
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.styles = {};
        this.undoStack = [];
        this.redoStack = [];
        this._activeSheetIndex = 0;
        this.formulaResults = {};
        this._findMatches = [];
        this._findMatchIndex = -1;
        this.colWidths = {};
        this.rowHeights = {};
        this._layoutDirty = true;
        this._syncFromActiveSheet();
        this._loading = false;
        this.cancelCellEdit();
        this.render();
        this.updateHScrollbar();
    }

    /** Update model without resetting scroll/undo (used for table operations) */
    updateModel(model: any) {
        this.data = model;
        this._layoutDirty = true;
        this._syncFromActiveSheet();
        this.render();
        this.updateHScrollbar();
    }

    /** Sync tables, mergedCells, colWidths, rowHeights from the active sheet */
    private _syncFromActiveSheet() {
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        this.tables = sheet?.tables ?? [];
        this.mergedCells = (sheet?.merged_cells ?? []).map((m: any) => ({
            startRow: m.start_row, startCol: m.start_col,
            endRow: m.end_row, endCol: m.end_col,
        }));
        // Load per-column/row dimensions if present
        if (sheet?.col_widths) {
            this.colWidths = {};
            for (const [k, v] of Object.entries(sheet.col_widths)) {
                this.colWidths[Number(k)] = v as number;
            }
        }
        if (sheet?.row_heights) {
            this.rowHeights = {};
            for (const [k, v] of Object.entries(sheet.row_heights)) {
                this.rowHeights[Number(k)] = v as number;
            }
        }
    }

    getActiveSheetIndex(): number { return this._activeSheetIndex; }

    setActiveSheetIndex(idx: number) {
        if (!this.data?.sheets?.[idx]) return;
        this._activeSheetIndex = idx;
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.selectedCell = null;
        this.selectionRange = null;
        this.formulaResults = {};
        this._layoutDirty = true;
        this._syncFromActiveSheet();
        this.cancelCellEdit();
        this.render();
        if (this.onSheetChanged) this.onSheetChanged(idx);
    }

    getSheetCount(): number {
        return this.data?.sheets?.length ?? 0;
    }

    getSheetNames(): string[] {
        return (this.data?.sheets ?? []).map((s: any) => s.name);
    }

    /** Store formula evaluation results for display */
    setFormulaResults(results: Record<string, { display: string; is_error: boolean; numeric: number | null }>) {
        this.formulaResults = results;
        this.render();
    }

    /** Get a formula result for a specific cell */
    getFormulaDisplay(row: number, col: number): string | null {
        const key = `${row}:${col}`;
        const r = this.formulaResults[key];
        return r ? r.display : null;
    }

    // --- Formula Point-Mode API ---

    /** Enter or exit formula editing mode. In formula mode, clicks insert cell references instead of changing selection. */
    setFormulaMode(active: boolean) {
        this._formulaMode = active;
        if (!active) {
            this._formulaRanges = [];
            this._formulaDragAnchor = null;
            this._formulaDragging = false;
        }
        this.render();
    }

    /** Whether the renderer is currently in formula editing mode */
    isFormulaMode(): boolean {
        return this._formulaMode;
    }

    /** Set the colored range highlights to draw during formula editing */
    setFormulaRanges(ranges: FormulaRange[]) {
        this._formulaRanges = ranges;
        this.render();
    }

    /** Get current formula ranges */
    getFormulaRanges(): FormulaRange[] {
        return this._formulaRanges;
    }

    /** Rebuild cumulative position arrays from colWidths / rowHeights. */
    private ensureLayout(minCols = 200, minRows = 1100) {
        if (!this._layoutDirty
            && this._colPos.length > minCols + 1
            && this._rowPos.length > minRows + 1) return;

        const nc = Math.max(minCols + 1, 201);
        this._colPos = new Array(nc + 1);
        this._colPos[0] = 0;
        for (let c = 0; c < nc; c++) {
            this._colPos[c + 1] = this._colPos[c] + (this.colWidths[c] ?? this.colWidth);
        }

        const nr = Math.max(minRows + 1, 1101);
        this._rowPos = new Array(nr + 1);
        this._rowPos[0] = 0;
        for (let r = 0; r < nr; r++) {
            this._rowPos[r + 1] = this._rowPos[r] + (this.rowHeights[r] ?? this.rowHeight);
        }

        this._layoutDirty = false;
    }

    /** Get the cached X position of a column, growing the cache if needed. */
    private cx(col: number): number {
        if (col >= this._colPos.length) this.ensureLayout(col + 50);
        return this._colPos[col] ?? this.getColX(col);
    }

    /** Get the cached width of a column. */
    private cw(col: number): number {
        if (col + 1 >= this._colPos.length) this.ensureLayout(col + 50);
        return (this._colPos[col + 1] ?? (this._colPos[col] + this.colWidth)) - (this._colPos[col] ?? 0);
    }

    /** Get the cached Y position of a row, growing the cache if needed. */
    private ry(row: number): number {
        if (row >= this._rowPos.length) this.ensureLayout(undefined, row + 50);
        return this._rowPos[row] ?? this.getRowY(row);
    }

    /** Get the cached height of a row. */
    private rh(row: number): number {
        if (row + 1 >= this._rowPos.length) this.ensureLayout(undefined, row + 50);
        return (this._rowPos[row + 1] ?? (this._rowPos[row] + this.rowHeight)) - (this._rowPos[row] ?? 0);
    }

    /** Convert mouse event to canvas drawing coordinates (accounts for any display/buffer mismatch). */
    private mouseToCanvas(e: MouseEvent): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        return {
            x: rect.width > 0 ? sx * this.width / rect.width : sx,
            y: rect.height > 0 ? sy * this.height / rect.height : sy,
        };
    }

    getData(): any {
        // Sync overlay styles to model before returning
        if (this.data?.sheets?.[this._activeSheetIndex]) {
            const sheet = this.data.sheets[this._activeSheetIndex];
            for (const rowKey of Object.keys(this.styles)) {
                const r = parseInt(rowKey, 10);
                for (const colKey of Object.keys(this.styles[rowKey])) {
                    const c = parseInt(colKey, 10);
                    const overlay = this.styles[rowKey][colKey];
                    if (!overlay) continue;
                    if (!sheet.cells[r]) sheet.cells[r] = {};
                    if (!sheet.cells[r][c]) {
                        sheet.cells[r][c] = { value: '', data_type: 'null', style: null };
                    }
                    // Merge overlay into model style
                    const existing = sheet.cells[r][c].style || {};
                    const merged: any = { ...existing };
                    if (overlay.bold !== undefined) merged.bold = overlay.bold || undefined;
                    if (overlay.italic !== undefined) merged.italic = overlay.italic || undefined;
                    if (overlay.underline !== undefined) merged.underline = overlay.underline || undefined;
                    if (overlay.fontSize !== undefined) merged.font_size = overlay.fontSize;
                    if (overlay.fontFamily !== undefined) merged.font_family = overlay.fontFamily;
                    if (overlay.textColor !== undefined) merged.text_color = overlay.textColor;
                    if (overlay.fillColor !== undefined) merged.fill_color = overlay.fillColor;
                    if (overlay.alignment !== undefined) merged.alignment = overlay.alignment;
                    if (overlay.numberFormat !== undefined) merged.number_format = overlay.numberFormat;
                    if (overlay.wrapText !== undefined) merged.wrap_text = overlay.wrapText || undefined;
                    sheet.cells[r][c].style = merged;
                }
            }
        }
        return this.data;
    }

    setLoading(loading: boolean) {
        this._loading = loading;
        this.render();
    }

    getSelectedRange(): SelectionRange | null {
        return this.selectionRange;
    }

    selectAll(): void {
        // Select a large range; for a canvas spreadsheet this is effectively "all visible data"
        this.selectedCell = { row: 0, col: 0 };
        this.selectionRange = { startRow: 0, startCol: 0, endRow: 999, endCol: 99 };
        this.render();
    }

    getSelectedCell(): { row: number; col: number } | null {
        return this.selectedCell;
    }

    getTables(): TableDefinition[] {
        return this.tables;
    }

    getTableAtCell(row: number, col: number): TableDefinition | null {
        for (const table of this.tables) {
            const r = table.range;
            if (row >= r.start_row && row <= r.end_row && col >= r.start_col && col <= r.end_col) {
                return table;
            }
        }
        return null;
    }

    // --- Cell Operations ---

    updateCell(row: number, col: number, value: string, dataType: string = 's'): void {
        if (!this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();

        const sheet = this.data.sheets[this._activeSheetIndex];
        if (!sheet.cells[row]) {
            sheet.cells[row] = {};
        }
        sheet.cells[row][col] = { value, data_type: dataType };

        // Update row_count / col_count if needed
        if (row >= sheet.row_count) sheet.row_count = row + 1;
        if (col >= sheet.col_count) sheet.col_count = col + 1;

        this.render();
    }

    clearSelectedCells(): void {
        if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();

        const sheet = this.data.sheets[this._activeSheetIndex];
        const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
        for (let r = startRow; r <= endRow; r++) {
            if (!sheet.cells[r]) continue;
            for (let c = startCol; c <= endCol; c++) {
                delete sheet.cells[r][c];
            }
            if (Object.keys(sheet.cells[r]).length === 0) {
                delete sheet.cells[r];
            }
        }
        this.render();
    }

    insertRow(atRow?: number): void {
        if (!this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();
        const sheet = this.data.sheets[this._activeSheetIndex];
        const insertAt = atRow ?? (this.selectedCell?.row ?? 0);

        // Shift all rows >= insertAt down by 1
        const newCells: Record<string, any> = {};
        const newStyles: Record<string, Record<string, CellStyle>> = {};
        for (const rowKey of Object.keys(sheet.cells)) {
            const r = parseInt(rowKey, 10);
            const newRow = r >= insertAt ? r + 1 : r;
            newCells[newRow] = sheet.cells[rowKey];
        }
        for (const rowKey of Object.keys(this.styles)) {
            const r = parseInt(rowKey, 10);
            const newRow = r >= insertAt ? r + 1 : r;
            newStyles[newRow] = this.styles[rowKey];
        }
        sheet.cells = newCells;
        this.styles = newStyles;
        sheet.row_count = (sheet.row_count || 0) + 1;
        this.render();
    }

    deleteRow(atRow?: number): void {
        if (!this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();
        const sheet = this.data.sheets[this._activeSheetIndex];
        const deleteAt = atRow ?? (this.selectedCell?.row ?? 0);

        const newCells: Record<string, any> = {};
        const newStyles: Record<string, Record<string, CellStyle>> = {};
        for (const rowKey of Object.keys(sheet.cells)) {
            const r = parseInt(rowKey, 10);
            if (r === deleteAt) continue;
            const newRow = r > deleteAt ? r - 1 : r;
            newCells[newRow] = sheet.cells[rowKey];
        }
        for (const rowKey of Object.keys(this.styles)) {
            const r = parseInt(rowKey, 10);
            if (r === deleteAt) continue;
            const newRow = r > deleteAt ? r - 1 : r;
            newStyles[newRow] = this.styles[rowKey];
        }
        sheet.cells = newCells;
        this.styles = newStyles;
        sheet.row_count = Math.max(0, (sheet.row_count || 1) - 1);
        this.render();
    }

    insertCol(atCol?: number): void {
        if (!this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();
        const sheet = this.data.sheets[this._activeSheetIndex];
        const insertAt = atCol ?? (this.selectedCell?.col ?? 0);

        for (const rowKey of Object.keys(sheet.cells)) {
            const row = sheet.cells[rowKey];
            const newRow: Record<string, any> = {};
            for (const colKey of Object.keys(row)) {
                const c = parseInt(colKey, 10);
                const newCol = c >= insertAt ? c + 1 : c;
                newRow[newCol] = row[colKey];
            }
            sheet.cells[rowKey] = newRow;
        }
        for (const rowKey of Object.keys(this.styles)) {
            const row = this.styles[rowKey];
            const newRow: Record<string, CellStyle> = {};
            for (const colKey of Object.keys(row)) {
                const c = parseInt(colKey, 10);
                const newCol = c >= insertAt ? c + 1 : c;
                newRow[newCol] = row[colKey];
            }
            this.styles[rowKey] = newRow;
        }
        sheet.col_count = (sheet.col_count || 0) + 1;
        this.render();
    }

    deleteCol(atCol?: number): void {
        if (!this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();
        const sheet = this.data.sheets[this._activeSheetIndex];
        const deleteAt = atCol ?? (this.selectedCell?.col ?? 0);

        for (const rowKey of Object.keys(sheet.cells)) {
            const row = sheet.cells[rowKey];
            const newRow: Record<string, any> = {};
            for (const colKey of Object.keys(row)) {
                const c = parseInt(colKey, 10);
                if (c === deleteAt) continue;
                const newCol = c > deleteAt ? c - 1 : c;
                newRow[newCol] = row[colKey];
            }
            sheet.cells[rowKey] = newRow;
        }
        for (const rowKey of Object.keys(this.styles)) {
            const row = this.styles[rowKey];
            const newRow: Record<string, CellStyle> = {};
            for (const colKey of Object.keys(row)) {
                const c = parseInt(colKey, 10);
                if (c === deleteAt) continue;
                const newCol = c > deleteAt ? c - 1 : c;
                newRow[newCol] = row[colKey];
            }
            this.styles[rowKey] = newRow;
        }
        sheet.col_count = Math.max(0, (sheet.col_count || 1) - 1);
        this.render();
    }

    // --- Sorting ---

    sortColumn(ascending: boolean, col?: number): void {
        if (!this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();

        const sheet = this.data.sheets[this._activeSheetIndex];
        const sortCol = col ?? (this.selectedCell?.col ?? 0);

        // Collect all row indices with data
        const rowKeys = Object.keys(sheet.cells).map(k => parseInt(k, 10)).sort((a, b) => a - b);
        if (rowKeys.length === 0) return;

        // Extract rows with their original index
        const rows: { key: number; cells: any; style: Record<string, CellStyle> | undefined }[] = [];
        for (const rk of rowKeys) {
            rows.push({
                key: rk,
                cells: sheet.cells[rk],
                style: this.styles[rk]
            });
        }

        // Sort by the target column value
        rows.sort((a, b) => {
            const aVal = a.cells?.[sortCol]?.value ?? '';
            const bVal = b.cells?.[sortCol]?.value ?? '';
            const aNum = Number(aVal);
            const bNum = Number(bVal);
            const bothNumeric = aVal !== '' && bVal !== '' && !isNaN(aNum) && !isNaN(bNum);

            let cmp: number;
            if (bothNumeric) {
                cmp = aNum - bNum;
            } else {
                cmp = aVal.localeCompare(bVal);
            }
            return ascending ? cmp : -cmp;
        });

        // Reassign rows to sequential indices
        const newCells: Record<string, any> = {};
        const newStyles: Record<string, Record<string, CellStyle>> = {};
        rows.forEach((row, idx) => {
            newCells[idx] = row.cells;
            if (row.style) {
                newStyles[idx] = row.style;
            }
        });
        sheet.cells = newCells;
        this.styles = newStyles;
        this.render();
    }

    // --- Formatting ---

    applyFormat(property: string, value: string | undefined): void {
        if (!this.selectionRange) return;
        this.pushUndo();

        const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
        for (let r = startRow; r <= endRow; r++) {
            if (!this.styles[r]) this.styles[r] = {};
            for (let c = startCol; c <= endCol; c++) {
                if (!this.styles[r][c]) this.styles[r][c] = {};
                switch (property) {
                    case 'fontFamily': this.styles[r][c].fontFamily = value; break;
                    case 'fontSize': this.styles[r][c].fontSize = value ? parseInt(value, 10) : undefined; break;
                    case 'textColor': this.styles[r][c].textColor = value; break;
                    case 'fillColor': this.styles[r][c].fillColor = value; break;
                    case 'alignment': this.styles[r][c].alignment = value as CellStyle['alignment']; break;
                    case 'numberFormat': this.styles[r][c].numberFormat = value; break;
                }
            }
        }
        this.render();
    }

    toggleFormat(property: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'wrapText'): void {
        if (!this.selectionRange) return;
        this.pushUndo();

        const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);

        // Check if ALL cells in selection have the property set — if so, toggle off
        let allSet = true;
        for (let r = startRow; r <= endRow && allSet; r++) {
            for (let c = startCol; c <= endCol && allSet; c++) {
                if (!this.styles[r]?.[c]?.[property]) allSet = false;
            }
        }
        const newValue = !allSet;

        for (let r = startRow; r <= endRow; r++) {
            if (!this.styles[r]) this.styles[r] = {};
            for (let c = startCol; c <= endCol; c++) {
                if (!this.styles[r][c]) this.styles[r][c] = {};
                (this.styles[r][c] as any)[property] = newValue;
            }
        }
        this.render();
    }

    // --- View Toggles ---

    toggleGridlines(): void {
        this._showGridlines = !this._showGridlines;
        this.render();
    }

    toggleHeaders(): void {
        this._showHeaders = !this._showHeaders;
        this.render();
    }

    freezePanes(): void {
        if (this._freezeRow > 0 || this._freezeCol > 0) {
            // If already frozen, unfreeze
            this._freezeRow = 0;
            this._freezeCol = 0;
        } else if (this.selectedCell) {
            this._freezeRow = this.selectedCell.row;
            this._freezeCol = this.selectedCell.col;
        }
        this.render();
    }

    // --- Undo / Redo ---

    undo(): void {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(this.snapshot());
        const prev = this.undoStack.pop()!;
        this.restoreSnapshot(prev);
        this.render();
    }

    redo(): void {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(this.snapshot());
        const next = this.redoStack.pop()!;
        this.restoreSnapshot(next);
        this.render();
    }

    private pushUndo() {
        this.undoStack.push(this.snapshot());
        if (this.undoStack.length > this.maxUndoSize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    private snapshot(): UndoSnapshot {
        return {
            data: JSON.parse(JSON.stringify(this.data)),
            styles: JSON.parse(JSON.stringify(this.styles))
        };
    }

    private restoreSnapshot(snap: UndoSnapshot) {
        this.data = snap.data;
        this.styles = snap.styles;
    }

    // --- Selection Data Helpers ---

    getSelectedCellValues(): number[] {
        if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return [];
        const sheet = this.data.sheets[this._activeSheetIndex];
        const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
        const values: number[] = [];
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = sheet.cells?.[r]?.[c];
                if (cell) {
                    const n = Number(cell.value);
                    if (!isNaN(n)) values.push(n);
                }
            }
        }
        return values;
    }

    getSelectedCellsData(): string {
        if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return '';
        const sheet = this.data.sheets[this._activeSheetIndex];
        const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
        const lines: string[] = [];
        for (let r = startRow; r <= endRow; r++) {
            const cells: string[] = [];
            for (let c = startCol; c <= endCol; c++) {
                const cell = sheet.cells?.[r]?.[c];
                cells.push(cell?.value ?? '');
            }
            lines.push(cells.join('\t'));
        }
        return lines.join('\n');
    }

    pasteData(text: string): void {
        if (!this.selectedCell || !this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();

        const sheet = this.data.sheets[this._activeSheetIndex];
        const lines = text.split('\n');
        const startRow = this.selectedCell.row;
        const startCol = this.selectedCell.col;

        for (let r = 0; r < lines.length; r++) {
            const cells = lines[r].split('\t');
            for (let c = 0; c < cells.length; c++) {
                const row = startRow + r;
                const col = startCol + c;
                if (!sheet.cells[row]) sheet.cells[row] = {};
                const val = cells[c];
                const dataType = val.trim() !== '' && !isNaN(Number(val)) ? 'n' : 's';
                sheet.cells[row][col] = { value: val, data_type: dataType };
                if (row >= sheet.row_count) sheet.row_count = row + 1;
                if (col >= sheet.col_count) sheet.col_count = col + 1;
            }
        }
        this.render();
    }

    // --- Event Handlers ---

    private handleWheel(e: WheelEvent) {
        e.preventDefault();
        if (e.shiftKey) {
            // Shift+Wheel scrolls horizontally
            this.scrollLeft += e.deltaY;
        } else {
            this.scrollTop += e.deltaY;
            this.scrollLeft += e.deltaX;
        }
        this.scrollTop = Math.max(0, this.scrollTop);
        this.scrollLeft = Math.max(0, this.scrollLeft);
        this.updateHScrollbar();
        requestAnimationFrame(() => this.render());
    }

    private hitTestCell(e: MouseEvent): { row: number; col: number } | null {
        const { x, y } = this.mouseToCanvas(e);
        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
        if (x <= effHeaderWidth || y <= effHeaderHeight) return null;
        const gridX = x - effHeaderWidth + this.scrollLeft;
        const gridY = y - effHeaderHeight + this.scrollTop;
        this.ensureLayout();
        let col = 0;
        while (col < this._colPos.length - 2 && this._colPos[col + 1] <= gridX) col++;
        let row = 0;
        while (row < this._rowPos.length - 2 && this._rowPos[row + 1] <= gridY) row++;
        return { col: Math.max(0, col), row: Math.max(0, row) };
    }

    private _headerDragMode: 'col' | 'row' | null = null;

    private handleMouseDown(e: MouseEvent) {
        const { x: mx, y: my } = this.mouseToCanvas(e);

        // Check for vertical scrollbar click on canvas
        const sbHit = this.hitTestScrollbar(mx, my);
        if (sbHit) {
            e.preventDefault();
            const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
            const viewH = this.height - effHeaderHeight;
            const virtualH = this.getVirtualHeight();
            const vMaxScroll = virtualH - viewH;
            // Jump to clicked position
            const clickRatio = (my - effHeaderHeight) / viewH;
            this.scrollTop = Math.max(0, Math.min(vMaxScroll, clickRatio * vMaxScroll));
            this._scrollbarDragStart = my;
            this._scrollbarDragScrollStart = this.scrollTop;
            this._scrollbarDragging = 'v';
            this.render();
            return;
        }

        // Check for column/row resize drag start
        if (this._showHeaders) {
            const resizeTarget = this.hitTestResize(e);
            if (resizeTarget) {
                this._resizeDragging = resizeTarget.type;
                this._resizeIndex = resizeTarget.index;
                this._resizeStartPos = resizeTarget.type === 'col' ? e.clientX : e.clientY;
                this._resizeStartSize = resizeTarget.type === 'col'
                    ? (this.colWidths[resizeTarget.index] ?? this.colWidth)
                    : (this.rowHeights[resizeTarget.index] ?? this.rowHeight);
                e.preventDefault();
                return;
            }
        }

        // Check for column/row header click to select entire column/row
        if (this._showHeaders) {
            const { x, y } = this.mouseToCanvas(e);

            // Click on column header (top row, to the right of the row-number gutter)
            if (y <= this.headerHeight && x > this.headerWidth) {
                const col = this.hitTestColHeader(x);
                if (col !== null) {
                    this.commitCellEdit();
                    this.selectedCell = { row: 0, col };
                    this.selectionRange = { startRow: 0, startCol: col, endRow: 999, endCol: col };
                    this._headerDragMode = 'col';
                    this._isDragging = true;
                    if (this.onSelectionChanged) this.onSelectionChanged(0, col);
                    this.render();
                    return;
                }
            }

            // Click on row header (left gutter, below the column-letter header)
            if (x <= this.headerWidth && y > this.headerHeight) {
                const row = this.hitTestRowHeader(y);
                if (row !== null) {
                    this.commitCellEdit();
                    this.selectedCell = { row, col: 0 };
                    this.selectionRange = { startRow: row, startCol: 0, endRow: row, endCol: 99 };
                    this._headerDragMode = 'row';
                    this._isDragging = true;
                    if (this.onSelectionChanged) this.onSelectionChanged(row, 0);
                    this.render();
                    return;
                }
            }
        }

        const cell = this.hitTestCell(e);
        if (!cell) return;
        const { row, col } = cell;

        // Formula point-mode: clicks insert cell references instead of changing selection
        if (this._formulaMode) {
            this._formulaDragAnchor = { row, col };
            this._formulaDragging = true;
            if (this.onFormulaRangeSelect) {
                this.onFormulaRangeSelect(row, col);
            }
            return;
        }

        // Commit any active cell edit
        this.commitCellEdit();
        this._headerDragMode = null;

        if (e.shiftKey && this.selectedCell) {
            // Shift+Click → extend the selection from the anchor cell
            this.selectionRange = {
                startRow: this.selectedCell.row,
                startCol: this.selectedCell.col,
                endRow: row,
                endCol: col
            };
        } else {
            // Normal click → new anchor
            this.selectedCell = { row, col };
            this.selectionRange = { startRow: row, startCol: col, endRow: row, endCol: col };
        }

        this._isDragging = true;

        if (this.onSelectionChanged) {
            this.onSelectionChanged(
                this.selectedCell!.row,
                this.selectedCell!.col
            );
        }
        this.render();
    }

    /** Hit test vertical scrollbar area on canvas. */
    private hitTestScrollbar(canvasX: number, canvasY: number): { axis: 'v' } | null {
        const sb = this._scrollbarSize;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;

        // Vertical scrollbar track
        if (canvasX >= this.width - sb && canvasY >= effHeaderHeight) {
            return { axis: 'v' };
        }
        return null;
    }

    /** Determine which column index a click in the column header area falls on */
    private hitTestColHeader(canvasX: number): number | null {
        const gridX = canvasX - this.headerWidth + this.scrollLeft;
        let cx = 0;
        let col = 0;
        while (cx < gridX + (this.colWidths[col] ?? this.colWidth)) {
            const w = this.colWidths[col] ?? this.colWidth;
            if (gridX >= cx && gridX < cx + w) return col;
            cx += w;
            col++;
            if (col > 16383) break; // Excel max columns
        }
        return null;
    }

    /** Determine which row index a click in the row header area falls on */
    private hitTestRowHeader(canvasY: number): number | null {
        const gridY = canvasY - this.headerHeight + this.scrollTop;
        let cy = 0;
        let row = 0;
        while (cy < gridY + (this.rowHeights[row] ?? this.rowHeight)) {
            const h = this.rowHeights[row] ?? this.rowHeight;
            if (gridY >= cy && gridY < cy + h) return row;
            cy += h;
            row++;
            if (row > 1048575) break; // Excel max rows
        }
        return null;
    }

    private handleMouseMove(e: MouseEvent) {
        // Handle vertical scrollbar drag
        if (this._scrollbarDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
            const viewH = this.height - effHeaderHeight;
            const virtualH = this.getVirtualHeight();
            const vMaxScroll = virtualH - viewH;
            const vRatio = Math.min(1, viewH / virtualH);
            const vThumbH = Math.max(this._scrollbarMinThumb, viewH * vRatio);
            const trackSpace = viewH - vThumbH;
            if (trackSpace > 0) {
                const delta = (e.clientY - rect.top) - this._scrollbarDragStart;
                this.scrollTop = Math.max(0, Math.min(vMaxScroll, this._scrollbarDragScrollStart + (delta / trackSpace) * vMaxScroll));
            }
            requestAnimationFrame(() => this.render());
            return;
        }

        // Handle resize drag
        if (this._resizeDragging) {
            if (this._resizeDragging === 'col') {
                const delta = e.clientX - this._resizeStartPos;
                this.colWidths[this._resizeIndex] = Math.max(20, this._resizeStartSize + delta);
            } else {
                const delta = e.clientY - this._resizeStartPos;
                this.rowHeights[this._resizeIndex] = Math.max(10, this._resizeStartSize + delta);
            }
            this._layoutDirty = true;
            this.render();
            return;
        }

        // Update cursor for resize handles, header areas, and scrollbars
        if (!this._isDragging && !this._scrollbarDragging) {
            const { x: mx, y: my } = this.mouseToCanvas(e);

            // Scrollbar area
            if (this.hitTestScrollbar(mx, my)) {
                this.canvas.style.cursor = 'default';
            } else if (this._showHeaders) {
                const resizeTarget = this.hitTestResize(e);
                if (resizeTarget) {
                    this.canvas.style.cursor = resizeTarget.type === 'col' ? 'col-resize' : 'row-resize';
                } else if (my <= this.headerHeight && mx > this.headerWidth) {
                    this.canvas.style.cursor = 'pointer'; // Column header
                } else if (mx <= this.headerWidth && my > this.headerHeight) {
                    this.canvas.style.cursor = 'pointer'; // Row header
                } else {
                    this.canvas.style.cursor = 'cell';
                }
            } else {
                this.canvas.style.cursor = 'cell';
            }
        }

        // Formula point-mode drag: extend the reference range
        if (this._formulaDragging && this._formulaDragAnchor) {
            const cell = this.hitTestCell(e);
            if (cell && this.onFormulaRangeDrag) {
                this.onFormulaRangeDrag(
                    this._formulaDragAnchor.row,
                    this._formulaDragAnchor.col,
                    cell.row,
                    cell.col
                );
            }
            return;
        }

        if (!this._isDragging || !this.selectedCell || !this.selectionRange) return;

        // Handle header drag to extend row/column selection
        if (this._headerDragMode) {
            const { x, y } = this.mouseToCanvas(e);
            if (this._headerDragMode === 'col') {
                const col = this.hitTestColHeader(x);
                if (col !== null && col !== this.selectionRange.endCol) {
                    this.selectionRange.endCol = col;
                    this.render();
                }
            } else {
                const row = this.hitTestRowHeader(y);
                if (row !== null && row !== this.selectionRange.endRow) {
                    this.selectionRange.endRow = row;
                    this.render();
                }
            }
            return;
        }

        const cell = this.hitTestCell(e);
        if (!cell) return;

        // Only re-render if the drag actually moved to a different cell
        if (cell.row !== this.selectionRange.endRow || cell.col !== this.selectionRange.endCol) {
            this.selectionRange.endRow = cell.row;
            this.selectionRange.endCol = cell.col;
            this.render();
        }
    }

    private handleMouseUp() {
        if (this._scrollbarDragging) {
            this._scrollbarDragging = null;
            this.render();
            return;
        }
        if (this._resizeDragging) {
            this._resizeDragging = null;
            // Sync col/row dimensions to the model
            const sheet = this.data?.sheets?.[this._activeSheetIndex];
            if (sheet) {
                sheet.col_widths = { ...this.colWidths };
                sheet.row_heights = { ...this.rowHeights };
            }
            return;
        }
        if (this._formulaDragging) {
            this._formulaDragging = false;
            this._formulaDragAnchor = null;
            if (this.onFormulaRangeDragEnd) {
                this.onFormulaRangeDragEnd();
            }
        }
        this._isDragging = false;
        this._headerDragMode = null;
    }

    /** Detect if mouse is near a column/row header border for resize */
    private hitTestResize(e: MouseEvent): { type: 'col' | 'row'; index: number } | null {
        const { x, y } = this.mouseToCanvas(e);
        const threshold = 5;
        this.ensureLayout();

        // Column header resize (top header area, near column right border)
        if (y < this.headerHeight && x > this.headerWidth) {
            // Find the first visible column
            let col = 0;
            while (col < this._colPos.length - 1 && this._colPos[col + 1] <= this.scrollLeft) col++;
            while (col < this._colPos.length - 1) {
                const borderX = this.headerWidth + this._colPos[col + 1] - this.scrollLeft;
                if (borderX > this.width + threshold) break;
                if (Math.abs(x - borderX) < threshold) {
                    return { type: 'col', index: col };
                }
                col++;
            }
        }

        // Row header resize (left header area, near row bottom border)
        if (x < this.headerWidth && y > this.headerHeight) {
            let row = 0;
            while (row < this._rowPos.length - 1 && this._rowPos[row + 1] <= this.scrollTop) row++;
            while (row < this._rowPos.length - 1) {
                const borderY = this.headerHeight + this._rowPos[row + 1] - this.scrollTop;
                if (borderY > this.height + threshold) break;
                if (Math.abs(y - borderY) < threshold) {
                    return { type: 'row', index: row };
                }
                row++;
            }
        }

        return null;
    }

    private handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        const { x, y } = this.mouseToCanvas(e);

        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;

        // Right-click on column header
        if (this._showHeaders && y <= this.headerHeight && x > this.headerWidth) {
            const col = this.hitTestColHeader(x);
            if (col !== null) {
                // Select the entire column if not already selected
                this.selectedCell = { row: 0, col };
                this.selectionRange = { startRow: 0, startCol: col, endRow: 999, endCol: col };
                this.render();
                if (this.onContextMenu) {
                    this.onContextMenu(0, col, e.clientX, e.clientY, 'col');
                }
            }
            return;
        }

        // Right-click on row header
        if (this._showHeaders && x <= this.headerWidth && y > this.headerHeight) {
            const row = this.hitTestRowHeader(y);
            if (row !== null) {
                // Select the entire row if not already selected
                this.selectedCell = { row, col: 0 };
                this.selectionRange = { startRow: row, startCol: 0, endRow: row, endCol: 99 };
                this.render();
                if (this.onContextMenu) {
                    this.onContextMenu(row, 0, e.clientX, e.clientY, 'row');
                }
            }
            return;
        }

        // Right-click on a cell
        if (x > effHeaderWidth && y > effHeaderHeight) {
            const gridX = x - effHeaderWidth + this.scrollLeft;
            const gridY = y - effHeaderHeight + this.scrollTop;
            this.ensureLayout();
            let col = 0;
            while (col < this._colPos.length - 2 && this._colPos[col + 1] <= gridX) col++;
            let row = 0;
            while (row < this._rowPos.length - 2 && this._rowPos[row + 1] <= gridY) row++;

            if (!this.isInsideSelection(row, col)) {
                this.selectedCell = { row, col };
                this.selectionRange = { startRow: row, startCol: col, endRow: row, endCol: col };
                this.render();
            }

            if (this.onContextMenu) {
                this.onContextMenu(row, col, e.clientX, e.clientY);
            }
        }
    }

    private isInsideSelection(row: number, col: number): boolean {
        if (!this.selectionRange) return false;
        const n = this.normalizeRange(this.selectionRange);
        return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (!this.selectedCell) return;

        const { row, col } = this.selectedCell;

        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight': {
                e.preventDefault();
                let newRow = e.key === 'ArrowUp' ? Math.max(0, row - 1)
                    : e.key === 'ArrowDown' ? row + 1
                    : row;
                let newCol = e.key === 'ArrowLeft' ? Math.max(0, col - 1)
                    : e.key === 'ArrowRight' ? col + 1
                    : col;

                if (e.shiftKey && this.selectionRange) {
                    // Shift+Arrow → extend the selection, keep anchor
                    const endRow = e.key === 'ArrowUp' ? Math.max(0, this.selectionRange.endRow - 1)
                        : e.key === 'ArrowDown' ? this.selectionRange.endRow + 1
                        : this.selectionRange.endRow;
                    const endCol = e.key === 'ArrowLeft' ? Math.max(0, this.selectionRange.endCol - 1)
                        : e.key === 'ArrowRight' ? this.selectionRange.endCol + 1
                        : this.selectionRange.endCol;
                    this.selectionRange.endRow = endRow;
                    this.selectionRange.endCol = endCol;
                    this.scrollIntoView(endRow, endCol);
                } else {
                    // Normal arrow → move anchor, collapse selection
                    this.selectedCell = { row: newRow, col: newCol };
                    this.selectionRange = { startRow: newRow, startCol: newCol, endRow: newRow, endCol: newCol };
                    this.scrollIntoView(newRow, newCol);
                    if (this.onSelectionChanged) {
                        this.onSelectionChanged(newRow, newCol);
                    }
                }
                this.render();
                return;
            }
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.clearSelectedCells();
                if (this.onCellEdit) this.onCellEdit(row, col, '');
                return;
            case 'Enter':
                e.preventDefault();
                this.startCellEdit(row, col);
                return;
            case 'F2':
                e.preventDefault();
                this.startCellEdit(row, col);
                return;
            case 'Escape':
                // Collapse selection to anchor
                if (this.selectionRange && this.selectedCell) {
                    this.selectionRange = {
                        startRow: this.selectedCell.row,
                        startCol: this.selectedCell.col,
                        endRow: this.selectedCell.row,
                        endCol: this.selectedCell.col
                    };
                    this.render();
                }
                return;
            default:
                // Printable character → start editing with that character
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    this.startCellEdit(row, col, e.key);
                }
                return;
        }
    }

    private scrollIntoView(row: number, col: number) {
        this.ensureLayout();
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;

        const cellTop = this.ry(row);
        const cellBottom = cellTop + this.rh(row);
        const cellLeft = this.cx(col);
        const cellRight = cellLeft + this.cw(col);

        const viewportTop = this.scrollTop;
        const viewportBottom = this.scrollTop + (this.height - effHeaderHeight);

        if (cellTop < viewportTop) {
            this.scrollTop = cellTop;
        } else if (cellBottom > viewportBottom) {
            this.scrollTop = cellBottom - (this.height - effHeaderHeight);
        }

        const viewportLeft = this.scrollLeft;
        const viewportRight = this.scrollLeft + (this.width - effHeaderWidth);

        if (cellLeft < viewportLeft) {
            this.scrollLeft = cellLeft;
        } else if (cellRight > viewportRight) {
            this.scrollLeft = cellRight - (this.width - effHeaderWidth);
        }
        this.updateHScrollbar();
    }

    resize() {
        // Use getBoundingClientRect for the actual display dimensions -- this is
        // the same coordinate space mouse events use, so hit-tests always match.
        // (flex:1 with flex-basis:0 sizes the canvas regardless of explicit height.)
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.width = Math.round(rect.width);
            this.height = Math.round(rect.height);
        } else {
            // Fallback before first layout (e.g. during constructor)
            const parent = this.canvas.parentElement;
            if (!parent) return;
            this.width = parent.clientWidth;
            this.height = parent.clientHeight - (this._hScrollbar?.offsetHeight ?? 0);
        }

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.scale(dpr, dpr);

        this.render();
        this.updateHScrollbar();
    }

    // --- Rendering ---

    render() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Loading state
        if (this._loading) {
            this.ctx.fillStyle = '#888';
            this.ctx.font = '14px system-ui, -apple-system, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Loading...', this.width / 2, this.height / 2);
            return;
        }

        // Empty state
        if (!this.data || !this.data.sheets || this.data.sheets.length === 0) {
            this.ctx.fillStyle = '#888';
            this.ctx.font = '14px system-ui, -apple-system, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('No data to display. Open an XLSX file or start typing.', this.width / 2, this.height / 2);
            return;
        }

        const sheet = this.data.sheets[this._activeSheetIndex];
        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;

        this.ensureLayout();
        // Walk cached position arrays to find visible row/col range
        let startRow = 0;
        while (startRow < this._rowPos.length - 1 && this._rowPos[startRow + 1] <= this.scrollTop) startRow++;
        let endRow = startRow;
        const viewBottom = this.scrollTop + this.height;
        while (endRow < this._rowPos.length - 1 && this._rowPos[endRow] < viewBottom) endRow++;
        endRow = Math.min(endRow + 1, this._rowPos.length - 1);
        let startCol = 0;
        while (startCol < this._colPos.length - 1 && this._colPos[startCol + 1] <= this.scrollLeft) startCol++;
        let endCol = startCol;
        const viewRight = this.scrollLeft + this.width;
        while (endCol < this._colPos.length - 1 && this._colPos[endCol] < viewRight) endCol++;
        endCol = Math.min(endCol + 1, this._colPos.length - 1);

        this.ctx.save();
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 1;

        // --- Draw Cells ---
        for (let r = startRow; r < endRow; r++) {
            const cellH = this.rh(r);
            const y = this.ry(r) - this.scrollTop + effHeaderHeight;
            if (y < effHeaderHeight - cellH) continue;

            for (let c = startCol; c < endCol; c++) {
                const cellW = this.cw(c);
                const x = this.cx(c) - this.scrollLeft + effHeaderWidth;
                if (x < effHeaderWidth - cellW) continue;

                const cellStyle = this.getCellStyle(r, c);

                // Cell fill
                if (cellStyle?.fillColor && cellStyle.fillColor !== '#ffffff') {
                    this.ctx.fillStyle = cellStyle.fillColor;
                    this.ctx.fillRect(x, y, cellW, cellH);
                }

                // Grid lines
                if (this._showGridlines) {
                    this.ctx.strokeStyle = '#e0e0e0';
                    this.ctx.strokeRect(x, y, cellW, cellH);
                }

                // Multi-cell selection highlight (light fill on all selected cells)
                if (this.selectionRange) {
                    const norm = this.normalizeRange(this.selectionRange);
                    if (r >= norm.startRow && r <= norm.endRow && c >= norm.startCol && c <= norm.endCol) {
                        // Don't tint the active cell — only the "rest" of the selection
                        const isAnchor = this.selectedCell && r === this.selectedCell.row && c === this.selectedCell.col;
                        if (!isAnchor) {
                            this.ctx.fillStyle = 'rgba(0, 120, 215, 0.12)';
                            this.ctx.fillRect(x, y, cellW, cellH);
                        }
                    }
                }

                // Active cell border (the anchor)
                if (this.selectedCell && r === this.selectedCell.row && c === this.selectedCell.col) {
                    this.ctx.strokeStyle = '#0078d7';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
                    this.ctx.lineWidth = 1;
                }

                // Cell content
                const rowData = sheet.cells[r];
                let cellValue = '';
                if (rowData) {
                    const cellData = rowData[c];
                    if (cellData) {
                        // If it's a formula, show the computed display value
                        if (cellData.value && cellData.value.startsWith('=')) {
                            const formulaResult = this.formulaResults[`${r}:${c}`];
                            cellValue = formulaResult ? formulaResult.display : cellData.value;
                        } else {
                            cellValue = this.formatCellValue(cellData.value, cellData.data_type, cellStyle);
                        }
                    }
                }

                if (cellValue) {
                    // Build font string
                    const fontSize = cellStyle?.fontSize || 13;
                    const fontFamily = cellStyle?.fontFamily || 'system-ui, -apple-system, sans-serif';
                    let fontStr = `${fontSize}px ${fontFamily}`;
                    if (cellStyle?.bold) fontStr = `bold ${fontStr}`;
                    if (cellStyle?.italic) fontStr = `italic ${fontStr}`;
                    this.ctx.font = fontStr;

                    this.ctx.fillStyle = cellStyle?.textColor || '#000';
                    this.ctx.textAlign = cellStyle?.alignment || 'left';

                    // Clip text to cell
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.rect(x + 1, y + 1, cellW - 2, cellH - 2);
                    this.ctx.clip();

                    let textX = x + 4;
                    if (cellStyle?.alignment === 'center') textX = x + cellW / 2;
                    else if (cellStyle?.alignment === 'right') textX = x + cellW - 4;

                    const textY = y + cellH / 2;
                    this.ctx.fillText(cellValue, textX, textY);

                    // Underline
                    if (cellStyle?.underline) {
                        const metrics = this.ctx.measureText(cellValue);
                        const lineY = textY + fontSize * 0.15;
                        this.ctx.beginPath();
                        this.ctx.strokeStyle = cellStyle.textColor || '#000';
                        this.ctx.lineWidth = 1;
                        if (cellStyle.alignment === 'center') {
                            this.ctx.moveTo(textX - metrics.width / 2, lineY);
                            this.ctx.lineTo(textX + metrics.width / 2, lineY);
                        } else if (cellStyle.alignment === 'right') {
                            this.ctx.moveTo(textX - metrics.width, lineY);
                            this.ctx.lineTo(textX, lineY);
                        } else {
                            this.ctx.moveTo(textX, lineY);
                            this.ctx.lineTo(textX + metrics.width, lineY);
                        }
                        this.ctx.stroke();
                    }

                    // Strikethrough
                    if (cellStyle?.strikethrough) {
                        const metrics = this.ctx.measureText(cellValue);
                        this.ctx.beginPath();
                        this.ctx.strokeStyle = cellStyle.textColor || '#000';
                        this.ctx.lineWidth = 1;
                        if (cellStyle.alignment === 'center') {
                            this.ctx.moveTo(textX - metrics.width / 2, textY);
                            this.ctx.lineTo(textX + metrics.width / 2, textY);
                        } else if (cellStyle.alignment === 'right') {
                            this.ctx.moveTo(textX - metrics.width, textY);
                            this.ctx.lineTo(textX, textY);
                        } else {
                            this.ctx.moveTo(textX, textY);
                            this.ctx.lineTo(textX + metrics.width, textY);
                        }
                        this.ctx.stroke();
                    }

                    this.ctx.restore();
                }
            }
        }

        // --- Draw Table Overlays ---
        for (const table of this.tables) {
            const tr = table.range;
            const tc = getTableColors(table.style_name);

            // Clip to grid area
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
            this.ctx.clip();

            // Banded rows (alternating fill using style band color)
            if (table.banded_rows) {
                const dataStartRow = table.has_header_row ? tr.start_row + 1 : tr.start_row;
                const dataEndRow = table.has_totals_row ? tr.end_row - 1 : tr.end_row;
                for (let r = dataStartRow; r <= dataEndRow; r++) {
                    const bandIdx = r - dataStartRow;
                    if (bandIdx % 2 === 1) {
                        const y = this.ry(r) - this.scrollTop + effHeaderHeight;
                        const x0 = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
                        const w = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
                        this.ctx.fillStyle = tc.band;
                        this.ctx.globalAlpha = 0.45;
                        this.ctx.fillRect(x0, y, w, this.rh(r));
                        this.ctx.globalAlpha = 1.0;
                    }
                }
            }

            // Banded columns
            if (table.banded_cols) {
                for (let c = tr.start_col; c <= tr.end_col; c++) {
                    const bandIdx = c - tr.start_col;
                    if (bandIdx % 2 === 1) {
                        const x = this.cx(c) - this.scrollLeft + effHeaderWidth;
                        const topRow = table.has_header_row ? tr.start_row + 1 : tr.start_row;
                        const botRow = table.has_totals_row ? tr.end_row - 1 : tr.end_row;
                        const y0 = this.ry(topRow) - this.scrollTop + effHeaderHeight;
                        const h = this.ry(botRow + 1) - this.ry(topRow);
                        this.ctx.fillStyle = tc.band;
                        this.ctx.globalAlpha = 0.45;
                        this.ctx.fillRect(x, y0, this.cw(c), h);
                        this.ctx.globalAlpha = 1.0;
                    }
                }
            }

            // Header row fill
            if (table.has_header_row) {
                const hdrRowH = this.rh(tr.start_row);
                const hdrY = this.ry(tr.start_row) - this.scrollTop + effHeaderHeight;
                const hdrX = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
                const hdrW = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
                this.ctx.fillStyle = tc.header;
                this.ctx.fillRect(hdrX, hdrY, hdrW, hdrRowH);

                // Redraw header text in bold
                this.ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
                this.ctx.fillStyle = tc.headerText;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'middle';
                for (let c = tr.start_col; c <= tr.end_col; c++) {
                    const colCx = this.cx(c) - this.scrollLeft + effHeaderWidth + 4;
                    const colCy = hdrY + hdrRowH / 2;
                    const colDef = table.columns[c - tr.start_col];
                    if (colDef) {
                        this.ctx.fillText(colDef.name, colCx, colCy);
                    }

                    // Filter dropdown icon
                    if (table.filter_enabled) {
                        const iconX = this.cx(c) - this.scrollLeft + effHeaderWidth + this.cw(c) - 14;
                        const iconY = hdrY + hdrRowH / 2 - 3;
                        this.ctx.fillStyle = tc.headerText;
                        this.ctx.beginPath();
                        this.ctx.moveTo(iconX, iconY);
                        this.ctx.lineTo(iconX + 8, iconY);
                        this.ctx.lineTo(iconX + 4, iconY + 6);
                        this.ctx.closePath();
                        this.ctx.fill();
                    }
                }
            }

            // Totals row fill
            if (table.has_totals_row) {
                const totRowH = this.rh(tr.end_row);
                const totY = this.ry(tr.end_row) - this.scrollTop + effHeaderHeight;
                const totX = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
                const totW = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
                this.ctx.fillStyle = tc.band;
                this.ctx.globalAlpha = 0.6;
                this.ctx.fillRect(totX, totY, totW, totRowH);
                this.ctx.globalAlpha = 1.0;

                // Top border on totals row
                this.ctx.strokeStyle = tc.header;
                this.ctx.globalAlpha = 0.7;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(totX, totY);
                this.ctx.lineTo(totX + totW, totY);
                this.ctx.stroke();
                this.ctx.lineWidth = 1;
                this.ctx.globalAlpha = 1.0;
            }

            // Table border
            const tblX = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
            const tblY = this.ry(tr.start_row) - this.scrollTop + effHeaderHeight;
            const tblW = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
            const tblH = this.ry(tr.end_row + 1) - this.ry(tr.start_row);
            this.ctx.strokeStyle = tc.border;
            this.ctx.globalAlpha = 0.7;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(tblX, tblY, tblW, tblH);
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 1.0;

            this.ctx.restore();
        }

        // --- Draw Merged Cells ---
        for (const mc of this.mergedCells) {
            const mcX = this.cx(mc.startCol) - this.scrollLeft + effHeaderWidth;
            const mcY = this.ry(mc.startRow) - this.scrollTop + effHeaderHeight;
            const mcW = this.cx(mc.endCol + 1) - this.cx(mc.startCol);
            const mcH = this.ry(mc.endRow + 1) - this.ry(mc.startRow);

            // Clear the merged area and redraw as single cell
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
            this.ctx.clip();

            // Fill merged cell background
            const cellStyle = this.getCellStyle(mc.startRow, mc.startCol);
            this.ctx.fillStyle = cellStyle?.fillColor || '#ffffff';
            this.ctx.fillRect(mcX, mcY, mcW, mcH);

            // Border
            if (this._showGridlines) {
                this.ctx.strokeStyle = '#e0e0e0';
                this.ctx.strokeRect(mcX, mcY, mcW, mcH);
            }

            // Draw the text from the top-left cell spanning the merged area
            const mcRowData = sheet.cells[mc.startRow];
            if (mcRowData) {
                const mcCellData = mcRowData[mc.startCol];
                if (mcCellData) {
                    const mcValue = mcCellData.value?.startsWith('=')
                        ? (this.formulaResults[`${mc.startRow}:${mc.startCol}`]?.display ?? mcCellData.value)
                        : this.formatCellValue(mcCellData.value, mcCellData.data_type, cellStyle);

                    if (mcValue) {
                        const fontSize = cellStyle?.fontSize || 13;
                        const fontFamily = cellStyle?.fontFamily || 'system-ui, -apple-system, sans-serif';
                        let fontStr = `${fontSize}px ${fontFamily}`;
                        if (cellStyle?.bold) fontStr = `bold ${fontStr}`;
                        if (cellStyle?.italic) fontStr = `italic ${fontStr}`;
                        this.ctx.font = fontStr;
                        this.ctx.fillStyle = cellStyle?.textColor || '#000';
                        this.ctx.textAlign = cellStyle?.alignment || 'left';
                        this.ctx.textBaseline = 'middle';

                        this.ctx.beginPath();
                        this.ctx.rect(mcX + 1, mcY + 1, mcW - 2, mcH - 2);
                        this.ctx.clip();

                        let textX = mcX + 4;
                        if (cellStyle?.alignment === 'center') textX = mcX + mcW / 2;
                        else if (cellStyle?.alignment === 'right') textX = mcX + mcW - 4;
                        const textY = mcY + mcH / 2;
                        this.ctx.fillText(mcValue, textX, textY);
                    }
                }
            }
            this.ctx.restore();
        }

        // --- Draw Find Matches Highlight ---
        if (this._findMatches.length > 0) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
            this.ctx.clip();
            for (let fi = 0; fi < this._findMatches.length; fi++) {
                const fm = this._findMatches[fi];
                const fmX = this.cx(fm.col) - this.scrollLeft + effHeaderWidth;
                const fmY = this.ry(fm.row) - this.scrollTop + effHeaderHeight;
                if (fi === this._findMatchIndex) {
                    this.ctx.fillStyle = 'rgba(255, 165, 0, 0.35)';
                } else {
                    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.25)';
                }
                this.ctx.fillRect(fmX, fmY, this.cw(fm.col), this.rh(fm.row));
            }
            this.ctx.restore();
        }

        // --- Draw Headers (Fixed) ---
        if (this._showHeaders) {
            const selNorm = this.selectionRange ? this.normalizeRange(this.selectionRange) : null;

            // Row Headers (Left)
            this.ctx.fillStyle = '#f3f3f3';
            this.ctx.fillRect(0, this.headerHeight, this.headerWidth, this.height - this.headerHeight);

            this.ctx.strokeStyle = '#cccccc';
            this.ctx.beginPath();
            this.ctx.moveTo(this.headerWidth, 0);
            this.ctx.lineTo(this.headerWidth, this.height);
            this.ctx.stroke();

            this.ctx.font = '12px system-ui, -apple-system, sans-serif';
            for (let r = startRow; r < endRow; r++) {
                const rowH = this.rh(r);
                const y = this.ry(r) - this.scrollTop + this.headerHeight;
                if (y < this.headerHeight) continue;

                // Highlight row header if within selection
                const rowSelected = selNorm && r >= selNorm.startRow && r <= selNorm.endRow;
                if (rowSelected) {
                    this.ctx.fillStyle = '#dce6f1';
                    this.ctx.fillRect(0, y, this.headerWidth, rowH);
                    this.ctx.fillStyle = '#0a5296';
                } else {
                    this.ctx.fillStyle = '#333';
                }

                this.ctx.textAlign = 'center';
                this.ctx.fillText((r + 1).toString(), this.headerWidth / 2, y + rowH / 2);

                this.ctx.strokeStyle = '#cccccc';
                this.ctx.beginPath();
                this.ctx.moveTo(0, y + rowH);
                this.ctx.lineTo(this.headerWidth, y + rowH);
                this.ctx.stroke();
            }

            // Column Headers (Top)
            this.ctx.fillStyle = '#f3f3f3';
            this.ctx.fillRect(this.headerWidth, 0, this.width - this.headerWidth, this.headerHeight);

            this.ctx.strokeStyle = '#cccccc';
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.headerHeight);
            this.ctx.lineTo(this.width, this.headerHeight);
            this.ctx.stroke();

            for (let c = startCol; c < endCol; c++) {
                const colW = this.cw(c);
                const x = this.cx(c) - this.scrollLeft + this.headerWidth;
                if (x < this.headerWidth) continue;

                // Highlight column header if within selection
                const colSelected = selNorm && c >= selNorm.startCol && c <= selNorm.endCol;
                if (colSelected) {
                    this.ctx.fillStyle = '#dce6f1';
                    this.ctx.fillRect(x, 0, colW, this.headerHeight);
                    this.ctx.fillStyle = '#0a5296';
                } else {
                    this.ctx.fillStyle = '#333';
                }

                this.ctx.textAlign = 'center';
                this.ctx.fillText(this.getColName(c), x + colW / 2, this.headerHeight / 2);

                this.ctx.strokeStyle = '#cccccc';
                this.ctx.beginPath();
                this.ctx.moveTo(x + colW, 0);
                this.ctx.lineTo(x + colW, this.headerHeight);
                this.ctx.stroke();
            }

            // Corner Box
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.fillRect(0, 0, this.headerWidth, this.headerHeight);
            this.ctx.strokeStyle = '#cccccc';
            this.ctx.strokeRect(0, 0, this.headerWidth, this.headerHeight);
        }

        // --- Draw Formula Range Highlights (point-mode) ---
        if (this._formulaMode && this._formulaRanges.length > 0) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
            this.ctx.clip();

            for (const fRange of this._formulaRanges) {
                const norm = this.normalizeRange(fRange);
                const frx = this.cx(norm.startCol) - this.scrollLeft + effHeaderWidth;
                const fry = this.ry(norm.startRow) - this.scrollTop + effHeaderHeight;
                const frw = this.cx(norm.endCol + 1) - this.cx(norm.startCol);
                const frh = this.ry(norm.endRow + 1) - this.ry(norm.startRow);

                // Semi-transparent fill
                this.ctx.fillStyle = fRange.color + '20';
                this.ctx.fillRect(frx, fry, frw, frh);

                // Colored dashed border
                this.ctx.strokeStyle = fRange.color;
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 3]);
                this.ctx.strokeRect(frx, fry, frw, frh);
                this.ctx.setLineDash([]);
            }

            this.ctx.restore();
        }

        // --- Draw Selection Range Border ---
        if (this.selectionRange) {
            const norm = this.normalizeRange(this.selectionRange);
            const selX = this.cx(norm.startCol) - this.scrollLeft + effHeaderWidth;
            const selY = this.ry(norm.startRow) - this.scrollTop + effHeaderHeight;
            const selW = this.cx(norm.endCol + 1) - this.cx(norm.startCol);
            const selH = this.ry(norm.endRow + 1) - this.ry(norm.startRow);

            // Clip to the grid area (don't draw over headers)
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
            this.ctx.clip();

            this.ctx.strokeStyle = '#0078d7';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(selX, selY, selW, selH);
            this.ctx.lineWidth = 1;

            // Draw small square handle at bottom-right corner (fill handle like Excel)
            const handleSize = 6;
            const handleX = selX + selW - handleSize / 2;
            const handleY = selY + selH - handleSize / 2;
            this.ctx.fillStyle = '#0078d7';
            this.ctx.fillRect(handleX, handleY, handleSize, handleSize);

            this.ctx.restore();
        }

        // --- Draw Freeze Panes ---
        // Re-draw frozen rows (top) and frozen cols (left) on top of everything so they stay visible
        if (this._freezeRow > 0 || this._freezeCol > 0) {
            // Frozen rows: redraw rows 0..freezeRow at fixed Y position (not scrolled)
            if (this._freezeRow > 0) {
                const frozenRowsH = this.ry(this._freezeRow);
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, frozenRowsH);
                this.ctx.clip();

                // Fill white background for frozen area
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, frozenRowsH);

                for (let r = 0; r < this._freezeRow; r++) {
                    const frzRowH = this.rh(r);
                    const y = this.ry(r) + effHeaderHeight;
                    for (let c = startCol; c < endCol; c++) {
                        const frzColW = this.cw(c);
                        const x = this.cx(c) - this.scrollLeft + effHeaderWidth;
                        if (this._showGridlines) {
                            this.ctx.strokeStyle = '#e0e0e0';
                            this.ctx.lineWidth = 1;
                            this.ctx.strokeRect(x, y, frzColW, frzRowH);
                        }
                        const rowData = sheet.cells[r];
                        if (rowData) {
                            const cellData = rowData[c];
                            if (cellData) {
                                const cv = cellData.value?.startsWith('=')
                                    ? (this.formulaResults[`${r}:${c}`]?.display ?? cellData.value)
                                    : cellData.value;
                                if (cv) {
                                    this.ctx.font = '13px system-ui, -apple-system, sans-serif';
                                    this.ctx.fillStyle = '#000';
                                    this.ctx.textAlign = 'left';
                                    this.ctx.textBaseline = 'middle';
                                    this.ctx.fillText(cv, x + 4, y + frzRowH / 2);
                                }
                            }
                        }
                    }
                }
                this.ctx.restore();
            }

            // Frozen columns: redraw cols 0..freezeCol at fixed X position
            if (this._freezeCol > 0) {
                const frozenColsW = this.cx(this._freezeCol);
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(effHeaderWidth, effHeaderHeight, frozenColsW, this.height - effHeaderHeight);
                this.ctx.clip();

                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(effHeaderWidth, effHeaderHeight, frozenColsW, this.height - effHeaderHeight);

                for (let r = startRow; r < endRow; r++) {
                    const frzRH = this.rh(r);
                    const y = this.ry(r) - this.scrollTop + effHeaderHeight;
                    for (let c = 0; c < this._freezeCol; c++) {
                        const frzCW = this.cw(c);
                        const x = this.cx(c) + effHeaderWidth;
                        if (this._showGridlines) {
                            this.ctx.strokeStyle = '#e0e0e0';
                            this.ctx.lineWidth = 1;
                            this.ctx.strokeRect(x, y, frzCW, frzRH);
                        }
                        const rowData = sheet.cells[r];
                        if (rowData) {
                            const cellData = rowData[c];
                            if (cellData) {
                                const cv = cellData.value?.startsWith('=')
                                    ? (this.formulaResults[`${r}:${c}`]?.display ?? cellData.value)
                                    : cellData.value;
                                if (cv) {
                                    this.ctx.font = '13px system-ui, -apple-system, sans-serif';
                                    this.ctx.fillStyle = '#000';
                                    this.ctx.textAlign = 'left';
                                    this.ctx.textBaseline = 'middle';
                                    this.ctx.fillText(cv, x + 4, y + frzRH / 2);
                                }
                            }
                        }
                    }
                }
                this.ctx.restore();
            }

            // Frozen corner (both row and col frozen): redraw that corner
            if (this._freezeRow > 0 && this._freezeCol > 0) {
                const cornerW = this.cx(this._freezeCol);
                const cornerH = this.ry(this._freezeRow);
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(effHeaderWidth, effHeaderHeight, cornerW, cornerH);
                this.ctx.clip();

                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(effHeaderWidth, effHeaderHeight, cornerW, cornerH);

                for (let r = 0; r < this._freezeRow; r++) {
                    const crnRH = this.rh(r);
                    const y = this.ry(r) + effHeaderHeight;
                    for (let c = 0; c < this._freezeCol; c++) {
                        const crnCW = this.cw(c);
                        const x = this.cx(c) + effHeaderWidth;
                        if (this._showGridlines) {
                            this.ctx.strokeStyle = '#e0e0e0';
                            this.ctx.lineWidth = 1;
                            this.ctx.strokeRect(x, y, crnCW, crnRH);
                        }
                        const rowData = sheet.cells[r];
                        if (rowData) {
                            const cellData = rowData[c];
                            if (cellData) {
                                const cv = cellData.value ?? '';
                                if (cv) {
                                    this.ctx.font = '13px system-ui, -apple-system, sans-serif';
                                    this.ctx.fillStyle = '#000';
                                    this.ctx.textAlign = 'left';
                                    this.ctx.textBaseline = 'middle';
                                    this.ctx.fillText(cv, x + 4, y + crnRH / 2);
                                }
                            }
                        }
                    }
                }
                this.ctx.restore();
            }

            // Draw freeze pane separator lines
            if (this._freezeRow > 0) {
                const freezeY = this.ry(this._freezeRow) + effHeaderHeight;
                this.ctx.strokeStyle = '#0078d7';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(0, freezeY);
                this.ctx.lineTo(this.width, freezeY);
                this.ctx.stroke();
                this.ctx.lineWidth = 1;
            }
            if (this._freezeCol > 0) {
                const freezeX = this.cx(this._freezeCol) + effHeaderWidth;
                this.ctx.strokeStyle = '#0078d7';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(freezeX, 0);
                this.ctx.lineTo(freezeX, this.height);
                this.ctx.stroke();
                this.ctx.lineWidth = 1;
            }
        }

        // --- Draw Scrollbars ---
        this.drawScrollbars();

        this.ctx.restore();
    }

    private drawScrollbars() {
        const sb = this._scrollbarSize;
        const minThumb = this._scrollbarMinThumb;
        const virtualH = this.getVirtualHeight();
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
        const viewH = this.height - effHeaderHeight;

        // --- Vertical scrollbar (canvas-drawn) ---
        const vTrackTop = effHeaderHeight;
        const vTrackHeight = viewH;
        // Track background
        this.ctx.fillStyle = '#e8e8e8';
        this.ctx.fillRect(this.width - sb, vTrackTop, sb, vTrackHeight);
        // Track left border
        this.ctx.strokeStyle = '#ccc';
        this.ctx.beginPath();
        this.ctx.moveTo(this.width - sb, vTrackTop);
        this.ctx.lineTo(this.width - sb, vTrackTop + vTrackHeight);
        this.ctx.stroke();
        // Thumb
        const vRatio = Math.min(1, viewH / virtualH);
        const vThumbH = Math.max(minThumb, vTrackHeight * vRatio);
        const vMaxScroll = virtualH - viewH;
        const vThumbTop = vMaxScroll > 0
            ? vTrackTop + (this.scrollTop / vMaxScroll) * (vTrackHeight - vThumbH)
            : vTrackTop;
        this.ctx.fillStyle = this._scrollbarDragging === 'v' ? '#666' : '#999';
        this.ctx.beginPath();
        this.roundRect(this.width - sb + 2, vThumbTop + 1, sb - 4, vThumbH - 2, 4);
        this.ctx.fill();
    }

    /** Draw a rounded rectangle path */
    private roundRect(x: number, y: number, w: number, h: number, r: number) {
        r = Math.min(r, w / 2, h / 2);
        this.ctx.moveTo(x + r, y);
        this.ctx.arcTo(x + w, y, x + w, y + h, r);
        this.ctx.arcTo(x + w, y + h, x, y + h, r);
        this.ctx.arcTo(x, y + h, x, y, r);
        this.ctx.arcTo(x, y, x + w, y, r);
        this.ctx.closePath();
    }

    // --- Number Formatting ---

    private formatCellValue(value: string, dataType: string, style?: CellStyle): string {
        if (!style?.numberFormat || style.numberFormat === 'General' || style.numberFormat === '@') {
            return value;
        }

        const num = Number(value);
        if (isNaN(num) || dataType !== 'n') return value;

        const fmt = style.numberFormat;

        // Named formats (from ribbon/overlay)
        switch (fmt) {
            case 'Number': return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case 'Currency': return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            case 'Percentage': return (num * 100).toFixed(2) + '%';
            case 'Text': return value;
            case 'Date': {
                const epoch = new Date(1899, 11, 30);
                const date = new Date(epoch.getTime() + num * 86400000);
                return date.toLocaleDateString();
            }
        }

        // Excel format patterns (from model)
        // Percentage patterns
        if (fmt.includes('%')) {
            const decMatch = fmt.match(/0\.(0+)%/);
            const decimals = decMatch ? decMatch[1].length : 0;
            return (num * 100).toFixed(decimals) + '%';
        }

        // Date patterns
        if (fmt.match(/[mdy]/i) && !fmt.includes('#') && !fmt.includes('0')) {
            const epoch = new Date(1899, 11, 30);
            const date = new Date(epoch.getTime() + num * 86400000);
            return date.toLocaleDateString();
        }

        // Currency patterns ($, €, £)
        if (fmt.includes('$') || fmt.includes('€') || fmt.includes('£')) {
            const decMatch = fmt.match(/0\.(0+)/);
            const decimals = decMatch ? decMatch[1].length : 2;
            const symbol = fmt.includes('€') ? '€' : fmt.includes('£') ? '£' : '$';
            return symbol + num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }

        // Comma-separated number patterns (#,##0)
        if (fmt.includes('#,##0') || fmt.includes(',')) {
            const decMatch = fmt.match(/0\.(0+)/);
            const decimals = decMatch ? decMatch[1].length : 0;
            return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }

        // Fixed decimal (0.00)
        if (fmt.match(/^0\.(0+)$/)) {
            const decimals = fmt.split('.')[1].length;
            return num.toFixed(decimals);
        }

        // Scientific notation
        if (fmt.includes('E+') || fmt.includes('E-')) {
            return num.toExponential(2);
        }

        return value;
    }

    // --- Inline Cell Editing ---

    private handleDoubleClick(e: MouseEvent) {
        // Don't open inline editor during formula point-mode; clicks should
        // insert/replace cell references, not start editing the target cell.
        if (this._formulaMode) return;

        const { x, y } = this.mouseToCanvas(e);

        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;

        if (x > effHeaderWidth && y > effHeaderHeight) {
            const gridX = x - effHeaderWidth + this.scrollLeft;
            const gridY = y - effHeaderHeight + this.scrollTop;
            this.ensureLayout();
            let col = 0;
            while (col < this._colPos.length - 2 && this._colPos[col + 1] <= gridX) col++;
            let row = 0;
            while (row < this._rowPos.length - 2 && this._rowPos[row + 1] <= gridY) row++;
            this.startCellEdit(row, col);
        }
    }

    /**
     * Start inline editing on a cell.
     * @param initialChar If provided, replaces the cell content with this character (type-to-edit).
     *                    If omitted, edits the existing cell value (double-click / Enter / F2).
     */
    startCellEdit(row: number, col: number, initialChar?: string) {
        this.commitCellEdit();

        // When typing a character, start fresh; otherwise edit existing value
        let currentValue = '';
        if (!initialChar && this.data?.sheets?.[this._activeSheetIndex]?.cells?.[row]?.[col]) {
            currentValue = this.data.sheets[this._activeSheetIndex].cells[row][col].value;
        }

        if (!this.editInput) {
            this.editInput = document.createElement('input');
            this.editInput.style.position = 'absolute';
            this.editInput.style.outline = 'none';
            this.editInput.style.padding = '0 4px';
            this.editInput.style.boxSizing = 'border-box';
            this.editInput.style.zIndex = '10';
            // Use VSCode theme variables for the edit input
            this.editInput.style.border = '2px solid var(--vscode-focusBorder, #007acc)';
            this.editInput.style.background = 'var(--vscode-input-background, #3c3c3c)';
            this.editInput.style.color = 'var(--vscode-input-foreground, #ccc)';
            this.editInput.style.font = '13px var(--vscode-font-family, system-ui, -apple-system, sans-serif)';
            this.editInput.style.borderRadius = '1px';
            this.canvas.parentElement?.appendChild(this.editInput);

            this.editInput.addEventListener('keydown', (e) => {
                // Stop propagation so the canvas and global handlers don't see these keys
                e.stopPropagation();

                if (e.key === 'Enter') {
                    this.commitCellEdit();
                } else if (e.key === 'Escape') {
                    this.cancelCellEdit();
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    const cell = this.editingCell;
                    this.commitCellEdit();
                    if (cell) {
                        const nextCol = e.shiftKey ? Math.max(0, cell.col - 1) : cell.col + 1;
                        this.startCellEdit(cell.row, nextCol);
                    }
                }
            });

            this.editInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (this.editingCell) {
                        this.commitCellEdit();
                    }
                }, 100);
            });

            // Notify main.ts when inline editor content changes (for formula mode)
            this.editInput.addEventListener('input', () => {
                if (this.onInlineEditInput && this.editInput) {
                    this.onInlineEditInput(this.editInput.value);
                }
                // Also sync value to formula bar
                const formulaInputEl = document.getElementById('formula-input') as HTMLInputElement | null;
                if (formulaInputEl && this.editInput) {
                    formulaInputEl.value = this.editInput.value;
                }
            });
        }

        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
        const cellX = this.cx(col) - this.scrollLeft + effHeaderWidth;
        const cellY = this.ry(row) - this.scrollTop + effHeaderHeight;

        this.editInput.style.left = `${cellX}px`;
        this.editInput.style.top = `${cellY}px`;
        this.editInput.style.width = `${this.cw(col)}px`;
        this.editInput.style.height = `${this.rh(row)}px`;
        this.editInput.style.display = 'block';

        if (initialChar) {
            // Type-to-edit: start with the typed character, cursor at end
            this.editInput.value = initialChar;
            this.editInput.focus();
            this.editInput.setSelectionRange(initialChar.length, initialChar.length);
        } else {
            // Edit existing value: select all so user can overwrite or press End to append
            this.editInput.value = currentValue;
            this.editInput.focus();
            this.editInput.select();
        }

        this.editingCell = { row, col };

        // Notify main.ts so it can enter formula mode if editing a formula cell
        const finalValue = this.editInput.value;
        if (this.onInlineEditInput) {
            this.onInlineEditInput(finalValue);
        }
        // Sync to formula bar
        const formulaInputEl = document.getElementById('formula-input') as HTMLInputElement | null;
        if (formulaInputEl) {
            formulaInputEl.value = finalValue;
        }
    }

    private commitCellEdit() {
        if (!this.editInput || !this.editingCell) return;

        const { row, col } = this.editingCell;
        const newValue = this.editInput.value;
        // Formulas should be stored as string type
        const dataType = newValue.startsWith('=') ? 's' : (newValue.trim() !== '' && !isNaN(Number(newValue)) ? 'n' : 's');

        this.updateCell(row, col, newValue, dataType);

        if (this.onCellEdit) {
            this.onCellEdit(row, col, newValue);
        }

        if (this.onInlineEditCommit) {
            this.onInlineEditCommit();
        }

        this.editInput.style.display = 'none';
        this.editingCell = null;
        this.canvas.focus();
    }

    private cancelCellEdit() {
        if (!this.editInput) return;

        if (this.onInlineEditCancel) {
            this.onInlineEditCancel();
        }

        this.editInput.style.display = 'none';
        this.editingCell = null;
        this.canvas.focus();
    }

    /** Get the cell currently being edited inline, or null */
    getEditingCell(): { row: number; col: number } | null {
        return this.editingCell;
    }

    /** Get the current inline editor value */
    getEditInputValue(): string {
        return this.editInput?.value ?? '';
    }

    /** Set the inline editor value (e.g., during point-mode reference insertion) */
    setEditInputValue(value: string, cursorPos?: number) {
        if (this.editInput) {
            this.editInput.value = value;
            if (cursorPos !== undefined) {
                this.editInput.setSelectionRange(cursorPos, cursorPos);
            }
        }
    }

    /** Get the inline editor cursor position */
    getEditInputCursor(): number {
        return this.editInput?.selectionStart ?? 0;
    }

    // --- Helpers ---

    private getCellStyle(row: number, col: number): CellStyle | undefined {
        const overlay = this.styles[row]?.[col];
        // Also check model styles
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        const modelStyle = sheet?.cells?.[row]?.[col]?.style;
        if (!modelStyle && !overlay) return overlay;
        // Merge: overlay takes priority over model style
        const merged: CellStyle = {};
        if (modelStyle) {
            if (modelStyle.bold) merged.bold = true;
            if (modelStyle.italic) merged.italic = true;
            if (modelStyle.underline) merged.underline = true;
            if (modelStyle.font_size) merged.fontSize = modelStyle.font_size;
            if (modelStyle.font_family) merged.fontFamily = modelStyle.font_family;
            if (modelStyle.text_color) merged.textColor = modelStyle.text_color;
            if (modelStyle.fill_color) merged.fillColor = modelStyle.fill_color;
            if (modelStyle.alignment) merged.alignment = modelStyle.alignment as CellStyle['alignment'];
            if (modelStyle.number_format) merged.numberFormat = modelStyle.number_format;
            if (modelStyle.wrap_text) merged.wrapText = true;
        }
        if (overlay) {
            if (overlay.bold !== undefined) merged.bold = overlay.bold;
            if (overlay.italic !== undefined) merged.italic = overlay.italic;
            if (overlay.underline !== undefined) merged.underline = overlay.underline;
            if (overlay.fontSize !== undefined) merged.fontSize = overlay.fontSize;
            if (overlay.fontFamily !== undefined) merged.fontFamily = overlay.fontFamily;
            if (overlay.textColor !== undefined) merged.textColor = overlay.textColor;
            if (overlay.fillColor !== undefined) merged.fillColor = overlay.fillColor;
            if (overlay.alignment !== undefined) merged.alignment = overlay.alignment;
            if (overlay.numberFormat !== undefined) merged.numberFormat = overlay.numberFormat;
            if (overlay.wrapText !== undefined) merged.wrapText = overlay.wrapText;
        }
        return merged;
    }

    private normalizeRange(range: SelectionRange): SelectionRange {
        return {
            startRow: Math.min(range.startRow, range.endRow),
            startCol: Math.min(range.startCol, range.endCol),
            endRow: Math.max(range.startRow, range.endRow),
            endCol: Math.max(range.startCol, range.endCol)
        };
    }

    private getColName(n: number): string {
        let s = '';
        let idx = n;
        while (idx >= 0) {
            s = String.fromCharCode((idx % 26) + 65) + s;
            idx = Math.floor(idx / 26) - 1;
        }
        return s;
    }

    /** Total virtual content width in pixels (drives horizontal scrollbar) */
    private getVirtualWidth(): number {
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        let maxDataCol = 0;
        if (sheet?.cells) {
            for (const rowKey of Object.keys(sheet.cells)) {
                for (const colKey of Object.keys(sheet.cells[Number(rowKey)])) {
                    maxDataCol = Math.max(maxDataCol, Number(colKey));
                }
            }
        }
        // At least 100 columns, or extend 10 past the furthest data column
        const totalCols = Math.max(100, maxDataCol + 10);
        this.ensureLayout(totalCols);
        return this.cx(totalCols);
    }

    /** Total virtual content height in pixels (drives vertical scrollbar) */
    private getVirtualHeight(): number {
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        let maxDataRow = 0;
        if (sheet?.cells) {
            for (const rowKey of Object.keys(sheet.cells)) {
                maxDataRow = Math.max(maxDataRow, Number(rowKey));
            }
        }
        const totalRows = Math.max(1000, maxDataRow + 50);
        this.ensureLayout(undefined, totalRows);
        return this.ry(totalRows);
    }

    // --- Column/Row Dimensions ---

    getColWidth(col: number): number {
        return this.colWidths[col] ?? this.colWidth;
    }

    getRowHeight(row: number): number {
        return this.rowHeights[row] ?? this.rowHeight;
    }

    setColWidth(col: number, width: number) {
        this.colWidths[col] = Math.max(20, Math.round(width));
        this._layoutDirty = true;
        this.render();
    }

    setRowHeight(row: number, height: number) {
        this.rowHeights[row] = Math.max(10, Math.round(height));
        this._layoutDirty = true;
        this.render();
    }

    /** Get the X pixel offset for a column, accounting for variable widths */
    getColX(col: number): number {
        let x = 0;
        for (let c = 0; c < col; c++) {
            x += this.colWidths[c] ?? this.colWidth;
        }
        return x;
    }

    /** Get the Y pixel offset for a row, accounting for variable heights */
    getRowY(row: number): number {
        let y = 0;
        for (let r = 0; r < row; r++) {
            y += this.rowHeights[r] ?? this.rowHeight;
        }
        return y;
    }

    // --- Merged Cells ---

    getMergedCells(): { startRow: number; startCol: number; endRow: number; endCol: number }[] {
        return this.mergedCells;
    }

    /** Check if a cell is part of a merged region. Returns the merge region or null. */
    getMergeAtCell(row: number, col: number): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
        for (const m of this.mergedCells) {
            if (row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol) {
                return m;
            }
        }
        return null;
    }

    /** Add a merge region for the current selection */
    mergeCellsSelection(): void {
        if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();
        const norm = this.normalizeRange(this.selectionRange);
        // Check if already merged at this exact range
        const existing = this.mergedCells.findIndex(m =>
            m.startRow === norm.startRow && m.startCol === norm.startCol &&
            m.endRow === norm.endRow && m.endCol === norm.endCol
        );
        if (existing >= 0) {
            // Unmerge
            this.mergedCells.splice(existing, 1);
        } else {
            // Remove any overlapping merges
            this.mergedCells = this.mergedCells.filter(m =>
                m.endRow < norm.startRow || m.startRow > norm.endRow ||
                m.endCol < norm.startCol || m.startCol > norm.endCol
            );
            this.mergedCells.push({
                startRow: norm.startRow, startCol: norm.startCol,
                endRow: norm.endRow, endCol: norm.endCol
            });
        }
        // Sync to model
        const sheet = this.data.sheets[this._activeSheetIndex];
        sheet.merged_cells = this.mergedCells.map(m => ({
            start_row: m.startRow, start_col: m.startCol,
            end_row: m.endRow, end_col: m.endCol,
        }));
        this.render();
    }

    // --- Find ---

    findInSheet(query: string, caseSensitive: boolean = false): number {
        this._findMatches = [];
        this._findMatchIndex = -1;
        if (!query || !this.data?.sheets?.[this._activeSheetIndex]) return 0;

        const sheet = this.data.sheets[this._activeSheetIndex];
        const q = caseSensitive ? query : query.toLowerCase();

        for (const rowKey of Object.keys(sheet.cells)) {
            const r = parseInt(rowKey, 10);
            const row = sheet.cells[rowKey];
            for (const colKey of Object.keys(row)) {
                const c = parseInt(colKey, 10);
                const val = row[colKey]?.value ?? '';
                const test = caseSensitive ? val : val.toLowerCase();
                if (test.includes(q)) {
                    this._findMatches.push({ row: r, col: c });
                }
            }
        }

        // Sort matches by row then col
        this._findMatches.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

        if (this._findMatches.length > 0) {
            this._findMatchIndex = 0;
            this.selectedCell = { ...this._findMatches[0] };
            this.selectionRange = { startRow: this._findMatches[0].row, startCol: this._findMatches[0].col, endRow: this._findMatches[0].row, endCol: this._findMatches[0].col };
            this.scrollIntoView(this._findMatches[0].row, this._findMatches[0].col);
        }
        this.render();
        return this._findMatches.length;
    }

    findNext(): number {
        if (this._findMatches.length === 0) return -1;
        this._findMatchIndex = (this._findMatchIndex + 1) % this._findMatches.length;
        const m = this._findMatches[this._findMatchIndex];
        this.selectedCell = { ...m };
        this.selectionRange = { startRow: m.row, startCol: m.col, endRow: m.row, endCol: m.col };
        this.scrollIntoView(m.row, m.col);
        this.render();
        return this._findMatchIndex;
    }

    findPrev(): number {
        if (this._findMatches.length === 0) return -1;
        this._findMatchIndex = (this._findMatchIndex - 1 + this._findMatches.length) % this._findMatches.length;
        const m = this._findMatches[this._findMatchIndex];
        this.selectedCell = { ...m };
        this.selectionRange = { startRow: m.row, startCol: m.col, endRow: m.row, endCol: m.col };
        this.scrollIntoView(m.row, m.col);
        this.render();
        return this._findMatchIndex;
    }

    clearFind() {
        this._findMatches = [];
        this._findMatchIndex = -1;
        this.render();
    }

    getFindMatchCount(): number { return this._findMatches.length; }
    getFindMatchIndex(): number { return this._findMatchIndex; }

    replaceCurrentMatch(replacement: string): boolean {
        if (this._findMatchIndex < 0 || this._findMatchIndex >= this._findMatches.length) return false;
        const m = this._findMatches[this._findMatchIndex];
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        if (!sheet?.cells?.[m.row]?.[m.col]) return false;

        this.pushUndo();
        const cell = sheet.cells[m.row][m.col];
        cell.value = replacement;
        cell.data_type = replacement.trim() !== '' && !isNaN(Number(replacement)) ? 'n' : 's';
        this._findMatches.splice(this._findMatchIndex, 1);
        if (this._findMatchIndex >= this._findMatches.length) this._findMatchIndex = 0;
        this.render();
        return true;
    }

    replaceAll(query: string, replacement: string, caseSensitive: boolean = false): number {
        if (!query || !this.data?.sheets?.[this._activeSheetIndex]) return 0;
        this.pushUndo();

        const sheet = this.data.sheets[this._activeSheetIndex];
        let count = 0;

        for (const rowKey of Object.keys(sheet.cells)) {
            const row = sheet.cells[rowKey];
            for (const colKey of Object.keys(row)) {
                const cell = row[colKey];
                if (!cell?.value) continue;
                const q = caseSensitive ? query : query.toLowerCase();
                const test = caseSensitive ? cell.value : cell.value.toLowerCase();
                if (test.includes(q)) {
                    // Replace all occurrences in the cell value
                    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
                    cell.value = cell.value.replace(regex, replacement);
                    cell.data_type = cell.value.trim() !== '' && !isNaN(Number(cell.value)) ? 'n' : 's';
                    count++;
                }
            }
        }

        this._findMatches = [];
        this._findMatchIndex = -1;
        this.render();
        return count;
    }
}
