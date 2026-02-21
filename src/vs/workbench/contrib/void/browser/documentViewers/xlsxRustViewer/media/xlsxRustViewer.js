"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
      const ret = wasm.contextmenumanager_new();
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
    // --- Light styles (1-21): 3 groups of 7 accent colors, increasingly visible banding ---
    // Group 1 (1-7): very subtle banding
    "TableStyleLight1": { header: "#000000", band: "#f7f7f7", border: "#999999", headerText: "#fff" },
    "TableStyleLight2": { header: "#4472c4", band: "#edf2fa", border: "#4472c4", headerText: "#fff" },
    "TableStyleLight3": { header: "#ed7d31", band: "#fef4eb", border: "#ed7d31", headerText: "#fff" },
    "TableStyleLight4": { header: "#a5a5a5", band: "#f5f5f5", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleLight5": { header: "#ffc000", band: "#fffbef", border: "#ffc000", headerText: "#333" },
    "TableStyleLight6": { header: "#5b9bd5", band: "#eef4fa", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleLight7": { header: "#70ad47", band: "#f0f7ec", border: "#70ad47", headerText: "#fff" },
    // Group 2 (8-14): moderate banding
    "TableStyleLight8": { header: "#000000", band: "#f2f2f2", border: "#000000", headerText: "#fff" },
    "TableStyleLight9": { header: "#4472c4", band: "#dbe5f5", border: "#4472c4", headerText: "#fff" },
    "TableStyleLight10": { header: "#ed7d31", band: "#fce4cc", border: "#ed7d31", headerText: "#fff" },
    "TableStyleLight11": { header: "#a5a5a5", band: "#ececec", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleLight12": { header: "#ffc000", band: "#fff5d5", border: "#ffc000", headerText: "#333" },
    "TableStyleLight13": { header: "#5b9bd5", band: "#dde9f5", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleLight14": { header: "#70ad47", band: "#e2efda", border: "#70ad47", headerText: "#fff" },
    // Group 3 (15-21): stronger banding
    "TableStyleLight15": { header: "#000000", band: "#e8e8e8", border: "#000000", headerText: "#fff" },
    "TableStyleLight16": { header: "#4472c4", band: "#c9d8f0", border: "#4472c4", headerText: "#fff" },
    "TableStyleLight17": { header: "#ed7d31", band: "#f9d5ad", border: "#ed7d31", headerText: "#fff" },
    "TableStyleLight18": { header: "#a5a5a5", band: "#e0e0e0", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleLight19": { header: "#ffc000", band: "#ffefb8", border: "#ffc000", headerText: "#333" },
    "TableStyleLight20": { header: "#5b9bd5", band: "#ccddf0", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleLight21": { header: "#70ad47", band: "#d4e7c8", border: "#70ad47", headerText: "#fff" },
    // --- Medium styles (1-28): 4 groups of 7 accent colors ---
    // Group 1 (1-7): filled header + banded rows
    "TableStyleMedium1": { header: "#000000", band: "#e0e0e0", border: "#000000", headerText: "#fff" },
    "TableStyleMedium2": { header: "#4472c4", band: "#d6e4f0", border: "#4472c4", headerText: "#fff" },
    "TableStyleMedium3": { header: "#ed7d31", band: "#fce4cc", border: "#ed7d31", headerText: "#fff" },
    "TableStyleMedium4": { header: "#a5a5a5", band: "#dcdcdc", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleMedium5": { header: "#ffc000", band: "#fff2cc", border: "#ffc000", headerText: "#333" },
    "TableStyleMedium6": { header: "#5b9bd5", band: "#dce6f0", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleMedium7": { header: "#70ad47", band: "#e2efda", border: "#70ad47", headerText: "#fff" },
    // Group 2 (8-14): filled header + borders + stronger banding
    "TableStyleMedium8": { header: "#000000", band: "#d0d0d0", border: "#000000", headerText: "#fff" },
    "TableStyleMedium9": { header: "#4472c4", band: "#b8cde5", border: "#4472c4", headerText: "#fff" },
    "TableStyleMedium10": { header: "#ed7d31", band: "#f9c99a", border: "#ed7d31", headerText: "#fff" },
    "TableStyleMedium11": { header: "#a5a5a5", band: "#cccccc", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleMedium12": { header: "#ffc000", band: "#ffe599", border: "#ffc000", headerText: "#333" },
    "TableStyleMedium13": { header: "#5b9bd5", band: "#bdd0e5", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleMedium14": { header: "#70ad47", band: "#c5dfb5", border: "#70ad47", headerText: "#fff" },
    // Group 3 (15-21): filled header + cell borders + deep banding
    "TableStyleMedium15": { header: "#000000", band: "#c0c0c0", border: "#000000", headerText: "#fff" },
    "TableStyleMedium16": { header: "#4472c4", band: "#9ab6da", border: "#4472c4", headerText: "#fff" },
    "TableStyleMedium17": { header: "#ed7d31", band: "#f6ae68", border: "#ed7d31", headerText: "#fff" },
    "TableStyleMedium18": { header: "#a5a5a5", band: "#bcbcbc", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleMedium19": { header: "#ffc000", band: "#ffd966", border: "#ffc000", headerText: "#333" },
    "TableStyleMedium20": { header: "#5b9bd5", band: "#9dbada", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleMedium21": { header: "#70ad47", band: "#a8cf90", border: "#70ad47", headerText: "#fff" },
    // Group 4 (22-28): outside border + row borders
    "TableStyleMedium22": { header: "#000000", band: "#b0b0b0", border: "#000000", headerText: "#fff" },
    "TableStyleMedium23": { header: "#4472c4", band: "#7ca0cf", border: "#4472c4", headerText: "#fff" },
    "TableStyleMedium24": { header: "#ed7d31", band: "#f39336", border: "#ed7d31", headerText: "#fff" },
    "TableStyleMedium25": { header: "#a5a5a5", band: "#aaaaaa", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleMedium26": { header: "#ffc000", band: "#ffcc33", border: "#ffc000", headerText: "#333" },
    "TableStyleMedium27": { header: "#5b9bd5", band: "#7ea4cf", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleMedium28": { header: "#70ad47", band: "#8bbf6b", border: "#70ad47", headerText: "#fff" },
    // --- Dark styles (1-11): dark bands with filled headers ---
    "TableStyleDark1": { header: "#000000", band: "#404040", border: "#000000", headerText: "#fff" },
    "TableStyleDark2": { header: "#4472c4", band: "#2b4a7a", border: "#4472c4", headerText: "#fff" },
    "TableStyleDark3": { header: "#ed7d31", band: "#7a4018", border: "#ed7d31", headerText: "#fff" },
    "TableStyleDark4": { header: "#a5a5a5", band: "#5a5a5a", border: "#a5a5a5", headerText: "#fff" },
    "TableStyleDark5": { header: "#ffc000", band: "#8a6800", border: "#ffc000", headerText: "#fff" },
    "TableStyleDark6": { header: "#5b9bd5", band: "#2f5e8a", border: "#5b9bd5", headerText: "#fff" },
    "TableStyleDark7": { header: "#70ad47", band: "#3a5925", border: "#70ad47", headerText: "#fff" },
    "TableStyleDark8": { header: "#1a1a1a", band: "#333333", border: "#1a1a1a", headerText: "#fff" },
    "TableStyleDark9": { header: "#264478", band: "#1a3060", border: "#264478", headerText: "#fff" },
    "TableStyleDark10": { header: "#c55a11", band: "#6b3510", border: "#c55a11", headerText: "#fff" },
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
      // Filter state: hidden rows (rows excluded by column filters)
      this._hiddenRows = /* @__PURE__ */ new Set();
      // Active filters: key = "tableName:colIndex", value = set of allowed cell values
      this._activeFilters = /* @__PURE__ */ new Map();
      // HTML filter arrow buttons overlaid on table header cells
      this._filterButtons = [];
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
      // --- Conditional Formatting Evaluation Engine ---
      /** Cache for aggregate computations (top10, average, duplicates, etc.) keyed by rule index */
      this._cfCache = /* @__PURE__ */ new Map();
      /** Per-render cycle data bar/icon set results keyed by "row:col" */
      this._cfDataBars = /* @__PURE__ */ new Map();
      this._cfIcons = /* @__PURE__ */ new Map();
      this._wrapper = document.createElement("div");
      this._wrapper.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;position:relative;";
      container.appendChild(this._wrapper);
      this.canvas = document.createElement("canvas");
      this.canvas.style.cssText = "display:block;outline:none;flex:1;min-height:0;";
      this._wrapper.appendChild(this.canvas);
      this._hScrollbar = document.createElement("div");
      this._hScrollbar.style.cssText = "height:14px;flex-shrink:0;background:#e8e8e8;border-top:1px solid #ccc;position:relative;cursor:default;";
      this._wrapper.appendChild(this._hScrollbar);
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
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this._wrapper);
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
    // --- Chart coordinate helpers (public wrappers for ChartManager) ---
    publicCx(colIdx) {
      return this.cx(colIdx);
    }
    publicRy(rowIdx) {
      return this.ry(rowIdx);
    }
    publicCw(colIdx) {
      return this.cw(colIdx);
    }
    publicRh(rowIdx) {
      return this.rh(rowIdx);
    }
    publicScrollLeft() {
      return this.scrollLeft;
    }
    publicScrollTop() {
      return this.scrollTop;
    }
    publicHeaderWidth() {
      return this._showHeaders ? this.headerWidth : 0;
    }
    publicHeaderHeight() {
      return this._showHeaders ? this.headerHeight : 0;
    }
    /** Get the wrapper div that contains the canvas and overlays */
    getWrapper() {
      return this._wrapper;
    }
    setActiveSheetIndex(idx) {
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
        const h = this._hiddenRows.has(r) ? 0 : this.rowHeights[r] ?? this.rowHeight;
        this._rowPos[r + 1] = this._rowPos[r] + h;
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
    setSelection(startRow, startCol, endRow, endCol) {
      this.selectedCell = { row: startRow, col: startCol };
      this.selectionRange = { startRow, startCol, endRow, endCol };
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
    /**
     * Create / reposition / remove real HTML buttons over each table header filter arrow.
     * Called at the end of every render() so buttons track scrolling and layout changes.
     */
    _syncFilterButtons() {
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
          const visible = btnLeft > effHeaderWidth - 10 && btnTop >= effHeaderHeight - 2 && btnTop + hdrRowH > effHeaderHeight && cellRight <= this.width + 10;
          let btn;
          if (btnIdx < this._filterButtons.length) {
            btn = this._filterButtons[btnIdx];
          } else {
            btn = document.createElement("button");
            btn.className = "filter-arrow-btn";
            btn.textContent = "\u25BC";
            wrapper.appendChild(btn);
            this._filterButtons.push(btn);
          }
          const tableName = table.name;
          const colIndex = c;
          const colDef = table.columns[c - tr.start_col];
          const colName = colDef?.name ?? "";
          btn.onclick = (e) => {
            e.stopPropagation();
            if (this.onFilterArrowClick) {
              const rect = btn.getBoundingClientRect();
              this.onFilterArrowClick(tableName, colIndex, colName, rect.left, rect.bottom);
            }
          };
          btn.style.left = `${btnLeft}px`;
          btn.style.top = `${btnTop}px`;
          btn.style.height = `${hdrRowH}px`;
          btn.style.display = visible ? "flex" : "none";
          btnIdx++;
        }
      }
      while (this._filterButtons.length > btnIdx) {
        const old = this._filterButtons.pop();
        old.remove();
      }
    }
    /** Remove all filter arrow buttons from the DOM. */
    _clearFilterButtons() {
      for (const btn of this._filterButtons) {
        btn.remove();
      }
      this._filterButtons = [];
    }
    /** Get unique cell values for a column within a table's data range (excludes header/totals). */
    getColumnUniqueValues(tableName, colIndex) {
      const table = this.tables.find((t) => t.name === tableName);
      if (!table || !this.data?.sheets?.[this._activeSheetIndex]) return [];
      const sheet = this.data.sheets[this._activeSheetIndex];
      const tr = table.range;
      const dataStart = table.has_header_row ? tr.start_row + 1 : tr.start_row;
      const dataEnd = table.has_totals_row ? tr.end_row - 1 : tr.end_row;
      const valueSet = /* @__PURE__ */ new Set();
      for (let r = dataStart; r <= dataEnd; r++) {
        const cell = sheet.cells?.[r]?.[colIndex];
        valueSet.add(cell?.value ?? "");
      }
      const sorted = [...valueSet].sort((a, b) => {
        if (a === "" && b !== "") return 1;
        if (a !== "" && b === "") return -1;
        return a.localeCompare(b);
      });
      return sorted;
    }
    /** Get the current filter for a table column, if any. */
    getActiveFilter(tableName, colIndex) {
      return this._activeFilters.get(`${tableName}:${colIndex}`);
    }
    /**
     * If the edited cell is a table header, update the column definition name to match.
     * This keeps the table overlay text in sync with cell edits.
     */
    syncTableHeaderName(row, col, value) {
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
    sortTableColumn(tableName, colIndex, ascending) {
      const table = this.tables.find((t) => t.name === tableName);
      if (!table || !this.data?.sheets?.[this._activeSheetIndex]) return;
      this.pushUndo();
      const sheet = this.data.sheets[this._activeSheetIndex];
      const tr = table.range;
      const dataStart = table.has_header_row ? tr.start_row + 1 : tr.start_row;
      const dataEnd = table.has_totals_row ? tr.end_row - 1 : tr.end_row;
      const rows = [];
      for (let r = dataStart; r <= dataEnd; r++) {
        rows.push({
          cells: sheet.cells[r] ?? {},
          style: this.styles[r]
        });
      }
      rows.sort((a, b) => {
        const aVal = a.cells[colIndex]?.value ?? "";
        const bVal = b.cells[colIndex]?.value ?? "";
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        const bothNumeric = aVal !== "" && bVal !== "" && !isNaN(aNum) && !isNaN(bNum);
        const cmp = bothNumeric ? aNum - bNum : aVal.localeCompare(bVal);
        return ascending ? cmp : -cmp;
      });
      for (let i = 0; i < rows.length; i++) {
        const r = dataStart + i;
        sheet.cells[r] = rows[i].cells;
        if (rows[i].style) {
          this.styles[r] = rows[i].style;
        } else {
          delete this.styles[r];
        }
      }
      this.render();
    }
    /** Apply a value filter to a table column. Only rows with allowed values are shown. */
    applyFilter(tableName, colIndex, allowedValues) {
      this._activeFilters.set(`${tableName}:${colIndex}`, allowedValues);
      this._rebuildHiddenRows();
    }
    /** Clear the filter for a specific table column. */
    clearFilter(tableName, colIndex) {
      this._activeFilters.delete(`${tableName}:${colIndex}`);
      this._rebuildHiddenRows();
    }
    /** Recompute the set of hidden rows from all active filters. */
    _rebuildHiddenRows() {
      this._hiddenRows.clear();
      if (this._activeFilters.size === 0 || !this.data?.sheets?.[this._activeSheetIndex]) {
        this._layoutDirty = true;
        this.render();
        return;
      }
      const sheet = this.data.sheets[this._activeSheetIndex];
      const filtersOfTable = /* @__PURE__ */ new Map();
      for (const [key, allowed] of this._activeFilters) {
        const [tName, colStr] = key.split(":");
        if (!filtersOfTable.has(tName)) filtersOfTable.set(tName, []);
        filtersOfTable.get(tName).push({ colIndex: parseInt(colStr, 10), allowed });
      }
      for (const [tName, filters] of filtersOfTable) {
        const table = this.tables.find((t) => t.name === tName);
        if (!table) continue;
        const tr = table.range;
        const dataStart = table.has_header_row ? tr.start_row + 1 : tr.start_row;
        const dataEnd = table.has_totals_row ? tr.end_row - 1 : tr.end_row;
        for (let r = dataStart; r <= dataEnd; r++) {
          for (const f of filters) {
            const cellVal = sheet.cells?.[r]?.[f.colIndex]?.value ?? "";
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
          const dbInfo = this._cfDataBars.get(`${r}:${c}`);
          if (dbInfo) {
            const barW = Math.max(1, (cellW - 4) * dbInfo.ratio);
            this.ctx.fillStyle = dbInfo.color + "66";
            this.ctx.fillRect(x + 2, y + 2, barW, cellH - 4);
            this.ctx.strokeStyle = dbInfo.color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 2, y + 2, barW, cellH - 4);
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
          const iconInfo = this._cfIcons.get(`${r}:${c}`);
          if (iconInfo) {
            this.ctx.save();
            this.ctx.font = `bold ${Math.min(cellH - 4, 14)}px sans-serif`;
            this.ctx.fillStyle = iconInfo.color;
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(iconInfo.icon, x + 2, y + cellH / 2);
            this.ctx.restore();
          }
        }
      }
      this.drawSparklines(effHeaderWidth, effHeaderHeight);
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
      this._syncFilterButtons();
      if (this.onScrollChanged) this.onScrollChanged();
    }
    /** Draw sparkline mini-charts inside cells */
    drawSparklines(effHeaderWidth, effHeaderHeight) {
      if (!this.data?.sheets) return;
      const sheet = this.data.sheets[this._activeSheetIndex];
      if (!sheet?.sparklines || sheet.sparklines.length === 0) return;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(effHeaderWidth, effHeaderHeight, this.width - effHeaderWidth, this.height - effHeaderHeight);
      this.ctx.clip();
      for (const spark of sheet.sparklines) {
        const loc = this.parseSparklineCellRef(spark.location);
        if (!loc) continue;
        const cellX = this.cx(loc.col) - this.scrollLeft + effHeaderWidth;
        const cellY = this.ry(loc.row) - this.scrollTop + effHeaderHeight;
        const cellW = this.cw(loc.col);
        const cellH = this.rh(loc.row);
        if (cellX + cellW < effHeaderWidth || cellY + cellH < effHeaderHeight) continue;
        if (cellX > this.width || cellY > this.height) continue;
        const values = this.resolveSparklineData(spark.data_range, sheet);
        if (values.length === 0) continue;
        const color2 = spark.color || "#4472C4";
        const negColor = spark.negative_color || "#FF0000";
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
          case "line":
            this.drawLineSparkline(drawX, drawY, drawW, drawH, values, minVal, range, color2);
            break;
          case "column":
            this.drawColumnSparkline(drawX, drawY, drawW, drawH, values, minVal, range, color2, negColor);
            break;
          case "stacked":
            this.drawWinLossSparkline(drawX, drawY, drawW, drawH, values, color2, negColor);
            break;
          default:
            this.drawLineSparkline(drawX, drawY, drawW, drawH, values, minVal, range, color2);
        }
      }
      this.ctx.restore();
    }
    drawLineSparkline(x, y, w, h, values, minVal, range, color2) {
      if (values.length < 2) return;
      this.ctx.beginPath();
      this.ctx.strokeStyle = color2;
      this.ctx.lineWidth = 1.5;
      this.ctx.lineJoin = "round";
      const step = w / (values.length - 1);
      for (let i = 0; i < values.length; i++) {
        const px = x + i * step;
        const py = y + h - (values[i] - minVal) / range * h;
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.stroke();
    }
    drawColumnSparkline(x, y, w, h, values, minVal, range, color2, negColor) {
      const gap = 1;
      const barW = Math.max(1, (w - gap * (values.length - 1)) / values.length);
      const baseline = minVal >= 0 ? y + h : y + h * (1 - -minVal / range);
      for (let i = 0; i < values.length; i++) {
        const px = x + i * (barW + gap);
        const val = values[i];
        const barH = Math.abs(val) / range * h;
        const isNeg = val < 0;
        this.ctx.fillStyle = isNeg ? negColor : color2;
        if (isNeg) {
          this.ctx.fillRect(px, baseline, barW, Math.min(barH, y + h - baseline));
        } else {
          this.ctx.fillRect(px, baseline - barH, barW, barH);
        }
      }
    }
    drawWinLossSparkline(x, y, w, h, values, color2, negColor) {
      const gap = 1;
      const barW = Math.max(1, (w - gap * (values.length - 1)) / values.length);
      const halfH = h / 2;
      const midY = y + halfH;
      for (let i = 0; i < values.length; i++) {
        const px = x + i * (barW + gap);
        if (values[i] >= 0) {
          this.ctx.fillStyle = color2;
          this.ctx.fillRect(px, midY - halfH * 0.8, barW, halfH * 0.8);
        } else {
          this.ctx.fillStyle = negColor;
          this.ctx.fillRect(px, midY, barW, halfH * 0.8);
        }
      }
    }
    parseSparklineCellRef(ref) {
      const cleaned = ref.replace(/\$/g, "").replace(/.*!/, "");
      const m = cleaned.match(/^([A-Z]{1,3})(\d+)$/);
      if (!m) return null;
      let col = 0;
      for (let i = 0; i < m[1].length; i++) {
        col = col * 26 + (m[1].charCodeAt(i) - 64);
      }
      return { row: parseInt(m[2], 10) - 1, col: col - 1 };
    }
    resolveSparklineData(dataRange, sheet) {
      const range = dataRange.replace(/.*!/, "").replace(/\$/g, "");
      const parts = range.split(":");
      if (parts.length !== 2) return [];
      const start = this.parseSparklineCellRef(parts[0]);
      const end = this.parseSparklineCellRef(parts[1]);
      if (!start || !end) return [];
      const values = [];
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
      const cfStyle = this.evaluateConditionalFormats(row, col);
      if (!modelStyle && !overlay && !cfStyle) return overlay;
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
      if (cfStyle) {
        if (cfStyle.bold !== void 0) merged.bold = cfStyle.bold;
        if (cfStyle.italic !== void 0) merged.italic = cfStyle.italic;
        if (cfStyle.underline !== void 0) merged.underline = cfStyle.underline;
        if (cfStyle.textColor) merged.textColor = cfStyle.textColor;
        if (cfStyle.fillColor) merged.fillColor = cfStyle.fillColor;
        if (cfStyle.numberFormat) merged.numberFormat = cfStyle.numberFormat;
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
    /** Clear CF cache on data changes */
    _clearCfCache() {
      this._cfCache.clear();
      this._cfDataBars.clear();
      this._cfIcons.clear();
    }
    /** Check if (row, col) falls within a sqref range string like "A1:D10" or "A1:D10 F1:G5" */
    cellInRange(row, col, sqref) {
      const parts = sqref.split(/\s+/);
      for (const part of parts) {
        const colons = part.split(":");
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
    parseCfCellRef(ref) {
      const clean = ref.replace(/\$/g, "");
      let col = 0, row = 0, inDigits = false;
      for (const ch of clean) {
        if (!inDigits && ch >= "A" && ch <= "Z") {
          col = col * 26 + (ch.charCodeAt(0) - 64);
        } else if (!inDigits && ch >= "a" && ch <= "z") {
          col = col * 26 + (ch.charCodeAt(0) - 96);
        } else {
          inDigits = true;
          row = row * 10 + parseInt(ch);
        }
      }
      return [row - 1, col - 1];
    }
    /** Get sqref bounds as {minRow, minCol, maxRow, maxCol} */
    getSqrefBounds(sqref) {
      let minRow = Infinity, minCol = Infinity, maxRow = -1, maxCol = -1;
      const parts = sqref.split(/\s+/);
      for (const part of parts) {
        const colons = part.split(":");
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
    collectNumericValues(sqref) {
      const bounds = this.getSqrefBounds(sqref);
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      if (!sheet?.cells) return [];
      const values = [];
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
        const rowData = sheet.cells[r];
        if (!rowData) continue;
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
          if (!this.cellInRange(r, c, sqref)) continue;
          const cell = rowData[c];
          if (cell && cell.data_type === "n") {
            const n = parseFloat(cell.value);
            if (!isNaN(n)) values.push(n);
          }
        }
      }
      return values;
    }
    /** Collect all string values in a sqref range */
    collectStringValues(sqref) {
      const bounds = this.getSqrefBounds(sqref);
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      if (!sheet?.cells) return [];
      const values = [];
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
        const rowData = sheet.cells[r];
        if (!rowData) continue;
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
          if (!this.cellInRange(r, c, sqref)) continue;
          const cell = rowData[c];
          if (cell) values.push(cell.value ?? "");
        }
      }
      return values;
    }
    /** Get cell numeric value */
    getCellNumericValue(row, col) {
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      const cell = sheet?.cells?.[row]?.[col];
      if (!cell) return void 0;
      if (cell.data_type === "n") {
        const n = parseFloat(cell.value);
        return isNaN(n) ? void 0 : n;
      }
      return void 0;
    }
    /** Get cell string value */
    getCellStringValue(row, col) {
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      return sheet?.cells?.[row]?.[col]?.value ?? "";
    }
    /** Convert DxfStyle to CellStyle */
    dxfToCellStyle(dxf) {
      const style = {};
      if (dxf.bold) style.bold = true;
      if (dxf.italic) style.italic = true;
      if (dxf.underline) style.underline = true;
      if (dxf.text_color) style.textColor = dxf.text_color;
      if (dxf.fill_color) style.fillColor = dxf.fill_color;
      if (dxf.number_format) style.numberFormat = dxf.number_format;
      return style;
    }
    /** Evaluate all conditional formatting rules for a cell, returning a style override */
    evaluateConditionalFormats(row, col) {
      const sheet = this.data?.sheets?.[this._activeSheetIndex];
      if (!sheet?.conditional_formats?.length) return void 0;
      let result;
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
    evaluateRule(rule, ruleIndex, row, col) {
      switch (rule.rule_type) {
        case "cellIs":
          return this.evaluateCellIs(rule, row, col);
        case "containsText":
          return this.evaluateContainsText(rule, row, col, "contains");
        case "notContainsText":
          return this.evaluateContainsText(rule, row, col, "notContains");
        case "beginsWith":
          return this.evaluateContainsText(rule, row, col, "beginsWith");
        case "endsWith":
          return this.evaluateContainsText(rule, row, col, "endsWith");
        case "top10":
          return this.evaluateTop10(rule, ruleIndex, row, col);
        case "aboveAverage":
          return this.evaluateAboveAverage(rule, ruleIndex, row, col);
        case "duplicateValues":
          return this.evaluateDuplicateUnique(rule, ruleIndex, row, col, true);
        case "uniqueValues":
          return this.evaluateDuplicateUnique(rule, ruleIndex, row, col, false);
        case "containsBlanks": {
          const val = this.getCellStringValue(row, col);
          if (val.trim() === "") return rule.dxf_style ? this.dxfToCellStyle(rule.dxf_style) : {};
          return void 0;
        }
        case "notContainsBlanks": {
          const val = this.getCellStringValue(row, col);
          if (val.trim() !== "") return rule.dxf_style ? this.dxfToCellStyle(rule.dxf_style) : {};
          return void 0;
        }
        case "colorScale":
          return this.evaluateColorScale(rule, ruleIndex, row, col);
        case "dataBar": {
          this.evaluateDataBar(rule, ruleIndex, row, col);
          return void 0;
        }
        case "iconSet": {
          this.evaluateIconSet(rule, ruleIndex, row, col);
          return void 0;
        }
        case "expression":
          return this.evaluateExpression(rule, row, col);
        default:
          return void 0;
      }
    }
    evaluateCellIs(rule, row, col) {
      const cellVal = this.getCellNumericValue(row, col);
      if (cellVal === void 0) return void 0;
      const op = rule.operator || "greaterThan";
      const v1 = parseFloat(rule.values?.[0] ?? "0");
      const v2 = parseFloat(rule.values?.[1] ?? "0");
      let match = false;
      switch (op) {
        case "greaterThan":
          match = cellVal > v1;
          break;
        case "greaterThanOrEqual":
          match = cellVal >= v1;
          break;
        case "lessThan":
          match = cellVal < v1;
          break;
        case "lessThanOrEqual":
          match = cellVal <= v1;
          break;
        case "equal":
          match = cellVal === v1;
          break;
        case "notEqual":
          match = cellVal !== v1;
          break;
        case "between":
          match = cellVal >= v1 && cellVal <= v2;
          break;
        case "notBetween":
          match = cellVal < v1 || cellVal > v2;
          break;
      }
      if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
      return void 0;
    }
    evaluateContainsText(rule, row, col, mode) {
      const cellVal = this.getCellStringValue(row, col).toLowerCase();
      const text = (rule.text || rule.values?.[0] || "").toLowerCase();
      let match = false;
      switch (mode) {
        case "contains":
          match = cellVal.includes(text);
          break;
        case "notContains":
          match = !cellVal.includes(text);
          break;
        case "beginsWith":
          match = cellVal.startsWith(text);
          break;
        case "endsWith":
          match = cellVal.endsWith(text);
          break;
      }
      if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
      return void 0;
    }
    evaluateTop10(rule, ruleIndex, row, col) {
      const cellVal = this.getCellNumericValue(row, col);
      if (cellVal === void 0) return void 0;
      const cacheKey = ruleIndex;
      if (!this._cfCache.has(cacheKey)) {
        const values = this.collectNumericValues(rule.sqref);
        values.sort((a, b) => a - b);
        const rank = rule.rank || 10;
        const isBottom = rule.bottom === true;
        const isPercent = rule.percent === true;
        let count = isPercent ? Math.ceil(values.length * rank / 100) : rank;
        count = Math.min(count, values.length);
        let threshold;
        if (isBottom) {
          threshold = values[count - 1] ?? -Infinity;
          this._cfCache.set(cacheKey, { type: "bottom", threshold });
        } else {
          threshold = values[values.length - count] ?? Infinity;
          this._cfCache.set(cacheKey, { type: "top", threshold });
        }
      }
      const cache = this._cfCache.get(cacheKey);
      const match = cache.type === "top" ? cellVal >= cache.threshold : cellVal <= cache.threshold;
      if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
      return void 0;
    }
    evaluateAboveAverage(rule, ruleIndex, row, col) {
      const cellVal = this.getCellNumericValue(row, col);
      if (cellVal === void 0) return void 0;
      if (!this._cfCache.has(ruleIndex)) {
        const values = this.collectNumericValues(rule.sqref);
        const avg2 = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        this._cfCache.set(ruleIndex, { avg: avg2 });
      }
      const { avg } = this._cfCache.get(ruleIndex);
      const isAbove = rule.above_average !== false;
      const match = isAbove ? cellVal > avg : cellVal < avg;
      if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
      return void 0;
    }
    evaluateDuplicateUnique(rule, ruleIndex, row, col, wantDuplicate) {
      const cellVal = this.getCellStringValue(row, col);
      if (cellVal === "") return void 0;
      if (!this._cfCache.has(ruleIndex)) {
        const allValues = this.collectStringValues(rule.sqref);
        const counts2 = {};
        for (const v of allValues) {
          if (v !== "") counts2[v] = (counts2[v] || 0) + 1;
        }
        this._cfCache.set(ruleIndex, { counts: counts2 });
      }
      const { counts } = this._cfCache.get(ruleIndex);
      const isDuplicate = (counts[cellVal] || 0) > 1;
      const match = wantDuplicate ? isDuplicate : !isDuplicate;
      if (match && rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
      return void 0;
    }
    evaluateExpression(rule, row, col) {
      if (rule.dxf_style) return this.dxfToCellStyle(rule.dxf_style);
      return void 0;
    }
    /** Evaluate color scale and return a fill color */
    evaluateColorScale(rule, ruleIndex, row, col) {
      const cellVal = this.getCellNumericValue(row, col);
      if (cellVal === void 0) return void 0;
      const cs = rule.color_scale;
      if (!cs || !cs.colors || cs.colors.length < 2) return void 0;
      if (!this._cfCache.has(ruleIndex)) {
        const values = this.collectNumericValues(rule.sqref);
        const min2 = values.length > 0 ? Math.min(...values) : 0;
        const max2 = values.length > 0 ? Math.max(...values) : 1;
        this._cfCache.set(ruleIndex, { min: min2, max: max2 });
      }
      const { min, max } = this._cfCache.get(ruleIndex);
      const range = max - min || 1;
      const ratio = Math.max(0, Math.min(1, (cellVal - min) / range));
      let fillColor;
      if (cs.colors.length === 2) {
        fillColor = this.interpolateColor(cs.colors[0], cs.colors[1], ratio);
      } else {
        if (ratio <= 0.5) {
          fillColor = this.interpolateColor(cs.colors[0], cs.colors[1], ratio * 2);
        } else {
          fillColor = this.interpolateColor(cs.colors[1], cs.colors[2], (ratio - 0.5) * 2);
        }
      }
      return { fillColor };
    }
    /** Interpolate between two hex colors */
    interpolateColor(c1, c2, t) {
      const parse2 = (hex2) => {
        hex2 = hex2.replace("#", "");
        return [parseInt(hex2.substring(0, 2), 16), parseInt(hex2.substring(2, 4), 16), parseInt(hex2.substring(4, 6), 16)];
      };
      const [r1, g1, b1] = parse2(c1);
      const [r2, g2, b2] = parse2(c2);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
    /** Evaluate data bar — stores result in _cfDataBars map */
    evaluateDataBar(rule, ruleIndex, row, col) {
      const cellVal = this.getCellNumericValue(row, col);
      if (cellVal === void 0) return;
      const db = rule.data_bar;
      if (!db) return;
      if (!this._cfCache.has(ruleIndex)) {
        const values = this.collectNumericValues(rule.sqref);
        const min2 = values.length > 0 ? Math.min(...values) : 0;
        const max2 = values.length > 0 ? Math.max(...values) : 1;
        this._cfCache.set(ruleIndex, { min: min2, max: max2 });
      }
      const { min, max } = this._cfCache.get(ruleIndex);
      const range = max - min || 1;
      const ratio = Math.max(0, Math.min(1, (cellVal - min) / range));
      this._cfDataBars.set(`${row}:${col}`, { ratio, color: db.color || "#638EC6" });
    }
    /** Evaluate icon set — stores result in _cfIcons map */
    evaluateIconSet(rule, ruleIndex, row, col) {
      const cellVal = this.getCellNumericValue(row, col);
      if (cellVal === void 0) return;
      const is = rule.icon_set;
      if (!is) return;
      if (!this._cfCache.has(ruleIndex)) {
        const values = this.collectNumericValues(rule.sqref);
        const min2 = values.length > 0 ? Math.min(...values) : 0;
        const max2 = values.length > 0 ? Math.max(...values) : 1;
        this._cfCache.set(ruleIndex, { min: min2, max: max2 });
      }
      const { min, max } = this._cfCache.get(ruleIndex);
      const range = max - min || 1;
      const pct = (cellVal - min) / range * 100;
      const thresholds = is.thresholds && is.thresholds.length > 0 ? is.thresholds : this.getDefaultIconThresholds(is.icon_style);
      const iconInfo = this.getIconForValue(pct, thresholds, is.icon_style, is.reverse);
      this._cfIcons.set(`${row}:${col}`, iconInfo);
    }
    /** Get default thresholds for icon set styles */
    getDefaultIconThresholds(style) {
      if (style.startsWith("5")) return [20, 40, 60, 80];
      if (style.startsWith("4")) return [25, 50, 75];
      return [33, 67];
    }
    /** Get icon character and color for a given percentile value */
    getIconForValue(pct, thresholds, style, reverse) {
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
    getIconSet(style) {
      switch (style) {
        case "3Arrows":
        case "3ArrowsGray":
          return [
            { icon: "\u25BC", color: "#ff0000" },
            { icon: "\u25BA", color: "#ffbf00" },
            { icon: "\u25B2", color: "#00b050" }
          ];
        case "3TrafficLights1":
        case "3TrafficLights":
        case "3TrafficLights2":
          return [
            { icon: "\u25CF", color: "#ff0000" },
            { icon: "\u25CF", color: "#ffbf00" },
            { icon: "\u25CF", color: "#00b050" }
          ];
        case "3Flags":
          return [
            { icon: "\u2691", color: "#ff0000" },
            { icon: "\u2691", color: "#ffbf00" },
            { icon: "\u2691", color: "#00b050" }
          ];
        case "3Signs":
          return [
            { icon: "\u25C6", color: "#ff0000" },
            { icon: "\u25B2", color: "#ffbf00" },
            { icon: "\u25CF", color: "#00b050" }
          ];
        case "3Symbols":
        case "3Symbols2":
          return [
            { icon: "\u2715", color: "#ff0000" },
            { icon: "!", color: "#ffbf00" },
            { icon: "\u2713", color: "#00b050" }
          ];
        case "3Stars":
          return [
            { icon: "\u2606", color: "#ffbf00" },
            { icon: "\u2605", color: "#ffbf00" },
            { icon: "\u2605", color: "#ffbf00" }
          ];
        case "4Arrows":
        case "4ArrowsGray":
          return [
            { icon: "\u25BC", color: "#ff0000" },
            { icon: "\u25BE", color: "#ffbf00" },
            { icon: "\u25B4", color: "#92d050" },
            { icon: "\u25B2", color: "#00b050" }
          ];
        case "4RedToBlack":
          return [
            { icon: "\u25CF", color: "#000000" },
            { icon: "\u25CF", color: "#888888" },
            { icon: "\u25CF", color: "#ff6666" },
            { icon: "\u25CF", color: "#ff0000" }
          ];
        case "4TrafficLights":
          return [
            { icon: "\u25CF", color: "#ff0000" },
            { icon: "\u25CF", color: "#ffbf00" },
            { icon: "\u25CF", color: "#92d050" },
            { icon: "\u25CF", color: "#00b050" }
          ];
        case "5Arrows":
        case "5ArrowsGray":
          return [
            { icon: "\u25BC", color: "#ff0000" },
            { icon: "\u25BE", color: "#ff6666" },
            { icon: "\u25BA", color: "#ffbf00" },
            { icon: "\u25B4", color: "#92d050" },
            { icon: "\u25B2", color: "#00b050" }
          ];
        case "5Quarters":
          return [
            { icon: "\u25CB", color: "#888888" },
            { icon: "\u25D4", color: "#888888" },
            { icon: "\u25D1", color: "#888888" },
            { icon: "\u25D5", color: "#888888" },
            { icon: "\u25CF", color: "#888888" }
          ];
        default:
          return [
            { icon: "\u25CF", color: "#ff0000" },
            { icon: "\u25CF", color: "#ffbf00" },
            { icon: "\u25CF", color: "#00b050" }
          ];
      }
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
    convertRange: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><path d="M8 8l-2 2 2 2"/><path d="M8 8l2 2-2 2"/></svg>',
    condFormat: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/><rect x="1" y="1" width="6" height="5" fill="#ff6b6b" opacity=".6" rx="1"/><rect x="1" y="6" width="6" height="4" fill="#ffd93d" opacity=".6"/><rect x="1" y="10" width="6" height="5" fill="#6bcb77" opacity=".6" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/><rect x="10" y="3" width="4" height="2" fill="#4472c4" opacity=".7" rx=".5"/><rect x="10" y="7" width="2.5" height="2" fill="#4472c4" opacity=".7" rx=".5"/><rect x="10" y="11" width="1" height="2" fill="#4472c4" opacity=".7" rx=".5"/></svg>',
    chart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="14" height="14" rx="1"/><rect x="3" y="9" width="2" height="5" fill="#4472C4" stroke="none" rx=".3"/><rect x="7" y="5" width="2" height="9" fill="#ED7D31" stroke="none" rx=".3"/><rect x="11" y="7" width="2" height="7" fill="#70AD47" stroke="none" rx=".3"/></svg>'
  };
  var LIGHT_STYLES = [
    ["TableStyleLight1", { header: "#000000", band: "#f7f7f7", label: "Black" }],
    ["TableStyleLight2", { header: "#4472c4", band: "#edf2fa", label: "Blue" }],
    ["TableStyleLight3", { header: "#ed7d31", band: "#fef4eb", label: "Orange" }],
    ["TableStyleLight4", { header: "#a5a5a5", band: "#f5f5f5", label: "Gray" }],
    ["TableStyleLight5", { header: "#ffc000", band: "#fffbef", label: "Gold" }],
    ["TableStyleLight6", { header: "#5b9bd5", band: "#eef4fa", label: "Sky" }],
    ["TableStyleLight7", { header: "#70ad47", band: "#f0f7ec", label: "Green" }],
    ["TableStyleLight8", { header: "#000000", band: "#f2f2f2", label: "Black 2" }],
    ["TableStyleLight9", { header: "#4472c4", band: "#dbe5f5", label: "Blue 2" }],
    ["TableStyleLight10", { header: "#ed7d31", band: "#fce4cc", label: "Orange 2" }],
    ["TableStyleLight11", { header: "#a5a5a5", band: "#ececec", label: "Gray 2" }],
    ["TableStyleLight12", { header: "#ffc000", band: "#fff5d5", label: "Gold 2" }],
    ["TableStyleLight13", { header: "#5b9bd5", band: "#dde9f5", label: "Sky 2" }],
    ["TableStyleLight14", { header: "#70ad47", band: "#e2efda", label: "Green 2" }],
    ["TableStyleLight15", { header: "#000000", band: "#e8e8e8", label: "Black 3" }],
    ["TableStyleLight16", { header: "#4472c4", band: "#c9d8f0", label: "Blue 3" }],
    ["TableStyleLight17", { header: "#ed7d31", band: "#f9d5ad", label: "Orange 3" }],
    ["TableStyleLight18", { header: "#a5a5a5", band: "#e0e0e0", label: "Gray 3" }],
    ["TableStyleLight19", { header: "#ffc000", band: "#ffefb8", label: "Gold 3" }],
    ["TableStyleLight20", { header: "#5b9bd5", band: "#ccddf0", label: "Sky 3" }],
    ["TableStyleLight21", { header: "#70ad47", band: "#d4e7c8", label: "Green 3" }]
  ];
  var MEDIUM_STYLES = [
    ["TableStyleMedium1", { header: "#000000", band: "#e0e0e0", label: "Black" }],
    ["TableStyleMedium2", { header: "#4472c4", band: "#d6e4f0", label: "Blue" }],
    ["TableStyleMedium3", { header: "#ed7d31", band: "#fce4cc", label: "Orange" }],
    ["TableStyleMedium4", { header: "#a5a5a5", band: "#dcdcdc", label: "Gray" }],
    ["TableStyleMedium5", { header: "#ffc000", band: "#fff2cc", label: "Gold" }],
    ["TableStyleMedium6", { header: "#5b9bd5", band: "#dce6f0", label: "Sky" }],
    ["TableStyleMedium7", { header: "#70ad47", band: "#e2efda", label: "Green" }],
    ["TableStyleMedium8", { header: "#000000", band: "#d0d0d0", label: "Black 2" }],
    ["TableStyleMedium9", { header: "#4472c4", band: "#b8cde5", label: "Blue 2" }],
    ["TableStyleMedium10", { header: "#ed7d31", band: "#f9c99a", label: "Orange 2" }],
    ["TableStyleMedium11", { header: "#a5a5a5", band: "#cccccc", label: "Gray 2" }],
    ["TableStyleMedium12", { header: "#ffc000", band: "#ffe599", label: "Gold 2" }],
    ["TableStyleMedium13", { header: "#5b9bd5", band: "#bdd0e5", label: "Sky 2" }],
    ["TableStyleMedium14", { header: "#70ad47", band: "#c5dfb5", label: "Green 2" }],
    ["TableStyleMedium15", { header: "#000000", band: "#c0c0c0", label: "Black 3" }],
    ["TableStyleMedium16", { header: "#4472c4", band: "#9ab6da", label: "Blue 3" }],
    ["TableStyleMedium17", { header: "#ed7d31", band: "#f6ae68", label: "Orange 3" }],
    ["TableStyleMedium18", { header: "#a5a5a5", band: "#bcbcbc", label: "Gray 3" }],
    ["TableStyleMedium19", { header: "#ffc000", band: "#ffd966", label: "Gold 3" }],
    ["TableStyleMedium20", { header: "#5b9bd5", band: "#9dbada", label: "Sky 3" }],
    ["TableStyleMedium21", { header: "#70ad47", band: "#a8cf90", label: "Green 3" }],
    ["TableStyleMedium22", { header: "#000000", band: "#b0b0b0", label: "Black 4" }],
    ["TableStyleMedium23", { header: "#4472c4", band: "#7ca0cf", label: "Blue 4" }],
    ["TableStyleMedium24", { header: "#ed7d31", band: "#f39336", label: "Orange 4" }],
    ["TableStyleMedium25", { header: "#a5a5a5", band: "#aaaaaa", label: "Gray 4" }],
    ["TableStyleMedium26", { header: "#ffc000", band: "#ffcc33", label: "Gold 4" }],
    ["TableStyleMedium27", { header: "#5b9bd5", band: "#7ea4cf", label: "Sky 4" }],
    ["TableStyleMedium28", { header: "#70ad47", band: "#8bbf6b", label: "Green 4" }]
  ];
  var DARK_STYLES = [
    ["TableStyleDark1", { header: "#000000", band: "#404040", label: "Black" }],
    ["TableStyleDark2", { header: "#4472c4", band: "#2b4a7a", label: "Blue" }],
    ["TableStyleDark3", { header: "#ed7d31", band: "#7a4018", label: "Orange" }],
    ["TableStyleDark4", { header: "#a5a5a5", band: "#5a5a5a", label: "Gray" }],
    ["TableStyleDark5", { header: "#ffc000", band: "#8a6800", label: "Gold" }],
    ["TableStyleDark6", { header: "#5b9bd5", band: "#2f5e8a", label: "Sky" }],
    ["TableStyleDark7", { header: "#70ad47", band: "#3a5925", label: "Green" }],
    ["TableStyleDark8", { header: "#1a1a1a", band: "#333333", label: "Charcoal" }],
    ["TableStyleDark9", { header: "#264478", band: "#1a3060", label: "Navy" }],
    ["TableStyleDark10", { header: "#c55a11", band: "#6b3510", label: "Rust" }],
    ["TableStyleDark11", { header: "#7030a0", band: "#3d1a57", label: "Purple" }]
  ];
  var TABLE_STYLE_COLORS = {};
  for (const arr of [LIGHT_STYLES, MEDIUM_STYLES, DARK_STYLES]) {
    for (const [name, entry] of arr) {
      TABLE_STYLE_COLORS[name] = entry;
    }
  }
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
      const stylesGroup = this.group("Styles");
      const stylesBody = this.el("div", "group-body");
      stylesBody.appendChild(this.tallBtn(IC.condFormat, "Cond.\nFormat", "conditionalFormatting"));
      stylesGroup.insertBefore(stylesBody, stylesGroup.lastChild);
      panel.appendChild(stylesGroup);
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
      const chartGroup = this.group("Charts");
      const chartBody = this.el("div", "group-body");
      chartBody.appendChild(this.tallBtn(IC.chart, "Chart", "insertChart"));
      chartGroup.insertBefore(chartBody, chartGroup.lastChild);
      panel.appendChild(chartGroup);
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
    /** Visual table style picker — shows colored mini table previews in a categorized dropdown grid */
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
      dropdown.style.cssText = "display:none;position:fixed;z-index:9999;background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007fd4);border-radius:4px;padding:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);max-height:400px;overflow-y:auto;width:260px;";
      const allCells = [];
      const categories = [
        ["Light", LIGHT_STYLES],
        ["Medium", MEDIUM_STYLES],
        ["Dark", DARK_STYLES]
      ];
      for (const [catName, styles] of categories) {
        const header = document.createElement("div");
        header.textContent = catName;
        header.style.cssText = "font-size:11px;font-weight:bold;color:var(--vscode-descriptionForeground,#888);padding:4px 2px 2px;margin-top:4px;";
        dropdown.appendChild(header);
        const grid = document.createElement("div");
        grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:2px;";
        for (const [styleName, colors2] of styles) {
          const cell = document.createElement("button");
          cell.className = "table-style-cell";
          cell.title = `${catName} - ${colors2.label}`;
          cell.style.cssText = `border:2px solid ${styleName === this.selectedTableStyle ? "var(--vscode-focusBorder,#007fd4)" : "transparent"};border-radius:3px;padding:2px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
          cell.innerHTML = this.miniTableSvg(colors2.header, colors2.band);
          cell.onclick = () => {
            this.selectedTableStyle = styleName;
            const newColors = TABLE_STYLE_COLORS[styleName];
            trigger.innerHTML = `${this.miniTableSvg(newColors.header, newColors.band)}<span class="btn-label">Styles</span>`;
            allCells.forEach((c) => {
              c.style.borderColor = "transparent";
            });
            cell.style.borderColor = "var(--vscode-focusBorder,#007fd4)";
            dropdown.style.display = "none";
            this.onAction({ action: "setTableStyle", value: styleName });
          };
          allCells.push(cell);
          grid.appendChild(cell);
        }
        dropdown.appendChild(grid);
      }
      trigger.onclick = () => {
        const isHidden = dropdown.style.display === "none";
        if (isHidden) {
          const rect = trigger.getBoundingClientRect();
          dropdown.style.left = `${rect.left}px`;
          dropdown.style.top = `${rect.bottom + 2}px`;
          dropdown.style.display = "block";
          const dropRect = dropdown.getBoundingClientRect();
          if (dropRect.right > window.innerWidth) {
            dropdown.style.left = `${window.innerWidth - dropRect.width - 4}px`;
          }
          if (dropRect.bottom > window.innerHeight) {
            dropdown.style.top = `${rect.top - dropRect.height - 2}px`;
          }
        } else {
          dropdown.style.display = "none";
        }
      };
      document.addEventListener("mousedown", (e) => {
        const target = e.target;
        if (!wrapper.contains(target) && !dropdown.contains(target)) {
          dropdown.style.display = "none";
        }
      });
      wrapper.appendChild(trigger);
      document.body.appendChild(dropdown);
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

  // media/filterDropdown.ts
  var FilterDropdown = class {
    constructor(parent, onAction) {
      this.tableName = "";
      this.colIndex = 0;
      this.allValues = [];
      this.checkedValues = /* @__PURE__ */ new Set();
      this.onAction = onAction;
      this.container = document.createElement("div");
      this.container.className = "xlsx-filter-dropdown";
      this.container.style.display = "none";
      parent.appendChild(this.container);
      document.addEventListener("mousedown", (e) => {
        if (this.container.style.display !== "none" && !this.container.contains(e.target)) {
          this.hide();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.container.style.display !== "none") {
          this.hide();
        }
      });
    }
    show(x, y, tableName, colIndex, colName, uniqueValues, currentFilter) {
      this.tableName = tableName;
      this.colIndex = colIndex;
      this.allValues = uniqueValues;
      this.checkedValues = currentFilter ? new Set(currentFilter) : new Set(uniqueValues);
      this.container.innerHTML = "";
      this.buildUI(colName);
      this.container.style.left = `${x}px`;
      this.container.style.top = `${y}px`;
      this.container.style.display = "block";
      requestAnimationFrame(() => {
        const rect = this.container.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          this.container.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
          this.container.style.top = `${y - rect.height}px`;
        }
      });
      this.searchInput.focus();
    }
    hide() {
      this.container.style.display = "none";
    }
    buildUI(colName) {
      const sortSection = document.createElement("div");
      sortSection.className = "filter-sort-section";
      const sortAZ = this.createSortItem("\u2191 Sort A to Z", "sortAZ");
      const sortZA = this.createSortItem("\u2193 Sort Z to A", "sortZA");
      sortSection.appendChild(sortAZ);
      sortSection.appendChild(sortZA);
      this.container.appendChild(sortSection);
      this.addSeparator();
      const clearItem = document.createElement("div");
      clearItem.className = "filter-item filter-clear";
      clearItem.textContent = `Clear Filter From "${colName}"`;
      clearItem.onclick = () => {
        this.onAction({
          action: "clearFilter",
          tableName: this.tableName,
          colIndex: this.colIndex
        });
        this.hide();
      };
      this.container.appendChild(clearItem);
      this.addSeparator();
      this.searchInput = document.createElement("input");
      this.searchInput.className = "filter-search";
      this.searchInput.type = "text";
      this.searchInput.placeholder = "Search";
      this.searchInput.addEventListener("input", () => this.filterCheckboxList());
      this.container.appendChild(this.searchInput);
      const selectAllRow = document.createElement("label");
      selectAllRow.className = "filter-checkbox-row filter-select-all";
      this.selectAllCheckbox = document.createElement("input");
      this.selectAllCheckbox.type = "checkbox";
      this.selectAllCheckbox.checked = this.checkedValues.size === this.allValues.length;
      this.selectAllCheckbox.addEventListener("change", () => this.toggleSelectAll());
      const selectAllLabel = document.createElement("span");
      selectAllLabel.textContent = "(Select All)";
      selectAllRow.appendChild(this.selectAllCheckbox);
      selectAllRow.appendChild(selectAllLabel);
      this.container.appendChild(selectAllRow);
      this.checkboxList = document.createElement("div");
      this.checkboxList.className = "filter-checkbox-list";
      this.populateCheckboxes(this.allValues);
      this.container.appendChild(this.checkboxList);
      this.addSeparator();
      const btnRow = document.createElement("div");
      btnRow.className = "filter-btn-row";
      const okBtn = document.createElement("button");
      okBtn.className = "filter-btn filter-btn-ok";
      okBtn.textContent = "OK";
      okBtn.onclick = () => this.applyFilter();
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "filter-btn filter-btn-cancel";
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = () => this.hide();
      btnRow.appendChild(okBtn);
      btnRow.appendChild(cancelBtn);
      this.container.appendChild(btnRow);
    }
    createSortItem(label, action) {
      const el = document.createElement("div");
      el.className = "filter-item";
      el.textContent = label;
      el.onclick = () => {
        this.onAction({
          action,
          tableName: this.tableName,
          colIndex: this.colIndex
        });
        this.hide();
      };
      return el;
    }
    addSeparator() {
      const sep = document.createElement("div");
      sep.className = "filter-separator";
      this.container.appendChild(sep);
    }
    populateCheckboxes(values) {
      this.checkboxList.innerHTML = "";
      for (const val of values) {
        const row = document.createElement("label");
        row.className = "filter-checkbox-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = this.checkedValues.has(val);
        cb.dataset.value = val;
        cb.addEventListener("change", () => {
          if (cb.checked) {
            this.checkedValues.add(val);
          } else {
            this.checkedValues.delete(val);
          }
          this.updateSelectAll();
        });
        const label = document.createElement("span");
        label.textContent = val === "" ? "(Blanks)" : val;
        if (val === "") label.style.fontStyle = "italic";
        row.appendChild(cb);
        row.appendChild(label);
        this.checkboxList.appendChild(row);
      }
    }
    filterCheckboxList() {
      const query = this.searchInput.value.toLowerCase();
      const filtered = query ? this.allValues.filter((v) => v.toLowerCase().includes(query)) : this.allValues;
      this.populateCheckboxes(filtered);
    }
    toggleSelectAll() {
      const checked = this.selectAllCheckbox.checked;
      const boxes = this.checkboxList.querySelectorAll('input[type="checkbox"]');
      boxes.forEach((cb) => {
        cb.checked = checked;
        const val = cb.dataset.value ?? "";
        if (checked) {
          this.checkedValues.add(val);
        } else {
          this.checkedValues.delete(val);
        }
      });
    }
    updateSelectAll() {
      this.selectAllCheckbox.checked = this.checkedValues.size === this.allValues.length;
    }
    applyFilter() {
      if (this.checkedValues.size === this.allValues.length) {
        this.onAction({
          action: "clearFilter",
          tableName: this.tableName,
          colIndex: this.colIndex
        });
      } else {
        this.onAction({
          action: "filter",
          tableName: this.tableName,
          colIndex: this.colIndex,
          allowedValues: new Set(this.checkedValues)
        });
      }
      this.hide();
    }
  };

  // media/conditionalFormatDialog.ts
  var RULE_TYPES = [
    // Highlight Cells Rules
    { label: "Greater Than", value: "cellIs:greaterThan", category: "Highlight Cells Rules" },
    { label: "Less Than", value: "cellIs:lessThan", category: "Highlight Cells Rules" },
    { label: "Equal To", value: "cellIs:equal", category: "Highlight Cells Rules" },
    { label: "Not Equal To", value: "cellIs:notEqual", category: "Highlight Cells Rules" },
    { label: "Between", value: "cellIs:between", category: "Highlight Cells Rules" },
    { label: "Not Between", value: "cellIs:notBetween", category: "Highlight Cells Rules" },
    { label: "Text Contains", value: "containsText", category: "Highlight Cells Rules" },
    { label: "Text Does Not Contain", value: "notContainsText", category: "Highlight Cells Rules" },
    { label: "Text Begins With", value: "beginsWith", category: "Highlight Cells Rules" },
    { label: "Text Ends With", value: "endsWith", category: "Highlight Cells Rules" },
    { label: "Duplicate Values", value: "duplicateValues", category: "Highlight Cells Rules" },
    { label: "Unique Values", value: "uniqueValues", category: "Highlight Cells Rules" },
    { label: "Contains Blanks", value: "containsBlanks", category: "Highlight Cells Rules" },
    // Top/Bottom Rules
    { label: "Top N", value: "top10:top", category: "Top/Bottom Rules" },
    { label: "Bottom N", value: "top10:bottom", category: "Top/Bottom Rules" },
    { label: "Above Average", value: "aboveAverage:above", category: "Top/Bottom Rules" },
    { label: "Below Average", value: "aboveAverage:below", category: "Top/Bottom Rules" },
    // Color Scales
    { label: "2-Color Scale", value: "colorScale:2", category: "Color Scales" },
    { label: "3-Color Scale", value: "colorScale:3", category: "Color Scales" },
    // Data Bars
    { label: "Data Bar", value: "dataBar", category: "Data Bars" },
    // Icon Sets
    { label: "3 Arrows", value: "iconSet:3Arrows", category: "Icon Sets" },
    { label: "3 Traffic Lights", value: "iconSet:3TrafficLights1", category: "Icon Sets" },
    { label: "3 Symbols", value: "iconSet:3Symbols", category: "Icon Sets" },
    { label: "3 Stars", value: "iconSet:3Stars", category: "Icon Sets" },
    { label: "4 Arrows", value: "iconSet:4Arrows", category: "Icon Sets" },
    { label: "4 Traffic Lights", value: "iconSet:4TrafficLights", category: "Icon Sets" },
    { label: "5 Arrows", value: "iconSet:5Arrows", category: "Icon Sets" },
    { label: "5 Quarters", value: "iconSet:5Quarters", category: "Icon Sets" },
    // Formula
    { label: "Custom Formula", value: "expression", category: "Custom" }
  ];
  var PRESET_FORMATS = [
    { label: "Light Red Fill, Dark Red Text", textColor: "#9c0006", fillColor: "#ffc7ce" },
    { label: "Yellow Fill, Dark Yellow Text", textColor: "#9c6500", fillColor: "#ffeb9c" },
    { label: "Green Fill, Dark Green Text", textColor: "#006100", fillColor: "#c6efce" },
    { label: "Light Red Fill", textColor: "", fillColor: "#ffc7ce" },
    { label: "Light Yellow Fill", textColor: "", fillColor: "#ffeb9c" },
    { label: "Light Green Fill", textColor: "", fillColor: "#c6efce" },
    { label: "Red Text", textColor: "#ff0000", fillColor: "" },
    { label: "Custom Format...", textColor: "", fillColor: "" }
  ];
  var ConditionalFormatDialog = class {
    constructor(parent, onAction) {
      this.editIndex = null;
      this.existingRules = [];
      this.onAction = onAction;
      this.container = document.createElement("div");
      this.container.className = "cf-dialog";
      this.container.style.display = "none";
      parent.appendChild(this.container);
      this.build();
    }
    build() {
      this.container.innerHTML = "";
      const titleBar = document.createElement("div");
      titleBar.className = "cf-dialog-title";
      titleBar.textContent = "Conditional Formatting";
      const closeBtn = document.createElement("button");
      closeBtn.className = "cf-dialog-close";
      closeBtn.textContent = "\xD7";
      closeBtn.onclick = () => this.hide();
      titleBar.appendChild(closeBtn);
      this.container.appendChild(titleBar);
      this.makeDraggable(titleBar);
      const body = document.createElement("div");
      body.className = "cf-dialog-body";
      const rulesSection = document.createElement("div");
      rulesSection.className = "cf-dialog-section";
      const rulesLabel = document.createElement("div");
      rulesLabel.className = "cf-dialog-label";
      rulesLabel.textContent = "Active Rules:";
      rulesSection.appendChild(rulesLabel);
      this.ruleListArea = document.createElement("div");
      this.ruleListArea.className = "cf-rule-list";
      rulesSection.appendChild(this.ruleListArea);
      body.appendChild(rulesSection);
      const newRuleSection = document.createElement("div");
      newRuleSection.className = "cf-dialog-section";
      const newRuleLabel = document.createElement("div");
      newRuleLabel.className = "cf-dialog-label";
      newRuleLabel.textContent = "New Rule:";
      newRuleSection.appendChild(newRuleLabel);
      const typeRow = document.createElement("div");
      typeRow.className = "cf-dialog-row";
      const typeLabel = document.createElement("label");
      typeLabel.textContent = "Rule Type:";
      typeLabel.className = "cf-input-label";
      this.ruleTypeSelect = document.createElement("select");
      this.ruleTypeSelect.className = "cf-select";
      let currentCategory = "";
      let optgroup = null;
      for (const rt of RULE_TYPES) {
        if (rt.category !== currentCategory) {
          currentCategory = rt.category;
          optgroup = document.createElement("optgroup");
          optgroup.label = currentCategory;
          this.ruleTypeSelect.appendChild(optgroup);
        }
        const opt = document.createElement("option");
        opt.value = rt.value;
        opt.textContent = rt.label;
        (optgroup || this.ruleTypeSelect).appendChild(opt);
      }
      this.ruleTypeSelect.onchange = () => this.updateConfigUI();
      typeRow.appendChild(typeLabel);
      typeRow.appendChild(this.ruleTypeSelect);
      newRuleSection.appendChild(typeRow);
      const rangeRow = document.createElement("div");
      rangeRow.className = "cf-dialog-row";
      const rangeLabel = document.createElement("label");
      rangeLabel.textContent = "Applies to:";
      rangeLabel.className = "cf-input-label";
      this.rangeInput = document.createElement("input");
      this.rangeInput.className = "cf-input";
      this.rangeInput.placeholder = "e.g., A1:D10";
      rangeRow.appendChild(rangeLabel);
      rangeRow.appendChild(this.rangeInput);
      newRuleSection.appendChild(rangeRow);
      this.configArea = document.createElement("div");
      this.configArea.className = "cf-config-area";
      newRuleSection.appendChild(this.configArea);
      this.previewArea = document.createElement("div");
      this.previewArea.className = "cf-preview";
      this.previewArea.textContent = "Preview: AaBbCcYyZz";
      newRuleSection.appendChild(this.previewArea);
      body.appendChild(newRuleSection);
      this.container.appendChild(body);
      const footer = document.createElement("div");
      footer.className = "cf-dialog-footer";
      const addBtn = document.createElement("button");
      addBtn.className = "cf-btn cf-btn-primary";
      addBtn.textContent = "Add Rule";
      addBtn.onclick = () => this.submitRule();
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "cf-btn";
      cancelBtn.textContent = "Close";
      cancelBtn.onclick = () => this.hide();
      footer.appendChild(addBtn);
      footer.appendChild(cancelBtn);
      this.container.appendChild(footer);
      this.updateConfigUI();
    }
    updateConfigUI() {
      this.configArea.innerHTML = "";
      const val = this.ruleTypeSelect.value;
      const [ruleType, subType] = val.split(":");
      if (ruleType === "cellIs") {
        const isBetween = subType === "between" || subType === "notBetween";
        const row = document.createElement("div");
        row.className = "cf-dialog-row";
        const label = document.createElement("label");
        label.className = "cf-input-label";
        label.textContent = isBetween ? "Values:" : "Value:";
        row.appendChild(label);
        const v1 = document.createElement("input");
        v1.className = "cf-input";
        v1.type = "number";
        v1.placeholder = isBetween ? "Min" : "Value";
        v1.dataset.cfField = "value1";
        row.appendChild(v1);
        if (isBetween) {
          const andLabel = document.createElement("span");
          andLabel.textContent = " and ";
          andLabel.style.margin = "0 4px";
          row.appendChild(andLabel);
          const v2 = document.createElement("input");
          v2.className = "cf-input";
          v2.type = "number";
          v2.placeholder = "Max";
          v2.dataset.cfField = "value2";
          row.appendChild(v2);
        }
        this.configArea.appendChild(row);
        this.addFormatSelector();
      } else if (["containsText", "notContainsText", "beginsWith", "endsWith"].includes(ruleType)) {
        const row = document.createElement("div");
        row.className = "cf-dialog-row";
        const label = document.createElement("label");
        label.className = "cf-input-label";
        label.textContent = "Text:";
        const inp = document.createElement("input");
        inp.className = "cf-input";
        inp.placeholder = "Search text";
        inp.dataset.cfField = "text";
        row.appendChild(label);
        row.appendChild(inp);
        this.configArea.appendChild(row);
        this.addFormatSelector();
      } else if (ruleType === "top10") {
        const row = document.createElement("div");
        row.className = "cf-dialog-row";
        const label = document.createElement("label");
        label.className = "cf-input-label";
        label.textContent = "Count:";
        const inp = document.createElement("input");
        inp.className = "cf-input";
        inp.type = "number";
        inp.value = "10";
        inp.min = "1";
        inp.dataset.cfField = "rank";
        row.appendChild(label);
        row.appendChild(inp);
        const pctLabel = document.createElement("label");
        pctLabel.style.marginLeft = "8px";
        const pctCheck = document.createElement("input");
        pctCheck.type = "checkbox";
        pctCheck.dataset.cfField = "percent";
        pctLabel.appendChild(pctCheck);
        pctLabel.appendChild(document.createTextNode(" %"));
        row.appendChild(pctLabel);
        this.configArea.appendChild(row);
        this.addFormatSelector();
      } else if (ruleType === "aboveAverage") {
        this.addFormatSelector();
      } else if (ruleType === "duplicateValues" || ruleType === "uniqueValues" || ruleType === "containsBlanks") {
        this.addFormatSelector();
      } else if (ruleType === "colorScale") {
        const nColors = subType === "2" ? 2 : 3;
        const row = document.createElement("div");
        row.className = "cf-dialog-row";
        const label = document.createElement("label");
        label.className = "cf-input-label";
        label.textContent = "Colors:";
        row.appendChild(label);
        const defaults2 = ["#F8696B", "#63BE7B"];
        const defaults3 = ["#F8696B", "#FFEB84", "#63BE7B"];
        const defaults4 = nColors === 2 ? defaults2 : defaults3;
        for (let i = 0; i < nColors; i++) {
          const cp = document.createElement("input");
          cp.type = "color";
          cp.className = "cf-color-input";
          cp.value = defaults4[i];
          cp.dataset.cfField = `csColor${i}`;
          row.appendChild(cp);
        }
        this.configArea.appendChild(row);
      } else if (ruleType === "dataBar") {
        const row = document.createElement("div");
        row.className = "cf-dialog-row";
        const label = document.createElement("label");
        label.className = "cf-input-label";
        label.textContent = "Bar Color:";
        const cp = document.createElement("input");
        cp.type = "color";
        cp.className = "cf-color-input";
        cp.value = "#638EC6";
        cp.dataset.cfField = "dbColor";
        row.appendChild(label);
        row.appendChild(cp);
        this.configArea.appendChild(row);
      } else if (ruleType === "iconSet") {
        const note = document.createElement("div");
        note.className = "cf-dialog-note";
        note.textContent = `Icon set: ${subType || "3TrafficLights1"}`;
        this.configArea.appendChild(note);
      } else if (ruleType === "expression") {
        const row = document.createElement("div");
        row.className = "cf-dialog-row";
        const label = document.createElement("label");
        label.className = "cf-input-label";
        label.textContent = "Formula:";
        const inp = document.createElement("input");
        inp.className = "cf-input";
        inp.placeholder = "=ISODD(A1)";
        inp.dataset.cfField = "formula";
        row.appendChild(label);
        row.appendChild(inp);
        this.configArea.appendChild(row);
        this.addFormatSelector();
      }
      this.updatePreview();
    }
    addFormatSelector() {
      const row = document.createElement("div");
      row.className = "cf-dialog-row";
      const label = document.createElement("label");
      label.className = "cf-input-label";
      label.textContent = "Format:";
      row.appendChild(label);
      const sel = document.createElement("select");
      sel.className = "cf-select";
      sel.dataset.cfField = "formatPreset";
      for (const preset of PRESET_FORMATS) {
        const opt = document.createElement("option");
        opt.value = JSON.stringify(preset);
        opt.textContent = preset.label;
        sel.appendChild(opt);
      }
      sel.onchange = () => this.updatePreview();
      row.appendChild(sel);
      this.configArea.appendChild(row);
      const customRow = document.createElement("div");
      customRow.className = "cf-dialog-row cf-custom-colors";
      customRow.style.display = "none";
      const tcLabel = document.createElement("label");
      tcLabel.className = "cf-input-label";
      tcLabel.textContent = "Text:";
      const tcInput = document.createElement("input");
      tcInput.type = "color";
      tcInput.className = "cf-color-input";
      tcInput.value = "#ff0000";
      tcInput.dataset.cfField = "customTextColor";
      const fcLabel = document.createElement("label");
      fcLabel.className = "cf-input-label";
      fcLabel.textContent = "Fill:";
      fcLabel.style.marginLeft = "8px";
      const fcInput = document.createElement("input");
      fcInput.type = "color";
      fcInput.className = "cf-color-input";
      fcInput.value = "#ffc7ce";
      fcInput.dataset.cfField = "customFillColor";
      customRow.appendChild(tcLabel);
      customRow.appendChild(tcInput);
      customRow.appendChild(fcLabel);
      customRow.appendChild(fcInput);
      this.configArea.appendChild(customRow);
      sel.addEventListener("change", () => {
        const v = JSON.parse(sel.value);
        customRow.style.display = v.label === "Custom Format..." ? "flex" : "none";
        this.updatePreview();
      });
    }
    updatePreview() {
      const format = this.getSelectedFormat();
      this.previewArea.style.color = format.textColor || "#000";
      this.previewArea.style.backgroundColor = format.fillColor || "transparent";
      this.previewArea.textContent = "Preview: AaBbCcYyZz";
    }
    getSelectedFormat() {
      const presetSel = this.configArea.querySelector('[data-cf-field="formatPreset"]');
      if (presetSel) {
        const v = JSON.parse(presetSel.value);
        if (v.label === "Custom Format...") {
          const tc = this.configArea.querySelector('[data-cf-field="customTextColor"]')?.value || "";
          const fc = this.configArea.querySelector('[data-cf-field="customFillColor"]')?.value || "";
          return { textColor: tc, fillColor: fc };
        }
        return { textColor: v.textColor, fillColor: v.fillColor };
      }
      return { textColor: "", fillColor: "" };
    }
    submitRule() {
      const sqref = this.rangeInput.value.trim();
      if (!sqref) {
        this.rangeInput.style.borderColor = "#ff0000";
        return;
      }
      this.rangeInput.style.borderColor = "";
      const rule = this.buildRuleFromUI();
      if (!rule) return;
      rule.sqref = sqref;
      if (this.editIndex !== null) {
        this.onAction({ action: "edit", rule, ruleIndex: this.editIndex });
        this.editIndex = null;
      } else {
        this.onAction({ action: "add", rule });
      }
      this.refreshRuleList();
    }
    buildRuleFromUI() {
      const selected = this.ruleTypeSelect.value;
      const [baseType, subType] = selected.split(":");
      const rule = {
        rule_type: baseType,
        priority: this.existingRules.length + 1,
        values: [],
        sqref: ""
      };
      if (baseType === "cellIs") {
        rule.operator = subType;
        const v1 = this.configArea.querySelector('[data-cf-field="value1"]')?.value || "0";
        rule.values = [v1];
        if (subType === "between" || subType === "notBetween") {
          const v2 = this.configArea.querySelector('[data-cf-field="value2"]')?.value || "0";
          rule.values = [v1, v2];
        }
        const fmt = this.getSelectedFormat();
        rule.dxf_style = {};
        if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
        if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
      } else if (["containsText", "notContainsText", "beginsWith", "endsWith"].includes(baseType)) {
        const text = this.configArea.querySelector('[data-cf-field="text"]')?.value || "";
        rule.text = text;
        const fmt = this.getSelectedFormat();
        rule.dxf_style = {};
        if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
        if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
      } else if (baseType === "top10") {
        const rank = parseInt(this.configArea.querySelector('[data-cf-field="rank"]')?.value || "10");
        const pct = this.configArea.querySelector('[data-cf-field="percent"]')?.checked || false;
        rule.rank = rank;
        rule.percent = pct;
        rule.bottom = subType === "bottom";
        const fmt = this.getSelectedFormat();
        rule.dxf_style = {};
        if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
        if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
      } else if (baseType === "aboveAverage") {
        rule.above_average = subType !== "below";
        const fmt = this.getSelectedFormat();
        rule.dxf_style = {};
        if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
        if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
      } else if (baseType === "duplicateValues" || baseType === "uniqueValues" || baseType === "containsBlanks") {
        const fmt = this.getSelectedFormat();
        rule.dxf_style = {};
        if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
        if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
      } else if (baseType === "colorScale") {
        const nColors = subType === "2" ? 2 : 3;
        const colors2 = [];
        for (let i = 0; i < nColors; i++) {
          const cp = this.configArea.querySelector(`[data-cf-field="csColor${i}"]`);
          colors2.push(cp?.value || "#000000");
        }
        rule.color_scale = { colors: colors2, values: [], value_types: ["min", ...nColors === 3 ? ["percentile"] : [], "max"] };
      } else if (baseType === "dataBar") {
        const cp = this.configArea.querySelector('[data-cf-field="dbColor"]');
        rule.data_bar = { color: cp?.value || "#638EC6" };
      } else if (baseType === "iconSet") {
        rule.icon_set = { icon_style: subType || "3TrafficLights1", thresholds: [], reverse: false };
      } else if (baseType === "expression") {
        const formula = this.configArea.querySelector('[data-cf-field="formula"]')?.value || "";
        rule.values = [formula];
        const fmt = this.getSelectedFormat();
        rule.dxf_style = {};
        if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
        if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
      }
      return rule;
    }
    refreshRuleList() {
      this.ruleListArea.innerHTML = "";
      if (this.existingRules.length === 0) {
        const empty = document.createElement("div");
        empty.className = "cf-rule-empty";
        empty.textContent = "No conditional formatting rules.";
        this.ruleListArea.appendChild(empty);
        return;
      }
      for (let i = 0; i < this.existingRules.length; i++) {
        const rule = this.existingRules[i];
        const item = document.createElement("div");
        item.className = "cf-rule-item";
        const desc = document.createElement("span");
        desc.className = "cf-rule-desc";
        desc.textContent = this.describeRule(rule);
        const range = document.createElement("span");
        range.className = "cf-rule-range";
        range.textContent = rule.sqref;
        const delBtn = document.createElement("button");
        delBtn.className = "cf-rule-delete";
        delBtn.textContent = "\xD7";
        delBtn.title = "Delete rule";
        const idx = i;
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.onAction({ action: "delete", ruleIndex: idx });
          this.existingRules.splice(idx, 1);
          this.refreshRuleList();
        };
        item.appendChild(desc);
        item.appendChild(range);
        item.appendChild(delBtn);
        if (rule.dxf_style) {
          const preview = document.createElement("span");
          preview.className = "cf-rule-preview";
          preview.textContent = "Ab";
          if (rule.dxf_style.text_color) preview.style.color = rule.dxf_style.text_color;
          if (rule.dxf_style.fill_color) preview.style.backgroundColor = rule.dxf_style.fill_color;
          item.insertBefore(preview, range);
        }
        this.ruleListArea.appendChild(item);
      }
    }
    describeRule(rule) {
      switch (rule.rule_type) {
        case "cellIs":
          return `Cell ${rule.operator || "is"} ${rule.values?.join(", ") || ""}`;
        case "containsText":
          return `Contains "${rule.text || ""}"`;
        case "notContainsText":
          return `Does not contain "${rule.text || ""}"`;
        case "beginsWith":
          return `Begins with "${rule.text || ""}"`;
        case "endsWith":
          return `Ends with "${rule.text || ""}"`;
        case "top10":
          return `${rule.bottom ? "Bottom" : "Top"} ${rule.rank || 10}${rule.percent ? "%" : ""}`;
        case "aboveAverage":
          return rule.above_average !== false ? "Above Average" : "Below Average";
        case "duplicateValues":
          return "Duplicate Values";
        case "uniqueValues":
          return "Unique Values";
        case "containsBlanks":
          return "Contains Blanks";
        case "colorScale":
          return `${rule.color_scale?.colors?.length || 2}-Color Scale`;
        case "dataBar":
          return "Data Bar";
        case "iconSet":
          return `Icon Set (${rule.icon_set?.icon_style || "3TrafficLights"})`;
        case "expression":
          return `Formula: ${rule.values?.[0] || ""}`;
        default:
          return rule.rule_type;
      }
    }
    show(sqref, existingRules) {
      this.existingRules = existingRules || [];
      this.rangeInput.value = sqref;
      this.editIndex = null;
      this.ruleTypeSelect.value = RULE_TYPES[0].value;
      this.updateConfigUI();
      this.refreshRuleList();
      this.container.style.display = "flex";
    }
    hide() {
      this.container.style.display = "none";
      this.onAction({ action: "close" });
    }
    isVisible() {
      return this.container.style.display !== "none";
    }
    makeDraggable(handle) {
      let dragging = false;
      let offsetX = 0;
      let offsetY = 0;
      handle.style.cursor = "move";
      handle.addEventListener("mousedown", (e) => {
        dragging = true;
        const rect = this.container.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        e.preventDefault();
      });
      document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        this.container.style.left = `${e.clientX - offsetX}px`;
        this.container.style.top = `${e.clientY - offsetY}px`;
        this.container.style.right = "auto";
        this.container.style.bottom = "auto";
      });
      document.addEventListener("mouseup", () => {
        dragging = false;
      });
    }
  };

  // ../../../../../../../../node_modules/@kurkle/color/dist/color.esm.js
  function round(v) {
    return v + 0.5 | 0;
  }
  var lim = (v, l, h) => Math.max(Math.min(v, h), l);
  function p2b(v) {
    return lim(round(v * 2.55), 0, 255);
  }
  function n2b(v) {
    return lim(round(v * 255), 0, 255);
  }
  function b2n(v) {
    return lim(round(v / 2.55) / 100, 0, 1);
  }
  function n2p(v) {
    return lim(round(v * 100), 0, 100);
  }
  var map$1 = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, a: 10, b: 11, c: 12, d: 13, e: 14, f: 15 };
  var hex = [..."0123456789ABCDEF"];
  var h1 = (b) => hex[b & 15];
  var h2 = (b) => hex[(b & 240) >> 4] + hex[b & 15];
  var eq = (b) => (b & 240) >> 4 === (b & 15);
  var isShort = (v) => eq(v.r) && eq(v.g) && eq(v.b) && eq(v.a);
  function hexParse(str) {
    var len = str.length;
    var ret;
    if (str[0] === "#") {
      if (len === 4 || len === 5) {
        ret = {
          r: 255 & map$1[str[1]] * 17,
          g: 255 & map$1[str[2]] * 17,
          b: 255 & map$1[str[3]] * 17,
          a: len === 5 ? map$1[str[4]] * 17 : 255
        };
      } else if (len === 7 || len === 9) {
        ret = {
          r: map$1[str[1]] << 4 | map$1[str[2]],
          g: map$1[str[3]] << 4 | map$1[str[4]],
          b: map$1[str[5]] << 4 | map$1[str[6]],
          a: len === 9 ? map$1[str[7]] << 4 | map$1[str[8]] : 255
        };
      }
    }
    return ret;
  }
  var alpha = (a, f) => a < 255 ? f(a) : "";
  function hexString(v) {
    var f = isShort(v) ? h1 : h2;
    return v ? "#" + f(v.r) + f(v.g) + f(v.b) + alpha(v.a, f) : void 0;
  }
  var HUE_RE = /^(hsla?|hwb|hsv)\(\s*([-+.e\d]+)(?:deg)?[\s,]+([-+.e\d]+)%[\s,]+([-+.e\d]+)%(?:[\s,]+([-+.e\d]+)(%)?)?\s*\)$/;
  function hsl2rgbn(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return [f(0), f(8), f(4)];
  }
  function hsv2rgbn(h, s, v) {
    const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [f(5), f(3), f(1)];
  }
  function hwb2rgbn(h, w, b) {
    const rgb = hsl2rgbn(h, 1, 0.5);
    let i;
    if (w + b > 1) {
      i = 1 / (w + b);
      w *= i;
      b *= i;
    }
    for (i = 0; i < 3; i++) {
      rgb[i] *= 1 - w - b;
      rgb[i] += w;
    }
    return rgb;
  }
  function hueValue(r, g, b, d, max) {
    if (r === max) {
      return (g - b) / d + (g < b ? 6 : 0);
    }
    if (g === max) {
      return (b - r) / d + 2;
    }
    return (r - g) / d + 4;
  }
  function rgb2hsl(v) {
    const range = 255;
    const r = v.r / range;
    const g = v.g / range;
    const b = v.b / range;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h, s, d;
    if (max !== min) {
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = hueValue(r, g, b, d, max);
      h = h * 60 + 0.5;
    }
    return [h | 0, s || 0, l];
  }
  function calln(f, a, b, c) {
    return (Array.isArray(a) ? f(a[0], a[1], a[2]) : f(a, b, c)).map(n2b);
  }
  function hsl2rgb(h, s, l) {
    return calln(hsl2rgbn, h, s, l);
  }
  function hwb2rgb(h, w, b) {
    return calln(hwb2rgbn, h, w, b);
  }
  function hsv2rgb(h, s, v) {
    return calln(hsv2rgbn, h, s, v);
  }
  function hue(h) {
    return (h % 360 + 360) % 360;
  }
  function hueParse(str) {
    const m = HUE_RE.exec(str);
    let a = 255;
    let v;
    if (!m) {
      return;
    }
    if (m[5] !== v) {
      a = m[6] ? p2b(+m[5]) : n2b(+m[5]);
    }
    const h = hue(+m[2]);
    const p1 = +m[3] / 100;
    const p2 = +m[4] / 100;
    if (m[1] === "hwb") {
      v = hwb2rgb(h, p1, p2);
    } else if (m[1] === "hsv") {
      v = hsv2rgb(h, p1, p2);
    } else {
      v = hsl2rgb(h, p1, p2);
    }
    return {
      r: v[0],
      g: v[1],
      b: v[2],
      a
    };
  }
  function rotate(v, deg) {
    var h = rgb2hsl(v);
    h[0] = hue(h[0] + deg);
    h = hsl2rgb(h);
    v.r = h[0];
    v.g = h[1];
    v.b = h[2];
  }
  function hslString(v) {
    if (!v) {
      return;
    }
    const a = rgb2hsl(v);
    const h = a[0];
    const s = n2p(a[1]);
    const l = n2p(a[2]);
    return v.a < 255 ? `hsla(${h}, ${s}%, ${l}%, ${b2n(v.a)})` : `hsl(${h}, ${s}%, ${l}%)`;
  }
  var map = {
    x: "dark",
    Z: "light",
    Y: "re",
    X: "blu",
    W: "gr",
    V: "medium",
    U: "slate",
    A: "ee",
    T: "ol",
    S: "or",
    B: "ra",
    C: "lateg",
    D: "ights",
    R: "in",
    Q: "turquois",
    E: "hi",
    P: "ro",
    O: "al",
    N: "le",
    M: "de",
    L: "yello",
    F: "en",
    K: "ch",
    G: "arks",
    H: "ea",
    I: "ightg",
    J: "wh"
  };
  var names$1 = {
    OiceXe: "f0f8ff",
    antiquewEte: "faebd7",
    aqua: "ffff",
    aquamarRe: "7fffd4",
    azuY: "f0ffff",
    beige: "f5f5dc",
    bisque: "ffe4c4",
    black: "0",
    blanKedOmond: "ffebcd",
    Xe: "ff",
    XeviTet: "8a2be2",
    bPwn: "a52a2a",
    burlywood: "deb887",
    caMtXe: "5f9ea0",
    KartYuse: "7fff00",
    KocTate: "d2691e",
    cSO: "ff7f50",
    cSnflowerXe: "6495ed",
    cSnsilk: "fff8dc",
    crimson: "dc143c",
    cyan: "ffff",
    xXe: "8b",
    xcyan: "8b8b",
    xgTMnPd: "b8860b",
    xWay: "a9a9a9",
    xgYF: "6400",
    xgYy: "a9a9a9",
    xkhaki: "bdb76b",
    xmagFta: "8b008b",
    xTivegYF: "556b2f",
    xSange: "ff8c00",
    xScEd: "9932cc",
    xYd: "8b0000",
    xsOmon: "e9967a",
    xsHgYF: "8fbc8f",
    xUXe: "483d8b",
    xUWay: "2f4f4f",
    xUgYy: "2f4f4f",
    xQe: "ced1",
    xviTet: "9400d3",
    dAppRk: "ff1493",
    dApskyXe: "bfff",
    dimWay: "696969",
    dimgYy: "696969",
    dodgerXe: "1e90ff",
    fiYbrick: "b22222",
    flSOwEte: "fffaf0",
    foYstWAn: "228b22",
    fuKsia: "ff00ff",
    gaRsbSo: "dcdcdc",
    ghostwEte: "f8f8ff",
    gTd: "ffd700",
    gTMnPd: "daa520",
    Way: "808080",
    gYF: "8000",
    gYFLw: "adff2f",
    gYy: "808080",
    honeyMw: "f0fff0",
    hotpRk: "ff69b4",
    RdianYd: "cd5c5c",
    Rdigo: "4b0082",
    ivSy: "fffff0",
    khaki: "f0e68c",
    lavFMr: "e6e6fa",
    lavFMrXsh: "fff0f5",
    lawngYF: "7cfc00",
    NmoncEffon: "fffacd",
    ZXe: "add8e6",
    ZcSO: "f08080",
    Zcyan: "e0ffff",
    ZgTMnPdLw: "fafad2",
    ZWay: "d3d3d3",
    ZgYF: "90ee90",
    ZgYy: "d3d3d3",
    ZpRk: "ffb6c1",
    ZsOmon: "ffa07a",
    ZsHgYF: "20b2aa",
    ZskyXe: "87cefa",
    ZUWay: "778899",
    ZUgYy: "778899",
    ZstAlXe: "b0c4de",
    ZLw: "ffffe0",
    lime: "ff00",
    limegYF: "32cd32",
    lRF: "faf0e6",
    magFta: "ff00ff",
    maPon: "800000",
    VaquamarRe: "66cdaa",
    VXe: "cd",
    VScEd: "ba55d3",
    VpurpN: "9370db",
    VsHgYF: "3cb371",
    VUXe: "7b68ee",
    VsprRggYF: "fa9a",
    VQe: "48d1cc",
    VviTetYd: "c71585",
    midnightXe: "191970",
    mRtcYam: "f5fffa",
    mistyPse: "ffe4e1",
    moccasR: "ffe4b5",
    navajowEte: "ffdead",
    navy: "80",
    Tdlace: "fdf5e6",
    Tive: "808000",
    TivedBb: "6b8e23",
    Sange: "ffa500",
    SangeYd: "ff4500",
    ScEd: "da70d6",
    pOegTMnPd: "eee8aa",
    pOegYF: "98fb98",
    pOeQe: "afeeee",
    pOeviTetYd: "db7093",
    papayawEp: "ffefd5",
    pHKpuff: "ffdab9",
    peru: "cd853f",
    pRk: "ffc0cb",
    plum: "dda0dd",
    powMrXe: "b0e0e6",
    purpN: "800080",
    YbeccapurpN: "663399",
    Yd: "ff0000",
    Psybrown: "bc8f8f",
    PyOXe: "4169e1",
    saddNbPwn: "8b4513",
    sOmon: "fa8072",
    sandybPwn: "f4a460",
    sHgYF: "2e8b57",
    sHshell: "fff5ee",
    siFna: "a0522d",
    silver: "c0c0c0",
    skyXe: "87ceeb",
    UXe: "6a5acd",
    UWay: "708090",
    UgYy: "708090",
    snow: "fffafa",
    sprRggYF: "ff7f",
    stAlXe: "4682b4",
    tan: "d2b48c",
    teO: "8080",
    tEstN: "d8bfd8",
    tomato: "ff6347",
    Qe: "40e0d0",
    viTet: "ee82ee",
    JHt: "f5deb3",
    wEte: "ffffff",
    wEtesmoke: "f5f5f5",
    Lw: "ffff00",
    LwgYF: "9acd32"
  };
  function unpack() {
    const unpacked = {};
    const keys = Object.keys(names$1);
    const tkeys = Object.keys(map);
    let i, j, k, ok, nk;
    for (i = 0; i < keys.length; i++) {
      ok = nk = keys[i];
      for (j = 0; j < tkeys.length; j++) {
        k = tkeys[j];
        nk = nk.replace(k, map[k]);
      }
      k = parseInt(names$1[ok], 16);
      unpacked[nk] = [k >> 16 & 255, k >> 8 & 255, k & 255];
    }
    return unpacked;
  }
  var names;
  function nameParse(str) {
    if (!names) {
      names = unpack();
      names.transparent = [0, 0, 0, 0];
    }
    const a = names[str.toLowerCase()];
    return a && {
      r: a[0],
      g: a[1],
      b: a[2],
      a: a.length === 4 ? a[3] : 255
    };
  }
  var RGB_RE = /^rgba?\(\s*([-+.\d]+)(%)?[\s,]+([-+.e\d]+)(%)?[\s,]+([-+.e\d]+)(%)?(?:[\s,/]+([-+.e\d]+)(%)?)?\s*\)$/;
  function rgbParse(str) {
    const m = RGB_RE.exec(str);
    let a = 255;
    let r, g, b;
    if (!m) {
      return;
    }
    if (m[7] !== r) {
      const v = +m[7];
      a = m[8] ? p2b(v) : lim(v * 255, 0, 255);
    }
    r = +m[1];
    g = +m[3];
    b = +m[5];
    r = 255 & (m[2] ? p2b(r) : lim(r, 0, 255));
    g = 255 & (m[4] ? p2b(g) : lim(g, 0, 255));
    b = 255 & (m[6] ? p2b(b) : lim(b, 0, 255));
    return {
      r,
      g,
      b,
      a
    };
  }
  function rgbString(v) {
    return v && (v.a < 255 ? `rgba(${v.r}, ${v.g}, ${v.b}, ${b2n(v.a)})` : `rgb(${v.r}, ${v.g}, ${v.b})`);
  }
  var to = (v) => v <= 31308e-7 ? v * 12.92 : Math.pow(v, 1 / 2.4) * 1.055 - 0.055;
  var from = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  function interpolate(rgb1, rgb2, t) {
    const r = from(b2n(rgb1.r));
    const g = from(b2n(rgb1.g));
    const b = from(b2n(rgb1.b));
    return {
      r: n2b(to(r + t * (from(b2n(rgb2.r)) - r))),
      g: n2b(to(g + t * (from(b2n(rgb2.g)) - g))),
      b: n2b(to(b + t * (from(b2n(rgb2.b)) - b))),
      a: rgb1.a + t * (rgb2.a - rgb1.a)
    };
  }
  function modHSL(v, i, ratio) {
    if (v) {
      let tmp = rgb2hsl(v);
      tmp[i] = Math.max(0, Math.min(tmp[i] + tmp[i] * ratio, i === 0 ? 360 : 1));
      tmp = hsl2rgb(tmp);
      v.r = tmp[0];
      v.g = tmp[1];
      v.b = tmp[2];
    }
  }
  function clone(v, proto) {
    return v ? Object.assign(proto || {}, v) : v;
  }
  function fromObject(input) {
    var v = { r: 0, g: 0, b: 0, a: 255 };
    if (Array.isArray(input)) {
      if (input.length >= 3) {
        v = { r: input[0], g: input[1], b: input[2], a: 255 };
        if (input.length > 3) {
          v.a = n2b(input[3]);
        }
      }
    } else {
      v = clone(input, { r: 0, g: 0, b: 0, a: 1 });
      v.a = n2b(v.a);
    }
    return v;
  }
  function functionParse(str) {
    if (str.charAt(0) === "r") {
      return rgbParse(str);
    }
    return hueParse(str);
  }
  var Color = class _Color {
    constructor(input) {
      if (input instanceof _Color) {
        return input;
      }
      const type = typeof input;
      let v;
      if (type === "object") {
        v = fromObject(input);
      } else if (type === "string") {
        v = hexParse(input) || nameParse(input) || functionParse(input);
      }
      this._rgb = v;
      this._valid = !!v;
    }
    get valid() {
      return this._valid;
    }
    get rgb() {
      var v = clone(this._rgb);
      if (v) {
        v.a = b2n(v.a);
      }
      return v;
    }
    set rgb(obj) {
      this._rgb = fromObject(obj);
    }
    rgbString() {
      return this._valid ? rgbString(this._rgb) : void 0;
    }
    hexString() {
      return this._valid ? hexString(this._rgb) : void 0;
    }
    hslString() {
      return this._valid ? hslString(this._rgb) : void 0;
    }
    mix(color2, weight) {
      if (color2) {
        const c1 = this.rgb;
        const c2 = color2.rgb;
        let w2;
        const p = weight === w2 ? 0.5 : weight;
        const w = 2 * p - 1;
        const a = c1.a - c2.a;
        const w1 = ((w * a === -1 ? w : (w + a) / (1 + w * a)) + 1) / 2;
        w2 = 1 - w1;
        c1.r = 255 & w1 * c1.r + w2 * c2.r + 0.5;
        c1.g = 255 & w1 * c1.g + w2 * c2.g + 0.5;
        c1.b = 255 & w1 * c1.b + w2 * c2.b + 0.5;
        c1.a = p * c1.a + (1 - p) * c2.a;
        this.rgb = c1;
      }
      return this;
    }
    interpolate(color2, t) {
      if (color2) {
        this._rgb = interpolate(this._rgb, color2._rgb, t);
      }
      return this;
    }
    clone() {
      return new _Color(this.rgb);
    }
    alpha(a) {
      this._rgb.a = n2b(a);
      return this;
    }
    clearer(ratio) {
      const rgb = this._rgb;
      rgb.a *= 1 - ratio;
      return this;
    }
    greyscale() {
      const rgb = this._rgb;
      const val = round(rgb.r * 0.3 + rgb.g * 0.59 + rgb.b * 0.11);
      rgb.r = rgb.g = rgb.b = val;
      return this;
    }
    opaquer(ratio) {
      const rgb = this._rgb;
      rgb.a *= 1 + ratio;
      return this;
    }
    negate() {
      const v = this._rgb;
      v.r = 255 - v.r;
      v.g = 255 - v.g;
      v.b = 255 - v.b;
      return this;
    }
    lighten(ratio) {
      modHSL(this._rgb, 2, ratio);
      return this;
    }
    darken(ratio) {
      modHSL(this._rgb, 2, -ratio);
      return this;
    }
    saturate(ratio) {
      modHSL(this._rgb, 1, ratio);
      return this;
    }
    desaturate(ratio) {
      modHSL(this._rgb, 1, -ratio);
      return this;
    }
    rotate(deg) {
      rotate(this._rgb, deg);
      return this;
    }
  };

  // ../../../../../../../../node_modules/chart.js/dist/chunks/helpers.dataset.js
  function noop() {
  }
  var uid = /* @__PURE__ */ (() => {
    let id = 0;
    return () => id++;
  })();
  function isNullOrUndef(value) {
    return value === null || value === void 0;
  }
  function isArray(value) {
    if (Array.isArray && Array.isArray(value)) {
      return true;
    }
    const type = Object.prototype.toString.call(value);
    if (type.slice(0, 7) === "[object" && type.slice(-6) === "Array]") {
      return true;
    }
    return false;
  }
  function isObject(value) {
    return value !== null && Object.prototype.toString.call(value) === "[object Object]";
  }
  function isNumberFinite(value) {
    return (typeof value === "number" || value instanceof Number) && isFinite(+value);
  }
  function finiteOrDefault(value, defaultValue) {
    return isNumberFinite(value) ? value : defaultValue;
  }
  function valueOrDefault(value, defaultValue) {
    return typeof value === "undefined" ? defaultValue : value;
  }
  var toPercentage = (value, dimension) => typeof value === "string" && value.endsWith("%") ? parseFloat(value) / 100 : +value / dimension;
  var toDimension = (value, dimension) => typeof value === "string" && value.endsWith("%") ? parseFloat(value) / 100 * dimension : +value;
  function callback(fn, args, thisArg) {
    if (fn && typeof fn.call === "function") {
      return fn.apply(thisArg, args);
    }
  }
  function each(loopable, fn, thisArg, reverse) {
    let i, len, keys;
    if (isArray(loopable)) {
      len = loopable.length;
      if (reverse) {
        for (i = len - 1; i >= 0; i--) {
          fn.call(thisArg, loopable[i], i);
        }
      } else {
        for (i = 0; i < len; i++) {
          fn.call(thisArg, loopable[i], i);
        }
      }
    } else if (isObject(loopable)) {
      keys = Object.keys(loopable);
      len = keys.length;
      for (i = 0; i < len; i++) {
        fn.call(thisArg, loopable[keys[i]], keys[i]);
      }
    }
  }
  function _elementsEqual(a0, a1) {
    let i, ilen, v0, v1;
    if (!a0 || !a1 || a0.length !== a1.length) {
      return false;
    }
    for (i = 0, ilen = a0.length; i < ilen; ++i) {
      v0 = a0[i];
      v1 = a1[i];
      if (v0.datasetIndex !== v1.datasetIndex || v0.index !== v1.index) {
        return false;
      }
    }
    return true;
  }
  function clone2(source) {
    if (isArray(source)) {
      return source.map(clone2);
    }
    if (isObject(source)) {
      const target = /* @__PURE__ */ Object.create(null);
      const keys = Object.keys(source);
      const klen = keys.length;
      let k = 0;
      for (; k < klen; ++k) {
        target[keys[k]] = clone2(source[keys[k]]);
      }
      return target;
    }
    return source;
  }
  function isValidKey(key) {
    return [
      "__proto__",
      "prototype",
      "constructor"
    ].indexOf(key) === -1;
  }
  function _merger(key, target, source, options) {
    if (!isValidKey(key)) {
      return;
    }
    const tval = target[key];
    const sval = source[key];
    if (isObject(tval) && isObject(sval)) {
      merge(tval, sval, options);
    } else {
      target[key] = clone2(sval);
    }
  }
  function merge(target, source, options) {
    const sources = isArray(source) ? source : [
      source
    ];
    const ilen = sources.length;
    if (!isObject(target)) {
      return target;
    }
    options = options || {};
    const merger = options.merger || _merger;
    let current;
    for (let i = 0; i < ilen; ++i) {
      current = sources[i];
      if (!isObject(current)) {
        continue;
      }
      const keys = Object.keys(current);
      for (let k = 0, klen = keys.length; k < klen; ++k) {
        merger(keys[k], target, current, options);
      }
    }
    return target;
  }
  function mergeIf(target, source) {
    return merge(target, source, {
      merger: _mergerIf
    });
  }
  function _mergerIf(key, target, source) {
    if (!isValidKey(key)) {
      return;
    }
    const tval = target[key];
    const sval = source[key];
    if (isObject(tval) && isObject(sval)) {
      mergeIf(tval, sval);
    } else if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = clone2(sval);
    }
  }
  var keyResolvers = {
    // Chart.helpers.core resolveObjectKey should resolve empty key to root object
    "": (v) => v,
    // default resolvers
    x: (o) => o.x,
    y: (o) => o.y
  };
  function _splitKey(key) {
    const parts = key.split(".");
    const keys = [];
    let tmp = "";
    for (const part of parts) {
      tmp += part;
      if (tmp.endsWith("\\")) {
        tmp = tmp.slice(0, -1) + ".";
      } else {
        keys.push(tmp);
        tmp = "";
      }
    }
    return keys;
  }
  function _getKeyResolver(key) {
    const keys = _splitKey(key);
    return (obj) => {
      for (const k of keys) {
        if (k === "") {
          break;
        }
        obj = obj && obj[k];
      }
      return obj;
    };
  }
  function resolveObjectKey(obj, key) {
    const resolver = keyResolvers[key] || (keyResolvers[key] = _getKeyResolver(key));
    return resolver(obj);
  }
  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  var defined = (value) => typeof value !== "undefined";
  var isFunction = (value) => typeof value === "function";
  var setsEqual = (a, b) => {
    if (a.size !== b.size) {
      return false;
    }
    for (const item of a) {
      if (!b.has(item)) {
        return false;
      }
    }
    return true;
  };
  function _isClickEvent(e) {
    return e.type === "mouseup" || e.type === "click" || e.type === "contextmenu";
  }
  var PI = Math.PI;
  var TAU = 2 * PI;
  var PITAU = TAU + PI;
  var INFINITY = Number.POSITIVE_INFINITY;
  var RAD_PER_DEG = PI / 180;
  var HALF_PI = PI / 2;
  var QUARTER_PI = PI / 4;
  var TWO_THIRDS_PI = PI * 2 / 3;
  var log10 = Math.log10;
  var sign = Math.sign;
  function almostEquals(x, y, epsilon) {
    return Math.abs(x - y) < epsilon;
  }
  function niceNum(range) {
    const roundedRange = Math.round(range);
    range = almostEquals(range, roundedRange, range / 1e3) ? roundedRange : range;
    const niceRange = Math.pow(10, Math.floor(log10(range)));
    const fraction = range / niceRange;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * niceRange;
  }
  function _factorize(value) {
    const result = [];
    const sqrt = Math.sqrt(value);
    let i;
    for (i = 1; i < sqrt; i++) {
      if (value % i === 0) {
        result.push(i);
        result.push(value / i);
      }
    }
    if (sqrt === (sqrt | 0)) {
      result.push(sqrt);
    }
    result.sort((a, b) => a - b).pop();
    return result;
  }
  function isNonPrimitive(n) {
    return typeof n === "symbol" || typeof n === "object" && n !== null && !(Symbol.toPrimitive in n || "toString" in n || "valueOf" in n);
  }
  function isNumber(n) {
    return !isNonPrimitive(n) && !isNaN(parseFloat(n)) && isFinite(n);
  }
  function almostWhole(x, epsilon) {
    const rounded = Math.round(x);
    return rounded - epsilon <= x && rounded + epsilon >= x;
  }
  function _setMinAndMaxByKey(array, target, property) {
    let i, ilen, value;
    for (i = 0, ilen = array.length; i < ilen; i++) {
      value = array[i][property];
      if (!isNaN(value)) {
        target.min = Math.min(target.min, value);
        target.max = Math.max(target.max, value);
      }
    }
  }
  function toRadians(degrees) {
    return degrees * (PI / 180);
  }
  function toDegrees(radians) {
    return radians * (180 / PI);
  }
  function _decimalPlaces(x) {
    if (!isNumberFinite(x)) {
      return;
    }
    let e = 1;
    let p = 0;
    while (Math.round(x * e) / e !== x) {
      e *= 10;
      p++;
    }
    return p;
  }
  function getAngleFromPoint(centrePoint, anglePoint) {
    const distanceFromXCenter = anglePoint.x - centrePoint.x;
    const distanceFromYCenter = anglePoint.y - centrePoint.y;
    const radialDistanceFromCenter = Math.sqrt(distanceFromXCenter * distanceFromXCenter + distanceFromYCenter * distanceFromYCenter);
    let angle = Math.atan2(distanceFromYCenter, distanceFromXCenter);
    if (angle < -0.5 * PI) {
      angle += TAU;
    }
    return {
      angle,
      distance: radialDistanceFromCenter
    };
  }
  function distanceBetweenPoints(pt1, pt2) {
    return Math.sqrt(Math.pow(pt2.x - pt1.x, 2) + Math.pow(pt2.y - pt1.y, 2));
  }
  function _angleDiff(a, b) {
    return (a - b + PITAU) % TAU - PI;
  }
  function _normalizeAngle(a) {
    return (a % TAU + TAU) % TAU;
  }
  function _angleBetween(angle, start, end, sameAngleIsFullCircle) {
    const a = _normalizeAngle(angle);
    const s = _normalizeAngle(start);
    const e = _normalizeAngle(end);
    const angleToStart = _normalizeAngle(s - a);
    const angleToEnd = _normalizeAngle(e - a);
    const startToAngle = _normalizeAngle(a - s);
    const endToAngle = _normalizeAngle(a - e);
    return a === s || a === e || sameAngleIsFullCircle && s === e || angleToStart > angleToEnd && startToAngle < endToAngle;
  }
  function _limitValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function _int16Range(value) {
    return _limitValue(value, -32768, 32767);
  }
  function _isBetween(value, start, end, epsilon = 1e-6) {
    return value >= Math.min(start, end) - epsilon && value <= Math.max(start, end) + epsilon;
  }
  function _lookup(table, value, cmp) {
    cmp = cmp || ((index2) => table[index2] < value);
    let hi = table.length - 1;
    let lo = 0;
    let mid;
    while (hi - lo > 1) {
      mid = lo + hi >> 1;
      if (cmp(mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return {
      lo,
      hi
    };
  }
  var _lookupByKey = (table, key, value, last) => _lookup(table, value, last ? (index2) => {
    const ti = table[index2][key];
    return ti < value || ti === value && table[index2 + 1][key] === value;
  } : (index2) => table[index2][key] < value);
  var _rlookupByKey = (table, key, value) => _lookup(table, value, (index2) => table[index2][key] >= value);
  function _filterBetween(values, min, max) {
    let start = 0;
    let end = values.length;
    while (start < end && values[start] < min) {
      start++;
    }
    while (end > start && values[end - 1] > max) {
      end--;
    }
    return start > 0 || end < values.length ? values.slice(start, end) : values;
  }
  var arrayEvents = [
    "push",
    "pop",
    "shift",
    "splice",
    "unshift"
  ];
  function listenArrayEvents(array, listener) {
    if (array._chartjs) {
      array._chartjs.listeners.push(listener);
      return;
    }
    Object.defineProperty(array, "_chartjs", {
      configurable: true,
      enumerable: false,
      value: {
        listeners: [
          listener
        ]
      }
    });
    arrayEvents.forEach((key) => {
      const method = "_onData" + _capitalize(key);
      const base = array[key];
      Object.defineProperty(array, key, {
        configurable: true,
        enumerable: false,
        value(...args) {
          const res = base.apply(this, args);
          array._chartjs.listeners.forEach((object) => {
            if (typeof object[method] === "function") {
              object[method](...args);
            }
          });
          return res;
        }
      });
    });
  }
  function unlistenArrayEvents(array, listener) {
    const stub = array._chartjs;
    if (!stub) {
      return;
    }
    const listeners = stub.listeners;
    const index2 = listeners.indexOf(listener);
    if (index2 !== -1) {
      listeners.splice(index2, 1);
    }
    if (listeners.length > 0) {
      return;
    }
    arrayEvents.forEach((key) => {
      delete array[key];
    });
    delete array._chartjs;
  }
  function _arrayUnique(items) {
    const set2 = new Set(items);
    if (set2.size === items.length) {
      return items;
    }
    return Array.from(set2);
  }
  var requestAnimFrame = (function() {
    if (typeof window === "undefined") {
      return function(callback2) {
        return callback2();
      };
    }
    return window.requestAnimationFrame;
  })();
  function throttled(fn, thisArg) {
    let argsToUse = [];
    let ticking = false;
    return function(...args) {
      argsToUse = args;
      if (!ticking) {
        ticking = true;
        requestAnimFrame.call(window, () => {
          ticking = false;
          fn.apply(thisArg, argsToUse);
        });
      }
    };
  }
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      if (delay) {
        clearTimeout(timeout);
        timeout = setTimeout(fn, delay, args);
      } else {
        fn.apply(this, args);
      }
      return delay;
    };
  }
  var _toLeftRightCenter = (align) => align === "start" ? "left" : align === "end" ? "right" : "center";
  var _alignStartEnd = (align, start, end) => align === "start" ? start : align === "end" ? end : (start + end) / 2;
  var _textX = (align, left, right, rtl) => {
    const check = rtl ? "left" : "right";
    return align === check ? right : align === "center" ? (left + right) / 2 : left;
  };
  function _getStartAndCountOfVisiblePoints(meta, points, animationsDisabled) {
    const pointCount = points.length;
    let start = 0;
    let count = pointCount;
    if (meta._sorted) {
      const { iScale, vScale, _parsed } = meta;
      const spanGaps = meta.dataset ? meta.dataset.options ? meta.dataset.options.spanGaps : null : null;
      const axis = iScale.axis;
      const { min, max, minDefined, maxDefined } = iScale.getUserBounds();
      if (minDefined) {
        start = Math.min(
          // @ts-expect-error Need to type _parsed
          _lookupByKey(_parsed, axis, min).lo,
          // @ts-expect-error Need to fix types on _lookupByKey
          animationsDisabled ? pointCount : _lookupByKey(points, axis, iScale.getPixelForValue(min)).lo
        );
        if (spanGaps) {
          const distanceToDefinedLo = _parsed.slice(0, start + 1).reverse().findIndex((point) => !isNullOrUndef(point[vScale.axis]));
          start -= Math.max(0, distanceToDefinedLo);
        }
        start = _limitValue(start, 0, pointCount - 1);
      }
      if (maxDefined) {
        let end = Math.max(
          // @ts-expect-error Need to type _parsed
          _lookupByKey(_parsed, iScale.axis, max, true).hi + 1,
          // @ts-expect-error Need to fix types on _lookupByKey
          animationsDisabled ? 0 : _lookupByKey(points, axis, iScale.getPixelForValue(max), true).hi + 1
        );
        if (spanGaps) {
          const distanceToDefinedHi = _parsed.slice(end - 1).findIndex((point) => !isNullOrUndef(point[vScale.axis]));
          end += Math.max(0, distanceToDefinedHi);
        }
        count = _limitValue(end, start, pointCount) - start;
      } else {
        count = pointCount - start;
      }
    }
    return {
      start,
      count
    };
  }
  function _scaleRangesChanged(meta) {
    const { xScale, yScale, _scaleRanges } = meta;
    const newRanges = {
      xmin: xScale.min,
      xmax: xScale.max,
      ymin: yScale.min,
      ymax: yScale.max
    };
    if (!_scaleRanges) {
      meta._scaleRanges = newRanges;
      return true;
    }
    const changed = _scaleRanges.xmin !== xScale.min || _scaleRanges.xmax !== xScale.max || _scaleRanges.ymin !== yScale.min || _scaleRanges.ymax !== yScale.max;
    Object.assign(_scaleRanges, newRanges);
    return changed;
  }
  var atEdge = (t) => t === 0 || t === 1;
  var elasticIn = (t, s, p) => -(Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * TAU / p));
  var elasticOut = (t, s, p) => Math.pow(2, -10 * t) * Math.sin((t - s) * TAU / p) + 1;
  var effects = {
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => -t * (t - 2),
    easeInOutQuad: (t) => (t /= 0.5) < 1 ? 0.5 * t * t : -0.5 * (--t * (t - 2) - 1),
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (t -= 1) * t * t + 1,
    easeInOutCubic: (t) => (t /= 0.5) < 1 ? 0.5 * t * t * t : 0.5 * ((t -= 2) * t * t + 2),
    easeInQuart: (t) => t * t * t * t,
    easeOutQuart: (t) => -((t -= 1) * t * t * t - 1),
    easeInOutQuart: (t) => (t /= 0.5) < 1 ? 0.5 * t * t * t * t : -0.5 * ((t -= 2) * t * t * t - 2),
    easeInQuint: (t) => t * t * t * t * t,
    easeOutQuint: (t) => (t -= 1) * t * t * t * t + 1,
    easeInOutQuint: (t) => (t /= 0.5) < 1 ? 0.5 * t * t * t * t * t : 0.5 * ((t -= 2) * t * t * t * t + 2),
    easeInSine: (t) => -Math.cos(t * HALF_PI) + 1,
    easeOutSine: (t) => Math.sin(t * HALF_PI),
    easeInOutSine: (t) => -0.5 * (Math.cos(PI * t) - 1),
    easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
    easeOutExpo: (t) => t === 1 ? 1 : -Math.pow(2, -10 * t) + 1,
    easeInOutExpo: (t) => atEdge(t) ? t : t < 0.5 ? 0.5 * Math.pow(2, 10 * (t * 2 - 1)) : 0.5 * (-Math.pow(2, -10 * (t * 2 - 1)) + 2),
    easeInCirc: (t) => t >= 1 ? t : -(Math.sqrt(1 - t * t) - 1),
    easeOutCirc: (t) => Math.sqrt(1 - (t -= 1) * t),
    easeInOutCirc: (t) => (t /= 0.5) < 1 ? -0.5 * (Math.sqrt(1 - t * t) - 1) : 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1),
    easeInElastic: (t) => atEdge(t) ? t : elasticIn(t, 0.075, 0.3),
    easeOutElastic: (t) => atEdge(t) ? t : elasticOut(t, 0.075, 0.3),
    easeInOutElastic(t) {
      const s = 0.1125;
      const p = 0.45;
      return atEdge(t) ? t : t < 0.5 ? 0.5 * elasticIn(t * 2, s, p) : 0.5 + 0.5 * elasticOut(t * 2 - 1, s, p);
    },
    easeInBack(t) {
      const s = 1.70158;
      return t * t * ((s + 1) * t - s);
    },
    easeOutBack(t) {
      const s = 1.70158;
      return (t -= 1) * t * ((s + 1) * t + s) + 1;
    },
    easeInOutBack(t) {
      let s = 1.70158;
      if ((t /= 0.5) < 1) {
        return 0.5 * (t * t * (((s *= 1.525) + 1) * t - s));
      }
      return 0.5 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2);
    },
    easeInBounce: (t) => 1 - effects.easeOutBounce(1 - t),
    easeOutBounce(t) {
      const m = 7.5625;
      const d = 2.75;
      if (t < 1 / d) {
        return m * t * t;
      }
      if (t < 2 / d) {
        return m * (t -= 1.5 / d) * t + 0.75;
      }
      if (t < 2.5 / d) {
        return m * (t -= 2.25 / d) * t + 0.9375;
      }
      return m * (t -= 2.625 / d) * t + 0.984375;
    },
    easeInOutBounce: (t) => t < 0.5 ? effects.easeInBounce(t * 2) * 0.5 : effects.easeOutBounce(t * 2 - 1) * 0.5 + 0.5
  };
  function isPatternOrGradient(value) {
    if (value && typeof value === "object") {
      const type = value.toString();
      return type === "[object CanvasPattern]" || type === "[object CanvasGradient]";
    }
    return false;
  }
  function color(value) {
    return isPatternOrGradient(value) ? value : new Color(value);
  }
  function getHoverColor(value) {
    return isPatternOrGradient(value) ? value : new Color(value).saturate(0.5).darken(0.1).hexString();
  }
  var numbers = [
    "x",
    "y",
    "borderWidth",
    "radius",
    "tension"
  ];
  var colors = [
    "color",
    "borderColor",
    "backgroundColor"
  ];
  function applyAnimationsDefaults(defaults2) {
    defaults2.set("animation", {
      delay: void 0,
      duration: 1e3,
      easing: "easeOutQuart",
      fn: void 0,
      from: void 0,
      loop: void 0,
      to: void 0,
      type: void 0
    });
    defaults2.describe("animation", {
      _fallback: false,
      _indexable: false,
      _scriptable: (name) => name !== "onProgress" && name !== "onComplete" && name !== "fn"
    });
    defaults2.set("animations", {
      colors: {
        type: "color",
        properties: colors
      },
      numbers: {
        type: "number",
        properties: numbers
      }
    });
    defaults2.describe("animations", {
      _fallback: "animation"
    });
    defaults2.set("transitions", {
      active: {
        animation: {
          duration: 400
        }
      },
      resize: {
        animation: {
          duration: 0
        }
      },
      show: {
        animations: {
          colors: {
            from: "transparent"
          },
          visible: {
            type: "boolean",
            duration: 0
          }
        }
      },
      hide: {
        animations: {
          colors: {
            to: "transparent"
          },
          visible: {
            type: "boolean",
            easing: "linear",
            fn: (v) => v | 0
          }
        }
      }
    });
  }
  function applyLayoutsDefaults(defaults2) {
    defaults2.set("layout", {
      autoPadding: true,
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });
  }
  var intlCache = /* @__PURE__ */ new Map();
  function getNumberFormat(locale, options) {
    options = options || {};
    const cacheKey = locale + JSON.stringify(options);
    let formatter = intlCache.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options);
      intlCache.set(cacheKey, formatter);
    }
    return formatter;
  }
  function formatNumber(num, locale, options) {
    return getNumberFormat(locale, options).format(num);
  }
  var formatters = {
    values(value) {
      return isArray(value) ? value : "" + value;
    },
    numeric(tickValue, index2, ticks) {
      if (tickValue === 0) {
        return "0";
      }
      const locale = this.chart.options.locale;
      let notation;
      let delta = tickValue;
      if (ticks.length > 1) {
        const maxTick = Math.max(Math.abs(ticks[0].value), Math.abs(ticks[ticks.length - 1].value));
        if (maxTick < 1e-4 || maxTick > 1e15) {
          notation = "scientific";
        }
        delta = calculateDelta(tickValue, ticks);
      }
      const logDelta = log10(Math.abs(delta));
      const numDecimal = isNaN(logDelta) ? 1 : Math.max(Math.min(-1 * Math.floor(logDelta), 20), 0);
      const options = {
        notation,
        minimumFractionDigits: numDecimal,
        maximumFractionDigits: numDecimal
      };
      Object.assign(options, this.options.ticks.format);
      return formatNumber(tickValue, locale, options);
    },
    logarithmic(tickValue, index2, ticks) {
      if (tickValue === 0) {
        return "0";
      }
      const remain = ticks[index2].significand || tickValue / Math.pow(10, Math.floor(log10(tickValue)));
      if ([
        1,
        2,
        3,
        5,
        10,
        15
      ].includes(remain) || index2 > 0.8 * ticks.length) {
        return formatters.numeric.call(this, tickValue, index2, ticks);
      }
      return "";
    }
  };
  function calculateDelta(tickValue, ticks) {
    let delta = ticks.length > 3 ? ticks[2].value - ticks[1].value : ticks[1].value - ticks[0].value;
    if (Math.abs(delta) >= 1 && tickValue !== Math.floor(tickValue)) {
      delta = tickValue - Math.floor(tickValue);
    }
    return delta;
  }
  var Ticks = {
    formatters
  };
  function applyScaleDefaults(defaults2) {
    defaults2.set("scale", {
      display: true,
      offset: false,
      reverse: false,
      beginAtZero: false,
      bounds: "ticks",
      clip: true,
      grace: 0,
      grid: {
        display: true,
        lineWidth: 1,
        drawOnChartArea: true,
        drawTicks: true,
        tickLength: 8,
        tickWidth: (_ctx, options) => options.lineWidth,
        tickColor: (_ctx, options) => options.color,
        offset: false
      },
      border: {
        display: true,
        dash: [],
        dashOffset: 0,
        width: 1
      },
      title: {
        display: false,
        text: "",
        padding: {
          top: 4,
          bottom: 4
        }
      },
      ticks: {
        minRotation: 0,
        maxRotation: 50,
        mirror: false,
        textStrokeWidth: 0,
        textStrokeColor: "",
        padding: 3,
        display: true,
        autoSkip: true,
        autoSkipPadding: 3,
        labelOffset: 0,
        callback: Ticks.formatters.values,
        minor: {},
        major: {},
        align: "center",
        crossAlign: "near",
        showLabelBackdrop: false,
        backdropColor: "rgba(255, 255, 255, 0.75)",
        backdropPadding: 2
      }
    });
    defaults2.route("scale.ticks", "color", "", "color");
    defaults2.route("scale.grid", "color", "", "borderColor");
    defaults2.route("scale.border", "color", "", "borderColor");
    defaults2.route("scale.title", "color", "", "color");
    defaults2.describe("scale", {
      _fallback: false,
      _scriptable: (name) => !name.startsWith("before") && !name.startsWith("after") && name !== "callback" && name !== "parser",
      _indexable: (name) => name !== "borderDash" && name !== "tickBorderDash" && name !== "dash"
    });
    defaults2.describe("scales", {
      _fallback: "scale"
    });
    defaults2.describe("scale.ticks", {
      _scriptable: (name) => name !== "backdropPadding" && name !== "callback",
      _indexable: (name) => name !== "backdropPadding"
    });
  }
  var overrides = /* @__PURE__ */ Object.create(null);
  var descriptors = /* @__PURE__ */ Object.create(null);
  function getScope$1(node, key) {
    if (!key) {
      return node;
    }
    const keys = key.split(".");
    for (let i = 0, n = keys.length; i < n; ++i) {
      const k = keys[i];
      node = node[k] || (node[k] = /* @__PURE__ */ Object.create(null));
    }
    return node;
  }
  function set(root, scope, values) {
    if (typeof scope === "string") {
      return merge(getScope$1(root, scope), values);
    }
    return merge(getScope$1(root, ""), scope);
  }
  var Defaults = class {
    constructor(_descriptors2, _appliers) {
      this.animation = void 0;
      this.backgroundColor = "rgba(0,0,0,0.1)";
      this.borderColor = "rgba(0,0,0,0.1)";
      this.color = "#666";
      this.datasets = {};
      this.devicePixelRatio = (context) => context.chart.platform.getDevicePixelRatio();
      this.elements = {};
      this.events = [
        "mousemove",
        "mouseout",
        "click",
        "touchstart",
        "touchmove"
      ];
      this.font = {
        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
        size: 12,
        style: "normal",
        lineHeight: 1.2,
        weight: null
      };
      this.hover = {};
      this.hoverBackgroundColor = (ctx, options) => getHoverColor(options.backgroundColor);
      this.hoverBorderColor = (ctx, options) => getHoverColor(options.borderColor);
      this.hoverColor = (ctx, options) => getHoverColor(options.color);
      this.indexAxis = "x";
      this.interaction = {
        mode: "nearest",
        intersect: true,
        includeInvisible: false
      };
      this.maintainAspectRatio = true;
      this.onHover = null;
      this.onClick = null;
      this.parsing = true;
      this.plugins = {};
      this.responsive = true;
      this.scale = void 0;
      this.scales = {};
      this.showLine = true;
      this.drawActiveElementsOnTop = true;
      this.describe(_descriptors2);
      this.apply(_appliers);
    }
    set(scope, values) {
      return set(this, scope, values);
    }
    get(scope) {
      return getScope$1(this, scope);
    }
    describe(scope, values) {
      return set(descriptors, scope, values);
    }
    override(scope, values) {
      return set(overrides, scope, values);
    }
    route(scope, name, targetScope, targetName) {
      const scopeObject = getScope$1(this, scope);
      const targetScopeObject = getScope$1(this, targetScope);
      const privateName = "_" + name;
      Object.defineProperties(scopeObject, {
        [privateName]: {
          value: scopeObject[name],
          writable: true
        },
        [name]: {
          enumerable: true,
          get() {
            const local = this[privateName];
            const target = targetScopeObject[targetName];
            if (isObject(local)) {
              return Object.assign({}, target, local);
            }
            return valueOrDefault(local, target);
          },
          set(value) {
            this[privateName] = value;
          }
        }
      });
    }
    apply(appliers) {
      appliers.forEach((apply) => apply(this));
    }
  };
  var defaults = /* @__PURE__ */ new Defaults({
    _scriptable: (name) => !name.startsWith("on"),
    _indexable: (name) => name !== "events",
    hover: {
      _fallback: "interaction"
    },
    interaction: {
      _scriptable: false,
      _indexable: false
    }
  }, [
    applyAnimationsDefaults,
    applyLayoutsDefaults,
    applyScaleDefaults
  ]);
  function toFontString(font) {
    if (!font || isNullOrUndef(font.size) || isNullOrUndef(font.family)) {
      return null;
    }
    return (font.style ? font.style + " " : "") + (font.weight ? font.weight + " " : "") + font.size + "px " + font.family;
  }
  function _measureText(ctx, data, gc, longest, string) {
    let textWidth = data[string];
    if (!textWidth) {
      textWidth = data[string] = ctx.measureText(string).width;
      gc.push(string);
    }
    if (textWidth > longest) {
      longest = textWidth;
    }
    return longest;
  }
  function _longestText(ctx, font, arrayOfThings, cache) {
    cache = cache || {};
    let data = cache.data = cache.data || {};
    let gc = cache.garbageCollect = cache.garbageCollect || [];
    if (cache.font !== font) {
      data = cache.data = {};
      gc = cache.garbageCollect = [];
      cache.font = font;
    }
    ctx.save();
    ctx.font = font;
    let longest = 0;
    const ilen = arrayOfThings.length;
    let i, j, jlen, thing, nestedThing;
    for (i = 0; i < ilen; i++) {
      thing = arrayOfThings[i];
      if (thing !== void 0 && thing !== null && !isArray(thing)) {
        longest = _measureText(ctx, data, gc, longest, thing);
      } else if (isArray(thing)) {
        for (j = 0, jlen = thing.length; j < jlen; j++) {
          nestedThing = thing[j];
          if (nestedThing !== void 0 && nestedThing !== null && !isArray(nestedThing)) {
            longest = _measureText(ctx, data, gc, longest, nestedThing);
          }
        }
      }
    }
    ctx.restore();
    const gcLen = gc.length / 2;
    if (gcLen > arrayOfThings.length) {
      for (i = 0; i < gcLen; i++) {
        delete data[gc[i]];
      }
      gc.splice(0, gcLen);
    }
    return longest;
  }
  function _alignPixel(chart, pixel, width) {
    const devicePixelRatio = chart.currentDevicePixelRatio;
    const halfWidth = width !== 0 ? Math.max(width / 2, 0.5) : 0;
    return Math.round((pixel - halfWidth) * devicePixelRatio) / devicePixelRatio + halfWidth;
  }
  function clearCanvas(canvas, ctx) {
    if (!ctx && !canvas) {
      return;
    }
    ctx = ctx || canvas.getContext("2d");
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  function drawPoint(ctx, options, x, y) {
    drawPointLegend(ctx, options, x, y, null);
  }
  function drawPointLegend(ctx, options, x, y, w) {
    let type, xOffset, yOffset, size, cornerRadius, width, xOffsetW, yOffsetW;
    const style = options.pointStyle;
    const rotation = options.rotation;
    const radius = options.radius;
    let rad = (rotation || 0) * RAD_PER_DEG;
    if (style && typeof style === "object") {
      type = style.toString();
      if (type === "[object HTMLImageElement]" || type === "[object HTMLCanvasElement]") {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad);
        ctx.drawImage(style, -style.width / 2, -style.height / 2, style.width, style.height);
        ctx.restore();
        return;
      }
    }
    if (isNaN(radius) || radius <= 0) {
      return;
    }
    ctx.beginPath();
    switch (style) {
      // Default includes circle
      default:
        if (w) {
          ctx.ellipse(x, y, w / 2, radius, 0, 0, TAU);
        } else {
          ctx.arc(x, y, radius, 0, TAU);
        }
        ctx.closePath();
        break;
      case "triangle":
        width = w ? w / 2 : radius;
        ctx.moveTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
        rad += TWO_THIRDS_PI;
        ctx.lineTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
        rad += TWO_THIRDS_PI;
        ctx.lineTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
        ctx.closePath();
        break;
      case "rectRounded":
        cornerRadius = radius * 0.516;
        size = radius - cornerRadius;
        xOffset = Math.cos(rad + QUARTER_PI) * size;
        xOffsetW = Math.cos(rad + QUARTER_PI) * (w ? w / 2 - cornerRadius : size);
        yOffset = Math.sin(rad + QUARTER_PI) * size;
        yOffsetW = Math.sin(rad + QUARTER_PI) * (w ? w / 2 - cornerRadius : size);
        ctx.arc(x - xOffsetW, y - yOffset, cornerRadius, rad - PI, rad - HALF_PI);
        ctx.arc(x + yOffsetW, y - xOffset, cornerRadius, rad - HALF_PI, rad);
        ctx.arc(x + xOffsetW, y + yOffset, cornerRadius, rad, rad + HALF_PI);
        ctx.arc(x - yOffsetW, y + xOffset, cornerRadius, rad + HALF_PI, rad + PI);
        ctx.closePath();
        break;
      case "rect":
        if (!rotation) {
          size = Math.SQRT1_2 * radius;
          width = w ? w / 2 : size;
          ctx.rect(x - width, y - size, 2 * width, 2 * size);
          break;
        }
        rad += QUARTER_PI;
      /* falls through */
      case "rectRot":
        xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
        xOffset = Math.cos(rad) * radius;
        yOffset = Math.sin(rad) * radius;
        yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
        ctx.moveTo(x - xOffsetW, y - yOffset);
        ctx.lineTo(x + yOffsetW, y - xOffset);
        ctx.lineTo(x + xOffsetW, y + yOffset);
        ctx.lineTo(x - yOffsetW, y + xOffset);
        ctx.closePath();
        break;
      case "crossRot":
        rad += QUARTER_PI;
      /* falls through */
      case "cross":
        xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
        xOffset = Math.cos(rad) * radius;
        yOffset = Math.sin(rad) * radius;
        yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
        ctx.moveTo(x - xOffsetW, y - yOffset);
        ctx.lineTo(x + xOffsetW, y + yOffset);
        ctx.moveTo(x + yOffsetW, y - xOffset);
        ctx.lineTo(x - yOffsetW, y + xOffset);
        break;
      case "star":
        xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
        xOffset = Math.cos(rad) * radius;
        yOffset = Math.sin(rad) * radius;
        yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
        ctx.moveTo(x - xOffsetW, y - yOffset);
        ctx.lineTo(x + xOffsetW, y + yOffset);
        ctx.moveTo(x + yOffsetW, y - xOffset);
        ctx.lineTo(x - yOffsetW, y + xOffset);
        rad += QUARTER_PI;
        xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
        xOffset = Math.cos(rad) * radius;
        yOffset = Math.sin(rad) * radius;
        yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
        ctx.moveTo(x - xOffsetW, y - yOffset);
        ctx.lineTo(x + xOffsetW, y + yOffset);
        ctx.moveTo(x + yOffsetW, y - xOffset);
        ctx.lineTo(x - yOffsetW, y + xOffset);
        break;
      case "line":
        xOffset = w ? w / 2 : Math.cos(rad) * radius;
        yOffset = Math.sin(rad) * radius;
        ctx.moveTo(x - xOffset, y - yOffset);
        ctx.lineTo(x + xOffset, y + yOffset);
        break;
      case "dash":
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(rad) * (w ? w / 2 : radius), y + Math.sin(rad) * radius);
        break;
      case false:
        ctx.closePath();
        break;
    }
    ctx.fill();
    if (options.borderWidth > 0) {
      ctx.stroke();
    }
  }
  function _isPointInArea(point, area, margin) {
    margin = margin || 0.5;
    return !area || point && point.x > area.left - margin && point.x < area.right + margin && point.y > area.top - margin && point.y < area.bottom + margin;
  }
  function clipArea(ctx, area) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    ctx.clip();
  }
  function unclipArea(ctx) {
    ctx.restore();
  }
  function _steppedLineTo(ctx, previous, target, flip, mode) {
    if (!previous) {
      return ctx.lineTo(target.x, target.y);
    }
    if (mode === "middle") {
      const midpoint = (previous.x + target.x) / 2;
      ctx.lineTo(midpoint, previous.y);
      ctx.lineTo(midpoint, target.y);
    } else if (mode === "after" !== !!flip) {
      ctx.lineTo(previous.x, target.y);
    } else {
      ctx.lineTo(target.x, previous.y);
    }
    ctx.lineTo(target.x, target.y);
  }
  function _bezierCurveTo(ctx, previous, target, flip) {
    if (!previous) {
      return ctx.lineTo(target.x, target.y);
    }
    ctx.bezierCurveTo(flip ? previous.cp1x : previous.cp2x, flip ? previous.cp1y : previous.cp2y, flip ? target.cp2x : target.cp1x, flip ? target.cp2y : target.cp1y, target.x, target.y);
  }
  function setRenderOpts(ctx, opts) {
    if (opts.translation) {
      ctx.translate(opts.translation[0], opts.translation[1]);
    }
    if (!isNullOrUndef(opts.rotation)) {
      ctx.rotate(opts.rotation);
    }
    if (opts.color) {
      ctx.fillStyle = opts.color;
    }
    if (opts.textAlign) {
      ctx.textAlign = opts.textAlign;
    }
    if (opts.textBaseline) {
      ctx.textBaseline = opts.textBaseline;
    }
  }
  function decorateText(ctx, x, y, line, opts) {
    if (opts.strikethrough || opts.underline) {
      const metrics = ctx.measureText(line);
      const left = x - metrics.actualBoundingBoxLeft;
      const right = x + metrics.actualBoundingBoxRight;
      const top = y - metrics.actualBoundingBoxAscent;
      const bottom = y + metrics.actualBoundingBoxDescent;
      const yDecoration = opts.strikethrough ? (top + bottom) / 2 : bottom;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.lineWidth = opts.decorationWidth || 2;
      ctx.moveTo(left, yDecoration);
      ctx.lineTo(right, yDecoration);
      ctx.stroke();
    }
  }
  function drawBackdrop(ctx, opts) {
    const oldColor = ctx.fillStyle;
    ctx.fillStyle = opts.color;
    ctx.fillRect(opts.left, opts.top, opts.width, opts.height);
    ctx.fillStyle = oldColor;
  }
  function renderText(ctx, text, x, y, font, opts = {}) {
    const lines = isArray(text) ? text : [
      text
    ];
    const stroke = opts.strokeWidth > 0 && opts.strokeColor !== "";
    let i, line;
    ctx.save();
    ctx.font = font.string;
    setRenderOpts(ctx, opts);
    for (i = 0; i < lines.length; ++i) {
      line = lines[i];
      if (opts.backdrop) {
        drawBackdrop(ctx, opts.backdrop);
      }
      if (stroke) {
        if (opts.strokeColor) {
          ctx.strokeStyle = opts.strokeColor;
        }
        if (!isNullOrUndef(opts.strokeWidth)) {
          ctx.lineWidth = opts.strokeWidth;
        }
        ctx.strokeText(line, x, y, opts.maxWidth);
      }
      ctx.fillText(line, x, y, opts.maxWidth);
      decorateText(ctx, x, y, line, opts);
      y += Number(font.lineHeight);
    }
    ctx.restore();
  }
  function addRoundedRectPath(ctx, rect) {
    const { x, y, w, h, radius } = rect;
    ctx.arc(x + radius.topLeft, y + radius.topLeft, radius.topLeft, 1.5 * PI, PI, true);
    ctx.lineTo(x, y + h - radius.bottomLeft);
    ctx.arc(x + radius.bottomLeft, y + h - radius.bottomLeft, radius.bottomLeft, PI, HALF_PI, true);
    ctx.lineTo(x + w - radius.bottomRight, y + h);
    ctx.arc(x + w - radius.bottomRight, y + h - radius.bottomRight, radius.bottomRight, HALF_PI, 0, true);
    ctx.lineTo(x + w, y + radius.topRight);
    ctx.arc(x + w - radius.topRight, y + radius.topRight, radius.topRight, 0, -HALF_PI, true);
    ctx.lineTo(x + radius.topLeft, y);
  }
  var LINE_HEIGHT = /^(normal|(\d+(?:\.\d+)?)(px|em|%)?)$/;
  var FONT_STYLE = /^(normal|italic|initial|inherit|unset|(oblique( -?[0-9]?[0-9]deg)?))$/;
  function toLineHeight(value, size) {
    const matches = ("" + value).match(LINE_HEIGHT);
    if (!matches || matches[1] === "normal") {
      return size * 1.2;
    }
    value = +matches[2];
    switch (matches[3]) {
      case "px":
        return value;
      case "%":
        value /= 100;
        break;
    }
    return size * value;
  }
  var numberOrZero = (v) => +v || 0;
  function _readValueToProps(value, props) {
    const ret = {};
    const objProps = isObject(props);
    const keys = objProps ? Object.keys(props) : props;
    const read = isObject(value) ? objProps ? (prop) => valueOrDefault(value[prop], value[props[prop]]) : (prop) => value[prop] : () => value;
    for (const prop of keys) {
      ret[prop] = numberOrZero(read(prop));
    }
    return ret;
  }
  function toTRBL(value) {
    return _readValueToProps(value, {
      top: "y",
      right: "x",
      bottom: "y",
      left: "x"
    });
  }
  function toTRBLCorners(value) {
    return _readValueToProps(value, [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight"
    ]);
  }
  function toPadding(value) {
    const obj = toTRBL(value);
    obj.width = obj.left + obj.right;
    obj.height = obj.top + obj.bottom;
    return obj;
  }
  function toFont(options, fallback) {
    options = options || {};
    fallback = fallback || defaults.font;
    let size = valueOrDefault(options.size, fallback.size);
    if (typeof size === "string") {
      size = parseInt(size, 10);
    }
    let style = valueOrDefault(options.style, fallback.style);
    if (style && !("" + style).match(FONT_STYLE)) {
      console.warn('Invalid font style specified: "' + style + '"');
      style = void 0;
    }
    const font = {
      family: valueOrDefault(options.family, fallback.family),
      lineHeight: toLineHeight(valueOrDefault(options.lineHeight, fallback.lineHeight), size),
      size,
      style,
      weight: valueOrDefault(options.weight, fallback.weight),
      string: ""
    };
    font.string = toFontString(font);
    return font;
  }
  function resolve(inputs, context, index2, info) {
    let cacheable = true;
    let i, ilen, value;
    for (i = 0, ilen = inputs.length; i < ilen; ++i) {
      value = inputs[i];
      if (value === void 0) {
        continue;
      }
      if (context !== void 0 && typeof value === "function") {
        value = value(context);
        cacheable = false;
      }
      if (index2 !== void 0 && isArray(value)) {
        value = value[index2 % value.length];
        cacheable = false;
      }
      if (value !== void 0) {
        if (info && !cacheable) {
          info.cacheable = false;
        }
        return value;
      }
    }
  }
  function _addGrace(minmax, grace, beginAtZero) {
    const { min, max } = minmax;
    const change = toDimension(grace, (max - min) / 2);
    const keepZero = (value, add) => beginAtZero && value === 0 ? 0 : value + add;
    return {
      min: keepZero(min, -Math.abs(change)),
      max: keepZero(max, change)
    };
  }
  function createContext(parentContext, context) {
    return Object.assign(Object.create(parentContext), context);
  }
  function _createResolver(scopes, prefixes = [
    ""
  ], rootScopes, fallback, getTarget = () => scopes[0]) {
    const finalRootScopes = rootScopes || scopes;
    if (typeof fallback === "undefined") {
      fallback = _resolve("_fallback", scopes);
    }
    const cache = {
      [Symbol.toStringTag]: "Object",
      _cacheable: true,
      _scopes: scopes,
      _rootScopes: finalRootScopes,
      _fallback: fallback,
      _getTarget: getTarget,
      override: (scope) => _createResolver([
        scope,
        ...scopes
      ], prefixes, finalRootScopes, fallback)
    };
    return new Proxy(cache, {
      /**
      * A trap for the delete operator.
      */
      deleteProperty(target, prop) {
        delete target[prop];
        delete target._keys;
        delete scopes[0][prop];
        return true;
      },
      /**
      * A trap for getting property values.
      */
      get(target, prop) {
        return _cached(target, prop, () => _resolveWithPrefixes(prop, prefixes, scopes, target));
      },
      /**
      * A trap for Object.getOwnPropertyDescriptor.
      * Also used by Object.hasOwnProperty.
      */
      getOwnPropertyDescriptor(target, prop) {
        return Reflect.getOwnPropertyDescriptor(target._scopes[0], prop);
      },
      /**
      * A trap for Object.getPrototypeOf.
      */
      getPrototypeOf() {
        return Reflect.getPrototypeOf(scopes[0]);
      },
      /**
      * A trap for the in operator.
      */
      has(target, prop) {
        return getKeysFromAllScopes(target).includes(prop);
      },
      /**
      * A trap for Object.getOwnPropertyNames and Object.getOwnPropertySymbols.
      */
      ownKeys(target) {
        return getKeysFromAllScopes(target);
      },
      /**
      * A trap for setting property values.
      */
      set(target, prop, value) {
        const storage = target._storage || (target._storage = getTarget());
        target[prop] = storage[prop] = value;
        delete target._keys;
        return true;
      }
    });
  }
  function _attachContext(proxy, context, subProxy, descriptorDefaults) {
    const cache = {
      _cacheable: false,
      _proxy: proxy,
      _context: context,
      _subProxy: subProxy,
      _stack: /* @__PURE__ */ new Set(),
      _descriptors: _descriptors(proxy, descriptorDefaults),
      setContext: (ctx) => _attachContext(proxy, ctx, subProxy, descriptorDefaults),
      override: (scope) => _attachContext(proxy.override(scope), context, subProxy, descriptorDefaults)
    };
    return new Proxy(cache, {
      /**
      * A trap for the delete operator.
      */
      deleteProperty(target, prop) {
        delete target[prop];
        delete proxy[prop];
        return true;
      },
      /**
      * A trap for getting property values.
      */
      get(target, prop, receiver) {
        return _cached(target, prop, () => _resolveWithContext(target, prop, receiver));
      },
      /**
      * A trap for Object.getOwnPropertyDescriptor.
      * Also used by Object.hasOwnProperty.
      */
      getOwnPropertyDescriptor(target, prop) {
        return target._descriptors.allKeys ? Reflect.has(proxy, prop) ? {
          enumerable: true,
          configurable: true
        } : void 0 : Reflect.getOwnPropertyDescriptor(proxy, prop);
      },
      /**
      * A trap for Object.getPrototypeOf.
      */
      getPrototypeOf() {
        return Reflect.getPrototypeOf(proxy);
      },
      /**
      * A trap for the in operator.
      */
      has(target, prop) {
        return Reflect.has(proxy, prop);
      },
      /**
      * A trap for Object.getOwnPropertyNames and Object.getOwnPropertySymbols.
      */
      ownKeys() {
        return Reflect.ownKeys(proxy);
      },
      /**
      * A trap for setting property values.
      */
      set(target, prop, value) {
        proxy[prop] = value;
        delete target[prop];
        return true;
      }
    });
  }
  function _descriptors(proxy, defaults2 = {
    scriptable: true,
    indexable: true
  }) {
    const { _scriptable = defaults2.scriptable, _indexable = defaults2.indexable, _allKeys = defaults2.allKeys } = proxy;
    return {
      allKeys: _allKeys,
      scriptable: _scriptable,
      indexable: _indexable,
      isScriptable: isFunction(_scriptable) ? _scriptable : () => _scriptable,
      isIndexable: isFunction(_indexable) ? _indexable : () => _indexable
    };
  }
  var readKey = (prefix, name) => prefix ? prefix + _capitalize(name) : name;
  var needsSubResolver = (prop, value) => isObject(value) && prop !== "adapters" && (Object.getPrototypeOf(value) === null || value.constructor === Object);
  function _cached(target, prop, resolve2) {
    if (Object.prototype.hasOwnProperty.call(target, prop) || prop === "constructor") {
      return target[prop];
    }
    const value = resolve2();
    target[prop] = value;
    return value;
  }
  function _resolveWithContext(target, prop, receiver) {
    const { _proxy, _context, _subProxy, _descriptors: descriptors2 } = target;
    let value = _proxy[prop];
    if (isFunction(value) && descriptors2.isScriptable(prop)) {
      value = _resolveScriptable(prop, value, target, receiver);
    }
    if (isArray(value) && value.length) {
      value = _resolveArray(prop, value, target, descriptors2.isIndexable);
    }
    if (needsSubResolver(prop, value)) {
      value = _attachContext(value, _context, _subProxy && _subProxy[prop], descriptors2);
    }
    return value;
  }
  function _resolveScriptable(prop, getValue, target, receiver) {
    const { _proxy, _context, _subProxy, _stack } = target;
    if (_stack.has(prop)) {
      throw new Error("Recursion detected: " + Array.from(_stack).join("->") + "->" + prop);
    }
    _stack.add(prop);
    let value = getValue(_context, _subProxy || receiver);
    _stack.delete(prop);
    if (needsSubResolver(prop, value)) {
      value = createSubResolver(_proxy._scopes, _proxy, prop, value);
    }
    return value;
  }
  function _resolveArray(prop, value, target, isIndexable) {
    const { _proxy, _context, _subProxy, _descriptors: descriptors2 } = target;
    if (typeof _context.index !== "undefined" && isIndexable(prop)) {
      return value[_context.index % value.length];
    } else if (isObject(value[0])) {
      const arr = value;
      const scopes = _proxy._scopes.filter((s) => s !== arr);
      value = [];
      for (const item of arr) {
        const resolver = createSubResolver(scopes, _proxy, prop, item);
        value.push(_attachContext(resolver, _context, _subProxy && _subProxy[prop], descriptors2));
      }
    }
    return value;
  }
  function resolveFallback(fallback, prop, value) {
    return isFunction(fallback) ? fallback(prop, value) : fallback;
  }
  var getScope = (key, parent) => key === true ? parent : typeof key === "string" ? resolveObjectKey(parent, key) : void 0;
  function addScopes(set2, parentScopes, key, parentFallback, value) {
    for (const parent of parentScopes) {
      const scope = getScope(key, parent);
      if (scope) {
        set2.add(scope);
        const fallback = resolveFallback(scope._fallback, key, value);
        if (typeof fallback !== "undefined" && fallback !== key && fallback !== parentFallback) {
          return fallback;
        }
      } else if (scope === false && typeof parentFallback !== "undefined" && key !== parentFallback) {
        return null;
      }
    }
    return false;
  }
  function createSubResolver(parentScopes, resolver, prop, value) {
    const rootScopes = resolver._rootScopes;
    const fallback = resolveFallback(resolver._fallback, prop, value);
    const allScopes = [
      ...parentScopes,
      ...rootScopes
    ];
    const set2 = /* @__PURE__ */ new Set();
    set2.add(value);
    let key = addScopesFromKey(set2, allScopes, prop, fallback || prop, value);
    if (key === null) {
      return false;
    }
    if (typeof fallback !== "undefined" && fallback !== prop) {
      key = addScopesFromKey(set2, allScopes, fallback, key, value);
      if (key === null) {
        return false;
      }
    }
    return _createResolver(Array.from(set2), [
      ""
    ], rootScopes, fallback, () => subGetTarget(resolver, prop, value));
  }
  function addScopesFromKey(set2, allScopes, key, fallback, item) {
    while (key) {
      key = addScopes(set2, allScopes, key, fallback, item);
    }
    return key;
  }
  function subGetTarget(resolver, prop, value) {
    const parent = resolver._getTarget();
    if (!(prop in parent)) {
      parent[prop] = {};
    }
    const target = parent[prop];
    if (isArray(target) && isObject(value)) {
      return value;
    }
    return target || {};
  }
  function _resolveWithPrefixes(prop, prefixes, scopes, proxy) {
    let value;
    for (const prefix of prefixes) {
      value = _resolve(readKey(prefix, prop), scopes);
      if (typeof value !== "undefined") {
        return needsSubResolver(prop, value) ? createSubResolver(scopes, proxy, prop, value) : value;
      }
    }
  }
  function _resolve(key, scopes) {
    for (const scope of scopes) {
      if (!scope) {
        continue;
      }
      const value = scope[key];
      if (typeof value !== "undefined") {
        return value;
      }
    }
  }
  function getKeysFromAllScopes(target) {
    let keys = target._keys;
    if (!keys) {
      keys = target._keys = resolveKeysFromAllScopes(target._scopes);
    }
    return keys;
  }
  function resolveKeysFromAllScopes(scopes) {
    const set2 = /* @__PURE__ */ new Set();
    for (const scope of scopes) {
      for (const key of Object.keys(scope).filter((k) => !k.startsWith("_"))) {
        set2.add(key);
      }
    }
    return Array.from(set2);
  }
  function _parseObjectDataRadialScale(meta, data, start, count) {
    const { iScale } = meta;
    const { key = "r" } = this._parsing;
    const parsed = new Array(count);
    let i, ilen, index2, item;
    for (i = 0, ilen = count; i < ilen; ++i) {
      index2 = i + start;
      item = data[index2];
      parsed[i] = {
        r: iScale.parse(resolveObjectKey(item, key), index2)
      };
    }
    return parsed;
  }
  var EPSILON = Number.EPSILON || 1e-14;
  var getPoint = (points, i) => i < points.length && !points[i].skip && points[i];
  var getValueAxis = (indexAxis) => indexAxis === "x" ? "y" : "x";
  function splineCurve(firstPoint, middlePoint, afterPoint, t) {
    const previous = firstPoint.skip ? middlePoint : firstPoint;
    const current = middlePoint;
    const next = afterPoint.skip ? middlePoint : afterPoint;
    const d01 = distanceBetweenPoints(current, previous);
    const d12 = distanceBetweenPoints(next, current);
    let s01 = d01 / (d01 + d12);
    let s12 = d12 / (d01 + d12);
    s01 = isNaN(s01) ? 0 : s01;
    s12 = isNaN(s12) ? 0 : s12;
    const fa = t * s01;
    const fb = t * s12;
    return {
      previous: {
        x: current.x - fa * (next.x - previous.x),
        y: current.y - fa * (next.y - previous.y)
      },
      next: {
        x: current.x + fb * (next.x - previous.x),
        y: current.y + fb * (next.y - previous.y)
      }
    };
  }
  function monotoneAdjust(points, deltaK, mK) {
    const pointsLen = points.length;
    let alphaK, betaK, tauK, squaredMagnitude, pointCurrent;
    let pointAfter = getPoint(points, 0);
    for (let i = 0; i < pointsLen - 1; ++i) {
      pointCurrent = pointAfter;
      pointAfter = getPoint(points, i + 1);
      if (!pointCurrent || !pointAfter) {
        continue;
      }
      if (almostEquals(deltaK[i], 0, EPSILON)) {
        mK[i] = mK[i + 1] = 0;
        continue;
      }
      alphaK = mK[i] / deltaK[i];
      betaK = mK[i + 1] / deltaK[i];
      squaredMagnitude = Math.pow(alphaK, 2) + Math.pow(betaK, 2);
      if (squaredMagnitude <= 9) {
        continue;
      }
      tauK = 3 / Math.sqrt(squaredMagnitude);
      mK[i] = alphaK * tauK * deltaK[i];
      mK[i + 1] = betaK * tauK * deltaK[i];
    }
  }
  function monotoneCompute(points, mK, indexAxis = "x") {
    const valueAxis = getValueAxis(indexAxis);
    const pointsLen = points.length;
    let delta, pointBefore, pointCurrent;
    let pointAfter = getPoint(points, 0);
    for (let i = 0; i < pointsLen; ++i) {
      pointBefore = pointCurrent;
      pointCurrent = pointAfter;
      pointAfter = getPoint(points, i + 1);
      if (!pointCurrent) {
        continue;
      }
      const iPixel = pointCurrent[indexAxis];
      const vPixel = pointCurrent[valueAxis];
      if (pointBefore) {
        delta = (iPixel - pointBefore[indexAxis]) / 3;
        pointCurrent[`cp1${indexAxis}`] = iPixel - delta;
        pointCurrent[`cp1${valueAxis}`] = vPixel - delta * mK[i];
      }
      if (pointAfter) {
        delta = (pointAfter[indexAxis] - iPixel) / 3;
        pointCurrent[`cp2${indexAxis}`] = iPixel + delta;
        pointCurrent[`cp2${valueAxis}`] = vPixel + delta * mK[i];
      }
    }
  }
  function splineCurveMonotone(points, indexAxis = "x") {
    const valueAxis = getValueAxis(indexAxis);
    const pointsLen = points.length;
    const deltaK = Array(pointsLen).fill(0);
    const mK = Array(pointsLen);
    let i, pointBefore, pointCurrent;
    let pointAfter = getPoint(points, 0);
    for (i = 0; i < pointsLen; ++i) {
      pointBefore = pointCurrent;
      pointCurrent = pointAfter;
      pointAfter = getPoint(points, i + 1);
      if (!pointCurrent) {
        continue;
      }
      if (pointAfter) {
        const slopeDelta = pointAfter[indexAxis] - pointCurrent[indexAxis];
        deltaK[i] = slopeDelta !== 0 ? (pointAfter[valueAxis] - pointCurrent[valueAxis]) / slopeDelta : 0;
      }
      mK[i] = !pointBefore ? deltaK[i] : !pointAfter ? deltaK[i - 1] : sign(deltaK[i - 1]) !== sign(deltaK[i]) ? 0 : (deltaK[i - 1] + deltaK[i]) / 2;
    }
    monotoneAdjust(points, deltaK, mK);
    monotoneCompute(points, mK, indexAxis);
  }
  function capControlPoint(pt, min, max) {
    return Math.max(Math.min(pt, max), min);
  }
  function capBezierPoints(points, area) {
    let i, ilen, point, inArea, inAreaPrev;
    let inAreaNext = _isPointInArea(points[0], area);
    for (i = 0, ilen = points.length; i < ilen; ++i) {
      inAreaPrev = inArea;
      inArea = inAreaNext;
      inAreaNext = i < ilen - 1 && _isPointInArea(points[i + 1], area);
      if (!inArea) {
        continue;
      }
      point = points[i];
      if (inAreaPrev) {
        point.cp1x = capControlPoint(point.cp1x, area.left, area.right);
        point.cp1y = capControlPoint(point.cp1y, area.top, area.bottom);
      }
      if (inAreaNext) {
        point.cp2x = capControlPoint(point.cp2x, area.left, area.right);
        point.cp2y = capControlPoint(point.cp2y, area.top, area.bottom);
      }
    }
  }
  function _updateBezierControlPoints(points, options, area, loop, indexAxis) {
    let i, ilen, point, controlPoints;
    if (options.spanGaps) {
      points = points.filter((pt) => !pt.skip);
    }
    if (options.cubicInterpolationMode === "monotone") {
      splineCurveMonotone(points, indexAxis);
    } else {
      let prev = loop ? points[points.length - 1] : points[0];
      for (i = 0, ilen = points.length; i < ilen; ++i) {
        point = points[i];
        controlPoints = splineCurve(prev, point, points[Math.min(i + 1, ilen - (loop ? 0 : 1)) % ilen], options.tension);
        point.cp1x = controlPoints.previous.x;
        point.cp1y = controlPoints.previous.y;
        point.cp2x = controlPoints.next.x;
        point.cp2y = controlPoints.next.y;
        prev = point;
      }
    }
    if (options.capBezierPoints) {
      capBezierPoints(points, area);
    }
  }
  function _isDomSupported() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }
  function _getParentNode(domNode) {
    let parent = domNode.parentNode;
    if (parent && parent.toString() === "[object ShadowRoot]") {
      parent = parent.host;
    }
    return parent;
  }
  function parseMaxStyle(styleValue, node, parentProperty) {
    let valueInPixels;
    if (typeof styleValue === "string") {
      valueInPixels = parseInt(styleValue, 10);
      if (styleValue.indexOf("%") !== -1) {
        valueInPixels = valueInPixels / 100 * node.parentNode[parentProperty];
      }
    } else {
      valueInPixels = styleValue;
    }
    return valueInPixels;
  }
  var getComputedStyle = (element) => element.ownerDocument.defaultView.getComputedStyle(element, null);
  function getStyle(el, property) {
    return getComputedStyle(el).getPropertyValue(property);
  }
  var positions = [
    "top",
    "right",
    "bottom",
    "left"
  ];
  function getPositionedStyle(styles, style, suffix) {
    const result = {};
    suffix = suffix ? "-" + suffix : "";
    for (let i = 0; i < 4; i++) {
      const pos = positions[i];
      result[pos] = parseFloat(styles[style + "-" + pos + suffix]) || 0;
    }
    result.width = result.left + result.right;
    result.height = result.top + result.bottom;
    return result;
  }
  var useOffsetPos = (x, y, target) => (x > 0 || y > 0) && (!target || !target.shadowRoot);
  function getCanvasPosition(e, canvas) {
    const touches = e.touches;
    const source = touches && touches.length ? touches[0] : e;
    const { offsetX, offsetY } = source;
    let box = false;
    let x, y;
    if (useOffsetPos(offsetX, offsetY, e.target)) {
      x = offsetX;
      y = offsetY;
    } else {
      const rect = canvas.getBoundingClientRect();
      x = source.clientX - rect.left;
      y = source.clientY - rect.top;
      box = true;
    }
    return {
      x,
      y,
      box
    };
  }
  function getRelativePosition(event, chart) {
    if ("native" in event) {
      return event;
    }
    const { canvas, currentDevicePixelRatio } = chart;
    const style = getComputedStyle(canvas);
    const borderBox = style.boxSizing === "border-box";
    const paddings = getPositionedStyle(style, "padding");
    const borders = getPositionedStyle(style, "border", "width");
    const { x, y, box } = getCanvasPosition(event, canvas);
    const xOffset = paddings.left + (box && borders.left);
    const yOffset = paddings.top + (box && borders.top);
    let { width, height } = chart;
    if (borderBox) {
      width -= paddings.width + borders.width;
      height -= paddings.height + borders.height;
    }
    return {
      x: Math.round((x - xOffset) / width * canvas.width / currentDevicePixelRatio),
      y: Math.round((y - yOffset) / height * canvas.height / currentDevicePixelRatio)
    };
  }
  function getContainerSize(canvas, width, height) {
    let maxWidth, maxHeight;
    if (width === void 0 || height === void 0) {
      const container = canvas && _getParentNode(canvas);
      if (!container) {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
      } else {
        const rect = container.getBoundingClientRect();
        const containerStyle = getComputedStyle(container);
        const containerBorder = getPositionedStyle(containerStyle, "border", "width");
        const containerPadding = getPositionedStyle(containerStyle, "padding");
        width = rect.width - containerPadding.width - containerBorder.width;
        height = rect.height - containerPadding.height - containerBorder.height;
        maxWidth = parseMaxStyle(containerStyle.maxWidth, container, "clientWidth");
        maxHeight = parseMaxStyle(containerStyle.maxHeight, container, "clientHeight");
      }
    }
    return {
      width,
      height,
      maxWidth: maxWidth || INFINITY,
      maxHeight: maxHeight || INFINITY
    };
  }
  var round1 = (v) => Math.round(v * 10) / 10;
  function getMaximumSize(canvas, bbWidth, bbHeight, aspectRatio) {
    const style = getComputedStyle(canvas);
    const margins = getPositionedStyle(style, "margin");
    const maxWidth = parseMaxStyle(style.maxWidth, canvas, "clientWidth") || INFINITY;
    const maxHeight = parseMaxStyle(style.maxHeight, canvas, "clientHeight") || INFINITY;
    const containerSize = getContainerSize(canvas, bbWidth, bbHeight);
    let { width, height } = containerSize;
    if (style.boxSizing === "content-box") {
      const borders = getPositionedStyle(style, "border", "width");
      const paddings = getPositionedStyle(style, "padding");
      width -= paddings.width + borders.width;
      height -= paddings.height + borders.height;
    }
    width = Math.max(0, width - margins.width);
    height = Math.max(0, aspectRatio ? width / aspectRatio : height - margins.height);
    width = round1(Math.min(width, maxWidth, containerSize.maxWidth));
    height = round1(Math.min(height, maxHeight, containerSize.maxHeight));
    if (width && !height) {
      height = round1(width / 2);
    }
    const maintainHeight = bbWidth !== void 0 || bbHeight !== void 0;
    if (maintainHeight && aspectRatio && containerSize.height && height > containerSize.height) {
      height = containerSize.height;
      width = round1(Math.floor(height * aspectRatio));
    }
    return {
      width,
      height
    };
  }
  function retinaScale(chart, forceRatio, forceStyle) {
    const pixelRatio = forceRatio || 1;
    const deviceHeight = round1(chart.height * pixelRatio);
    const deviceWidth = round1(chart.width * pixelRatio);
    chart.height = round1(chart.height);
    chart.width = round1(chart.width);
    const canvas = chart.canvas;
    if (canvas.style && (forceStyle || !canvas.style.height && !canvas.style.width)) {
      canvas.style.height = `${chart.height}px`;
      canvas.style.width = `${chart.width}px`;
    }
    if (chart.currentDevicePixelRatio !== pixelRatio || canvas.height !== deviceHeight || canvas.width !== deviceWidth) {
      chart.currentDevicePixelRatio = pixelRatio;
      canvas.height = deviceHeight;
      canvas.width = deviceWidth;
      chart.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      return true;
    }
    return false;
  }
  var supportsEventListenerOptions = (function() {
    let passiveSupported = false;
    try {
      const options = {
        get passive() {
          passiveSupported = true;
          return false;
        }
      };
      if (_isDomSupported()) {
        window.addEventListener("test", null, options);
        window.removeEventListener("test", null, options);
      }
    } catch (e) {
    }
    return passiveSupported;
  })();
  function readUsedSize(element, property) {
    const value = getStyle(element, property);
    const matches = value && value.match(/^(\d+)(\.\d+)?px$/);
    return matches ? +matches[1] : void 0;
  }
  function _pointInLine(p1, p2, t, mode) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
  }
  function _steppedInterpolation(p1, p2, t, mode) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: mode === "middle" ? t < 0.5 ? p1.y : p2.y : mode === "after" ? t < 1 ? p1.y : p2.y : t > 0 ? p2.y : p1.y
    };
  }
  function _bezierInterpolation(p1, p2, t, mode) {
    const cp1 = {
      x: p1.cp2x,
      y: p1.cp2y
    };
    const cp2 = {
      x: p2.cp1x,
      y: p2.cp1y
    };
    const a = _pointInLine(p1, cp1, t);
    const b = _pointInLine(cp1, cp2, t);
    const c = _pointInLine(cp2, p2, t);
    const d = _pointInLine(a, b, t);
    const e = _pointInLine(b, c, t);
    return _pointInLine(d, e, t);
  }
  var getRightToLeftAdapter = function(rectX, width) {
    return {
      x(x) {
        return rectX + rectX + width - x;
      },
      setWidth(w) {
        width = w;
      },
      textAlign(align) {
        if (align === "center") {
          return align;
        }
        return align === "right" ? "left" : "right";
      },
      xPlus(x, value) {
        return x - value;
      },
      leftForLtr(x, itemWidth) {
        return x - itemWidth;
      }
    };
  };
  var getLeftToRightAdapter = function() {
    return {
      x(x) {
        return x;
      },
      setWidth(w) {
      },
      textAlign(align) {
        return align;
      },
      xPlus(x, value) {
        return x + value;
      },
      leftForLtr(x, _itemWidth) {
        return x;
      }
    };
  };
  function getRtlAdapter(rtl, rectX, width) {
    return rtl ? getRightToLeftAdapter(rectX, width) : getLeftToRightAdapter();
  }
  function overrideTextDirection(ctx, direction) {
    let style, original;
    if (direction === "ltr" || direction === "rtl") {
      style = ctx.canvas.style;
      original = [
        style.getPropertyValue("direction"),
        style.getPropertyPriority("direction")
      ];
      style.setProperty("direction", direction, "important");
      ctx.prevTextDirection = original;
    }
  }
  function restoreTextDirection(ctx, original) {
    if (original !== void 0) {
      delete ctx.prevTextDirection;
      ctx.canvas.style.setProperty("direction", original[0], original[1]);
    }
  }
  function propertyFn(property) {
    if (property === "angle") {
      return {
        between: _angleBetween,
        compare: _angleDiff,
        normalize: _normalizeAngle
      };
    }
    return {
      between: _isBetween,
      compare: (a, b) => a - b,
      normalize: (x) => x
    };
  }
  function normalizeSegment({ start, end, count, loop, style }) {
    return {
      start: start % count,
      end: end % count,
      loop: loop && (end - start + 1) % count === 0,
      style
    };
  }
  function getSegment(segment, points, bounds) {
    const { property, start: startBound, end: endBound } = bounds;
    const { between, normalize } = propertyFn(property);
    const count = points.length;
    let { start, end, loop } = segment;
    let i, ilen;
    if (loop) {
      start += count;
      end += count;
      for (i = 0, ilen = count; i < ilen; ++i) {
        if (!between(normalize(points[start % count][property]), startBound, endBound)) {
          break;
        }
        start--;
        end--;
      }
      start %= count;
      end %= count;
    }
    if (end < start) {
      end += count;
    }
    return {
      start,
      end,
      loop,
      style: segment.style
    };
  }
  function _boundSegment(segment, points, bounds) {
    if (!bounds) {
      return [
        segment
      ];
    }
    const { property, start: startBound, end: endBound } = bounds;
    const count = points.length;
    const { compare, between, normalize } = propertyFn(property);
    const { start, end, loop, style } = getSegment(segment, points, bounds);
    const result = [];
    let inside = false;
    let subStart = null;
    let value, point, prevValue;
    const startIsBefore = () => between(startBound, prevValue, value) && compare(startBound, prevValue) !== 0;
    const endIsBefore = () => compare(endBound, value) === 0 || between(endBound, prevValue, value);
    const shouldStart = () => inside || startIsBefore();
    const shouldStop = () => !inside || endIsBefore();
    for (let i = start, prev = start; i <= end; ++i) {
      point = points[i % count];
      if (point.skip) {
        continue;
      }
      value = normalize(point[property]);
      if (value === prevValue) {
        continue;
      }
      inside = between(value, startBound, endBound);
      if (subStart === null && shouldStart()) {
        subStart = compare(value, startBound) === 0 ? i : prev;
      }
      if (subStart !== null && shouldStop()) {
        result.push(normalizeSegment({
          start: subStart,
          end: i,
          loop,
          count,
          style
        }));
        subStart = null;
      }
      prev = i;
      prevValue = value;
    }
    if (subStart !== null) {
      result.push(normalizeSegment({
        start: subStart,
        end,
        loop,
        count,
        style
      }));
    }
    return result;
  }
  function _boundSegments(line, bounds) {
    const result = [];
    const segments = line.segments;
    for (let i = 0; i < segments.length; i++) {
      const sub = _boundSegment(segments[i], line.points, bounds);
      if (sub.length) {
        result.push(...sub);
      }
    }
    return result;
  }
  function findStartAndEnd(points, count, loop, spanGaps) {
    let start = 0;
    let end = count - 1;
    if (loop && !spanGaps) {
      while (start < count && !points[start].skip) {
        start++;
      }
    }
    while (start < count && points[start].skip) {
      start++;
    }
    start %= count;
    if (loop) {
      end += start;
    }
    while (end > start && points[end % count].skip) {
      end--;
    }
    end %= count;
    return {
      start,
      end
    };
  }
  function solidSegments(points, start, max, loop) {
    const count = points.length;
    const result = [];
    let last = start;
    let prev = points[start];
    let end;
    for (end = start + 1; end <= max; ++end) {
      const cur = points[end % count];
      if (cur.skip || cur.stop) {
        if (!prev.skip) {
          loop = false;
          result.push({
            start: start % count,
            end: (end - 1) % count,
            loop
          });
          start = last = cur.stop ? end : null;
        }
      } else {
        last = end;
        if (prev.skip) {
          start = end;
        }
      }
      prev = cur;
    }
    if (last !== null) {
      result.push({
        start: start % count,
        end: last % count,
        loop
      });
    }
    return result;
  }
  function _computeSegments(line, segmentOptions) {
    const points = line.points;
    const spanGaps = line.options.spanGaps;
    const count = points.length;
    if (!count) {
      return [];
    }
    const loop = !!line._loop;
    const { start, end } = findStartAndEnd(points, count, loop, spanGaps);
    if (spanGaps === true) {
      return splitByStyles(line, [
        {
          start,
          end,
          loop
        }
      ], points, segmentOptions);
    }
    const max = end < start ? end + count : end;
    const completeLoop = !!line._fullLoop && start === 0 && end === count - 1;
    return splitByStyles(line, solidSegments(points, start, max, completeLoop), points, segmentOptions);
  }
  function splitByStyles(line, segments, points, segmentOptions) {
    if (!segmentOptions || !segmentOptions.setContext || !points) {
      return segments;
    }
    return doSplitByStyles(line, segments, points, segmentOptions);
  }
  function doSplitByStyles(line, segments, points, segmentOptions) {
    const chartContext = line._chart.getContext();
    const baseStyle = readStyle(line.options);
    const { _datasetIndex: datasetIndex, options: { spanGaps } } = line;
    const count = points.length;
    const result = [];
    let prevStyle = baseStyle;
    let start = segments[0].start;
    let i = start;
    function addStyle(s, e, l, st) {
      const dir = spanGaps ? -1 : 1;
      if (s === e) {
        return;
      }
      s += count;
      while (points[s % count].skip) {
        s -= dir;
      }
      while (points[e % count].skip) {
        e += dir;
      }
      if (s % count !== e % count) {
        result.push({
          start: s % count,
          end: e % count,
          loop: l,
          style: st
        });
        prevStyle = st;
        start = e % count;
      }
    }
    for (const segment of segments) {
      start = spanGaps ? start : segment.start;
      let prev = points[start % count];
      let style;
      for (i = start + 1; i <= segment.end; i++) {
        const pt = points[i % count];
        style = readStyle(segmentOptions.setContext(createContext(chartContext, {
          type: "segment",
          p0: prev,
          p1: pt,
          p0DataIndex: (i - 1) % count,
          p1DataIndex: i % count,
          datasetIndex
        })));
        if (styleChanged(style, prevStyle)) {
          addStyle(start, i - 1, segment.loop, prevStyle);
        }
        prev = pt;
        prevStyle = style;
      }
      if (start < i - 1) {
        addStyle(start, i - 1, segment.loop, prevStyle);
      }
    }
    return result;
  }
  function readStyle(options) {
    return {
      backgroundColor: options.backgroundColor,
      borderCapStyle: options.borderCapStyle,
      borderDash: options.borderDash,
      borderDashOffset: options.borderDashOffset,
      borderJoinStyle: options.borderJoinStyle,
      borderWidth: options.borderWidth,
      borderColor: options.borderColor
    };
  }
  function styleChanged(style, prevStyle) {
    if (!prevStyle) {
      return false;
    }
    const cache = [];
    const replacer = function(key, value) {
      if (!isPatternOrGradient(value)) {
        return value;
      }
      if (!cache.includes(value)) {
        cache.push(value);
      }
      return cache.indexOf(value);
    };
    return JSON.stringify(style, replacer) !== JSON.stringify(prevStyle, replacer);
  }
  function getSizeForArea(scale, chartArea, field) {
    return scale.options.clip ? scale[field] : chartArea[field];
  }
  function getDatasetArea(meta, chartArea) {
    const { xScale, yScale } = meta;
    if (xScale && yScale) {
      return {
        left: getSizeForArea(xScale, chartArea, "left"),
        right: getSizeForArea(xScale, chartArea, "right"),
        top: getSizeForArea(yScale, chartArea, "top"),
        bottom: getSizeForArea(yScale, chartArea, "bottom")
      };
    }
    return chartArea;
  }
  function getDatasetClipArea(chart, meta) {
    const clip = meta._clip;
    if (clip.disabled) {
      return false;
    }
    const area = getDatasetArea(meta, chart.chartArea);
    return {
      left: clip.left === false ? 0 : area.left - (clip.left === true ? 0 : clip.left),
      right: clip.right === false ? chart.width : area.right + (clip.right === true ? 0 : clip.right),
      top: clip.top === false ? 0 : area.top - (clip.top === true ? 0 : clip.top),
      bottom: clip.bottom === false ? chart.height : area.bottom + (clip.bottom === true ? 0 : clip.bottom)
    };
  }

  // ../../../../../../../../node_modules/chart.js/dist/chart.js
  var Animator = class {
    constructor() {
      this._request = null;
      this._charts = /* @__PURE__ */ new Map();
      this._running = false;
      this._lastDate = void 0;
    }
    _notify(chart, anims, date, type) {
      const callbacks = anims.listeners[type];
      const numSteps = anims.duration;
      callbacks.forEach((fn) => fn({
        chart,
        initial: anims.initial,
        numSteps,
        currentStep: Math.min(date - anims.start, numSteps)
      }));
    }
    _refresh() {
      if (this._request) {
        return;
      }
      this._running = true;
      this._request = requestAnimFrame.call(window, () => {
        this._update();
        this._request = null;
        if (this._running) {
          this._refresh();
        }
      });
    }
    _update(date = Date.now()) {
      let remaining = 0;
      this._charts.forEach((anims, chart) => {
        if (!anims.running || !anims.items.length) {
          return;
        }
        const items = anims.items;
        let i = items.length - 1;
        let draw2 = false;
        let item;
        for (; i >= 0; --i) {
          item = items[i];
          if (item._active) {
            if (item._total > anims.duration) {
              anims.duration = item._total;
            }
            item.tick(date);
            draw2 = true;
          } else {
            items[i] = items[items.length - 1];
            items.pop();
          }
        }
        if (draw2) {
          chart.draw();
          this._notify(chart, anims, date, "progress");
        }
        if (!items.length) {
          anims.running = false;
          this._notify(chart, anims, date, "complete");
          anims.initial = false;
        }
        remaining += items.length;
      });
      this._lastDate = date;
      if (remaining === 0) {
        this._running = false;
      }
    }
    _getAnims(chart) {
      const charts = this._charts;
      let anims = charts.get(chart);
      if (!anims) {
        anims = {
          running: false,
          initial: true,
          items: [],
          listeners: {
            complete: [],
            progress: []
          }
        };
        charts.set(chart, anims);
      }
      return anims;
    }
    listen(chart, event, cb) {
      this._getAnims(chart).listeners[event].push(cb);
    }
    add(chart, items) {
      if (!items || !items.length) {
        return;
      }
      this._getAnims(chart).items.push(...items);
    }
    has(chart) {
      return this._getAnims(chart).items.length > 0;
    }
    start(chart) {
      const anims = this._charts.get(chart);
      if (!anims) {
        return;
      }
      anims.running = true;
      anims.start = Date.now();
      anims.duration = anims.items.reduce((acc, cur) => Math.max(acc, cur._duration), 0);
      this._refresh();
    }
    running(chart) {
      if (!this._running) {
        return false;
      }
      const anims = this._charts.get(chart);
      if (!anims || !anims.running || !anims.items.length) {
        return false;
      }
      return true;
    }
    stop(chart) {
      const anims = this._charts.get(chart);
      if (!anims || !anims.items.length) {
        return;
      }
      const items = anims.items;
      let i = items.length - 1;
      for (; i >= 0; --i) {
        items[i].cancel();
      }
      anims.items = [];
      this._notify(chart, anims, Date.now(), "complete");
    }
    remove(chart) {
      return this._charts.delete(chart);
    }
  };
  var animator = /* @__PURE__ */ new Animator();
  var transparent = "transparent";
  var interpolators = {
    boolean(from2, to2, factor) {
      return factor > 0.5 ? to2 : from2;
    },
    color(from2, to2, factor) {
      const c0 = color(from2 || transparent);
      const c1 = c0.valid && color(to2 || transparent);
      return c1 && c1.valid ? c1.mix(c0, factor).hexString() : to2;
    },
    number(from2, to2, factor) {
      return from2 + (to2 - from2) * factor;
    }
  };
  var Animation = class {
    constructor(cfg, target, prop, to2) {
      const currentValue = target[prop];
      to2 = resolve([
        cfg.to,
        to2,
        currentValue,
        cfg.from
      ]);
      const from2 = resolve([
        cfg.from,
        currentValue,
        to2
      ]);
      this._active = true;
      this._fn = cfg.fn || interpolators[cfg.type || typeof from2];
      this._easing = effects[cfg.easing] || effects.linear;
      this._start = Math.floor(Date.now() + (cfg.delay || 0));
      this._duration = this._total = Math.floor(cfg.duration);
      this._loop = !!cfg.loop;
      this._target = target;
      this._prop = prop;
      this._from = from2;
      this._to = to2;
      this._promises = void 0;
    }
    active() {
      return this._active;
    }
    update(cfg, to2, date) {
      if (this._active) {
        this._notify(false);
        const currentValue = this._target[this._prop];
        const elapsed = date - this._start;
        const remain = this._duration - elapsed;
        this._start = date;
        this._duration = Math.floor(Math.max(remain, cfg.duration));
        this._total += elapsed;
        this._loop = !!cfg.loop;
        this._to = resolve([
          cfg.to,
          to2,
          currentValue,
          cfg.from
        ]);
        this._from = resolve([
          cfg.from,
          currentValue,
          to2
        ]);
      }
    }
    cancel() {
      if (this._active) {
        this.tick(Date.now());
        this._active = false;
        this._notify(false);
      }
    }
    tick(date) {
      const elapsed = date - this._start;
      const duration = this._duration;
      const prop = this._prop;
      const from2 = this._from;
      const loop = this._loop;
      const to2 = this._to;
      let factor;
      this._active = from2 !== to2 && (loop || elapsed < duration);
      if (!this._active) {
        this._target[prop] = to2;
        this._notify(true);
        return;
      }
      if (elapsed < 0) {
        this._target[prop] = from2;
        return;
      }
      factor = elapsed / duration % 2;
      factor = loop && factor > 1 ? 2 - factor : factor;
      factor = this._easing(Math.min(1, Math.max(0, factor)));
      this._target[prop] = this._fn(from2, to2, factor);
    }
    wait() {
      const promises = this._promises || (this._promises = []);
      return new Promise((res, rej) => {
        promises.push({
          res,
          rej
        });
      });
    }
    _notify(resolved) {
      const method = resolved ? "res" : "rej";
      const promises = this._promises || [];
      for (let i = 0; i < promises.length; i++) {
        promises[i][method]();
      }
    }
  };
  var Animations = class {
    constructor(chart, config) {
      this._chart = chart;
      this._properties = /* @__PURE__ */ new Map();
      this.configure(config);
    }
    configure(config) {
      if (!isObject(config)) {
        return;
      }
      const animationOptions = Object.keys(defaults.animation);
      const animatedProps = this._properties;
      Object.getOwnPropertyNames(config).forEach((key) => {
        const cfg = config[key];
        if (!isObject(cfg)) {
          return;
        }
        const resolved = {};
        for (const option of animationOptions) {
          resolved[option] = cfg[option];
        }
        (isArray(cfg.properties) && cfg.properties || [
          key
        ]).forEach((prop) => {
          if (prop === key || !animatedProps.has(prop)) {
            animatedProps.set(prop, resolved);
          }
        });
      });
    }
    _animateOptions(target, values) {
      const newOptions = values.options;
      const options = resolveTargetOptions(target, newOptions);
      if (!options) {
        return [];
      }
      const animations = this._createAnimations(options, newOptions);
      if (newOptions.$shared) {
        awaitAll(target.options.$animations, newOptions).then(() => {
          target.options = newOptions;
        }, () => {
        });
      }
      return animations;
    }
    _createAnimations(target, values) {
      const animatedProps = this._properties;
      const animations = [];
      const running = target.$animations || (target.$animations = {});
      const props = Object.keys(values);
      const date = Date.now();
      let i;
      for (i = props.length - 1; i >= 0; --i) {
        const prop = props[i];
        if (prop.charAt(0) === "$") {
          continue;
        }
        if (prop === "options") {
          animations.push(...this._animateOptions(target, values));
          continue;
        }
        const value = values[prop];
        let animation = running[prop];
        const cfg = animatedProps.get(prop);
        if (animation) {
          if (cfg && animation.active()) {
            animation.update(cfg, value, date);
            continue;
          } else {
            animation.cancel();
          }
        }
        if (!cfg || !cfg.duration) {
          target[prop] = value;
          continue;
        }
        running[prop] = animation = new Animation(cfg, target, prop, value);
        animations.push(animation);
      }
      return animations;
    }
    update(target, values) {
      if (this._properties.size === 0) {
        Object.assign(target, values);
        return;
      }
      const animations = this._createAnimations(target, values);
      if (animations.length) {
        animator.add(this._chart, animations);
        return true;
      }
    }
  };
  function awaitAll(animations, properties) {
    const running = [];
    const keys = Object.keys(properties);
    for (let i = 0; i < keys.length; i++) {
      const anim = animations[keys[i]];
      if (anim && anim.active()) {
        running.push(anim.wait());
      }
    }
    return Promise.all(running);
  }
  function resolveTargetOptions(target, newOptions) {
    if (!newOptions) {
      return;
    }
    let options = target.options;
    if (!options) {
      target.options = newOptions;
      return;
    }
    if (options.$shared) {
      target.options = options = Object.assign({}, options, {
        $shared: false,
        $animations: {}
      });
    }
    return options;
  }
  function scaleClip(scale, allowedOverflow) {
    const opts = scale && scale.options || {};
    const reverse = opts.reverse;
    const min = opts.min === void 0 ? allowedOverflow : 0;
    const max = opts.max === void 0 ? allowedOverflow : 0;
    return {
      start: reverse ? max : min,
      end: reverse ? min : max
    };
  }
  function defaultClip(xScale, yScale, allowedOverflow) {
    if (allowedOverflow === false) {
      return false;
    }
    const x = scaleClip(xScale, allowedOverflow);
    const y = scaleClip(yScale, allowedOverflow);
    return {
      top: y.end,
      right: x.end,
      bottom: y.start,
      left: x.start
    };
  }
  function toClip(value) {
    let t, r, b, l;
    if (isObject(value)) {
      t = value.top;
      r = value.right;
      b = value.bottom;
      l = value.left;
    } else {
      t = r = b = l = value;
    }
    return {
      top: t,
      right: r,
      bottom: b,
      left: l,
      disabled: value === false
    };
  }
  function getSortedDatasetIndices(chart, filterVisible) {
    const keys = [];
    const metasets = chart._getSortedDatasetMetas(filterVisible);
    let i, ilen;
    for (i = 0, ilen = metasets.length; i < ilen; ++i) {
      keys.push(metasets[i].index);
    }
    return keys;
  }
  function applyStack(stack, value, dsIndex, options = {}) {
    const keys = stack.keys;
    const singleMode = options.mode === "single";
    let i, ilen, datasetIndex, otherValue;
    if (value === null) {
      return;
    }
    let found = false;
    for (i = 0, ilen = keys.length; i < ilen; ++i) {
      datasetIndex = +keys[i];
      if (datasetIndex === dsIndex) {
        found = true;
        if (options.all) {
          continue;
        }
        break;
      }
      otherValue = stack.values[datasetIndex];
      if (isNumberFinite(otherValue) && (singleMode || value === 0 || sign(value) === sign(otherValue))) {
        value += otherValue;
      }
    }
    if (!found && !options.all) {
      return 0;
    }
    return value;
  }
  function convertObjectDataToArray(data, meta) {
    const { iScale, vScale } = meta;
    const iAxisKey = iScale.axis === "x" ? "x" : "y";
    const vAxisKey = vScale.axis === "x" ? "x" : "y";
    const keys = Object.keys(data);
    const adata = new Array(keys.length);
    let i, ilen, key;
    for (i = 0, ilen = keys.length; i < ilen; ++i) {
      key = keys[i];
      adata[i] = {
        [iAxisKey]: key,
        [vAxisKey]: data[key]
      };
    }
    return adata;
  }
  function isStacked(scale, meta) {
    const stacked = scale && scale.options.stacked;
    return stacked || stacked === void 0 && meta.stack !== void 0;
  }
  function getStackKey(indexScale, valueScale, meta) {
    return `${indexScale.id}.${valueScale.id}.${meta.stack || meta.type}`;
  }
  function getUserBounds(scale) {
    const { min, max, minDefined, maxDefined } = scale.getUserBounds();
    return {
      min: minDefined ? min : Number.NEGATIVE_INFINITY,
      max: maxDefined ? max : Number.POSITIVE_INFINITY
    };
  }
  function getOrCreateStack(stacks, stackKey, indexValue) {
    const subStack = stacks[stackKey] || (stacks[stackKey] = {});
    return subStack[indexValue] || (subStack[indexValue] = {});
  }
  function getLastIndexInStack(stack, vScale, positive, type) {
    for (const meta of vScale.getMatchingVisibleMetas(type).reverse()) {
      const value = stack[meta.index];
      if (positive && value > 0 || !positive && value < 0) {
        return meta.index;
      }
    }
    return null;
  }
  function updateStacks(controller, parsed) {
    const { chart, _cachedMeta: meta } = controller;
    const stacks = chart._stacks || (chart._stacks = {});
    const { iScale, vScale, index: datasetIndex } = meta;
    const iAxis = iScale.axis;
    const vAxis = vScale.axis;
    const key = getStackKey(iScale, vScale, meta);
    const ilen = parsed.length;
    let stack;
    for (let i = 0; i < ilen; ++i) {
      const item = parsed[i];
      const { [iAxis]: index2, [vAxis]: value } = item;
      const itemStacks = item._stacks || (item._stacks = {});
      stack = itemStacks[vAxis] = getOrCreateStack(stacks, key, index2);
      stack[datasetIndex] = value;
      stack._top = getLastIndexInStack(stack, vScale, true, meta.type);
      stack._bottom = getLastIndexInStack(stack, vScale, false, meta.type);
      const visualValues = stack._visualValues || (stack._visualValues = {});
      visualValues[datasetIndex] = value;
    }
  }
  function getFirstScaleId(chart, axis) {
    const scales = chart.scales;
    return Object.keys(scales).filter((key) => scales[key].axis === axis).shift();
  }
  function createDatasetContext(parent, index2) {
    return createContext(parent, {
      active: false,
      dataset: void 0,
      datasetIndex: index2,
      index: index2,
      mode: "default",
      type: "dataset"
    });
  }
  function createDataContext(parent, index2, element) {
    return createContext(parent, {
      active: false,
      dataIndex: index2,
      parsed: void 0,
      raw: void 0,
      element,
      index: index2,
      mode: "default",
      type: "data"
    });
  }
  function clearStacks(meta, items) {
    const datasetIndex = meta.controller.index;
    const axis = meta.vScale && meta.vScale.axis;
    if (!axis) {
      return;
    }
    items = items || meta._parsed;
    for (const parsed of items) {
      const stacks = parsed._stacks;
      if (!stacks || stacks[axis] === void 0 || stacks[axis][datasetIndex] === void 0) {
        return;
      }
      delete stacks[axis][datasetIndex];
      if (stacks[axis]._visualValues !== void 0 && stacks[axis]._visualValues[datasetIndex] !== void 0) {
        delete stacks[axis]._visualValues[datasetIndex];
      }
    }
  }
  var isDirectUpdateMode = (mode) => mode === "reset" || mode === "none";
  var cloneIfNotShared = (cached, shared) => shared ? cached : Object.assign({}, cached);
  var createStack = (canStack, meta, chart) => canStack && !meta.hidden && meta._stacked && {
    keys: getSortedDatasetIndices(chart, true),
    values: null
  };
  var DatasetController = class {
    constructor(chart, datasetIndex) {
      this.chart = chart;
      this._ctx = chart.ctx;
      this.index = datasetIndex;
      this._cachedDataOpts = {};
      this._cachedMeta = this.getMeta();
      this._type = this._cachedMeta.type;
      this.options = void 0;
      this._parsing = false;
      this._data = void 0;
      this._objectData = void 0;
      this._sharedOptions = void 0;
      this._drawStart = void 0;
      this._drawCount = void 0;
      this.enableOptionSharing = false;
      this.supportsDecimation = false;
      this.$context = void 0;
      this._syncList = [];
      this.datasetElementType = new.target.datasetElementType;
      this.dataElementType = new.target.dataElementType;
      this.initialize();
    }
    initialize() {
      const meta = this._cachedMeta;
      this.configure();
      this.linkScales();
      meta._stacked = isStacked(meta.vScale, meta);
      this.addElements();
      if (this.options.fill && !this.chart.isPluginEnabled("filler")) {
        console.warn("Tried to use the 'fill' option without the 'Filler' plugin enabled. Please import and register the 'Filler' plugin and make sure it is not disabled in the options");
      }
    }
    updateIndex(datasetIndex) {
      if (this.index !== datasetIndex) {
        clearStacks(this._cachedMeta);
      }
      this.index = datasetIndex;
    }
    linkScales() {
      const chart = this.chart;
      const meta = this._cachedMeta;
      const dataset = this.getDataset();
      const chooseId = (axis, x, y, r) => axis === "x" ? x : axis === "r" ? r : y;
      const xid = meta.xAxisID = valueOrDefault(dataset.xAxisID, getFirstScaleId(chart, "x"));
      const yid = meta.yAxisID = valueOrDefault(dataset.yAxisID, getFirstScaleId(chart, "y"));
      const rid = meta.rAxisID = valueOrDefault(dataset.rAxisID, getFirstScaleId(chart, "r"));
      const indexAxis = meta.indexAxis;
      const iid = meta.iAxisID = chooseId(indexAxis, xid, yid, rid);
      const vid = meta.vAxisID = chooseId(indexAxis, yid, xid, rid);
      meta.xScale = this.getScaleForId(xid);
      meta.yScale = this.getScaleForId(yid);
      meta.rScale = this.getScaleForId(rid);
      meta.iScale = this.getScaleForId(iid);
      meta.vScale = this.getScaleForId(vid);
    }
    getDataset() {
      return this.chart.data.datasets[this.index];
    }
    getMeta() {
      return this.chart.getDatasetMeta(this.index);
    }
    getScaleForId(scaleID) {
      return this.chart.scales[scaleID];
    }
    _getOtherScale(scale) {
      const meta = this._cachedMeta;
      return scale === meta.iScale ? meta.vScale : meta.iScale;
    }
    reset() {
      this._update("reset");
    }
    _destroy() {
      const meta = this._cachedMeta;
      if (this._data) {
        unlistenArrayEvents(this._data, this);
      }
      if (meta._stacked) {
        clearStacks(meta);
      }
    }
    _dataCheck() {
      const dataset = this.getDataset();
      const data = dataset.data || (dataset.data = []);
      const _data = this._data;
      if (isObject(data)) {
        const meta = this._cachedMeta;
        this._data = convertObjectDataToArray(data, meta);
      } else if (_data !== data) {
        if (_data) {
          unlistenArrayEvents(_data, this);
          const meta = this._cachedMeta;
          clearStacks(meta);
          meta._parsed = [];
        }
        if (data && Object.isExtensible(data)) {
          listenArrayEvents(data, this);
        }
        this._syncList = [];
        this._data = data;
      }
    }
    addElements() {
      const meta = this._cachedMeta;
      this._dataCheck();
      if (this.datasetElementType) {
        meta.dataset = new this.datasetElementType();
      }
    }
    buildOrUpdateElements(resetNewElements) {
      const meta = this._cachedMeta;
      const dataset = this.getDataset();
      let stackChanged = false;
      this._dataCheck();
      const oldStacked = meta._stacked;
      meta._stacked = isStacked(meta.vScale, meta);
      if (meta.stack !== dataset.stack) {
        stackChanged = true;
        clearStacks(meta);
        meta.stack = dataset.stack;
      }
      this._resyncElements(resetNewElements);
      if (stackChanged || oldStacked !== meta._stacked) {
        updateStacks(this, meta._parsed);
        meta._stacked = isStacked(meta.vScale, meta);
      }
    }
    configure() {
      const config = this.chart.config;
      const scopeKeys = config.datasetScopeKeys(this._type);
      const scopes = config.getOptionScopes(this.getDataset(), scopeKeys, true);
      this.options = config.createResolver(scopes, this.getContext());
      this._parsing = this.options.parsing;
      this._cachedDataOpts = {};
    }
    parse(start, count) {
      const { _cachedMeta: meta, _data: data } = this;
      const { iScale, _stacked } = meta;
      const iAxis = iScale.axis;
      let sorted = start === 0 && count === data.length ? true : meta._sorted;
      let prev = start > 0 && meta._parsed[start - 1];
      let i, cur, parsed;
      if (this._parsing === false) {
        meta._parsed = data;
        meta._sorted = true;
        parsed = data;
      } else {
        if (isArray(data[start])) {
          parsed = this.parseArrayData(meta, data, start, count);
        } else if (isObject(data[start])) {
          parsed = this.parseObjectData(meta, data, start, count);
        } else {
          parsed = this.parsePrimitiveData(meta, data, start, count);
        }
        const isNotInOrderComparedToPrev = () => cur[iAxis] === null || prev && cur[iAxis] < prev[iAxis];
        for (i = 0; i < count; ++i) {
          meta._parsed[i + start] = cur = parsed[i];
          if (sorted) {
            if (isNotInOrderComparedToPrev()) {
              sorted = false;
            }
            prev = cur;
          }
        }
        meta._sorted = sorted;
      }
      if (_stacked) {
        updateStacks(this, parsed);
      }
    }
    parsePrimitiveData(meta, data, start, count) {
      const { iScale, vScale } = meta;
      const iAxis = iScale.axis;
      const vAxis = vScale.axis;
      const labels = iScale.getLabels();
      const singleScale = iScale === vScale;
      const parsed = new Array(count);
      let i, ilen, index2;
      for (i = 0, ilen = count; i < ilen; ++i) {
        index2 = i + start;
        parsed[i] = {
          [iAxis]: singleScale || iScale.parse(labels[index2], index2),
          [vAxis]: vScale.parse(data[index2], index2)
        };
      }
      return parsed;
    }
    parseArrayData(meta, data, start, count) {
      const { xScale, yScale } = meta;
      const parsed = new Array(count);
      let i, ilen, index2, item;
      for (i = 0, ilen = count; i < ilen; ++i) {
        index2 = i + start;
        item = data[index2];
        parsed[i] = {
          x: xScale.parse(item[0], index2),
          y: yScale.parse(item[1], index2)
        };
      }
      return parsed;
    }
    parseObjectData(meta, data, start, count) {
      const { xScale, yScale } = meta;
      const { xAxisKey = "x", yAxisKey = "y" } = this._parsing;
      const parsed = new Array(count);
      let i, ilen, index2, item;
      for (i = 0, ilen = count; i < ilen; ++i) {
        index2 = i + start;
        item = data[index2];
        parsed[i] = {
          x: xScale.parse(resolveObjectKey(item, xAxisKey), index2),
          y: yScale.parse(resolveObjectKey(item, yAxisKey), index2)
        };
      }
      return parsed;
    }
    getParsed(index2) {
      return this._cachedMeta._parsed[index2];
    }
    getDataElement(index2) {
      return this._cachedMeta.data[index2];
    }
    applyStack(scale, parsed, mode) {
      const chart = this.chart;
      const meta = this._cachedMeta;
      const value = parsed[scale.axis];
      const stack = {
        keys: getSortedDatasetIndices(chart, true),
        values: parsed._stacks[scale.axis]._visualValues
      };
      return applyStack(stack, value, meta.index, {
        mode
      });
    }
    updateRangeFromParsed(range, scale, parsed, stack) {
      const parsedValue = parsed[scale.axis];
      let value = parsedValue === null ? NaN : parsedValue;
      const values = stack && parsed._stacks[scale.axis];
      if (stack && values) {
        stack.values = values;
        value = applyStack(stack, parsedValue, this._cachedMeta.index);
      }
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    }
    getMinMax(scale, canStack) {
      const meta = this._cachedMeta;
      const _parsed = meta._parsed;
      const sorted = meta._sorted && scale === meta.iScale;
      const ilen = _parsed.length;
      const otherScale = this._getOtherScale(scale);
      const stack = createStack(canStack, meta, this.chart);
      const range = {
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY
      };
      const { min: otherMin, max: otherMax } = getUserBounds(otherScale);
      let i, parsed;
      function _skip() {
        parsed = _parsed[i];
        const otherValue = parsed[otherScale.axis];
        return !isNumberFinite(parsed[scale.axis]) || otherMin > otherValue || otherMax < otherValue;
      }
      for (i = 0; i < ilen; ++i) {
        if (_skip()) {
          continue;
        }
        this.updateRangeFromParsed(range, scale, parsed, stack);
        if (sorted) {
          break;
        }
      }
      if (sorted) {
        for (i = ilen - 1; i >= 0; --i) {
          if (_skip()) {
            continue;
          }
          this.updateRangeFromParsed(range, scale, parsed, stack);
          break;
        }
      }
      return range;
    }
    getAllParsedValues(scale) {
      const parsed = this._cachedMeta._parsed;
      const values = [];
      let i, ilen, value;
      for (i = 0, ilen = parsed.length; i < ilen; ++i) {
        value = parsed[i][scale.axis];
        if (isNumberFinite(value)) {
          values.push(value);
        }
      }
      return values;
    }
    getMaxOverflow() {
      return false;
    }
    getLabelAndValue(index2) {
      const meta = this._cachedMeta;
      const iScale = meta.iScale;
      const vScale = meta.vScale;
      const parsed = this.getParsed(index2);
      return {
        label: iScale ? "" + iScale.getLabelForValue(parsed[iScale.axis]) : "",
        value: vScale ? "" + vScale.getLabelForValue(parsed[vScale.axis]) : ""
      };
    }
    _update(mode) {
      const meta = this._cachedMeta;
      this.update(mode || "default");
      meta._clip = toClip(valueOrDefault(this.options.clip, defaultClip(meta.xScale, meta.yScale, this.getMaxOverflow())));
    }
    update(mode) {
    }
    draw() {
      const ctx = this._ctx;
      const chart = this.chart;
      const meta = this._cachedMeta;
      const elements = meta.data || [];
      const area = chart.chartArea;
      const active = [];
      const start = this._drawStart || 0;
      const count = this._drawCount || elements.length - start;
      const drawActiveElementsOnTop = this.options.drawActiveElementsOnTop;
      let i;
      if (meta.dataset) {
        meta.dataset.draw(ctx, area, start, count);
      }
      for (i = start; i < start + count; ++i) {
        const element = elements[i];
        if (element.hidden) {
          continue;
        }
        if (element.active && drawActiveElementsOnTop) {
          active.push(element);
        } else {
          element.draw(ctx, area);
        }
      }
      for (i = 0; i < active.length; ++i) {
        active[i].draw(ctx, area);
      }
    }
    getStyle(index2, active) {
      const mode = active ? "active" : "default";
      return index2 === void 0 && this._cachedMeta.dataset ? this.resolveDatasetElementOptions(mode) : this.resolveDataElementOptions(index2 || 0, mode);
    }
    getContext(index2, active, mode) {
      const dataset = this.getDataset();
      let context;
      if (index2 >= 0 && index2 < this._cachedMeta.data.length) {
        const element = this._cachedMeta.data[index2];
        context = element.$context || (element.$context = createDataContext(this.getContext(), index2, element));
        context.parsed = this.getParsed(index2);
        context.raw = dataset.data[index2];
        context.index = context.dataIndex = index2;
      } else {
        context = this.$context || (this.$context = createDatasetContext(this.chart.getContext(), this.index));
        context.dataset = dataset;
        context.index = context.datasetIndex = this.index;
      }
      context.active = !!active;
      context.mode = mode;
      return context;
    }
    resolveDatasetElementOptions(mode) {
      return this._resolveElementOptions(this.datasetElementType.id, mode);
    }
    resolveDataElementOptions(index2, mode) {
      return this._resolveElementOptions(this.dataElementType.id, mode, index2);
    }
    _resolveElementOptions(elementType, mode = "default", index2) {
      const active = mode === "active";
      const cache = this._cachedDataOpts;
      const cacheKey = elementType + "-" + mode;
      const cached = cache[cacheKey];
      const sharing = this.enableOptionSharing && defined(index2);
      if (cached) {
        return cloneIfNotShared(cached, sharing);
      }
      const config = this.chart.config;
      const scopeKeys = config.datasetElementScopeKeys(this._type, elementType);
      const prefixes = active ? [
        `${elementType}Hover`,
        "hover",
        elementType,
        ""
      ] : [
        elementType,
        ""
      ];
      const scopes = config.getOptionScopes(this.getDataset(), scopeKeys);
      const names2 = Object.keys(defaults.elements[elementType]);
      const context = () => this.getContext(index2, active, mode);
      const values = config.resolveNamedOptions(scopes, names2, context, prefixes);
      if (values.$shared) {
        values.$shared = sharing;
        cache[cacheKey] = Object.freeze(cloneIfNotShared(values, sharing));
      }
      return values;
    }
    _resolveAnimations(index2, transition, active) {
      const chart = this.chart;
      const cache = this._cachedDataOpts;
      const cacheKey = `animation-${transition}`;
      const cached = cache[cacheKey];
      if (cached) {
        return cached;
      }
      let options;
      if (chart.options.animation !== false) {
        const config = this.chart.config;
        const scopeKeys = config.datasetAnimationScopeKeys(this._type, transition);
        const scopes = config.getOptionScopes(this.getDataset(), scopeKeys);
        options = config.createResolver(scopes, this.getContext(index2, active, transition));
      }
      const animations = new Animations(chart, options && options.animations);
      if (options && options._cacheable) {
        cache[cacheKey] = Object.freeze(animations);
      }
      return animations;
    }
    getSharedOptions(options) {
      if (!options.$shared) {
        return;
      }
      return this._sharedOptions || (this._sharedOptions = Object.assign({}, options));
    }
    includeOptions(mode, sharedOptions) {
      return !sharedOptions || isDirectUpdateMode(mode) || this.chart._animationsDisabled;
    }
    _getSharedOptions(start, mode) {
      const firstOpts = this.resolveDataElementOptions(start, mode);
      const previouslySharedOptions = this._sharedOptions;
      const sharedOptions = this.getSharedOptions(firstOpts);
      const includeOptions = this.includeOptions(mode, sharedOptions) || sharedOptions !== previouslySharedOptions;
      this.updateSharedOptions(sharedOptions, mode, firstOpts);
      return {
        sharedOptions,
        includeOptions
      };
    }
    updateElement(element, index2, properties, mode) {
      if (isDirectUpdateMode(mode)) {
        Object.assign(element, properties);
      } else {
        this._resolveAnimations(index2, mode).update(element, properties);
      }
    }
    updateSharedOptions(sharedOptions, mode, newOptions) {
      if (sharedOptions && !isDirectUpdateMode(mode)) {
        this._resolveAnimations(void 0, mode).update(sharedOptions, newOptions);
      }
    }
    _setStyle(element, index2, mode, active) {
      element.active = active;
      const options = this.getStyle(index2, active);
      this._resolveAnimations(index2, mode, active).update(element, {
        options: !active && this.getSharedOptions(options) || options
      });
    }
    removeHoverStyle(element, datasetIndex, index2) {
      this._setStyle(element, index2, "active", false);
    }
    setHoverStyle(element, datasetIndex, index2) {
      this._setStyle(element, index2, "active", true);
    }
    _removeDatasetHoverStyle() {
      const element = this._cachedMeta.dataset;
      if (element) {
        this._setStyle(element, void 0, "active", false);
      }
    }
    _setDatasetHoverStyle() {
      const element = this._cachedMeta.dataset;
      if (element) {
        this._setStyle(element, void 0, "active", true);
      }
    }
    _resyncElements(resetNewElements) {
      const data = this._data;
      const elements = this._cachedMeta.data;
      for (const [method, arg1, arg2] of this._syncList) {
        this[method](arg1, arg2);
      }
      this._syncList = [];
      const numMeta = elements.length;
      const numData = data.length;
      const count = Math.min(numData, numMeta);
      if (count) {
        this.parse(0, count);
      }
      if (numData > numMeta) {
        this._insertElements(numMeta, numData - numMeta, resetNewElements);
      } else if (numData < numMeta) {
        this._removeElements(numData, numMeta - numData);
      }
    }
    _insertElements(start, count, resetNewElements = true) {
      const meta = this._cachedMeta;
      const data = meta.data;
      const end = start + count;
      let i;
      const move = (arr) => {
        arr.length += count;
        for (i = arr.length - 1; i >= end; i--) {
          arr[i] = arr[i - count];
        }
      };
      move(data);
      for (i = start; i < end; ++i) {
        data[i] = new this.dataElementType();
      }
      if (this._parsing) {
        move(meta._parsed);
      }
      this.parse(start, count);
      if (resetNewElements) {
        this.updateElements(data, start, count, "reset");
      }
    }
    updateElements(element, start, count, mode) {
    }
    _removeElements(start, count) {
      const meta = this._cachedMeta;
      if (this._parsing) {
        const removed = meta._parsed.splice(start, count);
        if (meta._stacked) {
          clearStacks(meta, removed);
        }
      }
      meta.data.splice(start, count);
    }
    _sync(args) {
      if (this._parsing) {
        this._syncList.push(args);
      } else {
        const [method, arg1, arg2] = args;
        this[method](arg1, arg2);
      }
      this.chart._dataChanges.push([
        this.index,
        ...args
      ]);
    }
    _onDataPush() {
      const count = arguments.length;
      this._sync([
        "_insertElements",
        this.getDataset().data.length - count,
        count
      ]);
    }
    _onDataPop() {
      this._sync([
        "_removeElements",
        this._cachedMeta.data.length - 1,
        1
      ]);
    }
    _onDataShift() {
      this._sync([
        "_removeElements",
        0,
        1
      ]);
    }
    _onDataSplice(start, count) {
      if (count) {
        this._sync([
          "_removeElements",
          start,
          count
        ]);
      }
      const newCount = arguments.length - 2;
      if (newCount) {
        this._sync([
          "_insertElements",
          start,
          newCount
        ]);
      }
    }
    _onDataUnshift() {
      this._sync([
        "_insertElements",
        0,
        arguments.length
      ]);
    }
  };
  __publicField(DatasetController, "defaults", {});
  __publicField(DatasetController, "datasetElementType", null);
  __publicField(DatasetController, "dataElementType", null);
  function getAllScaleValues(scale, type) {
    if (!scale._cache.$bar) {
      const visibleMetas = scale.getMatchingVisibleMetas(type);
      let values = [];
      for (let i = 0, ilen = visibleMetas.length; i < ilen; i++) {
        values = values.concat(visibleMetas[i].controller.getAllParsedValues(scale));
      }
      scale._cache.$bar = _arrayUnique(values.sort((a, b) => a - b));
    }
    return scale._cache.$bar;
  }
  function computeMinSampleSize(meta) {
    const scale = meta.iScale;
    const values = getAllScaleValues(scale, meta.type);
    let min = scale._length;
    let i, ilen, curr, prev;
    const updateMinAndPrev = () => {
      if (curr === 32767 || curr === -32768) {
        return;
      }
      if (defined(prev)) {
        min = Math.min(min, Math.abs(curr - prev) || min);
      }
      prev = curr;
    };
    for (i = 0, ilen = values.length; i < ilen; ++i) {
      curr = scale.getPixelForValue(values[i]);
      updateMinAndPrev();
    }
    prev = void 0;
    for (i = 0, ilen = scale.ticks.length; i < ilen; ++i) {
      curr = scale.getPixelForTick(i);
      updateMinAndPrev();
    }
    return min;
  }
  function computeFitCategoryTraits(index2, ruler, options, stackCount) {
    const thickness = options.barThickness;
    let size, ratio;
    if (isNullOrUndef(thickness)) {
      size = ruler.min * options.categoryPercentage;
      ratio = options.barPercentage;
    } else {
      size = thickness * stackCount;
      ratio = 1;
    }
    return {
      chunk: size / stackCount,
      ratio,
      start: ruler.pixels[index2] - size / 2
    };
  }
  function computeFlexCategoryTraits(index2, ruler, options, stackCount) {
    const pixels = ruler.pixels;
    const curr = pixels[index2];
    let prev = index2 > 0 ? pixels[index2 - 1] : null;
    let next = index2 < pixels.length - 1 ? pixels[index2 + 1] : null;
    const percent = options.categoryPercentage;
    if (prev === null) {
      prev = curr - (next === null ? ruler.end - ruler.start : next - curr);
    }
    if (next === null) {
      next = curr + curr - prev;
    }
    const start = curr - (curr - Math.min(prev, next)) / 2 * percent;
    const size = Math.abs(next - prev) / 2 * percent;
    return {
      chunk: size / stackCount,
      ratio: options.barPercentage,
      start
    };
  }
  function parseFloatBar(entry, item, vScale, i) {
    const startValue = vScale.parse(entry[0], i);
    const endValue = vScale.parse(entry[1], i);
    const min = Math.min(startValue, endValue);
    const max = Math.max(startValue, endValue);
    let barStart = min;
    let barEnd = max;
    if (Math.abs(min) > Math.abs(max)) {
      barStart = max;
      barEnd = min;
    }
    item[vScale.axis] = barEnd;
    item._custom = {
      barStart,
      barEnd,
      start: startValue,
      end: endValue,
      min,
      max
    };
  }
  function parseValue(entry, item, vScale, i) {
    if (isArray(entry)) {
      parseFloatBar(entry, item, vScale, i);
    } else {
      item[vScale.axis] = vScale.parse(entry, i);
    }
    return item;
  }
  function parseArrayOrPrimitive(meta, data, start, count) {
    const iScale = meta.iScale;
    const vScale = meta.vScale;
    const labels = iScale.getLabels();
    const singleScale = iScale === vScale;
    const parsed = [];
    let i, ilen, item, entry;
    for (i = start, ilen = start + count; i < ilen; ++i) {
      entry = data[i];
      item = {};
      item[iScale.axis] = singleScale || iScale.parse(labels[i], i);
      parsed.push(parseValue(entry, item, vScale, i));
    }
    return parsed;
  }
  function isFloatBar(custom) {
    return custom && custom.barStart !== void 0 && custom.barEnd !== void 0;
  }
  function barSign(size, vScale, actualBase) {
    if (size !== 0) {
      return sign(size);
    }
    return (vScale.isHorizontal() ? 1 : -1) * (vScale.min >= actualBase ? 1 : -1);
  }
  function borderProps(properties) {
    let reverse, start, end, top, bottom;
    if (properties.horizontal) {
      reverse = properties.base > properties.x;
      start = "left";
      end = "right";
    } else {
      reverse = properties.base < properties.y;
      start = "bottom";
      end = "top";
    }
    if (reverse) {
      top = "end";
      bottom = "start";
    } else {
      top = "start";
      bottom = "end";
    }
    return {
      start,
      end,
      reverse,
      top,
      bottom
    };
  }
  function setBorderSkipped(properties, options, stack, index2) {
    let edge = options.borderSkipped;
    const res = {};
    if (!edge) {
      properties.borderSkipped = res;
      return;
    }
    if (edge === true) {
      properties.borderSkipped = {
        top: true,
        right: true,
        bottom: true,
        left: true
      };
      return;
    }
    const { start, end, reverse, top, bottom } = borderProps(properties);
    if (edge === "middle" && stack) {
      properties.enableBorderRadius = true;
      if ((stack._top || 0) === index2) {
        edge = top;
      } else if ((stack._bottom || 0) === index2) {
        edge = bottom;
      } else {
        res[parseEdge(bottom, start, end, reverse)] = true;
        edge = top;
      }
    }
    res[parseEdge(edge, start, end, reverse)] = true;
    properties.borderSkipped = res;
  }
  function parseEdge(edge, a, b, reverse) {
    if (reverse) {
      edge = swap(edge, a, b);
      edge = startEnd(edge, b, a);
    } else {
      edge = startEnd(edge, a, b);
    }
    return edge;
  }
  function swap(orig, v1, v2) {
    return orig === v1 ? v2 : orig === v2 ? v1 : orig;
  }
  function startEnd(v, start, end) {
    return v === "start" ? start : v === "end" ? end : v;
  }
  function setInflateAmount(properties, { inflateAmount }, ratio) {
    properties.inflateAmount = inflateAmount === "auto" ? ratio === 1 ? 0.33 : 0 : inflateAmount;
  }
  var BarController = class extends DatasetController {
    parsePrimitiveData(meta, data, start, count) {
      return parseArrayOrPrimitive(meta, data, start, count);
    }
    parseArrayData(meta, data, start, count) {
      return parseArrayOrPrimitive(meta, data, start, count);
    }
    parseObjectData(meta, data, start, count) {
      const { iScale, vScale } = meta;
      const { xAxisKey = "x", yAxisKey = "y" } = this._parsing;
      const iAxisKey = iScale.axis === "x" ? xAxisKey : yAxisKey;
      const vAxisKey = vScale.axis === "x" ? xAxisKey : yAxisKey;
      const parsed = [];
      let i, ilen, item, obj;
      for (i = start, ilen = start + count; i < ilen; ++i) {
        obj = data[i];
        item = {};
        item[iScale.axis] = iScale.parse(resolveObjectKey(obj, iAxisKey), i);
        parsed.push(parseValue(resolveObjectKey(obj, vAxisKey), item, vScale, i));
      }
      return parsed;
    }
    updateRangeFromParsed(range, scale, parsed, stack) {
      super.updateRangeFromParsed(range, scale, parsed, stack);
      const custom = parsed._custom;
      if (custom && scale === this._cachedMeta.vScale) {
        range.min = Math.min(range.min, custom.min);
        range.max = Math.max(range.max, custom.max);
      }
    }
    getMaxOverflow() {
      return 0;
    }
    getLabelAndValue(index2) {
      const meta = this._cachedMeta;
      const { iScale, vScale } = meta;
      const parsed = this.getParsed(index2);
      const custom = parsed._custom;
      const value = isFloatBar(custom) ? "[" + custom.start + ", " + custom.end + "]" : "" + vScale.getLabelForValue(parsed[vScale.axis]);
      return {
        label: "" + iScale.getLabelForValue(parsed[iScale.axis]),
        value
      };
    }
    initialize() {
      this.enableOptionSharing = true;
      super.initialize();
      const meta = this._cachedMeta;
      meta.stack = this.getDataset().stack;
    }
    update(mode) {
      const meta = this._cachedMeta;
      this.updateElements(meta.data, 0, meta.data.length, mode);
    }
    updateElements(bars, start, count, mode) {
      const reset = mode === "reset";
      const { index: index2, _cachedMeta: { vScale } } = this;
      const base = vScale.getBasePixel();
      const horizontal = vScale.isHorizontal();
      const ruler = this._getRuler();
      const { sharedOptions, includeOptions } = this._getSharedOptions(start, mode);
      for (let i = start; i < start + count; i++) {
        const parsed = this.getParsed(i);
        const vpixels = reset || isNullOrUndef(parsed[vScale.axis]) ? {
          base,
          head: base
        } : this._calculateBarValuePixels(i);
        const ipixels = this._calculateBarIndexPixels(i, ruler);
        const stack = (parsed._stacks || {})[vScale.axis];
        const properties = {
          horizontal,
          base: vpixels.base,
          enableBorderRadius: !stack || isFloatBar(parsed._custom) || index2 === stack._top || index2 === stack._bottom,
          x: horizontal ? vpixels.head : ipixels.center,
          y: horizontal ? ipixels.center : vpixels.head,
          height: horizontal ? ipixels.size : Math.abs(vpixels.size),
          width: horizontal ? Math.abs(vpixels.size) : ipixels.size
        };
        if (includeOptions) {
          properties.options = sharedOptions || this.resolveDataElementOptions(i, bars[i].active ? "active" : mode);
        }
        const options = properties.options || bars[i].options;
        setBorderSkipped(properties, options, stack, index2);
        setInflateAmount(properties, options, ruler.ratio);
        this.updateElement(bars[i], i, properties, mode);
      }
    }
    _getStacks(last, dataIndex) {
      const { iScale } = this._cachedMeta;
      const metasets = iScale.getMatchingVisibleMetas(this._type).filter((meta) => meta.controller.options.grouped);
      const stacked = iScale.options.stacked;
      const stacks = [];
      const currentParsed = this._cachedMeta.controller.getParsed(dataIndex);
      const iScaleValue = currentParsed && currentParsed[iScale.axis];
      const skipNull = (meta) => {
        const parsed = meta._parsed.find((item) => item[iScale.axis] === iScaleValue);
        const val = parsed && parsed[meta.vScale.axis];
        if (isNullOrUndef(val) || isNaN(val)) {
          return true;
        }
      };
      for (const meta of metasets) {
        if (dataIndex !== void 0 && skipNull(meta)) {
          continue;
        }
        if (stacked === false || stacks.indexOf(meta.stack) === -1 || stacked === void 0 && meta.stack === void 0) {
          stacks.push(meta.stack);
        }
        if (meta.index === last) {
          break;
        }
      }
      if (!stacks.length) {
        stacks.push(void 0);
      }
      return stacks;
    }
    _getStackCount(index2) {
      return this._getStacks(void 0, index2).length;
    }
    _getAxisCount() {
      return this._getAxis().length;
    }
    getFirstScaleIdForIndexAxis() {
      const scales = this.chart.scales;
      const indexScaleId = this.chart.options.indexAxis;
      return Object.keys(scales).filter((key) => scales[key].axis === indexScaleId).shift();
    }
    _getAxis() {
      const axis = {};
      const firstScaleAxisId = this.getFirstScaleIdForIndexAxis();
      for (const dataset of this.chart.data.datasets) {
        axis[valueOrDefault(this.chart.options.indexAxis === "x" ? dataset.xAxisID : dataset.yAxisID, firstScaleAxisId)] = true;
      }
      return Object.keys(axis);
    }
    _getStackIndex(datasetIndex, name, dataIndex) {
      const stacks = this._getStacks(datasetIndex, dataIndex);
      const index2 = name !== void 0 ? stacks.indexOf(name) : -1;
      return index2 === -1 ? stacks.length - 1 : index2;
    }
    _getRuler() {
      const opts = this.options;
      const meta = this._cachedMeta;
      const iScale = meta.iScale;
      const pixels = [];
      let i, ilen;
      for (i = 0, ilen = meta.data.length; i < ilen; ++i) {
        pixels.push(iScale.getPixelForValue(this.getParsed(i)[iScale.axis], i));
      }
      const barThickness = opts.barThickness;
      const min = barThickness || computeMinSampleSize(meta);
      return {
        min,
        pixels,
        start: iScale._startPixel,
        end: iScale._endPixel,
        stackCount: this._getStackCount(),
        scale: iScale,
        grouped: opts.grouped,
        ratio: barThickness ? 1 : opts.categoryPercentage * opts.barPercentage
      };
    }
    _calculateBarValuePixels(index2) {
      const { _cachedMeta: { vScale, _stacked, index: datasetIndex }, options: { base: baseValue, minBarLength } } = this;
      const actualBase = baseValue || 0;
      const parsed = this.getParsed(index2);
      const custom = parsed._custom;
      const floating = isFloatBar(custom);
      let value = parsed[vScale.axis];
      let start = 0;
      let length = _stacked ? this.applyStack(vScale, parsed, _stacked) : value;
      let head, size;
      if (length !== value) {
        start = length - value;
        length = value;
      }
      if (floating) {
        value = custom.barStart;
        length = custom.barEnd - custom.barStart;
        if (value !== 0 && sign(value) !== sign(custom.barEnd)) {
          start = 0;
        }
        start += value;
      }
      const startValue = !isNullOrUndef(baseValue) && !floating ? baseValue : start;
      let base = vScale.getPixelForValue(startValue);
      if (this.chart.getDataVisibility(index2)) {
        head = vScale.getPixelForValue(start + length);
      } else {
        head = base;
      }
      size = head - base;
      if (Math.abs(size) < minBarLength) {
        size = barSign(size, vScale, actualBase) * minBarLength;
        if (value === actualBase) {
          base -= size / 2;
        }
        const startPixel = vScale.getPixelForDecimal(0);
        const endPixel = vScale.getPixelForDecimal(1);
        const min = Math.min(startPixel, endPixel);
        const max = Math.max(startPixel, endPixel);
        base = Math.max(Math.min(base, max), min);
        head = base + size;
        if (_stacked && !floating) {
          parsed._stacks[vScale.axis]._visualValues[datasetIndex] = vScale.getValueForPixel(head) - vScale.getValueForPixel(base);
        }
      }
      if (base === vScale.getPixelForValue(actualBase)) {
        const halfGrid = sign(size) * vScale.getLineWidthForValue(actualBase) / 2;
        base += halfGrid;
        size -= halfGrid;
      }
      return {
        size,
        base,
        head,
        center: head + size / 2
      };
    }
    _calculateBarIndexPixels(index2, ruler) {
      const scale = ruler.scale;
      const options = this.options;
      const skipNull = options.skipNull;
      const maxBarThickness = valueOrDefault(options.maxBarThickness, Infinity);
      let center, size;
      const axisCount = this._getAxisCount();
      if (ruler.grouped) {
        const stackCount = skipNull ? this._getStackCount(index2) : ruler.stackCount;
        const range = options.barThickness === "flex" ? computeFlexCategoryTraits(index2, ruler, options, stackCount * axisCount) : computeFitCategoryTraits(index2, ruler, options, stackCount * axisCount);
        const axisID = this.chart.options.indexAxis === "x" ? this.getDataset().xAxisID : this.getDataset().yAxisID;
        const axisNumber = this._getAxis().indexOf(valueOrDefault(axisID, this.getFirstScaleIdForIndexAxis()));
        const stackIndex = this._getStackIndex(this.index, this._cachedMeta.stack, skipNull ? index2 : void 0) + axisNumber;
        center = range.start + range.chunk * stackIndex + range.chunk / 2;
        size = Math.min(maxBarThickness, range.chunk * range.ratio);
      } else {
        center = scale.getPixelForValue(this.getParsed(index2)[scale.axis], index2);
        size = Math.min(maxBarThickness, ruler.min * ruler.ratio);
      }
      return {
        base: center - size / 2,
        head: center + size / 2,
        center,
        size
      };
    }
    draw() {
      const meta = this._cachedMeta;
      const vScale = meta.vScale;
      const rects = meta.data;
      const ilen = rects.length;
      let i = 0;
      for (; i < ilen; ++i) {
        if (this.getParsed(i)[vScale.axis] !== null && !rects[i].hidden) {
          rects[i].draw(this._ctx);
        }
      }
    }
  };
  __publicField(BarController, "id", "bar");
  __publicField(BarController, "defaults", {
    datasetElementType: false,
    dataElementType: "bar",
    categoryPercentage: 0.8,
    barPercentage: 0.9,
    grouped: true,
    animations: {
      numbers: {
        type: "number",
        properties: [
          "x",
          "y",
          "base",
          "width",
          "height"
        ]
      }
    }
  });
  __publicField(BarController, "overrides", {
    scales: {
      _index_: {
        type: "category",
        offset: true,
        grid: {
          offset: true
        }
      },
      _value_: {
        type: "linear",
        beginAtZero: true
      }
    }
  });
  function getRatioAndOffset(rotation, circumference, cutout) {
    let ratioX = 1;
    let ratioY = 1;
    let offsetX = 0;
    let offsetY = 0;
    if (circumference < TAU) {
      const startAngle = rotation;
      const endAngle = startAngle + circumference;
      const startX = Math.cos(startAngle);
      const startY = Math.sin(startAngle);
      const endX = Math.cos(endAngle);
      const endY = Math.sin(endAngle);
      const calcMax = (angle, a, b) => _angleBetween(angle, startAngle, endAngle, true) ? 1 : Math.max(a, a * cutout, b, b * cutout);
      const calcMin = (angle, a, b) => _angleBetween(angle, startAngle, endAngle, true) ? -1 : Math.min(a, a * cutout, b, b * cutout);
      const maxX = calcMax(0, startX, endX);
      const maxY = calcMax(HALF_PI, startY, endY);
      const minX = calcMin(PI, startX, endX);
      const minY = calcMin(PI + HALF_PI, startY, endY);
      ratioX = (maxX - minX) / 2;
      ratioY = (maxY - minY) / 2;
      offsetX = -(maxX + minX) / 2;
      offsetY = -(maxY + minY) / 2;
    }
    return {
      ratioX,
      ratioY,
      offsetX,
      offsetY
    };
  }
  var DoughnutController = class extends DatasetController {
    constructor(chart, datasetIndex) {
      super(chart, datasetIndex);
      this.enableOptionSharing = true;
      this.innerRadius = void 0;
      this.outerRadius = void 0;
      this.offsetX = void 0;
      this.offsetY = void 0;
    }
    linkScales() {
    }
    parse(start, count) {
      const data = this.getDataset().data;
      const meta = this._cachedMeta;
      if (this._parsing === false) {
        meta._parsed = data;
      } else {
        let getter = (i2) => +data[i2];
        if (isObject(data[start])) {
          const { key = "value" } = this._parsing;
          getter = (i2) => +resolveObjectKey(data[i2], key);
        }
        let i, ilen;
        for (i = start, ilen = start + count; i < ilen; ++i) {
          meta._parsed[i] = getter(i);
        }
      }
    }
    _getRotation() {
      return toRadians(this.options.rotation - 90);
    }
    _getCircumference() {
      return toRadians(this.options.circumference);
    }
    _getRotationExtents() {
      let min = TAU;
      let max = -TAU;
      for (let i = 0; i < this.chart.data.datasets.length; ++i) {
        if (this.chart.isDatasetVisible(i) && this.chart.getDatasetMeta(i).type === this._type) {
          const controller = this.chart.getDatasetMeta(i).controller;
          const rotation = controller._getRotation();
          const circumference = controller._getCircumference();
          min = Math.min(min, rotation);
          max = Math.max(max, rotation + circumference);
        }
      }
      return {
        rotation: min,
        circumference: max - min
      };
    }
    update(mode) {
      const chart = this.chart;
      const { chartArea } = chart;
      const meta = this._cachedMeta;
      const arcs = meta.data;
      const spacing = this.getMaxBorderWidth() + this.getMaxOffset(arcs) + this.options.spacing;
      const maxSize = Math.max((Math.min(chartArea.width, chartArea.height) - spacing) / 2, 0);
      const cutout = Math.min(toPercentage(this.options.cutout, maxSize), 1);
      const chartWeight = this._getRingWeight(this.index);
      const { circumference, rotation } = this._getRotationExtents();
      const { ratioX, ratioY, offsetX, offsetY } = getRatioAndOffset(rotation, circumference, cutout);
      const maxWidth = (chartArea.width - spacing) / ratioX;
      const maxHeight = (chartArea.height - spacing) / ratioY;
      const maxRadius = Math.max(Math.min(maxWidth, maxHeight) / 2, 0);
      const outerRadius = toDimension(this.options.radius, maxRadius);
      const innerRadius = Math.max(outerRadius * cutout, 0);
      const radiusLength = (outerRadius - innerRadius) / this._getVisibleDatasetWeightTotal();
      this.offsetX = offsetX * outerRadius;
      this.offsetY = offsetY * outerRadius;
      meta.total = this.calculateTotal();
      this.outerRadius = outerRadius - radiusLength * this._getRingWeightOffset(this.index);
      this.innerRadius = Math.max(this.outerRadius - radiusLength * chartWeight, 0);
      this.updateElements(arcs, 0, arcs.length, mode);
    }
    _circumference(i, reset) {
      const opts = this.options;
      const meta = this._cachedMeta;
      const circumference = this._getCircumference();
      if (reset && opts.animation.animateRotate || !this.chart.getDataVisibility(i) || meta._parsed[i] === null || meta.data[i].hidden) {
        return 0;
      }
      return this.calculateCircumference(meta._parsed[i] * circumference / TAU);
    }
    updateElements(arcs, start, count, mode) {
      const reset = mode === "reset";
      const chart = this.chart;
      const chartArea = chart.chartArea;
      const opts = chart.options;
      const animationOpts = opts.animation;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      const animateScale = reset && animationOpts.animateScale;
      const innerRadius = animateScale ? 0 : this.innerRadius;
      const outerRadius = animateScale ? 0 : this.outerRadius;
      const { sharedOptions, includeOptions } = this._getSharedOptions(start, mode);
      let startAngle = this._getRotation();
      let i;
      for (i = 0; i < start; ++i) {
        startAngle += this._circumference(i, reset);
      }
      for (i = start; i < start + count; ++i) {
        const circumference = this._circumference(i, reset);
        const arc = arcs[i];
        const properties = {
          x: centerX + this.offsetX,
          y: centerY + this.offsetY,
          startAngle,
          endAngle: startAngle + circumference,
          circumference,
          outerRadius,
          innerRadius
        };
        if (includeOptions) {
          properties.options = sharedOptions || this.resolveDataElementOptions(i, arc.active ? "active" : mode);
        }
        startAngle += circumference;
        this.updateElement(arc, i, properties, mode);
      }
    }
    calculateTotal() {
      const meta = this._cachedMeta;
      const metaData = meta.data;
      let total = 0;
      let i;
      for (i = 0; i < metaData.length; i++) {
        const value = meta._parsed[i];
        if (value !== null && !isNaN(value) && this.chart.getDataVisibility(i) && !metaData[i].hidden) {
          total += Math.abs(value);
        }
      }
      return total;
    }
    calculateCircumference(value) {
      const total = this._cachedMeta.total;
      if (total > 0 && !isNaN(value)) {
        return TAU * (Math.abs(value) / total);
      }
      return 0;
    }
    getLabelAndValue(index2) {
      const meta = this._cachedMeta;
      const chart = this.chart;
      const labels = chart.data.labels || [];
      const value = formatNumber(meta._parsed[index2], chart.options.locale);
      return {
        label: labels[index2] || "",
        value
      };
    }
    getMaxBorderWidth(arcs) {
      let max = 0;
      const chart = this.chart;
      let i, ilen, meta, controller, options;
      if (!arcs) {
        for (i = 0, ilen = chart.data.datasets.length; i < ilen; ++i) {
          if (chart.isDatasetVisible(i)) {
            meta = chart.getDatasetMeta(i);
            arcs = meta.data;
            controller = meta.controller;
            break;
          }
        }
      }
      if (!arcs) {
        return 0;
      }
      for (i = 0, ilen = arcs.length; i < ilen; ++i) {
        options = controller.resolveDataElementOptions(i);
        if (options.borderAlign !== "inner") {
          max = Math.max(max, options.borderWidth || 0, options.hoverBorderWidth || 0);
        }
      }
      return max;
    }
    getMaxOffset(arcs) {
      let max = 0;
      for (let i = 0, ilen = arcs.length; i < ilen; ++i) {
        const options = this.resolveDataElementOptions(i);
        max = Math.max(max, options.offset || 0, options.hoverOffset || 0);
      }
      return max;
    }
    _getRingWeightOffset(datasetIndex) {
      let ringWeightOffset = 0;
      for (let i = 0; i < datasetIndex; ++i) {
        if (this.chart.isDatasetVisible(i)) {
          ringWeightOffset += this._getRingWeight(i);
        }
      }
      return ringWeightOffset;
    }
    _getRingWeight(datasetIndex) {
      return Math.max(valueOrDefault(this.chart.data.datasets[datasetIndex].weight, 1), 0);
    }
    _getVisibleDatasetWeightTotal() {
      return this._getRingWeightOffset(this.chart.data.datasets.length) || 1;
    }
  };
  __publicField(DoughnutController, "id", "doughnut");
  __publicField(DoughnutController, "defaults", {
    datasetElementType: false,
    dataElementType: "arc",
    animation: {
      animateRotate: true,
      animateScale: false
    },
    animations: {
      numbers: {
        type: "number",
        properties: [
          "circumference",
          "endAngle",
          "innerRadius",
          "outerRadius",
          "startAngle",
          "x",
          "y",
          "offset",
          "borderWidth",
          "spacing"
        ]
      }
    },
    cutout: "50%",
    rotation: 0,
    circumference: 360,
    radius: "100%",
    spacing: 0,
    indexAxis: "r"
  });
  __publicField(DoughnutController, "descriptors", {
    _scriptable: (name) => name !== "spacing",
    _indexable: (name) => name !== "spacing" && !name.startsWith("borderDash") && !name.startsWith("hoverBorderDash")
  });
  __publicField(DoughnutController, "overrides", {
    aspectRatio: 1,
    plugins: {
      legend: {
        labels: {
          generateLabels(chart) {
            const data = chart.data;
            const { labels: { pointStyle, textAlign, color: color2, useBorderRadius, borderRadius } } = chart.legend.options;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const meta = chart.getDatasetMeta(0);
                const style = meta.controller.getStyle(i);
                return {
                  text: label,
                  fillStyle: style.backgroundColor,
                  fontColor: color2,
                  hidden: !chart.getDataVisibility(i),
                  lineDash: style.borderDash,
                  lineDashOffset: style.borderDashOffset,
                  lineJoin: style.borderJoinStyle,
                  lineWidth: style.borderWidth,
                  strokeStyle: style.borderColor,
                  textAlign,
                  pointStyle,
                  borderRadius: useBorderRadius && (borderRadius || style.borderRadius),
                  index: i
                };
              });
            }
            return [];
          }
        },
        onClick(e, legendItem, legend) {
          legend.chart.toggleDataVisibility(legendItem.index);
          legend.chart.update();
        }
      }
    }
  });
  var LineController = class extends DatasetController {
    initialize() {
      this.enableOptionSharing = true;
      this.supportsDecimation = true;
      super.initialize();
    }
    update(mode) {
      const meta = this._cachedMeta;
      const { dataset: line, data: points = [], _dataset } = meta;
      const animationsDisabled = this.chart._animationsDisabled;
      let { start, count } = _getStartAndCountOfVisiblePoints(meta, points, animationsDisabled);
      this._drawStart = start;
      this._drawCount = count;
      if (_scaleRangesChanged(meta)) {
        start = 0;
        count = points.length;
      }
      line._chart = this.chart;
      line._datasetIndex = this.index;
      line._decimated = !!_dataset._decimated;
      line.points = points;
      const options = this.resolveDatasetElementOptions(mode);
      if (!this.options.showLine) {
        options.borderWidth = 0;
      }
      options.segment = this.options.segment;
      this.updateElement(line, void 0, {
        animated: !animationsDisabled,
        options
      }, mode);
      this.updateElements(points, start, count, mode);
    }
    updateElements(points, start, count, mode) {
      const reset = mode === "reset";
      const { iScale, vScale, _stacked, _dataset } = this._cachedMeta;
      const { sharedOptions, includeOptions } = this._getSharedOptions(start, mode);
      const iAxis = iScale.axis;
      const vAxis = vScale.axis;
      const { spanGaps, segment } = this.options;
      const maxGapLength = isNumber(spanGaps) ? spanGaps : Number.POSITIVE_INFINITY;
      const directUpdate = this.chart._animationsDisabled || reset || mode === "none";
      const end = start + count;
      const pointsCount = points.length;
      let prevParsed = start > 0 && this.getParsed(start - 1);
      for (let i = 0; i < pointsCount; ++i) {
        const point = points[i];
        const properties = directUpdate ? point : {};
        if (i < start || i >= end) {
          properties.skip = true;
          continue;
        }
        const parsed = this.getParsed(i);
        const nullData = isNullOrUndef(parsed[vAxis]);
        const iPixel = properties[iAxis] = iScale.getPixelForValue(parsed[iAxis], i);
        const vPixel = properties[vAxis] = reset || nullData ? vScale.getBasePixel() : vScale.getPixelForValue(_stacked ? this.applyStack(vScale, parsed, _stacked) : parsed[vAxis], i);
        properties.skip = isNaN(iPixel) || isNaN(vPixel) || nullData;
        properties.stop = i > 0 && Math.abs(parsed[iAxis] - prevParsed[iAxis]) > maxGapLength;
        if (segment) {
          properties.parsed = parsed;
          properties.raw = _dataset.data[i];
        }
        if (includeOptions) {
          properties.options = sharedOptions || this.resolveDataElementOptions(i, point.active ? "active" : mode);
        }
        if (!directUpdate) {
          this.updateElement(point, i, properties, mode);
        }
        prevParsed = parsed;
      }
    }
    getMaxOverflow() {
      const meta = this._cachedMeta;
      const dataset = meta.dataset;
      const border = dataset.options && dataset.options.borderWidth || 0;
      const data = meta.data || [];
      if (!data.length) {
        return border;
      }
      const firstPoint = data[0].size(this.resolveDataElementOptions(0));
      const lastPoint = data[data.length - 1].size(this.resolveDataElementOptions(data.length - 1));
      return Math.max(border, firstPoint, lastPoint) / 2;
    }
    draw() {
      const meta = this._cachedMeta;
      meta.dataset.updateControlPoints(this.chart.chartArea, meta.iScale.axis);
      super.draw();
    }
  };
  __publicField(LineController, "id", "line");
  __publicField(LineController, "defaults", {
    datasetElementType: "line",
    dataElementType: "point",
    showLine: true,
    spanGaps: false
  });
  __publicField(LineController, "overrides", {
    scales: {
      _index_: {
        type: "category"
      },
      _value_: {
        type: "linear"
      }
    }
  });
  var PieController = class extends DoughnutController {
  };
  __publicField(PieController, "id", "pie");
  __publicField(PieController, "defaults", {
    cutout: 0,
    rotation: 0,
    circumference: 360,
    radius: "100%"
  });
  var RadarController = class extends DatasetController {
    getLabelAndValue(index2) {
      const vScale = this._cachedMeta.vScale;
      const parsed = this.getParsed(index2);
      return {
        label: vScale.getLabels()[index2],
        value: "" + vScale.getLabelForValue(parsed[vScale.axis])
      };
    }
    parseObjectData(meta, data, start, count) {
      return _parseObjectDataRadialScale.bind(this)(meta, data, start, count);
    }
    update(mode) {
      const meta = this._cachedMeta;
      const line = meta.dataset;
      const points = meta.data || [];
      const labels = meta.iScale.getLabels();
      line.points = points;
      if (mode !== "resize") {
        const options = this.resolveDatasetElementOptions(mode);
        if (!this.options.showLine) {
          options.borderWidth = 0;
        }
        const properties = {
          _loop: true,
          _fullLoop: labels.length === points.length,
          options
        };
        this.updateElement(line, void 0, properties, mode);
      }
      this.updateElements(points, 0, points.length, mode);
    }
    updateElements(points, start, count, mode) {
      const scale = this._cachedMeta.rScale;
      const reset = mode === "reset";
      for (let i = start; i < start + count; i++) {
        const point = points[i];
        const options = this.resolveDataElementOptions(i, point.active ? "active" : mode);
        const pointPosition = scale.getPointPositionForValue(i, this.getParsed(i).r);
        const x = reset ? scale.xCenter : pointPosition.x;
        const y = reset ? scale.yCenter : pointPosition.y;
        const properties = {
          x,
          y,
          angle: pointPosition.angle,
          skip: isNaN(x) || isNaN(y),
          options
        };
        this.updateElement(point, i, properties, mode);
      }
    }
  };
  __publicField(RadarController, "id", "radar");
  __publicField(RadarController, "defaults", {
    datasetElementType: "line",
    dataElementType: "point",
    indexAxis: "r",
    showLine: true,
    elements: {
      line: {
        fill: "start"
      }
    }
  });
  __publicField(RadarController, "overrides", {
    aspectRatio: 1,
    scales: {
      r: {
        type: "radialLinear"
      }
    }
  });
  var ScatterController = class extends DatasetController {
    getLabelAndValue(index2) {
      const meta = this._cachedMeta;
      const labels = this.chart.data.labels || [];
      const { xScale, yScale } = meta;
      const parsed = this.getParsed(index2);
      const x = xScale.getLabelForValue(parsed.x);
      const y = yScale.getLabelForValue(parsed.y);
      return {
        label: labels[index2] || "",
        value: "(" + x + ", " + y + ")"
      };
    }
    update(mode) {
      const meta = this._cachedMeta;
      const { data: points = [] } = meta;
      const animationsDisabled = this.chart._animationsDisabled;
      let { start, count } = _getStartAndCountOfVisiblePoints(meta, points, animationsDisabled);
      this._drawStart = start;
      this._drawCount = count;
      if (_scaleRangesChanged(meta)) {
        start = 0;
        count = points.length;
      }
      if (this.options.showLine) {
        if (!this.datasetElementType) {
          this.addElements();
        }
        const { dataset: line, _dataset } = meta;
        line._chart = this.chart;
        line._datasetIndex = this.index;
        line._decimated = !!_dataset._decimated;
        line.points = points;
        const options = this.resolveDatasetElementOptions(mode);
        options.segment = this.options.segment;
        this.updateElement(line, void 0, {
          animated: !animationsDisabled,
          options
        }, mode);
      } else if (this.datasetElementType) {
        delete meta.dataset;
        this.datasetElementType = false;
      }
      this.updateElements(points, start, count, mode);
    }
    addElements() {
      const { showLine } = this.options;
      if (!this.datasetElementType && showLine) {
        this.datasetElementType = this.chart.registry.getElement("line");
      }
      super.addElements();
    }
    updateElements(points, start, count, mode) {
      const reset = mode === "reset";
      const { iScale, vScale, _stacked, _dataset } = this._cachedMeta;
      const firstOpts = this.resolveDataElementOptions(start, mode);
      const sharedOptions = this.getSharedOptions(firstOpts);
      const includeOptions = this.includeOptions(mode, sharedOptions);
      const iAxis = iScale.axis;
      const vAxis = vScale.axis;
      const { spanGaps, segment } = this.options;
      const maxGapLength = isNumber(spanGaps) ? spanGaps : Number.POSITIVE_INFINITY;
      const directUpdate = this.chart._animationsDisabled || reset || mode === "none";
      let prevParsed = start > 0 && this.getParsed(start - 1);
      for (let i = start; i < start + count; ++i) {
        const point = points[i];
        const parsed = this.getParsed(i);
        const properties = directUpdate ? point : {};
        const nullData = isNullOrUndef(parsed[vAxis]);
        const iPixel = properties[iAxis] = iScale.getPixelForValue(parsed[iAxis], i);
        const vPixel = properties[vAxis] = reset || nullData ? vScale.getBasePixel() : vScale.getPixelForValue(_stacked ? this.applyStack(vScale, parsed, _stacked) : parsed[vAxis], i);
        properties.skip = isNaN(iPixel) || isNaN(vPixel) || nullData;
        properties.stop = i > 0 && Math.abs(parsed[iAxis] - prevParsed[iAxis]) > maxGapLength;
        if (segment) {
          properties.parsed = parsed;
          properties.raw = _dataset.data[i];
        }
        if (includeOptions) {
          properties.options = sharedOptions || this.resolveDataElementOptions(i, point.active ? "active" : mode);
        }
        if (!directUpdate) {
          this.updateElement(point, i, properties, mode);
        }
        prevParsed = parsed;
      }
      this.updateSharedOptions(sharedOptions, mode, firstOpts);
    }
    getMaxOverflow() {
      const meta = this._cachedMeta;
      const data = meta.data || [];
      if (!this.options.showLine) {
        let max = 0;
        for (let i = data.length - 1; i >= 0; --i) {
          max = Math.max(max, data[i].size(this.resolveDataElementOptions(i)) / 2);
        }
        return max > 0 && max;
      }
      const dataset = meta.dataset;
      const border = dataset.options && dataset.options.borderWidth || 0;
      if (!data.length) {
        return border;
      }
      const firstPoint = data[0].size(this.resolveDataElementOptions(0));
      const lastPoint = data[data.length - 1].size(this.resolveDataElementOptions(data.length - 1));
      return Math.max(border, firstPoint, lastPoint) / 2;
    }
  };
  __publicField(ScatterController, "id", "scatter");
  __publicField(ScatterController, "defaults", {
    datasetElementType: false,
    dataElementType: "point",
    showLine: false,
    fill: false
  });
  __publicField(ScatterController, "overrides", {
    interaction: {
      mode: "point"
    },
    scales: {
      x: {
        type: "linear"
      },
      y: {
        type: "linear"
      }
    }
  });
  function abstract() {
    throw new Error("This method is not implemented: Check that a complete date adapter is provided.");
  }
  var DateAdapterBase = class _DateAdapterBase {
    constructor(options) {
      __publicField(this, "options");
      this.options = options || {};
    }
    /**
    * Override default date adapter methods.
    * Accepts type parameter to define options type.
    * @example
    * Chart._adapters._date.override<{myAdapterOption: string}>({
    *   init() {
    *     console.log(this.options.myAdapterOption);
    *   }
    * })
    */
    static override(members) {
      Object.assign(_DateAdapterBase.prototype, members);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    init() {
    }
    formats() {
      return abstract();
    }
    parse() {
      return abstract();
    }
    format() {
      return abstract();
    }
    add() {
      return abstract();
    }
    diff() {
      return abstract();
    }
    startOf() {
      return abstract();
    }
    endOf() {
      return abstract();
    }
  };
  var adapters = {
    _date: DateAdapterBase
  };
  function binarySearch(metaset, axis, value, intersect) {
    const { controller, data, _sorted } = metaset;
    const iScale = controller._cachedMeta.iScale;
    const spanGaps = metaset.dataset ? metaset.dataset.options ? metaset.dataset.options.spanGaps : null : null;
    if (iScale && axis === iScale.axis && axis !== "r" && _sorted && data.length) {
      const lookupMethod = iScale._reversePixels ? _rlookupByKey : _lookupByKey;
      if (!intersect) {
        const result = lookupMethod(data, axis, value);
        if (spanGaps) {
          const { vScale } = controller._cachedMeta;
          const { _parsed } = metaset;
          const distanceToDefinedLo = _parsed.slice(0, result.lo + 1).reverse().findIndex((point) => !isNullOrUndef(point[vScale.axis]));
          result.lo -= Math.max(0, distanceToDefinedLo);
          const distanceToDefinedHi = _parsed.slice(result.hi).findIndex((point) => !isNullOrUndef(point[vScale.axis]));
          result.hi += Math.max(0, distanceToDefinedHi);
        }
        return result;
      } else if (controller._sharedOptions) {
        const el = data[0];
        const range = typeof el.getRange === "function" && el.getRange(axis);
        if (range) {
          const start = lookupMethod(data, axis, value - range);
          const end = lookupMethod(data, axis, value + range);
          return {
            lo: start.lo,
            hi: end.hi
          };
        }
      }
    }
    return {
      lo: 0,
      hi: data.length - 1
    };
  }
  function evaluateInteractionItems(chart, axis, position, handler, intersect) {
    const metasets = chart.getSortedVisibleDatasetMetas();
    const value = position[axis];
    for (let i = 0, ilen = metasets.length; i < ilen; ++i) {
      const { index: index2, data } = metasets[i];
      const { lo, hi } = binarySearch(metasets[i], axis, value, intersect);
      for (let j = lo; j <= hi; ++j) {
        const element = data[j];
        if (!element.skip) {
          handler(element, index2, j);
        }
      }
    }
  }
  function getDistanceMetricForAxis(axis) {
    const useX = axis.indexOf("x") !== -1;
    const useY = axis.indexOf("y") !== -1;
    return function(pt1, pt2) {
      const deltaX = useX ? Math.abs(pt1.x - pt2.x) : 0;
      const deltaY = useY ? Math.abs(pt1.y - pt2.y) : 0;
      return Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    };
  }
  function getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) {
    const items = [];
    if (!includeInvisible && !chart.isPointInArea(position)) {
      return items;
    }
    const evaluationFunc = function(element, datasetIndex, index2) {
      if (!includeInvisible && !_isPointInArea(element, chart.chartArea, 0)) {
        return;
      }
      if (element.inRange(position.x, position.y, useFinalPosition)) {
        items.push({
          element,
          datasetIndex,
          index: index2
        });
      }
    };
    evaluateInteractionItems(chart, axis, position, evaluationFunc, true);
    return items;
  }
  function getNearestRadialItems(chart, position, axis, useFinalPosition) {
    let items = [];
    function evaluationFunc(element, datasetIndex, index2) {
      const { startAngle, endAngle } = element.getProps([
        "startAngle",
        "endAngle"
      ], useFinalPosition);
      const { angle } = getAngleFromPoint(element, {
        x: position.x,
        y: position.y
      });
      if (_angleBetween(angle, startAngle, endAngle)) {
        items.push({
          element,
          datasetIndex,
          index: index2
        });
      }
    }
    evaluateInteractionItems(chart, axis, position, evaluationFunc);
    return items;
  }
  function getNearestCartesianItems(chart, position, axis, intersect, useFinalPosition, includeInvisible) {
    let items = [];
    const distanceMetric = getDistanceMetricForAxis(axis);
    let minDistance = Number.POSITIVE_INFINITY;
    function evaluationFunc(element, datasetIndex, index2) {
      const inRange2 = element.inRange(position.x, position.y, useFinalPosition);
      if (intersect && !inRange2) {
        return;
      }
      const center = element.getCenterPoint(useFinalPosition);
      const pointInArea = !!includeInvisible || chart.isPointInArea(center);
      if (!pointInArea && !inRange2) {
        return;
      }
      const distance = distanceMetric(position, center);
      if (distance < minDistance) {
        items = [
          {
            element,
            datasetIndex,
            index: index2
          }
        ];
        minDistance = distance;
      } else if (distance === minDistance) {
        items.push({
          element,
          datasetIndex,
          index: index2
        });
      }
    }
    evaluateInteractionItems(chart, axis, position, evaluationFunc);
    return items;
  }
  function getNearestItems(chart, position, axis, intersect, useFinalPosition, includeInvisible) {
    if (!includeInvisible && !chart.isPointInArea(position)) {
      return [];
    }
    return axis === "r" && !intersect ? getNearestRadialItems(chart, position, axis, useFinalPosition) : getNearestCartesianItems(chart, position, axis, intersect, useFinalPosition, includeInvisible);
  }
  function getAxisItems(chart, position, axis, intersect, useFinalPosition) {
    const items = [];
    const rangeMethod = axis === "x" ? "inXRange" : "inYRange";
    let intersectsItem = false;
    evaluateInteractionItems(chart, axis, position, (element, datasetIndex, index2) => {
      if (element[rangeMethod] && element[rangeMethod](position[axis], useFinalPosition)) {
        items.push({
          element,
          datasetIndex,
          index: index2
        });
        intersectsItem = intersectsItem || element.inRange(position.x, position.y, useFinalPosition);
      }
    });
    if (intersect && !intersectsItem) {
      return [];
    }
    return items;
  }
  var Interaction = {
    evaluateInteractionItems,
    modes: {
      index(chart, e, options, useFinalPosition) {
        const position = getRelativePosition(e, chart);
        const axis = options.axis || "x";
        const includeInvisible = options.includeInvisible || false;
        const items = options.intersect ? getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) : getNearestItems(chart, position, axis, false, useFinalPosition, includeInvisible);
        const elements = [];
        if (!items.length) {
          return [];
        }
        chart.getSortedVisibleDatasetMetas().forEach((meta) => {
          const index2 = items[0].index;
          const element = meta.data[index2];
          if (element && !element.skip) {
            elements.push({
              element,
              datasetIndex: meta.index,
              index: index2
            });
          }
        });
        return elements;
      },
      dataset(chart, e, options, useFinalPosition) {
        const position = getRelativePosition(e, chart);
        const axis = options.axis || "xy";
        const includeInvisible = options.includeInvisible || false;
        let items = options.intersect ? getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) : getNearestItems(chart, position, axis, false, useFinalPosition, includeInvisible);
        if (items.length > 0) {
          const datasetIndex = items[0].datasetIndex;
          const data = chart.getDatasetMeta(datasetIndex).data;
          items = [];
          for (let i = 0; i < data.length; ++i) {
            items.push({
              element: data[i],
              datasetIndex,
              index: i
            });
          }
        }
        return items;
      },
      point(chart, e, options, useFinalPosition) {
        const position = getRelativePosition(e, chart);
        const axis = options.axis || "xy";
        const includeInvisible = options.includeInvisible || false;
        return getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible);
      },
      nearest(chart, e, options, useFinalPosition) {
        const position = getRelativePosition(e, chart);
        const axis = options.axis || "xy";
        const includeInvisible = options.includeInvisible || false;
        return getNearestItems(chart, position, axis, options.intersect, useFinalPosition, includeInvisible);
      },
      x(chart, e, options, useFinalPosition) {
        const position = getRelativePosition(e, chart);
        return getAxisItems(chart, position, "x", options.intersect, useFinalPosition);
      },
      y(chart, e, options, useFinalPosition) {
        const position = getRelativePosition(e, chart);
        return getAxisItems(chart, position, "y", options.intersect, useFinalPosition);
      }
    }
  };
  var STATIC_POSITIONS = [
    "left",
    "top",
    "right",
    "bottom"
  ];
  function filterByPosition(array, position) {
    return array.filter((v) => v.pos === position);
  }
  function filterDynamicPositionByAxis(array, axis) {
    return array.filter((v) => STATIC_POSITIONS.indexOf(v.pos) === -1 && v.box.axis === axis);
  }
  function sortByWeight(array, reverse) {
    return array.sort((a, b) => {
      const v0 = reverse ? b : a;
      const v1 = reverse ? a : b;
      return v0.weight === v1.weight ? v0.index - v1.index : v0.weight - v1.weight;
    });
  }
  function wrapBoxes(boxes) {
    const layoutBoxes = [];
    let i, ilen, box, pos, stack, stackWeight;
    for (i = 0, ilen = (boxes || []).length; i < ilen; ++i) {
      box = boxes[i];
      ({ position: pos, options: { stack, stackWeight = 1 } } = box);
      layoutBoxes.push({
        index: i,
        box,
        pos,
        horizontal: box.isHorizontal(),
        weight: box.weight,
        stack: stack && pos + stack,
        stackWeight
      });
    }
    return layoutBoxes;
  }
  function buildStacks(layouts2) {
    const stacks = {};
    for (const wrap of layouts2) {
      const { stack, pos, stackWeight } = wrap;
      if (!stack || !STATIC_POSITIONS.includes(pos)) {
        continue;
      }
      const _stack = stacks[stack] || (stacks[stack] = {
        count: 0,
        placed: 0,
        weight: 0,
        size: 0
      });
      _stack.count++;
      _stack.weight += stackWeight;
    }
    return stacks;
  }
  function setLayoutDims(layouts2, params) {
    const stacks = buildStacks(layouts2);
    const { vBoxMaxWidth, hBoxMaxHeight } = params;
    let i, ilen, layout;
    for (i = 0, ilen = layouts2.length; i < ilen; ++i) {
      layout = layouts2[i];
      const { fullSize } = layout.box;
      const stack = stacks[layout.stack];
      const factor = stack && layout.stackWeight / stack.weight;
      if (layout.horizontal) {
        layout.width = factor ? factor * vBoxMaxWidth : fullSize && params.availableWidth;
        layout.height = hBoxMaxHeight;
      } else {
        layout.width = vBoxMaxWidth;
        layout.height = factor ? factor * hBoxMaxHeight : fullSize && params.availableHeight;
      }
    }
    return stacks;
  }
  function buildLayoutBoxes(boxes) {
    const layoutBoxes = wrapBoxes(boxes);
    const fullSize = sortByWeight(layoutBoxes.filter((wrap) => wrap.box.fullSize), true);
    const left = sortByWeight(filterByPosition(layoutBoxes, "left"), true);
    const right = sortByWeight(filterByPosition(layoutBoxes, "right"));
    const top = sortByWeight(filterByPosition(layoutBoxes, "top"), true);
    const bottom = sortByWeight(filterByPosition(layoutBoxes, "bottom"));
    const centerHorizontal = filterDynamicPositionByAxis(layoutBoxes, "x");
    const centerVertical = filterDynamicPositionByAxis(layoutBoxes, "y");
    return {
      fullSize,
      leftAndTop: left.concat(top),
      rightAndBottom: right.concat(centerVertical).concat(bottom).concat(centerHorizontal),
      chartArea: filterByPosition(layoutBoxes, "chartArea"),
      vertical: left.concat(right).concat(centerVertical),
      horizontal: top.concat(bottom).concat(centerHorizontal)
    };
  }
  function getCombinedMax(maxPadding, chartArea, a, b) {
    return Math.max(maxPadding[a], chartArea[a]) + Math.max(maxPadding[b], chartArea[b]);
  }
  function updateMaxPadding(maxPadding, boxPadding) {
    maxPadding.top = Math.max(maxPadding.top, boxPadding.top);
    maxPadding.left = Math.max(maxPadding.left, boxPadding.left);
    maxPadding.bottom = Math.max(maxPadding.bottom, boxPadding.bottom);
    maxPadding.right = Math.max(maxPadding.right, boxPadding.right);
  }
  function updateDims(chartArea, params, layout, stacks) {
    const { pos, box } = layout;
    const maxPadding = chartArea.maxPadding;
    if (!isObject(pos)) {
      if (layout.size) {
        chartArea[pos] -= layout.size;
      }
      const stack = stacks[layout.stack] || {
        size: 0,
        count: 1
      };
      stack.size = Math.max(stack.size, layout.horizontal ? box.height : box.width);
      layout.size = stack.size / stack.count;
      chartArea[pos] += layout.size;
    }
    if (box.getPadding) {
      updateMaxPadding(maxPadding, box.getPadding());
    }
    const newWidth = Math.max(0, params.outerWidth - getCombinedMax(maxPadding, chartArea, "left", "right"));
    const newHeight = Math.max(0, params.outerHeight - getCombinedMax(maxPadding, chartArea, "top", "bottom"));
    const widthChanged = newWidth !== chartArea.w;
    const heightChanged = newHeight !== chartArea.h;
    chartArea.w = newWidth;
    chartArea.h = newHeight;
    return layout.horizontal ? {
      same: widthChanged,
      other: heightChanged
    } : {
      same: heightChanged,
      other: widthChanged
    };
  }
  function handleMaxPadding(chartArea) {
    const maxPadding = chartArea.maxPadding;
    function updatePos(pos) {
      const change = Math.max(maxPadding[pos] - chartArea[pos], 0);
      chartArea[pos] += change;
      return change;
    }
    chartArea.y += updatePos("top");
    chartArea.x += updatePos("left");
    updatePos("right");
    updatePos("bottom");
  }
  function getMargins(horizontal, chartArea) {
    const maxPadding = chartArea.maxPadding;
    function marginForPositions(positions2) {
      const margin = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      };
      positions2.forEach((pos) => {
        margin[pos] = Math.max(chartArea[pos], maxPadding[pos]);
      });
      return margin;
    }
    return horizontal ? marginForPositions([
      "left",
      "right"
    ]) : marginForPositions([
      "top",
      "bottom"
    ]);
  }
  function fitBoxes(boxes, chartArea, params, stacks) {
    const refitBoxes = [];
    let i, ilen, layout, box, refit, changed;
    for (i = 0, ilen = boxes.length, refit = 0; i < ilen; ++i) {
      layout = boxes[i];
      box = layout.box;
      box.update(layout.width || chartArea.w, layout.height || chartArea.h, getMargins(layout.horizontal, chartArea));
      const { same, other } = updateDims(chartArea, params, layout, stacks);
      refit |= same && refitBoxes.length;
      changed = changed || other;
      if (!box.fullSize) {
        refitBoxes.push(layout);
      }
    }
    return refit && fitBoxes(refitBoxes, chartArea, params, stacks) || changed;
  }
  function setBoxDims(box, left, top, width, height) {
    box.top = top;
    box.left = left;
    box.right = left + width;
    box.bottom = top + height;
    box.width = width;
    box.height = height;
  }
  function placeBoxes(boxes, chartArea, params, stacks) {
    const userPadding = params.padding;
    let { x, y } = chartArea;
    for (const layout of boxes) {
      const box = layout.box;
      const stack = stacks[layout.stack] || {
        count: 1,
        placed: 0,
        weight: 1
      };
      const weight = layout.stackWeight / stack.weight || 1;
      if (layout.horizontal) {
        const width = chartArea.w * weight;
        const height = stack.size || box.height;
        if (defined(stack.start)) {
          y = stack.start;
        }
        if (box.fullSize) {
          setBoxDims(box, userPadding.left, y, params.outerWidth - userPadding.right - userPadding.left, height);
        } else {
          setBoxDims(box, chartArea.left + stack.placed, y, width, height);
        }
        stack.start = y;
        stack.placed += width;
        y = box.bottom;
      } else {
        const height = chartArea.h * weight;
        const width = stack.size || box.width;
        if (defined(stack.start)) {
          x = stack.start;
        }
        if (box.fullSize) {
          setBoxDims(box, x, userPadding.top, width, params.outerHeight - userPadding.bottom - userPadding.top);
        } else {
          setBoxDims(box, x, chartArea.top + stack.placed, width, height);
        }
        stack.start = x;
        stack.placed += height;
        x = box.right;
      }
    }
    chartArea.x = x;
    chartArea.y = y;
  }
  var layouts = {
    addBox(chart, item) {
      if (!chart.boxes) {
        chart.boxes = [];
      }
      item.fullSize = item.fullSize || false;
      item.position = item.position || "top";
      item.weight = item.weight || 0;
      item._layers = item._layers || function() {
        return [
          {
            z: 0,
            draw(chartArea) {
              item.draw(chartArea);
            }
          }
        ];
      };
      chart.boxes.push(item);
    },
    removeBox(chart, layoutItem) {
      const index2 = chart.boxes ? chart.boxes.indexOf(layoutItem) : -1;
      if (index2 !== -1) {
        chart.boxes.splice(index2, 1);
      }
    },
    configure(chart, item, options) {
      item.fullSize = options.fullSize;
      item.position = options.position;
      item.weight = options.weight;
    },
    update(chart, width, height, minPadding) {
      if (!chart) {
        return;
      }
      const padding = toPadding(chart.options.layout.padding);
      const availableWidth = Math.max(width - padding.width, 0);
      const availableHeight = Math.max(height - padding.height, 0);
      const boxes = buildLayoutBoxes(chart.boxes);
      const verticalBoxes = boxes.vertical;
      const horizontalBoxes = boxes.horizontal;
      each(chart.boxes, (box) => {
        if (typeof box.beforeLayout === "function") {
          box.beforeLayout();
        }
      });
      const visibleVerticalBoxCount = verticalBoxes.reduce((total, wrap) => wrap.box.options && wrap.box.options.display === false ? total : total + 1, 0) || 1;
      const params = Object.freeze({
        outerWidth: width,
        outerHeight: height,
        padding,
        availableWidth,
        availableHeight,
        vBoxMaxWidth: availableWidth / 2 / visibleVerticalBoxCount,
        hBoxMaxHeight: availableHeight / 2
      });
      const maxPadding = Object.assign({}, padding);
      updateMaxPadding(maxPadding, toPadding(minPadding));
      const chartArea = Object.assign({
        maxPadding,
        w: availableWidth,
        h: availableHeight,
        x: padding.left,
        y: padding.top
      }, padding);
      const stacks = setLayoutDims(verticalBoxes.concat(horizontalBoxes), params);
      fitBoxes(boxes.fullSize, chartArea, params, stacks);
      fitBoxes(verticalBoxes, chartArea, params, stacks);
      if (fitBoxes(horizontalBoxes, chartArea, params, stacks)) {
        fitBoxes(verticalBoxes, chartArea, params, stacks);
      }
      handleMaxPadding(chartArea);
      placeBoxes(boxes.leftAndTop, chartArea, params, stacks);
      chartArea.x += chartArea.w;
      chartArea.y += chartArea.h;
      placeBoxes(boxes.rightAndBottom, chartArea, params, stacks);
      chart.chartArea = {
        left: chartArea.left,
        top: chartArea.top,
        right: chartArea.left + chartArea.w,
        bottom: chartArea.top + chartArea.h,
        height: chartArea.h,
        width: chartArea.w
      };
      each(boxes.chartArea, (layout) => {
        const box = layout.box;
        Object.assign(box, chart.chartArea);
        box.update(chartArea.w, chartArea.h, {
          left: 0,
          top: 0,
          right: 0,
          bottom: 0
        });
      });
    }
  };
  var BasePlatform = class {
    acquireContext(canvas, aspectRatio) {
    }
    releaseContext(context) {
      return false;
    }
    addEventListener(chart, type, listener) {
    }
    removeEventListener(chart, type, listener) {
    }
    getDevicePixelRatio() {
      return 1;
    }
    getMaximumSize(element, width, height, aspectRatio) {
      width = Math.max(0, width || element.width);
      height = height || element.height;
      return {
        width,
        height: Math.max(0, aspectRatio ? Math.floor(width / aspectRatio) : height)
      };
    }
    isAttached(canvas) {
      return true;
    }
    updateConfig(config) {
    }
  };
  var BasicPlatform = class extends BasePlatform {
    acquireContext(item) {
      return item && item.getContext && item.getContext("2d") || null;
    }
    updateConfig(config) {
      config.options.animation = false;
    }
  };
  var EXPANDO_KEY = "$chartjs";
  var EVENT_TYPES = {
    touchstart: "mousedown",
    touchmove: "mousemove",
    touchend: "mouseup",
    pointerenter: "mouseenter",
    pointerdown: "mousedown",
    pointermove: "mousemove",
    pointerup: "mouseup",
    pointerleave: "mouseout",
    pointerout: "mouseout"
  };
  var isNullOrEmpty = (value) => value === null || value === "";
  function initCanvas(canvas, aspectRatio) {
    const style = canvas.style;
    const renderHeight = canvas.getAttribute("height");
    const renderWidth = canvas.getAttribute("width");
    canvas[EXPANDO_KEY] = {
      initial: {
        height: renderHeight,
        width: renderWidth,
        style: {
          display: style.display,
          height: style.height,
          width: style.width
        }
      }
    };
    style.display = style.display || "block";
    style.boxSizing = style.boxSizing || "border-box";
    if (isNullOrEmpty(renderWidth)) {
      const displayWidth = readUsedSize(canvas, "width");
      if (displayWidth !== void 0) {
        canvas.width = displayWidth;
      }
    }
    if (isNullOrEmpty(renderHeight)) {
      if (canvas.style.height === "") {
        canvas.height = canvas.width / (aspectRatio || 2);
      } else {
        const displayHeight = readUsedSize(canvas, "height");
        if (displayHeight !== void 0) {
          canvas.height = displayHeight;
        }
      }
    }
    return canvas;
  }
  var eventListenerOptions = supportsEventListenerOptions ? {
    passive: true
  } : false;
  function addListener(node, type, listener) {
    if (node) {
      node.addEventListener(type, listener, eventListenerOptions);
    }
  }
  function removeListener(chart, type, listener) {
    if (chart && chart.canvas) {
      chart.canvas.removeEventListener(type, listener, eventListenerOptions);
    }
  }
  function fromNativeEvent(event, chart) {
    const type = EVENT_TYPES[event.type] || event.type;
    const { x, y } = getRelativePosition(event, chart);
    return {
      type,
      chart,
      native: event,
      x: x !== void 0 ? x : null,
      y: y !== void 0 ? y : null
    };
  }
  function nodeListContains(nodeList, canvas) {
    for (const node of nodeList) {
      if (node === canvas || node.contains(canvas)) {
        return true;
      }
    }
  }
  function createAttachObserver(chart, type, listener) {
    const canvas = chart.canvas;
    const observer = new MutationObserver((entries) => {
      let trigger = false;
      for (const entry of entries) {
        trigger = trigger || nodeListContains(entry.addedNodes, canvas);
        trigger = trigger && !nodeListContains(entry.removedNodes, canvas);
      }
      if (trigger) {
        listener();
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true
    });
    return observer;
  }
  function createDetachObserver(chart, type, listener) {
    const canvas = chart.canvas;
    const observer = new MutationObserver((entries) => {
      let trigger = false;
      for (const entry of entries) {
        trigger = trigger || nodeListContains(entry.removedNodes, canvas);
        trigger = trigger && !nodeListContains(entry.addedNodes, canvas);
      }
      if (trigger) {
        listener();
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true
    });
    return observer;
  }
  var drpListeningCharts = /* @__PURE__ */ new Map();
  var oldDevicePixelRatio = 0;
  function onWindowResize() {
    const dpr = window.devicePixelRatio;
    if (dpr === oldDevicePixelRatio) {
      return;
    }
    oldDevicePixelRatio = dpr;
    drpListeningCharts.forEach((resize, chart) => {
      if (chart.currentDevicePixelRatio !== dpr) {
        resize();
      }
    });
  }
  function listenDevicePixelRatioChanges(chart, resize) {
    if (!drpListeningCharts.size) {
      window.addEventListener("resize", onWindowResize);
    }
    drpListeningCharts.set(chart, resize);
  }
  function unlistenDevicePixelRatioChanges(chart) {
    drpListeningCharts.delete(chart);
    if (!drpListeningCharts.size) {
      window.removeEventListener("resize", onWindowResize);
    }
  }
  function createResizeObserver(chart, type, listener) {
    const canvas = chart.canvas;
    const container = canvas && _getParentNode(canvas);
    if (!container) {
      return;
    }
    const resize = throttled((width, height) => {
      const w = container.clientWidth;
      listener(width, height);
      if (w < container.clientWidth) {
        listener();
      }
    }, window);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      if (width === 0 && height === 0) {
        return;
      }
      resize(width, height);
    });
    observer.observe(container);
    listenDevicePixelRatioChanges(chart, resize);
    return observer;
  }
  function releaseObserver(chart, type, observer) {
    if (observer) {
      observer.disconnect();
    }
    if (type === "resize") {
      unlistenDevicePixelRatioChanges(chart);
    }
  }
  function createProxyAndListen(chart, type, listener) {
    const canvas = chart.canvas;
    const proxy = throttled((event) => {
      if (chart.ctx !== null) {
        listener(fromNativeEvent(event, chart));
      }
    }, chart);
    addListener(canvas, type, proxy);
    return proxy;
  }
  var DomPlatform = class extends BasePlatform {
    acquireContext(canvas, aspectRatio) {
      const context = canvas && canvas.getContext && canvas.getContext("2d");
      if (context && context.canvas === canvas) {
        initCanvas(canvas, aspectRatio);
        return context;
      }
      return null;
    }
    releaseContext(context) {
      const canvas = context.canvas;
      if (!canvas[EXPANDO_KEY]) {
        return false;
      }
      const initial = canvas[EXPANDO_KEY].initial;
      [
        "height",
        "width"
      ].forEach((prop) => {
        const value = initial[prop];
        if (isNullOrUndef(value)) {
          canvas.removeAttribute(prop);
        } else {
          canvas.setAttribute(prop, value);
        }
      });
      const style = initial.style || {};
      Object.keys(style).forEach((key) => {
        canvas.style[key] = style[key];
      });
      canvas.width = canvas.width;
      delete canvas[EXPANDO_KEY];
      return true;
    }
    addEventListener(chart, type, listener) {
      this.removeEventListener(chart, type);
      const proxies = chart.$proxies || (chart.$proxies = {});
      const handlers = {
        attach: createAttachObserver,
        detach: createDetachObserver,
        resize: createResizeObserver
      };
      const handler = handlers[type] || createProxyAndListen;
      proxies[type] = handler(chart, type, listener);
    }
    removeEventListener(chart, type) {
      const proxies = chart.$proxies || (chart.$proxies = {});
      const proxy = proxies[type];
      if (!proxy) {
        return;
      }
      const handlers = {
        attach: releaseObserver,
        detach: releaseObserver,
        resize: releaseObserver
      };
      const handler = handlers[type] || removeListener;
      handler(chart, type, proxy);
      proxies[type] = void 0;
    }
    getDevicePixelRatio() {
      return window.devicePixelRatio;
    }
    getMaximumSize(canvas, width, height, aspectRatio) {
      return getMaximumSize(canvas, width, height, aspectRatio);
    }
    isAttached(canvas) {
      const container = canvas && _getParentNode(canvas);
      return !!(container && container.isConnected);
    }
  };
  function _detectPlatform(canvas) {
    if (!_isDomSupported() || typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
      return BasicPlatform;
    }
    return DomPlatform;
  }
  var Element = class {
    constructor() {
      __publicField(this, "x");
      __publicField(this, "y");
      __publicField(this, "active", false);
      __publicField(this, "options");
      __publicField(this, "$animations");
    }
    tooltipPosition(useFinalPosition) {
      const { x, y } = this.getProps([
        "x",
        "y"
      ], useFinalPosition);
      return {
        x,
        y
      };
    }
    hasValue() {
      return isNumber(this.x) && isNumber(this.y);
    }
    getProps(props, final) {
      const anims = this.$animations;
      if (!final || !anims) {
        return this;
      }
      const ret = {};
      props.forEach((prop) => {
        ret[prop] = anims[prop] && anims[prop].active() ? anims[prop]._to : this[prop];
      });
      return ret;
    }
  };
  __publicField(Element, "defaults", {});
  __publicField(Element, "defaultRoutes");
  function autoSkip(scale, ticks) {
    const tickOpts = scale.options.ticks;
    const determinedMaxTicks = determineMaxTicks(scale);
    const ticksLimit = Math.min(tickOpts.maxTicksLimit || determinedMaxTicks, determinedMaxTicks);
    const majorIndices = tickOpts.major.enabled ? getMajorIndices(ticks) : [];
    const numMajorIndices = majorIndices.length;
    const first = majorIndices[0];
    const last = majorIndices[numMajorIndices - 1];
    const newTicks = [];
    if (numMajorIndices > ticksLimit) {
      skipMajors(ticks, newTicks, majorIndices, numMajorIndices / ticksLimit);
      return newTicks;
    }
    const spacing = calculateSpacing(majorIndices, ticks, ticksLimit);
    if (numMajorIndices > 0) {
      let i, ilen;
      const avgMajorSpacing = numMajorIndices > 1 ? Math.round((last - first) / (numMajorIndices - 1)) : null;
      skip(ticks, newTicks, spacing, isNullOrUndef(avgMajorSpacing) ? 0 : first - avgMajorSpacing, first);
      for (i = 0, ilen = numMajorIndices - 1; i < ilen; i++) {
        skip(ticks, newTicks, spacing, majorIndices[i], majorIndices[i + 1]);
      }
      skip(ticks, newTicks, spacing, last, isNullOrUndef(avgMajorSpacing) ? ticks.length : last + avgMajorSpacing);
      return newTicks;
    }
    skip(ticks, newTicks, spacing);
    return newTicks;
  }
  function determineMaxTicks(scale) {
    const offset = scale.options.offset;
    const tickLength = scale._tickSize();
    const maxScale = scale._length / tickLength + (offset ? 0 : 1);
    const maxChart = scale._maxLength / tickLength;
    return Math.floor(Math.min(maxScale, maxChart));
  }
  function calculateSpacing(majorIndices, ticks, ticksLimit) {
    const evenMajorSpacing = getEvenSpacing(majorIndices);
    const spacing = ticks.length / ticksLimit;
    if (!evenMajorSpacing) {
      return Math.max(spacing, 1);
    }
    const factors = _factorize(evenMajorSpacing);
    for (let i = 0, ilen = factors.length - 1; i < ilen; i++) {
      const factor = factors[i];
      if (factor > spacing) {
        return factor;
      }
    }
    return Math.max(spacing, 1);
  }
  function getMajorIndices(ticks) {
    const result = [];
    let i, ilen;
    for (i = 0, ilen = ticks.length; i < ilen; i++) {
      if (ticks[i].major) {
        result.push(i);
      }
    }
    return result;
  }
  function skipMajors(ticks, newTicks, majorIndices, spacing) {
    let count = 0;
    let next = majorIndices[0];
    let i;
    spacing = Math.ceil(spacing);
    for (i = 0; i < ticks.length; i++) {
      if (i === next) {
        newTicks.push(ticks[i]);
        count++;
        next = majorIndices[count * spacing];
      }
    }
  }
  function skip(ticks, newTicks, spacing, majorStart, majorEnd) {
    const start = valueOrDefault(majorStart, 0);
    const end = Math.min(valueOrDefault(majorEnd, ticks.length), ticks.length);
    let count = 0;
    let length, i, next;
    spacing = Math.ceil(spacing);
    if (majorEnd) {
      length = majorEnd - majorStart;
      spacing = length / Math.floor(length / spacing);
    }
    next = start;
    while (next < 0) {
      count++;
      next = Math.round(start + count * spacing);
    }
    for (i = Math.max(start, 0); i < end; i++) {
      if (i === next) {
        newTicks.push(ticks[i]);
        count++;
        next = Math.round(start + count * spacing);
      }
    }
  }
  function getEvenSpacing(arr) {
    const len = arr.length;
    let i, diff;
    if (len < 2) {
      return false;
    }
    for (diff = arr[0], i = 1; i < len; ++i) {
      if (arr[i] - arr[i - 1] !== diff) {
        return false;
      }
    }
    return diff;
  }
  var reverseAlign = (align) => align === "left" ? "right" : align === "right" ? "left" : align;
  var offsetFromEdge = (scale, edge, offset) => edge === "top" || edge === "left" ? scale[edge] + offset : scale[edge] - offset;
  var getTicksLimit = (ticksLength, maxTicksLimit) => Math.min(maxTicksLimit || ticksLength, ticksLength);
  function sample(arr, numItems) {
    const result = [];
    const increment = arr.length / numItems;
    const len = arr.length;
    let i = 0;
    for (; i < len; i += increment) {
      result.push(arr[Math.floor(i)]);
    }
    return result;
  }
  function getPixelForGridLine(scale, index2, offsetGridLines) {
    const length = scale.ticks.length;
    const validIndex2 = Math.min(index2, length - 1);
    const start = scale._startPixel;
    const end = scale._endPixel;
    const epsilon = 1e-6;
    let lineValue = scale.getPixelForTick(validIndex2);
    let offset;
    if (offsetGridLines) {
      if (length === 1) {
        offset = Math.max(lineValue - start, end - lineValue);
      } else if (index2 === 0) {
        offset = (scale.getPixelForTick(1) - lineValue) / 2;
      } else {
        offset = (lineValue - scale.getPixelForTick(validIndex2 - 1)) / 2;
      }
      lineValue += validIndex2 < index2 ? offset : -offset;
      if (lineValue < start - epsilon || lineValue > end + epsilon) {
        return;
      }
    }
    return lineValue;
  }
  function garbageCollect(caches, length) {
    each(caches, (cache) => {
      const gc = cache.gc;
      const gcLen = gc.length / 2;
      let i;
      if (gcLen > length) {
        for (i = 0; i < gcLen; ++i) {
          delete cache.data[gc[i]];
        }
        gc.splice(0, gcLen);
      }
    });
  }
  function getTickMarkLength(options) {
    return options.drawTicks ? options.tickLength : 0;
  }
  function getTitleHeight(options, fallback) {
    if (!options.display) {
      return 0;
    }
    const font = toFont(options.font, fallback);
    const padding = toPadding(options.padding);
    const lines = isArray(options.text) ? options.text.length : 1;
    return lines * font.lineHeight + padding.height;
  }
  function createScaleContext(parent, scale) {
    return createContext(parent, {
      scale,
      type: "scale"
    });
  }
  function createTickContext(parent, index2, tick) {
    return createContext(parent, {
      tick,
      index: index2,
      type: "tick"
    });
  }
  function titleAlign(align, position, reverse) {
    let ret = _toLeftRightCenter(align);
    if (reverse && position !== "right" || !reverse && position === "right") {
      ret = reverseAlign(ret);
    }
    return ret;
  }
  function titleArgs(scale, offset, position, align) {
    const { top, left, bottom, right, chart } = scale;
    const { chartArea, scales } = chart;
    let rotation = 0;
    let maxWidth, titleX, titleY;
    const height = bottom - top;
    const width = right - left;
    if (scale.isHorizontal()) {
      titleX = _alignStartEnd(align, left, right);
      if (isObject(position)) {
        const positionAxisID = Object.keys(position)[0];
        const value = position[positionAxisID];
        titleY = scales[positionAxisID].getPixelForValue(value) + height - offset;
      } else if (position === "center") {
        titleY = (chartArea.bottom + chartArea.top) / 2 + height - offset;
      } else {
        titleY = offsetFromEdge(scale, position, offset);
      }
      maxWidth = right - left;
    } else {
      if (isObject(position)) {
        const positionAxisID = Object.keys(position)[0];
        const value = position[positionAxisID];
        titleX = scales[positionAxisID].getPixelForValue(value) - width + offset;
      } else if (position === "center") {
        titleX = (chartArea.left + chartArea.right) / 2 - width + offset;
      } else {
        titleX = offsetFromEdge(scale, position, offset);
      }
      titleY = _alignStartEnd(align, bottom, top);
      rotation = position === "left" ? -HALF_PI : HALF_PI;
    }
    return {
      titleX,
      titleY,
      maxWidth,
      rotation
    };
  }
  var Scale = class _Scale extends Element {
    constructor(cfg) {
      super();
      this.id = cfg.id;
      this.type = cfg.type;
      this.options = void 0;
      this.ctx = cfg.ctx;
      this.chart = cfg.chart;
      this.top = void 0;
      this.bottom = void 0;
      this.left = void 0;
      this.right = void 0;
      this.width = void 0;
      this.height = void 0;
      this._margins = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      };
      this.maxWidth = void 0;
      this.maxHeight = void 0;
      this.paddingTop = void 0;
      this.paddingBottom = void 0;
      this.paddingLeft = void 0;
      this.paddingRight = void 0;
      this.axis = void 0;
      this.labelRotation = void 0;
      this.min = void 0;
      this.max = void 0;
      this._range = void 0;
      this.ticks = [];
      this._gridLineItems = null;
      this._labelItems = null;
      this._labelSizes = null;
      this._length = 0;
      this._maxLength = 0;
      this._longestTextCache = {};
      this._startPixel = void 0;
      this._endPixel = void 0;
      this._reversePixels = false;
      this._userMax = void 0;
      this._userMin = void 0;
      this._suggestedMax = void 0;
      this._suggestedMin = void 0;
      this._ticksLength = 0;
      this._borderValue = 0;
      this._cache = {};
      this._dataLimitsCached = false;
      this.$context = void 0;
    }
    init(options) {
      this.options = options.setContext(this.getContext());
      this.axis = options.axis;
      this._userMin = this.parse(options.min);
      this._userMax = this.parse(options.max);
      this._suggestedMin = this.parse(options.suggestedMin);
      this._suggestedMax = this.parse(options.suggestedMax);
    }
    parse(raw, index2) {
      return raw;
    }
    getUserBounds() {
      let { _userMin, _userMax, _suggestedMin, _suggestedMax } = this;
      _userMin = finiteOrDefault(_userMin, Number.POSITIVE_INFINITY);
      _userMax = finiteOrDefault(_userMax, Number.NEGATIVE_INFINITY);
      _suggestedMin = finiteOrDefault(_suggestedMin, Number.POSITIVE_INFINITY);
      _suggestedMax = finiteOrDefault(_suggestedMax, Number.NEGATIVE_INFINITY);
      return {
        min: finiteOrDefault(_userMin, _suggestedMin),
        max: finiteOrDefault(_userMax, _suggestedMax),
        minDefined: isNumberFinite(_userMin),
        maxDefined: isNumberFinite(_userMax)
      };
    }
    getMinMax(canStack) {
      let { min, max, minDefined, maxDefined } = this.getUserBounds();
      let range;
      if (minDefined && maxDefined) {
        return {
          min,
          max
        };
      }
      const metas = this.getMatchingVisibleMetas();
      for (let i = 0, ilen = metas.length; i < ilen; ++i) {
        range = metas[i].controller.getMinMax(this, canStack);
        if (!minDefined) {
          min = Math.min(min, range.min);
        }
        if (!maxDefined) {
          max = Math.max(max, range.max);
        }
      }
      min = maxDefined && min > max ? max : min;
      max = minDefined && min > max ? min : max;
      return {
        min: finiteOrDefault(min, finiteOrDefault(max, min)),
        max: finiteOrDefault(max, finiteOrDefault(min, max))
      };
    }
    getPadding() {
      return {
        left: this.paddingLeft || 0,
        top: this.paddingTop || 0,
        right: this.paddingRight || 0,
        bottom: this.paddingBottom || 0
      };
    }
    getTicks() {
      return this.ticks;
    }
    getLabels() {
      const data = this.chart.data;
      return this.options.labels || (this.isHorizontal() ? data.xLabels : data.yLabels) || data.labels || [];
    }
    getLabelItems(chartArea = this.chart.chartArea) {
      const items = this._labelItems || (this._labelItems = this._computeLabelItems(chartArea));
      return items;
    }
    beforeLayout() {
      this._cache = {};
      this._dataLimitsCached = false;
    }
    beforeUpdate() {
      callback(this.options.beforeUpdate, [
        this
      ]);
    }
    update(maxWidth, maxHeight, margins) {
      const { beginAtZero, grace, ticks: tickOpts } = this.options;
      const sampleSize = tickOpts.sampleSize;
      this.beforeUpdate();
      this.maxWidth = maxWidth;
      this.maxHeight = maxHeight;
      this._margins = margins = Object.assign({
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      }, margins);
      this.ticks = null;
      this._labelSizes = null;
      this._gridLineItems = null;
      this._labelItems = null;
      this.beforeSetDimensions();
      this.setDimensions();
      this.afterSetDimensions();
      this._maxLength = this.isHorizontal() ? this.width + margins.left + margins.right : this.height + margins.top + margins.bottom;
      if (!this._dataLimitsCached) {
        this.beforeDataLimits();
        this.determineDataLimits();
        this.afterDataLimits();
        this._range = _addGrace(this, grace, beginAtZero);
        this._dataLimitsCached = true;
      }
      this.beforeBuildTicks();
      this.ticks = this.buildTicks() || [];
      this.afterBuildTicks();
      const samplingEnabled = sampleSize < this.ticks.length;
      this._convertTicksToLabels(samplingEnabled ? sample(this.ticks, sampleSize) : this.ticks);
      this.configure();
      this.beforeCalculateLabelRotation();
      this.calculateLabelRotation();
      this.afterCalculateLabelRotation();
      if (tickOpts.display && (tickOpts.autoSkip || tickOpts.source === "auto")) {
        this.ticks = autoSkip(this, this.ticks);
        this._labelSizes = null;
        this.afterAutoSkip();
      }
      if (samplingEnabled) {
        this._convertTicksToLabels(this.ticks);
      }
      this.beforeFit();
      this.fit();
      this.afterFit();
      this.afterUpdate();
    }
    configure() {
      let reversePixels = this.options.reverse;
      let startPixel, endPixel;
      if (this.isHorizontal()) {
        startPixel = this.left;
        endPixel = this.right;
      } else {
        startPixel = this.top;
        endPixel = this.bottom;
        reversePixels = !reversePixels;
      }
      this._startPixel = startPixel;
      this._endPixel = endPixel;
      this._reversePixels = reversePixels;
      this._length = endPixel - startPixel;
      this._alignToPixels = this.options.alignToPixels;
    }
    afterUpdate() {
      callback(this.options.afterUpdate, [
        this
      ]);
    }
    beforeSetDimensions() {
      callback(this.options.beforeSetDimensions, [
        this
      ]);
    }
    setDimensions() {
      if (this.isHorizontal()) {
        this.width = this.maxWidth;
        this.left = 0;
        this.right = this.width;
      } else {
        this.height = this.maxHeight;
        this.top = 0;
        this.bottom = this.height;
      }
      this.paddingLeft = 0;
      this.paddingTop = 0;
      this.paddingRight = 0;
      this.paddingBottom = 0;
    }
    afterSetDimensions() {
      callback(this.options.afterSetDimensions, [
        this
      ]);
    }
    _callHooks(name) {
      this.chart.notifyPlugins(name, this.getContext());
      callback(this.options[name], [
        this
      ]);
    }
    beforeDataLimits() {
      this._callHooks("beforeDataLimits");
    }
    determineDataLimits() {
    }
    afterDataLimits() {
      this._callHooks("afterDataLimits");
    }
    beforeBuildTicks() {
      this._callHooks("beforeBuildTicks");
    }
    buildTicks() {
      return [];
    }
    afterBuildTicks() {
      this._callHooks("afterBuildTicks");
    }
    beforeTickToLabelConversion() {
      callback(this.options.beforeTickToLabelConversion, [
        this
      ]);
    }
    generateTickLabels(ticks) {
      const tickOpts = this.options.ticks;
      let i, ilen, tick;
      for (i = 0, ilen = ticks.length; i < ilen; i++) {
        tick = ticks[i];
        tick.label = callback(tickOpts.callback, [
          tick.value,
          i,
          ticks
        ], this);
      }
    }
    afterTickToLabelConversion() {
      callback(this.options.afterTickToLabelConversion, [
        this
      ]);
    }
    beforeCalculateLabelRotation() {
      callback(this.options.beforeCalculateLabelRotation, [
        this
      ]);
    }
    calculateLabelRotation() {
      const options = this.options;
      const tickOpts = options.ticks;
      const numTicks = getTicksLimit(this.ticks.length, options.ticks.maxTicksLimit);
      const minRotation = tickOpts.minRotation || 0;
      const maxRotation = tickOpts.maxRotation;
      let labelRotation = minRotation;
      let tickWidth, maxHeight, maxLabelDiagonal;
      if (!this._isVisible() || !tickOpts.display || minRotation >= maxRotation || numTicks <= 1 || !this.isHorizontal()) {
        this.labelRotation = minRotation;
        return;
      }
      const labelSizes = this._getLabelSizes();
      const maxLabelWidth = labelSizes.widest.width;
      const maxLabelHeight = labelSizes.highest.height;
      const maxWidth = _limitValue(this.chart.width - maxLabelWidth, 0, this.maxWidth);
      tickWidth = options.offset ? this.maxWidth / numTicks : maxWidth / (numTicks - 1);
      if (maxLabelWidth + 6 > tickWidth) {
        tickWidth = maxWidth / (numTicks - (options.offset ? 0.5 : 1));
        maxHeight = this.maxHeight - getTickMarkLength(options.grid) - tickOpts.padding - getTitleHeight(options.title, this.chart.options.font);
        maxLabelDiagonal = Math.sqrt(maxLabelWidth * maxLabelWidth + maxLabelHeight * maxLabelHeight);
        labelRotation = toDegrees(Math.min(Math.asin(_limitValue((labelSizes.highest.height + 6) / tickWidth, -1, 1)), Math.asin(_limitValue(maxHeight / maxLabelDiagonal, -1, 1)) - Math.asin(_limitValue(maxLabelHeight / maxLabelDiagonal, -1, 1))));
        labelRotation = Math.max(minRotation, Math.min(maxRotation, labelRotation));
      }
      this.labelRotation = labelRotation;
    }
    afterCalculateLabelRotation() {
      callback(this.options.afterCalculateLabelRotation, [
        this
      ]);
    }
    afterAutoSkip() {
    }
    beforeFit() {
      callback(this.options.beforeFit, [
        this
      ]);
    }
    fit() {
      const minSize = {
        width: 0,
        height: 0
      };
      const { chart, options: { ticks: tickOpts, title: titleOpts, grid: gridOpts } } = this;
      const display = this._isVisible();
      const isHorizontal = this.isHorizontal();
      if (display) {
        const titleHeight = getTitleHeight(titleOpts, chart.options.font);
        if (isHorizontal) {
          minSize.width = this.maxWidth;
          minSize.height = getTickMarkLength(gridOpts) + titleHeight;
        } else {
          minSize.height = this.maxHeight;
          minSize.width = getTickMarkLength(gridOpts) + titleHeight;
        }
        if (tickOpts.display && this.ticks.length) {
          const { first, last, widest, highest } = this._getLabelSizes();
          const tickPadding = tickOpts.padding * 2;
          const angleRadians = toRadians(this.labelRotation);
          const cos = Math.cos(angleRadians);
          const sin = Math.sin(angleRadians);
          if (isHorizontal) {
            const labelHeight = tickOpts.mirror ? 0 : sin * widest.width + cos * highest.height;
            minSize.height = Math.min(this.maxHeight, minSize.height + labelHeight + tickPadding);
          } else {
            const labelWidth = tickOpts.mirror ? 0 : cos * widest.width + sin * highest.height;
            minSize.width = Math.min(this.maxWidth, minSize.width + labelWidth + tickPadding);
          }
          this._calculatePadding(first, last, sin, cos);
        }
      }
      this._handleMargins();
      if (isHorizontal) {
        this.width = this._length = chart.width - this._margins.left - this._margins.right;
        this.height = minSize.height;
      } else {
        this.width = minSize.width;
        this.height = this._length = chart.height - this._margins.top - this._margins.bottom;
      }
    }
    _calculatePadding(first, last, sin, cos) {
      const { ticks: { align, padding }, position } = this.options;
      const isRotated = this.labelRotation !== 0;
      const labelsBelowTicks = position !== "top" && this.axis === "x";
      if (this.isHorizontal()) {
        const offsetLeft = this.getPixelForTick(0) - this.left;
        const offsetRight = this.right - this.getPixelForTick(this.ticks.length - 1);
        let paddingLeft = 0;
        let paddingRight = 0;
        if (isRotated) {
          if (labelsBelowTicks) {
            paddingLeft = cos * first.width;
            paddingRight = sin * last.height;
          } else {
            paddingLeft = sin * first.height;
            paddingRight = cos * last.width;
          }
        } else if (align === "start") {
          paddingRight = last.width;
        } else if (align === "end") {
          paddingLeft = first.width;
        } else if (align !== "inner") {
          paddingLeft = first.width / 2;
          paddingRight = last.width / 2;
        }
        this.paddingLeft = Math.max((paddingLeft - offsetLeft + padding) * this.width / (this.width - offsetLeft), 0);
        this.paddingRight = Math.max((paddingRight - offsetRight + padding) * this.width / (this.width - offsetRight), 0);
      } else {
        let paddingTop = last.height / 2;
        let paddingBottom = first.height / 2;
        if (align === "start") {
          paddingTop = 0;
          paddingBottom = first.height;
        } else if (align === "end") {
          paddingTop = last.height;
          paddingBottom = 0;
        }
        this.paddingTop = paddingTop + padding;
        this.paddingBottom = paddingBottom + padding;
      }
    }
    _handleMargins() {
      if (this._margins) {
        this._margins.left = Math.max(this.paddingLeft, this._margins.left);
        this._margins.top = Math.max(this.paddingTop, this._margins.top);
        this._margins.right = Math.max(this.paddingRight, this._margins.right);
        this._margins.bottom = Math.max(this.paddingBottom, this._margins.bottom);
      }
    }
    afterFit() {
      callback(this.options.afterFit, [
        this
      ]);
    }
    isHorizontal() {
      const { axis, position } = this.options;
      return position === "top" || position === "bottom" || axis === "x";
    }
    isFullSize() {
      return this.options.fullSize;
    }
    _convertTicksToLabels(ticks) {
      this.beforeTickToLabelConversion();
      this.generateTickLabels(ticks);
      let i, ilen;
      for (i = 0, ilen = ticks.length; i < ilen; i++) {
        if (isNullOrUndef(ticks[i].label)) {
          ticks.splice(i, 1);
          ilen--;
          i--;
        }
      }
      this.afterTickToLabelConversion();
    }
    _getLabelSizes() {
      let labelSizes = this._labelSizes;
      if (!labelSizes) {
        const sampleSize = this.options.ticks.sampleSize;
        let ticks = this.ticks;
        if (sampleSize < ticks.length) {
          ticks = sample(ticks, sampleSize);
        }
        this._labelSizes = labelSizes = this._computeLabelSizes(ticks, ticks.length, this.options.ticks.maxTicksLimit);
      }
      return labelSizes;
    }
    _computeLabelSizes(ticks, length, maxTicksLimit) {
      const { ctx, _longestTextCache: caches } = this;
      const widths = [];
      const heights = [];
      const increment = Math.floor(length / getTicksLimit(length, maxTicksLimit));
      let widestLabelSize = 0;
      let highestLabelSize = 0;
      let i, j, jlen, label, tickFont, fontString, cache, lineHeight, width, height, nestedLabel;
      for (i = 0; i < length; i += increment) {
        label = ticks[i].label;
        tickFont = this._resolveTickFontOptions(i);
        ctx.font = fontString = tickFont.string;
        cache = caches[fontString] = caches[fontString] || {
          data: {},
          gc: []
        };
        lineHeight = tickFont.lineHeight;
        width = height = 0;
        if (!isNullOrUndef(label) && !isArray(label)) {
          width = _measureText(ctx, cache.data, cache.gc, width, label);
          height = lineHeight;
        } else if (isArray(label)) {
          for (j = 0, jlen = label.length; j < jlen; ++j) {
            nestedLabel = label[j];
            if (!isNullOrUndef(nestedLabel) && !isArray(nestedLabel)) {
              width = _measureText(ctx, cache.data, cache.gc, width, nestedLabel);
              height += lineHeight;
            }
          }
        }
        widths.push(width);
        heights.push(height);
        widestLabelSize = Math.max(width, widestLabelSize);
        highestLabelSize = Math.max(height, highestLabelSize);
      }
      garbageCollect(caches, length);
      const widest = widths.indexOf(widestLabelSize);
      const highest = heights.indexOf(highestLabelSize);
      const valueAt = (idx) => ({
        width: widths[idx] || 0,
        height: heights[idx] || 0
      });
      return {
        first: valueAt(0),
        last: valueAt(length - 1),
        widest: valueAt(widest),
        highest: valueAt(highest),
        widths,
        heights
      };
    }
    getLabelForValue(value) {
      return value;
    }
    getPixelForValue(value, index2) {
      return NaN;
    }
    getValueForPixel(pixel) {
    }
    getPixelForTick(index2) {
      const ticks = this.ticks;
      if (index2 < 0 || index2 > ticks.length - 1) {
        return null;
      }
      return this.getPixelForValue(ticks[index2].value);
    }
    getPixelForDecimal(decimal) {
      if (this._reversePixels) {
        decimal = 1 - decimal;
      }
      const pixel = this._startPixel + decimal * this._length;
      return _int16Range(this._alignToPixels ? _alignPixel(this.chart, pixel, 0) : pixel);
    }
    getDecimalForPixel(pixel) {
      const decimal = (pixel - this._startPixel) / this._length;
      return this._reversePixels ? 1 - decimal : decimal;
    }
    getBasePixel() {
      return this.getPixelForValue(this.getBaseValue());
    }
    getBaseValue() {
      const { min, max } = this;
      return min < 0 && max < 0 ? max : min > 0 && max > 0 ? min : 0;
    }
    getContext(index2) {
      const ticks = this.ticks || [];
      if (index2 >= 0 && index2 < ticks.length) {
        const tick = ticks[index2];
        return tick.$context || (tick.$context = createTickContext(this.getContext(), index2, tick));
      }
      return this.$context || (this.$context = createScaleContext(this.chart.getContext(), this));
    }
    _tickSize() {
      const optionTicks = this.options.ticks;
      const rot = toRadians(this.labelRotation);
      const cos = Math.abs(Math.cos(rot));
      const sin = Math.abs(Math.sin(rot));
      const labelSizes = this._getLabelSizes();
      const padding = optionTicks.autoSkipPadding || 0;
      const w = labelSizes ? labelSizes.widest.width + padding : 0;
      const h = labelSizes ? labelSizes.highest.height + padding : 0;
      return this.isHorizontal() ? h * cos > w * sin ? w / cos : h / sin : h * sin < w * cos ? h / cos : w / sin;
    }
    _isVisible() {
      const display = this.options.display;
      if (display !== "auto") {
        return !!display;
      }
      return this.getMatchingVisibleMetas().length > 0;
    }
    _computeGridLineItems(chartArea) {
      const axis = this.axis;
      const chart = this.chart;
      const options = this.options;
      const { grid, position, border } = options;
      const offset = grid.offset;
      const isHorizontal = this.isHorizontal();
      const ticks = this.ticks;
      const ticksLength = ticks.length + (offset ? 1 : 0);
      const tl = getTickMarkLength(grid);
      const items = [];
      const borderOpts = border.setContext(this.getContext());
      const axisWidth = borderOpts.display ? borderOpts.width : 0;
      const axisHalfWidth = axisWidth / 2;
      const alignBorderValue = function(pixel) {
        return _alignPixel(chart, pixel, axisWidth);
      };
      let borderValue, i, lineValue, alignedLineValue;
      let tx1, ty1, tx2, ty2, x1, y1, x2, y2;
      if (position === "top") {
        borderValue = alignBorderValue(this.bottom);
        ty1 = this.bottom - tl;
        ty2 = borderValue - axisHalfWidth;
        y1 = alignBorderValue(chartArea.top) + axisHalfWidth;
        y2 = chartArea.bottom;
      } else if (position === "bottom") {
        borderValue = alignBorderValue(this.top);
        y1 = chartArea.top;
        y2 = alignBorderValue(chartArea.bottom) - axisHalfWidth;
        ty1 = borderValue + axisHalfWidth;
        ty2 = this.top + tl;
      } else if (position === "left") {
        borderValue = alignBorderValue(this.right);
        tx1 = this.right - tl;
        tx2 = borderValue - axisHalfWidth;
        x1 = alignBorderValue(chartArea.left) + axisHalfWidth;
        x2 = chartArea.right;
      } else if (position === "right") {
        borderValue = alignBorderValue(this.left);
        x1 = chartArea.left;
        x2 = alignBorderValue(chartArea.right) - axisHalfWidth;
        tx1 = borderValue + axisHalfWidth;
        tx2 = this.left + tl;
      } else if (axis === "x") {
        if (position === "center") {
          borderValue = alignBorderValue((chartArea.top + chartArea.bottom) / 2 + 0.5);
        } else if (isObject(position)) {
          const positionAxisID = Object.keys(position)[0];
          const value = position[positionAxisID];
          borderValue = alignBorderValue(this.chart.scales[positionAxisID].getPixelForValue(value));
        }
        y1 = chartArea.top;
        y2 = chartArea.bottom;
        ty1 = borderValue + axisHalfWidth;
        ty2 = ty1 + tl;
      } else if (axis === "y") {
        if (position === "center") {
          borderValue = alignBorderValue((chartArea.left + chartArea.right) / 2);
        } else if (isObject(position)) {
          const positionAxisID = Object.keys(position)[0];
          const value = position[positionAxisID];
          borderValue = alignBorderValue(this.chart.scales[positionAxisID].getPixelForValue(value));
        }
        tx1 = borderValue - axisHalfWidth;
        tx2 = tx1 - tl;
        x1 = chartArea.left;
        x2 = chartArea.right;
      }
      const limit = valueOrDefault(options.ticks.maxTicksLimit, ticksLength);
      const step = Math.max(1, Math.ceil(ticksLength / limit));
      for (i = 0; i < ticksLength; i += step) {
        const context = this.getContext(i);
        const optsAtIndex = grid.setContext(context);
        const optsAtIndexBorder = border.setContext(context);
        const lineWidth = optsAtIndex.lineWidth;
        const lineColor = optsAtIndex.color;
        const borderDash = optsAtIndexBorder.dash || [];
        const borderDashOffset = optsAtIndexBorder.dashOffset;
        const tickWidth = optsAtIndex.tickWidth;
        const tickColor = optsAtIndex.tickColor;
        const tickBorderDash = optsAtIndex.tickBorderDash || [];
        const tickBorderDashOffset = optsAtIndex.tickBorderDashOffset;
        lineValue = getPixelForGridLine(this, i, offset);
        if (lineValue === void 0) {
          continue;
        }
        alignedLineValue = _alignPixel(chart, lineValue, lineWidth);
        if (isHorizontal) {
          tx1 = tx2 = x1 = x2 = alignedLineValue;
        } else {
          ty1 = ty2 = y1 = y2 = alignedLineValue;
        }
        items.push({
          tx1,
          ty1,
          tx2,
          ty2,
          x1,
          y1,
          x2,
          y2,
          width: lineWidth,
          color: lineColor,
          borderDash,
          borderDashOffset,
          tickWidth,
          tickColor,
          tickBorderDash,
          tickBorderDashOffset
        });
      }
      this._ticksLength = ticksLength;
      this._borderValue = borderValue;
      return items;
    }
    _computeLabelItems(chartArea) {
      const axis = this.axis;
      const options = this.options;
      const { position, ticks: optionTicks } = options;
      const isHorizontal = this.isHorizontal();
      const ticks = this.ticks;
      const { align, crossAlign, padding, mirror } = optionTicks;
      const tl = getTickMarkLength(options.grid);
      const tickAndPadding = tl + padding;
      const hTickAndPadding = mirror ? -padding : tickAndPadding;
      const rotation = -toRadians(this.labelRotation);
      const items = [];
      let i, ilen, tick, label, x, y, textAlign, pixel, font, lineHeight, lineCount, textOffset;
      let textBaseline = "middle";
      if (position === "top") {
        y = this.bottom - hTickAndPadding;
        textAlign = this._getXAxisLabelAlignment();
      } else if (position === "bottom") {
        y = this.top + hTickAndPadding;
        textAlign = this._getXAxisLabelAlignment();
      } else if (position === "left") {
        const ret = this._getYAxisLabelAlignment(tl);
        textAlign = ret.textAlign;
        x = ret.x;
      } else if (position === "right") {
        const ret = this._getYAxisLabelAlignment(tl);
        textAlign = ret.textAlign;
        x = ret.x;
      } else if (axis === "x") {
        if (position === "center") {
          y = (chartArea.top + chartArea.bottom) / 2 + tickAndPadding;
        } else if (isObject(position)) {
          const positionAxisID = Object.keys(position)[0];
          const value = position[positionAxisID];
          y = this.chart.scales[positionAxisID].getPixelForValue(value) + tickAndPadding;
        }
        textAlign = this._getXAxisLabelAlignment();
      } else if (axis === "y") {
        if (position === "center") {
          x = (chartArea.left + chartArea.right) / 2 - tickAndPadding;
        } else if (isObject(position)) {
          const positionAxisID = Object.keys(position)[0];
          const value = position[positionAxisID];
          x = this.chart.scales[positionAxisID].getPixelForValue(value);
        }
        textAlign = this._getYAxisLabelAlignment(tl).textAlign;
      }
      if (axis === "y") {
        if (align === "start") {
          textBaseline = "top";
        } else if (align === "end") {
          textBaseline = "bottom";
        }
      }
      const labelSizes = this._getLabelSizes();
      for (i = 0, ilen = ticks.length; i < ilen; ++i) {
        tick = ticks[i];
        label = tick.label;
        const optsAtIndex = optionTicks.setContext(this.getContext(i));
        pixel = this.getPixelForTick(i) + optionTicks.labelOffset;
        font = this._resolveTickFontOptions(i);
        lineHeight = font.lineHeight;
        lineCount = isArray(label) ? label.length : 1;
        const halfCount = lineCount / 2;
        const color2 = optsAtIndex.color;
        const strokeColor = optsAtIndex.textStrokeColor;
        const strokeWidth = optsAtIndex.textStrokeWidth;
        let tickTextAlign = textAlign;
        if (isHorizontal) {
          x = pixel;
          if (textAlign === "inner") {
            if (i === ilen - 1) {
              tickTextAlign = !this.options.reverse ? "right" : "left";
            } else if (i === 0) {
              tickTextAlign = !this.options.reverse ? "left" : "right";
            } else {
              tickTextAlign = "center";
            }
          }
          if (position === "top") {
            if (crossAlign === "near" || rotation !== 0) {
              textOffset = -lineCount * lineHeight + lineHeight / 2;
            } else if (crossAlign === "center") {
              textOffset = -labelSizes.highest.height / 2 - halfCount * lineHeight + lineHeight;
            } else {
              textOffset = -labelSizes.highest.height + lineHeight / 2;
            }
          } else {
            if (crossAlign === "near" || rotation !== 0) {
              textOffset = lineHeight / 2;
            } else if (crossAlign === "center") {
              textOffset = labelSizes.highest.height / 2 - halfCount * lineHeight;
            } else {
              textOffset = labelSizes.highest.height - lineCount * lineHeight;
            }
          }
          if (mirror) {
            textOffset *= -1;
          }
          if (rotation !== 0 && !optsAtIndex.showLabelBackdrop) {
            x += lineHeight / 2 * Math.sin(rotation);
          }
        } else {
          y = pixel;
          textOffset = (1 - lineCount) * lineHeight / 2;
        }
        let backdrop;
        if (optsAtIndex.showLabelBackdrop) {
          const labelPadding = toPadding(optsAtIndex.backdropPadding);
          const height = labelSizes.heights[i];
          const width = labelSizes.widths[i];
          let top = textOffset - labelPadding.top;
          let left = 0 - labelPadding.left;
          switch (textBaseline) {
            case "middle":
              top -= height / 2;
              break;
            case "bottom":
              top -= height;
              break;
          }
          switch (textAlign) {
            case "center":
              left -= width / 2;
              break;
            case "right":
              left -= width;
              break;
            case "inner":
              if (i === ilen - 1) {
                left -= width;
              } else if (i > 0) {
                left -= width / 2;
              }
              break;
          }
          backdrop = {
            left,
            top,
            width: width + labelPadding.width,
            height: height + labelPadding.height,
            color: optsAtIndex.backdropColor
          };
        }
        items.push({
          label,
          font,
          textOffset,
          options: {
            rotation,
            color: color2,
            strokeColor,
            strokeWidth,
            textAlign: tickTextAlign,
            textBaseline,
            translation: [
              x,
              y
            ],
            backdrop
          }
        });
      }
      return items;
    }
    _getXAxisLabelAlignment() {
      const { position, ticks } = this.options;
      const rotation = -toRadians(this.labelRotation);
      if (rotation) {
        return position === "top" ? "left" : "right";
      }
      let align = "center";
      if (ticks.align === "start") {
        align = "left";
      } else if (ticks.align === "end") {
        align = "right";
      } else if (ticks.align === "inner") {
        align = "inner";
      }
      return align;
    }
    _getYAxisLabelAlignment(tl) {
      const { position, ticks: { crossAlign, mirror, padding } } = this.options;
      const labelSizes = this._getLabelSizes();
      const tickAndPadding = tl + padding;
      const widest = labelSizes.widest.width;
      let textAlign;
      let x;
      if (position === "left") {
        if (mirror) {
          x = this.right + padding;
          if (crossAlign === "near") {
            textAlign = "left";
          } else if (crossAlign === "center") {
            textAlign = "center";
            x += widest / 2;
          } else {
            textAlign = "right";
            x += widest;
          }
        } else {
          x = this.right - tickAndPadding;
          if (crossAlign === "near") {
            textAlign = "right";
          } else if (crossAlign === "center") {
            textAlign = "center";
            x -= widest / 2;
          } else {
            textAlign = "left";
            x = this.left;
          }
        }
      } else if (position === "right") {
        if (mirror) {
          x = this.left + padding;
          if (crossAlign === "near") {
            textAlign = "right";
          } else if (crossAlign === "center") {
            textAlign = "center";
            x -= widest / 2;
          } else {
            textAlign = "left";
            x -= widest;
          }
        } else {
          x = this.left + tickAndPadding;
          if (crossAlign === "near") {
            textAlign = "left";
          } else if (crossAlign === "center") {
            textAlign = "center";
            x += widest / 2;
          } else {
            textAlign = "right";
            x = this.right;
          }
        }
      } else {
        textAlign = "right";
      }
      return {
        textAlign,
        x
      };
    }
    _computeLabelArea() {
      if (this.options.ticks.mirror) {
        return;
      }
      const chart = this.chart;
      const position = this.options.position;
      if (position === "left" || position === "right") {
        return {
          top: 0,
          left: this.left,
          bottom: chart.height,
          right: this.right
        };
      }
      if (position === "top" || position === "bottom") {
        return {
          top: this.top,
          left: 0,
          bottom: this.bottom,
          right: chart.width
        };
      }
    }
    drawBackground() {
      const { ctx, options: { backgroundColor }, left, top, width, height } = this;
      if (backgroundColor) {
        ctx.save();
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(left, top, width, height);
        ctx.restore();
      }
    }
    getLineWidthForValue(value) {
      const grid = this.options.grid;
      if (!this._isVisible() || !grid.display) {
        return 0;
      }
      const ticks = this.ticks;
      const index2 = ticks.findIndex((t) => t.value === value);
      if (index2 >= 0) {
        const opts = grid.setContext(this.getContext(index2));
        return opts.lineWidth;
      }
      return 0;
    }
    drawGrid(chartArea) {
      const grid = this.options.grid;
      const ctx = this.ctx;
      const items = this._gridLineItems || (this._gridLineItems = this._computeGridLineItems(chartArea));
      let i, ilen;
      const drawLine = (p1, p2, style) => {
        if (!style.width || !style.color) {
          return;
        }
        ctx.save();
        ctx.lineWidth = style.width;
        ctx.strokeStyle = style.color;
        ctx.setLineDash(style.borderDash || []);
        ctx.lineDashOffset = style.borderDashOffset;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      };
      if (grid.display) {
        for (i = 0, ilen = items.length; i < ilen; ++i) {
          const item = items[i];
          if (grid.drawOnChartArea) {
            drawLine({
              x: item.x1,
              y: item.y1
            }, {
              x: item.x2,
              y: item.y2
            }, item);
          }
          if (grid.drawTicks) {
            drawLine({
              x: item.tx1,
              y: item.ty1
            }, {
              x: item.tx2,
              y: item.ty2
            }, {
              color: item.tickColor,
              width: item.tickWidth,
              borderDash: item.tickBorderDash,
              borderDashOffset: item.tickBorderDashOffset
            });
          }
        }
      }
    }
    drawBorder() {
      const { chart, ctx, options: { border, grid } } = this;
      const borderOpts = border.setContext(this.getContext());
      const axisWidth = border.display ? borderOpts.width : 0;
      if (!axisWidth) {
        return;
      }
      const lastLineWidth = grid.setContext(this.getContext(0)).lineWidth;
      const borderValue = this._borderValue;
      let x1, x2, y1, y2;
      if (this.isHorizontal()) {
        x1 = _alignPixel(chart, this.left, axisWidth) - axisWidth / 2;
        x2 = _alignPixel(chart, this.right, lastLineWidth) + lastLineWidth / 2;
        y1 = y2 = borderValue;
      } else {
        y1 = _alignPixel(chart, this.top, axisWidth) - axisWidth / 2;
        y2 = _alignPixel(chart, this.bottom, lastLineWidth) + lastLineWidth / 2;
        x1 = x2 = borderValue;
      }
      ctx.save();
      ctx.lineWidth = borderOpts.width;
      ctx.strokeStyle = borderOpts.color;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
    drawLabels(chartArea) {
      const optionTicks = this.options.ticks;
      if (!optionTicks.display) {
        return;
      }
      const ctx = this.ctx;
      const area = this._computeLabelArea();
      if (area) {
        clipArea(ctx, area);
      }
      const items = this.getLabelItems(chartArea);
      for (const item of items) {
        const renderTextOptions = item.options;
        const tickFont = item.font;
        const label = item.label;
        const y = item.textOffset;
        renderText(ctx, label, 0, y, tickFont, renderTextOptions);
      }
      if (area) {
        unclipArea(ctx);
      }
    }
    drawTitle() {
      const { ctx, options: { position, title, reverse } } = this;
      if (!title.display) {
        return;
      }
      const font = toFont(title.font);
      const padding = toPadding(title.padding);
      const align = title.align;
      let offset = font.lineHeight / 2;
      if (position === "bottom" || position === "center" || isObject(position)) {
        offset += padding.bottom;
        if (isArray(title.text)) {
          offset += font.lineHeight * (title.text.length - 1);
        }
      } else {
        offset += padding.top;
      }
      const { titleX, titleY, maxWidth, rotation } = titleArgs(this, offset, position, align);
      renderText(ctx, title.text, 0, 0, font, {
        color: title.color,
        maxWidth,
        rotation,
        textAlign: titleAlign(align, position, reverse),
        textBaseline: "middle",
        translation: [
          titleX,
          titleY
        ]
      });
    }
    draw(chartArea) {
      if (!this._isVisible()) {
        return;
      }
      this.drawBackground();
      this.drawGrid(chartArea);
      this.drawBorder();
      this.drawTitle();
      this.drawLabels(chartArea);
    }
    _layers() {
      const opts = this.options;
      const tz = opts.ticks && opts.ticks.z || 0;
      const gz = valueOrDefault(opts.grid && opts.grid.z, -1);
      const bz = valueOrDefault(opts.border && opts.border.z, 0);
      if (!this._isVisible() || this.draw !== _Scale.prototype.draw) {
        return [
          {
            z: tz,
            draw: (chartArea) => {
              this.draw(chartArea);
            }
          }
        ];
      }
      return [
        {
          z: gz,
          draw: (chartArea) => {
            this.drawBackground();
            this.drawGrid(chartArea);
            this.drawTitle();
          }
        },
        {
          z: bz,
          draw: () => {
            this.drawBorder();
          }
        },
        {
          z: tz,
          draw: (chartArea) => {
            this.drawLabels(chartArea);
          }
        }
      ];
    }
    getMatchingVisibleMetas(type) {
      const metas = this.chart.getSortedVisibleDatasetMetas();
      const axisID = this.axis + "AxisID";
      const result = [];
      let i, ilen;
      for (i = 0, ilen = metas.length; i < ilen; ++i) {
        const meta = metas[i];
        if (meta[axisID] === this.id && (!type || meta.type === type)) {
          result.push(meta);
        }
      }
      return result;
    }
    _resolveTickFontOptions(index2) {
      const opts = this.options.ticks.setContext(this.getContext(index2));
      return toFont(opts.font);
    }
    _maxDigits() {
      const fontSize = this._resolveTickFontOptions(0).lineHeight;
      return (this.isHorizontal() ? this.width : this.height) / fontSize;
    }
  };
  var TypedRegistry = class {
    constructor(type, scope, override) {
      this.type = type;
      this.scope = scope;
      this.override = override;
      this.items = /* @__PURE__ */ Object.create(null);
    }
    isForType(type) {
      return Object.prototype.isPrototypeOf.call(this.type.prototype, type.prototype);
    }
    register(item) {
      const proto = Object.getPrototypeOf(item);
      let parentScope;
      if (isIChartComponent(proto)) {
        parentScope = this.register(proto);
      }
      const items = this.items;
      const id = item.id;
      const scope = this.scope + "." + id;
      if (!id) {
        throw new Error("class does not have id: " + item);
      }
      if (id in items) {
        return scope;
      }
      items[id] = item;
      registerDefaults(item, scope, parentScope);
      if (this.override) {
        defaults.override(item.id, item.overrides);
      }
      return scope;
    }
    get(id) {
      return this.items[id];
    }
    unregister(item) {
      const items = this.items;
      const id = item.id;
      const scope = this.scope;
      if (id in items) {
        delete items[id];
      }
      if (scope && id in defaults[scope]) {
        delete defaults[scope][id];
        if (this.override) {
          delete overrides[id];
        }
      }
    }
  };
  function registerDefaults(item, scope, parentScope) {
    const itemDefaults = merge(/* @__PURE__ */ Object.create(null), [
      parentScope ? defaults.get(parentScope) : {},
      defaults.get(scope),
      item.defaults
    ]);
    defaults.set(scope, itemDefaults);
    if (item.defaultRoutes) {
      routeDefaults(scope, item.defaultRoutes);
    }
    if (item.descriptors) {
      defaults.describe(scope, item.descriptors);
    }
  }
  function routeDefaults(scope, routes) {
    Object.keys(routes).forEach((property) => {
      const propertyParts = property.split(".");
      const sourceName = propertyParts.pop();
      const sourceScope = [
        scope
      ].concat(propertyParts).join(".");
      const parts = routes[property].split(".");
      const targetName = parts.pop();
      const targetScope = parts.join(".");
      defaults.route(sourceScope, sourceName, targetScope, targetName);
    });
  }
  function isIChartComponent(proto) {
    return "id" in proto && "defaults" in proto;
  }
  var Registry = class {
    constructor() {
      this.controllers = new TypedRegistry(DatasetController, "datasets", true);
      this.elements = new TypedRegistry(Element, "elements");
      this.plugins = new TypedRegistry(Object, "plugins");
      this.scales = new TypedRegistry(Scale, "scales");
      this._typedRegistries = [
        this.controllers,
        this.scales,
        this.elements
      ];
    }
    add(...args) {
      this._each("register", args);
    }
    remove(...args) {
      this._each("unregister", args);
    }
    addControllers(...args) {
      this._each("register", args, this.controllers);
    }
    addElements(...args) {
      this._each("register", args, this.elements);
    }
    addPlugins(...args) {
      this._each("register", args, this.plugins);
    }
    addScales(...args) {
      this._each("register", args, this.scales);
    }
    getController(id) {
      return this._get(id, this.controllers, "controller");
    }
    getElement(id) {
      return this._get(id, this.elements, "element");
    }
    getPlugin(id) {
      return this._get(id, this.plugins, "plugin");
    }
    getScale(id) {
      return this._get(id, this.scales, "scale");
    }
    removeControllers(...args) {
      this._each("unregister", args, this.controllers);
    }
    removeElements(...args) {
      this._each("unregister", args, this.elements);
    }
    removePlugins(...args) {
      this._each("unregister", args, this.plugins);
    }
    removeScales(...args) {
      this._each("unregister", args, this.scales);
    }
    _each(method, args, typedRegistry) {
      [
        ...args
      ].forEach((arg) => {
        const reg = typedRegistry || this._getRegistryForType(arg);
        if (typedRegistry || reg.isForType(arg) || reg === this.plugins && arg.id) {
          this._exec(method, reg, arg);
        } else {
          each(arg, (item) => {
            const itemReg = typedRegistry || this._getRegistryForType(item);
            this._exec(method, itemReg, item);
          });
        }
      });
    }
    _exec(method, registry2, component) {
      const camelMethod = _capitalize(method);
      callback(component["before" + camelMethod], [], component);
      registry2[method](component);
      callback(component["after" + camelMethod], [], component);
    }
    _getRegistryForType(type) {
      for (let i = 0; i < this._typedRegistries.length; i++) {
        const reg = this._typedRegistries[i];
        if (reg.isForType(type)) {
          return reg;
        }
      }
      return this.plugins;
    }
    _get(id, typedRegistry, type) {
      const item = typedRegistry.get(id);
      if (item === void 0) {
        throw new Error('"' + id + '" is not a registered ' + type + ".");
      }
      return item;
    }
  };
  var registry = /* @__PURE__ */ new Registry();
  var PluginService = class {
    constructor() {
      this._init = void 0;
    }
    notify(chart, hook, args, filter) {
      if (hook === "beforeInit") {
        this._init = this._createDescriptors(chart, true);
        this._notify(this._init, chart, "install");
      }
      if (this._init === void 0) {
        return;
      }
      const descriptors2 = filter ? this._descriptors(chart).filter(filter) : this._descriptors(chart);
      const result = this._notify(descriptors2, chart, hook, args);
      if (hook === "afterDestroy") {
        this._notify(descriptors2, chart, "stop");
        this._notify(this._init, chart, "uninstall");
        this._init = void 0;
      }
      return result;
    }
    _notify(descriptors2, chart, hook, args) {
      args = args || {};
      for (const descriptor of descriptors2) {
        const plugin = descriptor.plugin;
        const method = plugin[hook];
        const params = [
          chart,
          args,
          descriptor.options
        ];
        if (callback(method, params, plugin) === false && args.cancelable) {
          return false;
        }
      }
      return true;
    }
    invalidate() {
      if (!isNullOrUndef(this._cache)) {
        this._oldCache = this._cache;
        this._cache = void 0;
      }
    }
    _descriptors(chart) {
      if (this._cache) {
        return this._cache;
      }
      const descriptors2 = this._cache = this._createDescriptors(chart);
      this._notifyStateChanges(chart);
      return descriptors2;
    }
    _createDescriptors(chart, all) {
      const config = chart && chart.config;
      const options = valueOrDefault(config.options && config.options.plugins, {});
      const plugins = allPlugins(config);
      return options === false && !all ? [] : createDescriptors(chart, plugins, options, all);
    }
    _notifyStateChanges(chart) {
      const previousDescriptors = this._oldCache || [];
      const descriptors2 = this._cache;
      const diff = (a, b) => a.filter((x) => !b.some((y) => x.plugin.id === y.plugin.id));
      this._notify(diff(previousDescriptors, descriptors2), chart, "stop");
      this._notify(diff(descriptors2, previousDescriptors), chart, "start");
    }
  };
  function allPlugins(config) {
    const localIds = {};
    const plugins = [];
    const keys = Object.keys(registry.plugins.items);
    for (let i = 0; i < keys.length; i++) {
      plugins.push(registry.getPlugin(keys[i]));
    }
    const local = config.plugins || [];
    for (let i = 0; i < local.length; i++) {
      const plugin = local[i];
      if (plugins.indexOf(plugin) === -1) {
        plugins.push(plugin);
        localIds[plugin.id] = true;
      }
    }
    return {
      plugins,
      localIds
    };
  }
  function getOpts(options, all) {
    if (!all && options === false) {
      return null;
    }
    if (options === true) {
      return {};
    }
    return options;
  }
  function createDescriptors(chart, { plugins, localIds }, options, all) {
    const result = [];
    const context = chart.getContext();
    for (const plugin of plugins) {
      const id = plugin.id;
      const opts = getOpts(options[id], all);
      if (opts === null) {
        continue;
      }
      result.push({
        plugin,
        options: pluginOpts(chart.config, {
          plugin,
          local: localIds[id]
        }, opts, context)
      });
    }
    return result;
  }
  function pluginOpts(config, { plugin, local }, opts, context) {
    const keys = config.pluginScopeKeys(plugin);
    const scopes = config.getOptionScopes(opts, keys);
    if (local && plugin.defaults) {
      scopes.push(plugin.defaults);
    }
    return config.createResolver(scopes, context, [
      ""
    ], {
      scriptable: false,
      indexable: false,
      allKeys: true
    });
  }
  function getIndexAxis(type, options) {
    const datasetDefaults = defaults.datasets[type] || {};
    const datasetOptions = (options.datasets || {})[type] || {};
    return datasetOptions.indexAxis || options.indexAxis || datasetDefaults.indexAxis || "x";
  }
  function getAxisFromDefaultScaleID(id, indexAxis) {
    let axis = id;
    if (id === "_index_") {
      axis = indexAxis;
    } else if (id === "_value_") {
      axis = indexAxis === "x" ? "y" : "x";
    }
    return axis;
  }
  function getDefaultScaleIDFromAxis(axis, indexAxis) {
    return axis === indexAxis ? "_index_" : "_value_";
  }
  function idMatchesAxis(id) {
    if (id === "x" || id === "y" || id === "r") {
      return id;
    }
  }
  function axisFromPosition(position) {
    if (position === "top" || position === "bottom") {
      return "x";
    }
    if (position === "left" || position === "right") {
      return "y";
    }
  }
  function determineAxis(id, ...scaleOptions) {
    if (idMatchesAxis(id)) {
      return id;
    }
    for (const opts of scaleOptions) {
      const axis = opts.axis || axisFromPosition(opts.position) || id.length > 1 && idMatchesAxis(id[0].toLowerCase());
      if (axis) {
        return axis;
      }
    }
    throw new Error(`Cannot determine type of '${id}' axis. Please provide 'axis' or 'position' option.`);
  }
  function getAxisFromDataset(id, axis, dataset) {
    if (dataset[axis + "AxisID"] === id) {
      return {
        axis
      };
    }
  }
  function retrieveAxisFromDatasets(id, config) {
    if (config.data && config.data.datasets) {
      const boundDs = config.data.datasets.filter((d) => d.xAxisID === id || d.yAxisID === id);
      if (boundDs.length) {
        return getAxisFromDataset(id, "x", boundDs[0]) || getAxisFromDataset(id, "y", boundDs[0]);
      }
    }
    return {};
  }
  function mergeScaleConfig(config, options) {
    const chartDefaults = overrides[config.type] || {
      scales: {}
    };
    const configScales = options.scales || {};
    const chartIndexAxis = getIndexAxis(config.type, options);
    const scales = /* @__PURE__ */ Object.create(null);
    Object.keys(configScales).forEach((id) => {
      const scaleConf = configScales[id];
      if (!isObject(scaleConf)) {
        return console.error(`Invalid scale configuration for scale: ${id}`);
      }
      if (scaleConf._proxy) {
        return console.warn(`Ignoring resolver passed as options for scale: ${id}`);
      }
      const axis = determineAxis(id, scaleConf, retrieveAxisFromDatasets(id, config), defaults.scales[scaleConf.type]);
      const defaultId = getDefaultScaleIDFromAxis(axis, chartIndexAxis);
      const defaultScaleOptions = chartDefaults.scales || {};
      scales[id] = mergeIf(/* @__PURE__ */ Object.create(null), [
        {
          axis
        },
        scaleConf,
        defaultScaleOptions[axis],
        defaultScaleOptions[defaultId]
      ]);
    });
    config.data.datasets.forEach((dataset) => {
      const type = dataset.type || config.type;
      const indexAxis = dataset.indexAxis || getIndexAxis(type, options);
      const datasetDefaults = overrides[type] || {};
      const defaultScaleOptions = datasetDefaults.scales || {};
      Object.keys(defaultScaleOptions).forEach((defaultID) => {
        const axis = getAxisFromDefaultScaleID(defaultID, indexAxis);
        const id = dataset[axis + "AxisID"] || axis;
        scales[id] = scales[id] || /* @__PURE__ */ Object.create(null);
        mergeIf(scales[id], [
          {
            axis
          },
          configScales[id],
          defaultScaleOptions[defaultID]
        ]);
      });
    });
    Object.keys(scales).forEach((key) => {
      const scale = scales[key];
      mergeIf(scale, [
        defaults.scales[scale.type],
        defaults.scale
      ]);
    });
    return scales;
  }
  function initOptions(config) {
    const options = config.options || (config.options = {});
    options.plugins = valueOrDefault(options.plugins, {});
    options.scales = mergeScaleConfig(config, options);
  }
  function initData(data) {
    data = data || {};
    data.datasets = data.datasets || [];
    data.labels = data.labels || [];
    return data;
  }
  function initConfig(config) {
    config = config || {};
    config.data = initData(config.data);
    initOptions(config);
    return config;
  }
  var keyCache = /* @__PURE__ */ new Map();
  var keysCached = /* @__PURE__ */ new Set();
  function cachedKeys(cacheKey, generate) {
    let keys = keyCache.get(cacheKey);
    if (!keys) {
      keys = generate();
      keyCache.set(cacheKey, keys);
      keysCached.add(keys);
    }
    return keys;
  }
  var addIfFound = (set2, obj, key) => {
    const opts = resolveObjectKey(obj, key);
    if (opts !== void 0) {
      set2.add(opts);
    }
  };
  var Config = class {
    constructor(config) {
      this._config = initConfig(config);
      this._scopeCache = /* @__PURE__ */ new Map();
      this._resolverCache = /* @__PURE__ */ new Map();
    }
    get platform() {
      return this._config.platform;
    }
    get type() {
      return this._config.type;
    }
    set type(type) {
      this._config.type = type;
    }
    get data() {
      return this._config.data;
    }
    set data(data) {
      this._config.data = initData(data);
    }
    get options() {
      return this._config.options;
    }
    set options(options) {
      this._config.options = options;
    }
    get plugins() {
      return this._config.plugins;
    }
    update() {
      const config = this._config;
      this.clearCache();
      initOptions(config);
    }
    clearCache() {
      this._scopeCache.clear();
      this._resolverCache.clear();
    }
    datasetScopeKeys(datasetType) {
      return cachedKeys(datasetType, () => [
        [
          `datasets.${datasetType}`,
          ""
        ]
      ]);
    }
    datasetAnimationScopeKeys(datasetType, transition) {
      return cachedKeys(`${datasetType}.transition.${transition}`, () => [
        [
          `datasets.${datasetType}.transitions.${transition}`,
          `transitions.${transition}`
        ],
        [
          `datasets.${datasetType}`,
          ""
        ]
      ]);
    }
    datasetElementScopeKeys(datasetType, elementType) {
      return cachedKeys(`${datasetType}-${elementType}`, () => [
        [
          `datasets.${datasetType}.elements.${elementType}`,
          `datasets.${datasetType}`,
          `elements.${elementType}`,
          ""
        ]
      ]);
    }
    pluginScopeKeys(plugin) {
      const id = plugin.id;
      const type = this.type;
      return cachedKeys(`${type}-plugin-${id}`, () => [
        [
          `plugins.${id}`,
          ...plugin.additionalOptionScopes || []
        ]
      ]);
    }
    _cachedScopes(mainScope, resetCache) {
      const _scopeCache = this._scopeCache;
      let cache = _scopeCache.get(mainScope);
      if (!cache || resetCache) {
        cache = /* @__PURE__ */ new Map();
        _scopeCache.set(mainScope, cache);
      }
      return cache;
    }
    getOptionScopes(mainScope, keyLists, resetCache) {
      const { options, type } = this;
      const cache = this._cachedScopes(mainScope, resetCache);
      const cached = cache.get(keyLists);
      if (cached) {
        return cached;
      }
      const scopes = /* @__PURE__ */ new Set();
      keyLists.forEach((keys) => {
        if (mainScope) {
          scopes.add(mainScope);
          keys.forEach((key) => addIfFound(scopes, mainScope, key));
        }
        keys.forEach((key) => addIfFound(scopes, options, key));
        keys.forEach((key) => addIfFound(scopes, overrides[type] || {}, key));
        keys.forEach((key) => addIfFound(scopes, defaults, key));
        keys.forEach((key) => addIfFound(scopes, descriptors, key));
      });
      const array = Array.from(scopes);
      if (array.length === 0) {
        array.push(/* @__PURE__ */ Object.create(null));
      }
      if (keysCached.has(keyLists)) {
        cache.set(keyLists, array);
      }
      return array;
    }
    chartOptionScopes() {
      const { options, type } = this;
      return [
        options,
        overrides[type] || {},
        defaults.datasets[type] || {},
        {
          type
        },
        defaults,
        descriptors
      ];
    }
    resolveNamedOptions(scopes, names2, context, prefixes = [
      ""
    ]) {
      const result = {
        $shared: true
      };
      const { resolver, subPrefixes } = getResolver(this._resolverCache, scopes, prefixes);
      let options = resolver;
      if (needContext(resolver, names2)) {
        result.$shared = false;
        context = isFunction(context) ? context() : context;
        const subResolver = this.createResolver(scopes, context, subPrefixes);
        options = _attachContext(resolver, context, subResolver);
      }
      for (const prop of names2) {
        result[prop] = options[prop];
      }
      return result;
    }
    createResolver(scopes, context, prefixes = [
      ""
    ], descriptorDefaults) {
      const { resolver } = getResolver(this._resolverCache, scopes, prefixes);
      return isObject(context) ? _attachContext(resolver, context, void 0, descriptorDefaults) : resolver;
    }
  };
  function getResolver(resolverCache, scopes, prefixes) {
    let cache = resolverCache.get(scopes);
    if (!cache) {
      cache = /* @__PURE__ */ new Map();
      resolverCache.set(scopes, cache);
    }
    const cacheKey = prefixes.join();
    let cached = cache.get(cacheKey);
    if (!cached) {
      const resolver = _createResolver(scopes, prefixes);
      cached = {
        resolver,
        subPrefixes: prefixes.filter((p) => !p.toLowerCase().includes("hover"))
      };
      cache.set(cacheKey, cached);
    }
    return cached;
  }
  var hasFunction = (value) => isObject(value) && Object.getOwnPropertyNames(value).some((key) => isFunction(value[key]));
  function needContext(proxy, names2) {
    const { isScriptable, isIndexable } = _descriptors(proxy);
    for (const prop of names2) {
      const scriptable = isScriptable(prop);
      const indexable = isIndexable(prop);
      const value = (indexable || scriptable) && proxy[prop];
      if (scriptable && (isFunction(value) || hasFunction(value)) || indexable && isArray(value)) {
        return true;
      }
    }
    return false;
  }
  var version = "4.5.1";
  var KNOWN_POSITIONS = [
    "top",
    "bottom",
    "left",
    "right",
    "chartArea"
  ];
  function positionIsHorizontal(position, axis) {
    return position === "top" || position === "bottom" || KNOWN_POSITIONS.indexOf(position) === -1 && axis === "x";
  }
  function compare2Level(l1, l2) {
    return function(a, b) {
      return a[l1] === b[l1] ? a[l2] - b[l2] : a[l1] - b[l1];
    };
  }
  function onAnimationsComplete(context) {
    const chart = context.chart;
    const animationOptions = chart.options.animation;
    chart.notifyPlugins("afterRender");
    callback(animationOptions && animationOptions.onComplete, [
      context
    ], chart);
  }
  function onAnimationProgress(context) {
    const chart = context.chart;
    const animationOptions = chart.options.animation;
    callback(animationOptions && animationOptions.onProgress, [
      context
    ], chart);
  }
  function getCanvas(item) {
    if (_isDomSupported() && typeof item === "string") {
      item = document.getElementById(item);
    } else if (item && item.length) {
      item = item[0];
    }
    if (item && item.canvas) {
      item = item.canvas;
    }
    return item;
  }
  var instances = {};
  var getChart = (key) => {
    const canvas = getCanvas(key);
    return Object.values(instances).filter((c) => c.canvas === canvas).pop();
  };
  function moveNumericKeys(obj, start, move) {
    const keys = Object.keys(obj);
    for (const key of keys) {
      const intKey = +key;
      if (intKey >= start) {
        const value = obj[key];
        delete obj[key];
        if (move > 0 || intKey > start) {
          obj[intKey + move] = value;
        }
      }
    }
  }
  function determineLastEvent(e, lastEvent, inChartArea, isClick) {
    if (!inChartArea || e.type === "mouseout") {
      return null;
    }
    if (isClick) {
      return lastEvent;
    }
    return e;
  }
  var Chart = class {
    static register(...items) {
      registry.add(...items);
      invalidatePlugins();
    }
    static unregister(...items) {
      registry.remove(...items);
      invalidatePlugins();
    }
    constructor(item, userConfig) {
      const config = this.config = new Config(userConfig);
      const initialCanvas = getCanvas(item);
      const existingChart = getChart(initialCanvas);
      if (existingChart) {
        throw new Error("Canvas is already in use. Chart with ID '" + existingChart.id + "' must be destroyed before the canvas with ID '" + existingChart.canvas.id + "' can be reused.");
      }
      const options = config.createResolver(config.chartOptionScopes(), this.getContext());
      this.platform = new (config.platform || _detectPlatform(initialCanvas))();
      this.platform.updateConfig(config);
      const context = this.platform.acquireContext(initialCanvas, options.aspectRatio);
      const canvas = context && context.canvas;
      const height = canvas && canvas.height;
      const width = canvas && canvas.width;
      this.id = uid();
      this.ctx = context;
      this.canvas = canvas;
      this.width = width;
      this.height = height;
      this._options = options;
      this._aspectRatio = this.aspectRatio;
      this._layers = [];
      this._metasets = [];
      this._stacks = void 0;
      this.boxes = [];
      this.currentDevicePixelRatio = void 0;
      this.chartArea = void 0;
      this._active = [];
      this._lastEvent = void 0;
      this._listeners = {};
      this._responsiveListeners = void 0;
      this._sortedMetasets = [];
      this.scales = {};
      this._plugins = new PluginService();
      this.$proxies = {};
      this._hiddenIndices = {};
      this.attached = false;
      this._animationsDisabled = void 0;
      this.$context = void 0;
      this._doResize = debounce((mode) => this.update(mode), options.resizeDelay || 0);
      this._dataChanges = [];
      instances[this.id] = this;
      if (!context || !canvas) {
        console.error("Failed to create chart: can't acquire context from the given item");
        return;
      }
      animator.listen(this, "complete", onAnimationsComplete);
      animator.listen(this, "progress", onAnimationProgress);
      this._initialize();
      if (this.attached) {
        this.update();
      }
    }
    get aspectRatio() {
      const { options: { aspectRatio, maintainAspectRatio }, width, height, _aspectRatio } = this;
      if (!isNullOrUndef(aspectRatio)) {
        return aspectRatio;
      }
      if (maintainAspectRatio && _aspectRatio) {
        return _aspectRatio;
      }
      return height ? width / height : null;
    }
    get data() {
      return this.config.data;
    }
    set data(data) {
      this.config.data = data;
    }
    get options() {
      return this._options;
    }
    set options(options) {
      this.config.options = options;
    }
    get registry() {
      return registry;
    }
    _initialize() {
      this.notifyPlugins("beforeInit");
      if (this.options.responsive) {
        this.resize();
      } else {
        retinaScale(this, this.options.devicePixelRatio);
      }
      this.bindEvents();
      this.notifyPlugins("afterInit");
      return this;
    }
    clear() {
      clearCanvas(this.canvas, this.ctx);
      return this;
    }
    stop() {
      animator.stop(this);
      return this;
    }
    resize(width, height) {
      if (!animator.running(this)) {
        this._resize(width, height);
      } else {
        this._resizeBeforeDraw = {
          width,
          height
        };
      }
    }
    _resize(width, height) {
      const options = this.options;
      const canvas = this.canvas;
      const aspectRatio = options.maintainAspectRatio && this.aspectRatio;
      const newSize = this.platform.getMaximumSize(canvas, width, height, aspectRatio);
      const newRatio = options.devicePixelRatio || this.platform.getDevicePixelRatio();
      const mode = this.width ? "resize" : "attach";
      this.width = newSize.width;
      this.height = newSize.height;
      this._aspectRatio = this.aspectRatio;
      if (!retinaScale(this, newRatio, true)) {
        return;
      }
      this.notifyPlugins("resize", {
        size: newSize
      });
      callback(options.onResize, [
        this,
        newSize
      ], this);
      if (this.attached) {
        if (this._doResize(mode)) {
          this.render();
        }
      }
    }
    ensureScalesHaveIDs() {
      const options = this.options;
      const scalesOptions = options.scales || {};
      each(scalesOptions, (axisOptions, axisID) => {
        axisOptions.id = axisID;
      });
    }
    buildOrUpdateScales() {
      const options = this.options;
      const scaleOpts = options.scales;
      const scales = this.scales;
      const updated = Object.keys(scales).reduce((obj, id) => {
        obj[id] = false;
        return obj;
      }, {});
      let items = [];
      if (scaleOpts) {
        items = items.concat(Object.keys(scaleOpts).map((id) => {
          const scaleOptions = scaleOpts[id];
          const axis = determineAxis(id, scaleOptions);
          const isRadial = axis === "r";
          const isHorizontal = axis === "x";
          return {
            options: scaleOptions,
            dposition: isRadial ? "chartArea" : isHorizontal ? "bottom" : "left",
            dtype: isRadial ? "radialLinear" : isHorizontal ? "category" : "linear"
          };
        }));
      }
      each(items, (item) => {
        const scaleOptions = item.options;
        const id = scaleOptions.id;
        const axis = determineAxis(id, scaleOptions);
        const scaleType = valueOrDefault(scaleOptions.type, item.dtype);
        if (scaleOptions.position === void 0 || positionIsHorizontal(scaleOptions.position, axis) !== positionIsHorizontal(item.dposition)) {
          scaleOptions.position = item.dposition;
        }
        updated[id] = true;
        let scale = null;
        if (id in scales && scales[id].type === scaleType) {
          scale = scales[id];
        } else {
          const scaleClass = registry.getScale(scaleType);
          scale = new scaleClass({
            id,
            type: scaleType,
            ctx: this.ctx,
            chart: this
          });
          scales[scale.id] = scale;
        }
        scale.init(scaleOptions, options);
      });
      each(updated, (hasUpdated, id) => {
        if (!hasUpdated) {
          delete scales[id];
        }
      });
      each(scales, (scale) => {
        layouts.configure(this, scale, scale.options);
        layouts.addBox(this, scale);
      });
    }
    _updateMetasets() {
      const metasets = this._metasets;
      const numData = this.data.datasets.length;
      const numMeta = metasets.length;
      metasets.sort((a, b) => a.index - b.index);
      if (numMeta > numData) {
        for (let i = numData; i < numMeta; ++i) {
          this._destroyDatasetMeta(i);
        }
        metasets.splice(numData, numMeta - numData);
      }
      this._sortedMetasets = metasets.slice(0).sort(compare2Level("order", "index"));
    }
    _removeUnreferencedMetasets() {
      const { _metasets: metasets, data: { datasets } } = this;
      if (metasets.length > datasets.length) {
        delete this._stacks;
      }
      metasets.forEach((meta, index2) => {
        if (datasets.filter((x) => x === meta._dataset).length === 0) {
          this._destroyDatasetMeta(index2);
        }
      });
    }
    buildOrUpdateControllers() {
      const newControllers = [];
      const datasets = this.data.datasets;
      let i, ilen;
      this._removeUnreferencedMetasets();
      for (i = 0, ilen = datasets.length; i < ilen; i++) {
        const dataset = datasets[i];
        let meta = this.getDatasetMeta(i);
        const type = dataset.type || this.config.type;
        if (meta.type && meta.type !== type) {
          this._destroyDatasetMeta(i);
          meta = this.getDatasetMeta(i);
        }
        meta.type = type;
        meta.indexAxis = dataset.indexAxis || getIndexAxis(type, this.options);
        meta.order = dataset.order || 0;
        meta.index = i;
        meta.label = "" + dataset.label;
        meta.visible = this.isDatasetVisible(i);
        if (meta.controller) {
          meta.controller.updateIndex(i);
          meta.controller.linkScales();
        } else {
          const ControllerClass = registry.getController(type);
          const { datasetElementType, dataElementType } = defaults.datasets[type];
          Object.assign(ControllerClass, {
            dataElementType: registry.getElement(dataElementType),
            datasetElementType: datasetElementType && registry.getElement(datasetElementType)
          });
          meta.controller = new ControllerClass(this, i);
          newControllers.push(meta.controller);
        }
      }
      this._updateMetasets();
      return newControllers;
    }
    _resetElements() {
      each(this.data.datasets, (dataset, datasetIndex) => {
        this.getDatasetMeta(datasetIndex).controller.reset();
      }, this);
    }
    reset() {
      this._resetElements();
      this.notifyPlugins("reset");
    }
    update(mode) {
      const config = this.config;
      config.update();
      const options = this._options = config.createResolver(config.chartOptionScopes(), this.getContext());
      const animsDisabled = this._animationsDisabled = !options.animation;
      this._updateScales();
      this._checkEventBindings();
      this._updateHiddenIndices();
      this._plugins.invalidate();
      if (this.notifyPlugins("beforeUpdate", {
        mode,
        cancelable: true
      }) === false) {
        return;
      }
      const newControllers = this.buildOrUpdateControllers();
      this.notifyPlugins("beforeElementsUpdate");
      let minPadding = 0;
      for (let i = 0, ilen = this.data.datasets.length; i < ilen; i++) {
        const { controller } = this.getDatasetMeta(i);
        const reset = !animsDisabled && newControllers.indexOf(controller) === -1;
        controller.buildOrUpdateElements(reset);
        minPadding = Math.max(+controller.getMaxOverflow(), minPadding);
      }
      minPadding = this._minPadding = options.layout.autoPadding ? minPadding : 0;
      this._updateLayout(minPadding);
      if (!animsDisabled) {
        each(newControllers, (controller) => {
          controller.reset();
        });
      }
      this._updateDatasets(mode);
      this.notifyPlugins("afterUpdate", {
        mode
      });
      this._layers.sort(compare2Level("z", "_idx"));
      const { _active, _lastEvent } = this;
      if (_lastEvent) {
        this._eventHandler(_lastEvent, true);
      } else if (_active.length) {
        this._updateHoverStyles(_active, _active, true);
      }
      this.render();
    }
    _updateScales() {
      each(this.scales, (scale) => {
        layouts.removeBox(this, scale);
      });
      this.ensureScalesHaveIDs();
      this.buildOrUpdateScales();
    }
    _checkEventBindings() {
      const options = this.options;
      const existingEvents = new Set(Object.keys(this._listeners));
      const newEvents = new Set(options.events);
      if (!setsEqual(existingEvents, newEvents) || !!this._responsiveListeners !== options.responsive) {
        this.unbindEvents();
        this.bindEvents();
      }
    }
    _updateHiddenIndices() {
      const { _hiddenIndices } = this;
      const changes = this._getUniformDataChanges() || [];
      for (const { method, start, count } of changes) {
        const move = method === "_removeElements" ? -count : count;
        moveNumericKeys(_hiddenIndices, start, move);
      }
    }
    _getUniformDataChanges() {
      const _dataChanges = this._dataChanges;
      if (!_dataChanges || !_dataChanges.length) {
        return;
      }
      this._dataChanges = [];
      const datasetCount = this.data.datasets.length;
      const makeSet = (idx) => new Set(_dataChanges.filter((c) => c[0] === idx).map((c, i) => i + "," + c.splice(1).join(",")));
      const changeSet = makeSet(0);
      for (let i = 1; i < datasetCount; i++) {
        if (!setsEqual(changeSet, makeSet(i))) {
          return;
        }
      }
      return Array.from(changeSet).map((c) => c.split(",")).map((a) => ({
        method: a[1],
        start: +a[2],
        count: +a[3]
      }));
    }
    _updateLayout(minPadding) {
      if (this.notifyPlugins("beforeLayout", {
        cancelable: true
      }) === false) {
        return;
      }
      layouts.update(this, this.width, this.height, minPadding);
      const area = this.chartArea;
      const noArea = area.width <= 0 || area.height <= 0;
      this._layers = [];
      each(this.boxes, (box) => {
        if (noArea && box.position === "chartArea") {
          return;
        }
        if (box.configure) {
          box.configure();
        }
        this._layers.push(...box._layers());
      }, this);
      this._layers.forEach((item, index2) => {
        item._idx = index2;
      });
      this.notifyPlugins("afterLayout");
    }
    _updateDatasets(mode) {
      if (this.notifyPlugins("beforeDatasetsUpdate", {
        mode,
        cancelable: true
      }) === false) {
        return;
      }
      for (let i = 0, ilen = this.data.datasets.length; i < ilen; ++i) {
        this.getDatasetMeta(i).controller.configure();
      }
      for (let i = 0, ilen = this.data.datasets.length; i < ilen; ++i) {
        this._updateDataset(i, isFunction(mode) ? mode({
          datasetIndex: i
        }) : mode);
      }
      this.notifyPlugins("afterDatasetsUpdate", {
        mode
      });
    }
    _updateDataset(index2, mode) {
      const meta = this.getDatasetMeta(index2);
      const args = {
        meta,
        index: index2,
        mode,
        cancelable: true
      };
      if (this.notifyPlugins("beforeDatasetUpdate", args) === false) {
        return;
      }
      meta.controller._update(mode);
      args.cancelable = false;
      this.notifyPlugins("afterDatasetUpdate", args);
    }
    render() {
      if (this.notifyPlugins("beforeRender", {
        cancelable: true
      }) === false) {
        return;
      }
      if (animator.has(this)) {
        if (this.attached && !animator.running(this)) {
          animator.start(this);
        }
      } else {
        this.draw();
        onAnimationsComplete({
          chart: this
        });
      }
    }
    draw() {
      let i;
      if (this._resizeBeforeDraw) {
        const { width, height } = this._resizeBeforeDraw;
        this._resizeBeforeDraw = null;
        this._resize(width, height);
      }
      this.clear();
      if (this.width <= 0 || this.height <= 0) {
        return;
      }
      if (this.notifyPlugins("beforeDraw", {
        cancelable: true
      }) === false) {
        return;
      }
      const layers = this._layers;
      for (i = 0; i < layers.length && layers[i].z <= 0; ++i) {
        layers[i].draw(this.chartArea);
      }
      this._drawDatasets();
      for (; i < layers.length; ++i) {
        layers[i].draw(this.chartArea);
      }
      this.notifyPlugins("afterDraw");
    }
    _getSortedDatasetMetas(filterVisible) {
      const metasets = this._sortedMetasets;
      const result = [];
      let i, ilen;
      for (i = 0, ilen = metasets.length; i < ilen; ++i) {
        const meta = metasets[i];
        if (!filterVisible || meta.visible) {
          result.push(meta);
        }
      }
      return result;
    }
    getSortedVisibleDatasetMetas() {
      return this._getSortedDatasetMetas(true);
    }
    _drawDatasets() {
      if (this.notifyPlugins("beforeDatasetsDraw", {
        cancelable: true
      }) === false) {
        return;
      }
      const metasets = this.getSortedVisibleDatasetMetas();
      for (let i = metasets.length - 1; i >= 0; --i) {
        this._drawDataset(metasets[i]);
      }
      this.notifyPlugins("afterDatasetsDraw");
    }
    _drawDataset(meta) {
      const ctx = this.ctx;
      const args = {
        meta,
        index: meta.index,
        cancelable: true
      };
      const clip = getDatasetClipArea(this, meta);
      if (this.notifyPlugins("beforeDatasetDraw", args) === false) {
        return;
      }
      if (clip) {
        clipArea(ctx, clip);
      }
      meta.controller.draw();
      if (clip) {
        unclipArea(ctx);
      }
      args.cancelable = false;
      this.notifyPlugins("afterDatasetDraw", args);
    }
    isPointInArea(point) {
      return _isPointInArea(point, this.chartArea, this._minPadding);
    }
    getElementsAtEventForMode(e, mode, options, useFinalPosition) {
      const method = Interaction.modes[mode];
      if (typeof method === "function") {
        return method(this, e, options, useFinalPosition);
      }
      return [];
    }
    getDatasetMeta(datasetIndex) {
      const dataset = this.data.datasets[datasetIndex];
      const metasets = this._metasets;
      let meta = metasets.filter((x) => x && x._dataset === dataset).pop();
      if (!meta) {
        meta = {
          type: null,
          data: [],
          dataset: null,
          controller: null,
          hidden: null,
          xAxisID: null,
          yAxisID: null,
          order: dataset && dataset.order || 0,
          index: datasetIndex,
          _dataset: dataset,
          _parsed: [],
          _sorted: false
        };
        metasets.push(meta);
      }
      return meta;
    }
    getContext() {
      return this.$context || (this.$context = createContext(null, {
        chart: this,
        type: "chart"
      }));
    }
    getVisibleDatasetCount() {
      return this.getSortedVisibleDatasetMetas().length;
    }
    isDatasetVisible(datasetIndex) {
      const dataset = this.data.datasets[datasetIndex];
      if (!dataset) {
        return false;
      }
      const meta = this.getDatasetMeta(datasetIndex);
      return typeof meta.hidden === "boolean" ? !meta.hidden : !dataset.hidden;
    }
    setDatasetVisibility(datasetIndex, visible) {
      const meta = this.getDatasetMeta(datasetIndex);
      meta.hidden = !visible;
    }
    toggleDataVisibility(index2) {
      this._hiddenIndices[index2] = !this._hiddenIndices[index2];
    }
    getDataVisibility(index2) {
      return !this._hiddenIndices[index2];
    }
    _updateVisibility(datasetIndex, dataIndex, visible) {
      const mode = visible ? "show" : "hide";
      const meta = this.getDatasetMeta(datasetIndex);
      const anims = meta.controller._resolveAnimations(void 0, mode);
      if (defined(dataIndex)) {
        meta.data[dataIndex].hidden = !visible;
        this.update();
      } else {
        this.setDatasetVisibility(datasetIndex, visible);
        anims.update(meta, {
          visible
        });
        this.update((ctx) => ctx.datasetIndex === datasetIndex ? mode : void 0);
      }
    }
    hide(datasetIndex, dataIndex) {
      this._updateVisibility(datasetIndex, dataIndex, false);
    }
    show(datasetIndex, dataIndex) {
      this._updateVisibility(datasetIndex, dataIndex, true);
    }
    _destroyDatasetMeta(datasetIndex) {
      const meta = this._metasets[datasetIndex];
      if (meta && meta.controller) {
        meta.controller._destroy();
      }
      delete this._metasets[datasetIndex];
    }
    _stop() {
      let i, ilen;
      this.stop();
      animator.remove(this);
      for (i = 0, ilen = this.data.datasets.length; i < ilen; ++i) {
        this._destroyDatasetMeta(i);
      }
    }
    destroy() {
      this.notifyPlugins("beforeDestroy");
      const { canvas, ctx } = this;
      this._stop();
      this.config.clearCache();
      if (canvas) {
        this.unbindEvents();
        clearCanvas(canvas, ctx);
        this.platform.releaseContext(ctx);
        this.canvas = null;
        this.ctx = null;
      }
      delete instances[this.id];
      this.notifyPlugins("afterDestroy");
    }
    toBase64Image(...args) {
      return this.canvas.toDataURL(...args);
    }
    bindEvents() {
      this.bindUserEvents();
      if (this.options.responsive) {
        this.bindResponsiveEvents();
      } else {
        this.attached = true;
      }
    }
    bindUserEvents() {
      const listeners = this._listeners;
      const platform = this.platform;
      const _add = (type, listener2) => {
        platform.addEventListener(this, type, listener2);
        listeners[type] = listener2;
      };
      const listener = (e, x, y) => {
        e.offsetX = x;
        e.offsetY = y;
        this._eventHandler(e);
      };
      each(this.options.events, (type) => _add(type, listener));
    }
    bindResponsiveEvents() {
      if (!this._responsiveListeners) {
        this._responsiveListeners = {};
      }
      const listeners = this._responsiveListeners;
      const platform = this.platform;
      const _add = (type, listener2) => {
        platform.addEventListener(this, type, listener2);
        listeners[type] = listener2;
      };
      const _remove = (type, listener2) => {
        if (listeners[type]) {
          platform.removeEventListener(this, type, listener2);
          delete listeners[type];
        }
      };
      const listener = (width, height) => {
        if (this.canvas) {
          this.resize(width, height);
        }
      };
      let detached;
      const attached = () => {
        _remove("attach", attached);
        this.attached = true;
        this.resize();
        _add("resize", listener);
        _add("detach", detached);
      };
      detached = () => {
        this.attached = false;
        _remove("resize", listener);
        this._stop();
        this._resize(0, 0);
        _add("attach", attached);
      };
      if (platform.isAttached(this.canvas)) {
        attached();
      } else {
        detached();
      }
    }
    unbindEvents() {
      each(this._listeners, (listener, type) => {
        this.platform.removeEventListener(this, type, listener);
      });
      this._listeners = {};
      each(this._responsiveListeners, (listener, type) => {
        this.platform.removeEventListener(this, type, listener);
      });
      this._responsiveListeners = void 0;
    }
    updateHoverStyle(items, mode, enabled) {
      const prefix = enabled ? "set" : "remove";
      let meta, item, i, ilen;
      if (mode === "dataset") {
        meta = this.getDatasetMeta(items[0].datasetIndex);
        meta.controller["_" + prefix + "DatasetHoverStyle"]();
      }
      for (i = 0, ilen = items.length; i < ilen; ++i) {
        item = items[i];
        const controller = item && this.getDatasetMeta(item.datasetIndex).controller;
        if (controller) {
          controller[prefix + "HoverStyle"](item.element, item.datasetIndex, item.index);
        }
      }
    }
    getActiveElements() {
      return this._active || [];
    }
    setActiveElements(activeElements) {
      const lastActive = this._active || [];
      const active = activeElements.map(({ datasetIndex, index: index2 }) => {
        const meta = this.getDatasetMeta(datasetIndex);
        if (!meta) {
          throw new Error("No dataset found at index " + datasetIndex);
        }
        return {
          datasetIndex,
          element: meta.data[index2],
          index: index2
        };
      });
      const changed = !_elementsEqual(active, lastActive);
      if (changed) {
        this._active = active;
        this._lastEvent = null;
        this._updateHoverStyles(active, lastActive);
      }
    }
    notifyPlugins(hook, args, filter) {
      return this._plugins.notify(this, hook, args, filter);
    }
    isPluginEnabled(pluginId) {
      return this._plugins._cache.filter((p) => p.plugin.id === pluginId).length === 1;
    }
    _updateHoverStyles(active, lastActive, replay) {
      const hoverOptions = this.options.hover;
      const diff = (a, b) => a.filter((x) => !b.some((y) => x.datasetIndex === y.datasetIndex && x.index === y.index));
      const deactivated = diff(lastActive, active);
      const activated = replay ? active : diff(active, lastActive);
      if (deactivated.length) {
        this.updateHoverStyle(deactivated, hoverOptions.mode, false);
      }
      if (activated.length && hoverOptions.mode) {
        this.updateHoverStyle(activated, hoverOptions.mode, true);
      }
    }
    _eventHandler(e, replay) {
      const args = {
        event: e,
        replay,
        cancelable: true,
        inChartArea: this.isPointInArea(e)
      };
      const eventFilter = (plugin) => (plugin.options.events || this.options.events).includes(e.native.type);
      if (this.notifyPlugins("beforeEvent", args, eventFilter) === false) {
        return;
      }
      const changed = this._handleEvent(e, replay, args.inChartArea);
      args.cancelable = false;
      this.notifyPlugins("afterEvent", args, eventFilter);
      if (changed || args.changed) {
        this.render();
      }
      return this;
    }
    _handleEvent(e, replay, inChartArea) {
      const { _active: lastActive = [], options } = this;
      const useFinalPosition = replay;
      const active = this._getActiveElements(e, lastActive, inChartArea, useFinalPosition);
      const isClick = _isClickEvent(e);
      const lastEvent = determineLastEvent(e, this._lastEvent, inChartArea, isClick);
      if (inChartArea) {
        this._lastEvent = null;
        callback(options.onHover, [
          e,
          active,
          this
        ], this);
        if (isClick) {
          callback(options.onClick, [
            e,
            active,
            this
          ], this);
        }
      }
      const changed = !_elementsEqual(active, lastActive);
      if (changed || replay) {
        this._active = active;
        this._updateHoverStyles(active, lastActive, replay);
      }
      this._lastEvent = lastEvent;
      return changed;
    }
    _getActiveElements(e, lastActive, inChartArea, useFinalPosition) {
      if (e.type === "mouseout") {
        return [];
      }
      if (!inChartArea) {
        return lastActive;
      }
      const hoverOptions = this.options.hover;
      return this.getElementsAtEventForMode(e, hoverOptions.mode, hoverOptions, useFinalPosition);
    }
  };
  __publicField(Chart, "defaults", defaults);
  __publicField(Chart, "instances", instances);
  __publicField(Chart, "overrides", overrides);
  __publicField(Chart, "registry", registry);
  __publicField(Chart, "version", version);
  __publicField(Chart, "getChart", getChart);
  function invalidatePlugins() {
    return each(Chart.instances, (chart) => chart._plugins.invalidate());
  }
  function clipSelf(ctx, element, endAngle) {
    const { startAngle, x, y, outerRadius, innerRadius, options } = element;
    const { borderWidth, borderJoinStyle } = options;
    const outerAngleClip = Math.min(borderWidth / outerRadius, _normalizeAngle(startAngle - endAngle));
    ctx.beginPath();
    ctx.arc(x, y, outerRadius - borderWidth / 2, startAngle + outerAngleClip / 2, endAngle - outerAngleClip / 2);
    if (innerRadius > 0) {
      const innerAngleClip = Math.min(borderWidth / innerRadius, _normalizeAngle(startAngle - endAngle));
      ctx.arc(x, y, innerRadius + borderWidth / 2, endAngle - innerAngleClip / 2, startAngle + innerAngleClip / 2, true);
    } else {
      const clipWidth = Math.min(borderWidth / 2, outerRadius * _normalizeAngle(startAngle - endAngle));
      if (borderJoinStyle === "round") {
        ctx.arc(x, y, clipWidth, endAngle - PI / 2, startAngle + PI / 2, true);
      } else if (borderJoinStyle === "bevel") {
        const r = 2 * clipWidth * clipWidth;
        const endX = -r * Math.cos(endAngle + PI / 2) + x;
        const endY = -r * Math.sin(endAngle + PI / 2) + y;
        const startX = r * Math.cos(startAngle + PI / 2) + x;
        const startY = r * Math.sin(startAngle + PI / 2) + y;
        ctx.lineTo(endX, endY);
        ctx.lineTo(startX, startY);
      }
    }
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clip("evenodd");
  }
  function clipArc(ctx, element, endAngle) {
    const { startAngle, pixelMargin, x, y, outerRadius, innerRadius } = element;
    let angleMargin = pixelMargin / outerRadius;
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, startAngle - angleMargin, endAngle + angleMargin);
    if (innerRadius > pixelMargin) {
      angleMargin = pixelMargin / innerRadius;
      ctx.arc(x, y, innerRadius, endAngle + angleMargin, startAngle - angleMargin, true);
    } else {
      ctx.arc(x, y, pixelMargin, endAngle + HALF_PI, startAngle - HALF_PI);
    }
    ctx.closePath();
    ctx.clip();
  }
  function toRadiusCorners(value) {
    return _readValueToProps(value, [
      "outerStart",
      "outerEnd",
      "innerStart",
      "innerEnd"
    ]);
  }
  function parseBorderRadius$1(arc, innerRadius, outerRadius, angleDelta) {
    const o = toRadiusCorners(arc.options.borderRadius);
    const halfThickness = (outerRadius - innerRadius) / 2;
    const innerLimit = Math.min(halfThickness, angleDelta * innerRadius / 2);
    const computeOuterLimit = (val) => {
      const outerArcLimit = (outerRadius - Math.min(halfThickness, val)) * angleDelta / 2;
      return _limitValue(val, 0, Math.min(halfThickness, outerArcLimit));
    };
    return {
      outerStart: computeOuterLimit(o.outerStart),
      outerEnd: computeOuterLimit(o.outerEnd),
      innerStart: _limitValue(o.innerStart, 0, innerLimit),
      innerEnd: _limitValue(o.innerEnd, 0, innerLimit)
    };
  }
  function rThetaToXY(r, theta, x, y) {
    return {
      x: x + r * Math.cos(theta),
      y: y + r * Math.sin(theta)
    };
  }
  function pathArc(ctx, element, offset, spacing, end, circular) {
    const { x, y, startAngle: start, pixelMargin, innerRadius: innerR } = element;
    const outerRadius = Math.max(element.outerRadius + spacing + offset - pixelMargin, 0);
    const innerRadius = innerR > 0 ? innerR + spacing + offset + pixelMargin : 0;
    let spacingOffset = 0;
    const alpha2 = end - start;
    if (spacing) {
      const noSpacingInnerRadius = innerR > 0 ? innerR - spacing : 0;
      const noSpacingOuterRadius = outerRadius > 0 ? outerRadius - spacing : 0;
      const avNogSpacingRadius = (noSpacingInnerRadius + noSpacingOuterRadius) / 2;
      const adjustedAngle = avNogSpacingRadius !== 0 ? alpha2 * avNogSpacingRadius / (avNogSpacingRadius + spacing) : alpha2;
      spacingOffset = (alpha2 - adjustedAngle) / 2;
    }
    const beta = Math.max(1e-3, alpha2 * outerRadius - offset / PI) / outerRadius;
    const angleOffset = (alpha2 - beta) / 2;
    const startAngle = start + angleOffset + spacingOffset;
    const endAngle = end - angleOffset - spacingOffset;
    const { outerStart, outerEnd, innerStart, innerEnd } = parseBorderRadius$1(element, innerRadius, outerRadius, endAngle - startAngle);
    const outerStartAdjustedRadius = outerRadius - outerStart;
    const outerEndAdjustedRadius = outerRadius - outerEnd;
    const outerStartAdjustedAngle = startAngle + outerStart / outerStartAdjustedRadius;
    const outerEndAdjustedAngle = endAngle - outerEnd / outerEndAdjustedRadius;
    const innerStartAdjustedRadius = innerRadius + innerStart;
    const innerEndAdjustedRadius = innerRadius + innerEnd;
    const innerStartAdjustedAngle = startAngle + innerStart / innerStartAdjustedRadius;
    const innerEndAdjustedAngle = endAngle - innerEnd / innerEndAdjustedRadius;
    ctx.beginPath();
    if (circular) {
      const outerMidAdjustedAngle = (outerStartAdjustedAngle + outerEndAdjustedAngle) / 2;
      ctx.arc(x, y, outerRadius, outerStartAdjustedAngle, outerMidAdjustedAngle);
      ctx.arc(x, y, outerRadius, outerMidAdjustedAngle, outerEndAdjustedAngle);
      if (outerEnd > 0) {
        const pCenter = rThetaToXY(outerEndAdjustedRadius, outerEndAdjustedAngle, x, y);
        ctx.arc(pCenter.x, pCenter.y, outerEnd, outerEndAdjustedAngle, endAngle + HALF_PI);
      }
      const p4 = rThetaToXY(innerEndAdjustedRadius, endAngle, x, y);
      ctx.lineTo(p4.x, p4.y);
      if (innerEnd > 0) {
        const pCenter = rThetaToXY(innerEndAdjustedRadius, innerEndAdjustedAngle, x, y);
        ctx.arc(pCenter.x, pCenter.y, innerEnd, endAngle + HALF_PI, innerEndAdjustedAngle + Math.PI);
      }
      const innerMidAdjustedAngle = (endAngle - innerEnd / innerRadius + (startAngle + innerStart / innerRadius)) / 2;
      ctx.arc(x, y, innerRadius, endAngle - innerEnd / innerRadius, innerMidAdjustedAngle, true);
      ctx.arc(x, y, innerRadius, innerMidAdjustedAngle, startAngle + innerStart / innerRadius, true);
      if (innerStart > 0) {
        const pCenter = rThetaToXY(innerStartAdjustedRadius, innerStartAdjustedAngle, x, y);
        ctx.arc(pCenter.x, pCenter.y, innerStart, innerStartAdjustedAngle + Math.PI, startAngle - HALF_PI);
      }
      const p8 = rThetaToXY(outerStartAdjustedRadius, startAngle, x, y);
      ctx.lineTo(p8.x, p8.y);
      if (outerStart > 0) {
        const pCenter = rThetaToXY(outerStartAdjustedRadius, outerStartAdjustedAngle, x, y);
        ctx.arc(pCenter.x, pCenter.y, outerStart, startAngle - HALF_PI, outerStartAdjustedAngle);
      }
    } else {
      ctx.moveTo(x, y);
      const outerStartX = Math.cos(outerStartAdjustedAngle) * outerRadius + x;
      const outerStartY = Math.sin(outerStartAdjustedAngle) * outerRadius + y;
      ctx.lineTo(outerStartX, outerStartY);
      const outerEndX = Math.cos(outerEndAdjustedAngle) * outerRadius + x;
      const outerEndY = Math.sin(outerEndAdjustedAngle) * outerRadius + y;
      ctx.lineTo(outerEndX, outerEndY);
    }
    ctx.closePath();
  }
  function drawArc(ctx, element, offset, spacing, circular) {
    const { fullCircles, startAngle, circumference } = element;
    let endAngle = element.endAngle;
    if (fullCircles) {
      pathArc(ctx, element, offset, spacing, endAngle, circular);
      for (let i = 0; i < fullCircles; ++i) {
        ctx.fill();
      }
      if (!isNaN(circumference)) {
        endAngle = startAngle + (circumference % TAU || TAU);
      }
    }
    pathArc(ctx, element, offset, spacing, endAngle, circular);
    ctx.fill();
    return endAngle;
  }
  function drawBorder(ctx, element, offset, spacing, circular) {
    const { fullCircles, startAngle, circumference, options } = element;
    const { borderWidth, borderJoinStyle, borderDash, borderDashOffset, borderRadius } = options;
    const inner = options.borderAlign === "inner";
    if (!borderWidth) {
      return;
    }
    ctx.setLineDash(borderDash || []);
    ctx.lineDashOffset = borderDashOffset;
    if (inner) {
      ctx.lineWidth = borderWidth * 2;
      ctx.lineJoin = borderJoinStyle || "round";
    } else {
      ctx.lineWidth = borderWidth;
      ctx.lineJoin = borderJoinStyle || "bevel";
    }
    let endAngle = element.endAngle;
    if (fullCircles) {
      pathArc(ctx, element, offset, spacing, endAngle, circular);
      for (let i = 0; i < fullCircles; ++i) {
        ctx.stroke();
      }
      if (!isNaN(circumference)) {
        endAngle = startAngle + (circumference % TAU || TAU);
      }
    }
    if (inner) {
      clipArc(ctx, element, endAngle);
    }
    if (options.selfJoin && endAngle - startAngle >= PI && borderRadius === 0 && borderJoinStyle !== "miter") {
      clipSelf(ctx, element, endAngle);
    }
    if (!fullCircles) {
      pathArc(ctx, element, offset, spacing, endAngle, circular);
      ctx.stroke();
    }
  }
  var ArcElement = class extends Element {
    constructor(cfg) {
      super();
      __publicField(this, "circumference");
      __publicField(this, "endAngle");
      __publicField(this, "fullCircles");
      __publicField(this, "innerRadius");
      __publicField(this, "outerRadius");
      __publicField(this, "pixelMargin");
      __publicField(this, "startAngle");
      this.options = void 0;
      this.circumference = void 0;
      this.startAngle = void 0;
      this.endAngle = void 0;
      this.innerRadius = void 0;
      this.outerRadius = void 0;
      this.pixelMargin = 0;
      this.fullCircles = 0;
      if (cfg) {
        Object.assign(this, cfg);
      }
    }
    inRange(chartX, chartY, useFinalPosition) {
      const point = this.getProps([
        "x",
        "y"
      ], useFinalPosition);
      const { angle, distance } = getAngleFromPoint(point, {
        x: chartX,
        y: chartY
      });
      const { startAngle, endAngle, innerRadius, outerRadius, circumference } = this.getProps([
        "startAngle",
        "endAngle",
        "innerRadius",
        "outerRadius",
        "circumference"
      ], useFinalPosition);
      const rAdjust = (this.options.spacing + this.options.borderWidth) / 2;
      const _circumference = valueOrDefault(circumference, endAngle - startAngle);
      const nonZeroBetween = _angleBetween(angle, startAngle, endAngle) && startAngle !== endAngle;
      const betweenAngles = _circumference >= TAU || nonZeroBetween;
      const withinRadius = _isBetween(distance, innerRadius + rAdjust, outerRadius + rAdjust);
      return betweenAngles && withinRadius;
    }
    getCenterPoint(useFinalPosition) {
      const { x, y, startAngle, endAngle, innerRadius, outerRadius } = this.getProps([
        "x",
        "y",
        "startAngle",
        "endAngle",
        "innerRadius",
        "outerRadius"
      ], useFinalPosition);
      const { offset, spacing } = this.options;
      const halfAngle = (startAngle + endAngle) / 2;
      const halfRadius = (innerRadius + outerRadius + spacing + offset) / 2;
      return {
        x: x + Math.cos(halfAngle) * halfRadius,
        y: y + Math.sin(halfAngle) * halfRadius
      };
    }
    tooltipPosition(useFinalPosition) {
      return this.getCenterPoint(useFinalPosition);
    }
    draw(ctx) {
      const { options, circumference } = this;
      const offset = (options.offset || 0) / 4;
      const spacing = (options.spacing || 0) / 2;
      const circular = options.circular;
      this.pixelMargin = options.borderAlign === "inner" ? 0.33 : 0;
      this.fullCircles = circumference > TAU ? Math.floor(circumference / TAU) : 0;
      if (circumference === 0 || this.innerRadius < 0 || this.outerRadius < 0) {
        return;
      }
      ctx.save();
      const halfAngle = (this.startAngle + this.endAngle) / 2;
      ctx.translate(Math.cos(halfAngle) * offset, Math.sin(halfAngle) * offset);
      const fix = 1 - Math.sin(Math.min(PI, circumference || 0));
      const radiusOffset = offset * fix;
      ctx.fillStyle = options.backgroundColor;
      ctx.strokeStyle = options.borderColor;
      drawArc(ctx, this, radiusOffset, spacing, circular);
      drawBorder(ctx, this, radiusOffset, spacing, circular);
      ctx.restore();
    }
  };
  __publicField(ArcElement, "id", "arc");
  __publicField(ArcElement, "defaults", {
    borderAlign: "center",
    borderColor: "#fff",
    borderDash: [],
    borderDashOffset: 0,
    borderJoinStyle: void 0,
    borderRadius: 0,
    borderWidth: 2,
    offset: 0,
    spacing: 0,
    angle: void 0,
    circular: true,
    selfJoin: false
  });
  __publicField(ArcElement, "defaultRoutes", {
    backgroundColor: "backgroundColor"
  });
  __publicField(ArcElement, "descriptors", {
    _scriptable: true,
    _indexable: (name) => name !== "borderDash"
  });
  function setStyle(ctx, options, style = options) {
    ctx.lineCap = valueOrDefault(style.borderCapStyle, options.borderCapStyle);
    ctx.setLineDash(valueOrDefault(style.borderDash, options.borderDash));
    ctx.lineDashOffset = valueOrDefault(style.borderDashOffset, options.borderDashOffset);
    ctx.lineJoin = valueOrDefault(style.borderJoinStyle, options.borderJoinStyle);
    ctx.lineWidth = valueOrDefault(style.borderWidth, options.borderWidth);
    ctx.strokeStyle = valueOrDefault(style.borderColor, options.borderColor);
  }
  function lineTo(ctx, previous, target) {
    ctx.lineTo(target.x, target.y);
  }
  function getLineMethod(options) {
    if (options.stepped) {
      return _steppedLineTo;
    }
    if (options.tension || options.cubicInterpolationMode === "monotone") {
      return _bezierCurveTo;
    }
    return lineTo;
  }
  function pathVars(points, segment, params = {}) {
    const count = points.length;
    const { start: paramsStart = 0, end: paramsEnd = count - 1 } = params;
    const { start: segmentStart, end: segmentEnd } = segment;
    const start = Math.max(paramsStart, segmentStart);
    const end = Math.min(paramsEnd, segmentEnd);
    const outside = paramsStart < segmentStart && paramsEnd < segmentStart || paramsStart > segmentEnd && paramsEnd > segmentEnd;
    return {
      count,
      start,
      loop: segment.loop,
      ilen: end < start && !outside ? count + end - start : end - start
    };
  }
  function pathSegment(ctx, line, segment, params) {
    const { points, options } = line;
    const { count, start, loop, ilen } = pathVars(points, segment, params);
    const lineMethod = getLineMethod(options);
    let { move = true, reverse } = params || {};
    let i, point, prev;
    for (i = 0; i <= ilen; ++i) {
      point = points[(start + (reverse ? ilen - i : i)) % count];
      if (point.skip) {
        continue;
      } else if (move) {
        ctx.moveTo(point.x, point.y);
        move = false;
      } else {
        lineMethod(ctx, prev, point, reverse, options.stepped);
      }
      prev = point;
    }
    if (loop) {
      point = points[(start + (reverse ? ilen : 0)) % count];
      lineMethod(ctx, prev, point, reverse, options.stepped);
    }
    return !!loop;
  }
  function fastPathSegment(ctx, line, segment, params) {
    const points = line.points;
    const { count, start, ilen } = pathVars(points, segment, params);
    const { move = true, reverse } = params || {};
    let avgX = 0;
    let countX = 0;
    let i, point, prevX, minY, maxY, lastY;
    const pointIndex = (index2) => (start + (reverse ? ilen - index2 : index2)) % count;
    const drawX = () => {
      if (minY !== maxY) {
        ctx.lineTo(avgX, maxY);
        ctx.lineTo(avgX, minY);
        ctx.lineTo(avgX, lastY);
      }
    };
    if (move) {
      point = points[pointIndex(0)];
      ctx.moveTo(point.x, point.y);
    }
    for (i = 0; i <= ilen; ++i) {
      point = points[pointIndex(i)];
      if (point.skip) {
        continue;
      }
      const x = point.x;
      const y = point.y;
      const truncX = x | 0;
      if (truncX === prevX) {
        if (y < minY) {
          minY = y;
        } else if (y > maxY) {
          maxY = y;
        }
        avgX = (countX * avgX + x) / ++countX;
      } else {
        drawX();
        ctx.lineTo(x, y);
        prevX = truncX;
        countX = 0;
        minY = maxY = y;
      }
      lastY = y;
    }
    drawX();
  }
  function _getSegmentMethod(line) {
    const opts = line.options;
    const borderDash = opts.borderDash && opts.borderDash.length;
    const useFastPath = !line._decimated && !line._loop && !opts.tension && opts.cubicInterpolationMode !== "monotone" && !opts.stepped && !borderDash;
    return useFastPath ? fastPathSegment : pathSegment;
  }
  function _getInterpolationMethod(options) {
    if (options.stepped) {
      return _steppedInterpolation;
    }
    if (options.tension || options.cubicInterpolationMode === "monotone") {
      return _bezierInterpolation;
    }
    return _pointInLine;
  }
  function strokePathWithCache(ctx, line, start, count) {
    let path = line._path;
    if (!path) {
      path = line._path = new Path2D();
      if (line.path(path, start, count)) {
        path.closePath();
      }
    }
    setStyle(ctx, line.options);
    ctx.stroke(path);
  }
  function strokePathDirect(ctx, line, start, count) {
    const { segments, options } = line;
    const segmentMethod = _getSegmentMethod(line);
    for (const segment of segments) {
      setStyle(ctx, options, segment.style);
      ctx.beginPath();
      if (segmentMethod(ctx, line, segment, {
        start,
        end: start + count - 1
      })) {
        ctx.closePath();
      }
      ctx.stroke();
    }
  }
  var usePath2D = typeof Path2D === "function";
  function draw(ctx, line, start, count) {
    if (usePath2D && !line.options.segment) {
      strokePathWithCache(ctx, line, start, count);
    } else {
      strokePathDirect(ctx, line, start, count);
    }
  }
  var LineElement = class extends Element {
    constructor(cfg) {
      super();
      this.animated = true;
      this.options = void 0;
      this._chart = void 0;
      this._loop = void 0;
      this._fullLoop = void 0;
      this._path = void 0;
      this._points = void 0;
      this._segments = void 0;
      this._decimated = false;
      this._pointsUpdated = false;
      this._datasetIndex = void 0;
      if (cfg) {
        Object.assign(this, cfg);
      }
    }
    updateControlPoints(chartArea, indexAxis) {
      const options = this.options;
      if ((options.tension || options.cubicInterpolationMode === "monotone") && !options.stepped && !this._pointsUpdated) {
        const loop = options.spanGaps ? this._loop : this._fullLoop;
        _updateBezierControlPoints(this._points, options, chartArea, loop, indexAxis);
        this._pointsUpdated = true;
      }
    }
    set points(points) {
      this._points = points;
      delete this._segments;
      delete this._path;
      this._pointsUpdated = false;
    }
    get points() {
      return this._points;
    }
    get segments() {
      return this._segments || (this._segments = _computeSegments(this, this.options.segment));
    }
    first() {
      const segments = this.segments;
      const points = this.points;
      return segments.length && points[segments[0].start];
    }
    last() {
      const segments = this.segments;
      const points = this.points;
      const count = segments.length;
      return count && points[segments[count - 1].end];
    }
    interpolate(point, property) {
      const options = this.options;
      const value = point[property];
      const points = this.points;
      const segments = _boundSegments(this, {
        property,
        start: value,
        end: value
      });
      if (!segments.length) {
        return;
      }
      const result = [];
      const _interpolate = _getInterpolationMethod(options);
      let i, ilen;
      for (i = 0, ilen = segments.length; i < ilen; ++i) {
        const { start, end } = segments[i];
        const p1 = points[start];
        const p2 = points[end];
        if (p1 === p2) {
          result.push(p1);
          continue;
        }
        const t = Math.abs((value - p1[property]) / (p2[property] - p1[property]));
        const interpolated = _interpolate(p1, p2, t, options.stepped);
        interpolated[property] = point[property];
        result.push(interpolated);
      }
      return result.length === 1 ? result[0] : result;
    }
    pathSegment(ctx, segment, params) {
      const segmentMethod = _getSegmentMethod(this);
      return segmentMethod(ctx, this, segment, params);
    }
    path(ctx, start, count) {
      const segments = this.segments;
      const segmentMethod = _getSegmentMethod(this);
      let loop = this._loop;
      start = start || 0;
      count = count || this.points.length - start;
      for (const segment of segments) {
        loop &= segmentMethod(ctx, this, segment, {
          start,
          end: start + count - 1
        });
      }
      return !!loop;
    }
    draw(ctx, chartArea, start, count) {
      const options = this.options || {};
      const points = this.points || [];
      if (points.length && options.borderWidth) {
        ctx.save();
        draw(ctx, this, start, count);
        ctx.restore();
      }
      if (this.animated) {
        this._pointsUpdated = false;
        this._path = void 0;
      }
    }
  };
  __publicField(LineElement, "id", "line");
  __publicField(LineElement, "defaults", {
    borderCapStyle: "butt",
    borderDash: [],
    borderDashOffset: 0,
    borderJoinStyle: "miter",
    borderWidth: 3,
    capBezierPoints: true,
    cubicInterpolationMode: "default",
    fill: false,
    spanGaps: false,
    stepped: false,
    tension: 0
  });
  __publicField(LineElement, "defaultRoutes", {
    backgroundColor: "backgroundColor",
    borderColor: "borderColor"
  });
  __publicField(LineElement, "descriptors", {
    _scriptable: true,
    _indexable: (name) => name !== "borderDash" && name !== "fill"
  });
  function inRange$1(el, pos, axis, useFinalPosition) {
    const options = el.options;
    const { [axis]: value } = el.getProps([
      axis
    ], useFinalPosition);
    return Math.abs(pos - value) < options.radius + options.hitRadius;
  }
  var PointElement = class extends Element {
    constructor(cfg) {
      super();
      __publicField(this, "parsed");
      __publicField(this, "skip");
      __publicField(this, "stop");
      this.options = void 0;
      this.parsed = void 0;
      this.skip = void 0;
      this.stop = void 0;
      if (cfg) {
        Object.assign(this, cfg);
      }
    }
    inRange(mouseX, mouseY, useFinalPosition) {
      const options = this.options;
      const { x, y } = this.getProps([
        "x",
        "y"
      ], useFinalPosition);
      return Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2) < Math.pow(options.hitRadius + options.radius, 2);
    }
    inXRange(mouseX, useFinalPosition) {
      return inRange$1(this, mouseX, "x", useFinalPosition);
    }
    inYRange(mouseY, useFinalPosition) {
      return inRange$1(this, mouseY, "y", useFinalPosition);
    }
    getCenterPoint(useFinalPosition) {
      const { x, y } = this.getProps([
        "x",
        "y"
      ], useFinalPosition);
      return {
        x,
        y
      };
    }
    size(options) {
      options = options || this.options || {};
      let radius = options.radius || 0;
      radius = Math.max(radius, radius && options.hoverRadius || 0);
      const borderWidth = radius && options.borderWidth || 0;
      return (radius + borderWidth) * 2;
    }
    draw(ctx, area) {
      const options = this.options;
      if (this.skip || options.radius < 0.1 || !_isPointInArea(this, area, this.size(options) / 2)) {
        return;
      }
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = options.borderWidth;
      ctx.fillStyle = options.backgroundColor;
      drawPoint(ctx, options, this.x, this.y);
    }
    getRange() {
      const options = this.options || {};
      return options.radius + options.hitRadius;
    }
  };
  __publicField(PointElement, "id", "point");
  /**
  * @type {any}
  */
  __publicField(PointElement, "defaults", {
    borderWidth: 1,
    hitRadius: 1,
    hoverBorderWidth: 1,
    hoverRadius: 4,
    pointStyle: "circle",
    radius: 3,
    rotation: 0
  });
  /**
  * @type {any}
  */
  __publicField(PointElement, "defaultRoutes", {
    backgroundColor: "backgroundColor",
    borderColor: "borderColor"
  });
  function getBarBounds(bar, useFinalPosition) {
    const { x, y, base, width, height } = bar.getProps([
      "x",
      "y",
      "base",
      "width",
      "height"
    ], useFinalPosition);
    let left, right, top, bottom, half;
    if (bar.horizontal) {
      half = height / 2;
      left = Math.min(x, base);
      right = Math.max(x, base);
      top = y - half;
      bottom = y + half;
    } else {
      half = width / 2;
      left = x - half;
      right = x + half;
      top = Math.min(y, base);
      bottom = Math.max(y, base);
    }
    return {
      left,
      top,
      right,
      bottom
    };
  }
  function skipOrLimit(skip2, value, min, max) {
    return skip2 ? 0 : _limitValue(value, min, max);
  }
  function parseBorderWidth(bar, maxW, maxH) {
    const value = bar.options.borderWidth;
    const skip2 = bar.borderSkipped;
    const o = toTRBL(value);
    return {
      t: skipOrLimit(skip2.top, o.top, 0, maxH),
      r: skipOrLimit(skip2.right, o.right, 0, maxW),
      b: skipOrLimit(skip2.bottom, o.bottom, 0, maxH),
      l: skipOrLimit(skip2.left, o.left, 0, maxW)
    };
  }
  function parseBorderRadius(bar, maxW, maxH) {
    const { enableBorderRadius } = bar.getProps([
      "enableBorderRadius"
    ]);
    const value = bar.options.borderRadius;
    const o = toTRBLCorners(value);
    const maxR = Math.min(maxW, maxH);
    const skip2 = bar.borderSkipped;
    const enableBorder = enableBorderRadius || isObject(value);
    return {
      topLeft: skipOrLimit(!enableBorder || skip2.top || skip2.left, o.topLeft, 0, maxR),
      topRight: skipOrLimit(!enableBorder || skip2.top || skip2.right, o.topRight, 0, maxR),
      bottomLeft: skipOrLimit(!enableBorder || skip2.bottom || skip2.left, o.bottomLeft, 0, maxR),
      bottomRight: skipOrLimit(!enableBorder || skip2.bottom || skip2.right, o.bottomRight, 0, maxR)
    };
  }
  function boundingRects(bar) {
    const bounds = getBarBounds(bar);
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const border = parseBorderWidth(bar, width / 2, height / 2);
    const radius = parseBorderRadius(bar, width / 2, height / 2);
    return {
      outer: {
        x: bounds.left,
        y: bounds.top,
        w: width,
        h: height,
        radius
      },
      inner: {
        x: bounds.left + border.l,
        y: bounds.top + border.t,
        w: width - border.l - border.r,
        h: height - border.t - border.b,
        radius: {
          topLeft: Math.max(0, radius.topLeft - Math.max(border.t, border.l)),
          topRight: Math.max(0, radius.topRight - Math.max(border.t, border.r)),
          bottomLeft: Math.max(0, radius.bottomLeft - Math.max(border.b, border.l)),
          bottomRight: Math.max(0, radius.bottomRight - Math.max(border.b, border.r))
        }
      }
    };
  }
  function inRange(bar, x, y, useFinalPosition) {
    const skipX = x === null;
    const skipY = y === null;
    const skipBoth = skipX && skipY;
    const bounds = bar && !skipBoth && getBarBounds(bar, useFinalPosition);
    return bounds && (skipX || _isBetween(x, bounds.left, bounds.right)) && (skipY || _isBetween(y, bounds.top, bounds.bottom));
  }
  function hasRadius(radius) {
    return radius.topLeft || radius.topRight || radius.bottomLeft || radius.bottomRight;
  }
  function addNormalRectPath(ctx, rect) {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  }
  function inflateRect(rect, amount, refRect = {}) {
    const x = rect.x !== refRect.x ? -amount : 0;
    const y = rect.y !== refRect.y ? -amount : 0;
    const w = (rect.x + rect.w !== refRect.x + refRect.w ? amount : 0) - x;
    const h = (rect.y + rect.h !== refRect.y + refRect.h ? amount : 0) - y;
    return {
      x: rect.x + x,
      y: rect.y + y,
      w: rect.w + w,
      h: rect.h + h,
      radius: rect.radius
    };
  }
  var BarElement = class extends Element {
    constructor(cfg) {
      super();
      this.options = void 0;
      this.horizontal = void 0;
      this.base = void 0;
      this.width = void 0;
      this.height = void 0;
      this.inflateAmount = void 0;
      if (cfg) {
        Object.assign(this, cfg);
      }
    }
    draw(ctx) {
      const { inflateAmount, options: { borderColor, backgroundColor } } = this;
      const { inner, outer } = boundingRects(this);
      const addRectPath = hasRadius(outer.radius) ? addRoundedRectPath : addNormalRectPath;
      ctx.save();
      if (outer.w !== inner.w || outer.h !== inner.h) {
        ctx.beginPath();
        addRectPath(ctx, inflateRect(outer, inflateAmount, inner));
        ctx.clip();
        addRectPath(ctx, inflateRect(inner, -inflateAmount, outer));
        ctx.fillStyle = borderColor;
        ctx.fill("evenodd");
      }
      ctx.beginPath();
      addRectPath(ctx, inflateRect(inner, inflateAmount));
      ctx.fillStyle = backgroundColor;
      ctx.fill();
      ctx.restore();
    }
    inRange(mouseX, mouseY, useFinalPosition) {
      return inRange(this, mouseX, mouseY, useFinalPosition);
    }
    inXRange(mouseX, useFinalPosition) {
      return inRange(this, mouseX, null, useFinalPosition);
    }
    inYRange(mouseY, useFinalPosition) {
      return inRange(this, null, mouseY, useFinalPosition);
    }
    getCenterPoint(useFinalPosition) {
      const { x, y, base, horizontal } = this.getProps([
        "x",
        "y",
        "base",
        "horizontal"
      ], useFinalPosition);
      return {
        x: horizontal ? (x + base) / 2 : x,
        y: horizontal ? y : (y + base) / 2
      };
    }
    getRange(axis) {
      return axis === "x" ? this.width / 2 : this.height / 2;
    }
  };
  __publicField(BarElement, "id", "bar");
  __publicField(BarElement, "defaults", {
    borderSkipped: "start",
    borderWidth: 0,
    borderRadius: 0,
    inflateAmount: "auto",
    pointStyle: void 0
  });
  __publicField(BarElement, "defaultRoutes", {
    backgroundColor: "backgroundColor",
    borderColor: "borderColor"
  });
  function _segments(line, target, property) {
    const segments = line.segments;
    const points = line.points;
    const tpoints = target.points;
    const parts = [];
    for (const segment of segments) {
      let { start, end } = segment;
      end = _findSegmentEnd(start, end, points);
      const bounds = _getBounds(property, points[start], points[end], segment.loop);
      if (!target.segments) {
        parts.push({
          source: segment,
          target: bounds,
          start: points[start],
          end: points[end]
        });
        continue;
      }
      const targetSegments = _boundSegments(target, bounds);
      for (const tgt of targetSegments) {
        const subBounds = _getBounds(property, tpoints[tgt.start], tpoints[tgt.end], tgt.loop);
        const fillSources = _boundSegment(segment, points, subBounds);
        for (const fillSource of fillSources) {
          parts.push({
            source: fillSource,
            target: tgt,
            start: {
              [property]: _getEdge(bounds, subBounds, "start", Math.max)
            },
            end: {
              [property]: _getEdge(bounds, subBounds, "end", Math.min)
            }
          });
        }
      }
    }
    return parts;
  }
  function _getBounds(property, first, last, loop) {
    if (loop) {
      return;
    }
    let start = first[property];
    let end = last[property];
    if (property === "angle") {
      start = _normalizeAngle(start);
      end = _normalizeAngle(end);
    }
    return {
      property,
      start,
      end
    };
  }
  function _pointsFromSegments(boundary, line) {
    const { x = null, y = null } = boundary || {};
    const linePoints = line.points;
    const points = [];
    line.segments.forEach(({ start, end }) => {
      end = _findSegmentEnd(start, end, linePoints);
      const first = linePoints[start];
      const last = linePoints[end];
      if (y !== null) {
        points.push({
          x: first.x,
          y
        });
        points.push({
          x: last.x,
          y
        });
      } else if (x !== null) {
        points.push({
          x,
          y: first.y
        });
        points.push({
          x,
          y: last.y
        });
      }
    });
    return points;
  }
  function _findSegmentEnd(start, end, points) {
    for (; end > start; end--) {
      const point = points[end];
      if (!isNaN(point.x) && !isNaN(point.y)) {
        break;
      }
    }
    return end;
  }
  function _getEdge(a, b, prop, fn) {
    if (a && b) {
      return fn(a[prop], b[prop]);
    }
    return a ? a[prop] : b ? b[prop] : 0;
  }
  function _createBoundaryLine(boundary, line) {
    let points = [];
    let _loop = false;
    if (isArray(boundary)) {
      _loop = true;
      points = boundary;
    } else {
      points = _pointsFromSegments(boundary, line);
    }
    return points.length ? new LineElement({
      points,
      options: {
        tension: 0
      },
      _loop,
      _fullLoop: _loop
    }) : null;
  }
  function _shouldApplyFill(source) {
    return source && source.fill !== false;
  }
  function _resolveTarget(sources, index2, propagate) {
    const source = sources[index2];
    let fill2 = source.fill;
    const visited = [
      index2
    ];
    let target;
    if (!propagate) {
      return fill2;
    }
    while (fill2 !== false && visited.indexOf(fill2) === -1) {
      if (!isNumberFinite(fill2)) {
        return fill2;
      }
      target = sources[fill2];
      if (!target) {
        return false;
      }
      if (target.visible) {
        return fill2;
      }
      visited.push(fill2);
      fill2 = target.fill;
    }
    return false;
  }
  function _decodeFill(line, index2, count) {
    const fill2 = parseFillOption(line);
    if (isObject(fill2)) {
      return isNaN(fill2.value) ? false : fill2;
    }
    let target = parseFloat(fill2);
    if (isNumberFinite(target) && Math.floor(target) === target) {
      return decodeTargetIndex(fill2[0], index2, target, count);
    }
    return [
      "origin",
      "start",
      "end",
      "stack",
      "shape"
    ].indexOf(fill2) >= 0 && fill2;
  }
  function decodeTargetIndex(firstCh, index2, target, count) {
    if (firstCh === "-" || firstCh === "+") {
      target = index2 + target;
    }
    if (target === index2 || target < 0 || target >= count) {
      return false;
    }
    return target;
  }
  function _getTargetPixel(fill2, scale) {
    let pixel = null;
    if (fill2 === "start") {
      pixel = scale.bottom;
    } else if (fill2 === "end") {
      pixel = scale.top;
    } else if (isObject(fill2)) {
      pixel = scale.getPixelForValue(fill2.value);
    } else if (scale.getBasePixel) {
      pixel = scale.getBasePixel();
    }
    return pixel;
  }
  function _getTargetValue(fill2, scale, startValue) {
    let value;
    if (fill2 === "start") {
      value = startValue;
    } else if (fill2 === "end") {
      value = scale.options.reverse ? scale.min : scale.max;
    } else if (isObject(fill2)) {
      value = fill2.value;
    } else {
      value = scale.getBaseValue();
    }
    return value;
  }
  function parseFillOption(line) {
    const options = line.options;
    const fillOption = options.fill;
    let fill2 = valueOrDefault(fillOption && fillOption.target, fillOption);
    if (fill2 === void 0) {
      fill2 = !!options.backgroundColor;
    }
    if (fill2 === false || fill2 === null) {
      return false;
    }
    if (fill2 === true) {
      return "origin";
    }
    return fill2;
  }
  function _buildStackLine(source) {
    const { scale, index: index2, line } = source;
    const points = [];
    const segments = line.segments;
    const sourcePoints = line.points;
    const linesBelow = getLinesBelow(scale, index2);
    linesBelow.push(_createBoundaryLine({
      x: null,
      y: scale.bottom
    }, line));
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      for (let j = segment.start; j <= segment.end; j++) {
        addPointsBelow(points, sourcePoints[j], linesBelow);
      }
    }
    return new LineElement({
      points,
      options: {}
    });
  }
  function getLinesBelow(scale, index2) {
    const below = [];
    const metas = scale.getMatchingVisibleMetas("line");
    for (let i = 0; i < metas.length; i++) {
      const meta = metas[i];
      if (meta.index === index2) {
        break;
      }
      if (!meta.hidden) {
        below.unshift(meta.dataset);
      }
    }
    return below;
  }
  function addPointsBelow(points, sourcePoint, linesBelow) {
    const postponed = [];
    for (let j = 0; j < linesBelow.length; j++) {
      const line = linesBelow[j];
      const { first, last, point } = findPoint(line, sourcePoint, "x");
      if (!point || first && last) {
        continue;
      }
      if (first) {
        postponed.unshift(point);
      } else {
        points.push(point);
        if (!last) {
          break;
        }
      }
    }
    points.push(...postponed);
  }
  function findPoint(line, sourcePoint, property) {
    const point = line.interpolate(sourcePoint, property);
    if (!point) {
      return {};
    }
    const pointValue = point[property];
    const segments = line.segments;
    const linePoints = line.points;
    let first = false;
    let last = false;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const firstValue = linePoints[segment.start][property];
      const lastValue = linePoints[segment.end][property];
      if (_isBetween(pointValue, firstValue, lastValue)) {
        first = pointValue === firstValue;
        last = pointValue === lastValue;
        break;
      }
    }
    return {
      first,
      last,
      point
    };
  }
  var simpleArc = class {
    constructor(opts) {
      this.x = opts.x;
      this.y = opts.y;
      this.radius = opts.radius;
    }
    pathSegment(ctx, bounds, opts) {
      const { x, y, radius } = this;
      bounds = bounds || {
        start: 0,
        end: TAU
      };
      ctx.arc(x, y, radius, bounds.end, bounds.start, true);
      return !opts.bounds;
    }
    interpolate(point) {
      const { x, y, radius } = this;
      const angle = point.angle;
      return {
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        angle
      };
    }
  };
  function _getTarget(source) {
    const { chart, fill: fill2, line } = source;
    if (isNumberFinite(fill2)) {
      return getLineByIndex(chart, fill2);
    }
    if (fill2 === "stack") {
      return _buildStackLine(source);
    }
    if (fill2 === "shape") {
      return true;
    }
    const boundary = computeBoundary(source);
    if (boundary instanceof simpleArc) {
      return boundary;
    }
    return _createBoundaryLine(boundary, line);
  }
  function getLineByIndex(chart, index2) {
    const meta = chart.getDatasetMeta(index2);
    const visible = meta && chart.isDatasetVisible(index2);
    return visible ? meta.dataset : null;
  }
  function computeBoundary(source) {
    const scale = source.scale || {};
    if (scale.getPointPositionForValue) {
      return computeCircularBoundary(source);
    }
    return computeLinearBoundary(source);
  }
  function computeLinearBoundary(source) {
    const { scale = {}, fill: fill2 } = source;
    const pixel = _getTargetPixel(fill2, scale);
    if (isNumberFinite(pixel)) {
      const horizontal = scale.isHorizontal();
      return {
        x: horizontal ? pixel : null,
        y: horizontal ? null : pixel
      };
    }
    return null;
  }
  function computeCircularBoundary(source) {
    const { scale, fill: fill2 } = source;
    const options = scale.options;
    const length = scale.getLabels().length;
    const start = options.reverse ? scale.max : scale.min;
    const value = _getTargetValue(fill2, scale, start);
    const target = [];
    if (options.grid.circular) {
      const center = scale.getPointPositionForValue(0, start);
      return new simpleArc({
        x: center.x,
        y: center.y,
        radius: scale.getDistanceFromCenterForValue(value)
      });
    }
    for (let i = 0; i < length; ++i) {
      target.push(scale.getPointPositionForValue(i, value));
    }
    return target;
  }
  function _drawfill(ctx, source, area) {
    const target = _getTarget(source);
    const { chart, index: index2, line, scale, axis } = source;
    const lineOpts = line.options;
    const fillOption = lineOpts.fill;
    const color2 = lineOpts.backgroundColor;
    const { above = color2, below = color2 } = fillOption || {};
    const meta = chart.getDatasetMeta(index2);
    const clip = getDatasetClipArea(chart, meta);
    if (target && line.points.length) {
      clipArea(ctx, area);
      doFill(ctx, {
        line,
        target,
        above,
        below,
        area,
        scale,
        axis,
        clip
      });
      unclipArea(ctx);
    }
  }
  function doFill(ctx, cfg) {
    const { line, target, above, below, area, scale, clip } = cfg;
    const property = line._loop ? "angle" : cfg.axis;
    ctx.save();
    let fillColor = below;
    if (below !== above) {
      if (property === "x") {
        clipVertical(ctx, target, area.top);
        fill(ctx, {
          line,
          target,
          color: above,
          scale,
          property,
          clip
        });
        ctx.restore();
        ctx.save();
        clipVertical(ctx, target, area.bottom);
      } else if (property === "y") {
        clipHorizontal(ctx, target, area.left);
        fill(ctx, {
          line,
          target,
          color: below,
          scale,
          property,
          clip
        });
        ctx.restore();
        ctx.save();
        clipHorizontal(ctx, target, area.right);
        fillColor = above;
      }
    }
    fill(ctx, {
      line,
      target,
      color: fillColor,
      scale,
      property,
      clip
    });
    ctx.restore();
  }
  function clipVertical(ctx, target, clipY) {
    const { segments, points } = target;
    let first = true;
    let lineLoop = false;
    ctx.beginPath();
    for (const segment of segments) {
      const { start, end } = segment;
      const firstPoint = points[start];
      const lastPoint = points[_findSegmentEnd(start, end, points)];
      if (first) {
        ctx.moveTo(firstPoint.x, firstPoint.y);
        first = false;
      } else {
        ctx.lineTo(firstPoint.x, clipY);
        ctx.lineTo(firstPoint.x, firstPoint.y);
      }
      lineLoop = !!target.pathSegment(ctx, segment, {
        move: lineLoop
      });
      if (lineLoop) {
        ctx.closePath();
      } else {
        ctx.lineTo(lastPoint.x, clipY);
      }
    }
    ctx.lineTo(target.first().x, clipY);
    ctx.closePath();
    ctx.clip();
  }
  function clipHorizontal(ctx, target, clipX) {
    const { segments, points } = target;
    let first = true;
    let lineLoop = false;
    ctx.beginPath();
    for (const segment of segments) {
      const { start, end } = segment;
      const firstPoint = points[start];
      const lastPoint = points[_findSegmentEnd(start, end, points)];
      if (first) {
        ctx.moveTo(firstPoint.x, firstPoint.y);
        first = false;
      } else {
        ctx.lineTo(clipX, firstPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y);
      }
      lineLoop = !!target.pathSegment(ctx, segment, {
        move: lineLoop
      });
      if (lineLoop) {
        ctx.closePath();
      } else {
        ctx.lineTo(clipX, lastPoint.y);
      }
    }
    ctx.lineTo(clipX, target.first().y);
    ctx.closePath();
    ctx.clip();
  }
  function fill(ctx, cfg) {
    const { line, target, property, color: color2, scale, clip } = cfg;
    const segments = _segments(line, target, property);
    for (const { source: src, target: tgt, start, end } of segments) {
      const { style: { backgroundColor = color2 } = {} } = src;
      const notShape = target !== true;
      ctx.save();
      ctx.fillStyle = backgroundColor;
      clipBounds(ctx, scale, clip, notShape && _getBounds(property, start, end));
      ctx.beginPath();
      const lineLoop = !!line.pathSegment(ctx, src);
      let loop;
      if (notShape) {
        if (lineLoop) {
          ctx.closePath();
        } else {
          interpolatedLineTo(ctx, target, end, property);
        }
        const targetLoop = !!target.pathSegment(ctx, tgt, {
          move: lineLoop,
          reverse: true
        });
        loop = lineLoop && targetLoop;
        if (!loop) {
          interpolatedLineTo(ctx, target, start, property);
        }
      }
      ctx.closePath();
      ctx.fill(loop ? "evenodd" : "nonzero");
      ctx.restore();
    }
  }
  function clipBounds(ctx, scale, clip, bounds) {
    const chartArea = scale.chart.chartArea;
    const { property, start, end } = bounds || {};
    if (property === "x" || property === "y") {
      let left, top, right, bottom;
      if (property === "x") {
        left = start;
        top = chartArea.top;
        right = end;
        bottom = chartArea.bottom;
      } else {
        left = chartArea.left;
        top = start;
        right = chartArea.right;
        bottom = end;
      }
      ctx.beginPath();
      if (clip) {
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
    }
  }
  function interpolatedLineTo(ctx, target, point, property) {
    const interpolatedPoint = target.interpolate(point, property);
    if (interpolatedPoint) {
      ctx.lineTo(interpolatedPoint.x, interpolatedPoint.y);
    }
  }
  var index = {
    id: "filler",
    afterDatasetsUpdate(chart, _args, options) {
      const count = (chart.data.datasets || []).length;
      const sources = [];
      let meta, i, line, source;
      for (i = 0; i < count; ++i) {
        meta = chart.getDatasetMeta(i);
        line = meta.dataset;
        source = null;
        if (line && line.options && line instanceof LineElement) {
          source = {
            visible: chart.isDatasetVisible(i),
            index: i,
            fill: _decodeFill(line, i, count),
            chart,
            axis: meta.controller.options.indexAxis,
            scale: meta.vScale,
            line
          };
        }
        meta.$filler = source;
        sources.push(source);
      }
      for (i = 0; i < count; ++i) {
        source = sources[i];
        if (!source || source.fill === false) {
          continue;
        }
        source.fill = _resolveTarget(sources, i, options.propagate);
      }
    },
    beforeDraw(chart, _args, options) {
      const draw2 = options.drawTime === "beforeDraw";
      const metasets = chart.getSortedVisibleDatasetMetas();
      const area = chart.chartArea;
      for (let i = metasets.length - 1; i >= 0; --i) {
        const source = metasets[i].$filler;
        if (!source) {
          continue;
        }
        source.line.updateControlPoints(area, source.axis);
        if (draw2 && source.fill) {
          _drawfill(chart.ctx, source, area);
        }
      }
    },
    beforeDatasetsDraw(chart, _args, options) {
      if (options.drawTime !== "beforeDatasetsDraw") {
        return;
      }
      const metasets = chart.getSortedVisibleDatasetMetas();
      for (let i = metasets.length - 1; i >= 0; --i) {
        const source = metasets[i].$filler;
        if (_shouldApplyFill(source)) {
          _drawfill(chart.ctx, source, chart.chartArea);
        }
      }
    },
    beforeDatasetDraw(chart, args, options) {
      const source = args.meta.$filler;
      if (!_shouldApplyFill(source) || options.drawTime !== "beforeDatasetDraw") {
        return;
      }
      _drawfill(chart.ctx, source, chart.chartArea);
    },
    defaults: {
      propagate: true,
      drawTime: "beforeDatasetDraw"
    }
  };
  var getBoxSize = (labelOpts, fontSize) => {
    let { boxHeight = fontSize, boxWidth = fontSize } = labelOpts;
    if (labelOpts.usePointStyle) {
      boxHeight = Math.min(boxHeight, fontSize);
      boxWidth = labelOpts.pointStyleWidth || Math.min(boxWidth, fontSize);
    }
    return {
      boxWidth,
      boxHeight,
      itemHeight: Math.max(fontSize, boxHeight)
    };
  };
  var itemsEqual = (a, b) => a !== null && b !== null && a.datasetIndex === b.datasetIndex && a.index === b.index;
  var Legend = class extends Element {
    constructor(config) {
      super();
      this._added = false;
      this.legendHitBoxes = [];
      this._hoveredItem = null;
      this.doughnutMode = false;
      this.chart = config.chart;
      this.options = config.options;
      this.ctx = config.ctx;
      this.legendItems = void 0;
      this.columnSizes = void 0;
      this.lineWidths = void 0;
      this.maxHeight = void 0;
      this.maxWidth = void 0;
      this.top = void 0;
      this.bottom = void 0;
      this.left = void 0;
      this.right = void 0;
      this.height = void 0;
      this.width = void 0;
      this._margins = void 0;
      this.position = void 0;
      this.weight = void 0;
      this.fullSize = void 0;
    }
    update(maxWidth, maxHeight, margins) {
      this.maxWidth = maxWidth;
      this.maxHeight = maxHeight;
      this._margins = margins;
      this.setDimensions();
      this.buildLabels();
      this.fit();
    }
    setDimensions() {
      if (this.isHorizontal()) {
        this.width = this.maxWidth;
        this.left = this._margins.left;
        this.right = this.width;
      } else {
        this.height = this.maxHeight;
        this.top = this._margins.top;
        this.bottom = this.height;
      }
    }
    buildLabels() {
      const labelOpts = this.options.labels || {};
      let legendItems = callback(labelOpts.generateLabels, [
        this.chart
      ], this) || [];
      if (labelOpts.filter) {
        legendItems = legendItems.filter((item) => labelOpts.filter(item, this.chart.data));
      }
      if (labelOpts.sort) {
        legendItems = legendItems.sort((a, b) => labelOpts.sort(a, b, this.chart.data));
      }
      if (this.options.reverse) {
        legendItems.reverse();
      }
      this.legendItems = legendItems;
    }
    fit() {
      const { options, ctx } = this;
      if (!options.display) {
        this.width = this.height = 0;
        return;
      }
      const labelOpts = options.labels;
      const labelFont = toFont(labelOpts.font);
      const fontSize = labelFont.size;
      const titleHeight = this._computeTitleHeight();
      const { boxWidth, itemHeight } = getBoxSize(labelOpts, fontSize);
      let width, height;
      ctx.font = labelFont.string;
      if (this.isHorizontal()) {
        width = this.maxWidth;
        height = this._fitRows(titleHeight, fontSize, boxWidth, itemHeight) + 10;
      } else {
        height = this.maxHeight;
        width = this._fitCols(titleHeight, labelFont, boxWidth, itemHeight) + 10;
      }
      this.width = Math.min(width, options.maxWidth || this.maxWidth);
      this.height = Math.min(height, options.maxHeight || this.maxHeight);
    }
    _fitRows(titleHeight, fontSize, boxWidth, itemHeight) {
      const { ctx, maxWidth, options: { labels: { padding } } } = this;
      const hitboxes = this.legendHitBoxes = [];
      const lineWidths = this.lineWidths = [
        0
      ];
      const lineHeight = itemHeight + padding;
      let totalHeight = titleHeight;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      let row = -1;
      let top = -lineHeight;
      this.legendItems.forEach((legendItem, i) => {
        const itemWidth = boxWidth + fontSize / 2 + ctx.measureText(legendItem.text).width;
        if (i === 0 || lineWidths[lineWidths.length - 1] + itemWidth + 2 * padding > maxWidth) {
          totalHeight += lineHeight;
          lineWidths[lineWidths.length - (i > 0 ? 0 : 1)] = 0;
          top += lineHeight;
          row++;
        }
        hitboxes[i] = {
          left: 0,
          top,
          row,
          width: itemWidth,
          height: itemHeight
        };
        lineWidths[lineWidths.length - 1] += itemWidth + padding;
      });
      return totalHeight;
    }
    _fitCols(titleHeight, labelFont, boxWidth, _itemHeight) {
      const { ctx, maxHeight, options: { labels: { padding } } } = this;
      const hitboxes = this.legendHitBoxes = [];
      const columnSizes = this.columnSizes = [];
      const heightLimit = maxHeight - titleHeight;
      let totalWidth = padding;
      let currentColWidth = 0;
      let currentColHeight = 0;
      let left = 0;
      let col = 0;
      this.legendItems.forEach((legendItem, i) => {
        const { itemWidth, itemHeight } = calculateItemSize(boxWidth, labelFont, ctx, legendItem, _itemHeight);
        if (i > 0 && currentColHeight + itemHeight + 2 * padding > heightLimit) {
          totalWidth += currentColWidth + padding;
          columnSizes.push({
            width: currentColWidth,
            height: currentColHeight
          });
          left += currentColWidth + padding;
          col++;
          currentColWidth = currentColHeight = 0;
        }
        hitboxes[i] = {
          left,
          top: currentColHeight,
          col,
          width: itemWidth,
          height: itemHeight
        };
        currentColWidth = Math.max(currentColWidth, itemWidth);
        currentColHeight += itemHeight + padding;
      });
      totalWidth += currentColWidth;
      columnSizes.push({
        width: currentColWidth,
        height: currentColHeight
      });
      return totalWidth;
    }
    adjustHitBoxes() {
      if (!this.options.display) {
        return;
      }
      const titleHeight = this._computeTitleHeight();
      const { legendHitBoxes: hitboxes, options: { align, labels: { padding }, rtl } } = this;
      const rtlHelper = getRtlAdapter(rtl, this.left, this.width);
      if (this.isHorizontal()) {
        let row = 0;
        let left = _alignStartEnd(align, this.left + padding, this.right - this.lineWidths[row]);
        for (const hitbox of hitboxes) {
          if (row !== hitbox.row) {
            row = hitbox.row;
            left = _alignStartEnd(align, this.left + padding, this.right - this.lineWidths[row]);
          }
          hitbox.top += this.top + titleHeight + padding;
          hitbox.left = rtlHelper.leftForLtr(rtlHelper.x(left), hitbox.width);
          left += hitbox.width + padding;
        }
      } else {
        let col = 0;
        let top = _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - this.columnSizes[col].height);
        for (const hitbox of hitboxes) {
          if (hitbox.col !== col) {
            col = hitbox.col;
            top = _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - this.columnSizes[col].height);
          }
          hitbox.top = top;
          hitbox.left += this.left + padding;
          hitbox.left = rtlHelper.leftForLtr(rtlHelper.x(hitbox.left), hitbox.width);
          top += hitbox.height + padding;
        }
      }
    }
    isHorizontal() {
      return this.options.position === "top" || this.options.position === "bottom";
    }
    draw() {
      if (this.options.display) {
        const ctx = this.ctx;
        clipArea(ctx, this);
        this._draw();
        unclipArea(ctx);
      }
    }
    _draw() {
      const { options: opts, columnSizes, lineWidths, ctx } = this;
      const { align, labels: labelOpts } = opts;
      const defaultColor = defaults.color;
      const rtlHelper = getRtlAdapter(opts.rtl, this.left, this.width);
      const labelFont = toFont(labelOpts.font);
      const { padding } = labelOpts;
      const fontSize = labelFont.size;
      const halfFontSize = fontSize / 2;
      let cursor;
      this.drawTitle();
      ctx.textAlign = rtlHelper.textAlign("left");
      ctx.textBaseline = "middle";
      ctx.lineWidth = 0.5;
      ctx.font = labelFont.string;
      const { boxWidth, boxHeight, itemHeight } = getBoxSize(labelOpts, fontSize);
      const drawLegendBox = function(x, y, legendItem) {
        if (isNaN(boxWidth) || boxWidth <= 0 || isNaN(boxHeight) || boxHeight < 0) {
          return;
        }
        ctx.save();
        const lineWidth = valueOrDefault(legendItem.lineWidth, 1);
        ctx.fillStyle = valueOrDefault(legendItem.fillStyle, defaultColor);
        ctx.lineCap = valueOrDefault(legendItem.lineCap, "butt");
        ctx.lineDashOffset = valueOrDefault(legendItem.lineDashOffset, 0);
        ctx.lineJoin = valueOrDefault(legendItem.lineJoin, "miter");
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = valueOrDefault(legendItem.strokeStyle, defaultColor);
        ctx.setLineDash(valueOrDefault(legendItem.lineDash, []));
        if (labelOpts.usePointStyle) {
          const drawOptions = {
            radius: boxHeight * Math.SQRT2 / 2,
            pointStyle: legendItem.pointStyle,
            rotation: legendItem.rotation,
            borderWidth: lineWidth
          };
          const centerX = rtlHelper.xPlus(x, boxWidth / 2);
          const centerY = y + halfFontSize;
          drawPointLegend(ctx, drawOptions, centerX, centerY, labelOpts.pointStyleWidth && boxWidth);
        } else {
          const yBoxTop = y + Math.max((fontSize - boxHeight) / 2, 0);
          const xBoxLeft = rtlHelper.leftForLtr(x, boxWidth);
          const borderRadius = toTRBLCorners(legendItem.borderRadius);
          ctx.beginPath();
          if (Object.values(borderRadius).some((v) => v !== 0)) {
            addRoundedRectPath(ctx, {
              x: xBoxLeft,
              y: yBoxTop,
              w: boxWidth,
              h: boxHeight,
              radius: borderRadius
            });
          } else {
            ctx.rect(xBoxLeft, yBoxTop, boxWidth, boxHeight);
          }
          ctx.fill();
          if (lineWidth !== 0) {
            ctx.stroke();
          }
        }
        ctx.restore();
      };
      const fillText = function(x, y, legendItem) {
        renderText(ctx, legendItem.text, x, y + itemHeight / 2, labelFont, {
          strikethrough: legendItem.hidden,
          textAlign: rtlHelper.textAlign(legendItem.textAlign)
        });
      };
      const isHorizontal = this.isHorizontal();
      const titleHeight = this._computeTitleHeight();
      if (isHorizontal) {
        cursor = {
          x: _alignStartEnd(align, this.left + padding, this.right - lineWidths[0]),
          y: this.top + padding + titleHeight,
          line: 0
        };
      } else {
        cursor = {
          x: this.left + padding,
          y: _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - columnSizes[0].height),
          line: 0
        };
      }
      overrideTextDirection(this.ctx, opts.textDirection);
      const lineHeight = itemHeight + padding;
      this.legendItems.forEach((legendItem, i) => {
        ctx.strokeStyle = legendItem.fontColor;
        ctx.fillStyle = legendItem.fontColor;
        const textWidth = ctx.measureText(legendItem.text).width;
        const textAlign = rtlHelper.textAlign(legendItem.textAlign || (legendItem.textAlign = labelOpts.textAlign));
        const width = boxWidth + halfFontSize + textWidth;
        let x = cursor.x;
        let y = cursor.y;
        rtlHelper.setWidth(this.width);
        if (isHorizontal) {
          if (i > 0 && x + width + padding > this.right) {
            y = cursor.y += lineHeight;
            cursor.line++;
            x = cursor.x = _alignStartEnd(align, this.left + padding, this.right - lineWidths[cursor.line]);
          }
        } else if (i > 0 && y + lineHeight > this.bottom) {
          x = cursor.x = x + columnSizes[cursor.line].width + padding;
          cursor.line++;
          y = cursor.y = _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - columnSizes[cursor.line].height);
        }
        const realX = rtlHelper.x(x);
        drawLegendBox(realX, y, legendItem);
        x = _textX(textAlign, x + boxWidth + halfFontSize, isHorizontal ? x + width : this.right, opts.rtl);
        fillText(rtlHelper.x(x), y, legendItem);
        if (isHorizontal) {
          cursor.x += width + padding;
        } else if (typeof legendItem.text !== "string") {
          const fontLineHeight = labelFont.lineHeight;
          cursor.y += calculateLegendItemHeight(legendItem, fontLineHeight) + padding;
        } else {
          cursor.y += lineHeight;
        }
      });
      restoreTextDirection(this.ctx, opts.textDirection);
    }
    drawTitle() {
      const opts = this.options;
      const titleOpts = opts.title;
      const titleFont = toFont(titleOpts.font);
      const titlePadding = toPadding(titleOpts.padding);
      if (!titleOpts.display) {
        return;
      }
      const rtlHelper = getRtlAdapter(opts.rtl, this.left, this.width);
      const ctx = this.ctx;
      const position = titleOpts.position;
      const halfFontSize = titleFont.size / 2;
      const topPaddingPlusHalfFontSize = titlePadding.top + halfFontSize;
      let y;
      let left = this.left;
      let maxWidth = this.width;
      if (this.isHorizontal()) {
        maxWidth = Math.max(...this.lineWidths);
        y = this.top + topPaddingPlusHalfFontSize;
        left = _alignStartEnd(opts.align, left, this.right - maxWidth);
      } else {
        const maxHeight = this.columnSizes.reduce((acc, size) => Math.max(acc, size.height), 0);
        y = topPaddingPlusHalfFontSize + _alignStartEnd(opts.align, this.top, this.bottom - maxHeight - opts.labels.padding - this._computeTitleHeight());
      }
      const x = _alignStartEnd(position, left, left + maxWidth);
      ctx.textAlign = rtlHelper.textAlign(_toLeftRightCenter(position));
      ctx.textBaseline = "middle";
      ctx.strokeStyle = titleOpts.color;
      ctx.fillStyle = titleOpts.color;
      ctx.font = titleFont.string;
      renderText(ctx, titleOpts.text, x, y, titleFont);
    }
    _computeTitleHeight() {
      const titleOpts = this.options.title;
      const titleFont = toFont(titleOpts.font);
      const titlePadding = toPadding(titleOpts.padding);
      return titleOpts.display ? titleFont.lineHeight + titlePadding.height : 0;
    }
    _getLegendItemAt(x, y) {
      let i, hitBox, lh;
      if (_isBetween(x, this.left, this.right) && _isBetween(y, this.top, this.bottom)) {
        lh = this.legendHitBoxes;
        for (i = 0; i < lh.length; ++i) {
          hitBox = lh[i];
          if (_isBetween(x, hitBox.left, hitBox.left + hitBox.width) && _isBetween(y, hitBox.top, hitBox.top + hitBox.height)) {
            return this.legendItems[i];
          }
        }
      }
      return null;
    }
    handleEvent(e) {
      const opts = this.options;
      if (!isListened(e.type, opts)) {
        return;
      }
      const hoveredItem = this._getLegendItemAt(e.x, e.y);
      if (e.type === "mousemove" || e.type === "mouseout") {
        const previous = this._hoveredItem;
        const sameItem = itemsEqual(previous, hoveredItem);
        if (previous && !sameItem) {
          callback(opts.onLeave, [
            e,
            previous,
            this
          ], this);
        }
        this._hoveredItem = hoveredItem;
        if (hoveredItem && !sameItem) {
          callback(opts.onHover, [
            e,
            hoveredItem,
            this
          ], this);
        }
      } else if (hoveredItem) {
        callback(opts.onClick, [
          e,
          hoveredItem,
          this
        ], this);
      }
    }
  };
  function calculateItemSize(boxWidth, labelFont, ctx, legendItem, _itemHeight) {
    const itemWidth = calculateItemWidth(legendItem, boxWidth, labelFont, ctx);
    const itemHeight = calculateItemHeight(_itemHeight, legendItem, labelFont.lineHeight);
    return {
      itemWidth,
      itemHeight
    };
  }
  function calculateItemWidth(legendItem, boxWidth, labelFont, ctx) {
    let legendItemText = legendItem.text;
    if (legendItemText && typeof legendItemText !== "string") {
      legendItemText = legendItemText.reduce((a, b) => a.length > b.length ? a : b);
    }
    return boxWidth + labelFont.size / 2 + ctx.measureText(legendItemText).width;
  }
  function calculateItemHeight(_itemHeight, legendItem, fontLineHeight) {
    let itemHeight = _itemHeight;
    if (typeof legendItem.text !== "string") {
      itemHeight = calculateLegendItemHeight(legendItem, fontLineHeight);
    }
    return itemHeight;
  }
  function calculateLegendItemHeight(legendItem, fontLineHeight) {
    const labelHeight = legendItem.text ? legendItem.text.length : 0;
    return fontLineHeight * labelHeight;
  }
  function isListened(type, opts) {
    if ((type === "mousemove" || type === "mouseout") && (opts.onHover || opts.onLeave)) {
      return true;
    }
    if (opts.onClick && (type === "click" || type === "mouseup")) {
      return true;
    }
    return false;
  }
  var plugin_legend = {
    id: "legend",
    _element: Legend,
    start(chart, _args, options) {
      const legend = chart.legend = new Legend({
        ctx: chart.ctx,
        options,
        chart
      });
      layouts.configure(chart, legend, options);
      layouts.addBox(chart, legend);
    },
    stop(chart) {
      layouts.removeBox(chart, chart.legend);
      delete chart.legend;
    },
    beforeUpdate(chart, _args, options) {
      const legend = chart.legend;
      layouts.configure(chart, legend, options);
      legend.options = options;
    },
    afterUpdate(chart) {
      const legend = chart.legend;
      legend.buildLabels();
      legend.adjustHitBoxes();
    },
    afterEvent(chart, args) {
      if (!args.replay) {
        chart.legend.handleEvent(args.event);
      }
    },
    defaults: {
      display: true,
      position: "top",
      align: "center",
      fullSize: true,
      reverse: false,
      weight: 1e3,
      onClick(e, legendItem, legend) {
        const index2 = legendItem.datasetIndex;
        const ci = legend.chart;
        if (ci.isDatasetVisible(index2)) {
          ci.hide(index2);
          legendItem.hidden = true;
        } else {
          ci.show(index2);
          legendItem.hidden = false;
        }
      },
      onHover: null,
      onLeave: null,
      labels: {
        color: (ctx) => ctx.chart.options.color,
        boxWidth: 40,
        padding: 10,
        generateLabels(chart) {
          const datasets = chart.data.datasets;
          const { labels: { usePointStyle, pointStyle, textAlign, color: color2, useBorderRadius, borderRadius } } = chart.legend.options;
          return chart._getSortedDatasetMetas().map((meta) => {
            const style = meta.controller.getStyle(usePointStyle ? 0 : void 0);
            const borderWidth = toPadding(style.borderWidth);
            return {
              text: datasets[meta.index].label,
              fillStyle: style.backgroundColor,
              fontColor: color2,
              hidden: !meta.visible,
              lineCap: style.borderCapStyle,
              lineDash: style.borderDash,
              lineDashOffset: style.borderDashOffset,
              lineJoin: style.borderJoinStyle,
              lineWidth: (borderWidth.width + borderWidth.height) / 4,
              strokeStyle: style.borderColor,
              pointStyle: pointStyle || style.pointStyle,
              rotation: style.rotation,
              textAlign: textAlign || style.textAlign,
              borderRadius: useBorderRadius && (borderRadius || style.borderRadius),
              datasetIndex: meta.index
            };
          }, this);
        }
      },
      title: {
        color: (ctx) => ctx.chart.options.color,
        display: false,
        position: "center",
        text: ""
      }
    },
    descriptors: {
      _scriptable: (name) => !name.startsWith("on"),
      labels: {
        _scriptable: (name) => ![
          "generateLabels",
          "filter",
          "sort"
        ].includes(name)
      }
    }
  };
  var Title = class extends Element {
    constructor(config) {
      super();
      this.chart = config.chart;
      this.options = config.options;
      this.ctx = config.ctx;
      this._padding = void 0;
      this.top = void 0;
      this.bottom = void 0;
      this.left = void 0;
      this.right = void 0;
      this.width = void 0;
      this.height = void 0;
      this.position = void 0;
      this.weight = void 0;
      this.fullSize = void 0;
    }
    update(maxWidth, maxHeight) {
      const opts = this.options;
      this.left = 0;
      this.top = 0;
      if (!opts.display) {
        this.width = this.height = this.right = this.bottom = 0;
        return;
      }
      this.width = this.right = maxWidth;
      this.height = this.bottom = maxHeight;
      const lineCount = isArray(opts.text) ? opts.text.length : 1;
      this._padding = toPadding(opts.padding);
      const textSize = lineCount * toFont(opts.font).lineHeight + this._padding.height;
      if (this.isHorizontal()) {
        this.height = textSize;
      } else {
        this.width = textSize;
      }
    }
    isHorizontal() {
      const pos = this.options.position;
      return pos === "top" || pos === "bottom";
    }
    _drawArgs(offset) {
      const { top, left, bottom, right, options } = this;
      const align = options.align;
      let rotation = 0;
      let maxWidth, titleX, titleY;
      if (this.isHorizontal()) {
        titleX = _alignStartEnd(align, left, right);
        titleY = top + offset;
        maxWidth = right - left;
      } else {
        if (options.position === "left") {
          titleX = left + offset;
          titleY = _alignStartEnd(align, bottom, top);
          rotation = PI * -0.5;
        } else {
          titleX = right - offset;
          titleY = _alignStartEnd(align, top, bottom);
          rotation = PI * 0.5;
        }
        maxWidth = bottom - top;
      }
      return {
        titleX,
        titleY,
        maxWidth,
        rotation
      };
    }
    draw() {
      const ctx = this.ctx;
      const opts = this.options;
      if (!opts.display) {
        return;
      }
      const fontOpts = toFont(opts.font);
      const lineHeight = fontOpts.lineHeight;
      const offset = lineHeight / 2 + this._padding.top;
      const { titleX, titleY, maxWidth, rotation } = this._drawArgs(offset);
      renderText(ctx, opts.text, 0, 0, fontOpts, {
        color: opts.color,
        maxWidth,
        rotation,
        textAlign: _toLeftRightCenter(opts.align),
        textBaseline: "middle",
        translation: [
          titleX,
          titleY
        ]
      });
    }
  };
  function createTitle(chart, titleOpts) {
    const title = new Title({
      ctx: chart.ctx,
      options: titleOpts,
      chart
    });
    layouts.configure(chart, title, titleOpts);
    layouts.addBox(chart, title);
    chart.titleBlock = title;
  }
  var plugin_title = {
    id: "title",
    _element: Title,
    start(chart, _args, options) {
      createTitle(chart, options);
    },
    stop(chart) {
      const titleBlock = chart.titleBlock;
      layouts.removeBox(chart, titleBlock);
      delete chart.titleBlock;
    },
    beforeUpdate(chart, _args, options) {
      const title = chart.titleBlock;
      layouts.configure(chart, title, options);
      title.options = options;
    },
    defaults: {
      align: "center",
      display: false,
      font: {
        weight: "bold"
      },
      fullSize: true,
      padding: 10,
      position: "top",
      text: "",
      weight: 2e3
    },
    defaultRoutes: {
      color: "color"
    },
    descriptors: {
      _scriptable: true,
      _indexable: false
    }
  };
  var positioners = {
    average(items) {
      if (!items.length) {
        return false;
      }
      let i, len;
      let xSet = /* @__PURE__ */ new Set();
      let y = 0;
      let count = 0;
      for (i = 0, len = items.length; i < len; ++i) {
        const el = items[i].element;
        if (el && el.hasValue()) {
          const pos = el.tooltipPosition();
          xSet.add(pos.x);
          y += pos.y;
          ++count;
        }
      }
      if (count === 0 || xSet.size === 0) {
        return false;
      }
      const xAverage = [
        ...xSet
      ].reduce((a, b) => a + b) / xSet.size;
      return {
        x: xAverage,
        y: y / count
      };
    },
    nearest(items, eventPosition) {
      if (!items.length) {
        return false;
      }
      let x = eventPosition.x;
      let y = eventPosition.y;
      let minDistance = Number.POSITIVE_INFINITY;
      let i, len, nearestElement;
      for (i = 0, len = items.length; i < len; ++i) {
        const el = items[i].element;
        if (el && el.hasValue()) {
          const center = el.getCenterPoint();
          const d = distanceBetweenPoints(eventPosition, center);
          if (d < minDistance) {
            minDistance = d;
            nearestElement = el;
          }
        }
      }
      if (nearestElement) {
        const tp = nearestElement.tooltipPosition();
        x = tp.x;
        y = tp.y;
      }
      return {
        x,
        y
      };
    }
  };
  function pushOrConcat(base, toPush) {
    if (toPush) {
      if (isArray(toPush)) {
        Array.prototype.push.apply(base, toPush);
      } else {
        base.push(toPush);
      }
    }
    return base;
  }
  function splitNewlines(str) {
    if ((typeof str === "string" || str instanceof String) && str.indexOf("\n") > -1) {
      return str.split("\n");
    }
    return str;
  }
  function createTooltipItem(chart, item) {
    const { element, datasetIndex, index: index2 } = item;
    const controller = chart.getDatasetMeta(datasetIndex).controller;
    const { label, value } = controller.getLabelAndValue(index2);
    return {
      chart,
      label,
      parsed: controller.getParsed(index2),
      raw: chart.data.datasets[datasetIndex].data[index2],
      formattedValue: value,
      dataset: controller.getDataset(),
      dataIndex: index2,
      datasetIndex,
      element
    };
  }
  function getTooltipSize(tooltip, options) {
    const ctx = tooltip.chart.ctx;
    const { body, footer, title } = tooltip;
    const { boxWidth, boxHeight } = options;
    const bodyFont = toFont(options.bodyFont);
    const titleFont = toFont(options.titleFont);
    const footerFont = toFont(options.footerFont);
    const titleLineCount = title.length;
    const footerLineCount = footer.length;
    const bodyLineItemCount = body.length;
    const padding = toPadding(options.padding);
    let height = padding.height;
    let width = 0;
    let combinedBodyLength = body.reduce((count, bodyItem) => count + bodyItem.before.length + bodyItem.lines.length + bodyItem.after.length, 0);
    combinedBodyLength += tooltip.beforeBody.length + tooltip.afterBody.length;
    if (titleLineCount) {
      height += titleLineCount * titleFont.lineHeight + (titleLineCount - 1) * options.titleSpacing + options.titleMarginBottom;
    }
    if (combinedBodyLength) {
      const bodyLineHeight = options.displayColors ? Math.max(boxHeight, bodyFont.lineHeight) : bodyFont.lineHeight;
      height += bodyLineItemCount * bodyLineHeight + (combinedBodyLength - bodyLineItemCount) * bodyFont.lineHeight + (combinedBodyLength - 1) * options.bodySpacing;
    }
    if (footerLineCount) {
      height += options.footerMarginTop + footerLineCount * footerFont.lineHeight + (footerLineCount - 1) * options.footerSpacing;
    }
    let widthPadding = 0;
    const maxLineWidth = function(line) {
      width = Math.max(width, ctx.measureText(line).width + widthPadding);
    };
    ctx.save();
    ctx.font = titleFont.string;
    each(tooltip.title, maxLineWidth);
    ctx.font = bodyFont.string;
    each(tooltip.beforeBody.concat(tooltip.afterBody), maxLineWidth);
    widthPadding = options.displayColors ? boxWidth + 2 + options.boxPadding : 0;
    each(body, (bodyItem) => {
      each(bodyItem.before, maxLineWidth);
      each(bodyItem.lines, maxLineWidth);
      each(bodyItem.after, maxLineWidth);
    });
    widthPadding = 0;
    ctx.font = footerFont.string;
    each(tooltip.footer, maxLineWidth);
    ctx.restore();
    width += padding.width;
    return {
      width,
      height
    };
  }
  function determineYAlign(chart, size) {
    const { y, height } = size;
    if (y < height / 2) {
      return "top";
    } else if (y > chart.height - height / 2) {
      return "bottom";
    }
    return "center";
  }
  function doesNotFitWithAlign(xAlign, chart, options, size) {
    const { x, width } = size;
    const caret = options.caretSize + options.caretPadding;
    if (xAlign === "left" && x + width + caret > chart.width) {
      return true;
    }
    if (xAlign === "right" && x - width - caret < 0) {
      return true;
    }
  }
  function determineXAlign(chart, options, size, yAlign) {
    const { x, width } = size;
    const { width: chartWidth, chartArea: { left, right } } = chart;
    let xAlign = "center";
    if (yAlign === "center") {
      xAlign = x <= (left + right) / 2 ? "left" : "right";
    } else if (x <= width / 2) {
      xAlign = "left";
    } else if (x >= chartWidth - width / 2) {
      xAlign = "right";
    }
    if (doesNotFitWithAlign(xAlign, chart, options, size)) {
      xAlign = "center";
    }
    return xAlign;
  }
  function determineAlignment(chart, options, size) {
    const yAlign = size.yAlign || options.yAlign || determineYAlign(chart, size);
    return {
      xAlign: size.xAlign || options.xAlign || determineXAlign(chart, options, size, yAlign),
      yAlign
    };
  }
  function alignX(size, xAlign) {
    let { x, width } = size;
    if (xAlign === "right") {
      x -= width;
    } else if (xAlign === "center") {
      x -= width / 2;
    }
    return x;
  }
  function alignY(size, yAlign, paddingAndSize) {
    let { y, height } = size;
    if (yAlign === "top") {
      y += paddingAndSize;
    } else if (yAlign === "bottom") {
      y -= height + paddingAndSize;
    } else {
      y -= height / 2;
    }
    return y;
  }
  function getBackgroundPoint(options, size, alignment, chart) {
    const { caretSize, caretPadding, cornerRadius } = options;
    const { xAlign, yAlign } = alignment;
    const paddingAndSize = caretSize + caretPadding;
    const { topLeft, topRight, bottomLeft, bottomRight } = toTRBLCorners(cornerRadius);
    let x = alignX(size, xAlign);
    const y = alignY(size, yAlign, paddingAndSize);
    if (yAlign === "center") {
      if (xAlign === "left") {
        x += paddingAndSize;
      } else if (xAlign === "right") {
        x -= paddingAndSize;
      }
    } else if (xAlign === "left") {
      x -= Math.max(topLeft, bottomLeft) + caretSize;
    } else if (xAlign === "right") {
      x += Math.max(topRight, bottomRight) + caretSize;
    }
    return {
      x: _limitValue(x, 0, chart.width - size.width),
      y: _limitValue(y, 0, chart.height - size.height)
    };
  }
  function getAlignedX(tooltip, align, options) {
    const padding = toPadding(options.padding);
    return align === "center" ? tooltip.x + tooltip.width / 2 : align === "right" ? tooltip.x + tooltip.width - padding.right : tooltip.x + padding.left;
  }
  function getBeforeAfterBodyLines(callback2) {
    return pushOrConcat([], splitNewlines(callback2));
  }
  function createTooltipContext(parent, tooltip, tooltipItems) {
    return createContext(parent, {
      tooltip,
      tooltipItems,
      type: "tooltip"
    });
  }
  function overrideCallbacks(callbacks, context) {
    const override = context && context.dataset && context.dataset.tooltip && context.dataset.tooltip.callbacks;
    return override ? callbacks.override(override) : callbacks;
  }
  var defaultCallbacks = {
    beforeTitle: noop,
    title(tooltipItems) {
      if (tooltipItems.length > 0) {
        const item = tooltipItems[0];
        const labels = item.chart.data.labels;
        const labelCount = labels ? labels.length : 0;
        if (this && this.options && this.options.mode === "dataset") {
          return item.dataset.label || "";
        } else if (item.label) {
          return item.label;
        } else if (labelCount > 0 && item.dataIndex < labelCount) {
          return labels[item.dataIndex];
        }
      }
      return "";
    },
    afterTitle: noop,
    beforeBody: noop,
    beforeLabel: noop,
    label(tooltipItem) {
      if (this && this.options && this.options.mode === "dataset") {
        return tooltipItem.label + ": " + tooltipItem.formattedValue || tooltipItem.formattedValue;
      }
      let label = tooltipItem.dataset.label || "";
      if (label) {
        label += ": ";
      }
      const value = tooltipItem.formattedValue;
      if (!isNullOrUndef(value)) {
        label += value;
      }
      return label;
    },
    labelColor(tooltipItem) {
      const meta = tooltipItem.chart.getDatasetMeta(tooltipItem.datasetIndex);
      const options = meta.controller.getStyle(tooltipItem.dataIndex);
      return {
        borderColor: options.borderColor,
        backgroundColor: options.backgroundColor,
        borderWidth: options.borderWidth,
        borderDash: options.borderDash,
        borderDashOffset: options.borderDashOffset,
        borderRadius: 0
      };
    },
    labelTextColor() {
      return this.options.bodyColor;
    },
    labelPointStyle(tooltipItem) {
      const meta = tooltipItem.chart.getDatasetMeta(tooltipItem.datasetIndex);
      const options = meta.controller.getStyle(tooltipItem.dataIndex);
      return {
        pointStyle: options.pointStyle,
        rotation: options.rotation
      };
    },
    afterLabel: noop,
    afterBody: noop,
    beforeFooter: noop,
    footer: noop,
    afterFooter: noop
  };
  function invokeCallbackWithFallback(callbacks, name, ctx, arg) {
    const result = callbacks[name].call(ctx, arg);
    if (typeof result === "undefined") {
      return defaultCallbacks[name].call(ctx, arg);
    }
    return result;
  }
  var Tooltip = class extends Element {
    constructor(config) {
      super();
      this.opacity = 0;
      this._active = [];
      this._eventPosition = void 0;
      this._size = void 0;
      this._cachedAnimations = void 0;
      this._tooltipItems = [];
      this.$animations = void 0;
      this.$context = void 0;
      this.chart = config.chart;
      this.options = config.options;
      this.dataPoints = void 0;
      this.title = void 0;
      this.beforeBody = void 0;
      this.body = void 0;
      this.afterBody = void 0;
      this.footer = void 0;
      this.xAlign = void 0;
      this.yAlign = void 0;
      this.x = void 0;
      this.y = void 0;
      this.height = void 0;
      this.width = void 0;
      this.caretX = void 0;
      this.caretY = void 0;
      this.labelColors = void 0;
      this.labelPointStyles = void 0;
      this.labelTextColors = void 0;
    }
    initialize(options) {
      this.options = options;
      this._cachedAnimations = void 0;
      this.$context = void 0;
    }
    _resolveAnimations() {
      const cached = this._cachedAnimations;
      if (cached) {
        return cached;
      }
      const chart = this.chart;
      const options = this.options.setContext(this.getContext());
      const opts = options.enabled && chart.options.animation && options.animations;
      const animations = new Animations(this.chart, opts);
      if (opts._cacheable) {
        this._cachedAnimations = Object.freeze(animations);
      }
      return animations;
    }
    getContext() {
      return this.$context || (this.$context = createTooltipContext(this.chart.getContext(), this, this._tooltipItems));
    }
    getTitle(context, options) {
      const { callbacks } = options;
      const beforeTitle = invokeCallbackWithFallback(callbacks, "beforeTitle", this, context);
      const title = invokeCallbackWithFallback(callbacks, "title", this, context);
      const afterTitle = invokeCallbackWithFallback(callbacks, "afterTitle", this, context);
      let lines = [];
      lines = pushOrConcat(lines, splitNewlines(beforeTitle));
      lines = pushOrConcat(lines, splitNewlines(title));
      lines = pushOrConcat(lines, splitNewlines(afterTitle));
      return lines;
    }
    getBeforeBody(tooltipItems, options) {
      return getBeforeAfterBodyLines(invokeCallbackWithFallback(options.callbacks, "beforeBody", this, tooltipItems));
    }
    getBody(tooltipItems, options) {
      const { callbacks } = options;
      const bodyItems = [];
      each(tooltipItems, (context) => {
        const bodyItem = {
          before: [],
          lines: [],
          after: []
        };
        const scoped = overrideCallbacks(callbacks, context);
        pushOrConcat(bodyItem.before, splitNewlines(invokeCallbackWithFallback(scoped, "beforeLabel", this, context)));
        pushOrConcat(bodyItem.lines, invokeCallbackWithFallback(scoped, "label", this, context));
        pushOrConcat(bodyItem.after, splitNewlines(invokeCallbackWithFallback(scoped, "afterLabel", this, context)));
        bodyItems.push(bodyItem);
      });
      return bodyItems;
    }
    getAfterBody(tooltipItems, options) {
      return getBeforeAfterBodyLines(invokeCallbackWithFallback(options.callbacks, "afterBody", this, tooltipItems));
    }
    getFooter(tooltipItems, options) {
      const { callbacks } = options;
      const beforeFooter = invokeCallbackWithFallback(callbacks, "beforeFooter", this, tooltipItems);
      const footer = invokeCallbackWithFallback(callbacks, "footer", this, tooltipItems);
      const afterFooter = invokeCallbackWithFallback(callbacks, "afterFooter", this, tooltipItems);
      let lines = [];
      lines = pushOrConcat(lines, splitNewlines(beforeFooter));
      lines = pushOrConcat(lines, splitNewlines(footer));
      lines = pushOrConcat(lines, splitNewlines(afterFooter));
      return lines;
    }
    _createItems(options) {
      const active = this._active;
      const data = this.chart.data;
      const labelColors = [];
      const labelPointStyles = [];
      const labelTextColors = [];
      let tooltipItems = [];
      let i, len;
      for (i = 0, len = active.length; i < len; ++i) {
        tooltipItems.push(createTooltipItem(this.chart, active[i]));
      }
      if (options.filter) {
        tooltipItems = tooltipItems.filter((element, index2, array) => options.filter(element, index2, array, data));
      }
      if (options.itemSort) {
        tooltipItems = tooltipItems.sort((a, b) => options.itemSort(a, b, data));
      }
      each(tooltipItems, (context) => {
        const scoped = overrideCallbacks(options.callbacks, context);
        labelColors.push(invokeCallbackWithFallback(scoped, "labelColor", this, context));
        labelPointStyles.push(invokeCallbackWithFallback(scoped, "labelPointStyle", this, context));
        labelTextColors.push(invokeCallbackWithFallback(scoped, "labelTextColor", this, context));
      });
      this.labelColors = labelColors;
      this.labelPointStyles = labelPointStyles;
      this.labelTextColors = labelTextColors;
      this.dataPoints = tooltipItems;
      return tooltipItems;
    }
    update(changed, replay) {
      const options = this.options.setContext(this.getContext());
      const active = this._active;
      let properties;
      let tooltipItems = [];
      if (!active.length) {
        if (this.opacity !== 0) {
          properties = {
            opacity: 0
          };
        }
      } else {
        const position = positioners[options.position].call(this, active, this._eventPosition);
        tooltipItems = this._createItems(options);
        this.title = this.getTitle(tooltipItems, options);
        this.beforeBody = this.getBeforeBody(tooltipItems, options);
        this.body = this.getBody(tooltipItems, options);
        this.afterBody = this.getAfterBody(tooltipItems, options);
        this.footer = this.getFooter(tooltipItems, options);
        const size = this._size = getTooltipSize(this, options);
        const positionAndSize = Object.assign({}, position, size);
        const alignment = determineAlignment(this.chart, options, positionAndSize);
        const backgroundPoint = getBackgroundPoint(options, positionAndSize, alignment, this.chart);
        this.xAlign = alignment.xAlign;
        this.yAlign = alignment.yAlign;
        properties = {
          opacity: 1,
          x: backgroundPoint.x,
          y: backgroundPoint.y,
          width: size.width,
          height: size.height,
          caretX: position.x,
          caretY: position.y
        };
      }
      this._tooltipItems = tooltipItems;
      this.$context = void 0;
      if (properties) {
        this._resolveAnimations().update(this, properties);
      }
      if (changed && options.external) {
        options.external.call(this, {
          chart: this.chart,
          tooltip: this,
          replay
        });
      }
    }
    drawCaret(tooltipPoint, ctx, size, options) {
      const caretPosition = this.getCaretPosition(tooltipPoint, size, options);
      ctx.lineTo(caretPosition.x1, caretPosition.y1);
      ctx.lineTo(caretPosition.x2, caretPosition.y2);
      ctx.lineTo(caretPosition.x3, caretPosition.y3);
    }
    getCaretPosition(tooltipPoint, size, options) {
      const { xAlign, yAlign } = this;
      const { caretSize, cornerRadius } = options;
      const { topLeft, topRight, bottomLeft, bottomRight } = toTRBLCorners(cornerRadius);
      const { x: ptX, y: ptY } = tooltipPoint;
      const { width, height } = size;
      let x1, x2, x3, y1, y2, y3;
      if (yAlign === "center") {
        y2 = ptY + height / 2;
        if (xAlign === "left") {
          x1 = ptX;
          x2 = x1 - caretSize;
          y1 = y2 + caretSize;
          y3 = y2 - caretSize;
        } else {
          x1 = ptX + width;
          x2 = x1 + caretSize;
          y1 = y2 - caretSize;
          y3 = y2 + caretSize;
        }
        x3 = x1;
      } else {
        if (xAlign === "left") {
          x2 = ptX + Math.max(topLeft, bottomLeft) + caretSize;
        } else if (xAlign === "right") {
          x2 = ptX + width - Math.max(topRight, bottomRight) - caretSize;
        } else {
          x2 = this.caretX;
        }
        if (yAlign === "top") {
          y1 = ptY;
          y2 = y1 - caretSize;
          x1 = x2 - caretSize;
          x3 = x2 + caretSize;
        } else {
          y1 = ptY + height;
          y2 = y1 + caretSize;
          x1 = x2 + caretSize;
          x3 = x2 - caretSize;
        }
        y3 = y1;
      }
      return {
        x1,
        x2,
        x3,
        y1,
        y2,
        y3
      };
    }
    drawTitle(pt, ctx, options) {
      const title = this.title;
      const length = title.length;
      let titleFont, titleSpacing, i;
      if (length) {
        const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
        pt.x = getAlignedX(this, options.titleAlign, options);
        ctx.textAlign = rtlHelper.textAlign(options.titleAlign);
        ctx.textBaseline = "middle";
        titleFont = toFont(options.titleFont);
        titleSpacing = options.titleSpacing;
        ctx.fillStyle = options.titleColor;
        ctx.font = titleFont.string;
        for (i = 0; i < length; ++i) {
          ctx.fillText(title[i], rtlHelper.x(pt.x), pt.y + titleFont.lineHeight / 2);
          pt.y += titleFont.lineHeight + titleSpacing;
          if (i + 1 === length) {
            pt.y += options.titleMarginBottom - titleSpacing;
          }
        }
      }
    }
    _drawColorBox(ctx, pt, i, rtlHelper, options) {
      const labelColor = this.labelColors[i];
      const labelPointStyle = this.labelPointStyles[i];
      const { boxHeight, boxWidth } = options;
      const bodyFont = toFont(options.bodyFont);
      const colorX = getAlignedX(this, "left", options);
      const rtlColorX = rtlHelper.x(colorX);
      const yOffSet = boxHeight < bodyFont.lineHeight ? (bodyFont.lineHeight - boxHeight) / 2 : 0;
      const colorY = pt.y + yOffSet;
      if (options.usePointStyle) {
        const drawOptions = {
          radius: Math.min(boxWidth, boxHeight) / 2,
          pointStyle: labelPointStyle.pointStyle,
          rotation: labelPointStyle.rotation,
          borderWidth: 1
        };
        const centerX = rtlHelper.leftForLtr(rtlColorX, boxWidth) + boxWidth / 2;
        const centerY = colorY + boxHeight / 2;
        ctx.strokeStyle = options.multiKeyBackground;
        ctx.fillStyle = options.multiKeyBackground;
        drawPoint(ctx, drawOptions, centerX, centerY);
        ctx.strokeStyle = labelColor.borderColor;
        ctx.fillStyle = labelColor.backgroundColor;
        drawPoint(ctx, drawOptions, centerX, centerY);
      } else {
        ctx.lineWidth = isObject(labelColor.borderWidth) ? Math.max(...Object.values(labelColor.borderWidth)) : labelColor.borderWidth || 1;
        ctx.strokeStyle = labelColor.borderColor;
        ctx.setLineDash(labelColor.borderDash || []);
        ctx.lineDashOffset = labelColor.borderDashOffset || 0;
        const outerX = rtlHelper.leftForLtr(rtlColorX, boxWidth);
        const innerX = rtlHelper.leftForLtr(rtlHelper.xPlus(rtlColorX, 1), boxWidth - 2);
        const borderRadius = toTRBLCorners(labelColor.borderRadius);
        if (Object.values(borderRadius).some((v) => v !== 0)) {
          ctx.beginPath();
          ctx.fillStyle = options.multiKeyBackground;
          addRoundedRectPath(ctx, {
            x: outerX,
            y: colorY,
            w: boxWidth,
            h: boxHeight,
            radius: borderRadius
          });
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = labelColor.backgroundColor;
          ctx.beginPath();
          addRoundedRectPath(ctx, {
            x: innerX,
            y: colorY + 1,
            w: boxWidth - 2,
            h: boxHeight - 2,
            radius: borderRadius
          });
          ctx.fill();
        } else {
          ctx.fillStyle = options.multiKeyBackground;
          ctx.fillRect(outerX, colorY, boxWidth, boxHeight);
          ctx.strokeRect(outerX, colorY, boxWidth, boxHeight);
          ctx.fillStyle = labelColor.backgroundColor;
          ctx.fillRect(innerX, colorY + 1, boxWidth - 2, boxHeight - 2);
        }
      }
      ctx.fillStyle = this.labelTextColors[i];
    }
    drawBody(pt, ctx, options) {
      const { body } = this;
      const { bodySpacing, bodyAlign, displayColors, boxHeight, boxWidth, boxPadding } = options;
      const bodyFont = toFont(options.bodyFont);
      let bodyLineHeight = bodyFont.lineHeight;
      let xLinePadding = 0;
      const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
      const fillLineOfText = function(line) {
        ctx.fillText(line, rtlHelper.x(pt.x + xLinePadding), pt.y + bodyLineHeight / 2);
        pt.y += bodyLineHeight + bodySpacing;
      };
      const bodyAlignForCalculation = rtlHelper.textAlign(bodyAlign);
      let bodyItem, textColor, lines, i, j, ilen, jlen;
      ctx.textAlign = bodyAlign;
      ctx.textBaseline = "middle";
      ctx.font = bodyFont.string;
      pt.x = getAlignedX(this, bodyAlignForCalculation, options);
      ctx.fillStyle = options.bodyColor;
      each(this.beforeBody, fillLineOfText);
      xLinePadding = displayColors && bodyAlignForCalculation !== "right" ? bodyAlign === "center" ? boxWidth / 2 + boxPadding : boxWidth + 2 + boxPadding : 0;
      for (i = 0, ilen = body.length; i < ilen; ++i) {
        bodyItem = body[i];
        textColor = this.labelTextColors[i];
        ctx.fillStyle = textColor;
        each(bodyItem.before, fillLineOfText);
        lines = bodyItem.lines;
        if (displayColors && lines.length) {
          this._drawColorBox(ctx, pt, i, rtlHelper, options);
          bodyLineHeight = Math.max(bodyFont.lineHeight, boxHeight);
        }
        for (j = 0, jlen = lines.length; j < jlen; ++j) {
          fillLineOfText(lines[j]);
          bodyLineHeight = bodyFont.lineHeight;
        }
        each(bodyItem.after, fillLineOfText);
      }
      xLinePadding = 0;
      bodyLineHeight = bodyFont.lineHeight;
      each(this.afterBody, fillLineOfText);
      pt.y -= bodySpacing;
    }
    drawFooter(pt, ctx, options) {
      const footer = this.footer;
      const length = footer.length;
      let footerFont, i;
      if (length) {
        const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
        pt.x = getAlignedX(this, options.footerAlign, options);
        pt.y += options.footerMarginTop;
        ctx.textAlign = rtlHelper.textAlign(options.footerAlign);
        ctx.textBaseline = "middle";
        footerFont = toFont(options.footerFont);
        ctx.fillStyle = options.footerColor;
        ctx.font = footerFont.string;
        for (i = 0; i < length; ++i) {
          ctx.fillText(footer[i], rtlHelper.x(pt.x), pt.y + footerFont.lineHeight / 2);
          pt.y += footerFont.lineHeight + options.footerSpacing;
        }
      }
    }
    drawBackground(pt, ctx, tooltipSize, options) {
      const { xAlign, yAlign } = this;
      const { x, y } = pt;
      const { width, height } = tooltipSize;
      const { topLeft, topRight, bottomLeft, bottomRight } = toTRBLCorners(options.cornerRadius);
      ctx.fillStyle = options.backgroundColor;
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = options.borderWidth;
      ctx.beginPath();
      ctx.moveTo(x + topLeft, y);
      if (yAlign === "top") {
        this.drawCaret(pt, ctx, tooltipSize, options);
      }
      ctx.lineTo(x + width - topRight, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
      if (yAlign === "center" && xAlign === "right") {
        this.drawCaret(pt, ctx, tooltipSize, options);
      }
      ctx.lineTo(x + width, y + height - bottomRight);
      ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
      if (yAlign === "bottom") {
        this.drawCaret(pt, ctx, tooltipSize, options);
      }
      ctx.lineTo(x + bottomLeft, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
      if (yAlign === "center" && xAlign === "left") {
        this.drawCaret(pt, ctx, tooltipSize, options);
      }
      ctx.lineTo(x, y + topLeft);
      ctx.quadraticCurveTo(x, y, x + topLeft, y);
      ctx.closePath();
      ctx.fill();
      if (options.borderWidth > 0) {
        ctx.stroke();
      }
    }
    _updateAnimationTarget(options) {
      const chart = this.chart;
      const anims = this.$animations;
      const animX = anims && anims.x;
      const animY = anims && anims.y;
      if (animX || animY) {
        const position = positioners[options.position].call(this, this._active, this._eventPosition);
        if (!position) {
          return;
        }
        const size = this._size = getTooltipSize(this, options);
        const positionAndSize = Object.assign({}, position, this._size);
        const alignment = determineAlignment(chart, options, positionAndSize);
        const point = getBackgroundPoint(options, positionAndSize, alignment, chart);
        if (animX._to !== point.x || animY._to !== point.y) {
          this.xAlign = alignment.xAlign;
          this.yAlign = alignment.yAlign;
          this.width = size.width;
          this.height = size.height;
          this.caretX = position.x;
          this.caretY = position.y;
          this._resolveAnimations().update(this, point);
        }
      }
    }
    _willRender() {
      return !!this.opacity;
    }
    draw(ctx) {
      const options = this.options.setContext(this.getContext());
      let opacity = this.opacity;
      if (!opacity) {
        return;
      }
      this._updateAnimationTarget(options);
      const tooltipSize = {
        width: this.width,
        height: this.height
      };
      const pt = {
        x: this.x,
        y: this.y
      };
      opacity = Math.abs(opacity) < 1e-3 ? 0 : opacity;
      const padding = toPadding(options.padding);
      const hasTooltipContent = this.title.length || this.beforeBody.length || this.body.length || this.afterBody.length || this.footer.length;
      if (options.enabled && hasTooltipContent) {
        ctx.save();
        ctx.globalAlpha = opacity;
        this.drawBackground(pt, ctx, tooltipSize, options);
        overrideTextDirection(ctx, options.textDirection);
        pt.y += padding.top;
        this.drawTitle(pt, ctx, options);
        this.drawBody(pt, ctx, options);
        this.drawFooter(pt, ctx, options);
        restoreTextDirection(ctx, options.textDirection);
        ctx.restore();
      }
    }
    getActiveElements() {
      return this._active || [];
    }
    setActiveElements(activeElements, eventPosition) {
      const lastActive = this._active;
      const active = activeElements.map(({ datasetIndex, index: index2 }) => {
        const meta = this.chart.getDatasetMeta(datasetIndex);
        if (!meta) {
          throw new Error("Cannot find a dataset at index " + datasetIndex);
        }
        return {
          datasetIndex,
          element: meta.data[index2],
          index: index2
        };
      });
      const changed = !_elementsEqual(lastActive, active);
      const positionChanged = this._positionChanged(active, eventPosition);
      if (changed || positionChanged) {
        this._active = active;
        this._eventPosition = eventPosition;
        this._ignoreReplayEvents = true;
        this.update(true);
      }
    }
    handleEvent(e, replay, inChartArea = true) {
      if (replay && this._ignoreReplayEvents) {
        return false;
      }
      this._ignoreReplayEvents = false;
      const options = this.options;
      const lastActive = this._active || [];
      const active = this._getActiveElements(e, lastActive, replay, inChartArea);
      const positionChanged = this._positionChanged(active, e);
      const changed = replay || !_elementsEqual(active, lastActive) || positionChanged;
      if (changed) {
        this._active = active;
        if (options.enabled || options.external) {
          this._eventPosition = {
            x: e.x,
            y: e.y
          };
          this.update(true, replay);
        }
      }
      return changed;
    }
    _getActiveElements(e, lastActive, replay, inChartArea) {
      const options = this.options;
      if (e.type === "mouseout") {
        return [];
      }
      if (!inChartArea) {
        return lastActive.filter((i) => this.chart.data.datasets[i.datasetIndex] && this.chart.getDatasetMeta(i.datasetIndex).controller.getParsed(i.index) !== void 0);
      }
      const active = this.chart.getElementsAtEventForMode(e, options.mode, options, replay);
      if (options.reverse) {
        active.reverse();
      }
      return active;
    }
    _positionChanged(active, e) {
      const { caretX, caretY, options } = this;
      const position = positioners[options.position].call(this, active, e);
      return position !== false && (caretX !== position.x || caretY !== position.y);
    }
  };
  __publicField(Tooltip, "positioners", positioners);
  var plugin_tooltip = {
    id: "tooltip",
    _element: Tooltip,
    positioners,
    afterInit(chart, _args, options) {
      if (options) {
        chart.tooltip = new Tooltip({
          chart,
          options
        });
      }
    },
    beforeUpdate(chart, _args, options) {
      if (chart.tooltip) {
        chart.tooltip.initialize(options);
      }
    },
    reset(chart, _args, options) {
      if (chart.tooltip) {
        chart.tooltip.initialize(options);
      }
    },
    afterDraw(chart) {
      const tooltip = chart.tooltip;
      if (tooltip && tooltip._willRender()) {
        const args = {
          tooltip
        };
        if (chart.notifyPlugins("beforeTooltipDraw", {
          ...args,
          cancelable: true
        }) === false) {
          return;
        }
        tooltip.draw(chart.ctx);
        chart.notifyPlugins("afterTooltipDraw", args);
      }
    },
    afterEvent(chart, args) {
      if (chart.tooltip) {
        const useFinalPosition = args.replay;
        if (chart.tooltip.handleEvent(args.event, useFinalPosition, args.inChartArea)) {
          args.changed = true;
        }
      }
    },
    defaults: {
      enabled: true,
      external: null,
      position: "average",
      backgroundColor: "rgba(0,0,0,0.8)",
      titleColor: "#fff",
      titleFont: {
        weight: "bold"
      },
      titleSpacing: 2,
      titleMarginBottom: 6,
      titleAlign: "left",
      bodyColor: "#fff",
      bodySpacing: 2,
      bodyFont: {},
      bodyAlign: "left",
      footerColor: "#fff",
      footerSpacing: 2,
      footerMarginTop: 6,
      footerFont: {
        weight: "bold"
      },
      footerAlign: "left",
      padding: 6,
      caretPadding: 2,
      caretSize: 5,
      cornerRadius: 6,
      boxHeight: (ctx, opts) => opts.bodyFont.size,
      boxWidth: (ctx, opts) => opts.bodyFont.size,
      multiKeyBackground: "#fff",
      displayColors: true,
      boxPadding: 0,
      borderColor: "rgba(0,0,0,0)",
      borderWidth: 0,
      animation: {
        duration: 400,
        easing: "easeOutQuart"
      },
      animations: {
        numbers: {
          type: "number",
          properties: [
            "x",
            "y",
            "width",
            "height",
            "caretX",
            "caretY"
          ]
        },
        opacity: {
          easing: "linear",
          duration: 200
        }
      },
      callbacks: defaultCallbacks
    },
    defaultRoutes: {
      bodyFont: "font",
      footerFont: "font",
      titleFont: "font"
    },
    descriptors: {
      _scriptable: (name) => name !== "filter" && name !== "itemSort" && name !== "external",
      _indexable: false,
      callbacks: {
        _scriptable: false,
        _indexable: false
      },
      animation: {
        _fallback: false
      },
      animations: {
        _fallback: "animation"
      }
    },
    additionalOptionScopes: [
      "interaction"
    ]
  };
  var addIfString = (labels, raw, index2, addedLabels) => {
    if (typeof raw === "string") {
      index2 = labels.push(raw) - 1;
      addedLabels.unshift({
        index: index2,
        label: raw
      });
    } else if (isNaN(raw)) {
      index2 = null;
    }
    return index2;
  };
  function findOrAddLabel(labels, raw, index2, addedLabels) {
    const first = labels.indexOf(raw);
    if (first === -1) {
      return addIfString(labels, raw, index2, addedLabels);
    }
    const last = labels.lastIndexOf(raw);
    return first !== last ? index2 : first;
  }
  var validIndex = (index2, max) => index2 === null ? null : _limitValue(Math.round(index2), 0, max);
  function _getLabelForValue(value) {
    const labels = this.getLabels();
    if (value >= 0 && value < labels.length) {
      return labels[value];
    }
    return value;
  }
  var CategoryScale = class extends Scale {
    constructor(cfg) {
      super(cfg);
      this._startValue = void 0;
      this._valueRange = 0;
      this._addedLabels = [];
    }
    init(scaleOptions) {
      const added = this._addedLabels;
      if (added.length) {
        const labels = this.getLabels();
        for (const { index: index2, label } of added) {
          if (labels[index2] === label) {
            labels.splice(index2, 1);
          }
        }
        this._addedLabels = [];
      }
      super.init(scaleOptions);
    }
    parse(raw, index2) {
      if (isNullOrUndef(raw)) {
        return null;
      }
      const labels = this.getLabels();
      index2 = isFinite(index2) && labels[index2] === raw ? index2 : findOrAddLabel(labels, raw, valueOrDefault(index2, raw), this._addedLabels);
      return validIndex(index2, labels.length - 1);
    }
    determineDataLimits() {
      const { minDefined, maxDefined } = this.getUserBounds();
      let { min, max } = this.getMinMax(true);
      if (this.options.bounds === "ticks") {
        if (!minDefined) {
          min = 0;
        }
        if (!maxDefined) {
          max = this.getLabels().length - 1;
        }
      }
      this.min = min;
      this.max = max;
    }
    buildTicks() {
      const min = this.min;
      const max = this.max;
      const offset = this.options.offset;
      const ticks = [];
      let labels = this.getLabels();
      labels = min === 0 && max === labels.length - 1 ? labels : labels.slice(min, max + 1);
      this._valueRange = Math.max(labels.length - (offset ? 0 : 1), 1);
      this._startValue = this.min - (offset ? 0.5 : 0);
      for (let value = min; value <= max; value++) {
        ticks.push({
          value
        });
      }
      return ticks;
    }
    getLabelForValue(value) {
      return _getLabelForValue.call(this, value);
    }
    configure() {
      super.configure();
      if (!this.isHorizontal()) {
        this._reversePixels = !this._reversePixels;
      }
    }
    getPixelForValue(value) {
      if (typeof value !== "number") {
        value = this.parse(value);
      }
      return value === null ? NaN : this.getPixelForDecimal((value - this._startValue) / this._valueRange);
    }
    getPixelForTick(index2) {
      const ticks = this.ticks;
      if (index2 < 0 || index2 > ticks.length - 1) {
        return null;
      }
      return this.getPixelForValue(ticks[index2].value);
    }
    getValueForPixel(pixel) {
      return Math.round(this._startValue + this.getDecimalForPixel(pixel) * this._valueRange);
    }
    getBasePixel() {
      return this.bottom;
    }
  };
  __publicField(CategoryScale, "id", "category");
  __publicField(CategoryScale, "defaults", {
    ticks: {
      callback: _getLabelForValue
    }
  });
  function generateTicks$1(generationOptions, dataRange) {
    const ticks = [];
    const MIN_SPACING = 1e-14;
    const { bounds, step, min, max, precision, count, maxTicks, maxDigits, includeBounds } = generationOptions;
    const unit = step || 1;
    const maxSpaces = maxTicks - 1;
    const { min: rmin, max: rmax } = dataRange;
    const minDefined = !isNullOrUndef(min);
    const maxDefined = !isNullOrUndef(max);
    const countDefined = !isNullOrUndef(count);
    const minSpacing = (rmax - rmin) / (maxDigits + 1);
    let spacing = niceNum((rmax - rmin) / maxSpaces / unit) * unit;
    let factor, niceMin, niceMax, numSpaces;
    if (spacing < MIN_SPACING && !minDefined && !maxDefined) {
      return [
        {
          value: rmin
        },
        {
          value: rmax
        }
      ];
    }
    numSpaces = Math.ceil(rmax / spacing) - Math.floor(rmin / spacing);
    if (numSpaces > maxSpaces) {
      spacing = niceNum(numSpaces * spacing / maxSpaces / unit) * unit;
    }
    if (!isNullOrUndef(precision)) {
      factor = Math.pow(10, precision);
      spacing = Math.ceil(spacing * factor) / factor;
    }
    if (bounds === "ticks") {
      niceMin = Math.floor(rmin / spacing) * spacing;
      niceMax = Math.ceil(rmax / spacing) * spacing;
    } else {
      niceMin = rmin;
      niceMax = rmax;
    }
    if (minDefined && maxDefined && step && almostWhole((max - min) / step, spacing / 1e3)) {
      numSpaces = Math.round(Math.min((max - min) / spacing, maxTicks));
      spacing = (max - min) / numSpaces;
      niceMin = min;
      niceMax = max;
    } else if (countDefined) {
      niceMin = minDefined ? min : niceMin;
      niceMax = maxDefined ? max : niceMax;
      numSpaces = count - 1;
      spacing = (niceMax - niceMin) / numSpaces;
    } else {
      numSpaces = (niceMax - niceMin) / spacing;
      if (almostEquals(numSpaces, Math.round(numSpaces), spacing / 1e3)) {
        numSpaces = Math.round(numSpaces);
      } else {
        numSpaces = Math.ceil(numSpaces);
      }
    }
    const decimalPlaces = Math.max(_decimalPlaces(spacing), _decimalPlaces(niceMin));
    factor = Math.pow(10, isNullOrUndef(precision) ? decimalPlaces : precision);
    niceMin = Math.round(niceMin * factor) / factor;
    niceMax = Math.round(niceMax * factor) / factor;
    let j = 0;
    if (minDefined) {
      if (includeBounds && niceMin !== min) {
        ticks.push({
          value: min
        });
        if (niceMin < min) {
          j++;
        }
        if (almostEquals(Math.round((niceMin + j * spacing) * factor) / factor, min, relativeLabelSize(min, minSpacing, generationOptions))) {
          j++;
        }
      } else if (niceMin < min) {
        j++;
      }
    }
    for (; j < numSpaces; ++j) {
      const tickValue = Math.round((niceMin + j * spacing) * factor) / factor;
      if (maxDefined && tickValue > max) {
        break;
      }
      ticks.push({
        value: tickValue
      });
    }
    if (maxDefined && includeBounds && niceMax !== max) {
      if (ticks.length && almostEquals(ticks[ticks.length - 1].value, max, relativeLabelSize(max, minSpacing, generationOptions))) {
        ticks[ticks.length - 1].value = max;
      } else {
        ticks.push({
          value: max
        });
      }
    } else if (!maxDefined || niceMax === max) {
      ticks.push({
        value: niceMax
      });
    }
    return ticks;
  }
  function relativeLabelSize(value, minSpacing, { horizontal, minRotation }) {
    const rad = toRadians(minRotation);
    const ratio = (horizontal ? Math.sin(rad) : Math.cos(rad)) || 1e-3;
    const length = 0.75 * minSpacing * ("" + value).length;
    return Math.min(minSpacing / ratio, length);
  }
  var LinearScaleBase = class extends Scale {
    constructor(cfg) {
      super(cfg);
      this.start = void 0;
      this.end = void 0;
      this._startValue = void 0;
      this._endValue = void 0;
      this._valueRange = 0;
    }
    parse(raw, index2) {
      if (isNullOrUndef(raw)) {
        return null;
      }
      if ((typeof raw === "number" || raw instanceof Number) && !isFinite(+raw)) {
        return null;
      }
      return +raw;
    }
    handleTickRangeOptions() {
      const { beginAtZero } = this.options;
      const { minDefined, maxDefined } = this.getUserBounds();
      let { min, max } = this;
      const setMin = (v) => min = minDefined ? min : v;
      const setMax = (v) => max = maxDefined ? max : v;
      if (beginAtZero) {
        const minSign = sign(min);
        const maxSign = sign(max);
        if (minSign < 0 && maxSign < 0) {
          setMax(0);
        } else if (minSign > 0 && maxSign > 0) {
          setMin(0);
        }
      }
      if (min === max) {
        let offset = max === 0 ? 1 : Math.abs(max * 0.05);
        setMax(max + offset);
        if (!beginAtZero) {
          setMin(min - offset);
        }
      }
      this.min = min;
      this.max = max;
    }
    getTickLimit() {
      const tickOpts = this.options.ticks;
      let { maxTicksLimit, stepSize } = tickOpts;
      let maxTicks;
      if (stepSize) {
        maxTicks = Math.ceil(this.max / stepSize) - Math.floor(this.min / stepSize) + 1;
        if (maxTicks > 1e3) {
          console.warn(`scales.${this.id}.ticks.stepSize: ${stepSize} would result generating up to ${maxTicks} ticks. Limiting to 1000.`);
          maxTicks = 1e3;
        }
      } else {
        maxTicks = this.computeTickLimit();
        maxTicksLimit = maxTicksLimit || 11;
      }
      if (maxTicksLimit) {
        maxTicks = Math.min(maxTicksLimit, maxTicks);
      }
      return maxTicks;
    }
    computeTickLimit() {
      return Number.POSITIVE_INFINITY;
    }
    buildTicks() {
      const opts = this.options;
      const tickOpts = opts.ticks;
      let maxTicks = this.getTickLimit();
      maxTicks = Math.max(2, maxTicks);
      const numericGeneratorOptions = {
        maxTicks,
        bounds: opts.bounds,
        min: opts.min,
        max: opts.max,
        precision: tickOpts.precision,
        step: tickOpts.stepSize,
        count: tickOpts.count,
        maxDigits: this._maxDigits(),
        horizontal: this.isHorizontal(),
        minRotation: tickOpts.minRotation || 0,
        includeBounds: tickOpts.includeBounds !== false
      };
      const dataRange = this._range || this;
      const ticks = generateTicks$1(numericGeneratorOptions, dataRange);
      if (opts.bounds === "ticks") {
        _setMinAndMaxByKey(ticks, this, "value");
      }
      if (opts.reverse) {
        ticks.reverse();
        this.start = this.max;
        this.end = this.min;
      } else {
        this.start = this.min;
        this.end = this.max;
      }
      return ticks;
    }
    configure() {
      const ticks = this.ticks;
      let start = this.min;
      let end = this.max;
      super.configure();
      if (this.options.offset && ticks.length) {
        const offset = (end - start) / Math.max(ticks.length - 1, 1) / 2;
        start -= offset;
        end += offset;
      }
      this._startValue = start;
      this._endValue = end;
      this._valueRange = end - start;
    }
    getLabelForValue(value) {
      return formatNumber(value, this.chart.options.locale, this.options.ticks.format);
    }
  };
  var LinearScale = class extends LinearScaleBase {
    determineDataLimits() {
      const { min, max } = this.getMinMax(true);
      this.min = isNumberFinite(min) ? min : 0;
      this.max = isNumberFinite(max) ? max : 1;
      this.handleTickRangeOptions();
    }
    computeTickLimit() {
      const horizontal = this.isHorizontal();
      const length = horizontal ? this.width : this.height;
      const minRotation = toRadians(this.options.ticks.minRotation);
      const ratio = (horizontal ? Math.sin(minRotation) : Math.cos(minRotation)) || 1e-3;
      const tickFont = this._resolveTickFontOptions(0);
      return Math.ceil(length / Math.min(40, tickFont.lineHeight / ratio));
    }
    getPixelForValue(value) {
      return value === null ? NaN : this.getPixelForDecimal((value - this._startValue) / this._valueRange);
    }
    getValueForPixel(pixel) {
      return this._startValue + this.getDecimalForPixel(pixel) * this._valueRange;
    }
  };
  __publicField(LinearScale, "id", "linear");
  __publicField(LinearScale, "defaults", {
    ticks: {
      callback: Ticks.formatters.numeric
    }
  });
  var log10Floor = (v) => Math.floor(log10(v));
  var changeExponent = (v, m) => Math.pow(10, log10Floor(v) + m);
  function isMajor(tickVal) {
    const remain = tickVal / Math.pow(10, log10Floor(tickVal));
    return remain === 1;
  }
  function steps(min, max, rangeExp) {
    const rangeStep = Math.pow(10, rangeExp);
    const start = Math.floor(min / rangeStep);
    const end = Math.ceil(max / rangeStep);
    return end - start;
  }
  function startExp(min, max) {
    const range = max - min;
    let rangeExp = log10Floor(range);
    while (steps(min, max, rangeExp) > 10) {
      rangeExp++;
    }
    while (steps(min, max, rangeExp) < 10) {
      rangeExp--;
    }
    return Math.min(rangeExp, log10Floor(min));
  }
  function generateTicks(generationOptions, { min, max }) {
    min = finiteOrDefault(generationOptions.min, min);
    const ticks = [];
    const minExp = log10Floor(min);
    let exp = startExp(min, max);
    let precision = exp < 0 ? Math.pow(10, Math.abs(exp)) : 1;
    const stepSize = Math.pow(10, exp);
    const base = minExp > exp ? Math.pow(10, minExp) : 0;
    const start = Math.round((min - base) * precision) / precision;
    const offset = Math.floor((min - base) / stepSize / 10) * stepSize * 10;
    let significand = Math.floor((start - offset) / Math.pow(10, exp));
    let value = finiteOrDefault(generationOptions.min, Math.round((base + offset + significand * Math.pow(10, exp)) * precision) / precision);
    while (value < max) {
      ticks.push({
        value,
        major: isMajor(value),
        significand
      });
      if (significand >= 10) {
        significand = significand < 15 ? 15 : 20;
      } else {
        significand++;
      }
      if (significand >= 20) {
        exp++;
        significand = 2;
        precision = exp >= 0 ? 1 : precision;
      }
      value = Math.round((base + offset + significand * Math.pow(10, exp)) * precision) / precision;
    }
    const lastTick = finiteOrDefault(generationOptions.max, value);
    ticks.push({
      value: lastTick,
      major: isMajor(lastTick),
      significand
    });
    return ticks;
  }
  var LogarithmicScale = class extends Scale {
    constructor(cfg) {
      super(cfg);
      this.start = void 0;
      this.end = void 0;
      this._startValue = void 0;
      this._valueRange = 0;
    }
    parse(raw, index2) {
      const value = LinearScaleBase.prototype.parse.apply(this, [
        raw,
        index2
      ]);
      if (value === 0) {
        this._zero = true;
        return void 0;
      }
      return isNumberFinite(value) && value > 0 ? value : null;
    }
    determineDataLimits() {
      const { min, max } = this.getMinMax(true);
      this.min = isNumberFinite(min) ? Math.max(0, min) : null;
      this.max = isNumberFinite(max) ? Math.max(0, max) : null;
      if (this.options.beginAtZero) {
        this._zero = true;
      }
      if (this._zero && this.min !== this._suggestedMin && !isNumberFinite(this._userMin)) {
        this.min = min === changeExponent(this.min, 0) ? changeExponent(this.min, -1) : changeExponent(this.min, 0);
      }
      this.handleTickRangeOptions();
    }
    handleTickRangeOptions() {
      const { minDefined, maxDefined } = this.getUserBounds();
      let min = this.min;
      let max = this.max;
      const setMin = (v) => min = minDefined ? min : v;
      const setMax = (v) => max = maxDefined ? max : v;
      if (min === max) {
        if (min <= 0) {
          setMin(1);
          setMax(10);
        } else {
          setMin(changeExponent(min, -1));
          setMax(changeExponent(max, 1));
        }
      }
      if (min <= 0) {
        setMin(changeExponent(max, -1));
      }
      if (max <= 0) {
        setMax(changeExponent(min, 1));
      }
      this.min = min;
      this.max = max;
    }
    buildTicks() {
      const opts = this.options;
      const generationOptions = {
        min: this._userMin,
        max: this._userMax
      };
      const ticks = generateTicks(generationOptions, this);
      if (opts.bounds === "ticks") {
        _setMinAndMaxByKey(ticks, this, "value");
      }
      if (opts.reverse) {
        ticks.reverse();
        this.start = this.max;
        this.end = this.min;
      } else {
        this.start = this.min;
        this.end = this.max;
      }
      return ticks;
    }
    getLabelForValue(value) {
      return value === void 0 ? "0" : formatNumber(value, this.chart.options.locale, this.options.ticks.format);
    }
    configure() {
      const start = this.min;
      super.configure();
      this._startValue = log10(start);
      this._valueRange = log10(this.max) - log10(start);
    }
    getPixelForValue(value) {
      if (value === void 0 || value === 0) {
        value = this.min;
      }
      if (value === null || isNaN(value)) {
        return NaN;
      }
      return this.getPixelForDecimal(value === this.min ? 0 : (log10(value) - this._startValue) / this._valueRange);
    }
    getValueForPixel(pixel) {
      const decimal = this.getDecimalForPixel(pixel);
      return Math.pow(10, this._startValue + decimal * this._valueRange);
    }
  };
  __publicField(LogarithmicScale, "id", "logarithmic");
  __publicField(LogarithmicScale, "defaults", {
    ticks: {
      callback: Ticks.formatters.logarithmic,
      major: {
        enabled: true
      }
    }
  });
  function getTickBackdropHeight(opts) {
    const tickOpts = opts.ticks;
    if (tickOpts.display && opts.display) {
      const padding = toPadding(tickOpts.backdropPadding);
      return valueOrDefault(tickOpts.font && tickOpts.font.size, defaults.font.size) + padding.height;
    }
    return 0;
  }
  function measureLabelSize(ctx, font, label) {
    label = isArray(label) ? label : [
      label
    ];
    return {
      w: _longestText(ctx, font.string, label),
      h: label.length * font.lineHeight
    };
  }
  function determineLimits(angle, pos, size, min, max) {
    if (angle === min || angle === max) {
      return {
        start: pos - size / 2,
        end: pos + size / 2
      };
    } else if (angle < min || angle > max) {
      return {
        start: pos - size,
        end: pos
      };
    }
    return {
      start: pos,
      end: pos + size
    };
  }
  function fitWithPointLabels(scale) {
    const orig = {
      l: scale.left + scale._padding.left,
      r: scale.right - scale._padding.right,
      t: scale.top + scale._padding.top,
      b: scale.bottom - scale._padding.bottom
    };
    const limits = Object.assign({}, orig);
    const labelSizes = [];
    const padding = [];
    const valueCount = scale._pointLabels.length;
    const pointLabelOpts = scale.options.pointLabels;
    const additionalAngle = pointLabelOpts.centerPointLabels ? PI / valueCount : 0;
    for (let i = 0; i < valueCount; i++) {
      const opts = pointLabelOpts.setContext(scale.getPointLabelContext(i));
      padding[i] = opts.padding;
      const pointPosition = scale.getPointPosition(i, scale.drawingArea + padding[i], additionalAngle);
      const plFont = toFont(opts.font);
      const textSize = measureLabelSize(scale.ctx, plFont, scale._pointLabels[i]);
      labelSizes[i] = textSize;
      const angleRadians = _normalizeAngle(scale.getIndexAngle(i) + additionalAngle);
      const angle = Math.round(toDegrees(angleRadians));
      const hLimits = determineLimits(angle, pointPosition.x, textSize.w, 0, 180);
      const vLimits = determineLimits(angle, pointPosition.y, textSize.h, 90, 270);
      updateLimits(limits, orig, angleRadians, hLimits, vLimits);
    }
    scale.setCenterPoint(orig.l - limits.l, limits.r - orig.r, orig.t - limits.t, limits.b - orig.b);
    scale._pointLabelItems = buildPointLabelItems(scale, labelSizes, padding);
  }
  function updateLimits(limits, orig, angle, hLimits, vLimits) {
    const sin = Math.abs(Math.sin(angle));
    const cos = Math.abs(Math.cos(angle));
    let x = 0;
    let y = 0;
    if (hLimits.start < orig.l) {
      x = (orig.l - hLimits.start) / sin;
      limits.l = Math.min(limits.l, orig.l - x);
    } else if (hLimits.end > orig.r) {
      x = (hLimits.end - orig.r) / sin;
      limits.r = Math.max(limits.r, orig.r + x);
    }
    if (vLimits.start < orig.t) {
      y = (orig.t - vLimits.start) / cos;
      limits.t = Math.min(limits.t, orig.t - y);
    } else if (vLimits.end > orig.b) {
      y = (vLimits.end - orig.b) / cos;
      limits.b = Math.max(limits.b, orig.b + y);
    }
  }
  function createPointLabelItem(scale, index2, itemOpts) {
    const outerDistance = scale.drawingArea;
    const { extra, additionalAngle, padding, size } = itemOpts;
    const pointLabelPosition = scale.getPointPosition(index2, outerDistance + extra + padding, additionalAngle);
    const angle = Math.round(toDegrees(_normalizeAngle(pointLabelPosition.angle + HALF_PI)));
    const y = yForAngle(pointLabelPosition.y, size.h, angle);
    const textAlign = getTextAlignForAngle(angle);
    const left = leftForTextAlign(pointLabelPosition.x, size.w, textAlign);
    return {
      visible: true,
      x: pointLabelPosition.x,
      y,
      textAlign,
      left,
      top: y,
      right: left + size.w,
      bottom: y + size.h
    };
  }
  function isNotOverlapped(item, area) {
    if (!area) {
      return true;
    }
    const { left, top, right, bottom } = item;
    const apexesInArea = _isPointInArea({
      x: left,
      y: top
    }, area) || _isPointInArea({
      x: left,
      y: bottom
    }, area) || _isPointInArea({
      x: right,
      y: top
    }, area) || _isPointInArea({
      x: right,
      y: bottom
    }, area);
    return !apexesInArea;
  }
  function buildPointLabelItems(scale, labelSizes, padding) {
    const items = [];
    const valueCount = scale._pointLabels.length;
    const opts = scale.options;
    const { centerPointLabels, display } = opts.pointLabels;
    const itemOpts = {
      extra: getTickBackdropHeight(opts) / 2,
      additionalAngle: centerPointLabels ? PI / valueCount : 0
    };
    let area;
    for (let i = 0; i < valueCount; i++) {
      itemOpts.padding = padding[i];
      itemOpts.size = labelSizes[i];
      const item = createPointLabelItem(scale, i, itemOpts);
      items.push(item);
      if (display === "auto") {
        item.visible = isNotOverlapped(item, area);
        if (item.visible) {
          area = item;
        }
      }
    }
    return items;
  }
  function getTextAlignForAngle(angle) {
    if (angle === 0 || angle === 180) {
      return "center";
    } else if (angle < 180) {
      return "left";
    }
    return "right";
  }
  function leftForTextAlign(x, w, align) {
    if (align === "right") {
      x -= w;
    } else if (align === "center") {
      x -= w / 2;
    }
    return x;
  }
  function yForAngle(y, h, angle) {
    if (angle === 90 || angle === 270) {
      y -= h / 2;
    } else if (angle > 270 || angle < 90) {
      y -= h;
    }
    return y;
  }
  function drawPointLabelBox(ctx, opts, item) {
    const { left, top, right, bottom } = item;
    const { backdropColor } = opts;
    if (!isNullOrUndef(backdropColor)) {
      const borderRadius = toTRBLCorners(opts.borderRadius);
      const padding = toPadding(opts.backdropPadding);
      ctx.fillStyle = backdropColor;
      const backdropLeft = left - padding.left;
      const backdropTop = top - padding.top;
      const backdropWidth = right - left + padding.width;
      const backdropHeight = bottom - top + padding.height;
      if (Object.values(borderRadius).some((v) => v !== 0)) {
        ctx.beginPath();
        addRoundedRectPath(ctx, {
          x: backdropLeft,
          y: backdropTop,
          w: backdropWidth,
          h: backdropHeight,
          radius: borderRadius
        });
        ctx.fill();
      } else {
        ctx.fillRect(backdropLeft, backdropTop, backdropWidth, backdropHeight);
      }
    }
  }
  function drawPointLabels(scale, labelCount) {
    const { ctx, options: { pointLabels } } = scale;
    for (let i = labelCount - 1; i >= 0; i--) {
      const item = scale._pointLabelItems[i];
      if (!item.visible) {
        continue;
      }
      const optsAtIndex = pointLabels.setContext(scale.getPointLabelContext(i));
      drawPointLabelBox(ctx, optsAtIndex, item);
      const plFont = toFont(optsAtIndex.font);
      const { x, y, textAlign } = item;
      renderText(ctx, scale._pointLabels[i], x, y + plFont.lineHeight / 2, plFont, {
        color: optsAtIndex.color,
        textAlign,
        textBaseline: "middle"
      });
    }
  }
  function pathRadiusLine(scale, radius, circular, labelCount) {
    const { ctx } = scale;
    if (circular) {
      ctx.arc(scale.xCenter, scale.yCenter, radius, 0, TAU);
    } else {
      let pointPosition = scale.getPointPosition(0, radius);
      ctx.moveTo(pointPosition.x, pointPosition.y);
      for (let i = 1; i < labelCount; i++) {
        pointPosition = scale.getPointPosition(i, radius);
        ctx.lineTo(pointPosition.x, pointPosition.y);
      }
    }
  }
  function drawRadiusLine(scale, gridLineOpts, radius, labelCount, borderOpts) {
    const ctx = scale.ctx;
    const circular = gridLineOpts.circular;
    const { color: color2, lineWidth } = gridLineOpts;
    if (!circular && !labelCount || !color2 || !lineWidth || radius < 0) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = color2;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(borderOpts.dash || []);
    ctx.lineDashOffset = borderOpts.dashOffset;
    ctx.beginPath();
    pathRadiusLine(scale, radius, circular, labelCount);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  function createPointLabelContext(parent, index2, label) {
    return createContext(parent, {
      label,
      index: index2,
      type: "pointLabel"
    });
  }
  var RadialLinearScale = class extends LinearScaleBase {
    constructor(cfg) {
      super(cfg);
      this.xCenter = void 0;
      this.yCenter = void 0;
      this.drawingArea = void 0;
      this._pointLabels = [];
      this._pointLabelItems = [];
    }
    setDimensions() {
      const padding = this._padding = toPadding(getTickBackdropHeight(this.options) / 2);
      const w = this.width = this.maxWidth - padding.width;
      const h = this.height = this.maxHeight - padding.height;
      this.xCenter = Math.floor(this.left + w / 2 + padding.left);
      this.yCenter = Math.floor(this.top + h / 2 + padding.top);
      this.drawingArea = Math.floor(Math.min(w, h) / 2);
    }
    determineDataLimits() {
      const { min, max } = this.getMinMax(false);
      this.min = isNumberFinite(min) && !isNaN(min) ? min : 0;
      this.max = isNumberFinite(max) && !isNaN(max) ? max : 0;
      this.handleTickRangeOptions();
    }
    computeTickLimit() {
      return Math.ceil(this.drawingArea / getTickBackdropHeight(this.options));
    }
    generateTickLabels(ticks) {
      LinearScaleBase.prototype.generateTickLabels.call(this, ticks);
      this._pointLabels = this.getLabels().map((value, index2) => {
        const label = callback(this.options.pointLabels.callback, [
          value,
          index2
        ], this);
        return label || label === 0 ? label : "";
      }).filter((v, i) => this.chart.getDataVisibility(i));
    }
    fit() {
      const opts = this.options;
      if (opts.display && opts.pointLabels.display) {
        fitWithPointLabels(this);
      } else {
        this.setCenterPoint(0, 0, 0, 0);
      }
    }
    setCenterPoint(leftMovement, rightMovement, topMovement, bottomMovement) {
      this.xCenter += Math.floor((leftMovement - rightMovement) / 2);
      this.yCenter += Math.floor((topMovement - bottomMovement) / 2);
      this.drawingArea -= Math.min(this.drawingArea / 2, Math.max(leftMovement, rightMovement, topMovement, bottomMovement));
    }
    getIndexAngle(index2) {
      const angleMultiplier = TAU / (this._pointLabels.length || 1);
      const startAngle = this.options.startAngle || 0;
      return _normalizeAngle(index2 * angleMultiplier + toRadians(startAngle));
    }
    getDistanceFromCenterForValue(value) {
      if (isNullOrUndef(value)) {
        return NaN;
      }
      const scalingFactor = this.drawingArea / (this.max - this.min);
      if (this.options.reverse) {
        return (this.max - value) * scalingFactor;
      }
      return (value - this.min) * scalingFactor;
    }
    getValueForDistanceFromCenter(distance) {
      if (isNullOrUndef(distance)) {
        return NaN;
      }
      const scaledDistance = distance / (this.drawingArea / (this.max - this.min));
      return this.options.reverse ? this.max - scaledDistance : this.min + scaledDistance;
    }
    getPointLabelContext(index2) {
      const pointLabels = this._pointLabels || [];
      if (index2 >= 0 && index2 < pointLabels.length) {
        const pointLabel = pointLabels[index2];
        return createPointLabelContext(this.getContext(), index2, pointLabel);
      }
    }
    getPointPosition(index2, distanceFromCenter, additionalAngle = 0) {
      const angle = this.getIndexAngle(index2) - HALF_PI + additionalAngle;
      return {
        x: Math.cos(angle) * distanceFromCenter + this.xCenter,
        y: Math.sin(angle) * distanceFromCenter + this.yCenter,
        angle
      };
    }
    getPointPositionForValue(index2, value) {
      return this.getPointPosition(index2, this.getDistanceFromCenterForValue(value));
    }
    getBasePosition(index2) {
      return this.getPointPositionForValue(index2 || 0, this.getBaseValue());
    }
    getPointLabelPosition(index2) {
      const { left, top, right, bottom } = this._pointLabelItems[index2];
      return {
        left,
        top,
        right,
        bottom
      };
    }
    drawBackground() {
      const { backgroundColor, grid: { circular } } = this.options;
      if (backgroundColor) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        pathRadiusLine(this, this.getDistanceFromCenterForValue(this._endValue), circular, this._pointLabels.length);
        ctx.closePath();
        ctx.fillStyle = backgroundColor;
        ctx.fill();
        ctx.restore();
      }
    }
    drawGrid() {
      const ctx = this.ctx;
      const opts = this.options;
      const { angleLines, grid, border } = opts;
      const labelCount = this._pointLabels.length;
      let i, offset, position;
      if (opts.pointLabels.display) {
        drawPointLabels(this, labelCount);
      }
      if (grid.display) {
        this.ticks.forEach((tick, index2) => {
          if (index2 !== 0 || index2 === 0 && this.min < 0) {
            offset = this.getDistanceFromCenterForValue(tick.value);
            const context = this.getContext(index2);
            const optsAtIndex = grid.setContext(context);
            const optsAtIndexBorder = border.setContext(context);
            drawRadiusLine(this, optsAtIndex, offset, labelCount, optsAtIndexBorder);
          }
        });
      }
      if (angleLines.display) {
        ctx.save();
        for (i = labelCount - 1; i >= 0; i--) {
          const optsAtIndex = angleLines.setContext(this.getPointLabelContext(i));
          const { color: color2, lineWidth } = optsAtIndex;
          if (!lineWidth || !color2) {
            continue;
          }
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = color2;
          ctx.setLineDash(optsAtIndex.borderDash);
          ctx.lineDashOffset = optsAtIndex.borderDashOffset;
          offset = this.getDistanceFromCenterForValue(opts.reverse ? this.min : this.max);
          position = this.getPointPosition(i, offset);
          ctx.beginPath();
          ctx.moveTo(this.xCenter, this.yCenter);
          ctx.lineTo(position.x, position.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    drawBorder() {
    }
    drawLabels() {
      const ctx = this.ctx;
      const opts = this.options;
      const tickOpts = opts.ticks;
      if (!tickOpts.display) {
        return;
      }
      const startAngle = this.getIndexAngle(0);
      let offset, width;
      ctx.save();
      ctx.translate(this.xCenter, this.yCenter);
      ctx.rotate(startAngle);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.ticks.forEach((tick, index2) => {
        if (index2 === 0 && this.min >= 0 && !opts.reverse) {
          return;
        }
        const optsAtIndex = tickOpts.setContext(this.getContext(index2));
        const tickFont = toFont(optsAtIndex.font);
        offset = this.getDistanceFromCenterForValue(this.ticks[index2].value);
        if (optsAtIndex.showLabelBackdrop) {
          ctx.font = tickFont.string;
          width = ctx.measureText(tick.label).width;
          ctx.fillStyle = optsAtIndex.backdropColor;
          const padding = toPadding(optsAtIndex.backdropPadding);
          ctx.fillRect(-width / 2 - padding.left, -offset - tickFont.size / 2 - padding.top, width + padding.width, tickFont.size + padding.height);
        }
        renderText(ctx, tick.label, 0, -offset, tickFont, {
          color: optsAtIndex.color,
          strokeColor: optsAtIndex.textStrokeColor,
          strokeWidth: optsAtIndex.textStrokeWidth
        });
      });
      ctx.restore();
    }
    drawTitle() {
    }
  };
  __publicField(RadialLinearScale, "id", "radialLinear");
  __publicField(RadialLinearScale, "defaults", {
    display: true,
    animate: true,
    position: "chartArea",
    angleLines: {
      display: true,
      lineWidth: 1,
      borderDash: [],
      borderDashOffset: 0
    },
    grid: {
      circular: false
    },
    startAngle: 0,
    ticks: {
      showLabelBackdrop: true,
      callback: Ticks.formatters.numeric
    },
    pointLabels: {
      backdropColor: void 0,
      backdropPadding: 2,
      display: true,
      font: {
        size: 10
      },
      callback(label) {
        return label;
      },
      padding: 5,
      centerPointLabels: false
    }
  });
  __publicField(RadialLinearScale, "defaultRoutes", {
    "angleLines.color": "borderColor",
    "pointLabels.color": "color",
    "ticks.color": "color"
  });
  __publicField(RadialLinearScale, "descriptors", {
    angleLines: {
      _fallback: "grid"
    }
  });
  var INTERVALS = {
    millisecond: {
      common: true,
      size: 1,
      steps: 1e3
    },
    second: {
      common: true,
      size: 1e3,
      steps: 60
    },
    minute: {
      common: true,
      size: 6e4,
      steps: 60
    },
    hour: {
      common: true,
      size: 36e5,
      steps: 24
    },
    day: {
      common: true,
      size: 864e5,
      steps: 30
    },
    week: {
      common: false,
      size: 6048e5,
      steps: 4
    },
    month: {
      common: true,
      size: 2628e6,
      steps: 12
    },
    quarter: {
      common: false,
      size: 7884e6,
      steps: 4
    },
    year: {
      common: true,
      size: 3154e7
    }
  };
  var UNITS = /* @__PURE__ */ Object.keys(INTERVALS);
  function sorter(a, b) {
    return a - b;
  }
  function parse(scale, input) {
    if (isNullOrUndef(input)) {
      return null;
    }
    const adapter = scale._adapter;
    const { parser: parser2, round: round2, isoWeekday } = scale._parseOpts;
    let value = input;
    if (typeof parser2 === "function") {
      value = parser2(value);
    }
    if (!isNumberFinite(value)) {
      value = typeof parser2 === "string" ? adapter.parse(value, parser2) : adapter.parse(value);
    }
    if (value === null) {
      return null;
    }
    if (round2) {
      value = round2 === "week" && (isNumber(isoWeekday) || isoWeekday === true) ? adapter.startOf(value, "isoWeek", isoWeekday) : adapter.startOf(value, round2);
    }
    return +value;
  }
  function determineUnitForAutoTicks(minUnit, min, max, capacity) {
    const ilen = UNITS.length;
    for (let i = UNITS.indexOf(minUnit); i < ilen - 1; ++i) {
      const interval = INTERVALS[UNITS[i]];
      const factor = interval.steps ? interval.steps : Number.MAX_SAFE_INTEGER;
      if (interval.common && Math.ceil((max - min) / (factor * interval.size)) <= capacity) {
        return UNITS[i];
      }
    }
    return UNITS[ilen - 1];
  }
  function determineUnitForFormatting(scale, numTicks, minUnit, min, max) {
    for (let i = UNITS.length - 1; i >= UNITS.indexOf(minUnit); i--) {
      const unit = UNITS[i];
      if (INTERVALS[unit].common && scale._adapter.diff(max, min, unit) >= numTicks - 1) {
        return unit;
      }
    }
    return UNITS[minUnit ? UNITS.indexOf(minUnit) : 0];
  }
  function determineMajorUnit(unit) {
    for (let i = UNITS.indexOf(unit) + 1, ilen = UNITS.length; i < ilen; ++i) {
      if (INTERVALS[UNITS[i]].common) {
        return UNITS[i];
      }
    }
  }
  function addTick(ticks, time, timestamps) {
    if (!timestamps) {
      ticks[time] = true;
    } else if (timestamps.length) {
      const { lo, hi } = _lookup(timestamps, time);
      const timestamp = timestamps[lo] >= time ? timestamps[lo] : timestamps[hi];
      ticks[timestamp] = true;
    }
  }
  function setMajorTicks(scale, ticks, map2, majorUnit) {
    const adapter = scale._adapter;
    const first = +adapter.startOf(ticks[0].value, majorUnit);
    const last = ticks[ticks.length - 1].value;
    let major, index2;
    for (major = first; major <= last; major = +adapter.add(major, 1, majorUnit)) {
      index2 = map2[major];
      if (index2 >= 0) {
        ticks[index2].major = true;
      }
    }
    return ticks;
  }
  function ticksFromTimestamps(scale, values, majorUnit) {
    const ticks = [];
    const map2 = {};
    const ilen = values.length;
    let i, value;
    for (i = 0; i < ilen; ++i) {
      value = values[i];
      map2[value] = i;
      ticks.push({
        value,
        major: false
      });
    }
    return ilen === 0 || !majorUnit ? ticks : setMajorTicks(scale, ticks, map2, majorUnit);
  }
  var TimeScale = class extends Scale {
    constructor(props) {
      super(props);
      this._cache = {
        data: [],
        labels: [],
        all: []
      };
      this._unit = "day";
      this._majorUnit = void 0;
      this._offsets = {};
      this._normalized = false;
      this._parseOpts = void 0;
    }
    init(scaleOpts, opts = {}) {
      const time = scaleOpts.time || (scaleOpts.time = {});
      const adapter = this._adapter = new adapters._date(scaleOpts.adapters.date);
      adapter.init(opts);
      mergeIf(time.displayFormats, adapter.formats());
      this._parseOpts = {
        parser: time.parser,
        round: time.round,
        isoWeekday: time.isoWeekday
      };
      super.init(scaleOpts);
      this._normalized = opts.normalized;
    }
    parse(raw, index2) {
      if (raw === void 0) {
        return null;
      }
      return parse(this, raw);
    }
    beforeLayout() {
      super.beforeLayout();
      this._cache = {
        data: [],
        labels: [],
        all: []
      };
    }
    determineDataLimits() {
      const options = this.options;
      const adapter = this._adapter;
      const unit = options.time.unit || "day";
      let { min, max, minDefined, maxDefined } = this.getUserBounds();
      function _applyBounds(bounds) {
        if (!minDefined && !isNaN(bounds.min)) {
          min = Math.min(min, bounds.min);
        }
        if (!maxDefined && !isNaN(bounds.max)) {
          max = Math.max(max, bounds.max);
        }
      }
      if (!minDefined || !maxDefined) {
        _applyBounds(this._getLabelBounds());
        if (options.bounds !== "ticks" || options.ticks.source !== "labels") {
          _applyBounds(this.getMinMax(false));
        }
      }
      min = isNumberFinite(min) && !isNaN(min) ? min : +adapter.startOf(Date.now(), unit);
      max = isNumberFinite(max) && !isNaN(max) ? max : +adapter.endOf(Date.now(), unit) + 1;
      this.min = Math.min(min, max - 1);
      this.max = Math.max(min + 1, max);
    }
    _getLabelBounds() {
      const arr = this.getLabelTimestamps();
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      if (arr.length) {
        min = arr[0];
        max = arr[arr.length - 1];
      }
      return {
        min,
        max
      };
    }
    buildTicks() {
      const options = this.options;
      const timeOpts = options.time;
      const tickOpts = options.ticks;
      const timestamps = tickOpts.source === "labels" ? this.getLabelTimestamps() : this._generate();
      if (options.bounds === "ticks" && timestamps.length) {
        this.min = this._userMin || timestamps[0];
        this.max = this._userMax || timestamps[timestamps.length - 1];
      }
      const min = this.min;
      const max = this.max;
      const ticks = _filterBetween(timestamps, min, max);
      this._unit = timeOpts.unit || (tickOpts.autoSkip ? determineUnitForAutoTicks(timeOpts.minUnit, this.min, this.max, this._getLabelCapacity(min)) : determineUnitForFormatting(this, ticks.length, timeOpts.minUnit, this.min, this.max));
      this._majorUnit = !tickOpts.major.enabled || this._unit === "year" ? void 0 : determineMajorUnit(this._unit);
      this.initOffsets(timestamps);
      if (options.reverse) {
        ticks.reverse();
      }
      return ticksFromTimestamps(this, ticks, this._majorUnit);
    }
    afterAutoSkip() {
      if (this.options.offsetAfterAutoskip) {
        this.initOffsets(this.ticks.map((tick) => +tick.value));
      }
    }
    initOffsets(timestamps = []) {
      let start = 0;
      let end = 0;
      let first, last;
      if (this.options.offset && timestamps.length) {
        first = this.getDecimalForValue(timestamps[0]);
        if (timestamps.length === 1) {
          start = 1 - first;
        } else {
          start = (this.getDecimalForValue(timestamps[1]) - first) / 2;
        }
        last = this.getDecimalForValue(timestamps[timestamps.length - 1]);
        if (timestamps.length === 1) {
          end = last;
        } else {
          end = (last - this.getDecimalForValue(timestamps[timestamps.length - 2])) / 2;
        }
      }
      const limit = timestamps.length < 3 ? 0.5 : 0.25;
      start = _limitValue(start, 0, limit);
      end = _limitValue(end, 0, limit);
      this._offsets = {
        start,
        end,
        factor: 1 / (start + 1 + end)
      };
    }
    _generate() {
      const adapter = this._adapter;
      const min = this.min;
      const max = this.max;
      const options = this.options;
      const timeOpts = options.time;
      const minor = timeOpts.unit || determineUnitForAutoTicks(timeOpts.minUnit, min, max, this._getLabelCapacity(min));
      const stepSize = valueOrDefault(options.ticks.stepSize, 1);
      const weekday = minor === "week" ? timeOpts.isoWeekday : false;
      const hasWeekday = isNumber(weekday) || weekday === true;
      const ticks = {};
      let first = min;
      let time, count;
      if (hasWeekday) {
        first = +adapter.startOf(first, "isoWeek", weekday);
      }
      first = +adapter.startOf(first, hasWeekday ? "day" : minor);
      if (adapter.diff(max, min, minor) > 1e5 * stepSize) {
        throw new Error(min + " and " + max + " are too far apart with stepSize of " + stepSize + " " + minor);
      }
      const timestamps = options.ticks.source === "data" && this.getDataTimestamps();
      for (time = first, count = 0; time < max; time = +adapter.add(time, stepSize, minor), count++) {
        addTick(ticks, time, timestamps);
      }
      if (time === max || options.bounds === "ticks" || count === 1) {
        addTick(ticks, time, timestamps);
      }
      return Object.keys(ticks).sort(sorter).map((x) => +x);
    }
    getLabelForValue(value) {
      const adapter = this._adapter;
      const timeOpts = this.options.time;
      if (timeOpts.tooltipFormat) {
        return adapter.format(value, timeOpts.tooltipFormat);
      }
      return adapter.format(value, timeOpts.displayFormats.datetime);
    }
    format(value, format) {
      const options = this.options;
      const formats = options.time.displayFormats;
      const unit = this._unit;
      const fmt = format || formats[unit];
      return this._adapter.format(value, fmt);
    }
    _tickFormatFunction(time, index2, ticks, format) {
      const options = this.options;
      const formatter = options.ticks.callback;
      if (formatter) {
        return callback(formatter, [
          time,
          index2,
          ticks
        ], this);
      }
      const formats = options.time.displayFormats;
      const unit = this._unit;
      const majorUnit = this._majorUnit;
      const minorFormat = unit && formats[unit];
      const majorFormat = majorUnit && formats[majorUnit];
      const tick = ticks[index2];
      const major = majorUnit && majorFormat && tick && tick.major;
      return this._adapter.format(time, format || (major ? majorFormat : minorFormat));
    }
    generateTickLabels(ticks) {
      let i, ilen, tick;
      for (i = 0, ilen = ticks.length; i < ilen; ++i) {
        tick = ticks[i];
        tick.label = this._tickFormatFunction(tick.value, i, ticks);
      }
    }
    getDecimalForValue(value) {
      return value === null ? NaN : (value - this.min) / (this.max - this.min);
    }
    getPixelForValue(value) {
      const offsets = this._offsets;
      const pos = this.getDecimalForValue(value);
      return this.getPixelForDecimal((offsets.start + pos) * offsets.factor);
    }
    getValueForPixel(pixel) {
      const offsets = this._offsets;
      const pos = this.getDecimalForPixel(pixel) / offsets.factor - offsets.end;
      return this.min + pos * (this.max - this.min);
    }
    _getLabelSize(label) {
      const ticksOpts = this.options.ticks;
      const tickLabelWidth = this.ctx.measureText(label).width;
      const angle = toRadians(this.isHorizontal() ? ticksOpts.maxRotation : ticksOpts.minRotation);
      const cosRotation = Math.cos(angle);
      const sinRotation = Math.sin(angle);
      const tickFontSize = this._resolveTickFontOptions(0).size;
      return {
        w: tickLabelWidth * cosRotation + tickFontSize * sinRotation,
        h: tickLabelWidth * sinRotation + tickFontSize * cosRotation
      };
    }
    _getLabelCapacity(exampleTime) {
      const timeOpts = this.options.time;
      const displayFormats = timeOpts.displayFormats;
      const format = displayFormats[timeOpts.unit] || displayFormats.millisecond;
      const exampleLabel = this._tickFormatFunction(exampleTime, 0, ticksFromTimestamps(this, [
        exampleTime
      ], this._majorUnit), format);
      const size = this._getLabelSize(exampleLabel);
      const capacity = Math.floor(this.isHorizontal() ? this.width / size.w : this.height / size.h) - 1;
      return capacity > 0 ? capacity : 1;
    }
    getDataTimestamps() {
      let timestamps = this._cache.data || [];
      let i, ilen;
      if (timestamps.length) {
        return timestamps;
      }
      const metas = this.getMatchingVisibleMetas();
      if (this._normalized && metas.length) {
        return this._cache.data = metas[0].controller.getAllParsedValues(this);
      }
      for (i = 0, ilen = metas.length; i < ilen; ++i) {
        timestamps = timestamps.concat(metas[i].controller.getAllParsedValues(this));
      }
      return this._cache.data = this.normalize(timestamps);
    }
    getLabelTimestamps() {
      const timestamps = this._cache.labels || [];
      let i, ilen;
      if (timestamps.length) {
        return timestamps;
      }
      const labels = this.getLabels();
      for (i = 0, ilen = labels.length; i < ilen; ++i) {
        timestamps.push(parse(this, labels[i]));
      }
      return this._cache.labels = this._normalized ? timestamps : this.normalize(timestamps);
    }
    normalize(values) {
      return _arrayUnique(values.sort(sorter));
    }
  };
  __publicField(TimeScale, "id", "time");
  __publicField(TimeScale, "defaults", {
    bounds: "data",
    adapters: {},
    time: {
      parser: false,
      unit: false,
      round: false,
      isoWeekday: false,
      minUnit: "millisecond",
      displayFormats: {}
    },
    ticks: {
      source: "auto",
      callback: false,
      major: {
        enabled: false
      }
    }
  });
  function interpolate2(table, val, reverse) {
    let lo = 0;
    let hi = table.length - 1;
    let prevSource, nextSource, prevTarget, nextTarget;
    if (reverse) {
      if (val >= table[lo].pos && val <= table[hi].pos) {
        ({ lo, hi } = _lookupByKey(table, "pos", val));
      }
      ({ pos: prevSource, time: prevTarget } = table[lo]);
      ({ pos: nextSource, time: nextTarget } = table[hi]);
    } else {
      if (val >= table[lo].time && val <= table[hi].time) {
        ({ lo, hi } = _lookupByKey(table, "time", val));
      }
      ({ time: prevSource, pos: prevTarget } = table[lo]);
      ({ time: nextSource, pos: nextTarget } = table[hi]);
    }
    const span = nextSource - prevSource;
    return span ? prevTarget + (nextTarget - prevTarget) * (val - prevSource) / span : prevTarget;
  }
  var TimeSeriesScale = class extends TimeScale {
    constructor(props) {
      super(props);
      this._table = [];
      this._minPos = void 0;
      this._tableRange = void 0;
    }
    initOffsets() {
      const timestamps = this._getTimestampsForTable();
      const table = this._table = this.buildLookupTable(timestamps);
      this._minPos = interpolate2(table, this.min);
      this._tableRange = interpolate2(table, this.max) - this._minPos;
      super.initOffsets(timestamps);
    }
    buildLookupTable(timestamps) {
      const { min, max } = this;
      const items = [];
      const table = [];
      let i, ilen, prev, curr, next;
      for (i = 0, ilen = timestamps.length; i < ilen; ++i) {
        curr = timestamps[i];
        if (curr >= min && curr <= max) {
          items.push(curr);
        }
      }
      if (items.length < 2) {
        return [
          {
            time: min,
            pos: 0
          },
          {
            time: max,
            pos: 1
          }
        ];
      }
      for (i = 0, ilen = items.length; i < ilen; ++i) {
        next = items[i + 1];
        prev = items[i - 1];
        curr = items[i];
        if (Math.round((next + prev) / 2) !== curr) {
          table.push({
            time: curr,
            pos: i / (ilen - 1)
          });
        }
      }
      return table;
    }
    _generate() {
      const min = this.min;
      const max = this.max;
      let timestamps = super.getDataTimestamps();
      if (!timestamps.includes(min) || !timestamps.length) {
        timestamps.splice(0, 0, min);
      }
      if (!timestamps.includes(max) || timestamps.length === 1) {
        timestamps.push(max);
      }
      return timestamps.sort((a, b) => a - b);
    }
    _getTimestampsForTable() {
      let timestamps = this._cache.all || [];
      if (timestamps.length) {
        return timestamps;
      }
      const data = this.getDataTimestamps();
      const label = this.getLabelTimestamps();
      if (data.length && label.length) {
        timestamps = this.normalize(data.concat(label));
      } else {
        timestamps = data.length ? data : label;
      }
      timestamps = this._cache.all = timestamps;
      return timestamps;
    }
    getDecimalForValue(value) {
      return (interpolate2(this._table, value) - this._minPos) / this._tableRange;
    }
    getValueForPixel(pixel) {
      const offsets = this._offsets;
      const decimal = this.getDecimalForPixel(pixel) / offsets.factor - offsets.end;
      return interpolate2(this._table, decimal * this._tableRange + this._minPos, true);
    }
  };
  __publicField(TimeSeriesScale, "id", "timeseries");
  __publicField(TimeSeriesScale, "defaults", TimeScale.defaults);

  // media/chartManager.ts
  Chart.register(
    BarController,
    LineController,
    PieController,
    ScatterController,
    DoughnutController,
    RadarController,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    index,
    CategoryScale,
    LinearScale,
    plugin_title,
    plugin_tooltip,
    plugin_legend
  );
  var DEFAULT_COLORS = [
    "#4472C4",
    "#ED7D31",
    "#A5A5A5",
    "#FFC000",
    "#5B9BD5",
    "#70AD47",
    "#264478",
    "#9B57A1",
    "#636363",
    "#FF585D",
    "#7030A0",
    "#00B0F0"
  ];
  var ChartOverlay = class {
    constructor(def, index2, wrapper, onSelect, onDelete, onDblClick) {
      this.selected = false;
      this.handles = [];
      this.def = def;
      this.index = index2;
      this.container = document.createElement("div");
      this.container.className = "chart-overlay";
      this.container.style.cssText = "position:absolute;z-index:10;pointer-events:auto;overflow:hidden;";
      this.chartCanvas = document.createElement("canvas");
      this.chartCanvas.style.cssText = "width:100%;height:100%;display:block;";
      this.container.appendChild(this.chartCanvas);
      wrapper.appendChild(this.container);
      const config = buildChartConfig(def);
      this.chart = new Chart(this.chartCanvas, config);
      this.createHandles();
      this.container.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        onSelect(this.index);
      });
      this.container.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        onDblClick(this.index);
      });
      this.container.addEventListener("keydown", (e) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onDelete(this.index);
        }
      });
      this.container.tabIndex = -1;
    }
    createHandles() {
      const positions2 = [
        { cursor: "nw-resize", top: "-4px", left: "-4px" },
        { cursor: "n-resize", top: "-4px", left: "calc(50% - 4px)" },
        { cursor: "ne-resize", top: "-4px", right: "-4px" },
        { cursor: "w-resize", top: "calc(50% - 4px)", left: "-4px" },
        { cursor: "e-resize", top: "calc(50% - 4px)", right: "-4px" },
        { cursor: "sw-resize", bottom: "-4px", left: "-4px" },
        { cursor: "s-resize", bottom: "-4px", left: "calc(50% - 4px)" },
        { cursor: "se-resize", bottom: "-4px", right: "-4px" }
      ];
      for (const pos of positions2) {
        const h = document.createElement("div");
        h.className = "chart-resize-handle";
        h.style.cssText = "position:absolute;width:8px;height:8px;display:none;";
        h.style.cursor = pos.cursor;
        if ("top" in pos && pos.top) h.style.top = pos.top;
        if ("bottom" in pos && pos.bottom) h.style.bottom = pos.bottom;
        if ("left" in pos && pos.left) h.style.left = pos.left;
        if ("right" in pos && pos.right) h.style.right = pos.right;
        this.container.appendChild(h);
        this.handles.push(h);
      }
    }
    setSelected(sel) {
      this.selected = sel;
      this.container.classList.toggle("selected", sel);
      for (const h of this.handles) {
        h.style.display = sel ? "block" : "none";
      }
      if (sel) this.container.focus();
    }
    updatePosition(coords) {
      const a = this.def.anchor;
      const scrollL = coords.getScrollLeft();
      const scrollT = coords.getScrollTop();
      const headerW = coords.getHeaderWidth();
      const headerH = coords.getHeaderHeight();
      const x1 = coords.cx(a.from_col) - scrollL + headerW;
      const y1 = coords.ry(a.from_row) - scrollT + headerH;
      const x2 = coords.cx(a.to_col) - scrollL + headerW;
      const y2 = coords.ry(a.to_row) - scrollT + headerH;
      const w = Math.max(x2 - x1, 100);
      const h = Math.max(y2 - y1, 80);
      this.container.style.left = `${x1}px`;
      this.container.style.top = `${y1}px`;
      this.container.style.width = `${w}px`;
      this.container.style.height = `${h}px`;
      const visible = x2 > headerW && y2 > headerH;
      this.container.style.display = visible ? "block" : "none";
      this.chart.resize();
    }
    destroy() {
      this.chart.destroy();
      this.container.remove();
    }
  };
  var ChartManager = class {
    constructor(wrapper, onAction) {
      this.overlays = [];
      this.selectedIndex = -1;
      // Drag state
      this.dragMode = null;
      this.dragOverlay = null;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragOrigLeft = 0;
      this.dragOrigTop = 0;
      this.dragOrigWidth = 0;
      this.dragOrigHeight = 0;
      this.dragOrigAnchor = null;
      this.dragHandle = "";
      this.dragCoords = null;
      this.onMouseMove = (e) => {
        if (!this.dragMode || !this.dragOverlay || !this.dragOrigAnchor) return;
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        const style = this.dragOverlay.container.style;
        const wrapperW = this.wrapper.clientWidth;
        const wrapperH = this.wrapper.clientHeight;
        const headerW = this.dragCoords ? this.dragCoords.getHeaderWidth() : 40;
        const headerH = this.dragCoords ? this.dragCoords.getHeaderHeight() : 24;
        const minSize = 80;
        if (this.dragMode === "move") {
          let newLeft = this.dragOrigLeft + dx;
          let newTop = this.dragOrigTop + dy;
          const w = this.dragOrigWidth;
          const h = this.dragOrigHeight;
          newLeft = Math.max(headerW, Math.min(newLeft, wrapperW - 40));
          newTop = Math.max(headerH, Math.min(newTop, wrapperH - 40));
          newLeft = Math.min(newLeft, wrapperW - Math.min(w, 40));
          newTop = Math.min(newTop, wrapperH - Math.min(h, 40));
          style.left = `${newLeft}px`;
          style.top = `${newTop}px`;
        } else if (this.dragMode === "resize") {
          const handle = this.dragHandle;
          let left = this.dragOrigLeft;
          let top = this.dragOrigTop;
          let width = this.dragOrigWidth;
          let height = this.dragOrigHeight;
          if (handle.includes("e")) width = Math.max(minSize, this.dragOrigWidth + dx);
          if (handle.includes("s")) height = Math.max(minSize, this.dragOrigHeight + dy);
          if (handle.includes("w")) {
            const newW = Math.max(minSize, this.dragOrigWidth - dx);
            left = this.dragOrigLeft + (this.dragOrigWidth - newW);
            left = Math.max(headerW, left);
            width = newW;
          }
          if (handle.includes("n")) {
            const newH = Math.max(minSize, this.dragOrigHeight - dy);
            top = this.dragOrigTop + (this.dragOrigHeight - newH);
            top = Math.max(headerH, top);
            height = newH;
          }
          style.left = `${left}px`;
          style.top = `${top}px`;
          style.width = `${width}px`;
          style.height = `${height}px`;
          this.dragOverlay.chart.resize();
        }
      };
      this.onMouseUp = (_e) => {
        if (this.dragMode && this.dragOverlay && this.dragCoords) {
          const style = this.dragOverlay.container.style;
          const left = parseInt(style.left) || 0;
          const top = parseInt(style.top) || 0;
          const width = parseInt(style.width) || 400;
          const height = parseInt(style.height) || 300;
          const coords = this.dragCoords;
          const scrollL = coords.getScrollLeft();
          const scrollT = coords.getScrollTop();
          const headerW = coords.getHeaderWidth();
          const headerH = coords.getHeaderHeight();
          const pixelX1 = left - headerW + scrollL;
          const pixelY1 = top - headerH + scrollT;
          const pixelX2 = pixelX1 + width;
          const pixelY2 = pixelY1 + height;
          const a = this.dragOverlay.def.anchor;
          a.from_col = this.pixelToCol(pixelX1, coords);
          a.from_row = this.pixelToRow(pixelY1, coords);
          a.to_col = Math.max(a.from_col + 2, this.pixelToCol(pixelX2, coords));
          a.to_row = Math.max(a.from_row + 2, this.pixelToRow(pixelY2, coords));
          this.onAction("moved", this.dragOverlay.index, this.dragOverlay.def);
        }
        this.dragMode = null;
        this.dragOverlay = null;
        this.dragOrigAnchor = null;
        this.dragCoords = null;
      };
      this.wrapper = wrapper;
      this.onAction = onAction;
      window.addEventListener("mousemove", this.onMouseMove);
      window.addEventListener("mouseup", this.onMouseUp);
    }
    syncCharts(charts, coords) {
      for (const o of this.overlays) o.destroy();
      this.overlays = [];
      this.selectedIndex = -1;
      if (!charts || charts.length === 0) return;
      for (let i = 0; i < charts.length; i++) {
        const overlay = new ChartOverlay(
          charts[i],
          i,
          this.wrapper,
          (idx) => this.selectChart(idx),
          (idx) => this.deleteChart(idx),
          (idx) => this.onAction("editChart", idx, this.overlays[idx]?.def)
        );
        overlay.updatePosition(coords);
        this.setupDrag(overlay, coords);
        this.overlays.push(overlay);
      }
    }
    updatePositions(coords) {
      for (const o of this.overlays) {
        o.updatePosition(coords);
      }
    }
    selectChart(index2) {
      this.selectedIndex = index2;
      for (let i = 0; i < this.overlays.length; i++) {
        this.overlays[i].setSelected(i === index2);
      }
      this.onAction("select", index2);
    }
    deselectAll() {
      this.selectedIndex = -1;
      for (const o of this.overlays) o.setSelected(false);
    }
    deleteChart(index2) {
      this.onAction("delete", index2);
    }
    getSelectedIndex() {
      return this.selectedIndex;
    }
    setupDrag(overlay, coords) {
      overlay.container.addEventListener("mousedown", (e) => {
        const target = e.target;
        if (target.classList.contains("chart-resize-handle")) {
          this.dragMode = "resize";
          this.dragHandle = target.style.cursor;
        } else {
          this.dragMode = "move";
        }
        this.dragOverlay = overlay;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragOrigLeft = parseInt(overlay.container.style.left) || 0;
        this.dragOrigTop = parseInt(overlay.container.style.top) || 0;
        this.dragOrigWidth = parseInt(overlay.container.style.width) || 400;
        this.dragOrigHeight = parseInt(overlay.container.style.height) || 300;
        this.dragOrigAnchor = { ...overlay.def.anchor };
        this.dragCoords = coords;
        e.stopPropagation();
        e.preventDefault();
      });
    }
    pixelToCol(px, coords) {
      for (let c = 0; c < 200; c++) {
        if (coords.cx(c) + coords.cw(c) > px) return Math.max(0, c);
      }
      return 0;
    }
    pixelToRow(px, coords) {
      for (let r = 0; r < 500; r++) {
        if (coords.ry(r) + coords.rh(r) > px) return Math.max(0, r);
      }
      return 0;
    }
    destroy() {
      for (const o of this.overlays) o.destroy();
      this.overlays = [];
      window.removeEventListener("mousemove", this.onMouseMove);
      window.removeEventListener("mouseup", this.onMouseUp);
    }
  };
  function buildChartConfig(def) {
    const chartType = mapChartType(def.chart_type);
    const isCategorical = chartType !== "scatter";
    let labels = [];
    for (const s of def.series) {
      if (s.categories_cache && s.categories_cache.length > 0) {
        labels = s.categories_cache;
        break;
      }
    }
    const datasets = def.series.map((s, i) => {
      const ds = {
        label: s.name || `Series ${i + 1}`,
        data: chartType === "scatter" ? s.values_cache.map((v, j) => ({
          x: s.categories_cache?.[j] ? parseFloat(s.categories_cache[j]) || j : j,
          y: v
        })) : s.values_cache,
        backgroundColor: getColor(i, chartType === "pie" || chartType === "doughnut" ? s.values_cache.length : 1),
        borderColor: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        borderWidth: chartType === "bar" || chartType === "pie" || chartType === "doughnut" ? 1 : 2
      };
      if (chartType === "line" || def.chart_type === "area") {
        ds.fill = def.chart_type === "area";
        ds.tension = 0.3;
        ds.pointRadius = 3;
      }
      if (s.chart_type) {
        ds.type = mapChartType(s.chart_type);
      }
      return ds;
    });
    const config = {
      type: chartType,
      data: {
        labels: isCategorical ? labels : void 0,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          title: {
            display: !!def.title,
            text: def.title || "",
            color: "#cccccc",
            font: { size: 14, weight: "bold" }
          },
          legend: {
            display: def.legend?.visible !== false,
            position: mapLegendPosition(def.legend?.position),
            labels: { color: "#cccccc", font: { size: 11 } }
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {}
      }
    };
    if (chartType !== "pie" && chartType !== "doughnut" && chartType !== "radar") {
      const xAxis = {
        ticks: { color: "#999" },
        grid: { color: "rgba(255,255,255,0.08)" }
      };
      const yAxis = {
        ticks: { color: "#999" },
        grid: { color: "rgba(255,255,255,0.08)" }
      };
      for (const ax of def.axes) {
        const target = ax.axis_type === "category" ? xAxis : yAxis;
        if (ax.title) {
          target.title = { display: true, text: ax.title, color: "#ccc" };
        }
        if (ax.min_val !== void 0) target.min = ax.min_val;
        if (ax.max_val !== void 0) target.max = ax.max_val;
      }
      config.options.scales = { x: xAxis, y: yAxis };
    }
    return config;
  }
  function mapChartType(type) {
    switch (type) {
      case "bar":
      case "column":
        return "bar";
      case "line":
        return "line";
      case "area":
        return "line";
      case "pie":
        return "pie";
      case "doughnut":
        return "doughnut";
      case "scatter":
        return "scatter";
      case "radar":
        return "radar";
      default:
        return "bar";
    }
  }
  function mapLegendPosition(pos) {
    switch (pos) {
      case "top":
        return "top";
      case "bottom":
        return "bottom";
      case "left":
        return "left";
      case "right":
        return "right";
      default:
        return "right";
    }
  }
  function getColor(index2, count) {
    if (count > 1) {
      return Array.from({ length: count }, (_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
    }
    return DEFAULT_COLORS[index2 % DEFAULT_COLORS.length];
  }

  // media/chartWizardDialog.ts
  var CHART_TYPES = [
    { id: "column", label: "Column", icon: "\u2581\u2583\u2585\u2587" },
    { id: "bar", label: "Bar", icon: "\u2590\u2590\u2590" },
    { id: "line", label: "Line", icon: "\u2571\u2572\u2571" },
    { id: "area", label: "Area", icon: "\u25E2\u25E3" },
    { id: "pie", label: "Pie", icon: "\u25D5" },
    { id: "doughnut", label: "Donut", icon: "\u25CE" },
    { id: "scatter", label: "Scatter", icon: "\u2022\u2022\u2022" },
    { id: "radar", label: "Radar", icon: "\u25CB" }
  ];
  var LEGEND_POSITIONS = [
    { id: "right", label: "Right" },
    { id: "top", label: "Top" },
    { id: "bottom", label: "Bottom" },
    { id: "left", label: "Left" },
    { id: "none", label: "None" }
  ];
  var COLOR_SCHEMES = [
    { id: "default", label: "Default", colors: ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"] },
    { id: "blue", label: "Ocean", colors: ["#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8", "#023E8A", "#03045E"] },
    { id: "warm", label: "Warm", colors: ["#FF595E", "#FFCA3A", "#FF924C", "#C8553D", "#8AC926", "#FF6B6B"] },
    { id: "mono", label: "Monochrome", colors: ["#2B2D42", "#8D99AE", "#EDF2F4", "#4A4E69", "#C9CCD5", "#636363"] },
    { id: "nature", label: "Nature", colors: ["#386641", "#6A994E", "#A7C957", "#F2E8CF", "#BC4749", "#774936"] }
  ];
  var ChartWizardDialog = class {
    constructor(_parent, onAction) {
      // State
      this.selectedType = "column";
      this.titleInput = null;
      this.rangeInput = null;
      this.legendSelect = null;
      this.colorSchemeSelect = null;
      this.xAxisInput = null;
      this.yAxisInput = null;
      this.swapRowsCols = null;
      this.onAction = onAction;
      this.overlay = document.createElement("div");
      this.overlay.className = "chart-wizard-overlay";
      this.overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:none;z-index:10000;align-items:center;justify-content:center;";
      this.overlay.addEventListener("mousedown", (e) => {
        if (e.target === this.overlay) this.hide();
      });
      this.dialog = document.createElement("div");
      this.dialog.className = "chart-wizard-dialog";
      this.overlay.appendChild(this.dialog);
      document.body.appendChild(this.overlay);
    }
    show(defaultRange, anchorRow, anchorCol, editDef, editIndex) {
      this.editIndex = editIndex;
      this.selectedType = editDef?.chart_type || "column";
      this.buildUI(defaultRange, anchorRow, anchorCol, editDef);
      this.overlay.style.display = "flex";
    }
    hide() {
      this.overlay.style.display = "none";
    }
    isVisible() {
      return this.overlay.style.display !== "none";
    }
    buildUI(defaultRange, anchorRow, anchorCol, editDef) {
      const d = this.dialog;
      d.innerHTML = "";
      d.style.cssText = "background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007acc);border-radius:8px;padding:20px;min-width:500px;max-width:600px;box-shadow:0 8px 32px rgba(0,0,0,0.5);color:var(--vscode-foreground,#ccc);font-size:13px;";
      const titleBar = document.createElement("div");
      titleBar.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;";
      const title = document.createElement("div");
      title.textContent = editDef ? "Edit Chart" : "Insert Chart";
      title.style.cssText = "font-size:16px;font-weight:600;";
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "\u2715";
      closeBtn.style.cssText = "background:none;border:none;color:var(--vscode-foreground,#ccc);font-size:16px;cursor:pointer;padding:4px;";
      closeBtn.onclick = () => this.hide();
      titleBar.appendChild(title);
      titleBar.appendChild(closeBtn);
      d.appendChild(titleBar);
      const section1 = this.section("Chart Type");
      const typeGrid = document.createElement("div");
      typeGrid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;";
      for (const ct of CHART_TYPES) {
        const btn = document.createElement("button");
        btn.className = `chart-type-btn${ct.id === this.selectedType ? " selected" : ""}`;
        btn.style.cssText = `padding:8px 4px;border:2px solid ${ct.id === this.selectedType ? "var(--vscode-focusBorder,#007acc)" : "var(--vscode-input-border,#555)"};border-radius:6px;background:${ct.id === this.selectedType ? "rgba(0,122,204,0.15)" : "transparent"};color:var(--vscode-foreground,#ccc);cursor:pointer;text-align:center;font-size:11px;`;
        const icon = document.createElement("div");
        icon.textContent = ct.icon;
        icon.style.cssText = "font-size:20px;margin-bottom:2px;";
        const label = document.createElement("div");
        label.textContent = ct.label;
        btn.appendChild(icon);
        btn.appendChild(label);
        btn.onclick = () => {
          this.selectedType = ct.id;
          this.buildUI(this.rangeInput?.value || defaultRange, anchorRow, anchorCol, editDef);
        };
        typeGrid.appendChild(btn);
      }
      section1.appendChild(typeGrid);
      d.appendChild(section1);
      const section2 = this.section("Data Range");
      const rangeRow = document.createElement("div");
      rangeRow.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;";
      const rangeLabel = document.createElement("label");
      rangeLabel.textContent = "Range:";
      rangeLabel.style.cssText = "min-width:50px;";
      this.rangeInput = document.createElement("input");
      this.rangeInput.type = "text";
      this.rangeInput.value = editDef?.series?.[0]?.values_ref?.replace(/.*!/, "") || defaultRange;
      this.rangeInput.placeholder = "e.g., A1:D10";
      this.rangeInput.style.cssText = "flex:1;padding:5px 8px;font-size:13px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;";
      this.rangeInput.addEventListener("keydown", (e) => e.stopPropagation());
      rangeRow.appendChild(rangeLabel);
      rangeRow.appendChild(this.rangeInput);
      section2.appendChild(rangeRow);
      const swapRow = document.createElement("div");
      swapRow.style.cssText = "display:flex;align-items:center;gap:6px;";
      this.swapRowsCols = document.createElement("input");
      this.swapRowsCols.type = "checkbox";
      this.swapRowsCols.id = "swap-rows-cols";
      const swapLabel = document.createElement("label");
      swapLabel.htmlFor = "swap-rows-cols";
      swapLabel.textContent = "Series in rows (instead of columns)";
      swapLabel.style.cssText = "font-size:12px;";
      swapRow.appendChild(this.swapRowsCols);
      swapRow.appendChild(swapLabel);
      section2.appendChild(swapRow);
      d.appendChild(section2);
      const section3 = this.section("Customization");
      const customGrid = document.createElement("div");
      customGrid.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;";
      customGrid.appendChild(this.labelEl("Title:"));
      this.titleInput = document.createElement("input");
      this.titleInput.type = "text";
      this.titleInput.value = editDef?.title || "";
      this.titleInput.placeholder = "Chart title (optional)";
      this.titleInput.style.cssText = "padding:5px 8px;font-size:13px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;";
      this.titleInput.addEventListener("keydown", (e) => e.stopPropagation());
      customGrid.appendChild(this.titleInput);
      customGrid.appendChild(this.labelEl("Legend:"));
      this.legendSelect = document.createElement("select");
      this.legendSelect.style.cssText = "padding:4px 8px;font-size:12px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;";
      for (const lp of LEGEND_POSITIONS) {
        const opt = document.createElement("option");
        opt.value = lp.id;
        opt.textContent = lp.label;
        if (editDef?.legend?.position === lp.id || !editDef && lp.id === "right") opt.selected = true;
        this.legendSelect.appendChild(opt);
      }
      customGrid.appendChild(this.legendSelect);
      customGrid.appendChild(this.labelEl("Colors:"));
      this.colorSchemeSelect = document.createElement("select");
      this.colorSchemeSelect.style.cssText = this.legendSelect.style.cssText;
      for (const cs of COLOR_SCHEMES) {
        const opt = document.createElement("option");
        opt.value = cs.id;
        opt.textContent = cs.label;
        this.colorSchemeSelect.appendChild(opt);
      }
      customGrid.appendChild(this.colorSchemeSelect);
      customGrid.appendChild(this.labelEl("X Axis:"));
      this.xAxisInput = document.createElement("input");
      this.xAxisInput.type = "text";
      this.xAxisInput.placeholder = "X axis label (optional)";
      this.xAxisInput.value = editDef?.axes?.find((a) => a.axis_type === "category")?.title || "";
      this.xAxisInput.style.cssText = this.titleInput.style.cssText;
      this.xAxisInput.addEventListener("keydown", (e) => e.stopPropagation());
      customGrid.appendChild(this.xAxisInput);
      customGrid.appendChild(this.labelEl("Y Axis:"));
      this.yAxisInput = document.createElement("input");
      this.yAxisInput.type = "text";
      this.yAxisInput.placeholder = "Y axis label (optional)";
      this.yAxisInput.value = editDef?.axes?.find((a) => a.axis_type === "value")?.title || "";
      this.yAxisInput.style.cssText = this.titleInput.style.cssText;
      this.yAxisInput.addEventListener("keydown", (e) => e.stopPropagation());
      customGrid.appendChild(this.yAxisInput);
      section3.appendChild(customGrid);
      d.appendChild(section3);
      const footer = document.createElement("div");
      footer.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:16px;";
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "padding:6px 16px;font-size:13px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:4px;cursor:pointer;";
      cancelBtn.onclick = () => {
        this.hide();
        this.onAction({ action: "cancel" });
      };
      const okBtn = document.createElement("button");
      okBtn.textContent = editDef ? "Update Chart" : "Insert Chart";
      okBtn.style.cssText = "padding:6px 16px;font-size:13px;background:var(--vscode-button-background,#007fd4);color:var(--vscode-button-foreground,#fff);border:none;border-radius:4px;cursor:pointer;font-weight:500;";
      okBtn.onclick = () => this.submit(anchorRow, anchorCol);
      footer.appendChild(cancelBtn);
      footer.appendChild(okBtn);
      d.appendChild(footer);
    }
    submit(anchorRow, anchorCol) {
      const range = this.rangeInput?.value || "A1:D10";
      const title = this.titleInput?.value || void 0;
      const legendPos = this.legendSelect?.value || "right";
      const colorSchemeId = this.colorSchemeSelect?.value || "default";
      const xAxisTitle = this.xAxisInput?.value || void 0;
      const yAxisTitle = this.yAxisInput?.value || void 0;
      const colorScheme = COLOR_SCHEMES.find((cs) => cs.id === colorSchemeId)?.colors;
      const anchor = {
        from_col: anchorCol,
        from_row: anchorRow,
        from_col_off: 0,
        from_row_off: 0,
        to_col: anchorCol + 8,
        to_row: anchorRow + 15,
        to_col_off: 0,
        to_row_off: 0
      };
      const series = [{
        values_ref: range,
        categories_cache: [],
        values_cache: []
      }];
      const axes = [];
      if (this.selectedType !== "pie" && this.selectedType !== "doughnut") {
        axes.push({
          title: xAxisTitle,
          position: "bottom",
          axis_type: "category"
        });
        axes.push({
          title: yAxisTitle,
          position: "left",
          axis_type: "value"
        });
      }
      const chartDef = {
        chart_type: this.selectedType,
        series,
        title,
        legend: {
          position: legendPos === "none" ? "right" : legendPos,
          visible: legendPos !== "none"
        },
        axes,
        anchor,
        style: colorScheme ? { color_scheme: colorScheme } : void 0
      };
      this.hide();
      this.onAction({
        action: this.editIndex !== void 0 ? "update" : "insert",
        chartDef,
        editIndex: this.editIndex
      });
    }
    section(title) {
      const sec = document.createElement("div");
      sec.style.cssText = "margin-bottom:14px;";
      const h = document.createElement("div");
      h.textContent = title;
      h.style.cssText = "font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground,#888);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;";
      sec.appendChild(h);
      return sec;
    }
    labelEl(text) {
      const l = document.createElement("label");
      l.textContent = text;
      l.style.cssText = "font-size:12px;color:var(--vscode-descriptionForeground,#aaa);";
      return l;
    }
  };

  // media/main.ts
  var vscode = acquireVsCodeApi();
  var currentFileUri = "";
  var parser = null;
  var writer = null;
  var tableOps = null;
  var formulaEngine = null;
  var renderer = null;
  var contextMenu = null;
  var filterDropdown = null;
  var cfDialog = null;
  var chartManager = null;
  var chartWizard = null;
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
    filterDropdown = new FilterDropdown(document.body, handleFilterDropdownAction);
    cfDialog = new ConditionalFormatDialog(document.body, handleCfDialogAction);
    chartWizard = new ChartWizardDialog(document.body, handleChartWizardAction);
    renderer.onFilterArrowClick = (tableName, colIndex, colName, screenX, screenY) => {
      if (!renderer || !filterDropdown) return;
      const uniqueValues = renderer.getColumnUniqueValues(tableName, colIndex);
      const currentFilter = renderer.getActiveFilter(tableName, colIndex);
      filterDropdown.show(screenX, screenY, tableName, colIndex, colName, uniqueValues, currentFilter);
    };
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
        currentFileUri = message.xlsxUri || "";
        await handleLoad(message.data);
        break;
      case "saveXLSX":
        await handleSave(message.targetUri);
        break;
      case "clearXLSX":
        if (renderer) {
          renderer.setData(null);
        }
        break;
      case "layout":
        renderer?.resize();
        break;
      case "applyEdits":
        if (renderer && message.operations) {
          handleApplyEdits(message.operations);
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
      restoreChartState();
      evaluateFormulas();
      buildSheetTabs();
      syncChartOverlays();
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
    const names2 = renderer.getSheetNames();
    const activeIdx = renderer.getActiveSheetIndex();
    for (let i = 0; i < names2.length; i++) {
      const tab = document.createElement("button");
      tab.className = `sheet-tab${i === activeIdx ? " active" : ""}`;
      tab.textContent = names2[i];
      tab.title = names2[i];
      tab.onclick = () => {
        if (!renderer) return;
        renderer.setActiveSheetIndex(i);
        evaluateFormulas();
        buildSheetTabs();
        syncChartOverlays();
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
    data.sheets.push({ name, cells: {}, row_count: 100, col_count: 26, tables: [], merged_cells: [], charts: [], sparklines: [] });
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
  async function handleSave(targetUri) {
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
      const totalCharts = model.sheets?.reduce((sum, s) => sum + (s.charts?.length ?? 0), 0) ?? 0;
      const chartDebug = model.sheets?.map((s, i) => {
        const charts = s.charts ?? [];
        return `${s.name}: ${charts.length} chart(s)` + (charts.length > 0 ? ` [${charts.map((c) => `${c.chart_type}/${c.series?.length ?? 0}series/${c.series?.[0]?.values_ref ?? "no-ref"}`).join(", ")}]` : "");
      });
      const modelJson = JSON.stringify(model);
      const savedBytes = writer.save(modelJson);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < savedBytes.length; i += chunkSize) {
        const chunk = savedBytes.subarray(i, Math.min(i + chunkSize, savedBytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Data = btoa(binary);
      vscode.postMessage({
        type: "saveData",
        data: base64Data,
        targetUri,
        chartDiag: { totalCharts, sheets: chartDebug }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[XLSX Rust Viewer] Save failed:", message);
      vscode.postMessage({ type: "error", message });
    }
  }
  function handleApplyEdits(operations) {
    if (!renderer) return;
    const model = renderer.getData();
    if (!model?.sheets) return;
    for (const op of operations) {
      const sheetIdx = resolveSheetIndex(model, op.sheet);
      if (sheetIdx < 0 && op.type !== "create_table" && op.type !== "resize_table" && op.type !== "rename_table" && op.type !== "set_table_style" && op.type !== "toggle_table_filter" && op.type !== "set_totals_row" && op.type !== "convert_table_to_range") {
        console.warn("[applyEdits] Sheet not found:", op.sheet);
        continue;
      }
      if (sheetIdx >= 0 && sheetIdx !== renderer.getActiveSheetIndex()) {
        renderer.setActiveSheetIndex(sheetIdx);
      }
      switch (op.type) {
        case "set_cell_value": {
          const ref = parseCellRef(op.cell);
          if (!ref) break;
          const dataType = typeof op.value === "number" ? "n" : "s";
          renderer.updateCell(ref.row, ref.col, String(op.value), dataType);
          break;
        }
        case "set_cell_formula": {
          const ref = parseCellRef(op.cell);
          if (!ref) break;
          renderer.updateCell(ref.row, ref.col, op.formula, "s");
          break;
        }
        case "format_cell": {
          const ref = parseCellRef(op.cell);
          if (!ref) break;
          renderer.setSelection(ref.row, ref.col, ref.row, ref.col);
          if (op.format) {
            if (op.format.bold !== void 0) renderer.toggleFormat("bold");
            if (op.format.italic !== void 0) renderer.toggleFormat("italic");
            if (op.format.backgroundColor) renderer.applyFormat("fillColor", op.format.backgroundColor);
            if (op.format.fontSize) renderer.applyFormat("fontSize", String(op.format.fontSize));
          }
          break;
        }
        case "insert_row": {
          renderer.insertRow(op.rowIndex);
          break;
        }
        case "insert_column": {
          renderer.insertCol(op.colIndex);
          break;
        }
        case "delete_row": {
          renderer.deleteRow(op.rowIndex);
          break;
        }
        case "delete_column": {
          renderer.deleteCol(op.colIndex);
          break;
        }
        // --- Table operations (delegate to existing handleTableAction) ---
        case "create_table": {
          const range = parseCellRange(op.range);
          if (!range) {
            console.warn("[applyEdits] Invalid range for create_table:", op.range);
            break;
          }
          renderer.setSelection(range.startRow, range.startCol, range.endRow, range.endCol);
          handleTableAction("createTable", {
            name: op.tableName,
            style: op.styleName || "TableStyleMedium2"
          });
          break;
        }
        case "rename_table": {
          handleTableAction("renameTable", { oldName: op.oldName, newName: op.newName });
          break;
        }
        case "set_table_style": {
          handleTableAction("setTableStyle", { tableName: op.tableName, style: op.styleName });
          break;
        }
        case "toggle_table_filter": {
          handleTableAction("toggleFilter", { tableName: op.tableName });
          break;
        }
        case "set_totals_row": {
          handleTableAction("setTotalsRow", { tableName: op.tableName, enabled: op.enabled });
          break;
        }
        case "convert_table_to_range": {
          handleTableAction("convertToRange", { tableName: op.tableName });
          break;
        }
        // --- Chart operations ---
        case "insert_chart": {
          const sheet = model.sheets[sheetIdx];
          if (!sheet) break;
          if (!sheet.charts) sheet.charts = [];
          const anchorCol = op.position ? parseCellRef(op.position)?.col ?? 0 : 0;
          const anchorRow = op.position ? parseCellRef(op.position)?.row ?? (sheet.charts.length > 0 ? 20 : 10) : sheet.charts.length > 0 ? 20 : 10;
          const chartDef = {
            chart_type: op.chart_type,
            title: op.title,
            series: [{ values_ref: op.data_range, categories_cache: [], values_cache: [] }],
            axes: [
              { axis_type: "category", position: "bottom" },
              { axis_type: "value", position: "left" }
            ],
            anchor: {
              from_col: anchorCol,
              from_row: anchorRow,
              from_col_off: 0,
              from_row_off: 0,
              to_col: anchorCol + 8,
              to_row: anchorRow + 15,
              to_col_off: 0,
              to_row_off: 0
            }
          };
          resolveChartData(chartDef, sheet);
          sheet.charts.push(chartDef);
          syncChartOverlays();
          break;
        }
        case "delete_chart": {
          const sheet = model.sheets[sheetIdx];
          if (!sheet?.charts || op.chart_index >= sheet.charts.length) {
            console.warn("[applyEdits] Invalid chart_index for delete_chart:", op.chart_index);
            break;
          }
          sheet.charts.splice(op.chart_index, 1);
          syncChartOverlays();
          break;
        }
        default:
          console.warn("[applyEdits] Unknown operation type:", op.type);
      }
    }
    markDirty();
    renderer.render();
  }
  function resolveSheetIndex(model, sheet) {
    if (sheet === void 0 || sheet === null) return 0;
    if (typeof sheet === "number") return sheet;
    const idx = model.sheets.findIndex((s) => s.name === sheet);
    return idx >= 0 ? idx : 0;
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
      // Conditional Formatting
      case "conditionalFormatting":
        showConditionalFormattingDialog();
        break;
      // Charts
      case "insertChart":
        showChartWizard();
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
      case "print": {
        const canvas = document.querySelector("canvas");
        if (canvas) {
          const dataUrl = canvas.toDataURL("image/png");
          vscode.postMessage({ type: "print", imageData: dataUrl });
        }
        break;
      }
      case "exportPDF": {
        const exportCanvas = document.querySelector("canvas");
        if (exportCanvas) {
          const dataUrl = exportCanvas.toDataURL("image/png");
          vscode.postMessage({ type: "exportImage", imageData: dataUrl });
        }
        break;
      }
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
  function handleFilterDropdownAction(event) {
    if (!renderer) return;
    switch (event.action) {
      case "sortAZ":
        renderer.sortTableColumn(event.tableName, event.colIndex, true);
        break;
      case "sortZA":
        renderer.sortTableColumn(event.tableName, event.colIndex, false);
        break;
      case "filter":
        if (event.allowedValues) {
          renderer.applyFilter(event.tableName, event.colIndex, event.allowedValues);
        }
        break;
      case "clearFilter":
        renderer.clearFilter(event.tableName, event.colIndex);
        break;
    }
  }
  function showConditionalFormattingDialog() {
    if (!renderer || !cfDialog) return;
    const data = renderer.getData();
    const sheet = data?.sheets?.[renderer.getActiveSheetIndex?.() ?? 0];
    const existingRules = sheet?.conditional_formats || [];
    const sel = renderer.getSelectedCell();
    const selRange = renderer.getSelectedRange?.();
    let sqref = "A1:A10";
    if (selRange) {
      const c1 = getColName(selRange.startCol) + (selRange.startRow + 1);
      const c2 = getColName(selRange.endCol) + (selRange.endRow + 1);
      sqref = `${c1}:${c2}`;
    } else if (sel) {
      sqref = getColName(sel.col) + (sel.row + 1);
    }
    cfDialog.show(sqref, existingRules);
  }
  function handleCfDialogAction(event) {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets) return;
    const sheetIdx = renderer.getActiveSheetIndex?.() ?? 0;
    const sheet = data.sheets[sheetIdx];
    if (!sheet) return;
    if (!sheet.conditional_formats) sheet.conditional_formats = [];
    switch (event.action) {
      case "add":
        if (event.rule) {
          sheet.conditional_formats.push(event.rule);
          renderer.render();
          markDirty();
        }
        break;
      case "edit":
        if (event.rule && event.ruleIndex !== void 0 && event.ruleIndex < sheet.conditional_formats.length) {
          sheet.conditional_formats[event.ruleIndex] = event.rule;
          renderer.render();
          markDirty();
        }
        break;
      case "delete":
        if (event.ruleIndex !== void 0 && event.ruleIndex < sheet.conditional_formats.length) {
          sheet.conditional_formats.splice(event.ruleIndex, 1);
          renderer.render();
          markDirty();
        }
        break;
      case "close":
        break;
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
  function getRendererCoords() {
    if (!renderer) return null;
    return {
      cx: (col) => renderer.publicCx(col),
      ry: (row) => renderer.publicRy(row),
      cw: (col) => renderer.publicCw(col),
      rh: (row) => renderer.publicRh(row),
      getScrollLeft: () => renderer.publicScrollLeft(),
      getScrollTop: () => renderer.publicScrollTop(),
      getHeaderWidth: () => renderer.publicHeaderWidth(),
      getHeaderHeight: () => renderer.publicHeaderHeight()
    };
  }
  function syncChartOverlays() {
    if (!renderer || !chartManager) return;
    const data = renderer.getData();
    const sheetIdx = renderer.getActiveSheetIndex();
    const charts = data?.sheets?.[sheetIdx]?.charts;
    const coords = getRendererCoords();
    if (coords) {
      chartManager.syncCharts(charts, coords);
    }
  }
  function showChartWizard(editIndex) {
    if (!renderer || !chartWizard) return;
    const sel = renderer.getSelectedCell();
    const selRange = renderer.getSelectedRange?.();
    let defaultRange = "A1:D10";
    const anchorRow = sel?.row ?? 0;
    const anchorCol = sel?.col ?? 0;
    if (selRange) {
      const c1 = getColName(selRange.startCol) + (selRange.startRow + 1);
      const c2 = getColName(selRange.endCol) + (selRange.endRow + 1);
      defaultRange = `${c1}:${c2}`;
    }
    let editDef;
    if (editIndex !== void 0) {
      const data = renderer.getData();
      const sheetIdx = renderer.getActiveSheetIndex();
      editDef = data?.sheets?.[sheetIdx]?.charts?.[editIndex];
    }
    chartWizard.show(defaultRange, anchorRow, anchorCol, editDef, editIndex);
  }
  function handleChartWizardAction(event) {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets) return;
    const sheetIdx = renderer.getActiveSheetIndex();
    const sheet = data.sheets[sheetIdx];
    if (!sheet) return;
    if (!sheet.charts) sheet.charts = [];
    switch (event.action) {
      case "insert":
        if (event.chartDef) {
          resolveChartData(event.chartDef, sheet);
          sheet.charts.push(event.chartDef);
          syncChartOverlays();
          markDirty();
        }
        break;
      case "update":
        if (event.chartDef && event.editIndex !== void 0 && event.editIndex < sheet.charts.length) {
          resolveChartData(event.chartDef, sheet);
          sheet.charts[event.editIndex] = event.chartDef;
          syncChartOverlays();
          markDirty();
        }
        break;
    }
  }
  function resolveChartData(chartDef, sheet) {
    const sheetName = sheet.name || "Sheet1";
    const cells = sheet.cells || {};
    for (const series of chartDef.series) {
      if (series.values_ref) {
        if (!series.values_ref.includes("!")) {
          series.values_ref = `${sheetName}!${series.values_ref}`;
        }
        const parsed = parseCellRange(series.values_ref);
        if (parsed) {
          const { startRow, startCol, endRow, endCol } = parsed;
          const isVertical = startCol === endCol;
          if (isVertical) {
            const cats = [];
            const vals = [];
            let dataStartRow = startRow;
            for (let r = startRow; r <= endRow; r++) {
              const cell = cells[r]?.[startCol];
              const val = getCellValue(cell);
              if (r === startRow && typeof val === "string" && isNaN(Number(val))) {
                series.name = val;
                dataStartRow = startRow + 1;
                continue;
              }
              cats.push(`Row ${r + 1}`);
              vals.push(typeof val === "number" ? val : parseFloat(String(val)) || 0);
            }
            series.categories_cache = cats;
            series.values_cache = vals;
            const valCol = getColName(startCol);
            series.values_ref = `${sheetName}!${valCol}${dataStartRow + 1}:${valCol}${endRow + 1}`;
            if (!series.categories_ref) {
              series.categories_ref = void 0;
            }
          } else {
            const cats = [];
            const vals = [];
            let dataStartRow = startRow;
            const firstCell = cells[startRow]?.[startCol];
            const firstVal = getCellValue(firstCell);
            if (typeof firstVal === "string" && isNaN(Number(firstVal))) {
              dataStartRow = startRow + 1;
            }
            for (let r = dataStartRow; r <= endRow; r++) {
              const catCell = cells[r]?.[startCol];
              const catVal = getCellValue(catCell);
              cats.push(String(catVal ?? `Row ${r + 1}`));
              let sum = 0;
              for (let c = startCol + 1; c <= endCol; c++) {
                const vCell = cells[r]?.[c];
                const v = getCellValue(vCell);
                sum += typeof v === "number" ? v : parseFloat(String(v)) || 0;
              }
              vals.push(sum);
            }
            series.categories_cache = cats;
            series.values_cache = vals;
            const catCol = getColName(startCol);
            const valStartCol = getColName(startCol + 1);
            const valEndCol = getColName(endCol);
            series.categories_ref = `${sheetName}!${catCol}${dataStartRow + 1}:${catCol}${endRow + 1}`;
            series.values_ref = `${sheetName}!${valStartCol}${dataStartRow + 1}:${valEndCol}${endRow + 1}`;
          }
        }
      }
    }
  }
  function parseCellRange(ref) {
    let range = ref;
    const bangIdx = range.indexOf("!");
    if (bangIdx >= 0) range = range.substring(bangIdx + 1);
    range = range.replace(/\$/g, "");
    const parts = range.split(":");
    if (parts.length < 2) return null;
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) return null;
    return { startRow: start.row, startCol: start.col, endRow: end.row, endCol: end.col };
  }
  function parseCellRef(ref) {
    const match = ref.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) return null;
    return { col: parseColName(match[1].toUpperCase()), row: parseInt(match[2], 10) - 1 };
  }
  function getCellValue(cell) {
    if (!cell) return null;
    if (cell.data_type === "n") return parseFloat(cell.value) || 0;
    return cell.value ?? null;
  }
  function handleChartAction(action, chartIndex, chartDef) {
    if (!renderer) return;
    const data = renderer.getData();
    if (!data?.sheets) return;
    const sheetIdx = renderer.getActiveSheetIndex();
    const sheet = data.sheets[sheetIdx];
    if (!sheet?.charts) return;
    switch (action) {
      case "delete":
        sheet.charts.splice(chartIndex, 1);
        syncChartOverlays();
        markDirty();
        break;
      case "moved":
        if (chartDef && chartIndex < sheet.charts.length) {
          sheet.charts[chartIndex] = chartDef;
          markDirty();
        }
        break;
      case "editChart":
        showChartWizard(chartIndex);
        break;
      case "select":
        break;
    }
  }
  function markDirty() {
    vscode.postMessage({ type: "dirty" });
    persistChartState();
  }
  function persistChartState() {
    if (!renderer || !currentFileUri) return;
    const data = renderer.getData();
    if (!data?.sheets) return;
    const chartState = {};
    for (const sheet of data.sheets) {
      if (sheet.charts?.length) {
        chartState[sheet.name] = sheet.charts;
      }
    }
    const prev = vscode.getState() || {};
    vscode.setState({ ...prev, [currentFileUri]: chartState });
  }
  function restoreChartState() {
    if (!renderer || !currentFileUri) return;
    const state = vscode.getState();
    if (!state || !state[currentFileUri]) return;
    const data = renderer.getData();
    if (!data?.sheets) return;
    const chartState = state[currentFileUri];
    let restored = 0;
    for (const sheet of data.sheets) {
      if (chartState[sheet.name]?.length && (!sheet.charts || sheet.charts.length === 0)) {
        sheet.charts = chartState[sheet.name];
        restored += sheet.charts.length;
      }
    }
    if (restored > 0) {
      console.log(`[XLSX Rust Viewer] Restored ${restored} chart(s) from webview state`);
    }
  }
  function setupRendererCallbacks() {
    if (!renderer) return;
    chartManager = new ChartManager(renderer.getWrapper(), handleChartAction);
    renderer.onScrollChanged = () => {
      if (chartManager) {
        const coords = getRendererCoords();
        if (coords) chartManager.updatePositions(coords);
      }
    };
    renderer.onContextMenu = (row, col, x, y, headerType) => {
      if (contextMenu) {
        contextMenu.show(x, y, row, col, headerType);
      }
    };
    renderer.onCellEdit = (_row, _col, _value) => {
      markDirty();
      renderer.syncTableHeaderName(_row, _col, _value);
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
/*! Bundled license information:

@kurkle/color/dist/color.esm.js:
  (*!
   * @kurkle/color v0.3.4
   * https://github.com/kurkle/color#readme
   * (c) 2024 Jukka Kurkela
   * Released under the MIT License
   *)

chart.js/dist/chunks/helpers.dataset.js:
chart.js/dist/chart.js:
  (*!
   * Chart.js v4.5.1
   * https://www.chartjs.org
   * (c) 2025 Chart.js Contributors
   * Released under the MIT License
   *)
*/
