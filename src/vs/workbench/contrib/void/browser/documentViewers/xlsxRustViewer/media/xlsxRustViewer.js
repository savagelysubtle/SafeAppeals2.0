"use strict";
(() => {
  // media/wasm/xlsx_rust_viewer.js
  var import_meta = {};
  var ContextMenuManager = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      ContextMenuManagerFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_contextmenumanager_free(ptr, 0);
    }
    /**
     * @param {number} row
     * @param {number} col
     * @returns {string}
     */
    get_context_menu(row, col) {
      let deferred2_0;
      let deferred2_1;
      try {
        const ret = wasm.contextmenumanager_get_context_menu(this.__wbg_ptr, row, col);
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
          ptr1 = 0;
          len1 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
      } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
      }
    }
    constructor() {
      const ret = wasm.contextmenumanager_new();
      this.__wbg_ptr = ret >>> 0;
      ContextMenuManagerFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
  };
  if (Symbol.dispose) ContextMenuManager.prototype[Symbol.dispose] = ContextMenuManager.prototype.free;
  var FormulaEngine = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      FormulaEngineFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_formulaengine_free(ptr, 0);
    }
    /**
     * Evaluate all formula cells in the sheet.
     * Returns JSON: { "row:col": { "display": "...", "is_error": bool, "numeric": number|null } }
     * @param {string} cells_json
     * @returns {string}
     */
    evaluate_all(cells_json) {
      let deferred3_0;
      let deferred3_1;
      try {
        const ptr0 = passStringToWasm0(cells_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.formulaengine_evaluate_all(this.__wbg_ptr, ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
          ptr2 = 0;
          len2 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
      } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
      }
    }
    /**
     * Evaluate a single cell's formula.
     * `cells_json` is the cells object: { "0": { "0": { "value": "...", "data_type": "..." }, ... }, ... }
     * Returns JSON: { "value": "...", "display": "..." }
     * @param {number} row
     * @param {number} col
     * @param {string} cells_json
     * @returns {string}
     */
    evaluate_cell(row, col, cells_json) {
      let deferred3_0;
      let deferred3_1;
      try {
        const ptr0 = passStringToWasm0(cells_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.formulaengine_evaluate_cell(this.__wbg_ptr, row, col, ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
          ptr2 = 0;
          len2 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
      } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
      }
    }
    /**
     * When a cell is edited, return the list of cells (as "row:col") that need re-evaluation.
     * @param {number} row
     * @param {number} col
     * @returns {string}
     */
    get_dependents(row, col) {
      let deferred1_0;
      let deferred1_1;
      try {
        const ret = wasm.formulaengine_get_dependents(this.__wbg_ptr, row, col);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
      } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
      }
    }
    /**
     * Invalidate the cache for a cell and its dependents
     * @param {number} row
     * @param {number} col
     */
    invalidate(row, col) {
      wasm.formulaengine_invalidate(this.__wbg_ptr, row, col);
    }
    constructor() {
      const ret = wasm.formulaengine_new();
      this.__wbg_ptr = ret >>> 0;
      FormulaEngineFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
  };
  if (Symbol.dispose) FormulaEngine.prototype[Symbol.dispose] = FormulaEngine.prototype.free;
  var TableOps = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      TableOpsFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_tableops_free(ptr, 0);
    }
    /**
     * Add a column to a table. Returns updated model JSON.
     * @param {string} model_json
     * @param {string} table_name
     * @param {string} col_name
     * @returns {string}
     */
    add_table_column(model_json, table_name, col_name) {
      let deferred5_0;
      let deferred5_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(col_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_add_table_column(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
          ptr4 = 0;
          len4 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
      } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
      }
    }
    /**
     * Convert a table back to a plain range (removes table, keeps data). Returns updated model JSON.
     * @param {string} model_json
     * @param {string} table_name
     * @returns {string}
     */
    convert_to_range(model_json, table_name) {
      let deferred4_0;
      let deferred4_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_convert_to_range(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
          ptr3 = 0;
          len3 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
      } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
      }
    }
    /**
     * Create a new table from the given range on the specified sheet.
     * Returns updated model JSON.
     * @param {string} model_json
     * @param {number} sheet_idx
     * @param {string} range_json
     * @param {string} table_name
     * @param {string} style_name
     * @returns {string}
     */
    create_table(model_json, sheet_idx, range_json, table_name, style_name) {
      let deferred6_0;
      let deferred6_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(range_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(style_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_create_table(this.__wbg_ptr, ptr0, len0, sheet_idx, ptr1, len1, ptr2, len2, ptr3, len3);
        var ptr5 = ret[0];
        var len5 = ret[1];
        if (ret[3]) {
          ptr5 = 0;
          len5 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred6_0 = ptr5;
        deferred6_1 = len5;
        return getStringFromWasm0(ptr5, len5);
      } finally {
        wasm.__wbindgen_free(deferred6_0, deferred6_1, 1);
      }
    }
    constructor() {
      const ret = wasm.tableops_new();
      this.__wbg_ptr = ret >>> 0;
      TableOpsFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
    /**
     * Remove a column from a table by index. Returns updated model JSON.
     * @param {string} model_json
     * @param {string} table_name
     * @param {number} col_index
     * @returns {string}
     */
    remove_table_column(model_json, table_name, col_index) {
      let deferred4_0;
      let deferred4_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_remove_table_column(this.__wbg_ptr, ptr0, len0, ptr1, len1, col_index);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
          ptr3 = 0;
          len3 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
      } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
      }
    }
    /**
     * Rename a table. Returns updated model JSON.
     * @param {string} model_json
     * @param {string} old_name
     * @param {string} new_name
     * @returns {string}
     */
    rename_table(model_json, old_name, new_name) {
      let deferred5_0;
      let deferred5_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(old_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(new_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_rename_table(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
          ptr4 = 0;
          len4 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
      } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
      }
    }
    /**
     * Resize an existing table to a new range. Returns updated model JSON.
     * @param {string} model_json
     * @param {string} table_name
     * @param {string} new_range_json
     * @returns {string}
     */
    resize_table(model_json, table_name, new_range_json) {
      let deferred5_0;
      let deferred5_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(new_range_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_resize_table(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
          ptr4 = 0;
          len4 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
      } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
      }
    }
    /**
     * Set table style. Returns updated model JSON.
     * @param {string} model_json
     * @param {string} table_name
     * @param {string} style_name
     * @returns {string}
     */
    set_table_style(model_json, table_name, style_name) {
      let deferred5_0;
      let deferred5_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(style_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_set_table_style(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
          ptr4 = 0;
          len4 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
      } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
      }
    }
    /**
     * Toggle or set the totals row. Returns updated model JSON.
     * functions_json is a JSON array of TotalsFunctionInput objects.
     * @param {string} model_json
     * @param {string} table_name
     * @param {boolean} enabled
     * @param {string} functions_json
     * @returns {string}
     */
    set_totals_row(model_json, table_name, enabled, functions_json) {
      let deferred5_0;
      let deferred5_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(functions_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_set_totals_row(this.__wbg_ptr, ptr0, len0, ptr1, len1, enabled, ptr2, len2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
          ptr4 = 0;
          len4 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
      } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
      }
    }
    /**
     * Toggle filter on a table. Returns updated model JSON.
     * @param {string} model_json
     * @param {string} table_name
     * @returns {string}
     */
    toggle_filter(model_json, table_name) {
      let deferred4_0;
      let deferred4_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(table_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.tableops_toggle_filter(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
          ptr3 = 0;
          len3 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
      } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
      }
    }
  };
  if (Symbol.dispose) TableOps.prototype[Symbol.dispose] = TableOps.prototype.free;
  var ViewportManager = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      ViewportManagerFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_viewportmanager_free(ptr, 0);
    }
    /**
     * Returns a JSON string of a `SheetData` containing only the cells in the requested viewport.
     * @param {string} model_json
     * @param {number} sheet_idx
     * @param {number} start_row
     * @param {number} end_row
     * @param {number} start_col
     * @param {number} end_col
     * @returns {string}
     */
    get_viewport(model_json, sheet_idx, start_row, end_row, start_col, end_col) {
      let deferred3_0;
      let deferred3_1;
      try {
        const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.viewportmanager_get_viewport(this.__wbg_ptr, ptr0, len0, sheet_idx, start_row, end_row, start_col, end_col);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
          ptr2 = 0;
          len2 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
      } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
      }
    }
    constructor() {
      const ret = wasm.viewportmanager_new();
      this.__wbg_ptr = ret >>> 0;
      ViewportManagerFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
  };
  if (Symbol.dispose) ViewportManager.prototype[Symbol.dispose] = ViewportManager.prototype.free;
  var XlsxParser = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      XlsxParserFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_xlsxparser_free(ptr, 0);
    }
    /**
     * Loads XLSX bytes and returns the full workbook model as JSON string.
     * @param {Uint8Array} data
     * @returns {string}
     */
    load(data) {
      let deferred3_0;
      let deferred3_1;
      try {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.xlsxparser_load(this.__wbg_ptr, ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
          ptr2 = 0;
          len2 = 0;
          throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
      } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
      }
    }
    constructor() {
      const ret = wasm.xlsxparser_new();
      this.__wbg_ptr = ret >>> 0;
      XlsxParserFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
  };
  if (Symbol.dispose) XlsxParser.prototype[Symbol.dispose] = XlsxParser.prototype.free;
  var XlsxWriter = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      XlsxWriterFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_xlsxwriter_free(ptr, 0);
    }
    constructor() {
      const ret = wasm.xlsxwriter_new();
      this.__wbg_ptr = ret >>> 0;
      XlsxWriterFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
    /**
     * @param {string} model_json
     * @returns {Uint8Array}
     */
    save(model_json) {
      const ptr0 = passStringToWasm0(model_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.xlsxwriter_save(this.__wbg_ptr, ptr0, len0);
      if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
      }
      var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
      return v2;
    }
  };
  if (Symbol.dispose) XlsxWriter.prototype[Symbol.dispose] = XlsxWriter.prototype.free;
  function init_panic_hook() {
    wasm.init_panic_hook();
  }
  function __wbg_get_imports() {
    const import0 = {
      __proto__: null,
      __wbg_Error_8c4e43fe74559d73: function(arg0, arg1) {
        const ret = Error(getStringFromWasm0(arg0, arg1));
        return ret;
      },
      __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
      },
      __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
          deferred0_0 = arg0;
          deferred0_1 = arg1;
          console.error(getStringFromWasm0(arg0, arg1));
        } finally {
          wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
      },
      __wbg_log_4550cae55a9e6e7a: function(arg0, arg1) {
        console.log(getStringFromWasm0(arg0, arg1));
      },
      __wbg_new_8a6f238a6ece86ea: function() {
        const ret = new Error();
        return ret;
      },
      __wbg_now_a3af9a2f4bbaa4d1: function() {
        const ret = Date.now();
        return ret;
      },
      __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
      },
      __wbindgen_init_externref_table: function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, void 0);
        table.set(offset + 0, void 0);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
      }
    };
    return {
      __proto__: null,
      "./xlsx_rust_viewer_bg.js": import0
    };
  }
  var ContextMenuManagerFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_contextmenumanager_free(ptr >>> 0, 1));
  var FormulaEngineFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_formulaengine_free(ptr >>> 0, 1));
  var TableOpsFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_tableops_free(ptr >>> 0, 1));
  var ViewportManagerFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_viewportmanager_free(ptr >>> 0, 1));
  var XlsxParserFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_xlsxparser_free(ptr >>> 0, 1));
  var XlsxWriterFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_xlsxwriter_free(ptr >>> 0, 1));
  function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
  }
  var cachedDataViewMemory0 = null;
  function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
      cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
  }
  function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
  }
  var cachedUint8ArrayMemory0 = null;
  function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
      cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
  }
  function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
  }
  function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === void 0) {
      const buf = cachedTextEncoder.encode(arg);
      const ptr2 = malloc(buf.length, 1) >>> 0;
      getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
      WASM_VECTOR_LEN = buf.length;
      return ptr2;
    }
    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8ArrayMemory0();
    let offset = 0;
    for (; offset < len; offset++) {
      const code = arg.charCodeAt(offset);
      if (code > 127) break;
      mem[ptr + offset] = code;
    }
    if (offset !== len) {
      if (offset !== 0) {
        arg = arg.slice(offset);
      }
      ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
      const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
      const ret = cachedTextEncoder.encodeInto(arg, view);
      offset += ret.written;
      ptr = realloc(ptr, len, offset, 1) >>> 0;
    }
    WASM_VECTOR_LEN = offset;
    return ptr;
  }
  function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
  }
  var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
  cachedTextDecoder.decode();
  var MAX_SAFARI_DECODE_BYTES = 2146435072;
  var numBytesDecoded = 0;
  function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
      cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
      cachedTextDecoder.decode();
      numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
  }
  var cachedTextEncoder = new TextEncoder();
  if (!("encodeInto" in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function(arg, view) {
      const buf = cachedTextEncoder.encode(arg);
      view.set(buf);
      return {
        read: arg.length,
        written: buf.length
      };
    };
  }
  var WASM_VECTOR_LEN = 0;
  var wasmModule;
  var wasm;
  function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
  }
  async function __wbg_load(module, imports) {
    if (typeof Response === "function" && module instanceof Response) {
      if (typeof WebAssembly.instantiateStreaming === "function") {
        try {
          return await WebAssembly.instantiateStreaming(module, imports);
        } catch (e) {
          const validResponse = module.ok && expectedResponseType(module.type);
          if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
            console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
          } else {
            throw e;
          }
        }
      }
      const bytes = await module.arrayBuffer();
      return await WebAssembly.instantiate(bytes, imports);
    } else {
      const instance = await WebAssembly.instantiate(module, imports);
      if (instance instanceof WebAssembly.Instance) {
        return { instance, module };
      } else {
        return instance;
      }
    }
    function expectedResponseType(type) {
      switch (type) {
        case "basic":
        case "cors":
        case "default":
          return true;
      }
      return false;
    }
  }
  async function __wbg_init(module_or_path) {
    if (wasm !== void 0) return wasm;
    if (module_or_path !== void 0) {
      if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
        ({ module_or_path } = module_or_path);
      } else {
        console.warn("using deprecated parameters for the initialization function; pass a single object instead");
      }
    }
    if (module_or_path === void 0) {
      module_or_path = new URL("xlsx_rust_viewer_bg.wasm", import_meta.url);
    }
    const imports = __wbg_get_imports();
    if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
      module_or_path = fetch(module_or_path);
    }
    const { instance, module } = await __wbg_load(await module_or_path, imports);
    return __wbg_finalize_init(instance, module);
  }

  // media/renderer.ts
  var TABLE_COLORS = {
    "TableStyleMedium2": { header: "#4472c4", band: "#d6e4f0", border: "#4472c4", headerText: "#fff" },
    "TableStyleMedium1": { header: "#a5a5a5", band: "#e0e0e0", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleMedium3": { header: "#ed7d31", band: "#fce4cc", border: "#ed7d31", headerText: "#fff" },
    "TableStyleMedium4": { header: "#ffc000", band: "#fff2cc", border: "#ffc000", headerText: "#333" },
    "TableStyleMedium5": { header: "#5b9bd5", band: "#dce6f0", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleMedium6": { header: "#70ad47", band: "#e2efda", border: "#70ad47", headerText: "#fff" },
    "TableStyleMedium7": { header: "#264478", band: "#c5d0e0", border: "#264478", headerText: "#fff" },
    "TableStyleMedium9": { header: "#7030a0", band: "#e1d5ec", border: "#7030a0", headerText: "#fff" },
    "TableStyleLight1": { header: "#000000", band: "#f2f2f2", border: "#999999", headerText: "#fff" },
    "TableStyleLight2": { header: "#4472c4", band: "#edf2fa", border: "#4472c4", headerText: "#fff" },
    "TableStyleLight9": { header: "#ed7d31", band: "#fef4eb", border: "#ed7d31", headerText: "#fff" },
    "TableStyleLight14": { header: "#70ad47", band: "#f0f7ec", border: "#70ad47", headerText: "#fff" },
    "TableStyleDark1": { header: "#000000", band: "#404040", border: "#000000", headerText: "#fff" },
    "TableStyleDark2": { header: "#4472c4", band: "#2b4a7a", border: "#4472c4", headerText: "#fff" },
    "TableStyleDark3": { header: "#ed7d31", band: "#7a4018", border: "#ed7d31", headerText: "#fff" },
    "TableStyleDark11": { header: "#7030a0", band: "#3d1a57", border: "#7030a0", headerText: "#fff" }
  };
  var DEFAULT_TABLE_COLORS = { header: "#4472c4", band: "#d6e4f0", border: "#4472c4", headerText: "#fff" };
  function getTableColors(styleName) {
    if (styleName && TABLE_COLORS[styleName]) return TABLE_COLORS[styleName];
    return DEFAULT_TABLE_COLORS;
  }
  var CanvasRenderer = class {
    constructor(container) {
      this.width = 0;
      this.height = 0;
      // Viewport state
      this.scrollTop = 0;
      this.scrollLeft = 0;
      // Config
      this.rowHeight = 24;
      this.colWidth = 100;
      this.headerHeight = 30;
      this.headerWidth = 50;
      this.data = null;
      // Cell styles overlay (not persisted in WASM model yet)
      this.styles = {};
      // Selection state
      this.selectedCell = null;
      this.selectionRange = null;
      this._isDragging = false;
      // Inline edit state
      this.editInput = null;
      this.editingCell = null;
      // View toggles
      this._showGridlines = true;
      this._showHeaders = true;
      // Freeze panes
      this._freezeRow = 0;
      this._freezeCol = 0;
      // Undo/Redo
      this.undoStack = [];
      this.redoStack = [];
      this.maxUndoSize = 50;
      // Table definitions for the current sheet
      this.tables = [];
      // Formula display cache: "row:col" -> display string
      this.formulaResults = {};
      // Merged cells: array of ranges
      this.mergedCells = [];
      // Per-column widths and per-row heights (sparse, only overrides)
      this.colWidths = {};
      this.rowHeights = {};
      // Layout position cache (cumulative pixel positions for variable col/row sizes)
      this._layoutDirty = true;
      this._colPos = [0];
      this._rowPos = [0];
      // Column/row resize dragging state
      this._resizeDragging = null;
      this._resizeIndex = -1;
      this._resizeStartPos = 0;
      this._resizeStartSize = 0;
      // Active sheet index
      this._activeSheetIndex = 0;
      // Find state
      this._findMatches = [];
      this._findMatchIndex = -1;
      // Loading / empty state
      this._loading = true;
      // Scrollbar state
      this._scrollbarSize = 14;
      this._scrollbarMinThumb = 30;
      this._scrollbarDragging = null;
      this._scrollbarDragStart = 0;
      this._scrollbarDragScrollStart = 0;
      // Formula point-mode state
      this._formulaMode = false;
      this._formulaRanges = [];
      this._formulaDragAnchor = null;
      this._formulaDragging = false;
      this._hScrollDragging = false;
      this._hScrollDragStartX = 0;
      this._hScrollDragStartScroll = 0;
      this._headerDragMode = null;
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;";
      container.appendChild(wrapper);
      this.canvas = document.createElement("canvas");
      this.canvas.style.cssText = "display:block;outline:none;flex:1;min-height:0;";
      wrapper.appendChild(this.canvas);
      this._hScrollbar = document.createElement("div");
      this._hScrollbar.style.cssText = "height:14px;flex-shrink:0;background:#e8e8e8;border-top:1px solid #ccc;position:relative;cursor:default;";
      wrapper.appendChild(this._hScrollbar);
      this._hScrollThumb = document.createElement("div");
      this._hScrollThumb.style.cssText = "position:absolute;top:2px;height:10px;min-width:30px;background:#999;border-radius:5px;cursor:pointer;";
      this._hScrollbar.appendChild(this._hScrollThumb);
      this._hScrollThumb.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._hScrollDragging = true;
        this._hScrollDragStartX = e.clientX;
        this._hScrollDragStartScroll = this.scrollLeft;
        this._hScrollThumb.style.background = "#666";
      });
      this._hScrollbar.addEventListener("mousedown", (e) => {
        if (e.target === this._hScrollbar) {
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
      window.addEventListener("mousemove", (e) => {
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
          this.scrollLeft = Math.max(0, Math.min(hMaxScroll, this._hScrollDragStartScroll + delta / trackSpace * hMaxScroll));
          this.updateHScrollbar();
          this.render();
        }
      });
      window.addEventListener("mouseup", () => {
        if (this._hScrollDragging) {
          this._hScrollDragging = false;
          this._hScrollThumb.style.background = "#999";
        }
      });
      const context = this.canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Could not get 2D context");
      this.ctx = context;
      this.resize();
      window.addEventListener("resize", () => this.resize());
      this.canvas.addEventListener("wheel", (e) => this.handleWheel(e), { passive: false });
      this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
      this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
      window.addEventListener("mouseup", () => this.handleMouseUp());
      this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
      this.canvas.addEventListener("contextmenu", (e) => this.handleContextMenu(e));
      this.canvas.setAttribute("tabindex", "0");
      this.canvas.style.cursor = "cell";
      this.canvas.addEventListener("keydown", (e) => this.handleKeyDown(e));
    }
    /** Update the HTML horizontal scrollbar thumb position and size */
    updateHScrollbar() {
      const virtualW = this.getVirtualWidth();
      const viewW = this.width - (this._showHeaders ? this.headerWidth : 0);
      const trackWidth = this._hScrollbar.clientWidth;
      const hRatio = Math.min(1, viewW / virtualW);
      const thumbW = Math.max(30, trackWidth * hRatio);
      const hMaxScroll = virtualW - viewW;
      const thumbLeft = hMaxScroll > 0 ? this.scrollLeft / hMaxScroll * (trackWidth - thumbW) : 0;
      this._hScrollThumb.style.width = `${thumbW}px`;
      this._hScrollThumb.style.left = `${thumbLeft}px`;
    }
    // --- Public API ---
    setData(model) {
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
    updateModel(model) {
      this.data = model;
      this._layoutDirty = true;
      this._syncFromActiveSheet();
      this.render();
      this.updateHScrollbar();
    }
    /** Sync tables, mergedCells, colWidths, rowHeights from the active sheet */
    _syncFromActiveSheet() {
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      this.tables = sheet?.tables ?? [];
      this.mergedCells = (sheet?.merged_cells ?? []).map((m) => ({
        startRow: m.start_row,
        startCol: m.start_col,
        endRow: m.end_row,
        endCol: m.end_col
      }));
      if (sheet?.col_widths) {
        this.colWidths = {};
        for (const [k, v] of Object.entries(sheet.col_widths)) {
          this.colWidths[Number(k)] = v;
        }
      }
      if (sheet?.row_heights) {
        this.rowHeights = {};
        for (const [k, v] of Object.entries(sheet.row_heights)) {
          this.rowHeights[Number(k)] = v;
        }
      }
    }
    getActiveSheetIndex() {
      return this._activeSheetIndex;
    }
    setActiveSheetIndex(idx) {
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
    getSheetCount() {
      return this.data?.sheets?.length ?? 0;
    }
    getSheetNames() {
      return (this.data?.sheets ?? []).map((s) => s.name);
    }
    /** Store formula evaluation results for display */
    setFormulaResults(results) {
      this.formulaResults = results;
      this.render();
    }
    /** Get a formula result for a specific cell */
    getFormulaDisplay(row, col) {
      const key = `${row}:${col}`;
      const r = this.formulaResults[key];
      return r ? r.display : null;
    }
    // --- Formula Point-Mode API ---
    /** Enter or exit formula editing mode. In formula mode, clicks insert cell references instead of changing selection. */
    setFormulaMode(active) {
      this._formulaMode = active;
      if (!active) {
        this._formulaRanges = [];
        this._formulaDragAnchor = null;
        this._formulaDragging = false;
      }
      this.render();
    }
    /** Whether the renderer is currently in formula editing mode */
    isFormulaMode() {
      return this._formulaMode;
    }
    /** Set the colored range highlights to draw during formula editing */
    setFormulaRanges(ranges) {
      this._formulaRanges = ranges;
      this.render();
    }
    /** Get current formula ranges */
    getFormulaRanges() {
      return this._formulaRanges;
    }
    /** Rebuild cumulative position arrays from colWidths / rowHeights. */
    ensureLayout(minCols = 200, minRows = 1100) {
      if (!this._layoutDirty && this._colPos.length > minCols + 1 && this._rowPos.length > minRows + 1) return;
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
    cx(col) {
      if (col >= this._colPos.length) this.ensureLayout(col + 50);
      return this._colPos[col] ?? this.getColX(col);
    }
    /** Get the cached width of a column. */
    cw(col) {
      if (col + 1 >= this._colPos.length) this.ensureLayout(col + 50);
      return (this._colPos[col + 1] ?? this._colPos[col] + this.colWidth) - (this._colPos[col] ?? 0);
    }
    /** Get the cached Y position of a row, growing the cache if needed. */
    ry(row) {
      if (row >= this._rowPos.length) this.ensureLayout(void 0, row + 50);
      return this._rowPos[row] ?? this.getRowY(row);
    }
    /** Get the cached height of a row. */
    rh(row) {
      if (row + 1 >= this._rowPos.length) this.ensureLayout(void 0, row + 50);
      return (this._rowPos[row + 1] ?? this._rowPos[row] + this.rowHeight) - (this._rowPos[row] ?? 0);
    }
    /** Convert mouse event to canvas drawing coordinates (accounts for any display/buffer mismatch). */
    mouseToCanvas(e) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return {
        x: rect.width > 0 ? sx * this.width / rect.width : sx,
        y: rect.height > 0 ? sy * this.height / rect.height : sy
      };
    }
    getData() {
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
              sheet.cells[r][c] = { value: "", data_type: "null", style: null };
            }
            const existing = sheet.cells[r][c].style || {};
            const merged = { ...existing };
            if (overlay.bold !== void 0) merged.bold = overlay.bold || void 0;
            if (overlay.italic !== void 0) merged.italic = overlay.italic || void 0;
            if (overlay.underline !== void 0) merged.underline = overlay.underline || void 0;
            if (overlay.fontSize !== void 0) merged.font_size = overlay.fontSize;
            if (overlay.fontFamily !== void 0) merged.font_family = overlay.fontFamily;
            if (overlay.textColor !== void 0) merged.text_color = overlay.textColor;
            if (overlay.fillColor !== void 0) merged.fill_color = overlay.fillColor;
            if (overlay.alignment !== void 0) merged.alignment = overlay.alignment;
            if (overlay.numberFormat !== void 0) merged.number_format = overlay.numberFormat;
            if (overlay.wrapText !== void 0) merged.wrap_text = overlay.wrapText || void 0;
            sheet.cells[r][c].style = merged;
          }
        }
      }
      return this.data;
    }
    setLoading(loading) {
      this._loading = loading;
      this.render();
    }
    getSelectedRange() {
      return this.selectionRange;
    }
    selectAll() {
      this.selectedCell = { row: 0, col: 0 };
      this.selectionRange = { startRow: 0, startCol: 0, endRow: 999, endCol: 99 };
      this.render();
    }
    getSelectedCell() {
      return this.selectedCell;
    }
    getTables() {
      return this.tables;
    }
    getTableAtCell(row, col) {
      for (const table of this.tables) {
        const r = table.range;
        if (row >= r.start_row && row <= r.end_row && col >= r.start_col && col <= r.end_col) {
          return table;
        }
      }
      return null;
    }
    // --- Cell Operations ---
    updateCell(row, col, value, dataType = "s") {
      if (!this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      if (!sheet.cells[row]) {
        sheet.cells[row] = {};
      }
      sheet.cells[row][col] = { value, data_type: dataType };
      if (row >= sheet.row_count) sheet.row_count = row + 1;
      if (col >= sheet.col_count) sheet.col_count = col + 1;
      this.render();
    }
    clearSelectedCells() {
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
    insertRow(atRow) {
      if (!this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const insertAt = atRow ?? (this.selectedCell?.row ?? 0);
      const newCells = {};
      const newStyles = {};
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
    deleteRow(atRow) {
      if (!this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const deleteAt = atRow ?? (this.selectedCell?.row ?? 0);
      const newCells = {};
      const newStyles = {};
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
    insertCol(atCol) {
      if (!this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const insertAt = atCol ?? (this.selectedCell?.col ?? 0);
      for (const rowKey of Object.keys(sheet.cells)) {
        const row = sheet.cells[rowKey];
        const newRow = {};
        for (const colKey of Object.keys(row)) {
          const c = parseInt(colKey, 10);
          const newCol = c >= insertAt ? c + 1 : c;
          newRow[newCol] = row[colKey];
        }
        sheet.cells[rowKey] = newRow;
      }
      for (const rowKey of Object.keys(this.styles)) {
        const row = this.styles[rowKey];
        const newRow = {};
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
    deleteCol(atCol) {
      if (!this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const deleteAt = atCol ?? (this.selectedCell?.col ?? 0);
      for (const rowKey of Object.keys(sheet.cells)) {
        const row = sheet.cells[rowKey];
        const newRow = {};
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
        const newRow = {};
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
    sortColumn(ascending, col) {
      if (!this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const sortCol = col ?? (this.selectedCell?.col ?? 0);
      const rowKeys = Object.keys(sheet.cells).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
      if (rowKeys.length === 0) return;
      const rows = [];
      for (const rk of rowKeys) {
        rows.push({
          key: rk,
          cells: sheet.cells[rk],
          style: this.styles[rk]
        });
      }
      rows.sort((a, b) => {
        const aVal = a.cells?.[sortCol]?.value ?? "";
        const bVal = b.cells?.[sortCol]?.value ?? "";
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        const bothNumeric = aVal !== "" && bVal !== "" && !isNaN(aNum) && !isNaN(bNum);
        let cmp;
        if (bothNumeric) {
          cmp = aNum - bNum;
        } else {
          cmp = aVal.localeCompare(bVal);
        }
        return ascending ? cmp : -cmp;
      });
      const newCells = {};
      const newStyles = {};
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
    applyFormat(property, value) {
      if (!this.selectionRange) return;
      this.pushUndo();
      const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
      for (let r = startRow; r <= endRow; r++) {
        if (!this.styles[r]) this.styles[r] = {};
        for (let c = startCol; c <= endCol; c++) {
          if (!this.styles[r][c]) this.styles[r][c] = {};
          switch (property) {
            case "fontFamily":
              this.styles[r][c].fontFamily = value;
              break;
            case "fontSize":
              this.styles[r][c].fontSize = value ? parseInt(value, 10) : void 0;
              break;
            case "textColor":
              this.styles[r][c].textColor = value;
              break;
            case "fillColor":
              this.styles[r][c].fillColor = value;
              break;
            case "alignment":
              this.styles[r][c].alignment = value;
              break;
            case "numberFormat":
              this.styles[r][c].numberFormat = value;
              break;
          }
        }
      }
      this.render();
    }
    toggleFormat(property) {
      if (!this.selectionRange) return;
      this.pushUndo();
      const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
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
          this.styles[r][c][property] = newValue;
        }
      }
      this.render();
    }
    // --- View Toggles ---
    toggleGridlines() {
      this._showGridlines = !this._showGridlines;
      this.render();
    }
    toggleHeaders() {
      this._showHeaders = !this._showHeaders;
      this.render();
    }
    freezePanes() {
      if (this._freezeRow > 0 || this._freezeCol > 0) {
        this._freezeRow = 0;
        this._freezeCol = 0;
      } else if (this.selectedCell) {
        this._freezeRow = this.selectedCell.row;
        this._freezeCol = this.selectedCell.col;
      }
      this.render();
    }
    // --- Undo / Redo ---
    undo() {
      if (this.undoStack.length === 0) return;
      this.redoStack.push(this.snapshot());
      const prev = this.undoStack.pop();
      this.restoreSnapshot(prev);
      this.render();
    }
    redo() {
      if (this.redoStack.length === 0) return;
      this.undoStack.push(this.snapshot());
      const next = this.redoStack.pop();
      this.restoreSnapshot(next);
      this.render();
    }
    pushUndo() {
      this.undoStack.push(this.snapshot());
      if (this.undoStack.length > this.maxUndoSize) {
        this.undoStack.shift();
      }
      this.redoStack = [];
    }
    snapshot() {
      return {
        data: JSON.parse(JSON.stringify(this.data)),
        styles: JSON.parse(JSON.stringify(this.styles))
      };
    }
    restoreSnapshot(snap) {
      this.data = snap.data;
      this.styles = snap.styles;
    }
    // --- Selection Data Helpers ---
    getSelectedCellValues() {
      if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return [];
      const sheet = this.data.sheets[this._activeSheetIndex];
      const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
      const values = [];
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
    getSelectedCellsData() {
      if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return "";
      const sheet = this.data.sheets[this._activeSheetIndex];
      const { startRow, startCol, endRow, endCol } = this.normalizeRange(this.selectionRange);
      const lines = [];
      for (let r = startRow; r <= endRow; r++) {
        const cells = [];
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.cells?.[r]?.[c];
          cells.push(cell?.value ?? "");
        }
        lines.push(cells.join("	"));
      }
      return lines.join("\n");
    }
    pasteData(text) {
      if (!this.selectedCell || !this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const lines = text.split("\n");
      const startRow = this.selectedCell.row;
      const startCol = this.selectedCell.col;
      for (let r = 0; r < lines.length; r++) {
        const cells = lines[r].split("	");
        for (let c = 0; c < cells.length; c++) {
          const row = startRow + r;
          const col = startCol + c;
          if (!sheet.cells[row]) sheet.cells[row] = {};
          const val = cells[c];
          const dataType = val.trim() !== "" && !isNaN(Number(val)) ? "n" : "s";
          sheet.cells[row][col] = { value: val, data_type: dataType };
          if (row >= sheet.row_count) sheet.row_count = row + 1;
          if (col >= sheet.col_count) sheet.col_count = col + 1;
        }
      }
      this.render();
    }
    // --- Event Handlers ---
    handleWheel(e) {
      e.preventDefault();
      if (e.shiftKey) {
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
    hitTestCell(e) {
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
    handleMouseDown(e) {
      const { x: mx, y: my } = this.mouseToCanvas(e);
      const sbHit = this.hitTestScrollbar(mx, my);
      if (sbHit) {
        e.preventDefault();
        const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
        const viewH = this.height - effHeaderHeight;
        const virtualH = this.getVirtualHeight();
        const vMaxScroll = virtualH - viewH;
        const clickRatio = (my - effHeaderHeight) / viewH;
        this.scrollTop = Math.max(0, Math.min(vMaxScroll, clickRatio * vMaxScroll));
        this._scrollbarDragStart = my;
        this._scrollbarDragScrollStart = this.scrollTop;
        this._scrollbarDragging = "v";
        this.render();
        return;
      }
      if (this._showHeaders) {
        const resizeTarget = this.hitTestResize(e);
        if (resizeTarget) {
          this._resizeDragging = resizeTarget.type;
          this._resizeIndex = resizeTarget.index;
          this._resizeStartPos = resizeTarget.type === "col" ? e.clientX : e.clientY;
          this._resizeStartSize = resizeTarget.type === "col" ? this.colWidths[resizeTarget.index] ?? this.colWidth : this.rowHeights[resizeTarget.index] ?? this.rowHeight;
          e.preventDefault();
          return;
        }
      }
      if (this._showHeaders) {
        const { x, y } = this.mouseToCanvas(e);
        if (y <= this.headerHeight && x > this.headerWidth) {
          const col2 = this.hitTestColHeader(x);
          if (col2 !== null) {
            this.commitCellEdit();
            this.selectedCell = { row: 0, col: col2 };
            this.selectionRange = { startRow: 0, startCol: col2, endRow: 999, endCol: col2 };
            this._headerDragMode = "col";
            this._isDragging = true;
            if (this.onSelectionChanged) this.onSelectionChanged(0, col2);
            this.render();
            return;
          }
        }
        if (x <= this.headerWidth && y > this.headerHeight) {
          const row2 = this.hitTestRowHeader(y);
          if (row2 !== null) {
            this.commitCellEdit();
            this.selectedCell = { row: row2, col: 0 };
            this.selectionRange = { startRow: row2, startCol: 0, endRow: row2, endCol: 99 };
            this._headerDragMode = "row";
            this._isDragging = true;
            if (this.onSelectionChanged) this.onSelectionChanged(row2, 0);
            this.render();
            return;
          }
        }
      }
      const cell = this.hitTestCell(e);
      if (!cell) return;
      const { row, col } = cell;
      if (this._formulaMode) {
        this._formulaDragAnchor = { row, col };
        this._formulaDragging = true;
        if (this.onFormulaRangeSelect) {
          this.onFormulaRangeSelect(row, col);
        }
        return;
      }
      this.commitCellEdit();
      this._headerDragMode = null;
      if (e.shiftKey && this.selectedCell) {
        this.selectionRange = {
          startRow: this.selectedCell.row,
          startCol: this.selectedCell.col,
          endRow: row,
          endCol: col
        };
      } else {
        this.selectedCell = { row, col };
        this.selectionRange = { startRow: row, startCol: col, endRow: row, endCol: col };
      }
      this._isDragging = true;
      if (this.onSelectionChanged) {
        this.onSelectionChanged(
          this.selectedCell.row,
          this.selectedCell.col
        );
      }
      this.render();
    }
    /** Hit test vertical scrollbar area on canvas. */
    hitTestScrollbar(canvasX, canvasY) {
      const sb = this._scrollbarSize;
      const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
      if (canvasX >= this.width - sb && canvasY >= effHeaderHeight) {
        return { axis: "v" };
      }
      return null;
    }
    /** Determine which column index a click in the column header area falls on */
    hitTestColHeader(canvasX) {
      const gridX = canvasX - this.headerWidth + this.scrollLeft;
      let cx = 0;
      let col = 0;
      while (cx < gridX + (this.colWidths[col] ?? this.colWidth)) {
        const w = this.colWidths[col] ?? this.colWidth;
        if (gridX >= cx && gridX < cx + w) return col;
        cx += w;
        col++;
        if (col > 16383) break;
      }
      return null;
    }
    /** Determine which row index a click in the row header area falls on */
    hitTestRowHeader(canvasY) {
      const gridY = canvasY - this.headerHeight + this.scrollTop;
      let cy = 0;
      let row = 0;
      while (cy < gridY + (this.rowHeights[row] ?? this.rowHeight)) {
        const h = this.rowHeights[row] ?? this.rowHeight;
        if (gridY >= cy && gridY < cy + h) return row;
        cy += h;
        row++;
        if (row > 1048575) break;
      }
      return null;
    }
    handleMouseMove(e) {
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
          const delta = e.clientY - rect.top - this._scrollbarDragStart;
          this.scrollTop = Math.max(0, Math.min(vMaxScroll, this._scrollbarDragScrollStart + delta / trackSpace * vMaxScroll));
        }
        requestAnimationFrame(() => this.render());
        return;
      }
      if (this._resizeDragging) {
        if (this._resizeDragging === "col") {
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
      if (!this._isDragging && !this._scrollbarDragging) {
        const { x: mx, y: my } = this.mouseToCanvas(e);
        if (this.hitTestScrollbar(mx, my)) {
          this.canvas.style.cursor = "default";
        } else if (this._showHeaders) {
          const resizeTarget = this.hitTestResize(e);
          if (resizeTarget) {
            this.canvas.style.cursor = resizeTarget.type === "col" ? "col-resize" : "row-resize";
          } else if (my <= this.headerHeight && mx > this.headerWidth) {
            this.canvas.style.cursor = "pointer";
          } else if (mx <= this.headerWidth && my > this.headerHeight) {
            this.canvas.style.cursor = "pointer";
          } else {
            this.canvas.style.cursor = "cell";
          }
        } else {
          this.canvas.style.cursor = "cell";
        }
      }
      if (this._formulaDragging && this._formulaDragAnchor) {
        const cell2 = this.hitTestCell(e);
        if (cell2 && this.onFormulaRangeDrag) {
          this.onFormulaRangeDrag(
            this._formulaDragAnchor.row,
            this._formulaDragAnchor.col,
            cell2.row,
            cell2.col
          );
        }
        return;
      }
      if (!this._isDragging || !this.selectedCell || !this.selectionRange) return;
      if (this._headerDragMode) {
        const { x, y } = this.mouseToCanvas(e);
        if (this._headerDragMode === "col") {
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
      if (cell.row !== this.selectionRange.endRow || cell.col !== this.selectionRange.endCol) {
        this.selectionRange.endRow = cell.row;
        this.selectionRange.endCol = cell.col;
        this.render();
      }
    }
    handleMouseUp() {
      if (this._scrollbarDragging) {
        this._scrollbarDragging = null;
        this.render();
        return;
      }
      if (this._resizeDragging) {
        this._resizeDragging = null;
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
    hitTestResize(e) {
      const { x, y } = this.mouseToCanvas(e);
      const threshold = 5;
      this.ensureLayout();
      if (y < this.headerHeight && x > this.headerWidth) {
        let col = 0;
        while (col < this._colPos.length - 1 && this._colPos[col + 1] <= this.scrollLeft) col++;
        while (col < this._colPos.length - 1) {
          const borderX = this.headerWidth + this._colPos[col + 1] - this.scrollLeft;
          if (borderX > this.width + threshold) break;
          if (Math.abs(x - borderX) < threshold) {
            return { type: "col", index: col };
          }
          col++;
        }
      }
      if (x < this.headerWidth && y > this.headerHeight) {
        let row = 0;
        while (row < this._rowPos.length - 1 && this._rowPos[row + 1] <= this.scrollTop) row++;
        while (row < this._rowPos.length - 1) {
          const borderY = this.headerHeight + this._rowPos[row + 1] - this.scrollTop;
          if (borderY > this.height + threshold) break;
          if (Math.abs(y - borderY) < threshold) {
            return { type: "row", index: row };
          }
          row++;
        }
      }
      return null;
    }
    handleContextMenu(e) {
      e.preventDefault();
      const { x, y } = this.mouseToCanvas(e);
      const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
      const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
      if (this._showHeaders && y <= this.headerHeight && x > this.headerWidth) {
        const col = this.hitTestColHeader(x);
        if (col !== null) {
          this.selectedCell = { row: 0, col };
          this.selectionRange = { startRow: 0, startCol: col, endRow: 999, endCol: col };
          this.render();
          if (this.onContextMenu) {
            this.onContextMenu(0, col, e.clientX, e.clientY, "col");
          }
        }
        return;
      }
      if (this._showHeaders && x <= this.headerWidth && y > this.headerHeight) {
        const row = this.hitTestRowHeader(y);
        if (row !== null) {
          this.selectedCell = { row, col: 0 };
          this.selectionRange = { startRow: row, startCol: 0, endRow: row, endCol: 99 };
          this.render();
          if (this.onContextMenu) {
            this.onContextMenu(row, 0, e.clientX, e.clientY, "row");
          }
        }
        return;
      }
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
    isInsideSelection(row, col) {
      if (!this.selectionRange) return false;
      const n = this.normalizeRange(this.selectionRange);
      return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
    }
    handleKeyDown(e) {
      if (!this.selectedCell) return;
      const { row, col } = this.selectedCell;
      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          let newRow = e.key === "ArrowUp" ? Math.max(0, row - 1) : e.key === "ArrowDown" ? row + 1 : row;
          let newCol = e.key === "ArrowLeft" ? Math.max(0, col - 1) : e.key === "ArrowRight" ? col + 1 : col;
          if (e.shiftKey && this.selectionRange) {
            const endRow = e.key === "ArrowUp" ? Math.max(0, this.selectionRange.endRow - 1) : e.key === "ArrowDown" ? this.selectionRange.endRow + 1 : this.selectionRange.endRow;
            const endCol = e.key === "ArrowLeft" ? Math.max(0, this.selectionRange.endCol - 1) : e.key === "ArrowRight" ? this.selectionRange.endCol + 1 : this.selectionRange.endCol;
            this.selectionRange.endRow = endRow;
            this.selectionRange.endCol = endCol;
            this.scrollIntoView(endRow, endCol);
          } else {
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
        case "Delete":
        case "Backspace":
          e.preventDefault();
          this.clearSelectedCells();
          if (this.onCellEdit) this.onCellEdit(row, col, "");
          return;
        case "Enter":
          e.preventDefault();
          this.startCellEdit(row, col);
          return;
        case "F2":
          e.preventDefault();
          this.startCellEdit(row, col);
          return;
        case "Escape":
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
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.startCellEdit(row, col, e.key);
          }
          return;
      }
    }
    scrollIntoView(row, col) {
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
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.width = Math.round(rect.width);
        this.height = Math.round(rect.height);
      } else {
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
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(0, 0, this.width, this.height);
      if (this._loading) {
        this.ctx.fillStyle = "#888";
        this.ctx.font = "14px system-ui, -apple-system, sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("Loading...", this.width / 2, this.height / 2);
        return;
      }
      if (!this.data || !this.data.sheets || this.data.sheets.length === 0) {
        this.ctx.fillStyle = "#888";
        this.ctx.font = "14px system-ui, -apple-system, sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("No data to display. Open an XLSX file or start typing.", this.width / 2, this.height / 2);
        return;
      }
      const sheet = this.data.sheets[this._activeSheetIndex];
      const effHeaderWidth = this._showHeaders ? this.headerWidth : 0;
      const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
      this.ensureLayout();
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
      this.ctx.textBaseline = "middle";
      this.ctx.lineWidth = 1;
      for (let r = startRow; r < endRow; r++) {
        const cellH = this.rh(r);
        const y = this.ry(r) - this.scrollTop + effHeaderHeight;
        if (y < effHeaderHeight - cellH) continue;
        for (let c = startCol; c < endCol; c++) {
          const cellW = this.cw(c);
          const x = this.cx(c) - this.scrollLeft + effHeaderWidth;
          if (x < effHeaderWidth - cellW) continue;
          const cellStyle = this.getCellStyle(r, c);
          if (cellStyle?.fillColor && cellStyle.fillColor !== "#ffffff") {
            this.ctx.fillStyle = cellStyle.fillColor;
            this.ctx.fillRect(x, y, cellW, cellH);
          }
          if (this._showGridlines) {
            this.ctx.strokeStyle = "#e0e0e0";
            this.ctx.strokeRect(x, y, cellW, cellH);
          }
          if (this.selectionRange) {
            const norm = this.normalizeRange(this.selectionRange);
            if (r >= norm.startRow && r <= norm.endRow && c >= norm.startCol && c <= norm.endCol) {
              const isAnchor = this.selectedCell && r === this.selectedCell.row && c === this.selectedCell.col;
              if (!isAnchor) {
                this.ctx.fillStyle = "rgba(0, 120, 215, 0.12)";
                this.ctx.fillRect(x, y, cellW, cellH);
              }
            }
          }
          if (this.selectedCell && r === this.selectedCell.row && c === this.selectedCell.col) {
            this.ctx.strokeStyle = "#0078d7";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
            this.ctx.lineWidth = 1;
          }
          const rowData = sheet.cells[r];
          let cellValue = "";
          if (rowData) {
            const cellData = rowData[c];
            if (cellData) {
              if (cellData.value && cellData.value.startsWith("=")) {
                const formulaResult = this.formulaResults[`${r}:${c}`];
                cellValue = formulaResult ? formulaResult.display : cellData.value;
              } else {
                cellValue = this.formatCellValue(cellData.value, cellData.data_type, cellStyle);
              }
            }
          }
          if (cellValue) {
            const fontSize = cellStyle?.fontSize || 13;
            const fontFamily = cellStyle?.fontFamily || "system-ui, -apple-system, sans-serif";
            let fontStr = `${fontSize}px ${fontFamily}`;
            if (cellStyle?.bold) fontStr = `bold ${fontStr}`;
            if (cellStyle?.italic) fontStr = `italic ${fontStr}`;
            this.ctx.font = fontStr;
            this.ctx.fillStyle = cellStyle?.textColor || "#000";
            this.ctx.textAlign = cellStyle?.alignment || "left";
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(x + 1, y + 1, cellW - 2, cellH - 2);
            this.ctx.clip();
            let textX = x + 4;
            if (cellStyle?.alignment === "center") textX = x + cellW / 2;
            else if (cellStyle?.alignment === "right") textX = x + cellW - 4;
            const textY = y + cellH / 2;
            this.ctx.fillText(cellValue, textX, textY);
            if (cellStyle?.underline) {
              const metrics = this.ctx.measureText(cellValue);
              const lineY = textY + fontSize * 0.15;
              this.ctx.beginPath();
              this.ctx.strokeStyle = cellStyle.textColor || "#000";
              this.ctx.lineWidth = 1;
              if (cellStyle.alignment === "center") {
                this.ctx.moveTo(textX - metrics.width / 2, lineY);
                this.ctx.lineTo(textX + metrics.width / 2, lineY);
              } else if (cellStyle.alignment === "right") {
                this.ctx.moveTo(textX - metrics.width, lineY);
                this.ctx.lineTo(textX, lineY);
              } else {
                this.ctx.moveTo(textX, lineY);
                this.ctx.lineTo(textX + metrics.width, lineY);
              }
              this.ctx.stroke();
            }
            if (cellStyle?.strikethrough) {
              const metrics = this.ctx.measureText(cellValue);
              this.ctx.beginPath();
              this.ctx.strokeStyle = cellStyle.textColor || "#000";
              this.ctx.lineWidth = 1;
              if (cellStyle.alignment === "center") {
                this.ctx.moveTo(textX - metrics.width / 2, textY);
                this.ctx.lineTo(textX + metrics.width / 2, textY);
              } else if (cellStyle.alignment === "right") {
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
      for (const table of this.tables) {
        const tr = table.range;
        const tc = getTableColors(table.style_name);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
        this.ctx.clip();
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
              this.ctx.globalAlpha = 1;
            }
          }
        }
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
              this.ctx.globalAlpha = 1;
            }
          }
        }
        if (table.has_header_row) {
          const hdrRowH = this.rh(tr.start_row);
          const hdrY = this.ry(tr.start_row) - this.scrollTop + effHeaderHeight;
          const hdrX = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
          const hdrW = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
          this.ctx.fillStyle = tc.header;
          this.ctx.fillRect(hdrX, hdrY, hdrW, hdrRowH);
          this.ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
          this.ctx.fillStyle = tc.headerText;
          this.ctx.textAlign = "left";
          this.ctx.textBaseline = "middle";
          for (let c = tr.start_col; c <= tr.end_col; c++) {
            const colCx = this.cx(c) - this.scrollLeft + effHeaderWidth + 4;
            const colCy = hdrY + hdrRowH / 2;
            const colDef = table.columns[c - tr.start_col];
            if (colDef) {
              this.ctx.fillText(colDef.name, colCx, colCy);
            }
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
        if (table.has_totals_row) {
          const totRowH = this.rh(tr.end_row);
          const totY = this.ry(tr.end_row) - this.scrollTop + effHeaderHeight;
          const totX = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
          const totW = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
          this.ctx.fillStyle = tc.band;
          this.ctx.globalAlpha = 0.6;
          this.ctx.fillRect(totX, totY, totW, totRowH);
          this.ctx.globalAlpha = 1;
          this.ctx.strokeStyle = tc.header;
          this.ctx.globalAlpha = 0.7;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(totX, totY);
          this.ctx.lineTo(totX + totW, totY);
          this.ctx.stroke();
          this.ctx.lineWidth = 1;
          this.ctx.globalAlpha = 1;
        }
        const tblX = this.cx(tr.start_col) - this.scrollLeft + effHeaderWidth;
        const tblY = this.ry(tr.start_row) - this.scrollTop + effHeaderHeight;
        const tblW = this.cx(tr.end_col + 1) - this.cx(tr.start_col);
        const tblH = this.ry(tr.end_row + 1) - this.ry(tr.start_row);
        this.ctx.strokeStyle = tc.border;
        this.ctx.globalAlpha = 0.7;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(tblX, tblY, tblW, tblH);
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
      }
      for (const mc of this.mergedCells) {
        const mcX = this.cx(mc.startCol) - this.scrollLeft + effHeaderWidth;
        const mcY = this.ry(mc.startRow) - this.scrollTop + effHeaderHeight;
        const mcW = this.cx(mc.endCol + 1) - this.cx(mc.startCol);
        const mcH = this.ry(mc.endRow + 1) - this.ry(mc.startRow);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
        this.ctx.clip();
        const cellStyle = this.getCellStyle(mc.startRow, mc.startCol);
        this.ctx.fillStyle = cellStyle?.fillColor || "#ffffff";
        this.ctx.fillRect(mcX, mcY, mcW, mcH);
        if (this._showGridlines) {
          this.ctx.strokeStyle = "#e0e0e0";
          this.ctx.strokeRect(mcX, mcY, mcW, mcH);
        }
        const mcRowData = sheet.cells[mc.startRow];
        if (mcRowData) {
          const mcCellData = mcRowData[mc.startCol];
          if (mcCellData) {
            const mcValue = mcCellData.value?.startsWith("=") ? this.formulaResults[`${mc.startRow}:${mc.startCol}`]?.display ?? mcCellData.value : this.formatCellValue(mcCellData.value, mcCellData.data_type, cellStyle);
            if (mcValue) {
              const fontSize = cellStyle?.fontSize || 13;
              const fontFamily = cellStyle?.fontFamily || "system-ui, -apple-system, sans-serif";
              let fontStr = `${fontSize}px ${fontFamily}`;
              if (cellStyle?.bold) fontStr = `bold ${fontStr}`;
              if (cellStyle?.italic) fontStr = `italic ${fontStr}`;
              this.ctx.font = fontStr;
              this.ctx.fillStyle = cellStyle?.textColor || "#000";
              this.ctx.textAlign = cellStyle?.alignment || "left";
              this.ctx.textBaseline = "middle";
              this.ctx.beginPath();
              this.ctx.rect(mcX + 1, mcY + 1, mcW - 2, mcH - 2);
              this.ctx.clip();
              let textX = mcX + 4;
              if (cellStyle?.alignment === "center") textX = mcX + mcW / 2;
              else if (cellStyle?.alignment === "right") textX = mcX + mcW - 4;
              const textY = mcY + mcH / 2;
              this.ctx.fillText(mcValue, textX, textY);
            }
          }
        }
        this.ctx.restore();
      }
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
            this.ctx.fillStyle = "rgba(255, 165, 0, 0.35)";
          } else {
            this.ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
          }
          this.ctx.fillRect(fmX, fmY, this.cw(fm.col), this.rh(fm.row));
        }
        this.ctx.restore();
      }
      if (this._showHeaders) {
        const selNorm = this.selectionRange ? this.normalizeRange(this.selectionRange) : null;
        this.ctx.fillStyle = "#f3f3f3";
        this.ctx.fillRect(0, this.headerHeight, this.headerWidth, this.height - this.headerHeight);
        this.ctx.strokeStyle = "#cccccc";
        this.ctx.beginPath();
        this.ctx.moveTo(this.headerWidth, 0);
        this.ctx.lineTo(this.headerWidth, this.height);
        this.ctx.stroke();
        this.ctx.font = "12px system-ui, -apple-system, sans-serif";
        for (let r = startRow; r < endRow; r++) {
          const rowH = this.rh(r);
          const y = this.ry(r) - this.scrollTop + this.headerHeight;
          if (y < this.headerHeight) continue;
          const rowSelected = selNorm && r >= selNorm.startRow && r <= selNorm.endRow;
          if (rowSelected) {
            this.ctx.fillStyle = "#dce6f1";
            this.ctx.fillRect(0, y, this.headerWidth, rowH);
            this.ctx.fillStyle = "#0a5296";
          } else {
            this.ctx.fillStyle = "#333";
          }
          this.ctx.textAlign = "center";
          this.ctx.fillText((r + 1).toString(), this.headerWidth / 2, y + rowH / 2);
          this.ctx.strokeStyle = "#cccccc";
          this.ctx.beginPath();
          this.ctx.moveTo(0, y + rowH);
          this.ctx.lineTo(this.headerWidth, y + rowH);
          this.ctx.stroke();
        }
        this.ctx.fillStyle = "#f3f3f3";
        this.ctx.fillRect(this.headerWidth, 0, this.width - this.headerWidth, this.headerHeight);
        this.ctx.strokeStyle = "#cccccc";
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.headerHeight);
        this.ctx.lineTo(this.width, this.headerHeight);
        this.ctx.stroke();
        for (let c = startCol; c < endCol; c++) {
          const colW = this.cw(c);
          const x = this.cx(c) - this.scrollLeft + this.headerWidth;
          if (x < this.headerWidth) continue;
          const colSelected = selNorm && c >= selNorm.startCol && c <= selNorm.endCol;
          if (colSelected) {
            this.ctx.fillStyle = "#dce6f1";
            this.ctx.fillRect(x, 0, colW, this.headerHeight);
            this.ctx.fillStyle = "#0a5296";
          } else {
            this.ctx.fillStyle = "#333";
          }
          this.ctx.textAlign = "center";
          this.ctx.fillText(this.getColName(c), x + colW / 2, this.headerHeight / 2);
          this.ctx.strokeStyle = "#cccccc";
          this.ctx.beginPath();
          this.ctx.moveTo(x + colW, 0);
          this.ctx.lineTo(x + colW, this.headerHeight);
          this.ctx.stroke();
        }
        this.ctx.fillStyle = "#e0e0e0";
        this.ctx.fillRect(0, 0, this.headerWidth, this.headerHeight);
        this.ctx.strokeStyle = "#cccccc";
        this.ctx.strokeRect(0, 0, this.headerWidth, this.headerHeight);
      }
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
          this.ctx.fillStyle = fRange.color + "20";
          this.ctx.fillRect(frx, fry, frw, frh);
          this.ctx.strokeStyle = fRange.color;
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([5, 3]);
          this.ctx.strokeRect(frx, fry, frw, frh);
          this.ctx.setLineDash([]);
        }
        this.ctx.restore();
      }
      if (this.selectionRange) {
        const norm = this.normalizeRange(this.selectionRange);
        const selX = this.cx(norm.startCol) - this.scrollLeft + effHeaderWidth;
        const selY = this.ry(norm.startRow) - this.scrollTop + effHeaderHeight;
        const selW = this.cx(norm.endCol + 1) - this.cx(norm.startCol);
        const selH = this.ry(norm.endRow + 1) - this.ry(norm.startRow);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
        this.ctx.clip();
        this.ctx.strokeStyle = "#0078d7";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(selX, selY, selW, selH);
        this.ctx.lineWidth = 1;
        const handleSize = 6;
        const handleX = selX + selW - handleSize / 2;
        const handleY = selY + selH - handleSize / 2;
        this.ctx.fillStyle = "#0078d7";
        this.ctx.fillRect(handleX, handleY, handleSize, handleSize);
        this.ctx.restore();
      }
      if (this._freezeRow > 0 || this._freezeCol > 0) {
        if (this._freezeRow > 0) {
          const frozenRowsH = this.ry(this._freezeRow);
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, frozenRowsH);
          this.ctx.clip();
          this.ctx.fillStyle = "#ffffff";
          this.ctx.fillRect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, frozenRowsH);
          for (let r = 0; r < this._freezeRow; r++) {
            const frzRowH = this.rh(r);
            const y = this.ry(r) + effHeaderHeight;
            for (let c = startCol; c < endCol; c++) {
              const frzColW = this.cw(c);
              const x = this.cx(c) - this.scrollLeft + effHeaderWidth;
              if (this._showGridlines) {
                this.ctx.strokeStyle = "#e0e0e0";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, frzColW, frzRowH);
              }
              const rowData = sheet.cells[r];
              if (rowData) {
                const cellData = rowData[c];
                if (cellData) {
                  const cv = cellData.value?.startsWith("=") ? this.formulaResults[`${r}:${c}`]?.display ?? cellData.value : cellData.value;
                  if (cv) {
                    this.ctx.font = "13px system-ui, -apple-system, sans-serif";
                    this.ctx.fillStyle = "#000";
                    this.ctx.textAlign = "left";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(cv, x + 4, y + frzRowH / 2);
                  }
                }
              }
            }
          }
          this.ctx.restore();
        }
        if (this._freezeCol > 0) {
          const frozenColsW = this.cx(this._freezeCol);
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(effHeaderWidth, effHeaderHeight, frozenColsW, this.height - effHeaderHeight);
          this.ctx.clip();
          this.ctx.fillStyle = "#ffffff";
          this.ctx.fillRect(effHeaderWidth, effHeaderHeight, frozenColsW, this.height - effHeaderHeight);
          for (let r = startRow; r < endRow; r++) {
            const frzRH = this.rh(r);
            const y = this.ry(r) - this.scrollTop + effHeaderHeight;
            for (let c = 0; c < this._freezeCol; c++) {
              const frzCW = this.cw(c);
              const x = this.cx(c) + effHeaderWidth;
              if (this._showGridlines) {
                this.ctx.strokeStyle = "#e0e0e0";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, frzCW, frzRH);
              }
              const rowData = sheet.cells[r];
              if (rowData) {
                const cellData = rowData[c];
                if (cellData) {
                  const cv = cellData.value?.startsWith("=") ? this.formulaResults[`${r}:${c}`]?.display ?? cellData.value : cellData.value;
                  if (cv) {
                    this.ctx.font = "13px system-ui, -apple-system, sans-serif";
                    this.ctx.fillStyle = "#000";
                    this.ctx.textAlign = "left";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(cv, x + 4, y + frzRH / 2);
                  }
                }
              }
            }
          }
          this.ctx.restore();
        }
        if (this._freezeRow > 0 && this._freezeCol > 0) {
          const cornerW = this.cx(this._freezeCol);
          const cornerH = this.ry(this._freezeRow);
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(effHeaderWidth, effHeaderHeight, cornerW, cornerH);
          this.ctx.clip();
          this.ctx.fillStyle = "#ffffff";
          this.ctx.fillRect(effHeaderWidth, effHeaderHeight, cornerW, cornerH);
          for (let r = 0; r < this._freezeRow; r++) {
            const crnRH = this.rh(r);
            const y = this.ry(r) + effHeaderHeight;
            for (let c = 0; c < this._freezeCol; c++) {
              const crnCW = this.cw(c);
              const x = this.cx(c) + effHeaderWidth;
              if (this._showGridlines) {
                this.ctx.strokeStyle = "#e0e0e0";
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, crnCW, crnRH);
              }
              const rowData = sheet.cells[r];
              if (rowData) {
                const cellData = rowData[c];
                if (cellData) {
                  const cv = cellData.value ?? "";
                  if (cv) {
                    this.ctx.font = "13px system-ui, -apple-system, sans-serif";
                    this.ctx.fillStyle = "#000";
                    this.ctx.textAlign = "left";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(cv, x + 4, y + crnRH / 2);
                  }
                }
              }
            }
          }
          this.ctx.restore();
        }
        if (this._freezeRow > 0) {
          const freezeY = this.ry(this._freezeRow) + effHeaderHeight;
          this.ctx.strokeStyle = "#0078d7";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(0, freezeY);
          this.ctx.lineTo(this.width, freezeY);
          this.ctx.stroke();
          this.ctx.lineWidth = 1;
        }
        if (this._freezeCol > 0) {
          const freezeX = this.cx(this._freezeCol) + effHeaderWidth;
          this.ctx.strokeStyle = "#0078d7";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(freezeX, 0);
          this.ctx.lineTo(freezeX, this.height);
          this.ctx.stroke();
          this.ctx.lineWidth = 1;
        }
      }
      this.drawScrollbars();
      this.ctx.restore();
    }
    drawScrollbars() {
      const sb = this._scrollbarSize;
      const minThumb = this._scrollbarMinThumb;
      const virtualH = this.getVirtualHeight();
      const effHeaderHeight = this._showHeaders ? this.headerHeight : 0;
      const viewH = this.height - effHeaderHeight;
      const vTrackTop = effHeaderHeight;
      const vTrackHeight = viewH;
      this.ctx.fillStyle = "#e8e8e8";
      this.ctx.fillRect(this.width - sb, vTrackTop, sb, vTrackHeight);
      this.ctx.strokeStyle = "#ccc";
      this.ctx.beginPath();
      this.ctx.moveTo(this.width - sb, vTrackTop);
      this.ctx.lineTo(this.width - sb, vTrackTop + vTrackHeight);
      this.ctx.stroke();
      const vRatio = Math.min(1, viewH / virtualH);
      const vThumbH = Math.max(minThumb, vTrackHeight * vRatio);
      const vMaxScroll = virtualH - viewH;
      const vThumbTop = vMaxScroll > 0 ? vTrackTop + this.scrollTop / vMaxScroll * (vTrackHeight - vThumbH) : vTrackTop;
      this.ctx.fillStyle = this._scrollbarDragging === "v" ? "#666" : "#999";
      this.ctx.beginPath();
      this.roundRect(this.width - sb + 2, vThumbTop + 1, sb - 4, vThumbH - 2, 4);
      this.ctx.fill();
    }
    /** Draw a rounded rectangle path */
    roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.ctx.moveTo(x + r, y);
      this.ctx.arcTo(x + w, y, x + w, y + h, r);
      this.ctx.arcTo(x + w, y + h, x, y + h, r);
      this.ctx.arcTo(x, y + h, x, y, r);
      this.ctx.arcTo(x, y, x + w, y, r);
      this.ctx.closePath();
    }
    // --- Number Formatting ---
    formatCellValue(value, dataType, style) {
      if (!style?.numberFormat || style.numberFormat === "General" || style.numberFormat === "@") {
        return value;
      }
      const num = Number(value);
      if (isNaN(num) || dataType !== "n") return value;
      const fmt = style.numberFormat;
      switch (fmt) {
        case "Number":
          return num.toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        case "Currency":
          return "$" + num.toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        case "Percentage":
          return (num * 100).toFixed(2) + "%";
        case "Text":
          return value;
        case "Date": {
          const epoch = new Date(1899, 11, 30);
          const date = new Date(epoch.getTime() + num * 864e5);
          return date.toLocaleDateString();
        }
      }
      if (fmt.includes("%")) {
        const decMatch = fmt.match(/0\.(0+)%/);
        const decimals = decMatch ? decMatch[1].length : 0;
        return (num * 100).toFixed(decimals) + "%";
      }
      if (fmt.match(/[mdy]/i) && !fmt.includes("#") && !fmt.includes("0")) {
        const epoch = new Date(1899, 11, 30);
        const date = new Date(epoch.getTime() + num * 864e5);
        return date.toLocaleDateString();
      }
      if (fmt.includes("$") || fmt.includes("\u20AC") || fmt.includes("\xA3")) {
        const decMatch = fmt.match(/0\.(0+)/);
        const decimals = decMatch ? decMatch[1].length : 2;
        const symbol = fmt.includes("\u20AC") ? "\u20AC" : fmt.includes("\xA3") ? "\xA3" : "$";
        return symbol + num.toLocaleString(void 0, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
      if (fmt.includes("#,##0") || fmt.includes(",")) {
        const decMatch = fmt.match(/0\.(0+)/);
        const decimals = decMatch ? decMatch[1].length : 0;
        return num.toLocaleString(void 0, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
      if (fmt.match(/^0\.(0+)$/)) {
        const decimals = fmt.split(".")[1].length;
        return num.toFixed(decimals);
      }
      if (fmt.includes("E+") || fmt.includes("E-")) {
        return num.toExponential(2);
      }
      return value;
    }
    // --- Inline Cell Editing ---
    handleDoubleClick(e) {
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
    startCellEdit(row, col, initialChar) {
      this.commitCellEdit();
      let currentValue = "";
      if (!initialChar && this.data?.sheets?.[this._activeSheetIndex]?.cells?.[row]?.[col]) {
        currentValue = this.data.sheets[this._activeSheetIndex].cells[row][col].value;
      }
      if (!this.editInput) {
        this.editInput = document.createElement("input");
        this.editInput.style.position = "absolute";
        this.editInput.style.outline = "none";
        this.editInput.style.padding = "0 4px";
        this.editInput.style.boxSizing = "border-box";
        this.editInput.style.zIndex = "10";
        this.editInput.style.border = "2px solid var(--vscode-focusBorder, #007acc)";
        this.editInput.style.background = "var(--vscode-input-background, #3c3c3c)";
        this.editInput.style.color = "var(--vscode-input-foreground, #ccc)";
        this.editInput.style.font = "13px var(--vscode-font-family, system-ui, -apple-system, sans-serif)";
        this.editInput.style.borderRadius = "1px";
        this.canvas.parentElement?.appendChild(this.editInput);
        this.editInput.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            this.commitCellEdit();
          } else if (e.key === "Escape") {
            this.cancelCellEdit();
          } else if (e.key === "Tab") {
            e.preventDefault();
            const cell = this.editingCell;
            this.commitCellEdit();
            if (cell) {
              const nextCol = e.shiftKey ? Math.max(0, cell.col - 1) : cell.col + 1;
              this.startCellEdit(cell.row, nextCol);
            }
          }
        });
        this.editInput.addEventListener("blur", () => {
          setTimeout(() => {
            if (this.editingCell) {
              this.commitCellEdit();
            }
          }, 100);
        });
        this.editInput.addEventListener("input", () => {
          if (this.onInlineEditInput && this.editInput) {
            this.onInlineEditInput(this.editInput.value);
          }
          const formulaInputEl2 = document.getElementById("formula-input");
          if (formulaInputEl2 && this.editInput) {
            formulaInputEl2.value = this.editInput.value;
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
      this.editInput.style.display = "block";
      if (initialChar) {
        this.editInput.value = initialChar;
        this.editInput.focus();
        this.editInput.setSelectionRange(initialChar.length, initialChar.length);
      } else {
        this.editInput.value = currentValue;
        this.editInput.focus();
        this.editInput.select();
      }
      this.editingCell = { row, col };
      const finalValue = this.editInput.value;
      if (this.onInlineEditInput) {
        this.onInlineEditInput(finalValue);
      }
      const formulaInputEl = document.getElementById("formula-input");
      if (formulaInputEl) {
        formulaInputEl.value = finalValue;
      }
    }
    commitCellEdit() {
      if (!this.editInput || !this.editingCell) return;
      const { row, col } = this.editingCell;
      const newValue = this.editInput.value;
      const dataType = newValue.startsWith("=") ? "s" : newValue.trim() !== "" && !isNaN(Number(newValue)) ? "n" : "s";
      this.updateCell(row, col, newValue, dataType);
      if (this.onCellEdit) {
        this.onCellEdit(row, col, newValue);
      }
      if (this.onInlineEditCommit) {
        this.onInlineEditCommit();
      }
      this.editInput.style.display = "none";
      this.editingCell = null;
      this.canvas.focus();
    }
    cancelCellEdit() {
      if (!this.editInput) return;
      if (this.onInlineEditCancel) {
        this.onInlineEditCancel();
      }
      this.editInput.style.display = "none";
      this.editingCell = null;
      this.canvas.focus();
    }
    /** Get the cell currently being edited inline, or null */
    getEditingCell() {
      return this.editingCell;
    }
    /** Get the current inline editor value */
    getEditInputValue() {
      return this.editInput?.value ?? "";
    }
    /** Set the inline editor value (e.g., during point-mode reference insertion) */
    setEditInputValue(value, cursorPos) {
      if (this.editInput) {
        this.editInput.value = value;
        if (cursorPos !== void 0) {
          this.editInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
    /** Get the inline editor cursor position */
    getEditInputCursor() {
      return this.editInput?.selectionStart ?? 0;
    }
    // --- Helpers ---
    getCellStyle(row, col) {
      const overlay = this.styles[row]?.[col];
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      const modelStyle = sheet?.cells?.[row]?.[col]?.style;
      if (!modelStyle && !overlay) return overlay;
      const merged = {};
      if (modelStyle) {
        if (modelStyle.bold) merged.bold = true;
        if (modelStyle.italic) merged.italic = true;
        if (modelStyle.underline) merged.underline = true;
        if (modelStyle.font_size) merged.fontSize = modelStyle.font_size;
        if (modelStyle.font_family) merged.fontFamily = modelStyle.font_family;
        if (modelStyle.text_color) merged.textColor = modelStyle.text_color;
        if (modelStyle.fill_color) merged.fillColor = modelStyle.fill_color;
        if (modelStyle.alignment) merged.alignment = modelStyle.alignment;
        if (modelStyle.number_format) merged.numberFormat = modelStyle.number_format;
        if (modelStyle.wrap_text) merged.wrapText = true;
      }
      if (overlay) {
        if (overlay.bold !== void 0) merged.bold = overlay.bold;
        if (overlay.italic !== void 0) merged.italic = overlay.italic;
        if (overlay.underline !== void 0) merged.underline = overlay.underline;
        if (overlay.fontSize !== void 0) merged.fontSize = overlay.fontSize;
        if (overlay.fontFamily !== void 0) merged.fontFamily = overlay.fontFamily;
        if (overlay.textColor !== void 0) merged.textColor = overlay.textColor;
        if (overlay.fillColor !== void 0) merged.fillColor = overlay.fillColor;
        if (overlay.alignment !== void 0) merged.alignment = overlay.alignment;
        if (overlay.numberFormat !== void 0) merged.numberFormat = overlay.numberFormat;
        if (overlay.wrapText !== void 0) merged.wrapText = overlay.wrapText;
      }
      return merged;
    }
    normalizeRange(range) {
      return {
        startRow: Math.min(range.startRow, range.endRow),
        startCol: Math.min(range.startCol, range.endCol),
        endRow: Math.max(range.startRow, range.endRow),
        endCol: Math.max(range.startCol, range.endCol)
      };
    }
    getColName(n) {
      let s = "";
      let idx = n;
      while (idx >= 0) {
        s = String.fromCharCode(idx % 26 + 65) + s;
        idx = Math.floor(idx / 26) - 1;
      }
      return s;
    }
    /** Total virtual content width in pixels (drives horizontal scrollbar) */
    getVirtualWidth() {
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      let maxDataCol = 0;
      if (sheet?.cells) {
        for (const rowKey of Object.keys(sheet.cells)) {
          for (const colKey of Object.keys(sheet.cells[Number(rowKey)])) {
            maxDataCol = Math.max(maxDataCol, Number(colKey));
          }
        }
      }
      const totalCols = Math.max(100, maxDataCol + 10);
      this.ensureLayout(totalCols);
      return this.cx(totalCols);
    }
    /** Total virtual content height in pixels (drives vertical scrollbar) */
    getVirtualHeight() {
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      let maxDataRow = 0;
      if (sheet?.cells) {
        for (const rowKey of Object.keys(sheet.cells)) {
          maxDataRow = Math.max(maxDataRow, Number(rowKey));
        }
      }
      const totalRows = Math.max(1e3, maxDataRow + 50);
      this.ensureLayout(void 0, totalRows);
      return this.ry(totalRows);
    }
    // --- Column/Row Dimensions ---
    getColWidth(col) {
      return this.colWidths[col] ?? this.colWidth;
    }
    getRowHeight(row) {
      return this.rowHeights[row] ?? this.rowHeight;
    }
    setColWidth(col, width) {
      this.colWidths[col] = Math.max(20, Math.round(width));
      this._layoutDirty = true;
      this.render();
    }
    setRowHeight(row, height) {
      this.rowHeights[row] = Math.max(10, Math.round(height));
      this._layoutDirty = true;
      this.render();
    }
    /** Get the X pixel offset for a column, accounting for variable widths */
    getColX(col) {
      let x = 0;
      for (let c = 0; c < col; c++) {
        x += this.colWidths[c] ?? this.colWidth;
      }
      return x;
    }
    /** Get the Y pixel offset for a row, accounting for variable heights */
    getRowY(row) {
      let y = 0;
      for (let r = 0; r < row; r++) {
        y += this.rowHeights[r] ?? this.rowHeight;
      }
      return y;
    }
    // --- Merged Cells ---
    getMergedCells() {
      return this.mergedCells;
    }
    /** Check if a cell is part of a merged region. Returns the merge region or null. */
    getMergeAtCell(row, col) {
      for (const m of this.mergedCells) {
        if (row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol) {
          return m;
        }
      }
      return null;
    }
    /** Add a merge region for the current selection */
    mergeCellsSelection() {
      if (!this.selectionRange || !this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const norm = this.normalizeRange(this.selectionRange);
      const existing = this.mergedCells.findIndex(
        (m) => m.startRow === norm.startRow && m.startCol === norm.startCol && m.endRow === norm.endRow && m.endCol === norm.endCol
      );
      if (existing >= 0) {
        this.mergedCells.splice(existing, 1);
      } else {
        this.mergedCells = this.mergedCells.filter(
          (m) => m.endRow < norm.startRow || m.startRow > norm.endRow || m.endCol < norm.startCol || m.startCol > norm.endCol
        );
        this.mergedCells.push({
          startRow: norm.startRow,
          startCol: norm.startCol,
          endRow: norm.endRow,
          endCol: norm.endCol
        });
      }
      const sheet = this.data.sheets[this._activeSheetIndex];
      sheet.merged_cells = this.mergedCells.map((m) => ({
        start_row: m.startRow,
        start_col: m.startCol,
        end_row: m.endRow,
        end_col: m.endCol
      }));
      this.render();
    }
    // --- Find ---
    findInSheet(query, caseSensitive = false) {
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
          const val = row[colKey]?.value ?? "";
          const test = caseSensitive ? val : val.toLowerCase();
          if (test.includes(q)) {
            this._findMatches.push({ row: r, col: c });
          }
        }
      }
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
    findNext() {
      if (this._findMatches.length === 0) return -1;
      this._findMatchIndex = (this._findMatchIndex + 1) % this._findMatches.length;
      const m = this._findMatches[this._findMatchIndex];
      this.selectedCell = { ...m };
      this.selectionRange = { startRow: m.row, startCol: m.col, endRow: m.row, endCol: m.col };
      this.scrollIntoView(m.row, m.col);
      this.render();
      return this._findMatchIndex;
    }
    findPrev() {
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
    getFindMatchCount() {
      return this._findMatches.length;
    }
    getFindMatchIndex() {
      return this._findMatchIndex;
    }
    replaceCurrentMatch(replacement) {
      if (this._findMatchIndex < 0 || this._findMatchIndex >= this._findMatches.length) return false;
      const m = this._findMatches[this._findMatchIndex];
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      if (!sheet?.cells?.[m.row]?.[m.col]) return false;
      this.pushUndo();
      const cell = sheet.cells[m.row][m.col];
      cell.value = replacement;
      cell.data_type = replacement.trim() !== "" && !isNaN(Number(replacement)) ? "n" : "s";
      this._findMatches.splice(this._findMatchIndex, 1);
      if (this._findMatchIndex >= this._findMatches.length) this._findMatchIndex = 0;
      this.render();
      return true;
    }
    replaceAll(query, replacement, caseSensitive = false) {
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
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "g" : "gi");
            cell.value = cell.value.replace(regex, replacement);
            cell.data_type = cell.value.trim() !== "" && !isNaN(Number(cell.value)) ? "n" : "s";
            count++;
          }
        }
      }
      this._findMatches = [];
      this._findMatchIndex = -1;
      this.render();
      return count;
    }
  };

  // media/ribbon.ts
  var IC = {
    paste: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor"><rect x="3" y="5" width="10" height="10" rx="1" stroke-width="1.2"/><path d="M6 5V3a1.5 1.5 0 013 0v2" stroke-width="1.2"/><line x1="6" y1="9" x2="10" y2="9" stroke-width="1"/><line x1="6" y1="11.5" x2="10" y2="11.5" stroke-width="1"/></svg>',
    cut: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="5" cy="12" r="2"/><circle cx="11" cy="12" r="2"/><path d="M6.5 10.5L10 3M9.5 10.5L6 3"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2"/></svg>',
    undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h6a3 3 0 010 6H7"/><path d="M6.5 3.5L4 6l2.5 2.5"/></svg>',
    redo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6H6a3 3 0 000 6h3"/><path d="M9.5 3.5L12 6 9.5 8.5"/></svg>',
    save: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M13 15H3a1 1 0 01-1-1V2a1 1 0 011-1h8l3 3v10a1 1 0 01-1 1z"/><path d="M5 1v4h5V1"/><rect x="4" y="9" width="8" height="5" rx=".5"/></svg>',
    print: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 5V1h8v4"/><rect x="2" y="5" width="12" height="6" rx="1"/><path d="M4 9v5h8V9"/><circle cx="11" cy="7.5" r=".5" fill="currentColor"/></svg>',
    exportPdf: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6z"/><path d="M9 1v5h5"/><path d="M8 13l3-3m0 0v3m0-3H8"/></svg>',
    alignL: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><line x1="2" y1="6.5" x2="10" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="2" y1="13" x2="10" y2="13"/></svg>',
    alignC: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="4" y1="13" x2="12" y2="13"/></svg>',
    alignR: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><line x1="6" y1="6.5" x2="14" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="6" y1="13" x2="14" y2="13"/></svg>',
    wrap: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><path d="M2 8h9.5a2.5 2.5 0 010 5H9"/><path d="M10.5 11.5L9 13l1.5 1.5"/></svg>',
    merge: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="8" rx="1"/><path d="M5 8h6M5 8l1.5-1.5M5 8l1.5 1.5M11 8l-1.5-1.5M11 8l-1.5 1.5"/></svg>',
    insertRow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="6" width="14" height="4" rx=".5"/><line x1="8" y1="1" x2="8" y2="5"/><line x1="6" y1="3" x2="10" y2="3"/><rect x="1" y="11" width="14" height="4" rx=".5"/></svg>',
    insertCol: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="4" height="14" rx=".5"/><rect x="10" y="1" width="4" height="14" rx=".5"/><line x1="6" y1="8" x2="9" y2="8"/><line x1="7.5" y1="6" x2="7.5" y2="10"/></svg>',
    deleteRow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="6" width="14" height="4" rx=".5"/><line x1="5" y1="3" x2="11" y2="3"/><rect x="1" y="11" width="14" height="4" rx=".5"/></svg>',
    deleteCol: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="4" height="14" rx=".5"/><rect x="10" y="1" width="4" height="14" rx=".5"/><line x1="6" y1="8" x2="9" y2="8"/></svg>',
    sortAsc: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="1" y="6.5" font-size="6" font-weight="600" font-family="system-ui">A</text><text x="1" y="13" font-size="6" font-weight="600" font-family="system-ui">Z</text><path d="M12 3v10M12 13l-2.5-3h5z" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sortDesc: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="1" y="6.5" font-size="6" font-weight="600" font-family="system-ui">Z</text><text x="1" y="13" font-size="6" font-weight="600" font-family="system-ui">A</text><path d="M12 3v10M12 13l-2.5-3h5z" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clear: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4"/><path d="M3.5 4l1 10.5h7L12.5 4"/><line x1="6.5" y1="7" x2="6.5" y2="12"/><line x1="9.5" y1="7" x2="9.5" y2="12"/></svg>',
    gridlines: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="1" y1="10.5" x2="15" y2="10.5"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><line x1="10.5" y1="1" x2="10.5" y2="15"/></svg>',
    headers: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><rect x="1" y="1" width="4.5" height="4.5" fill="currentColor" opacity=".2"/><rect x="1" y="5.5" width="4.5" height="9.5" fill="currentColor" opacity=".1"/><rect x="5.5" y="1" width="9.5" height="4.5" fill="currentColor" opacity=".1"/></svg>',
    freeze: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="8" y1="1" x2="8" y2="15"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>',
    sigma: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H4l4 5-4 5h8"/></svg>',
    table: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><line x1="1" y1="13" x2="15" y2="13"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><line x1="10.5" y1="1" x2="10.5" y2="15"/></svg>',
    tableStyle: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><rect x="1" y="1" width="14" height="4" rx="1" fill="currentColor" opacity=".25"/><rect x="1" y="5" width="5" height="4" fill="currentColor" opacity=".08"/><rect x="1" y="9" width="5" height="4" fill="currentColor" opacity=".08"/></svg>',
    filter: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h12l-4.5 5v4l-3 2V8z"/></svg>',
    totals: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="2" y1="12.5" x2="14" y2="12.5" stroke-width="2"/><line x1="2" y1="10" x2="14" y2="10" stroke-width=".8"/><path d="M4 3l2.5 5M6.5 8l2.5-5M4 4.5h5"/></svg>',
    convertRange: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><path d="M8 8l-2 2 2 2"/><path d="M8 8l2 2-2 2"/></svg>'
  };
  var TABLE_STYLE_COLORS = {
    "TableStyleMedium2": { header: "#4472c4", band: "#d6e4f0", label: "Blue" },
    "TableStyleMedium1": { header: "#a5a5a5", band: "#e0e0e0", label: "Gray" },
    "TableStyleMedium3": { header: "#ed7d31", band: "#fce4cc", label: "Orange" },
    "TableStyleMedium4": { header: "#ffc000", band: "#fff2cc", label: "Gold" },
    "TableStyleMedium5": { header: "#5b9bd5", band: "#dce6f0", label: "Sky" },
    "TableStyleMedium6": { header: "#70ad47", band: "#e2efda", label: "Green" },
    "TableStyleMedium7": { header: "#264478", band: "#c5d0e0", label: "Navy" },
    "TableStyleMedium9": { header: "#7030a0", band: "#e1d5ec", label: "Purple" },
    "TableStyleLight1": { header: "#000000", band: "#f2f2f2", label: "Light Gray" },
    "TableStyleLight2": { header: "#4472c4", band: "#edf2fa", label: "Light Blue" },
    "TableStyleLight9": { header: "#ed7d31", band: "#fef4eb", label: "Light Orange" },
    "TableStyleLight14": { header: "#70ad47", band: "#f0f7ec", label: "Light Green" },
    "TableStyleDark1": { header: "#000000", band: "#404040", label: "Dark Black" },
    "TableStyleDark2": { header: "#4472c4", band: "#2b4a7a", label: "Dark Blue" },
    "TableStyleDark3": { header: "#ed7d31", band: "#7a4018", label: "Dark Orange" },
    "TableStyleDark11": { header: "#7030a0", band: "#3d1a57", label: "Dark Purple" }
  };
  var Ribbon = class {
    constructor(container, onAction) {
      this.activeTab = "home";
      this.tabContents = /* @__PURE__ */ new Map();
      this.tabButtons = /* @__PURE__ */ new Map();
      this.selectedTableStyle = "TableStyleMedium2";
      this.container = container;
      this.onAction = onAction;
      this.build();
    }
    /** Returns the currently selected table style name for new table creation */
    getSelectedTableStyle() {
      return this.selectedTableStyle;
    }
    build() {
      this.container.innerHTML = "";
      this.container.className = "xlsx-ribbon";
      const tabBar = this.el("div", "ribbon-tab-bar");
      const tabsLeft = this.el("div", "ribbon-tabs-left");
      for (const name of ["Home", "Insert", "View", "Data"]) {
        const key = name.toLowerCase();
        const btn = this.el("button", `ribbon-tab${key === this.activeTab ? " active" : ""}`);
        btn.textContent = name;
        btn.onclick = () => this.switchTab(key);
        this.tabButtons.set(key, btn);
        tabsLeft.appendChild(btn);
      }
      tabBar.appendChild(tabsLeft);
      const fileOps = this.el("div", "ribbon-file-ops");
      fileOps.appendChild(this.iconBtn(IC.save, "Save", "save", "Ctrl+S"));
      fileOps.appendChild(this.iconBtn(IC.print, "Print", "print", "Ctrl+P"));
      fileOps.appendChild(this.iconBtn(IC.exportPdf, "Export", "exportPDF"));
      tabBar.appendChild(fileOps);
      this.container.appendChild(tabBar);
      const content = this.el("div", "ribbon-content");
      content.appendChild(this.buildHomeTab());
      content.appendChild(this.buildInsertTab());
      content.appendChild(this.buildViewTab());
      content.appendChild(this.buildDataTab());
      this.container.appendChild(content);
    }
    // ======================= HOME TAB =======================
    buildHomeTab() {
      const panel = this.tabPanel("home", true);
      const clip = this.group("Clipboard");
      const clipBody = this.el("div", "group-body clip-layout");
      const pasteBtn = this.tallBtn(IC.paste, "Paste", "paste");
      clipBody.appendChild(pasteBtn);
      const clipStack = this.el("div", "clip-stack");
      clipStack.appendChild(this.iconBtn(IC.cut, "Cut", "cut", "Ctrl+X"));
      clipStack.appendChild(this.iconBtn(IC.copy, "Copy", "copy", "Ctrl+C"));
      clipBody.appendChild(clipStack);
      clip.insertBefore(clipBody, clip.lastChild);
      panel.appendChild(clip);
      const hist = this.group("History");
      const histBody = this.el("div", "group-body");
      const histRow = this.el("div", "btn-col");
      histRow.appendChild(this.iconBtn(IC.undo, "Undo", "undo", "Ctrl+Z"));
      histRow.appendChild(this.iconBtn(IC.redo, "Redo", "redo", "Ctrl+Y"));
      histBody.appendChild(histRow);
      hist.insertBefore(histBody, hist.lastChild);
      panel.appendChild(hist);
      const font = this.group("Font");
      const fontBody = this.el("div", "group-body font-body");
      const fontR1 = this.el("div", "btn-row");
      fontR1.appendChild(this.selectEl("fontFamily", [
        "system-ui",
        "Arial",
        "Calibri",
        "Courier New",
        "Georgia",
        "Helvetica",
        "Times New Roman",
        "Verdana"
      ], void 0, "font-select"));
      fontR1.appendChild(this.selectEl("fontSize", [
        "8",
        "9",
        "10",
        "11",
        "12",
        "14",
        "16",
        "18",
        "20",
        "24",
        "28",
        "36",
        "48",
        "72"
      ], "13", "size-select"));
      fontBody.appendChild(fontR1);
      const fontR2 = this.el("div", "btn-row");
      fontR2.appendChild(this.fmtBtn("B", "bold", "fmt-bold"));
      fontR2.appendChild(this.fmtBtn("I", "italic", "fmt-italic"));
      fontR2.appendChild(this.fmtBtn("U", "underline", "fmt-underline"));
      fontR2.appendChild(this.fmtBtn("S", "strikethrough", "fmt-strike"));
      fontR2.appendChild(this.el("span", "btn-separator"));
      fontR2.appendChild(this.colorBtn("A", "textColor", "#cccccc"));
      fontR2.appendChild(this.colorBtn("\u25A0", "fillColor", "#3c3c3c"));
      fontBody.appendChild(fontR2);
      font.insertBefore(fontBody, font.lastChild);
      panel.appendChild(font);
      const align = this.group("Alignment");
      const alignBody = this.el("div", "group-body");
      const alignR1 = this.el("div", "btn-row");
      alignR1.appendChild(this.iconOnlyBtn(IC.alignL, "alignLeft", "Align Left"));
      alignR1.appendChild(this.iconOnlyBtn(IC.alignC, "alignCenter", "Align Center"));
      alignR1.appendChild(this.iconOnlyBtn(IC.alignR, "alignRight", "Align Right"));
      alignBody.appendChild(alignR1);
      const alignR2 = this.el("div", "btn-row");
      alignR2.appendChild(this.iconBtn(IC.wrap, "Wrap", "wrapText"));
      alignR2.appendChild(this.iconBtn(IC.merge, "Merge", "mergeCells"));
      alignBody.appendChild(alignR2);
      align.insertBefore(alignBody, align.lastChild);
      panel.appendChild(align);
      const numGrp = this.group("Number");
      const numBody = this.el("div", "group-body");
      const numR1 = this.el("div", "btn-row");
      numR1.appendChild(this.selectEl("numberFormat", [
        "General",
        "Number",
        "Currency",
        "Percentage",
        "Date",
        "Text"
      ], void 0, "num-select"));
      numBody.appendChild(numR1);
      const numR2 = this.el("div", "btn-row");
      numR2.appendChild(this.fmtBtn("$", "currency"));
      numR2.appendChild(this.fmtBtn("%", "percent"));
      numR2.appendChild(this.fmtBtn(",", "comma"));
      numR2.appendChild(this.el("span", "btn-separator"));
      numR2.appendChild(this.fmtBtn(".0+", "increaseDecimal"));
      numR2.appendChild(this.fmtBtn(".0\u2013", "decreaseDecimal"));
      numBody.appendChild(numR2);
      numGrp.insertBefore(numBody, numGrp.lastChild);
      panel.appendChild(numGrp);
      const cells = this.group("Cells");
      const cellsBody = this.el("div", "group-body");
      const cellR1 = this.el("div", "btn-row");
      cellR1.appendChild(this.iconBtn(IC.insertRow, "+ Row", "insertRow", "Insert Row"));
      cellR1.appendChild(this.iconBtn(IC.insertCol, "+ Col", "insertCol", "Insert Column"));
      cellsBody.appendChild(cellR1);
      const cellR2 = this.el("div", "btn-row");
      cellR2.appendChild(this.iconBtn(IC.deleteRow, "\u2013 Row", "deleteRow", "Delete Row"));
      cellR2.appendChild(this.iconBtn(IC.deleteCol, "\u2013 Col", "deleteCol", "Delete Column"));
      cellsBody.appendChild(cellR2);
      cells.insertBefore(cellsBody, cells.lastChild);
      panel.appendChild(cells);
      const fx = this.group("Formulas");
      const fxBody = this.el("div", "group-body");
      const fxR1 = this.el("div", "btn-row");
      fxR1.appendChild(this.iconBtn(IC.sigma, "SUM", "formulaSum"));
      fxR1.appendChild(this.fmtBtn("AVG", "formulaAvg"));
      fxR1.appendChild(this.fmtBtn("CNT", "formulaCount"));
      fxBody.appendChild(fxR1);
      const fxR2 = this.el("div", "btn-row");
      fxR2.appendChild(this.fmtBtn("MIN", "formulaMin"));
      fxR2.appendChild(this.fmtBtn("MAX", "formulaMax"));
      fxBody.appendChild(fxR2);
      fx.insertBefore(fxBody, fx.lastChild);
      panel.appendChild(fx);
      return panel;
    }
    // ======================= INSERT TAB =======================
    buildInsertTab() {
      const panel = this.tabPanel("insert", false);
      const tblGroup = this.group("Tables");
      const tblBody = this.el("div", "group-body");
      tblBody.appendChild(this.tallBtn(IC.table, "Table", "createTable"));
      tblBody.appendChild(this.buildTableStylePicker());
      tblBody.appendChild(this.iconBtn(IC.convertRange, "To Range", "convertToRange", "Convert Table to Range"));
      tblGroup.insertBefore(tblBody, tblGroup.lastChild);
      panel.appendChild(tblGroup);
      const rcGroup = this.group("Rows & Columns");
      const rcBody = this.el("div", "group-body");
      const rcR1 = this.el("div", "btn-row");
      rcR1.appendChild(this.iconBtn(IC.insertRow, "+ Row", "insertRow", "Insert Row"));
      rcR1.appendChild(this.iconBtn(IC.insertCol, "+ Col", "insertCol", "Insert Column"));
      rcBody.appendChild(rcR1);
      const rcR2 = this.el("div", "btn-row");
      rcR2.appendChild(this.iconBtn(IC.deleteRow, "\u2013 Row", "deleteRow", "Delete Row"));
      rcR2.appendChild(this.iconBtn(IC.deleteCol, "\u2013 Col", "deleteCol", "Delete Column"));
      rcBody.appendChild(rcR2);
      rcGroup.insertBefore(rcBody, rcGroup.lastChild);
      panel.appendChild(rcGroup);
      return panel;
    }
    /** Visual table style picker — shows colored mini table previews in a dropdown grid */
    buildTableStylePicker() {
      const wrapper = document.createElement("div");
      wrapper.className = "table-style-picker";
      wrapper.style.cssText = "position:relative;display:inline-block;";
      const trigger = document.createElement("button");
      trigger.className = "ribbon-btn icon-btn table-style-trigger";
      trigger.title = "Table Styles";
      const currentColors = TABLE_STYLE_COLORS[this.selectedTableStyle] || TABLE_STYLE_COLORS["TableStyleMedium2"];
      trigger.innerHTML = `${this.miniTableSvg(currentColors.header, currentColors.band)}<span class="btn-label">Styles</span>`;
      const dropdown = document.createElement("div");
      dropdown.className = "table-style-dropdown";
      dropdown.style.cssText = "display:none;position:absolute;top:100%;left:0;z-index:9999;background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007fd4);border-radius:4px;padding:6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);";
      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:4px;";
      const styleNames = Object.keys(TABLE_STYLE_COLORS);
      for (const styleName of styleNames) {
        const colors = TABLE_STYLE_COLORS[styleName];
        const cell = document.createElement("button");
        cell.className = "table-style-cell";
        cell.title = colors.label;
        cell.style.cssText = `border:2px solid ${styleName === this.selectedTableStyle ? "var(--vscode-focusBorder,#007fd4)" : "transparent"};border-radius:3px;padding:2px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
        cell.innerHTML = this.miniTableSvg(colors.header, colors.band);
        cell.onclick = () => {
          this.selectedTableStyle = styleName;
          const newColors = TABLE_STYLE_COLORS[styleName];
          trigger.innerHTML = `${this.miniTableSvg(newColors.header, newColors.band)}<span class="btn-label">Styles</span>`;
          grid.querySelectorAll(".table-style-cell").forEach((c) => {
            c.style.borderColor = "transparent";
          });
          cell.style.borderColor = "var(--vscode-focusBorder,#007fd4)";
          dropdown.style.display = "none";
          this.onAction({ action: "setTableStyle", value: styleName });
        };
        grid.appendChild(cell);
      }
      dropdown.appendChild(grid);
      trigger.onclick = () => {
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
      };
      document.addEventListener("mousedown", (e) => {
        if (!wrapper.contains(e.target)) {
          dropdown.style.display = "none";
        }
      });
      wrapper.appendChild(trigger);
      wrapper.appendChild(dropdown);
      return wrapper;
    }
    /** Small inline SVG showing a 3-row mini table with header color and band color */
    miniTableSvg(headerColor, bandColor) {
      return `<svg width="28" height="20" viewBox="0 0 28 20" style="display:block;"><rect x="0" y="0" width="28" height="6" rx="1" fill="${headerColor}"/><rect x="0" y="7" width="28" height="6" fill="${bandColor}"/><rect x="0" y="14" width="28" height="6" rx="1" fill="${bandColor}" opacity="0.5"/><rect x="0" y="0" width="28" height="20" rx="1" fill="none" stroke="${headerColor}" stroke-width="0.5" opacity="0.5"/></svg>`;
    }
    // ======================= VIEW TAB =======================
    buildViewTab() {
      const panel = this.tabPanel("view", false);
      const show = this.group("Show");
      const showBody = this.el("div", "group-body");
      const showR = this.el("div", "btn-col gap-6");
      showR.appendChild(this.toggleBtn(IC.gridlines, "Gridlines", "gridlines", true));
      showR.appendChild(this.toggleBtn(IC.headers, "Headers", "headers", true));
      showBody.appendChild(showR);
      show.insertBefore(showBody, show.lastChild);
      panel.appendChild(show);
      const win = this.group("Window");
      const winBody = this.el("div", "group-body");
      winBody.appendChild(this.tallBtn(IC.freeze, "Freeze\nPanes", "freezePanes"));
      win.insertBefore(winBody, win.lastChild);
      panel.appendChild(win);
      return panel;
    }
    // ======================= DATA TAB =======================
    buildDataTab() {
      const panel = this.tabPanel("data", false);
      const sort = this.group("Sort & Filter");
      const sortBody = this.el("div", "group-body");
      sortBody.appendChild(this.tallBtn(IC.sortAsc, "Sort\nA\u2192Z", "sortAZ"));
      sortBody.appendChild(this.tallBtn(IC.sortDesc, "Sort\nZ\u2192A", "sortZA"));
      const filterStack = this.el("div", "btn-col gap-6");
      filterStack.appendChild(this.iconBtn(IC.filter, "Filter", "toggleTableFilter", "Toggle Table Filter"));
      filterStack.appendChild(this.iconBtn(IC.totals, "Totals", "toggleTotalsRow", "Toggle Totals Row"));
      sortBody.appendChild(filterStack);
      sort.insertBefore(sortBody, sort.lastChild);
      panel.appendChild(sort);
      const edit = this.group("Edit");
      const editBody = this.el("div", "group-body");
      editBody.appendChild(this.tallBtn(IC.clear, "Clear", "clear"));
      edit.insertBefore(editBody, edit.lastChild);
      panel.appendChild(edit);
      return panel;
    }
    // ======================= TAB SWITCHING =======================
    switchTab(key) {
      if (key === this.activeTab) return;
      this.tabButtons.get(this.activeTab)?.classList.remove("active");
      const prevPanel = this.tabContents.get(this.activeTab);
      if (prevPanel) prevPanel.style.display = "none";
      this.activeTab = key;
      this.tabButtons.get(key)?.classList.add("active");
      const nextPanel = this.tabContents.get(key);
      if (nextPanel) nextPanel.style.display = "flex";
    }
    // ======================= BUTTON FACTORIES =======================
    /** Small button with icon + text label */
    iconBtn(svg, label, action, title) {
      const b = document.createElement("button");
      b.className = "ribbon-btn icon-btn";
      b.innerHTML = `<span class="btn-icon">${svg}</span><span class="btn-label">${label}</span>`;
      b.title = title || label;
      b.onclick = () => this.onAction({ action });
      return b;
    }
    /** Icon-only button (no label) */
    iconOnlyBtn(svg, action, title) {
      const b = document.createElement("button");
      b.className = "ribbon-btn icon-only-btn";
      b.innerHTML = `<span class="btn-icon">${svg}</span>`;
      b.title = title;
      b.onclick = () => this.onAction({ action });
      return b;
    }
    /** Tall (primary) button: icon above, text below */
    tallBtn(svg, label, action) {
      const b = document.createElement("button");
      b.className = "ribbon-btn tall-btn";
      b.innerHTML = `<span class="btn-icon lg">${svg}</span><span class="btn-label-below">${label.replace("\n", "<br>")}</span>`;
      b.title = label.replace("\n", " ");
      b.onclick = () => this.onAction({ action });
      return b;
    }
    /** Format button (styled text, e.g., B I U S) */
    fmtBtn(label, action, extraClass) {
      const b = document.createElement("button");
      b.className = `ribbon-btn fmt-btn${extraClass ? " " + extraClass : ""}`;
      b.textContent = label;
      b.title = action.charAt(0).toUpperCase() + action.slice(1);
      b.onclick = () => this.onAction({ action });
      return b;
    }
    /** Color button with color indicator bar */
    colorBtn(label, action, defaultColor) {
      const wrapper = document.createElement("span");
      wrapper.className = "color-btn-wrapper";
      const btn = document.createElement("button");
      btn.className = "ribbon-btn fmt-btn color-trigger";
      btn.innerHTML = `<span>${label}</span><span class="color-bar" style="background:${defaultColor}"></span>`;
      btn.title = action === "textColor" ? "Font Color" : "Fill Color";
      const input = document.createElement("input");
      input.type = "color";
      input.className = "color-input-hidden";
      input.value = defaultColor;
      input.oninput = () => {
        const bar = btn.querySelector(".color-bar");
        if (bar) bar.style.background = input.value;
        this.onAction({ action, value: input.value });
      };
      btn.onclick = () => input.click();
      wrapper.appendChild(btn);
      wrapper.appendChild(input);
      return wrapper;
    }
    /** Toggle button with icon + label + checkbox state */
    toggleBtn(svg, label, action, checked) {
      const b = document.createElement("button");
      b.className = `ribbon-btn toggle-btn${checked ? " toggled" : ""}`;
      b.innerHTML = `<span class="btn-icon">${svg}</span><span class="btn-label">${label}</span>`;
      b.title = label;
      b.onclick = () => {
        b.classList.toggle("toggled");
        this.onAction({ action, value: b.classList.contains("toggled") ? "1" : "0" });
      };
      return b;
    }
    /** Dropdown select */
    selectEl(action, options, defaultVal, extraClass) {
      const sel = document.createElement("select");
      sel.className = `ribbon-select${extraClass ? " " + extraClass : ""}`;
      sel.title = action;
      for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (defaultVal && opt === defaultVal) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = () => this.onAction({ action, value: sel.value });
      return sel;
    }
    // ======================= LAYOUT HELPERS =======================
    el(tag, className) {
      const el = document.createElement(tag);
      el.className = className;
      return el;
    }
    group(label) {
      const g = this.el("div", "ribbon-group");
      const lbl = this.el("div", "group-label");
      lbl.textContent = label;
      g.appendChild(lbl);
      return g;
    }
    tabPanel(key, active) {
      const panel = this.el("div", "ribbon-tab-panel");
      panel.style.display = active ? "flex" : "none";
      this.tabContents.set(key, panel);
      return panel;
    }
  };

  // media/contextMenu.ts
  var ContextMenu = class {
    constructor(container, onAction) {
      this.currentRow = 0;
      this.currentCol = 0;
      this.getTableAtCell = null;
      this.onAction = onAction;
      this.menu = document.createElement("div");
      this.menu.className = "xlsx-context-menu";
      this.menu.style.display = "none";
      container.appendChild(this.menu);
      document.addEventListener("mousedown", (e) => {
        if (!this.menu.contains(e.target)) {
          this.hide();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.hide();
      });
    }
    /** Register a function that detects if a cell is inside a table */
    setTableDetector(fn) {
      this.getTableAtCell = fn;
    }
    show(x, y, row, col, headerType) {
      this.currentRow = row;
      this.currentCol = col;
      this.buildMenu(row, col, headerType);
      this.menu.style.left = `${x}px`;
      this.menu.style.top = `${y}px`;
      this.menu.style.display = "block";
      requestAnimationFrame(() => {
        const rect = this.menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          this.menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
          this.menu.style.top = `${y - rect.height}px`;
        }
      });
    }
    hide() {
      this.menu.style.display = "none";
    }
    buildMenu(row, col, headerType) {
      const colName = this.getColName(col);
      this.menu.innerHTML = "";
      let items;
      let tableInfo = null;
      if (headerType === "col") {
        items = [
          { action: "insertColLeft", label: `Insert Column Left` },
          { action: "insertColRight", label: `Insert Column Right` },
          null,
          { action: "deleteCol", label: `Delete Column ${colName}` },
          { action: "clearCol", label: `Clear Column ${colName}` },
          null,
          { action: "hideCol", label: `Hide Column ${colName}` },
          null,
          { action: "colWidthAuto", label: "Auto-Fit Column Width" },
          null,
          { action: "sortAZ", label: "Sort A to Z" },
          { action: "sortZA", label: "Sort Z to A" }
        ];
      } else if (headerType === "row") {
        items = [
          { action: "insertRowAbove", label: "Insert Row Above" },
          { action: "insertRowBelow", label: "Insert Row Below" },
          null,
          { action: "deleteRow", label: `Delete Row ${row + 1}` },
          { action: "clearRow", label: `Clear Row ${row + 1}` },
          null,
          { action: "hideRow", label: `Hide Row ${row + 1}` },
          null,
          { action: "rowHeightAuto", label: "Auto-Fit Row Height" }
        ];
      } else {
        items = [
          { action: "cut", label: "Cut", shortcut: "Ctrl+X" },
          { action: "copy", label: "Copy", shortcut: "Ctrl+C" },
          { action: "paste", label: "Paste", shortcut: "Ctrl+V" },
          null,
          { action: "insertRowAbove", label: "Insert Row Above" },
          { action: "insertRowBelow", label: "Insert Row Below" },
          { action: "insertColLeft", label: "Insert Column Left" },
          { action: "insertColRight", label: "Insert Column Right" },
          null,
          { action: "deleteRow", label: `Delete Row ${row + 1}` },
          { action: "deleteCol", label: `Delete Column ${colName}` },
          null,
          { action: "clear", label: "Clear Contents", shortcut: "Del" },
          { action: "formatCells", label: "Format Cells..." },
          null,
          { action: "sortAZ", label: "Sort A to Z" },
          { action: "sortZA", label: "Sort Z to A" }
        ];
        tableInfo = this.getTableAtCell ? this.getTableAtCell(row, col) : null;
        if (tableInfo) {
          items.push(null);
          items.push({ action: "tableInsertColLeft", label: "Insert Table Column Left" });
          items.push({ action: "tableInsertColRight", label: "Insert Table Column Right" });
          if (tableInfo.column_count > 1) {
            items.push({ action: "tableDeleteCol", label: "Delete Table Column" });
          }
          items.push(null);
          items.push({ action: "tableRename", label: `Rename Table "${tableInfo.name}"...` });
          items.push({ action: "tableResize", label: "Resize Table..." });
          items.push({ action: "tableToggleHeaders", label: tableInfo.has_header_row ? "Hide Header Row" : "Show Header Row" });
          items.push({ action: "tableToggleTotals", label: tableInfo.has_totals_row ? "Remove Totals Row" : "Add Totals Row" });
          items.push({ action: "tableToggleFilter", label: tableInfo.filter_enabled ? "Remove Filter" : "Add Filter" });
          items.push({ action: "tableConvertToRange", label: "Convert to Range" });
          items.push(null);
          items.push({ action: "tableDelete", label: `Delete Table "${tableInfo.name}"` });
        }
      }
      for (const item of items) {
        if (item === null) {
          const sep = document.createElement("div");
          sep.className = "ctx-separator";
          this.menu.appendChild(sep);
        } else {
          const el = document.createElement("div");
          el.className = "ctx-item";
          const label = document.createElement("span");
          label.className = "ctx-label";
          label.textContent = item.label;
          el.appendChild(label);
          if (item.shortcut) {
            const sc = document.createElement("span");
            sc.className = "ctx-shortcut";
            sc.textContent = item.shortcut;
            el.appendChild(sc);
          }
          el.onclick = () => {
            this.onAction({
              action: item.action,
              row: this.currentRow,
              col: this.currentCol,
              tableName: tableInfo?.name
            });
            this.hide();
          };
          this.menu.appendChild(el);
        }
      }
    }
    getColName(n) {
      let s = "";
      let idx = n;
      while (idx >= 0) {
        s = String.fromCharCode(idx % 26 + 65) + s;
        idx = Math.floor(idx / 26) - 1;
      }
      return s;
    }
  };

  // media/main.ts
  var vscode = acquireVsCodeApi();
  var parser = null;
  var writer = null;
  var tableOps = null;
  var formulaEngine = null;
  var renderer = null;
  var contextMenu = null;
  var ribbon = null;
  async function initialize() {
    console.log("[XLSX Rust Viewer] Initializing...");
    const canvasContainer = document.getElementById("canvas-container");
    const ribbonContainer = document.getElementById("ribbon-container");
    if (!canvasContainer) {
      console.error("[XLSX Rust Viewer] No canvas container found");
      return;
    }
    renderer = new CanvasRenderer(canvasContainer);
    renderer.setLoading(true);
    if (ribbonContainer) {
      ribbon = new Ribbon(ribbonContainer, handleRibbonAction);
    }
    contextMenu = new ContextMenu(document.body, handleContextMenuAction);
    contextMenu.setTableDetector((row, col) => {
      if (!renderer) return null;
      const table = renderer.getTableAtCell(row, col);
      if (!table) return null;
      return {
        name: table.name,
        has_totals_row: table.has_totals_row,
        has_header_row: table.has_header_row,
        filter_enabled: table.filter_enabled,
        column_count: table.columns.length
      };
    });
    const configEl = document.getElementById("config");
    const wasmUrl = configEl?.getAttribute("data-wasm-url");
    if (!wasmUrl) {
      console.error("[XLSX Rust Viewer] No WASM URL provided");
      renderer.setLoading(false);
      return;
    }
    try {
      await __wbg_init(wasmUrl);
      init_panic_hook();
      parser = new XlsxParser();
      writer = new XlsxWriter();
      tableOps = new TableOps();
      formulaEngine = new FormulaEngine();
      console.log("[XLSX Rust Viewer] WASM initialized successfully");
      vscode.postMessage({ type: "ready" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[XLSX Rust Viewer] WASM init failed:", message);
      renderer.setLoading(false);
      vscode.postMessage({ type: "error", message });
    }
  }
  window.addEventListener("message", async (event) => {
    const message = event.data;
    console.log("[XLSX Rust Viewer] Received message:", message.type);
    switch (message.type) {
      case "loadXLSX":
        await handleLoad(message.data);
        break;
      case "saveXLSX":
        await handleSave();
        break;
      case "clearXLSX":
        if (renderer) {
          renderer.setData(null);
        }
        break;
    }
  });
  async function handleLoad(base64Data) {
    if (!parser || !renderer) {
      console.error("[XLSX Rust Viewer] Not initialized");
      return;
    }
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log("[XLSX Rust Viewer] Parsing file (" + bytes.length + " bytes)...");
      const modelJsonStr = parser.load(bytes);
      const model = JSON.parse(modelJsonStr);
      const firstSheet = model.sheets?.[0];
      console.log("[XLSX Rust Viewer] Parsed model:", {
        sheetCount: model.sheets?.length ?? 0,
        firstSheetName: firstSheet?.name,
        rowCount: firstSheet?.row_count,
        colCount: firstSheet?.col_count,
        cellRowKeys: firstSheet?.cells ? Object.keys(firstSheet.cells).length : 0,
        sampleCells: firstSheet?.cells ? JSON.stringify(firstSheet.cells).substring(0, 500) : "none"
      });
      renderer.setData(model);
      evaluateFormulas();
      buildSheetTabs();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[XLSX Rust Viewer] Load failed:", message);
      if (renderer) renderer.setLoading(false);
      vscode.postMessage({ type: "error", message });
    }
  }
  function evaluateFormulas() {
    if (!formulaEngine || !renderer) return;
    const data = renderer.getData();
    const sheet = data?.sheets?.[renderer.getActiveSheetIndex()];
    if (!sheet?.cells) return;
    try {
      const cellsJson = JSON.stringify(sheet.cells);
      const resultJson = formulaEngine.evaluate_all(cellsJson);
      const results = JSON.parse(resultJson);
      renderer.setFormulaResults(results);
    } catch (e) {
      console.warn("[XLSX Rust Viewer] Formula evaluation error:", e);
    }
  }
  function buildSheetTabs() {
    if (!renderer) return;
    const container = document.getElementById("sheet-tabs");
    if (!container) return;
    container.innerHTML = "";
    const names = renderer.getSheetNames();
    const activeIdx = renderer.getActiveSheetIndex();
    for (let i = 0; i < names.length; i++) {
      const tab = document.createElement("button");
      tab.className = `sheet-tab${i === activeIdx ? " active" : ""}`;
      tab.textContent = names[i];
      tab.title = names[i];
      tab.onclick = () => {
        if (!renderer) return;
        renderer.setActiveSheetIndex(i);
        evaluateFormulas();
        buildSheetTabs();
      };
      tab.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showSheetTabMenu(e.clientX, e.clientY, i);
      });
      container.appendChild(tab);
    }
    const addBtn = document.createElement("button");
    addBtn.className = "sheet-tab sheet-tab-add";
    addBtn.textContent = "+";
    addBtn.title = "Add Sheet";
    addBtn.onclick = () => addSheet();
    container.appendChild(addBtn);
  }
  function showSheetTabMenu(x, y, sheetIdx) {
    const existing = document.getElementById("sheet-tab-menu");
    if (existing) existing.remove();
    const menu = document.createElement("div");
    menu.id = "sheet-tab-menu";
    menu.className = "xlsx-context-menu";
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:10000;`;
    const items = [
      { label: "Rename Sheet", action: () => renameSheet(sheetIdx) },
      { label: "Delete Sheet", action: () => deleteSheet(sheetIdx) },
      { label: "Duplicate Sheet", action: () => duplicateSheet(sheetIdx) },
      { label: "Add Sheet", action: () => addSheet() }
    ];
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "ctx-item";
      el.innerHTML = `<span class="ctx-label">${item.label}</span>`;
      el.onclick = () => {
        menu.remove();
        item.action();
      };
      menu.appendChild(el);
    }
    document.body.appendChild(menu);
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("mousedown", close);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
  }
  function addSheet() {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets) return;
    const name = `Sheet${data.sheets.length + 1}`;
    data.sheets.push({ name, cells: {}, row_count: 100, col_count: 26, tables: [], merged_cells: [] });
    renderer.updateModel(data);
    renderer.setActiveSheetIndex(data.sheets.length - 1);
    buildSheetTabs();
    markDirty();
  }
  function deleteSheet(idx) {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets || data.sheets.length <= 1) return;
    data.sheets.splice(idx, 1);
    const newIdx = Math.min(idx, data.sheets.length - 1);
    renderer.setActiveSheetIndex(newIdx);
    renderer.updateModel(data);
    buildSheetTabs();
    markDirty();
  }
  function renameSheet(idx) {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets?.[idx]) return;
    showRenameDialog(data.sheets[idx].name, (newName) => {
      if (newName && newName.trim()) {
        data.sheets[idx].name = newName.trim();
        renderer.updateModel(data);
        buildSheetTabs();
        markDirty();
      }
    });
  }
  function duplicateSheet(idx) {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets?.[idx]) return;
    const original = data.sheets[idx];
    const copy = JSON.parse(JSON.stringify(original));
    copy.name = `${original.name} (Copy)`;
    data.sheets.splice(idx + 1, 0, copy);
    renderer.updateModel(data);
    renderer.setActiveSheetIndex(idx + 1);
    buildSheetTabs();
    markDirty();
  }
  async function handleSave() {
    if (!writer || !renderer) {
      console.error("[XLSX Rust Viewer] Not initialized");
      return;
    }
    try {
      const model = renderer.getData();
      if (!model) {
        console.error("[XLSX Rust Viewer] No data to save");
        return;
      }
      const modelJson = JSON.stringify(model);
      console.log("[XLSX Rust Viewer] Saving file...");
      const savedBytes = writer.save(modelJson);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < savedBytes.length; i += chunkSize) {
        const chunk = savedBytes.subarray(i, Math.min(i + chunkSize, savedBytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Data = btoa(binary);
      console.log("[XLSX Rust Viewer] File saved (" + savedBytes.length + " bytes)");
      vscode.postMessage({ type: "saveData", data: base64Data });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[XLSX Rust Viewer] Save failed:", message);
      vscode.postMessage({ type: "error", message });
    }
  }
  function handleRibbonAction(event) {
    if (!renderer) return;
    switch (event.action) {
      // Clipboard
      case "cut":
        handleCut();
        break;
      case "copy":
        handleCopy();
        break;
      case "paste":
        handlePaste();
        break;
      // History
      case "undo":
        renderer.undo();
        break;
      case "redo":
        renderer.redo();
        break;
      // Font formatting
      case "bold":
        renderer.toggleFormat("bold");
        markDirty();
        break;
      case "italic":
        renderer.toggleFormat("italic");
        markDirty();
        break;
      case "underline":
        renderer.toggleFormat("underline");
        markDirty();
        break;
      case "strikethrough":
        renderer.toggleFormat("strikethrough");
        markDirty();
        break;
      case "fontFamily":
        renderer.applyFormat("fontFamily", event.value);
        markDirty();
        break;
      case "fontSize":
        renderer.applyFormat("fontSize", event.value);
        markDirty();
        break;
      case "textColor":
        renderer.applyFormat("textColor", event.value);
        markDirty();
        break;
      case "fillColor":
        renderer.applyFormat("fillColor", event.value);
        markDirty();
        break;
      // Alignment
      case "alignLeft":
        renderer.applyFormat("alignment", "left");
        markDirty();
        break;
      case "alignCenter":
        renderer.applyFormat("alignment", "center");
        markDirty();
        break;
      case "alignRight":
        renderer.applyFormat("alignment", "right");
        markDirty();
        break;
      case "wrapText":
        renderer.toggleFormat("wrapText");
        markDirty();
        break;
      case "mergeCells":
        renderer.mergeCellsSelection();
        markDirty();
        break;
      // Number format
      case "numberFormat":
        renderer.applyFormat("numberFormat", event.value);
        markDirty();
        break;
      case "currency":
        renderer.applyFormat("numberFormat", "Currency");
        markDirty();
        break;
      case "percent":
        renderer.applyFormat("numberFormat", "Percentage");
        markDirty();
        break;
      case "comma":
        renderer.applyFormat("numberFormat", "Number");
        markDirty();
        break;
      case "increaseDecimal":
        break;
      case "decreaseDecimal":
        break;
      // Cell operations
      case "insertRow":
        renderer.insertRow();
        markDirty();
        break;
      case "insertCol":
        renderer.insertCol();
        markDirty();
        break;
      case "deleteRow":
        renderer.deleteRow();
        markDirty();
        break;
      case "deleteCol":
        renderer.deleteCol();
        markDirty();
        break;
      // Formulas
      case "formulaSum":
        insertFormula("SUM");
        break;
      case "formulaAvg":
        insertFormula("AVG");
        break;
      case "formulaCount":
        insertFormula("COUNT");
        break;
      case "formulaMin":
        insertFormula("MIN");
        break;
      case "formulaMax":
        insertFormula("MAX");
        break;
      // View
      case "gridlines":
        renderer.toggleGridlines();
        break;
      case "headers":
        renderer.toggleHeaders();
        break;
      case "freezePanes":
        renderer.freezePanes();
        break;
      // Data
      case "sortAZ":
        renderer.sortColumn(true);
        markDirty();
        break;
      case "sortZA":
        renderer.sortColumn(false);
        markDirty();
        break;
      case "clear":
        renderer.clearSelectedCells();
        markDirty();
        break;
      // File
      case "save":
        handleSave();
        break;
      case "print":
        window.print();
        break;
      case "exportPDF":
        break;
      // Table operations (from Insert and Data tabs)
      case "createTable": {
        if (!renderer) break;
        const selCell = renderer.getSelectedCell();
        if (selCell && renderer.getTableAtCell(selCell.row, selCell.col)) {
          console.log("[XLSX Rust Viewer] Selection is already inside a table");
          break;
        }
        handleTableAction("createTable");
        break;
      }
      case "toggleTableFilter": {
        if (!renderer) break;
        const sel = renderer.getSelectedCell();
        if (sel) {
          const table = renderer.getTableAtCell(sel.row, sel.col);
          if (table) handleTableAction("toggleFilter", { tableName: table.name });
        }
        break;
      }
      case "toggleTotalsRow": {
        if (!renderer) break;
        const sel2 = renderer.getSelectedCell();
        if (sel2) {
          const table = renderer.getTableAtCell(sel2.row, sel2.col);
          if (table) handleTableAction("setTotalsRow", { tableName: table.name, enabled: !table.has_totals_row });
        }
        break;
      }
      case "setTableStyle": {
        if (!renderer) break;
        const sel3 = renderer.getSelectedCell();
        if (sel3) {
          const table = renderer.getTableAtCell(sel3.row, sel3.col);
          if (table) handleTableAction("setTableStyle", { tableName: table.name, style: event.value });
        }
        break;
      }
      case "convertToRange": {
        if (!renderer) break;
        const sel4 = renderer.getSelectedCell();
        if (sel4) {
          const table = renderer.getTableAtCell(sel4.row, sel4.col);
          if (table) handleTableAction("convertToRange", { tableName: table.name });
        }
        break;
      }
    }
  }
  function handleContextMenuAction(event) {
    if (!renderer) return;
    switch (event.action) {
      case "cut":
        handleCut();
        break;
      case "copy":
        handleCopy();
        break;
      case "paste":
        handlePaste();
        break;
      case "insertRowAbove":
        renderer.insertRow(event.row);
        markDirty();
        break;
      case "insertRowBelow":
        renderer.insertRow(event.row + 1);
        markDirty();
        break;
      case "insertColLeft":
        renderer.insertCol(event.col);
        markDirty();
        break;
      case "insertColRight":
        renderer.insertCol(event.col + 1);
        markDirty();
        break;
      case "deleteRow":
        renderer.deleteRow(event.row);
        markDirty();
        break;
      case "deleteCol":
        renderer.deleteCol(event.col);
        markDirty();
        break;
      case "clear":
        renderer.clearSelectedCells();
        markDirty();
        break;
      case "sortAZ":
        renderer.sortColumn(true, event.col);
        markDirty();
        break;
      case "sortZA":
        renderer.sortColumn(false, event.col);
        markDirty();
        break;
      case "formatCells":
        break;
      // Column/Row header actions
      case "clearCol":
        if (renderer) {
          const data = renderer.getData();
          const idx = renderer.getActiveSheetIndex();
          const sheet = data?.sheets?.[idx];
          if (sheet?.cells) {
            for (const rowKey of Object.keys(sheet.cells)) {
              const r = Number(rowKey);
              if (sheet.cells[r]?.[event.col]) {
                renderer.updateCell(r, event.col, "", "s");
              }
            }
          }
          markDirty();
        }
        break;
      case "clearRow":
        if (renderer) {
          const data = renderer.getData();
          const idx = renderer.getActiveSheetIndex();
          const sheet = data?.sheets?.[idx];
          if (sheet?.cells?.[event.row]) {
            for (const colKey of Object.keys(sheet.cells[event.row])) {
              renderer.updateCell(event.row, Number(colKey), "", "s");
            }
          }
          markDirty();
        }
        break;
      case "hideCol":
        if (renderer) {
          renderer.setColWidth(event.col, 0);
          renderer.render();
          markDirty();
        }
        break;
      case "hideRow":
        if (renderer) {
          renderer.setRowHeight(event.row, 0);
          renderer.render();
          markDirty();
        }
        break;
      case "colWidthAuto":
        if (renderer) {
          renderer.setColWidth(event.col, 100);
          renderer.render();
          markDirty();
        }
        break;
      case "rowHeightAuto":
        if (renderer) {
          renderer.setRowHeight(event.row, 24);
          renderer.render();
          markDirty();
        }
        break;
      // Table-specific context menu actions
      case "tableInsertColLeft":
      case "tableInsertColRight":
        if (event.tableName) {
          const colName = `Column${Date.now() % 1e4}`;
          handleTableAction("addTableColumn", { tableName: event.tableName, colName });
        }
        break;
      case "tableDeleteCol":
        if (event.tableName && renderer) {
          const tbl = renderer.getTableAtCell(event.row, event.col);
          if (tbl) {
            const relCol = event.col - tbl.range.start_col;
            handleTableAction("removeTableColumn", { tableName: event.tableName, colIndex: relCol });
          }
        }
        break;
      case "tableRename":
        if (event.tableName) {
          showRenameDialog(event.tableName, (newName) => {
            if (newName && newName !== event.tableName) {
              handleTableAction("renameTable", { oldName: event.tableName, newName });
            }
          });
        }
        break;
      case "tableResize":
        if (event.tableName && renderer) {
          const sel = renderer.getSelectedRange();
          if (sel) {
            const rangeJson = JSON.stringify({
              start_row: Math.min(sel.startRow, sel.endRow),
              start_col: Math.min(sel.startCol, sel.endCol),
              end_row: Math.max(sel.startRow, sel.endRow),
              end_col: Math.max(sel.startCol, sel.endCol)
            });
            handleTableAction("resizeTable", { tableName: event.tableName, range: rangeJson });
          }
        }
        break;
      case "tableToggleHeaders":
        break;
      case "tableToggleTotals":
        if (event.tableName && renderer) {
          const t = renderer.getTableAtCell(event.row, event.col);
          if (t) handleTableAction("setTotalsRow", { tableName: event.tableName, enabled: !t.has_totals_row });
        }
        break;
      case "tableToggleFilter":
        if (event.tableName) {
          handleTableAction("toggleFilter", { tableName: event.tableName });
        }
        break;
      case "tableConvertToRange":
        if (event.tableName) {
          handleTableAction("convertToRange", { tableName: event.tableName });
        }
        break;
      case "tableDelete":
        if (event.tableName && renderer) {
          const tblDel = renderer.getTableAtCell(event.row, event.col);
          if (tblDel) {
            handleTableAction("convertToRange", { tableName: event.tableName });
            const r = tblDel.range;
            for (let row = r.start_row; row <= r.end_row; row++) {
              for (let col = r.start_col; col <= r.end_col; col++) {
                renderer.updateCell(row, col, "", "s");
              }
            }
            markDirty();
          }
        }
        break;
    }
  }
  function handleTableAction(action, params) {
    if (!renderer || !tableOps) return;
    const modelJson = JSON.stringify(renderer.getData());
    let result;
    try {
      switch (action) {
        case "createTable": {
          const sel = renderer.getSelectedRange();
          if (!sel) return;
          const range = JSON.stringify({
            start_row: Math.min(sel.startRow, sel.endRow),
            start_col: Math.min(sel.startCol, sel.endCol),
            end_row: Math.max(sel.startRow, sel.endRow),
            end_col: Math.max(sel.startCol, sel.endCol)
          });
          const name = params?.name || `Table${Date.now()}`;
          const style = params?.style || (ribbon ? ribbon.getSelectedTableStyle() : "TableStyleMedium2");
          result = tableOps.create_table(modelJson, 0, range, name, style);
          break;
        }
        case "resizeTable": {
          const tableName = params?.tableName;
          const rangeJson = params?.range;
          if (!tableName || !rangeJson) return;
          result = tableOps.resize_table(modelJson, tableName, rangeJson);
          break;
        }
        case "renameTable": {
          const oldName = params?.oldName;
          const newName = params?.newName;
          if (!oldName || !newName) return;
          result = tableOps.rename_table(modelJson, oldName, newName);
          break;
        }
        case "addTableColumn": {
          const tableName = params?.tableName;
          const colName = params?.colName || "NewColumn";
          if (!tableName) return;
          result = tableOps.add_table_column(modelJson, tableName, colName);
          break;
        }
        case "removeTableColumn": {
          const tableName = params?.tableName;
          const colIndex = params?.colIndex;
          if (!tableName || colIndex === void 0) return;
          result = tableOps.remove_table_column(modelJson, tableName, colIndex);
          break;
        }
        case "setTotalsRow": {
          const tableName = params?.tableName;
          const enabled = params?.enabled;
          const functions = params?.functions || "[]";
          if (!tableName) return;
          result = tableOps.set_totals_row(modelJson, tableName, !!enabled, functions);
          break;
        }
        case "setTableStyle": {
          const tableName = params?.tableName;
          const styleName = params?.style || "";
          if (!tableName) return;
          result = tableOps.set_table_style(modelJson, tableName, styleName);
          break;
        }
        case "toggleFilter": {
          const tableName = params?.tableName;
          if (!tableName) return;
          result = tableOps.toggle_filter(modelJson, tableName);
          break;
        }
        case "convertToRange": {
          const tableName = params?.tableName;
          if (!tableName) return;
          result = tableOps.convert_to_range(modelJson, tableName);
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[XLSX Rust Viewer] Table operation failed:", msg);
      return;
    }
    if (result) {
      const newModel = JSON.parse(result);
      renderer.updateModel(newModel);
      markDirty();
    }
  }
  function showRenameDialog(currentName, onConfirm) {
    const existing = document.getElementById("rename-dialog-overlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "rename-dialog-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:10000;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007fd4);border-radius:6px;padding:16px 20px;min-width:280px;box-shadow:0 4px 16px rgba(0,0,0,0.3);";
    const label = document.createElement("div");
    label.textContent = "Rename Table";
    label.style.cssText = "color:var(--vscode-foreground,#ccc);font-size:13px;font-weight:600;margin-bottom:10px;";
    box.appendChild(label);
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.style.cssText = "width:100%;box-sizing:border-box;padding:5px 8px;font-size:13px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;";
    box.appendChild(input);
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText = "padding:4px 12px;font-size:12px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;cursor:pointer;";
    cancel.onclick = () => overlay.remove();
    btnRow.appendChild(cancel);
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.style.cssText = "padding:4px 12px;font-size:12px;background:var(--vscode-button-background,#007fd4);color:var(--vscode-button-foreground,#fff);border:none;border-radius:3px;cursor:pointer;";
    ok.onclick = () => {
      overlay.remove();
      onConfirm(input.value.trim());
    };
    btnRow.appendChild(ok);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        overlay.remove();
        onConfirm(input.value.trim());
      }
      if (e.key === "Escape") overlay.remove();
    });
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
  async function handleCut() {
    if (!renderer) return;
    const data = renderer.getSelectedCellsData();
    if (data) {
      try {
        await navigator.clipboard.writeText(data);
      } catch {
        fallbackCopy(data);
      }
      renderer.clearSelectedCells();
      markDirty();
    }
  }
  async function handleCopy() {
    if (!renderer) return;
    const data = renderer.getSelectedCellsData();
    if (data) {
      try {
        await navigator.clipboard.writeText(data);
      } catch {
        fallbackCopy(data);
      }
    }
  }
  async function handlePaste() {
    if (!renderer) return;
    try {
      const text = await navigator.clipboard.readText();
      renderer.pasteData(text);
      markDirty();
    } catch {
      console.warn("[XLSX Rust Viewer] Clipboard read not available");
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  function insertFormula(type) {
    if (!renderer) return;
    const range = renderer.getSelectedRange();
    if (!range) return;
    const norm = {
      startRow: Math.min(range.startRow, range.endRow),
      startCol: Math.min(range.startCol, range.endCol),
      endRow: Math.max(range.startRow, range.endRow),
      endCol: Math.max(range.startCol, range.endCol)
    };
    const startRef = getColName(norm.startCol) + (norm.startRow + 1);
    const endRef = getColName(norm.endCol) + (norm.endRow + 1);
    const funcName = type === "AVG" ? "AVERAGE" : type;
    const formula = `=${funcName}(${startRef}:${endRef})`;
    renderer.updateCell(norm.endRow + 1, norm.endCol, formula, "s");
    markDirty();
    evaluateFormulas();
  }
  document.addEventListener("keydown", (e) => {
    if (!renderer) return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "z":
          e.preventDefault();
          if (e.shiftKey) {
            renderer.redo();
          } else {
            renderer.undo();
          }
          return;
        case "y":
          e.preventDefault();
          renderer.redo();
          return;
        case "s":
          e.preventDefault();
          handleSave();
          return;
        case "x":
          e.preventDefault();
          handleCut();
          return;
        case "c":
          e.preventDefault();
          handleCopy();
          return;
        case "v":
          e.preventDefault();
          handlePaste();
          return;
        case "b":
          e.preventDefault();
          renderer.toggleFormat("bold");
          markDirty();
          return;
        case "i":
          e.preventDefault();
          renderer.toggleFormat("italic");
          markDirty();
          return;
        case "u":
          e.preventDefault();
          renderer.toggleFormat("underline");
          markDirty();
          return;
        case "a":
          e.preventDefault();
          renderer.selectAll();
          return;
        case "f":
          e.preventDefault();
          toggleFindBar();
          return;
        case "h":
          e.preventDefault();
          toggleFindBar(true);
          return;
      }
    }
  });
  function markDirty() {
    vscode.postMessage({ type: "dirty" });
  }
  function setupRendererCallbacks() {
    if (!renderer) return;
    renderer.onContextMenu = (row, col, x, y, headerType) => {
      if (contextMenu) {
        contextMenu.show(x, y, row, col, headerType);
      }
    };
    renderer.onCellEdit = (_row, _col, _value) => {
      markDirty();
      if (formulaEngine) {
        formulaEngine.invalidate(_row, _col);
      }
      evaluateFormulas();
    };
    renderer.onSelectionChanged = (row, col) => {
      updateFormulaBar(row, col);
    };
    renderer.onFormulaRangeSelect = (row, col) => {
      handleFormulaPointClick(row, col);
    };
    renderer.onFormulaRangeDrag = (startRow, startCol, endRow, endCol) => {
      handleFormulaPointDrag(startRow, startCol, endRow, endCol);
    };
    renderer.onFormulaRangeDragEnd = () => {
    };
    renderer.onInlineEditInput = (value) => {
      if (value.startsWith("=")) {
        enterFormulaMode();
        syncFormulaHighlights();
      } else if (isFormulaMode) {
        exitFormulaMode();
      }
      formulaDragActive = false;
      formulaInsertStart = -1;
      formulaInsertEnd = -1;
    };
    renderer.onInlineEditCommit = () => {
      exitFormulaMode();
    };
    renderer.onInlineEditCancel = () => {
      exitFormulaMode();
    };
  }
  function updateFormulaBar(row, col) {
    const cellRefEl = document.getElementById("cell-ref");
    const formulaInput = document.getElementById("formula-input");
    if (cellRefEl) {
      cellRefEl.textContent = getColName(col) + (row + 1);
    }
    if (formulaInput && renderer) {
      const data = renderer.getData();
      const idx = renderer.getActiveSheetIndex();
      const cell = data?.sheets?.[idx]?.cells?.[row]?.[col];
      formulaInput.value = cell?.value ?? "";
      if (isFormulaMode) {
        exitFormulaMode();
      }
    }
  }
  function getColName(n) {
    let s = "";
    let idx = n;
    while (idx >= 0) {
      s = String.fromCharCode(idx % 26 + 65) + s;
      idx = Math.floor(idx / 26) - 1;
    }
    return s;
  }
  function parseColName(name) {
    let result = 0;
    for (let i = 0; i < name.length; i++) {
      result = result * 26 + (name.charCodeAt(i) - 64);
    }
    return result - 1;
  }
  var RANGE_COLORS = [
    "#4472C4",
    "#ED7D31",
    "#70AD47",
    "#FFC000",
    "#5B9BD5",
    "#FF0000",
    "#7030A0",
    "#00B0F0"
  ];
  var isFormulaMode = false;
  var formulaInsertStart = -1;
  var formulaInsertEnd = -1;
  var formulaDragActive = false;
  var formulaSavedCursor = -1;
  function extractFormulaRanges(formula) {
    const ranges = [];
    if (!formula.startsWith("=")) return ranges;
    const refPattern = /(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/g;
    let colorIdx = 0;
    let match;
    while ((match = refPattern.exec(formula)) !== null) {
      const startRef = match[1];
      const endRef = match[2];
      const startCell = parseCellRef(startRef);
      if (!startCell) continue;
      let endCell = endRef ? parseCellRef(endRef) : null;
      if (!endCell) endCell = startCell;
      ranges.push({
        startRow: startCell.row,
        startCol: startCell.col,
        endRow: endCell.row,
        endCol: endCell.col,
        color: RANGE_COLORS[colorIdx % RANGE_COLORS.length],
        textStart: match.index,
        textEnd: match.index + match[0].length
      });
      colorIdx++;
    }
    return ranges;
  }
  function parseCellRef(ref) {
    const cleaned = ref.replace(/\$/g, "");
    const m = cleaned.match(/^([A-Z]{1,3})(\d+)$/);
    if (!m) return null;
    return { col: parseColName(m[1]), row: parseInt(m[2], 10) - 1 };
  }
  function cellRef(row, col) {
    return getColName(col) + (row + 1);
  }
  function rangeRef(r1, c1, r2, c2) {
    const sr = Math.min(r1, r2), er = Math.max(r1, r2);
    const sc = Math.min(c1, c2), ec = Math.max(c1, c2);
    if (sr === er && sc === ec) return cellRef(sr, sc);
    return cellRef(sr, sc) + ":" + cellRef(er, ec);
  }
  function cursorExpectsRef(text, cursorPos) {
    if (cursorPos <= 0) return false;
    const before = text.substring(0, cursorPos).trimEnd();
    if (before.length === 0) return false;
    const lastChar = before[before.length - 1];
    return "(,+-*/=<>^& ".includes(lastChar);
  }
  function enterFormulaMode() {
    if (isFormulaMode) return;
    isFormulaMode = true;
    formulaInsertStart = -1;
    formulaInsertEnd = -1;
    formulaDragActive = false;
    if (renderer) renderer.setFormulaMode(true);
    syncFormulaHighlights();
  }
  function exitFormulaMode() {
    if (!isFormulaMode) return;
    isFormulaMode = false;
    formulaInsertStart = -1;
    formulaInsertEnd = -1;
    formulaDragActive = false;
    if (renderer) renderer.setFormulaMode(false);
  }
  function syncFormulaHighlights() {
    if (!renderer || !isFormulaMode) return;
    const formulaInput = getActiveFormulaInput();
    if (!formulaInput) return;
    const ranges = extractFormulaRanges(formulaInput.value);
    renderer.setFormulaRanges(ranges);
  }
  function getActiveFormulaInput() {
    if (renderer) {
      const editing = renderer.getEditingCell();
      if (editing) {
        const val = renderer.getEditInputValue();
        if (val.startsWith("=")) {
          return document.getElementById("formula-input");
        }
      }
    }
    return document.getElementById("formula-input");
  }
  function handleFormulaPointClick(row, col) {
    const formulaInput = getActiveFormulaInput();
    if (!formulaInput || !isFormulaMode) return;
    const ref = cellRef(row, col);
    const text = formulaInput.value;
    let cursor = formulaSavedCursor >= 0 ? formulaSavedCursor : formulaInput.selectionStart ?? text.length;
    cursor = Math.min(cursor, text.length);
    if (formulaDragActive && formulaInsertStart >= 0 && formulaInsertEnd >= 0 && formulaInsertEnd <= text.length) {
      if (cursor >= formulaInsertStart && cursor <= formulaInsertEnd) {
        const before = text.substring(0, formulaInsertStart);
        const after = text.substring(formulaInsertEnd);
        formulaInput.value = before + ref + after;
        formulaInsertEnd = formulaInsertStart + ref.length;
      } else {
        insertRefAtCursor(formulaInput, text, cursor, ref);
      }
    } else {
      insertRefAtCursor(formulaInput, text, cursor, ref);
    }
    if (renderer && renderer.getEditingCell()) {
      renderer.setEditInputValue(formulaInput.value, formulaInsertEnd);
    }
    formulaDragActive = true;
    formulaSavedCursor = -1;
    syncFormulaHighlights();
    formulaInput.focus();
    formulaInput.setSelectionRange(formulaInsertEnd, formulaInsertEnd);
  }
  function insertRefAtCursor(formulaInput, text, cursor, ref) {
    if (cursorExpectsRef(text, cursor)) {
      const before = text.substring(0, cursor);
      const after = text.substring(cursor);
      formulaInput.value = before + ref + after;
      formulaInsertStart = cursor;
      formulaInsertEnd = cursor + ref.length;
    } else {
      const before = text.substring(0, cursor);
      const after = text.substring(cursor);
      formulaInput.value = before + ref + after;
      formulaInsertStart = cursor;
      formulaInsertEnd = cursor + ref.length;
    }
  }
  function handleFormulaPointDrag(startRow, startCol, endRow, endCol) {
    const formulaInput = getActiveFormulaInput();
    if (!formulaInput || !isFormulaMode) return;
    if (formulaInsertStart < 0 || formulaInsertEnd < 0) return;
    const ref = rangeRef(startRow, startCol, endRow, endCol);
    const text = formulaInput.value;
    if (formulaInsertEnd > text.length) {
      formulaInsertEnd = text.length;
    }
    const before = text.substring(0, formulaInsertStart);
    const after = text.substring(formulaInsertEnd);
    formulaInput.value = before + ref + after;
    formulaInsertEnd = formulaInsertStart + ref.length;
    formulaInput.setSelectionRange(formulaInsertEnd, formulaInsertEnd);
    if (renderer && renderer.getEditingCell()) {
      renderer.setEditInputValue(formulaInput.value, formulaInsertEnd);
    }
    syncFormulaHighlights();
  }
  var findBarVisible = false;
  function toggleFindBar(showReplace = false) {
    let bar = document.getElementById("find-bar");
    if (bar && findBarVisible) {
      bar.remove();
      findBarVisible = false;
      if (renderer) renderer.clearFind();
      return;
    }
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.id = "find-bar";
    bar.style.cssText = "position:absolute;top:0;right:0;z-index:1000;background:var(--vscode-editorWidget-background,#252526);border:1px solid var(--vscode-focusBorder,#007acc);border-radius:0 0 0 6px;padding:8px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:4px;";
    const findRow = document.createElement("div");
    findRow.style.cssText = "display:flex;align-items:center;gap:6px;";
    const findInput = document.createElement("input");
    findInput.type = "text";
    findInput.placeholder = "Find...";
    findInput.style.cssText = "width:200px;padding:3px 8px;font-size:12px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;";
    const matchLabel = document.createElement("span");
    matchLabel.style.cssText = "font-size:11px;color:var(--vscode-descriptionForeground,#888);min-width:60px;";
    matchLabel.textContent = "No results";
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "\u25B2";
    prevBtn.title = "Previous";
    prevBtn.style.cssText = "padding:2px 6px;font-size:11px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;cursor:pointer;";
    prevBtn.onclick = () => {
      if (renderer) {
        const idx = renderer.findPrev();
        updateMatchLabel(idx);
      }
    };
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "\u25BC";
    nextBtn.title = "Next";
    nextBtn.style.cssText = prevBtn.style.cssText;
    nextBtn.onclick = () => {
      if (renderer) {
        const idx = renderer.findNext();
        updateMatchLabel(idx);
      }
    };
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.title = "Close";
    closeBtn.style.cssText = "padding:2px 6px;font-size:11px;background:transparent;color:var(--vscode-foreground,#ccc);border:none;cursor:pointer;";
    closeBtn.onclick = () => {
      bar.remove();
      findBarVisible = false;
      if (renderer) renderer.clearFind();
    };
    findRow.appendChild(findInput);
    findRow.appendChild(matchLabel);
    findRow.appendChild(prevBtn);
    findRow.appendChild(nextBtn);
    findRow.appendChild(closeBtn);
    bar.appendChild(findRow);
    let replaceInput = null;
    if (showReplace) {
      const replaceRow = document.createElement("div");
      replaceRow.style.cssText = "display:flex;align-items:center;gap:6px;";
      replaceInput = document.createElement("input");
      replaceInput.type = "text";
      replaceInput.placeholder = "Replace...";
      replaceInput.style.cssText = findInput.style.cssText;
      const replaceBtn = document.createElement("button");
      replaceBtn.textContent = "Replace";
      replaceBtn.style.cssText = "padding:2px 8px;font-size:11px;background:var(--vscode-button-background,#007fd4);color:var(--vscode-button-foreground,#fff);border:none;border-radius:3px;cursor:pointer;";
      replaceBtn.onclick = () => {
        if (renderer && replaceInput) {
          renderer.replaceCurrentMatch(replaceInput.value);
          updateMatchLabel(renderer.getFindMatchIndex());
          markDirty();
        }
      };
      const replaceAllBtn = document.createElement("button");
      replaceAllBtn.textContent = "Replace All";
      replaceAllBtn.style.cssText = replaceBtn.style.cssText;
      replaceAllBtn.onclick = () => {
        if (renderer && replaceInput) {
          const count = renderer.replaceAll(findInput.value, replaceInput.value);
          matchLabel.textContent = `Replaced ${count}`;
          markDirty();
        }
      };
      replaceRow.appendChild(replaceInput);
      replaceRow.appendChild(replaceBtn);
      replaceRow.appendChild(replaceAllBtn);
      bar.appendChild(replaceRow);
      replaceInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
      });
    }
    function updateMatchLabel(idx) {
      if (!renderer) return;
      const count = renderer.getFindMatchCount();
      if (count === 0) {
        matchLabel.textContent = "No results";
      } else {
        matchLabel.textContent = `${idx + 1} of ${count}`;
      }
    }
    findInput.addEventListener("input", () => {
      if (!renderer) return;
      const count = renderer.findInSheet(findInput.value);
      if (count > 0) {
        matchLabel.textContent = `1 of ${count}`;
      } else {
        matchLabel.textContent = "No results";
      }
    });
    findInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        if (renderer) {
          const idx = renderer.findNext();
          updateMatchLabel(idx);
        }
      } else if (e.key === "Escape") {
        bar.remove();
        findBarVisible = false;
        if (renderer) renderer.clearFind();
      }
    });
    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
      canvasContainer.appendChild(bar);
    }
    findBarVisible = true;
    findInput.focus();
  }
  document.addEventListener("DOMContentLoaded", async () => {
    await initialize();
    setupRendererCallbacks();
    const formulaInput = document.getElementById("formula-input");
    if (formulaInput) {
      formulaInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && renderer) {
          e.preventDefault();
          const sel = renderer.getSelectedCell();
          if (sel) {
            const val = formulaInput.value;
            const dataType = val.startsWith("=") ? "s" : val.trim() !== "" && !isNaN(Number(val)) ? "n" : "s";
            renderer.updateCell(sel.row, sel.col, val, dataType);
            markDirty();
            if (formulaEngine) formulaEngine.invalidate(sel.row, sel.col);
            evaluateFormulas();
            exitFormulaMode();
            const canvas = document.querySelector("canvas");
            if (canvas) canvas.focus();
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (renderer) {
            const sel = renderer.getSelectedCell();
            if (sel) {
              const data = renderer.getData();
              const idx = renderer.getActiveSheetIndex();
              const cell = data?.sheets?.[idx]?.cells?.[sel.row]?.[sel.col];
              formulaInput.value = cell?.value ?? "";
            }
          }
          exitFormulaMode();
          const canvas = document.querySelector("canvas");
          if (canvas) canvas.focus();
        }
      });
      formulaInput.addEventListener("input", () => {
        const val = formulaInput.value;
        if (val.startsWith("=")) {
          enterFormulaMode();
          syncFormulaHighlights();
        } else {
          exitFormulaMode();
        }
        formulaDragActive = false;
        formulaInsertStart = -1;
        formulaInsertEnd = -1;
      });
      formulaInput.addEventListener("focus", () => {
        const val = formulaInput.value;
        if (val.startsWith("=")) {
          enterFormulaMode();
        }
        if (!isFormulaMode) {
          formulaInput.select();
        }
      });
      formulaInput.addEventListener("blur", () => {
        formulaSavedCursor = formulaInput.selectionStart ?? -1;
        setTimeout(() => {
          if (renderer && renderer.isFormulaMode()) {
            return;
          }
          exitFormulaMode();
        }, 250);
      });
    }
  });
})();
