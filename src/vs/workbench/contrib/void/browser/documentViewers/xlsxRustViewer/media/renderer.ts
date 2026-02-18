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
    // --- Light styles (1-21): 3 groups of 7 accent colors, increasingly visible banding ---
    // Group 1 (1-7): very subtle banding
    'TableStyleLight1':   { header: '#000000', band: '#f7f7f7', border: '#999999', headerText: '#fff' },
    'TableStyleLight2':   { header: '#4472c4', band: '#edf2fa', border: '#4472c4', headerText: '#fff' },
    'TableStyleLight3':   { header: '#ed7d31', band: '#fef4eb', border: '#ed7d31', headerText: '#fff' },
    'TableStyleLight4':   { header: '#a5a5a5', band: '#f5f5f5', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleLight5':   { header: '#ffc000', band: '#fffbef', border: '#ffc000', headerText: '#333' },
    'TableStyleLight6':   { header: '#5b9bd5', band: '#eef4fa', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleLight7':   { header: '#70ad47', band: '#f0f7ec', border: '#70ad47', headerText: '#fff' },
    // Group 2 (8-14): moderate banding
    'TableStyleLight8':   { header: '#000000', band: '#f2f2f2', border: '#000000', headerText: '#fff' },
    'TableStyleLight9':   { header: '#4472c4', band: '#dbe5f5', border: '#4472c4', headerText: '#fff' },
    'TableStyleLight10':  { header: '#ed7d31', band: '#fce4cc', border: '#ed7d31', headerText: '#fff' },
    'TableStyleLight11':  { header: '#a5a5a5', band: '#ececec', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleLight12':  { header: '#ffc000', band: '#fff5d5', border: '#ffc000', headerText: '#333' },
    'TableStyleLight13':  { header: '#5b9bd5', band: '#dde9f5', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleLight14':  { header: '#70ad47', band: '#e2efda', border: '#70ad47', headerText: '#fff' },
    // Group 3 (15-21): stronger banding
    'TableStyleLight15':  { header: '#000000', band: '#e8e8e8', border: '#000000', headerText: '#fff' },
    'TableStyleLight16':  { header: '#4472c4', band: '#c9d8f0', border: '#4472c4', headerText: '#fff' },
    'TableStyleLight17':  { header: '#ed7d31', band: '#f9d5ad', border: '#ed7d31', headerText: '#fff' },
    'TableStyleLight18':  { header: '#a5a5a5', band: '#e0e0e0', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleLight19':  { header: '#ffc000', band: '#ffefb8', border: '#ffc000', headerText: '#333' },
    'TableStyleLight20':  { header: '#5b9bd5', band: '#ccddf0', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleLight21':  { header: '#70ad47', band: '#d4e7c8', border: '#70ad47', headerText: '#fff' },
    // --- Medium styles (1-28): 4 groups of 7 accent colors ---
    // Group 1 (1-7): filled header + banded rows
    'TableStyleMedium1':  { header: '#000000', band: '#e0e0e0', border: '#000000', headerText: '#fff' },
    'TableStyleMedium2':  { header: '#4472c4', band: '#d6e4f0', border: '#4472c4', headerText: '#fff' },
    'TableStyleMedium3':  { header: '#ed7d31', band: '#fce4cc', border: '#ed7d31', headerText: '#fff' },
    'TableStyleMedium4':  { header: '#a5a5a5', band: '#dcdcdc', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleMedium5':  { header: '#ffc000', band: '#fff2cc', border: '#ffc000', headerText: '#333' },
    'TableStyleMedium6':  { header: '#5b9bd5', band: '#dce6f0', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleMedium7':  { header: '#70ad47', band: '#e2efda', border: '#70ad47', headerText: '#fff' },
    // Group 2 (8-14): filled header + borders + stronger banding
    'TableStyleMedium8':  { header: '#000000', band: '#d0d0d0', border: '#000000', headerText: '#fff' },
    'TableStyleMedium9':  { header: '#4472c4', band: '#b8cde5', border: '#4472c4', headerText: '#fff' },
    'TableStyleMedium10': { header: '#ed7d31', band: '#f9c99a', border: '#ed7d31', headerText: '#fff' },
    'TableStyleMedium11': { header: '#a5a5a5', band: '#cccccc', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleMedium12': { header: '#ffc000', band: '#ffe599', border: '#ffc000', headerText: '#333' },
    'TableStyleMedium13': { header: '#5b9bd5', band: '#bdd0e5', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleMedium14': { header: '#70ad47', band: '#c5dfb5', border: '#70ad47', headerText: '#fff' },
    // Group 3 (15-21): filled header + cell borders + deep banding
    'TableStyleMedium15': { header: '#000000', band: '#c0c0c0', border: '#000000', headerText: '#fff' },
    'TableStyleMedium16': { header: '#4472c4', band: '#9ab6da', border: '#4472c4', headerText: '#fff' },
    'TableStyleMedium17': { header: '#ed7d31', band: '#f6ae68', border: '#ed7d31', headerText: '#fff' },
    'TableStyleMedium18': { header: '#a5a5a5', band: '#bcbcbc', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleMedium19': { header: '#ffc000', band: '#ffd966', border: '#ffc000', headerText: '#333' },
    'TableStyleMedium20': { header: '#5b9bd5', band: '#9dbada', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleMedium21': { header: '#70ad47', band: '#a8cf90', border: '#70ad47', headerText: '#fff' },
    // Group 4 (22-28): outside border + row borders
    'TableStyleMedium22': { header: '#000000', band: '#b0b0b0', border: '#000000', headerText: '#fff' },
    'TableStyleMedium23': { header: '#4472c4', band: '#7ca0cf', border: '#4472c4', headerText: '#fff' },
    'TableStyleMedium24': { header: '#ed7d31', band: '#f39336', border: '#ed7d31', headerText: '#fff' },
    'TableStyleMedium25': { header: '#a5a5a5', band: '#aaaaaa', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleMedium26': { header: '#ffc000', band: '#ffcc33', border: '#ffc000', headerText: '#333' },
    'TableStyleMedium27': { header: '#5b9bd5', band: '#7ea4cf', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleMedium28': { header: '#70ad47', band: '#8bbf6b', border: '#70ad47', headerText: '#fff' },
    // --- Dark styles (1-11): dark bands with filled headers ---
    'TableStyleDark1':    { header: '#000000', band: '#404040', border: '#000000', headerText: '#fff' },
    'TableStyleDark2':    { header: '#4472c4', band: '#2b4a7a', border: '#4472c4', headerText: '#fff' },
    'TableStyleDark3':    { header: '#ed7d31', band: '#7a4018', border: '#ed7d31', headerText: '#fff' },
    'TableStyleDark4':    { header: '#a5a5a5', band: '#5a5a5a', border: '#a5a5a5', headerText: '#fff' },
    'TableStyleDark5':    { header: '#ffc000', band: '#8a6800', border: '#ffc000', headerText: '#fff' },
    'TableStyleDark6':    { header: '#5b9bd5', band: '#2f5e8a', border: '#5b9bd5', headerText: '#fff' },
    'TableStyleDark7':    { header: '#70ad47', band: '#3a5925', border: '#70ad47', headerText: '#fff' },
    'TableStyleDark8':    { header: '#1a1a1a', band: '#333333', border: '#1a1a1a', headerText: '#fff' },
    'TableStyleDark9':    { header: '#264478', band: '#1a3060', border: '#264478', headerText: '#fff' },
    'TableStyleDark10':   { header: '#c55a11', band: '#6b3510', border: '#c55a11', headerText: '#fff' },
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
    private _wrapper: HTMLDivElement;
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

    // Filter state: hidden rows (rows excluded by column filters)
    private _hiddenRows: Set<number> = new Set();
    // Active filters: key = "tableName:colIndex", value = set of allowed cell values
    private _activeFilters: Map<string, Set<string>> = new Map();
    // HTML filter arrow buttons overlaid on table header cells
    private _filterButtons: HTMLButtonElement[] = [];

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
    public onFilterArrowClick?: (tableName: string, colIndex: number, colName: string, screenX: number, screenY: number) => void;

    // HTML scrollbar elements
    private _hScrollbar: HTMLDivElement;
    private _hScrollThumb: HTMLDivElement;
    private _hScrollDragging = false;
    private _hScrollDragStartX = 0;
    private _hScrollDragStartScroll = 0;

    constructor(container: HTMLElement) {
        // Wrap canvas and horizontal scrollbar in a flex layout
        this._wrapper = document.createElement('div');
        this._wrapper.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;position:relative;';
        container.appendChild(this._wrapper);

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;outline:none;flex:1;min-height:0;';
        this._wrapper.appendChild(this.canvas);

        // Create horizontal scrollbar
        this._hScrollbar = document.createElement('div');
        this._hScrollbar.style.cssText = 'height:14px;flex-shrink:0;background:#e8e8e8;border-top:1px solid #ccc;position:relative;cursor:default;';
        this._wrapper.appendChild(this._hScrollbar);

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
        // Use ResizeObserver for reliable container tracking — window.resize
        // does NOT fire inside webview iframes when VSCode resizes panels.
        const ro = new ResizeObserver(() => this.resize());
        ro.observe(this._wrapper);
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
        this._hiddenRows.clear();
        this._activeFilters.clear();
        this._clearFilterButtons();
        this._clearCfCache();
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

    // --- Chart coordinate helpers (public wrappers for ChartManager) ---
    publicCx(colIdx: number): number { return this.cx(colIdx); }
    publicRy(rowIdx: number): number { return this.ry(rowIdx); }
    publicCw(colIdx: number): number { return this.cw(colIdx); }
    publicRh(rowIdx: number): number { return this.rh(rowIdx); }
    publicScrollLeft(): number { return this.scrollLeft; }
    publicScrollTop(): number { return this.scrollTop; }
    publicHeaderWidth(): number { return this._showHeaders ? this.headerWidth : 0; }
    publicHeaderHeight(): number { return this._showHeaders ? this.headerHeight : 0; }
    /** Get the wrapper div that contains the canvas and overlays */
    getWrapper(): HTMLDivElement { return this._wrapper; }

    /** Callback when scroll position changes (for chart overlay repositioning) */
    onScrollChanged?: () => void;

    setActiveSheetIndex(idx: number) {
        if (!this.data?.sheets?.[idx]) return;
        this._activeSheetIndex = idx;
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.selectedCell = null;
        this.selectionRange = null;
        this.formulaResults = {};
        this._hiddenRows.clear();
        this._activeFilters.clear();
        this._clearFilterButtons();
        this._clearCfCache();
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
            const h = this._hiddenRows.has(r) ? 0 : (this.rowHeights[r] ?? this.rowHeight);
            this._rowPos[r + 1] = this._rowPos[r] + h;
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

    /**
     * Create / reposition / remove real HTML buttons over each table header filter arrow.
     * Called at the end of every render() so buttons track scrolling and layout changes.
     */
    private _syncFilterButtons(): void {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;

        const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;

        let btnIdx = 0;

        for (const table of this.tables) {
            if (!table.filter_enabled || !table.has_header_row) continue;
            const tr = table.range;
            const hdrRowH = this.rh(tr.start_row);
            const hdrY = this.ry(tr.start_row) - this.scrollTop + effHeaderHeight;

            for (let c = tr.start_col; c <= tr.end_col; c++) {
                const cellRight = this.cx(c) - this.scrollLeft + effHeaderWidth + this.cw(c);
                const btnLeft = cellRight - 18;
                const btnTop = hdrY;

                // Visibility: hide buttons that are scrolled off-screen or behind headers
                const visible = btnLeft > effHeaderWidth - 10
                    && btnTop >= effHeaderHeight - 2
                    && btnTop + hdrRowH > effHeaderHeight
                    && cellRight <= this.width + 10;

                // Create or reuse button
                let btn: HTMLButtonElement;
                if (btnIdx < this._filterButtons.length) {
                    btn = this._filterButtons[btnIdx];
                } else {
                    btn = document.createElement('button');
                    btn.className = 'filter-arrow-btn';
                    btn.textContent = '\u25BC'; // ▼
                    wrapper.appendChild(btn);
                    this._filterButtons.push(btn);
                }

                // Store data on the button for the click handler
                const tableName = table.name;
                const colIndex = c;
                const colDef = table.columns[c - tr.start_col];
                const colName = colDef?.name ?? '';

                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.onFilterArrowClick) {
                        const rect = btn.getBoundingClientRect();
                        this.onFilterArrowClick(tableName, colIndex, colName, rect.left, rect.bottom);
                    }
                };

                // Position
                btn.style.left = `${btnLeft}px`;
                btn.style.top = `${btnTop}px`;
                btn.style.height = `${hdrRowH}px`;
                btn.style.display = visible ? 'flex' : 'none';

                btnIdx++;
            }
        }

        // Remove excess buttons from previous renders
        while (this._filterButtons.length > btnIdx) {
            const old = this._filterButtons.pop()!;
            old.remove();
        }
    }

    /** Remove all filter arrow buttons from the DOM. */
    private _clearFilterButtons(): void {
        for (const btn of this._filterButtons) {
            btn.remove();
        }
        this._filterButtons = [];
    }

    /** Get unique cell values for a column within a table's data range (excludes header/totals). */
    public getColumnUniqueValues(tableName: string, colIndex: number): string[] {
        const table = this.tables.find(t => t.name === tableName);
        if (!table || !this.data?.sheets?.[this._activeSheetIndex]) return [];

        const sheet = this.data.sheets[this._activeSheetIndex];
        const tr = table.range;
        const dataStart = table.has_header_row ? tr.start_row + 1 : tr.start_row;
        const dataEnd = table.has_totals_row ? tr.end_row - 1 : tr.end_row;

        const valueSet = new Set<string>();
        for (let r = dataStart; r <= dataEnd; r++) {
            const cell = sheet.cells?.[r]?.[colIndex];
            valueSet.add(cell?.value ?? '');
        }

        // Sort: blanks last, then alphabetical
        const sorted = [...valueSet].sort((a, b) => {
            if (a === '' && b !== '') return 1;
            if (a !== '' && b === '') return -1;
            return a.localeCompare(b);
        });
        return sorted;
    }

    /** Get the current filter for a table column, if any. */
    public getActiveFilter(tableName: string, colIndex: number): Set<string> | undefined {
        return this._activeFilters.get(`${tableName}:${colIndex}`);
    }

    /**
     * If the edited cell is a table header, update the column definition name to match.
     * This keeps the table overlay text in sync with cell edits.
     */
    public syncTableHeaderName(row: number, col: number, value: string): void {
        for (const table of this.tables) {
            if (!table.has_header_row) continue;
            const tr = table.range;
            if (row !== tr.start_row) continue;
            if (col < tr.start_col || col > tr.end_col) continue;
            const colDef = table.columns[col - tr.start_col];
            if (colDef) {
                colDef.name = value;
            }
            break;
        }
    }

    /** Sort rows within a table's data range by a column. */
    public sortTableColumn(tableName: string, colIndex: number, ascending: boolean): void {
        const table = this.tables.find(t => t.name === tableName);
        if (!table || !this.data?.sheets?.[this._activeSheetIndex]) return;
        this.pushUndo();

        const sheet = this.data.sheets[this._activeSheetIndex];
        const tr = table.range;
        const dataStart = table.has_header_row ? tr.start_row + 1 : tr.start_row;
        const dataEnd = table.has_totals_row ? tr.end_row - 1 : tr.end_row;

        // Collect data rows (only within the table range)
        const rows: { cells: Record<number, { value: string; data_type?: string; style?: CellStyle }>; style: Record<string, CellStyle> | undefined }[] = [];
        for (let r = dataStart; r <= dataEnd; r++) {
            rows.push({
                cells: sheet.cells[r] ?? {},
                style: this.styles[r]
            });
        }

        // Sort by target column
        rows.sort((a, b) => {
            const aVal = a.cells[colIndex]?.value ?? '';
            const bVal = b.cells[colIndex]?.value ?? '';
            const aNum = Number(aVal);
            const bNum = Number(bVal);
            const bothNumeric = aVal !== '' && bVal !== '' && !isNaN(aNum) && !isNaN(bNum);
            const cmp = bothNumeric ? aNum - bNum : aVal.localeCompare(bVal);
            return ascending ? cmp : -cmp;
        });

        // Write sorted rows back to the table data range
        for (let i = 0; i < rows.length; i++) {
            const r = dataStart + i;
            sheet.cells[r] = rows[i].cells;
            if (rows[i].style) {
                this.styles[r] = rows[i].style as Record<string, CellStyle>;
            } else {
                delete this.styles[r];
            }
        }

        this.render();
    }

    /** Apply a value filter to a table column. Only rows with allowed values are shown. */
    public applyFilter(tableName: string, colIndex: number, allowedValues: Set<string>): void {
        this._activeFilters.set(`${tableName}:${colIndex}`, allowedValues);
        this._rebuildHiddenRows();
    }

    /** Clear the filter for a specific table column. */
    public clearFilter(tableName: string, colIndex: number): void {
        this._activeFilters.delete(`${tableName}:${colIndex}`);
        this._rebuildHiddenRows();
    }

    /** Recompute the set of hidden rows from all active filters. */
    private _rebuildHiddenRows(): void {
        this._hiddenRows.clear();

        if (this._activeFilters.size === 0 || !this.data?.sheets?.[this._activeSheetIndex]) {
            this._layoutDirty = true;
            this.render();
            return;
        }

        const sheet = this.data.sheets[this._activeSheetIndex];

        // Group filters by table
        const filtersOfTable = new Map<string, { colIndex: number; allowed: Set<string> }[]>();
        for (const [key, allowed] of this._activeFilters) {
            const [tName, colStr] = key.split(':');
            if (!filtersOfTable.has(tName)) filtersOfTable.set(tName, []);
            filtersOfTable.get(tName)!.push({ colIndex: parseInt(colStr, 10), allowed });
        }

        for (const [tName, filters] of filtersOfTable) {
            const table = this.tables.find(t => t.name === tName);
            if (!table) continue;

            const tr = table.range;
            const dataStart = table.has_header_row ? tr.start_row + 1 : tr.start_row;
            const dataEnd = table.has_totals_row ? tr.end_row - 1 : tr.end_row;

            for (let r = dataStart; r <= dataEnd; r++) {
                for (const f of filters) {
                    const cellVal = sheet.cells?.[r]?.[f.colIndex]?.value ?? '';
                    if (!f.allowed.has(cellVal)) {
                        this._hiddenRows.add(r);
                        break;
                    }
                }
            }
        }

        this._layoutDirty = true;
        this.render();
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
        // Read available space from the wrapper (which is %-sized and tracks
        // container changes), not the canvas (which has explicit pixel dimensions
        // that would prevent it from growing with the container).
        const rect = this._wrapper.getBoundingClientRect();
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

    // --- Rendering ---

    render() {
        this._clearCfCache();
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

                // Data bar rendering (conditional formatting)
                const dbInfo = this._cfDataBars.get(`${r}:${c}`);
                if (dbInfo) {
                    const barW = Math.max(1, (cellW - 4) * dbInfo.ratio);
                    this.ctx.fillStyle = dbInfo.color + '66'; // ~40% opacity
                    this.ctx.fillRect(x + 2, y + 2, barW, cellH - 4);
                    // Bar border
                    this.ctx.strokeStyle = dbInfo.color;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x + 2, y + 2, barW, cellH - 4);
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

                // Icon set rendering (conditional formatting)
                const iconInfo = this._cfIcons.get(`${r}:${c}`);
                if (iconInfo) {
                    this.ctx.save();
                    this.ctx.font = `bold ${Math.min(cellH - 4, 14)}px sans-serif`;
                    this.ctx.fillStyle = iconInfo.color;
                    this.ctx.textAlign = 'left';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(iconInfo.icon, x + 2, y + cellH / 2);
                    this.ctx.restore();
                }
            }
        }

        // --- Draw Sparklines ---
        this.drawSparklines(effHeaderWidth, effHeaderHeight);

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

                    // Filter dropdown arrow is rendered as an HTML button (see _syncFilterButtons)
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

        // --- Sync filter arrow buttons over table headers ---
        this._syncFilterButtons();

        // Notify listeners that the canvas was repainted (e.g. for chart overlay repositioning)
        if (this.onScrollChanged) this.onScrollChanged();
    }

    /** Draw sparkline mini-charts inside cells */
    private drawSparklines(effHeaderWidth: number, effHeaderHeight: number) {
        if (!this.data?.sheets) return;
        const sheet = this.data.sheets[this._activeSheetIndex];
        if (!sheet?.sparklines || sheet.sparklines.length === 0) return;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
        this.ctx.clip();

        for (const spark of sheet.sparklines) {
            // Parse location cell ref (e.g., "G3") to row, col
            const loc = this.parseSparklineCellRef(spark.location);
            if (!loc) continue;

            // Get cell position
            const cellX = this.cx(loc.col) - this.scrollLeft + effHeaderWidth;
            const cellY = this.ry(loc.row) - this.scrollTop + effHeaderHeight;
            const cellW = this.cw(loc.col);
            const cellH = this.rh(loc.row);

            // Skip if off-screen
            if (cellX + cellW < effHeaderWidth || cellY + cellH < effHeaderHeight) continue;
            if (cellX > this.width || cellY > this.height) continue;

            // Parse data values from the data_range reference
            const values = this.resolveSparklineData(spark.data_range, sheet);
            if (values.length === 0) continue;

            const color = spark.color || '#4472C4';
            const negColor = spark.negative_color || '#FF0000';
            const padding = 3;
            const drawX = cellX + padding;
            const drawY = cellY + padding;
            const drawW = cellW - padding * 2;
            const drawH = cellH - padding * 2;

            if (drawW <= 0 || drawH <= 0) continue;

            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const range = maxVal - minVal || 1;

            switch (spark.sparkline_type) {
                case 'line':
                    this.drawLineSparkline(drawX, drawY, drawW, drawH, values, minVal, range, color);
                    break;
                case 'column':
                    this.drawColumnSparkline(drawX, drawY, drawW, drawH, values, minVal, range, color, negColor);
                    break;
                case 'stacked':
                    this.drawWinLossSparkline(drawX, drawY, drawW, drawH, values, color, negColor);
                    break;
                default:
                    this.drawLineSparkline(drawX, drawY, drawW, drawH, values, minVal, range, color);
            }
        }
        this.ctx.restore();
    }

    private drawLineSparkline(x: number, y: number, w: number, h: number, values: number[], minVal: number, range: number, color: string) {
        if (values.length < 2) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.5;
        this.ctx.lineJoin = 'round';

        const step = w / (values.length - 1);
        for (let i = 0; i < values.length; i++) {
            const px = x + i * step;
            const py = y + h - ((values[i] - minVal) / range) * h;
            if (i === 0) this.ctx.moveTo(px, py);
            else this.ctx.lineTo(px, py);
        }
        this.ctx.stroke();
    }

    private drawColumnSparkline(x: number, y: number, w: number, h: number, values: number[], minVal: number, range: number, color: string, negColor: string) {
        const gap = 1;
        const barW = Math.max(1, (w - gap * (values.length - 1)) / values.length);
        const baseline = minVal >= 0 ? y + h : y + h * (1 - (-minVal / range));

        for (let i = 0; i < values.length; i++) {
            const px = x + i * (barW + gap);
            const val = values[i];
            const barH = (Math.abs(val) / range) * h;
            const isNeg = val < 0;

            this.ctx.fillStyle = isNeg ? negColor : color;
            if (isNeg) {
                this.ctx.fillRect(px, baseline, barW, Math.min(barH, y + h - baseline));
            } else {
                this.ctx.fillRect(px, baseline - barH, barW, barH);
            }
        }
    }

    private drawWinLossSparkline(x: number, y: number, w: number, h: number, values: number[], color: string, negColor: string) {
        const gap = 1;
        const barW = Math.max(1, (w - gap * (values.length - 1)) / values.length);
        const halfH = h / 2;
        const midY = y + halfH;

        for (let i = 0; i < values.length; i++) {
            const px = x + i * (barW + gap);
            if (values[i] >= 0) {
                this.ctx.fillStyle = color;
                this.ctx.fillRect(px, midY - halfH * 0.8, barW, halfH * 0.8);
            } else {
                this.ctx.fillStyle = negColor;
                this.ctx.fillRect(px, midY, barW, halfH * 0.8);
            }
        }
    }

    private parseSparklineCellRef(ref: string): { row: number; col: number } | null {
        const cleaned = ref.replace(/\$/g, '').replace(/.*!/, '');
        const m = cleaned.match(/^([A-Z]{1,3})(\d+)$/);
        if (!m) return null;
        let col = 0;
        for (let i = 0; i < m[1].length; i++) {
            col = col * 26 + (m[1].charCodeAt(i) - 64);
        }
        return { row: parseInt(m[2], 10) - 1, col: col - 1 };
    }

    private resolveSparklineData(dataRange: string, sheet: any): number[] {
        // dataRange is like "Sheet1!B2:B10" or "B2:B10"
        const range = dataRange.replace(/.*!/, '').replace(/\$/g, '');
        const parts = range.split(':');
        if (parts.length !== 2) return [];

        const start = this.parseSparklineCellRef(parts[0]);
        const end = this.parseSparklineCellRef(parts[1]);
        if (!start || !end) return [];

        const values: number[] = [];
        for (let r = start.row; r <= end.row; r++) {
            for (let c = start.col; c <= end.col; c++) {
                const cell = sheet.cells?.[r]?.[c];
                if (cell) {
                    const num = parseFloat(cell.value);
                    values.push(isNaN(num) ? 0 : num);
                } else {
                    values.push(0);
                }
            }
        }
        return values;
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
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        const modelStyle = sheet?.cells?.[row]?.[col]?.style;
        const cfStyle = this.evaluateConditionalFormats(row, col);
        if (!modelStyle && !overlay && !cfStyle) return overlay;
        // Merge: model -> CF -> overlay (overlay highest priority)
        const merged: CellStyle = {};
        // 1. Model style (base)
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
        // 2. Conditional formatting (overrides model)
        if (cfStyle) {
            if (cfStyle.bold !== undefined) merged.bold = cfStyle.bold;
            if (cfStyle.italic !== undefined) merged.italic = cfStyle.italic;
            if (cfStyle.underline !== undefined) merged.underline = cfStyle.underline;
            if (cfStyle.textColor) merged.textColor = cfStyle.textColor;
            if (cfStyle.fillColor) merged.fillColor = cfStyle.fillColor;
            if (cfStyle.numberFormat) merged.numberFormat = cfStyle.numberFormat;
        }
        // 3. Overlay (user edits, highest priority)
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

    // --- Conditional Formatting Evaluation Engine ---

    /** Cache for aggregate computations (top10, average, duplicates, etc.) keyed by rule index */
    private _cfCache: Map<number, any> = new Map();
    /** Per-render cycle data bar/icon set results keyed by "row:col" */
    private _cfDataBars: Map<string, { ratio: number; color: string }> = new Map();
    private _cfIcons: Map<string, { icon: string; color: string }> = new Map();

    /** Clear CF cache on data changes */
    private _clearCfCache(): void {
        this._cfCache.clear();
        this._cfDataBars.clear();
        this._cfIcons.clear();
    }

    /** Check if (row, col) falls within a sqref range string like "A1:D10" or "A1:D10 F1:G5" */
    private cellInRange(row: number, col: number, sqref: string): boolean {
        const parts = sqref.split(/\s+/);
        for (const part of parts) {
            const colons = part.split(':');
            if (colons.length === 2) {
                const [r1, c1] = this.parseCfCellRef(colons[0]);
                const [r2, c2] = this.parseCfCellRef(colons[1]);
                const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
                const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
                if (row >= minR && row <= maxR && col >= minC && col <= maxC) return true;
            } else {
                const [r, c] = this.parseCfCellRef(colons[0]);
                if (row === r && col === c) return true;
            }
        }
        return false;
    }

    /** Parse cell ref like "B3" or "$B$3" to [row, col] (0-indexed) */
    private parseCfCellRef(ref: string): [number, number] {
        const clean = ref.replace(/\$/g, '');
        let col = 0, row = 0, inDigits = false;
        for (const ch of clean) {
            if (!inDigits && ch >= 'A' && ch <= 'Z') {
                col = col * 26 + (ch.charCodeAt(0) - 64);
            } else if (!inDigits && ch >= 'a' && ch <= 'z') {
                col = col * 26 + (ch.charCodeAt(0) - 96);
            } else {
                inDigits = true;
                row = row * 10 + parseInt(ch);
            }
        }
        return [row - 1, col - 1];
    }

    /** Get sqref bounds as {minRow, minCol, maxRow, maxCol} */
    private getSqrefBounds(sqref: string): { minRow: number; minCol: number; maxRow: number; maxCol: number } {
        let minRow = Infinity, minCol = Infinity, maxRow = -1, maxCol = -1;
        const parts = sqref.split(/\s+/);
        for (const part of parts) {
            const colons = part.split(':');
            for (const ref of colons) {
                const [r, c] = this.parseCfCellRef(ref);
                if (r < minRow) minRow = r;
                if (c < minCol) minCol = c;
                if (r > maxRow) maxRow = r;
                if (c > maxCol) maxCol = c;
            }
        }
        return { minRow, minCol, maxRow, maxCol };
    }

    /** Collect all numeric values in a sqref range */
    private collectNumericValues(sqref: string): number[] {
        const bounds = this.getSqrefBounds(sqref);
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        if (!sheet?.cells) return [];
        const values: number[] = [];
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const rowData = sheet.cells[r];
            if (!rowData) continue;
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                if (!this.cellInRange(r, c, sqref)) continue;
                const cell = rowData[c];
                if (cell && cell.data_type === 'n') {
                    const n = parseFloat(cell.value);
                    if (!isNaN(n)) values.push(n);
                }
            }
        }
        return values;
    }

    /** Collect all string values in a sqref range */
    private collectStringValues(sqref: string): string[] {
        const bounds = this.getSqrefBounds(sqref);
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        if (!sheet?.cells) return [];
        const values: string[] = [];
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const rowData = sheet.cells[r];
            if (!rowData) continue;
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                if (!this.cellInRange(r, c, sqref)) continue;
                const cell = rowData[c];
                if (cell) values.push(cell.value ?? '');
            }
        }
        return values;
    }

    /** Get cell numeric value */
    private getCellNumericValue(row: number, col: number): number | undefined {
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        const cell = sheet?.cells?.[row]?.[col];
        if (!cell) return undefined;
        if (cell.data_type === 'n') {
            const n = parseFloat(cell.value);
            return isNaN(n) ? undefined : n;
        }
        return undefined;
    }

    /** Get cell string value */
    private getCellStringValue(row: number, col: number): string {
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        return sheet?.cells?.[row]?.[col]?.value ?? '';
    }

    /** Convert DxfStyle to CellStyle */
    private dxfToCellStyle(dxf: any): CellStyle {
        const style: CellStyle = {};
        if (dxf.bold) style.bold = true;
        if (dxf.italic) style.italic = true;
        if (dxf.underline) style.underline = true;
        if (dxf.text_color) style.textColor = dxf.text_color;
        if (dxf.fill_color) style.fillColor = dxf.fill_color;
        if (dxf.number_format) style.numberFormat = dxf.number_format;
        return style;
    }

    /** Evaluate all conditional formatting rules for a cell, returning a style override */
    private evaluateConditionalFormats(row: number, col: number): CellStyle | undefined {
        const sheet = this.data?.sheets?.[this._activeSheetIndex];
        if (!sheet?.conditional_formats?.length) return undefined;

        let result: CellStyle | undefined;
        const rules = sheet.conditional_formats;
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (!this.cellInRange(row, col, rule.sqref)) continue;
            const match = this.evaluateRule(rule, i, row, col);
            if (match) {
                result = result ? { ...result, ...match } : { ...match };
            }
        }
        return result;
    }

    /** Evaluate a single CF rule for the given cell */
    private evaluateRule(rule: any, ruleIndex: number, row: number, col: number): CellStyle | undefined {
        switch (rule.rule_type) {
            case 'cellIs': return this.evaluateCellIs(rule, row, col);
            case 'containsText': return this.evaluateContainsText(rule, row, col, 'contains');
            case 'notContainsText': return this.evaluateContainsText(rule, row, col, 'notContains');
            case 'beginsWith': return this.evaluateContainsText(rule, row, col, 'beginsWith');
            case 'endsWith': return this.evaluateContainsText(rule, row, col, 'endsWith');
            case 'top10': return this.evaluateTop10(rule, ruleIndex, row, col);
            case 'aboveAverage': return this.evaluateAboveAverage(rule, ruleIndex, row, col);
            case 'duplicateValues': return this.evaluateDuplicateUnique(rule, ruleIndex, row, col, true);
            case 'uniqueValues': return this.evaluateDuplicateUnique(rule, ruleIndex, row, col, false);
            case 'containsBlanks': {
                const val = this.getCellStringValue(row, col);
                if (val.trim() === '') return rule.dxf_style ? this.dxfToCellStyle(rule.dxf_style) : {};
                return undefined;
            }
            case 'notContainsBlanks': {
                const val = this.getCellStringValue(row, col);
                if (val.trim() !== '') return rule.dxf_style ? this.dxfToCellStyle(rule.dxf_style) : {};
                return undefined;
            }
            case 'colorScale': return this.evaluateColorScale(rule, ruleIndex, row, col);
            case 'dataBar': {
                this.evaluateDataBar(rule, ruleIndex, row, col);
                return undefined; // Data bars are drawn separately, not as CellStyle
            }
            case 'iconSet': {
                this.evaluateIconSet(rule, ruleIndex, row, col);
                return undefined; // Icons drawn separately
            }
            case 'expression': return this.evaluateExpression(rule, row, col);
            default: return undefined;
        }
    }

    private evaluateCellIs(rule: any, row: number, col: number): CellStyle | undefined {
        const cellVal = this.getCellNumericValue(row, col);
        if (cellVal === undefined) return undefined;
        const op = rule.operator || 'greaterThan';
        const v1 = parseFloat(rule.values?.[0] ?? '0');
        const v2 = parseFloat(rule.values?.[1] ?? '0');
        let match = false;
        switch (op) {
            case 'greaterThan': match = cellVal > v1; break;
            case 'greaterThanOrEqual': match = cellVal >= v1; break;
            case 'lessThan': match = cellVal < v1; break;
            case 'lessThanOrEqual': match = cellVal <= v1; break;
            case 'equal': match = cellVal === v1; break;
            case 'notEqual': match = cellVal !== v1; break;
            case 'between': match = cellVal >= v1 && cellVal <= v2; break;
            case 'notBetween': match = cellVal < v1 || cellVal > v2; break;
        }
        if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
        return undefined;
    }

    private evaluateContainsText(rule: any, row: number, col: number, mode: string): CellStyle | undefined {
        const cellVal = this.getCellStringValue(row, col).toLowerCase();
        const text = (rule.text || rule.values?.[0] || '').toLowerCase();
        let match = false;
        switch (mode) {
            case 'contains': match = cellVal.includes(text); break;
            case 'notContains': match = !cellVal.includes(text); break;
            case 'beginsWith': match = cellVal.startsWith(text); break;
            case 'endsWith': match = cellVal.endsWith(text); break;
        }
        if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
        return undefined;
    }

    private evaluateTop10(rule: any, ruleIndex: number, row: number, col: number): CellStyle | undefined {
        const cellVal = this.getCellNumericValue(row, col);
        if (cellVal === undefined) return undefined;
        const cacheKey = ruleIndex;
        if (!this._cfCache.has(cacheKey)) {
            const values = this.collectNumericValues(rule.sqref);
            values.sort((a, b) => a - b);
            const rank = rule.rank || 10;
            const isBottom = rule.bottom === true;
            const isPercent = rule.percent === true;
            let count = isPercent ? Math.ceil(values.length * rank / 100) : rank;
            count = Math.min(count, values.length);
            let threshold: number;
            if (isBottom) {
                threshold = values[count - 1] ?? -Infinity;
                this._cfCache.set(cacheKey, { type: 'bottom', threshold });
            } else {
                threshold = values[values.length - count] ?? Infinity;
                this._cfCache.set(cacheKey, { type: 'top', threshold });
            }
        }
        const cache = this._cfCache.get(cacheKey);
        const match = cache.type === 'top' ? cellVal >= cache.threshold : cellVal <= cache.threshold;
        if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
        return undefined;
    }

    private evaluateAboveAverage(rule: any, ruleIndex: number, row: number, col: number): CellStyle | undefined {
        const cellVal = this.getCellNumericValue(row, col);
        if (cellVal === undefined) return undefined;
        if (!this._cfCache.has(ruleIndex)) {
            const values = this.collectNumericValues(rule.sqref);
            const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            this._cfCache.set(ruleIndex, { avg });
        }
        const { avg } = this._cfCache.get(ruleIndex);
        const isAbove = rule.above_average !== false;
        const match = isAbove ? cellVal > avg : cellVal < avg;
        if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
        return undefined;
    }

    private evaluateDuplicateUnique(rule: any, ruleIndex: number, row: number, col: number, wantDuplicate: boolean): CellStyle | undefined {
        const cellVal = this.getCellStringValue(row, col);
        if (cellVal === '') return undefined;
        if (!this._cfCache.has(ruleIndex)) {
            const allValues = this.collectStringValues(rule.sqref);
            const counts: Record<string, number> = {};
            for (const v of allValues) {
                if (v !== '') counts[v] = (counts[v] || 0) + 1;
            }
            this._cfCache.set(ruleIndex, { counts });
        }
        const { counts } = this._cfCache.get(ruleIndex);
        const isDuplicate = (counts[cellVal] || 0) > 1;
        const match = wantDuplicate ? isDuplicate : !isDuplicate;
        if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
        return undefined;
    }

    private evaluateExpression(rule: any, row: number, col: number): CellStyle | undefined {
        // Simple expression evaluation — only support basic cell reference comparison
        // Full formula evaluation would require the formula engine
        if (rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
        return undefined;
    }

    /** Evaluate color scale and return a fill color */
    private evaluateColorScale(rule: any, ruleIndex: number, row: number, col: number): CellStyle | undefined {
        const cellVal = this.getCellNumericValue(row, col);
        if (cellVal === undefined) return undefined;
        const cs = rule.color_scale;
        if (!cs || !cs.colors || cs.colors.length < 2) return undefined;

        if (!this._cfCache.has(ruleIndex)) {
            const values = this.collectNumericValues(rule.sqref);
            const min = values.length > 0 ? Math.min(...values) : 0;
            const max = values.length > 0 ? Math.max(...values) : 1;
            this._cfCache.set(ruleIndex, { min, max });
        }
        const { min, max } = this._cfCache.get(ruleIndex);
        const range = max - min || 1;
        const ratio = Math.max(0, Math.min(1, (cellVal - min) / range));

        let fillColor: string;
        if (cs.colors.length === 2) {
            fillColor = this.interpolateColor(cs.colors[0], cs.colors[1], ratio);
        } else {
            // 3-color scale: interpolate in two segments
            if (ratio <= 0.5) {
                fillColor = this.interpolateColor(cs.colors[0], cs.colors[1], ratio * 2);
            } else {
                fillColor = this.interpolateColor(cs.colors[1], cs.colors[2], (ratio - 0.5) * 2);
            }
        }
        return { fillColor };
    }

    /** Interpolate between two hex colors */
    private interpolateColor(c1: string, c2: string, t: number): string {
        const parse = (hex: string) => {
            hex = hex.replace('#', '');
            return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
        };
        const [r1, g1, b1] = parse(c1);
        const [r2, g2, b2] = parse(c2);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /** Evaluate data bar — stores result in _cfDataBars map */
    private evaluateDataBar(rule: any, ruleIndex: number, row: number, col: number): void {
        const cellVal = this.getCellNumericValue(row, col);
        if (cellVal === undefined) return;
        const db = rule.data_bar;
        if (!db) return;

        if (!this._cfCache.has(ruleIndex)) {
            const values = this.collectNumericValues(rule.sqref);
            const min = values.length > 0 ? Math.min(...values) : 0;
            const max = values.length > 0 ? Math.max(...values) : 1;
            this._cfCache.set(ruleIndex, { min, max });
        }
        const { min, max } = this._cfCache.get(ruleIndex);
        const range = max - min || 1;
        const ratio = Math.max(0, Math.min(1, (cellVal - min) / range));
        this._cfDataBars.set(`${row}:${col}`, { ratio, color: db.color || '#638EC6' });
    }

    /** Evaluate icon set — stores result in _cfIcons map */
    private evaluateIconSet(rule: any, ruleIndex: number, row: number, col: number): void {
        const cellVal = this.getCellNumericValue(row, col);
        if (cellVal === undefined) return;
        const is = rule.icon_set;
        if (!is) return;

        if (!this._cfCache.has(ruleIndex)) {
            const values = this.collectNumericValues(rule.sqref);
            const min = values.length > 0 ? Math.min(...values) : 0;
            const max = values.length > 0 ? Math.max(...values) : 1;
            this._cfCache.set(ruleIndex, { min, max });
        }
        const { min, max } = this._cfCache.get(ruleIndex);
        const range = max - min || 1;
        const pct = ((cellVal - min) / range) * 100;

        // Determine icon based on thresholds or default percentile splits
        const thresholds = is.thresholds && is.thresholds.length > 0
            ? is.thresholds
            : this.getDefaultIconThresholds(is.icon_style);

        const iconInfo = this.getIconForValue(pct, thresholds, is.icon_style, is.reverse);
        this._cfIcons.set(`${row}:${col}`, iconInfo);
    }

    /** Get default thresholds for icon set styles */
    private getDefaultIconThresholds(style: string): number[] {
        if (style.startsWith('5')) return [20, 40, 60, 80];
        if (style.startsWith('4')) return [25, 50, 75];
        return [33, 67]; // 3-icon default
    }

    /** Get icon character and color for a given percentile value */
    private getIconForValue(pct: number, thresholds: number[], style: string, reverse: boolean): { icon: string; color: string } {
        const icons = this.getIconSet(style);
        let idx = 0;
        for (let i = 0; i < thresholds.length; i++) {
            if (pct >= thresholds[i]) idx = i + 1;
        }
        if (reverse) idx = icons.length - 1 - idx;
        idx = Math.max(0, Math.min(idx, icons.length - 1));
        return icons[idx];
    }

    /** Get icon set definition (char + color) */
    private getIconSet(style: string): Array<{ icon: string; color: string }> {
        switch (style) {
            case '3Arrows': case '3ArrowsGray':
                return [
                    { icon: '▼', color: '#ff0000' },
                    { icon: '►', color: '#ffbf00' },
                    { icon: '▲', color: '#00b050' },
                ];
            case '3TrafficLights1': case '3TrafficLights': case '3TrafficLights2':
                return [
                    { icon: '●', color: '#ff0000' },
                    { icon: '●', color: '#ffbf00' },
                    { icon: '●', color: '#00b050' },
                ];
            case '3Flags':
                return [
                    { icon: '⚑', color: '#ff0000' },
                    { icon: '⚑', color: '#ffbf00' },
                    { icon: '⚑', color: '#00b050' },
                ];
            case '3Signs':
                return [
                    { icon: '◆', color: '#ff0000' },
                    { icon: '▲', color: '#ffbf00' },
                    { icon: '●', color: '#00b050' },
                ];
            case '3Symbols': case '3Symbols2':
                return [
                    { icon: '✕', color: '#ff0000' },
                    { icon: '!', color: '#ffbf00' },
                    { icon: '✓', color: '#00b050' },
                ];
            case '3Stars':
                return [
                    { icon: '☆', color: '#ffbf00' },
                    { icon: '★', color: '#ffbf00' },
                    { icon: '★', color: '#ffbf00' },
                ];
            case '4Arrows': case '4ArrowsGray':
                return [
                    { icon: '▼', color: '#ff0000' },
                    { icon: '▾', color: '#ffbf00' },
                    { icon: '▴', color: '#92d050' },
                    { icon: '▲', color: '#00b050' },
                ];
            case '4RedToBlack':
                return [
                    { icon: '●', color: '#000000' },
                    { icon: '●', color: '#888888' },
                    { icon: '●', color: '#ff6666' },
                    { icon: '●', color: '#ff0000' },
                ];
            case '4TrafficLights':
                return [
                    { icon: '●', color: '#ff0000' },
                    { icon: '●', color: '#ffbf00' },
                    { icon: '●', color: '#92d050' },
                    { icon: '●', color: '#00b050' },
                ];
            case '5Arrows': case '5ArrowsGray':
                return [
                    { icon: '▼', color: '#ff0000' },
                    { icon: '▾', color: '#ff6666' },
                    { icon: '►', color: '#ffbf00' },
                    { icon: '▴', color: '#92d050' },
                    { icon: '▲', color: '#00b050' },
                ];
            case '5Quarters':
                return [
                    { icon: '○', color: '#888888' },
                    { icon: '◔', color: '#888888' },
                    { icon: '◑', color: '#888888' },
                    { icon: '◕', color: '#888888' },
                    { icon: '●', color: '#888888' },
                ];
            default: // 3TrafficLights as fallback
                return [
                    { icon: '●', color: '#ff0000' },
                    { icon: '●', color: '#ffbf00' },
                    { icon: '●', color: '#00b050' },
                ];
        }
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
