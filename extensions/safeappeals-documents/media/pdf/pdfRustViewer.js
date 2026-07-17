"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // webview-src/pdf/wasm/pdf_viewer.js
  var PdfRenderer = class {
    __destroy_into_raw() {
      const ptr = this.__wbg_ptr;
      this.__wbg_ptr = 0;
      PdfRendererFinalization.unregister(this);
      return ptr;
    }
    free() {
      const ptr = this.__destroy_into_raw();
      wasm.__wbg_pdfrenderer_free(ptr, 0);
    }
    /**
     * Free the loaded document and release memory.
     */
    close() {
      wasm.pdfrenderer_close(this.__wbg_ptr);
    }
    /**
     * Detect interactive form fields (widget annotations) on a page.
     * Returns JSON array: [{x, y, width, height, field_type, field_name}]
     * Coordinates are in PDF points with top-left origin (y is flipped from PDF space).
     * @param {number} index
     * @returns {string}
     */
    get_form_fields(index) {
      const ret = wasm.pdfrenderer_get_form_fields(this.__wbg_ptr, index);
      if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
      }
      var v1 = getCachedStringFromWasm0(ret[0], ret[1]);
      if (ret[0] !== 0) {
        wasm.__wbindgen_free(ret[0], ret[1], 1);
      }
      return v1;
    }
    /**
     * Get document outline as JSON tree.
     * @returns {string}
     */
    get_outline() {
      const ret = wasm.pdfrenderer_get_outline(this.__wbg_ptr);
      if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
      }
      var v1 = getCachedStringFromWasm0(ret[0], ret[1]);
      if (ret[0] !== 0) {
        wasm.__wbindgen_free(ret[0], ret[1], 1);
      }
      return v1;
    }
    /**
     * Get page dimensions in PDF points.
     * @param {number} index
     * @returns {string}
     */
    get_page_dimensions(index) {
      const ret = wasm.pdfrenderer_get_page_dimensions(this.__wbg_ptr, index);
      if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
      }
      var v1 = getCachedStringFromWasm0(ret[0], ret[1]);
      if (ret[0] !== 0) {
        wasm.__wbindgen_free(ret[0], ret[1], 1);
      }
      return v1;
    }
    /**
     * Extract text from a page with bounding boxes.
     * Returns JSON array: [{text, x, y, width, height, font_size}]
     *
     * Uses three strategies in priority order:
     * 1. Page objects API (iterates text objects with bounds - works even without system fonts)
     * 2. Text page chars API (character-level bounds)
     * 3. Text page segments API (segment-level bounds)
     * @param {number} index
     * @returns {string}
     */
    get_page_text(index) {
      const ret = wasm.pdfrenderer_get_page_text(this.__wbg_ptr, index);
      if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
      }
      var v1 = getCachedStringFromWasm0(ret[0], ret[1]);
      if (ret[0] !== 0) {
        wasm.__wbindgen_free(ret[0], ret[1], 1);
      }
      return v1;
    }
    /**
     * Load PDF from bytes. Returns JSON metadata: { page_count, pages: [{width, height}] }
     * @param {Uint8Array} data
     * @returns {string}
     */
    load(data) {
      const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.pdfrenderer_load(this.__wbg_ptr, ptr0, len0);
      if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
      }
      var v2 = getCachedStringFromWasm0(ret[0], ret[1]);
      if (ret[0] !== 0) {
        wasm.__wbindgen_free(ret[0], ret[1], 1);
      }
      return v2;
    }
    constructor() {
      const ret = wasm.pdfrenderer_new();
      this.__wbg_ptr = ret >>> 0;
      PdfRendererFinalization.register(this, this.__wbg_ptr, this);
      return this;
    }
    /**
     * Get total page count.
     * @returns {number}
     */
    page_count() {
      const ret = wasm.pdfrenderer_page_count(this.__wbg_ptr);
      return ret >>> 0;
    }
    /**
     * Render a page to ImageData at target pixel dimensions.
     * @param {number} index
     * @param {number} width
     * @param {number} height
     * @returns {ImageData}
     */
    render_page(index, width, height) {
      const ret = wasm.pdfrenderer_render_page(this.__wbg_ptr, index, width, height);
      if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
      }
      return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Render a thumbnail for a page, scaling width to max_width and preserving aspect ratio.
     * @param {number} index
     * @param {number} max_width
     * @returns {ImageData}
     */
    render_thumbnail(index, max_width) {
      const ret = wasm.pdfrenderer_render_thumbnail(this.__wbg_ptr, index, max_width);
      if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
      }
      return takeFromExternrefTable0(ret[0]);
    }
  };
  if (Symbol.dispose) PdfRenderer.prototype[Symbol.dispose] = PdfRenderer.prototype.free;
  function init_panic_hook() {
    wasm.init_panic_hook();
  }
  function initialize_pdfium_render(pdfium_wasm_module, local_wasm_module) {
    const ret = wasm.initialize_pdfium_render(pdfium_wasm_module, local_wasm_module);
    return ret !== 0;
  }
  function __wbg_get_imports() {
    const import0 = {
      __proto__: null,
      __wbg_Error_8c4e43fe74559d73: function(arg0, arg1) {
        var v0 = getCachedStringFromWasm0(arg0, arg1);
        const ret = Error(v0);
        return ret;
      },
      __wbg___wbindgen_debug_string_0bc8482c6e3508ae: function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
      },
      __wbg___wbindgen_is_object_5ae8e5880f2c1fbd: function(arg0) {
        const val = arg0;
        const ret = typeof val === "object" && val !== null;
        return ret;
      },
      __wbg___wbindgen_is_undefined_9e4d92534c42d778: function(arg0) {
        const ret = arg0 === void 0;
        return ret;
      },
      __wbg___wbindgen_jsval_eq_11888390b0186270: function(arg0, arg1) {
        const ret = arg0 === arg1;
        return ret;
      },
      __wbg___wbindgen_number_get_8ff4255516ccad3e: function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof obj === "number" ? obj : void 0;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
      },
      __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
        var v0 = getCachedStringFromWasm0(arg0, arg1);
        throw new Error(v0);
      },
      __wbg_apply_ada2ee1a60ac7b3c: function() {
        return handleError(function(arg0, arg1, arg2) {
          const ret = arg0.apply(arg1, arg2);
          return ret;
        }, arguments);
      },
      __wbg_call_389efe28435a9388: function() {
        return handleError(function(arg0, arg1) {
          const ret = arg0.call(arg1);
          return ret;
        }, arguments);
      },
      __wbg_call_4708e0c13bdc8e95: function() {
        return handleError(function(arg0, arg1, arg2) {
          const ret = arg0.call(arg1, arg2);
          return ret;
        }, arguments);
      },
      __wbg_decode_9cea5b72e50871c4: function() {
        return handleError(function(arg0, arg1, arg2, arg3) {
          const ret = arg1.decode(getArrayU8FromWasm0(arg2, arg3));
          const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
          const len1 = WASM_VECTOR_LEN;
          getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
          getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        }, arguments);
      },
      __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
        var v0 = getCachedStringFromWasm0(arg0, arg1);
        if (arg0 !== 0) {
          wasm.__wbindgen_free(arg0, arg1, 1);
        }
        console.error(v0);
      },
      __wbg_error_9a7fe3f932034cde: function(arg0) {
        console.error(arg0);
      },
      __wbg_getTime_1e3cd1391c5c3995: function(arg0) {
        const ret = arg0.getTime();
        return ret;
      },
      __wbg_get_7efbcc3819719b0f: function() {
        return handleError(function(arg0, arg1) {
          const ret = arg0.get(arg1 >>> 0);
          return ret;
        }, arguments);
      },
      __wbg_get_b3ed3ad4be2bc8ac: function() {
        return handleError(function(arg0, arg1) {
          const ret = Reflect.get(arg0, arg1);
          return ret;
        }, arguments);
      },
      __wbg_get_index_9a5bfdd2ca49c65f: function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
      },
      __wbg_length_32ed9a279acd054c: function(arg0) {
        const ret = arg0.length;
        return ret;
      },
      __wbg_length_aeb94ff17a8a8556: function(arg0) {
        const ret = arg0.length;
        return ret;
      },
      __wbg_length_c8c85e3b2adbc8be: function(arg0) {
        const ret = arg0.length;
        return ret;
      },
      __wbg_log_6b5ca2e6124b2808: function(arg0) {
        console.log(arg0);
      },
      __wbg_log_c3d24b049fb7df65: function(arg0, arg1) {
        var v0 = getCachedStringFromWasm0(arg0, arg1);
        console.log(v0);
      },
      __wbg_new_0_73afc35eb544e539: function() {
        const ret = /* @__PURE__ */ new Date();
        return ret;
      },
      __wbg_new_3eb36ae241fe6f44: function() {
        const ret = new Array();
        return ret;
      },
      __wbg_new_8a6f238a6ece86ea: function() {
        const ret = new Error();
        return ret;
      },
      __wbg_new_no_args_1c7c842f08d00ebb: function(arg0, arg1) {
        var v0 = getCachedStringFromWasm0(arg0, arg1);
        const ret = new Function(v0);
        return ret;
      },
      __wbg_new_with_label_868725b8d51e8ff3: function() {
        return handleError(function(arg0, arg1) {
          var v0 = getCachedStringFromWasm0(arg0, arg1);
          const ret = new TextDecoder(v0);
          return ret;
        }, arguments);
      },
      __wbg_new_with_length_1763c527b2923202: function(arg0) {
        const ret = new Array(arg0 >>> 0);
        return ret;
      },
      __wbg_new_with_u8_clamped_array_and_sh_0c0b789ceb2eab31: function() {
        return handleError(function(arg0, arg1, arg2, arg3) {
          const ret = new ImageData(getClampedArrayU8FromWasm0(arg0, arg1), arg2 >>> 0, arg3 >>> 0);
          return ret;
        }, arguments);
      },
      __wbg_of_0774a9663fb93da1: function(arg0, arg1, arg2, arg3) {
        const ret = Array.of(arg0, arg1, arg2, arg3);
        return ret;
      },
      __wbg_of_9ab14f9d4bfb5040: function(arg0, arg1) {
        const ret = Array.of(arg0, arg1);
        return ret;
      },
      __wbg_of_ab479ddbf595c4a7: function(arg0, arg1, arg2, arg3, arg4) {
        const ret = Array.of(arg0, arg1, arg2, arg3, arg4);
        return ret;
      },
      __wbg_of_ddc0942b0dce16a1: function(arg0, arg1, arg2) {
        const ret = Array.of(arg0, arg1, arg2);
        return ret;
      },
      __wbg_of_f915f7cd925b21a5: function(arg0) {
        const ret = Array.of(arg0);
        return ret;
      },
      __wbg_prototypesetcall_bdcdcc5842e4d77d: function(arg0, arg1, arg2) {
        Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
      },
      __wbg_push_8ffdcb2063340ba5: function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
      },
      __wbg_set_0af2522656c2a71b: function() {
        return handleError(function(arg0, arg1, arg2) {
          arg0.set(arg1 >>> 0, arg2);
        }, arguments);
      },
      __wbg_set_25cf9deff6bf0ea8: function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
      },
      __wbg_set_f43e577aea94465b: function(arg0, arg1, arg2) {
        arg0[arg1 >>> 0] = arg2;
      },
      __wbg_slice_8bbd46adb2100583: function(arg0, arg1, arg2) {
        const ret = arg0.slice(arg1 >>> 0, arg2 >>> 0);
        return ret;
      },
      __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
      },
      __wbg_static_accessor_GLOBAL_12837167ad935116: function() {
        const ret = typeof global === "undefined" ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
      },
      __wbg_static_accessor_GLOBAL_THIS_e628e89ab3b1c95f: function() {
        const ret = typeof globalThis === "undefined" ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
      },
      __wbg_static_accessor_SELF_a621d3dfbb60d0ce: function() {
        const ret = typeof self === "undefined" ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
      },
      __wbg_static_accessor_WINDOW_f8727f0cf888e0bd: function() {
        const ret = typeof window === "undefined" ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
      },
      __wbg_subarray_a96e1fef17ed23cb: function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
      },
      __wbindgen_cast_0000000000000001: function(arg0) {
        const ret = arg0;
        return ret;
      },
      __wbindgen_cast_0000000000000002: function(arg0, arg1) {
        var v0 = getCachedStringFromWasm0(arg0, arg1);
        const ret = v0;
        return ret;
      },
      __wbindgen_cast_0000000000000003: function(arg0, arg1) {
        const ret = getArrayU8FromWasm0(arg0, arg1);
        return ret;
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
      "./pdf_viewer_bg.js": import0
    };
  }
  var PdfRendererFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((ptr) => wasm.__wbg_pdfrenderer_free(ptr >>> 0, 1));
  function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
  }
  function debugString(val) {
    const type = typeof val;
    if (type == "number" || type == "boolean" || val == null) {
      return `${val}`;
    }
    if (type == "string") {
      return `"${val}"`;
    }
    if (type == "symbol") {
      const description = val.description;
      if (description == null) {
        return "Symbol";
      } else {
        return `Symbol(${description})`;
      }
    }
    if (type == "function") {
      const name = val.name;
      if (typeof name == "string" && name.length > 0) {
        return `Function(${name})`;
      } else {
        return "Function";
      }
    }
    if (Array.isArray(val)) {
      const length = val.length;
      let debug = "[";
      if (length > 0) {
        debug += debugString(val[0]);
      }
      for (let i = 1; i < length; i++) {
        debug += ", " + debugString(val[i]);
      }
      debug += "]";
      return debug;
    }
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
      className = builtInMatches[1];
    } else {
      return toString.call(val);
    }
    if (className == "Object") {
      try {
        return "Object(" + JSON.stringify(val) + ")";
      } catch (_) {
        return "Object";
      }
    }
    if (val instanceof Error) {
      return `${val.name}: ${val.message}
${val.stack}`;
    }
    return className;
  }
  function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
  }
  function getCachedStringFromWasm0(ptr, len) {
    if (ptr === 0) {
      return getFromExternrefTable0(len);
    } else {
      return getStringFromWasm0(ptr, len);
    }
  }
  function getClampedArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ClampedArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
  }
  var cachedDataViewMemory0 = null;
  function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
      cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
  }
  function getFromExternrefTable0(idx) {
    return wasm.__wbindgen_externrefs.get(idx);
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
  var cachedUint8ClampedArrayMemory0 = null;
  function getUint8ClampedArrayMemory0() {
    if (cachedUint8ClampedArrayMemory0 === null || cachedUint8ClampedArrayMemory0.byteLength === 0) {
      cachedUint8ClampedArrayMemory0 = new Uint8ClampedArray(wasm.memory.buffer);
    }
    return cachedUint8ClampedArrayMemory0;
  }
  function handleError(f, args) {
    try {
      return f.apply(this, args);
    } catch (e) {
      const idx = addToExternrefTable0(e);
      wasm.__wbindgen_exn_store(idx);
    }
  }
  function isLikeNone(x) {
    return x === void 0 || x === null;
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
    cachedUint8ClampedArrayMemory0 = null;
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
      module_or_path = new URL("pdf_viewer_bg.wasm", "");
    }
    const imports = __wbg_get_imports();
    if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
      module_or_path = fetch(module_or_path);
    }
    const { instance, module } = await __wbg_load(await module_or_path, imports);
    return __wbg_finalize_init(instance, module);
  }

  // webview-src/pdf/renderer.ts
  var PdfCanvasRenderer = class {
    constructor(canvas, textLayer, renderContainer) {
      __publicField(this, "canvas");
      __publicField(this, "ctx");
      __publicField(this, "textLayer");
      __publicField(this, "renderContainer");
      __publicField(this, "highlightLayer", null);
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.textLayer = textLayer;
      this.renderContainer = renderContainer;
    }
    /**
     * Paint an ImageData (from WASM) onto the canvas at the given pixel dimensions.
     */
    renderImageData(imageData, width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.putImageData(imageData, 0, 0);
      this.ensureHighlightLayer();
      if (this.highlightLayer) {
        this.highlightLayer.style.width = width + "px";
        this.highlightLayer.style.height = height + "px";
      }
    }
    /**
     * Build the text layer overlay from WASM text extraction data.
     * Creates positioned <span> elements over the canvas for text selection.
     *
     * @param blocks - Array of text blocks with positions in PDF points
     * @param pageWidth - Page width in PDF points
     * @param pageHeight - Page height in PDF points
     * @param scale - Current zoom scale
     */
    renderTextLayer(blocks, pageWidth, pageHeight, scale2) {
      this.textLayer.innerHTML = "";
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;
      const scaleX = canvasWidth / pageWidth;
      const scaleY = canvasHeight / pageHeight;
      this.textLayer.style.width = canvasWidth + "px";
      this.textLayer.style.height = canvasHeight + "px";
      this.textLayer.style.setProperty("--scale-factor", scale2.toString());
      let spanCount = 0;
      for (const block of blocks) {
        if (!block.text.trim()) continue;
        const span = document.createElement("span");
        span.textContent = block.text;
        const left = block.x * scaleX;
        const top = block.y * scaleY;
        const width = block.width * scaleX;
        const height = block.height * scaleY;
        const fontSize = block.font_size * scaleY;
        span.style.position = "absolute";
        span.style.left = left + "px";
        span.style.top = top + "px";
        span.style.width = width + "px";
        span.style.height = height + "px";
        span.style.fontSize = fontSize + "px";
        span.style.lineHeight = fontSize + "px";
        span.style.color = "transparent";
        span.style.whiteSpace = "pre";
        span.style.overflow = "hidden";
        this.textLayer.appendChild(span);
        spanCount++;
      }
      console.log(`[PDF Viewer] Text layer: ${spanCount} spans from ${blocks.length} blocks`);
    }
    /**
     * Get or create the highlight layer (sits above text layer for annotations).
     */
    ensureHighlightLayer() {
      if (!this.highlightLayer) {
        this.highlightLayer = document.createElement("div");
        this.highlightLayer.id = "pdf-highlight-layer";
        this.highlightLayer.style.position = "absolute";
        this.highlightLayer.style.left = "0";
        this.highlightLayer.style.top = "0";
        this.highlightLayer.style.width = this.canvas.width + "px";
        this.highlightLayer.style.height = this.canvas.height + "px";
        this.highlightLayer.style.pointerEvents = "none";
        this.highlightLayer.style.zIndex = "3";
        this.renderContainer.appendChild(this.highlightLayer);
      }
      return this.highlightLayer;
    }
    /**
     * Get the highlight layer element (for annotations to render into).
     */
    getHighlightLayer() {
      return this.ensureHighlightLayer();
    }
    /**
     * Get the render container element.
     */
    getRenderContainer() {
      return this.renderContainer;
    }
    /**
     * Get current canvas dimensions.
     */
    getCanvasDimensions() {
      return { width: this.canvas.width, height: this.canvas.height };
    }
    /**
     * Clear the canvas and text layer.
     */
    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.textLayer.innerHTML = "";
      if (this.highlightLayer) {
        this.highlightLayer.innerHTML = "";
      }
    }
  };

  // webview-src/pdf/sidebar.ts
  var THUMBNAIL_WIDTH = 150;
  var DEFAULT_PAGE_ASPECT = 297 / 210;
  var Sidebar = class {
    constructor(thumbnailsContainer, outlineContainer, bookmarksContainer, onNavigate) {
      __publicField(this, "thumbnailsContainer");
      __publicField(this, "outlineContainer");
      __publicField(this, "bookmarksContainer");
      __publicField(this, "onNavigate");
      // Lazy thumbnail state
      __publicField(this, "thumbObserver", null);
      __publicField(this, "thumbQueue", []);
      __publicField(this, "thumbWorkScheduled", false);
      __publicField(this, "renderedThumbs", /* @__PURE__ */ new Set());
      __publicField(this, "thumbCanvases", /* @__PURE__ */ new Map());
      __publicField(this, "renderThumbnail", null);
      // Bumped on every reset so in-flight rAF callbacks/observer entries from a
      // previous document are ignored instead of painting stale content.
      __publicField(this, "thumbGeneration", 0);
      this.thumbnailsContainer = thumbnailsContainer;
      this.outlineContainer = outlineContainer;
      this.bookmarksContainer = bookmarksContainer;
      this.onNavigate = onNavigate;
    }
    /**
     * Create placeholder tiles for every page immediately (page number + aspect-ratio
     * box). Actual pixels are rendered on demand as tiles scroll into view.
     *
     * @param renderThumbnail Callback that rasterizes one page via WASM and returns a
     * detached ImageData copy (safe from pdfium buffer reuse), or null on failure.
     */
    setThumbnailPlaceholders(pageCount2, pageDimensions2, activePage, renderThumbnail) {
      this.clearThumbnails();
      this.renderThumbnail = renderThumbnail;
      const generation = this.thumbGeneration;
      this.thumbObserver = new IntersectionObserver((entries) => {
        if (generation !== this.thumbGeneration) {
          return;
        }
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const page = parseInt(entry.target.dataset.page || "0");
          if (page > 0 && !this.renderedThumbs.has(page) && !this.thumbQueue.includes(page)) {
            this.thumbQueue.push(page);
          }
        }
        this.scheduleThumbnailWork();
      }, { rootMargin: "300px 0px", threshold: 0 });
      const fragment = document.createDocumentFragment();
      for (let pageNum = 1; pageNum <= pageCount2; pageNum++) {
        const dims = pageDimensions2[pageNum - 1];
        const aspect = dims && dims.width > 0 ? dims.height / dims.width : DEFAULT_PAGE_ASPECT;
        const thumbItem = document.createElement("div");
        thumbItem.className = "thumbnail-item";
        thumbItem.dataset.page = pageNum.toString();
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.className = "thumbnail-canvas";
        thumbCanvas.width = THUMBNAIL_WIDTH;
        thumbCanvas.height = Math.max(1, Math.round(THUMBNAIL_WIDTH * aspect));
        const label = document.createElement("div");
        label.className = "thumbnail-label";
        label.textContent = `Page ${pageNum}`;
        thumbItem.appendChild(thumbCanvas);
        thumbItem.appendChild(label);
        thumbItem.addEventListener("click", () => {
          this.onNavigate(pageNum);
        });
        if (pageNum === activePage) {
          thumbItem.classList.add("active");
        }
        fragment.appendChild(thumbItem);
        this.thumbCanvases.set(pageNum, thumbCanvas);
      }
      this.thumbnailsContainer.appendChild(fragment);
      for (const canvas of this.thumbCanvases.values()) {
        this.thumbObserver.observe(canvas.parentElement);
      }
      this.prioritizeThumbnail(activePage);
    }
    /**
     * Move a page to the front of the render queue (visible range / active page first).
     */
    prioritizeThumbnail(pageNum) {
      if (pageNum <= 0 || this.renderedThumbs.has(pageNum) || !this.thumbCanvases.has(pageNum)) {
        return;
      }
      const idx = this.thumbQueue.indexOf(pageNum);
      if (idx >= 0) {
        this.thumbQueue.splice(idx, 1);
      }
      this.thumbQueue.unshift(pageNum);
      this.scheduleThumbnailWork();
    }
    /**
     * Drain the queue one page per animation frame so WASM rasterization never
     * blocks the main viewer for more than a single tile at a time.
     */
    scheduleThumbnailWork() {
      if (this.thumbWorkScheduled || this.thumbQueue.length === 0) {
        return;
      }
      this.thumbWorkScheduled = true;
      const generation = this.thumbGeneration;
      requestAnimationFrame(() => {
        this.thumbWorkScheduled = false;
        if (generation !== this.thumbGeneration) {
          return;
        }
        const page = this.thumbQueue.shift();
        if (page !== void 0 && !this.renderedThumbs.has(page)) {
          this.paintThumbnail(page);
        }
        this.scheduleThumbnailWork();
      });
    }
    paintThumbnail(pageNum) {
      const canvas = this.thumbCanvases.get(pageNum);
      if (!canvas || !this.renderThumbnail) {
        return;
      }
      try {
        const imageData = this.renderThumbnail(pageNum);
        if (!imageData) {
          return;
        }
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext("2d")?.putImageData(imageData, 0, 0);
        this.renderedThumbs.add(pageNum);
        const item = canvas.parentElement;
        if (item) {
          this.thumbObserver?.unobserve(item);
        }
      } catch (e) {
        console.error(`[PDF Viewer] Failed to render thumbnail for page ${pageNum}:`, e);
      }
    }
    /**
     * Tear down observer, queue, and tiles. Safe to call between document loads.
     */
    clearThumbnails() {
      this.thumbGeneration++;
      this.thumbObserver?.disconnect();
      this.thumbObserver = null;
      this.thumbQueue.length = 0;
      this.thumbWorkScheduled = false;
      this.renderedThumbs.clear();
      this.thumbCanvases.clear();
      this.renderThumbnail = null;
      this.thumbnailsContainer.innerHTML = "";
    }
    /**
     * Update which thumbnail is highlighted as active.
     */
    updateActiveThumbnail(pageNum) {
      const thumbnails = this.thumbnailsContainer.querySelectorAll(".thumbnail-item");
      thumbnails.forEach((thumb) => {
        const el = thumb;
        if (parseInt(el.dataset.page || "0") === pageNum) {
          el.classList.add("active");
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
          el.classList.remove("active");
        }
      });
      this.prioritizeThumbnail(pageNum);
    }
    /**
     * Set the document outline from WASM-extracted data.
     */
    setOutline(items) {
      this.outlineContainer.innerHTML = "";
      if (!items || items.length === 0) {
        this.outlineContainer.innerHTML = '<div class="outline-empty">No outline available</div>';
        return;
      }
      this.renderOutlineItems(items, this.outlineContainer, 1);
    }
    renderOutlineItems(items, container, level) {
      for (const item of items) {
        const outlineItem = document.createElement("div");
        outlineItem.className = `outline-item level-${Math.min(level, 3)}`;
        outlineItem.textContent = item.title;
        outlineItem.title = item.title;
        if (item.page_index !== null && item.page_index !== void 0) {
          outlineItem.style.cursor = "pointer";
          const pageIndex = item.page_index;
          outlineItem.addEventListener("click", () => {
            this.onNavigate(pageIndex + 1);
          });
        }
        container.appendChild(outlineItem);
        if (item.children && item.children.length > 0) {
          this.renderOutlineItems(item.children, container, level + 1);
        }
      }
    }
    /**
     * Render bookmarks in the sidebar from annotation data.
     */
    renderBookmarks(bookmarks) {
      this.bookmarksContainer.innerHTML = "";
      if (!bookmarks || bookmarks.length === 0) {
        this.bookmarksContainer.innerHTML = '<div class="bookmarks-empty">No bookmarks yet</div>';
        return;
      }
      const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
      for (const bookmark of sorted) {
        const item = document.createElement("div");
        item.className = "bookmark-item";
        item.dataset.annotationId = bookmark.id;
        const label = document.createElement("span");
        label.className = "bookmark-label";
        label.textContent = bookmark.text || `Page ${bookmark.page}`;
        const pageNum = document.createElement("span");
        pageNum.className = "bookmark-page";
        pageNum.textContent = `p.${bookmark.page}`;
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "bookmark-delete";
        deleteBtn.textContent = "\xD7";
        deleteBtn.title = "Delete bookmark";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          document.dispatchEvent(new CustomEvent("deleteBookmark", { detail: bookmark.id }));
        });
        item.appendChild(label);
        item.appendChild(pageNum);
        item.appendChild(deleteBtn);
        item.addEventListener("click", () => {
          this.onNavigate(bookmark.page);
        });
        this.bookmarksContainer.appendChild(item);
      }
    }
  };

  // webview-src/pdf/annotations.ts
  var COLOR_MAP = {
    yellow: "rgba(255, 235, 59, 0.4)",
    green: "rgba(76, 175, 80, 0.4)",
    blue: "rgba(33, 150, 243, 0.4)",
    pink: "rgba(233, 30, 99, 0.4)",
    redact: "rgba(0, 0, 0, 1)"
  };
  var AnnotationManager = class {
    constructor(getCurrentPage, getScale, getPdfUri, postMessage) {
      __publicField(this, "getCurrentPage", getCurrentPage);
      __publicField(this, "getScale", getScale);
      __publicField(this, "annotations", []);
      __publicField(this, "selectedAnnotationId", null);
      __publicField(this, "currentHighlightColor", "yellow");
      __publicField(this, "isRedactionMode", false);
      __publicField(this, "notePopup", null);
      __publicField(this, "getPdfUri");
      __publicField(this, "postMessage");
      // Callbacks for signature manager to use
      __publicField(this, "onSignatureStartDrag");
      __publicField(this, "onSignatureStartResize");
      __publicField(this, "onSignatureContextMenu");
      this.getPdfUri = getPdfUri;
      this.postMessage = postMessage;
    }
    setHighlightColor(color) {
      this.currentHighlightColor = color;
    }
    setRedactionMode(active) {
      this.isRedactionMode = active;
    }
    getRedactionMode() {
      return this.isRedactionMode;
    }
    setAnnotations(annotations) {
      this.annotations = annotations;
    }
    addLocalAnnotation(annotation) {
      this.annotations.push(annotation);
    }
    getBookmarks() {
      return this.annotations.filter((a) => a.color === "bookmark").map((a) => ({ id: a.id, page: a.page, text: a.text }));
    }
    /**
     * Create a highlight annotation from the current text selection.
     */
    createHighlightFromSelection(currentPage2, scale2) {
      const selection = window.getSelection();
      console.log(`[PDF Viewer] createHighlightFromSelection: selection exists=${!!selection}, isCollapsed=${selection?.isCollapsed}, text="${selection?.toString().substring(0, 50)}"`);
      if (!selection || selection.isCollapsed) {
        console.warn("[PDF Viewer] No active text selection - select text first, then click a highlight button");
        return;
      }
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        console.warn("[PDF Viewer] Selection text is empty");
        return;
      }
      const pdfUri = this.getPdfUri();
      if (!pdfUri) {
        console.warn("[PDF Viewer] No PDF URI available");
        return;
      }
      const boundingBoxes = [];
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const rects = range.getClientRects();
        const renderContainer = document.getElementById("pdf-render-container");
        const containerRect = renderContainer ? renderContainer.getBoundingClientRect() : { left: 0, top: 0 };
        for (let j = 0; j < rects.length; j++) {
          const rect = rects[j];
          boundingBoxes.push({
            page: currentPage2,
            x: (rect.left - containerRect.left) / scale2,
            y: (rect.top - containerRect.top) / scale2,
            width: rect.width / scale2,
            height: rect.height / scale2
          });
        }
      }
      console.log(`[PDF Viewer] Highlight: ${boundingBoxes.length} bounding boxes for "${selectedText.substring(0, 30)}..." on page ${currentPage2}`);
      if (boundingBoxes.length === 0) {
        console.warn("[PDF Viewer] No bounding boxes computed from selection");
        return;
      }
      this.postMessage({
        type: "addAnnotation",
        annotation: {
          pdfUri,
          page: currentPage2,
          text: selectedText,
          color: this.currentHighlightColor,
          boundingBoxes
        }
      });
      selection.removeAllRanges();
    }
    /**
     * Render all annotations for the current page into the highlight layer.
     */
    renderAnnotations(currentPage2, scale2) {
      let highlightLayer = document.getElementById("pdf-highlight-layer");
      if (!highlightLayer) {
        highlightLayer = document.createElement("div");
        highlightLayer.id = "pdf-highlight-layer";
        highlightLayer.style.position = "absolute";
        highlightLayer.style.left = "0";
        highlightLayer.style.top = "0";
        highlightLayer.style.pointerEvents = "none";
        highlightLayer.style.zIndex = "3";
        const renderContainer = document.getElementById("pdf-render-container");
        const canvas2 = document.getElementById("pdf-canvas");
        if (renderContainer && canvas2) {
          highlightLayer.style.width = canvas2.width + "px";
          highlightLayer.style.height = canvas2.height + "px";
          renderContainer.appendChild(highlightLayer);
        }
      }
      const canvas = document.getElementById("pdf-canvas");
      if (canvas) {
        highlightLayer.style.width = canvas.width + "px";
        highlightLayer.style.height = canvas.height + "px";
      }
      highlightLayer.innerHTML = "";
      const pageAnnotations = this.annotations.filter(
        (a) => a.page === currentPage2 && a.color !== "bookmark"
      );
      for (const annotation of pageAnnotations) {
        for (const box of annotation.boundingBoxes) {
          if (box.page !== currentPage2) continue;
          if (annotation.imageData && annotation.color === "signature") {
            this.renderSignatureAnnotation(highlightLayer, annotation, box, scale2);
          } else {
            this.renderHighlightAnnotation(highlightLayer, annotation, box, scale2);
          }
        }
      }
    }
    renderSignatureAnnotation(layer, annotation, box, scale2) {
      const container = document.createElement("div");
      container.className = "pdf-signature-container";
      container.dataset.annotationId = annotation.id;
      container.style.position = "absolute";
      container.style.left = box.x * scale2 + "px";
      container.style.top = box.y * scale2 + "px";
      container.style.width = box.width * scale2 + "px";
      container.style.height = box.height * scale2 + "px";
      container.style.cursor = "pointer";
      container.style.pointerEvents = "auto";
      const img = document.createElement("img");
      img.className = "pdf-signature";
      img.src = annotation.imageData;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "2px";
      img.style.pointerEvents = "none";
      container.appendChild(img);
      const handles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
      for (const handle of handles) {
        const handleElement = document.createElement("div");
        handleElement.className = `resize-handle resize-handle-${handle}`;
        handleElement.dataset.handle = handle;
        handleElement.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onSignatureStartResize?.(e, container, annotation.id, handle);
        });
        container.appendChild(handleElement);
      }
      container.addEventListener("mouseenter", () => {
        this.selectAnnotation(annotation.id);
      });
      container.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("resize-handle")) return;
        e.preventDefault();
        e.stopPropagation();
        this.onSignatureStartDrag?.(e, container, annotation.id);
      });
      container.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectAnnotation(annotation.id);
        this.onSignatureContextMenu?.(e, annotation.id);
      });
      container.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectAnnotation(annotation.id);
      });
      layer.appendChild(container);
    }
    renderHighlightAnnotation(layer, annotation, box, scale2) {
      const isRedaction = annotation.color === "redact";
      const highlight = document.createElement("div");
      highlight.className = "pdf-highlight" + (isRedaction ? " pdf-redaction" : "");
      highlight.dataset.annotationId = annotation.id;
      highlight.style.position = "absolute";
      highlight.style.left = box.x * scale2 + "px";
      highlight.style.top = box.y * scale2 + "px";
      highlight.style.width = box.width * scale2 + "px";
      highlight.style.height = box.height * scale2 + "px";
      highlight.style.backgroundColor = COLOR_MAP[annotation.color] || COLOR_MAP.yellow;
      if (!isRedaction) {
        highlight.style.mixBlendMode = "multiply";
      }
      highlight.style.cursor = isRedaction ? "crosshair" : "pointer";
      highlight.style.borderRadius = isRedaction ? "0" : "2px";
      highlight.style.pointerEvents = "auto";
      highlight.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectAnnotation(annotation.id);
      });
      if (!isRedaction) {
        highlight.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this.openNoteEditor(annotation, highlight);
        });
      }
      if (annotation.note && !isRedaction) {
        highlight.title = annotation.note;
        const noteIndicator = document.createElement("div");
        noteIndicator.className = "pdf-note-indicator";
        noteIndicator.textContent = "\u{1F4AC}";
        noteIndicator.style.position = "absolute";
        noteIndicator.style.top = "-10px";
        noteIndicator.style.right = "-4px";
        noteIndicator.style.fontSize = "10px";
        noteIndicator.style.lineHeight = "10px";
        noteIndicator.style.pointerEvents = "none";
        highlight.appendChild(noteIndicator);
      }
      layer.appendChild(highlight);
    }
    /**
     * Open an inline popup to add or edit the note on a highlight annotation.
     */
    openNoteEditor(annotation, anchorEl) {
      this.closeNoteEditor();
      const popup = document.createElement("div");
      popup.className = "pdf-note-popup";
      popup.style.position = "fixed";
      const rect = anchorEl.getBoundingClientRect();
      popup.style.left = Math.min(rect.left, window.innerWidth - 280) + "px";
      popup.style.top = rect.bottom + 4 + "px";
      popup.style.zIndex = "10000";
      popup.style.width = "260px";
      const textarea = document.createElement("textarea");
      textarea.className = "pdf-note-textarea";
      textarea.value = annotation.note || "";
      textarea.placeholder = "Add a note\u2026";
      textarea.rows = 4;
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "6px";
      row.style.marginTop = "6px";
      const saveBtn = document.createElement("button");
      saveBtn.className = "pdf-note-save-btn";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => {
        const note = textarea.value.trim();
        this.postMessage({
          type: "updateAnnotation",
          annotationId: annotation.id,
          updates: { note: note || void 0 }
        });
        annotation.note = note || void 0;
        this.closeNoteEditor();
      });
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "pdf-note-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => this.closeNoteEditor());
      row.appendChild(saveBtn);
      row.appendChild(cancelBtn);
      popup.appendChild(textarea);
      popup.appendChild(row);
      document.body.appendChild(popup);
      this.notePopup = popup;
      textarea.focus();
      const onOutside = (e) => {
        if (!popup.contains(e.target)) {
          this.closeNoteEditor();
          document.removeEventListener("mousedown", onOutside);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", onOutside), 100);
    }
    closeNoteEditor() {
      if (this.notePopup) {
        this.notePopup.remove();
        this.notePopup = null;
      }
    }
    selectAnnotation(annotationId) {
      this.deselectAll();
      this.selectedAnnotationId = annotationId;
      document.querySelectorAll(
        `.pdf-highlight[data-annotation-id="${annotationId}"], .pdf-signature-container[data-annotation-id="${annotationId}"]`
      ).forEach((el) => {
        el.classList.add("selected");
        el.style.outline = "2px solid var(--vscode-focusBorder, #007acc)";
      });
    }
    deselectAll() {
      this.selectedAnnotationId = null;
      document.querySelectorAll(".pdf-highlight.selected, .pdf-signature-container.selected").forEach((el) => {
        el.classList.remove("selected");
        el.style.outline = "none";
      });
    }
    deleteSelectedAnnotation() {
      if (this.selectedAnnotationId) {
        this.postMessage({
          type: "deleteAnnotation",
          annotationId: this.selectedAnnotationId
        });
        this.selectedAnnotationId = null;
      }
    }
    /**
     * Update annotation bounding boxes (used by signature drag/resize).
     */
    updateAnnotationBoundingBoxes(annotationId, newBoxes) {
      const annotation = this.annotations.find((a) => a.id === annotationId);
      if (annotation) {
        annotation.boundingBoxes = newBoxes;
        this.postMessage({
          type: "updateAnnotation",
          annotationId,
          updates: { boundingBoxes: newBoxes }
        });
      }
    }
    getAnnotation(id) {
      return this.annotations.find((a) => a.id === id);
    }
    /**
     * Create a redaction annotation from a drag rectangle on the canvas.
     * @param x - Left in canvas pixels
     * @param y - Top in canvas pixels
     * @param w - Width in canvas pixels
     * @param h - Height in canvas pixels
     * @param currentPage - Current page number (1-indexed)
     * @param scale - Current zoom scale
     */
    createRedactionFromDrag(x, y, w, h, currentPage2, scale2) {
      const pdfUri = this.getPdfUri();
      if (!pdfUri || w <= 2 || h <= 2) return;
      this.postMessage({
        type: "addAnnotation",
        annotation: {
          pdfUri,
          page: currentPage2,
          text: "[REDACTED]",
          color: "redact",
          boundingBoxes: [{
            page: currentPage2,
            x: x / scale2,
            y: y / scale2,
            width: w / scale2,
            height: h / scale2
          }]
        }
      });
    }
  };

  // webview-src/pdf/signatures.ts
  var SignatureManager = class {
    constructor(getCurrentPage, getScale, getPdfUri, postMessage, annotationManager2) {
      // Canvas state
      __publicField(this, "signatureCanvas", null);
      __publicField(this, "signatureCtx", null);
      __publicField(this, "signatureTextCanvas", null);
      __publicField(this, "signatureTextCtx", null);
      // Drawing state
      __publicField(this, "isDrawing", false);
      __publicField(this, "lastX", 0);
      __publicField(this, "lastY", 0);
      __publicField(this, "signatureImageData", null);
      __publicField(this, "signatureMode", "draw");
      __publicField(this, "signatureText", "");
      __publicField(this, "signatureFont", "signature1");
      __publicField(this, "signatureSize", 40);
      // Placement state
      __publicField(this, "isPlacementMode", false);
      __publicField(this, "placeSignatureHandler", null);
      // Drag state
      __publicField(this, "isDraggingSignature", false);
      __publicField(this, "draggedSignatureElement", null);
      __publicField(this, "draggedAnnotationId", null);
      __publicField(this, "dragOffsetX", 0);
      __publicField(this, "dragOffsetY", 0);
      // Resize state
      __publicField(this, "isResizingSignature", false);
      __publicField(this, "resizedSignatureElement", null);
      __publicField(this, "resizedAnnotationId", null);
      __publicField(this, "resizeStartX", 0);
      __publicField(this, "resizeStartY", 0);
      __publicField(this, "resizeHandle", null);
      __publicField(this, "originalBounds", null);
      // Context menu state
      __publicField(this, "contextMenuElement", null);
      // Saved signatures
      __publicField(this, "savedSignatures", []);
      // Dependencies
      __publicField(this, "getCurrentPage");
      __publicField(this, "getScale");
      __publicField(this, "getPdfUri");
      __publicField(this, "postMessage");
      __publicField(this, "annotationManager");
      this.getCurrentPage = getCurrentPage;
      this.getScale = getScale;
      this.getPdfUri = getPdfUri;
      this.postMessage = postMessage;
      this.annotationManager = annotationManager2;
      this.annotationManager.onSignatureStartDrag = (e, el, id) => this.startDragging(e, el, id);
      this.annotationManager.onSignatureStartResize = (e, el, id, handle) => this.startResizing(e, el, id, handle);
      this.annotationManager.onSignatureContextMenu = (e, id) => this.showContextMenu(e, id);
      this.setupModalHandlers();
    }
    // ==================== MODAL ====================
    setupModalHandlers() {
      const closeBtn = document.getElementById("close-signature-modal");
      const cancelBtn = document.getElementById("cancel-signature");
      const clearBtn = document.getElementById("clear-signature");
      const saveBtn = document.getElementById("save-signature");
      const doneBtn = document.getElementById("done-signature");
      const drawModeBtn = document.getElementById("draw-mode-btn");
      const typeModeBtn = document.getElementById("type-mode-btn");
      const textInput = document.getElementById("signature-text-input");
      const fontSelect = document.getElementById("signature-font-select");
      const sizeSlider = document.getElementById("signature-size-slider");
      const sizeValue = document.getElementById("signature-size-value");
      closeBtn?.addEventListener("click", () => this.hideModal());
      cancelBtn?.addEventListener("click", () => this.hideModal());
      clearBtn?.addEventListener("click", () => this.clearCanvas());
      saveBtn?.addEventListener("click", () => this.saveSignature());
      doneBtn?.addEventListener("click", () => this.doneSignature());
      drawModeBtn?.addEventListener("click", () => this.setMode("draw"));
      typeModeBtn?.addEventListener("click", () => this.setMode("type"));
      textInput?.addEventListener("input", (e) => {
        this.signatureText = e.target.value;
        this.renderTypedSignature();
      });
      fontSelect?.addEventListener("change", (e) => {
        this.signatureFont = e.target.value;
        this.renderTypedSignature();
      });
      sizeSlider?.addEventListener("input", (e) => {
        this.signatureSize = parseInt(e.target.value);
        if (sizeValue) sizeValue.textContent = this.signatureSize + "px";
        this.renderTypedSignature();
      });
    }
    showModal() {
      const modal = document.getElementById("signature-modal");
      if (!modal) return;
      if (!this.signatureCanvas) {
        this.signatureCanvas = document.getElementById("signature-canvas");
        if (this.signatureCanvas) {
          this.signatureCtx = this.signatureCanvas.getContext("2d");
          this.setupDrawCanvas();
        }
      }
      this.postMessage({ type: "loadPdfSignatures" });
      modal.style.display = "flex";
      modal.style.opacity = "1";
      modal.style.pointerEvents = "auto";
      this.setMode("draw");
      this.clearCanvas();
    }
    hideModal() {
      const modal = document.getElementById("signature-modal");
      if (!modal) return;
      modal.style.display = "none";
      modal.style.opacity = "0";
      modal.style.pointerEvents = "none";
      this.exitPlacementMode();
    }
    // ==================== DRAW / TYPE MODES ====================
    setupDrawCanvas() {
      if (!this.signatureCanvas || !this.signatureCtx) return;
      this.signatureCtx.strokeStyle = "#000000";
      this.signatureCtx.lineWidth = 2;
      this.signatureCtx.lineCap = "round";
      this.signatureCtx.lineJoin = "round";
      this.signatureCtx.fillStyle = "white";
      this.signatureCtx.fillRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
      this.signatureCanvas.addEventListener("mousedown", (e) => this.startDrawing(e));
      this.signatureCanvas.addEventListener("mousemove", (e) => this.draw(e));
      this.signatureCanvas.addEventListener("mouseup", () => this.stopDrawing());
      this.signatureCanvas.addEventListener("mouseout", () => this.stopDrawing());
      this.signatureCanvas.addEventListener("touchstart", (e) => this.handleTouchStart(e), { passive: false });
      this.signatureCanvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), { passive: false });
      this.signatureCanvas.addEventListener("touchend", () => this.stopDrawing());
      const textCanvasEl = document.getElementById("signature-text-canvas");
      if (textCanvasEl) {
        this.signatureTextCanvas = textCanvasEl;
        this.signatureTextCtx = textCanvasEl.getContext("2d");
        if (this.signatureTextCtx) {
          this.signatureTextCtx.fillStyle = "white";
          this.signatureTextCtx.fillRect(0, 0, textCanvasEl.width, textCanvasEl.height);
        }
      }
    }
    startDrawing(e) {
      this.isDrawing = true;
      const rect = this.signatureCanvas.getBoundingClientRect();
      this.lastX = e.clientX - rect.left;
      this.lastY = e.clientY - rect.top;
    }
    draw(e) {
      if (!this.isDrawing || !this.signatureCtx) return;
      const rect = this.signatureCanvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      this.signatureCtx.beginPath();
      this.signatureCtx.moveTo(this.lastX, this.lastY);
      this.signatureCtx.lineTo(currentX, currentY);
      this.signatureCtx.stroke();
      this.lastX = currentX;
      this.lastY = currentY;
    }
    stopDrawing() {
      this.isDrawing = false;
      if (this.signatureCanvas && this.signatureMode === "draw") {
        this.signatureImageData = this.signatureCanvas.toDataURL("image/png");
      }
    }
    handleTouchStart(e) {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousedown", { clientX: touch.clientX, clientY: touch.clientY });
      this.signatureCanvas.dispatchEvent(mouseEvent);
    }
    handleTouchMove(e) {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent("mousemove", { clientX: touch.clientX, clientY: touch.clientY });
      this.signatureCanvas.dispatchEvent(mouseEvent);
    }
    setMode(mode) {
      this.signatureMode = mode;
      const drawModeBtn = document.getElementById("draw-mode-btn");
      const typeModeBtn = document.getElementById("type-mode-btn");
      drawModeBtn?.classList.toggle("active", mode === "draw");
      typeModeBtn?.classList.toggle("active", mode === "type");
      const drawContainer = document.getElementById("draw-mode-container");
      const typeContainer = document.getElementById("type-mode-container");
      drawContainer?.classList.toggle("hidden", mode !== "draw");
      typeContainer?.classList.toggle("hidden", mode !== "type");
      const instructions = document.querySelector(".signature-instructions");
      if (instructions) {
        instructions.textContent = mode === "draw" ? "Draw your signature using mouse or touch" : "Type your name and adjust the style";
      }
      if (mode === "draw" && this.signatureCanvas) {
        this.signatureImageData = this.signatureCanvas.toDataURL("image/png");
      } else if (mode === "type") {
        this.renderTypedSignature();
      }
    }
    renderTypedSignature() {
      if (!this.signatureTextCtx || !this.signatureTextCanvas) return;
      this.signatureTextCtx.fillStyle = "white";
      this.signatureTextCtx.fillRect(0, 0, this.signatureTextCanvas.width, this.signatureTextCanvas.height);
      if (!this.signatureText.trim()) {
        this.signatureImageData = null;
        return;
      }
      let fontFamily = "cursive";
      let fontWeight = "normal";
      const fontStyle = "normal";
      switch (this.signatureFont) {
        case "signature1":
          fontFamily = '"Brush Script MT", cursive';
          break;
        case "signature2":
          fontFamily = '"Lucida Handwriting", cursive';
          break;
        case "signature3":
          fontFamily = '"Segoe Script", cursive';
          break;
        case "signature4":
          fontFamily = '"Edwardian Script ITC", cursive';
          fontWeight = "bold";
          break;
      }
      this.signatureTextCtx.font = `${fontStyle} ${fontWeight} ${this.signatureSize}px ${fontFamily}`;
      this.signatureTextCtx.fillStyle = "#000000";
      this.signatureTextCtx.textAlign = "center";
      this.signatureTextCtx.textBaseline = "middle";
      const centerX = this.signatureTextCanvas.width / 2;
      const centerY = this.signatureTextCanvas.height / 2;
      const randomOffset = (Math.random() - 0.5) * 2;
      this.signatureTextCtx.fillText(this.signatureText, centerX + randomOffset, centerY + randomOffset);
      this.signatureTextCtx.shadowColor = "rgba(0, 0, 0, 0.1)";
      this.signatureTextCtx.shadowBlur = 1;
      this.signatureTextCtx.shadowOffsetX = 1;
      this.signatureTextCtx.shadowOffsetY = 1;
      this.signatureTextCtx.fillText(this.signatureText, centerX, centerY);
      this.signatureImageData = this.signatureTextCanvas.toDataURL("image/png");
    }
    clearCanvas() {
      if (this.signatureMode === "draw") {
        if (!this.signatureCanvas || !this.signatureCtx) return;
        this.signatureCtx.fillStyle = "white";
        this.signatureCtx.fillRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
        this.signatureImageData = null;
      } else {
        const textInput = document.getElementById("signature-text-input");
        if (textInput) textInput.value = "";
        this.signatureText = "";
        this.renderTypedSignature();
      }
    }
    saveSignature() {
      if (!this.signatureImageData) {
        alert("Please create a signature first");
        return;
      }
      const newSignature = {
        id: Date.now().toString(),
        dataURL: this.signatureImageData,
        createdAt: Date.now()
      };
      this.postMessage({ type: "savePdfSignature", signature: newSignature });
      alert("Signature saved!");
    }
    renderSavedSignatures(signatures) {
      const list = document.getElementById("saved-signatures-list");
      if (!list) return;
      this.savedSignatures = signatures || [];
      list.innerHTML = "";
      if (this.savedSignatures.length === 0) {
        list.innerHTML = '<div class="no-saved-signatures">No saved signatures</div>';
        return;
      }
      for (const sig of this.savedSignatures) {
        const sigItem = document.createElement("div");
        sigItem.className = "saved-signature-item";
        const img = document.createElement("img");
        img.src = sig.dataURL;
        img.alt = "Saved signature";
        img.addEventListener("click", () => this.loadSavedSignature(sig.id));
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-saved-signature";
        deleteBtn.textContent = "\xD7";
        deleteBtn.addEventListener("click", () => {
          this.postMessage({ type: "deletePdfSignature", signatureId: sig.id });
        });
        sigItem.appendChild(img);
        sigItem.appendChild(deleteBtn);
        list.appendChild(sigItem);
      }
    }
    loadSavedSignature(id) {
      const signature = this.savedSignatures.find((s) => s.id === id);
      if (signature && this.signatureCanvas && this.signatureCtx) {
        const img = new Image();
        img.onload = () => {
          this.signatureCtx.fillStyle = "white";
          this.signatureCtx.fillRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
          this.signatureCtx.drawImage(img, 0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
          this.signatureImageData = signature.dataURL;
        };
        img.src = signature.dataURL;
      }
    }
    doneSignature() {
      if (!this.signatureImageData) {
        alert("Please create a signature first");
        return;
      }
      this.hideModal();
      this.enterPlacementMode();
    }
    // ==================== PLACEMENT MODE ====================
    enterPlacementMode() {
      this.isPlacementMode = true;
      document.body.style.cursor = "crosshair";
      let instructions = document.getElementById("placement-instructions");
      if (!instructions) {
        instructions = document.createElement("div");
        instructions.id = "placement-instructions";
        instructions.className = "placement-instructions";
        instructions.textContent = "Click on the PDF to place your signature";
        document.body.appendChild(instructions);
      }
      instructions.style.display = "block";
      this.placeSignatureHandler = (e) => this.placeSignature(e);
      document.addEventListener("click", this.placeSignatureHandler);
    }
    exitPlacementMode() {
      this.isPlacementMode = false;
      document.body.style.cursor = "default";
      const instructions = document.getElementById("placement-instructions");
      if (instructions) instructions.style.display = "none";
      if (this.placeSignatureHandler) {
        document.removeEventListener("click", this.placeSignatureHandler);
        this.placeSignatureHandler = null;
      }
    }
    placeSignature(e) {
      if (!this.isPlacementMode || !this.signatureImageData) return;
      const pdfUri = this.getPdfUri();
      if (!pdfUri) return;
      const pdfContainer = document.getElementById("pdf-render-container");
      if (!pdfContainer) return;
      const containerRect = pdfContainer.getBoundingClientRect();
      if (e.clientX < containerRect.left || e.clientX > containerRect.right || e.clientY < containerRect.top || e.clientY > containerRect.bottom) {
        return;
      }
      const scale2 = this.getScale();
      const relativeX = (e.clientX - containerRect.left) / scale2;
      const relativeY = (e.clientY - containerRect.top) / scale2;
      this.postMessage({
        type: "addSignatureAnnotation",
        annotation: {
          pdfUri,
          page: this.getCurrentPage(),
          text: "Signature",
          color: "signature",
          imageData: this.signatureImageData,
          boundingBoxes: [{
            page: this.getCurrentPage(),
            x: relativeX - 50,
            y: relativeY - 25,
            width: 100,
            height: 50
          }]
        }
      });
      this.exitPlacementMode();
    }
    // ==================== DRAG ====================
    startDragging(e, el, annotationId) {
      this.isDraggingSignature = true;
      this.draggedSignatureElement = el;
      this.draggedAnnotationId = annotationId;
      const rect = el.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      el.classList.add("dragging");
      el.style.cursor = "grabbing";
      el.style.zIndex = "10";
      e.preventDefault();
      document.body.classList.add("dragging");
    }
    dragSignature(e) {
      if (!this.isDraggingSignature || !this.draggedSignatureElement) return;
      const containerRect = document.getElementById("pdf-render-container").getBoundingClientRect();
      let newLeft = e.clientX - containerRect.left - this.dragOffsetX;
      let newTop = e.clientY - containerRect.top - this.dragOffsetY;
      const elementRect = this.draggedSignatureElement.getBoundingClientRect();
      const maxLeft = containerRect.width - elementRect.width;
      const maxTop = containerRect.height - elementRect.height;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      this.draggedSignatureElement.style.left = newLeft + "px";
      this.draggedSignatureElement.style.top = newTop + "px";
    }
    stopDragging() {
      if (!this.isDraggingSignature || !this.draggedSignatureElement || !this.draggedAnnotationId) return;
      this.draggedSignatureElement.classList.remove("dragging");
      this.draggedSignatureElement.style.cursor = "pointer";
      this.draggedSignatureElement.style.zIndex = "";
      document.body.classList.remove("dragging");
      const containerRect = document.getElementById("pdf-render-container").getBoundingClientRect();
      const elementRect = this.draggedSignatureElement.getBoundingClientRect();
      const scale2 = this.getScale();
      const pdfX = (elementRect.left - containerRect.left) / scale2;
      const pdfY = (elementRect.top - containerRect.top) / scale2;
      const annotation = this.annotationManager.getAnnotation(this.draggedAnnotationId);
      if (annotation && annotation.boundingBoxes.length > 0) {
        const box = annotation.boundingBoxes[0];
        box.x = pdfX;
        box.y = pdfY;
        this.annotationManager.updateAnnotationBoundingBoxes(this.draggedAnnotationId, annotation.boundingBoxes);
      }
      this.isDraggingSignature = false;
      this.draggedSignatureElement = null;
      this.draggedAnnotationId = null;
    }
    // ==================== RESIZE ====================
    startResizing(e, el, annotationId, handle) {
      this.isResizingSignature = true;
      this.resizedSignatureElement = el;
      this.resizedAnnotationId = annotationId;
      this.resizeHandle = handle;
      const rect = el.getBoundingClientRect();
      const containerRect = document.getElementById("pdf-render-container").getBoundingClientRect();
      this.originalBounds = {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height
      };
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      el.classList.add("resizing");
      el.style.zIndex = "10";
      e.preventDefault();
      document.body.classList.add("dragging");
    }
    resizeSignature(e) {
      if (!this.isResizingSignature || !this.resizedSignatureElement || !this.originalBounds) return;
      const deltaX = e.clientX - this.resizeStartX;
      const deltaY = e.clientY - this.resizeStartY;
      let { x: newX, y: newY, width: newWidth, height: newHeight } = this.originalBounds;
      switch (this.resizeHandle) {
        case "nw":
          newX += deltaX;
          newY += deltaY;
          newWidth -= deltaX;
          newHeight -= deltaY;
          break;
        case "ne":
          newY += deltaY;
          newWidth += deltaX;
          newHeight -= deltaY;
          break;
        case "sw":
          newX += deltaX;
          newWidth -= deltaX;
          newHeight += deltaY;
          break;
        case "se":
          newWidth += deltaX;
          newHeight += deltaY;
          break;
        case "n":
          newY += deltaY;
          newHeight -= deltaY;
          break;
        case "s":
          newHeight += deltaY;
          break;
        case "e":
          newWidth += deltaX;
          break;
        case "w":
          newX += deltaX;
          newWidth -= deltaX;
          break;
      }
      const minSize = 20;
      newWidth = Math.max(minSize, newWidth);
      newHeight = Math.max(minSize, newHeight);
      this.resizedSignatureElement.style.left = newX + "px";
      this.resizedSignatureElement.style.top = newY + "px";
      this.resizedSignatureElement.style.width = newWidth + "px";
      this.resizedSignatureElement.style.height = newHeight + "px";
    }
    stopResizing() {
      if (!this.isResizingSignature || !this.resizedSignatureElement || !this.resizedAnnotationId) return;
      this.resizedSignatureElement.classList.remove("resizing");
      this.resizedSignatureElement.style.zIndex = "";
      document.body.classList.remove("dragging");
      const containerRect = document.getElementById("pdf-render-container").getBoundingClientRect();
      const elementRect = this.resizedSignatureElement.getBoundingClientRect();
      const scale2 = this.getScale();
      const pdfX = (elementRect.left - containerRect.left) / scale2;
      const pdfY = (elementRect.top - containerRect.top) / scale2;
      const pdfWidth = elementRect.width / scale2;
      const pdfHeight = elementRect.height / scale2;
      const annotation = this.annotationManager.getAnnotation(this.resizedAnnotationId);
      if (annotation && annotation.boundingBoxes.length > 0) {
        const box = annotation.boundingBoxes[0];
        box.x = pdfX;
        box.y = pdfY;
        box.width = pdfWidth;
        box.height = pdfHeight;
        this.annotationManager.updateAnnotationBoundingBoxes(this.resizedAnnotationId, annotation.boundingBoxes);
      }
      this.isResizingSignature = false;
      this.resizedSignatureElement = null;
      this.resizedAnnotationId = null;
      this.resizeHandle = null;
      this.originalBounds = null;
    }
    // ==================== CONTEXT MENU ====================
    showContextMenu(e, annotationId) {
      this.hideContextMenu();
      this.contextMenuElement = document.createElement("div");
      this.contextMenuElement.className = "signature-context-menu";
      this.contextMenuElement.style.position = "absolute";
      this.contextMenuElement.style.left = e.clientX + "px";
      this.contextMenuElement.style.top = e.clientY + "px";
      this.contextMenuElement.style.zIndex = "1000";
      const deleteOption = document.createElement("div");
      deleteOption.className = "context-menu-item";
      deleteOption.textContent = "Delete Signature";
      deleteOption.addEventListener("click", () => {
        this.postMessage({ type: "deleteAnnotation", annotationId });
        this.hideContextMenu();
      });
      this.contextMenuElement.appendChild(deleteOption);
      document.body.appendChild(this.contextMenuElement);
      setTimeout(() => {
        document.addEventListener("click", () => this.hideContextMenu(), { once: true });
      }, 0);
    }
    hideContextMenu() {
      if (this.contextMenuElement) {
        this.contextMenuElement.remove();
        this.contextMenuElement = null;
      }
    }
    // ==================== GLOBAL EVENT HANDLERS ====================
    handleGlobalMouseMove(e) {
      if (this.isDraggingSignature) {
        this.dragSignature(e);
      } else if (this.isResizingSignature) {
        this.resizeSignature(e);
      }
    }
    handleGlobalMouseUp() {
      if (this.isDraggingSignature) {
        this.stopDragging();
      } else if (this.isResizingSignature) {
        this.stopResizing();
      }
    }
  };

  // webview-src/pdf/continuousScroll.ts
  var ContinuousScrollManager = class {
    constructor(scrollContainer, pageCount2, pageDimensions2, scale2, renderPageImageData, getTextBlocks, onPageChange) {
      __publicField(this, "scrollContainer", scrollContainer);
      __publicField(this, "pageCount", pageCount2);
      __publicField(this, "pageDimensions", pageDimensions2);
      __publicField(this, "scale", scale2);
      __publicField(this, "renderPageImageData", renderPageImageData);
      __publicField(this, "getTextBlocks", getTextBlocks);
      __publicField(this, "onPageChange", onPageChange);
      __publicField(this, "pageWrappers", /* @__PURE__ */ new Map());
      __publicField(this, "renderedPages", /* @__PURE__ */ new Set());
      __publicField(this, "renderQueue", []);
      __publicField(this, "isProcessingQueue", false);
      __publicField(this, "observer", null);
      this.buildLayout();
      this.setupObserver();
    }
    buildLayout() {
      this.scrollContainer.innerHTML = "";
      const dpi = 96;
      for (let i = 1; i <= this.pageCount; i++) {
        const dims = this.pageDimensions[i - 1];
        const pw = Math.round(dims.width * this.scale * dpi / 72);
        const ph = Math.round(dims.height * this.scale * dpi / 72);
        const wrapper = document.createElement("div");
        wrapper.className = "continuous-page-wrapper";
        wrapper.dataset.page = i.toString();
        wrapper.style.width = pw + "px";
        wrapper.style.height = ph + "px";
        wrapper.style.position = "relative";
        wrapper.style.margin = "0 auto 20px";
        wrapper.style.backgroundColor = "white";
        wrapper.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
        wrapper.style.flexShrink = "0";
        const canvas = document.createElement("canvas");
        canvas.width = pw;
        canvas.height = ph;
        canvas.style.display = "block";
        canvas.style.width = pw + "px";
        canvas.style.height = ph + "px";
        const textLayer = document.createElement("div");
        textLayer.className = "pdf-text-layer";
        textLayer.style.position = "absolute";
        textLayer.style.left = "0";
        textLayer.style.top = "0";
        textLayer.style.width = pw + "px";
        textLayer.style.height = ph + "px";
        textLayer.style.userSelect = "text";
        textLayer.style.pointerEvents = "auto";
        textLayer.addEventListener("mousemove", (e) => e.stopPropagation());
        wrapper.appendChild(canvas);
        wrapper.appendChild(textLayer);
        this.scrollContainer.appendChild(wrapper);
        this.pageWrappers.set(i, { wrapper, canvas, textLayer });
      }
    }
    setupObserver() {
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const page = parseInt(entry.target.dataset.page || "0");
            if (page > 0) {
              this.onPageChange(page);
              if (!this.renderedPages.has(page)) {
                this.enqueueRender(page);
              }
            }
          }
        }
      }, {
        root: this.scrollContainer,
        threshold: 0.05
      });
      for (const [, { wrapper }] of this.pageWrappers) {
        this.observer.observe(wrapper);
      }
    }
    enqueueRender(page) {
      if (!this.renderQueue.includes(page)) {
        this.renderQueue.push(page);
      }
      this.processQueue();
    }
    processQueue() {
      if (this.isProcessingQueue) return;
      this.isProcessingQueue = true;
      const process = () => {
        const page = this.renderQueue.shift();
        if (page === void 0) {
          this.isProcessingQueue = false;
          return;
        }
        if (!this.renderedPages.has(page)) {
          this.renderPageOnCanvas(page);
        }
        setTimeout(process, 0);
      };
      setTimeout(process, 0);
    }
    renderPageOnCanvas(page) {
      const parts = this.pageWrappers.get(page);
      if (!parts) return;
      const { canvas, textLayer } = parts;
      try {
        const rawImageData = this.renderPageImageData(page);
        const imageData = new ImageData(
          new Uint8ClampedArray(rawImageData.data),
          rawImageData.width,
          rawImageData.height
        );
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(imageData, 0, 0);
        }
        this.renderedPages.add(page);
        const dims = this.pageDimensions[page - 1];
        const textBlocks = this.getTextBlocks(page);
        textLayer.innerHTML = "";
        const scaleX = canvas.width / dims.width;
        const scaleY = canvas.height / dims.height;
        for (const block of textBlocks) {
          if (!block.text.trim()) continue;
          const span = document.createElement("span");
          span.textContent = block.text;
          span.style.position = "absolute";
          span.style.left = block.x * scaleX + "px";
          span.style.top = block.y * scaleY + "px";
          span.style.width = block.width * scaleX + "px";
          span.style.height = block.height * scaleY + "px";
          span.style.fontSize = block.font_size * scaleY + "px";
          span.style.lineHeight = block.font_size * scaleY + "px";
          span.style.color = "transparent";
          span.style.whiteSpace = "pre";
          span.style.overflow = "hidden";
          textLayer.appendChild(span);
        }
      } catch (e) {
        console.error(`[ContinuousScroll] Failed to render page ${page}:`, e);
      }
    }
    scrollToPage(page) {
      const parts = this.pageWrappers.get(page);
      if (parts) {
        parts.wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    destroy() {
      this.observer?.disconnect();
      this.observer = null;
      this.scrollContainer.innerHTML = "";
      this.pageWrappers.clear();
      this.renderedPages.clear();
      this.renderQueue.length = 0;
    }
  };

  // webview-src/pdf/forms.ts
  var FormOverlayManager = class {
    constructor(renderContainer) {
      __publicField(this, "renderContainer", renderContainer);
      __publicField(this, "overlay", null);
      __publicField(this, "fieldValues", /* @__PURE__ */ new Map());
    }
    /**
     * Render HTML form inputs over the canvas based on detected form fields.
     * @param fields - Form field descriptors from the Rust WASM module
     * @param pageWidth - Page width in PDF points
     * @param pageHeight - Page height in PDF points
     * @param canvasWidth - Canvas pixel width
     * @param canvasHeight - Canvas pixel height
     */
    renderFormFields(fields, pageWidth, pageHeight, canvasWidth, canvasHeight) {
      this.removeOverlay();
      if (!fields || fields.length === 0) return;
      const overlay = document.createElement("div");
      overlay.id = "pdf-form-overlay";
      overlay.style.position = "absolute";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.width = canvasWidth + "px";
      overlay.style.height = canvasHeight + "px";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "4";
      const scaleX = canvasWidth / pageWidth;
      const scaleY = canvasHeight / pageHeight;
      for (const field of fields) {
        const left = field.x * scaleX;
        const top = field.y * scaleY;
        const width = field.width * scaleX;
        const height = field.height * scaleY;
        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = left + "px";
        wrapper.style.top = top + "px";
        wrapper.style.width = width + "px";
        wrapper.style.height = height + "px";
        wrapper.style.pointerEvents = "auto";
        const savedValue = this.fieldValues.get(field.field_name) || "";
        if (field.field_type === "checkbox") {
          const input = document.createElement("input");
          input.type = "checkbox";
          input.className = "pdf-form-checkbox";
          input.checked = savedValue === "checked";
          input.style.width = width + "px";
          input.style.height = height + "px";
          input.style.margin = "0";
          input.style.cursor = "pointer";
          input.addEventListener("change", () => {
            this.fieldValues.set(field.field_name, input.checked ? "checked" : "");
          });
          wrapper.appendChild(input);
        } else {
          const input = document.createElement("input");
          input.type = "text";
          input.className = "pdf-form-input";
          input.value = savedValue;
          input.placeholder = field.field_name || "";
          input.style.width = "100%";
          input.style.height = "100%";
          input.style.boxSizing = "border-box";
          input.style.border = "1px solid var(--vscode-focusBorder, rgba(0,120,215,0.6))";
          input.style.background = "rgba(255, 255, 255, 0.85)";
          input.style.color = "#000";
          input.style.fontSize = Math.min(height * 0.7, 14) + "px";
          input.style.padding = "1px 3px";
          input.style.outline = "none";
          input.style.borderRadius = "2px";
          input.addEventListener("input", () => {
            this.fieldValues.set(field.field_name, input.value);
          });
          wrapper.appendChild(input);
        }
        overlay.appendChild(wrapper);
      }
      this.renderContainer.appendChild(overlay);
      this.overlay = overlay;
    }
    removeOverlay() {
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
    }
    getValues() {
      return Object.fromEntries(this.fieldValues);
    }
    clearValues() {
      this.fieldValues.clear();
    }
  };

  // webview-src/pdf/main.ts
  var vscode = acquireVsCodeApi();
  var previousState = vscode.getState() || {};
  var pdfRenderer = null;
  var canvasRenderer = null;
  var sidebar = null;
  var annotationManager = null;
  var signatureManager = null;
  var continuousScrollManager = null;
  var formOverlayManager = null;
  var currentPage = previousState.currentPage || 1;
  var loadedPdfUri = previousState.loadedPdfUri || null;
  var scale = previousState.scale || 0.8;
  var rendering = false;
  var wasmReady = false;
  var pendingLoadMessage = null;
  var pageCount = 0;
  var preloadStrategy = "adjacent";
  var currentFitMode = "none";
  var pageRotation = 0;
  var darkModeReading = false;
  var scrollMode = "single";
  var pageDimensions = [];
  var imageDataCache = /* @__PURE__ */ new Map();
  async function initialize() {
    console.log("[PDF Viewer] Initializing...");
    const canvasEl = document.getElementById("pdf-canvas");
    const textLayerEl = document.getElementById("pdf-text-layer");
    const renderContainer = document.getElementById("pdf-render-container");
    if (canvasEl && textLayerEl && renderContainer) {
      canvasRenderer = new PdfCanvasRenderer(canvasEl, textLayerEl, renderContainer);
      formOverlayManager = new FormOverlayManager(renderContainer);
      textLayerEl.addEventListener("mousemove", (e) => e.stopPropagation());
    }
    const thumbnailsContainer = document.getElementById("thumbnails-container");
    const outlineContainer = document.getElementById("outline-container");
    const bookmarksContainer = document.getElementById("bookmarks-container");
    if (thumbnailsContainer && outlineContainer && bookmarksContainer) {
      sidebar = new Sidebar(thumbnailsContainer, outlineContainer, bookmarksContainer, (page) => {
        console.log(`[PDF Viewer] Thumbnail clicked \u2192 navigating to page ${page}`);
        renderPage(page);
      });
    }
    annotationManager = new AnnotationManager(
      () => currentPage,
      () => scale,
      () => loadedPdfUri,
      (msg) => vscode.postMessage(msg)
    );
    signatureManager = new SignatureManager(
      () => currentPage,
      () => scale,
      () => loadedPdfUri,
      (msg) => vscode.postMessage(msg),
      annotationManager
    );
    setupUIHandlers();
    await initializeWasm();
  }
  async function initializeWasm() {
    const configEl = document.getElementById("config");
    const wasmUrl = configEl?.getAttribute("data-wasm-url");
    if (!wasmUrl) {
      console.error("[PDF Viewer] No WASM URL provided");
      return;
    }
    try {
      let pdfiumModule = null;
      if (typeof PDFiumModule !== "undefined") {
        console.log("[PDF Viewer] Initializing PDFium...");
        pdfiumModule = await PDFiumModule();
        console.log("[PDF Viewer] PDFium initialized");
      } else {
        console.error("[PDF Viewer] PDFium module not found - PDF rendering will fail");
        return;
      }
      console.log("[PDF Viewer] Initializing Rust WASM...");
      const rustModule = await __wbg_init(wasmUrl);
      init_panic_hook();
      console.log("[PDF Viewer] Binding pdfium-render to PDFium...");
      const bindResult = initialize_pdfium_render(pdfiumModule, rustModule);
      if (!bindResult) {
        console.error("[PDF Viewer] Failed to bind pdfium-render to PDFium");
        vscode.postMessage({ type: "error", error: "Failed to initialize PDFium bindings" });
        return;
      }
      console.log("[PDF Viewer] PDFium bindings established");
      pdfRenderer = new PdfRenderer();
      wasmReady = true;
      console.log("[PDF Viewer] WASM initialized successfully");
      vscode.postMessage({ type: "ready" });
      if (pendingLoadMessage) {
        console.log("[PDF Viewer] Processing pending PDF load");
        await handleLoadPDF(pendingLoadMessage);
        pendingLoadMessage = null;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[PDF Viewer] WASM init failed:", message);
      vscode.postMessage({ type: "error", error: message });
    }
  }
  window.addEventListener("message", async (event) => {
    const message = event.data;
    switch (message.type) {
      case "loadPDF":
        if (wasmReady) {
          await handleLoadPDF(message);
        } else {
          console.log("[PDF Viewer] WASM not ready yet, queuing load");
          pendingLoadMessage = message;
        }
        break;
      case "getState":
        vscode.postMessage({
          type: "state",
          loadedPdfUri,
          currentPage,
          hasPDF: pageCount > 0,
          savedPage: message.savedPage || 1
        });
        if (pageCount > 0 && loadedPdfUri === message.requestedUri && currentPage !== (message.savedPage || 1)) {
          await renderPage(message.savedPage || 1);
        }
        break;
      case "goToPage":
        if (pageCount > 0 && message.page) {
          const targetPage = Math.max(1, Math.min(message.page, pageCount));
          await renderPage(targetPage);
        }
        break;
      case "clearPDF": {
        pdfRenderer?.close();
        pageCount = 0;
        currentPage = 1;
        loadedPdfUri = null;
        pageDimensions = [];
        imageDataCache.clear();
        canvasRenderer?.clear();
        sidebar?.clearThumbnails();
        break;
      }
      case "getSelectionRect": {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          vscode.postMessage({
            type: "selectionRect",
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
          });
        } else {
          vscode.postMessage({ type: "selectionRect", rect: null });
        }
        break;
      }
      case "loadAnnotations":
        if (annotationManager) {
          annotationManager.setAnnotations(message.annotations || []);
          annotationManager.renderAnnotations(currentPage, scale);
          sidebar?.renderBookmarks(annotationManager.getBookmarks());
        }
        break;
      case "savedSignatures":
        signatureManager?.renderSavedSignatures(message.signatures || []);
        break;
      case "addSignatureAnnotation": {
        const sigAnnotation = message.annotation;
        sigAnnotation.id = "sig_" + Date.now();
        sigAnnotation.createdAt = Date.now();
        annotationManager?.addLocalAnnotation(sigAnnotation);
        annotationManager?.renderAnnotations(currentPage, scale);
        break;
      }
      case "downloadAnnotations": {
        const blob = new Blob([message.json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "annotations.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }
    }
  });
  async function handleLoadPDF(message) {
    if (!pdfRenderer) {
      console.error("[PDF Viewer] Renderer not initialized");
      return;
    }
    sidebar?.clearThumbnails();
    try {
      preloadStrategy = message.preloadStrategy || "adjacent";
      const startPage = message.startPage || 1;
      const skipPreload = message.skipPreload || false;
      loadedPdfUri = message.pdfUri;
      vscode.setState({ currentPage: startPage, loadedPdfUri, scale });
      let uint8Array;
      if (message.encoding === "base64") {
        const binaryString = atob(message.data);
        uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
      } else {
        uint8Array = new Uint8Array(message.data);
      }
      console.log("[PDF Viewer] Loading PDF, size:", uint8Array.length, "bytes");
      const metadataJson = pdfRenderer.load(uint8Array);
      const metadata = JSON.parse(metadataJson);
      pageCount = metadata.page_count;
      pageDimensions = metadata.pages;
      imageDataCache.clear();
      console.log("[PDF Viewer] PDF loaded, pages:", pageCount);
      const totalPagesSpan = document.getElementById("total-pages");
      if (totalPagesSpan) totalPagesSpan.textContent = pageCount.toString();
      currentPage = Math.max(1, Math.min(startPage, pageCount));
      scale = 0.8;
      try {
        setupThumbnails();
      } catch (thumbErr) {
        console.error("[PDF Viewer] Thumbnail setup failed:", thumbErr);
      }
      try {
        await extractOutline();
      } catch (outlineErr) {
        console.error("[PDF Viewer] Outline extraction failed:", outlineErr);
      }
      await renderPage(currentPage);
      if (!skipPreload) {
        if (preloadStrategy === "all") {
          await preloadAllPages();
        } else if (preloadStrategy === "adjacent") {
          preloadAdjacentPages(currentPage);
        }
      }
      vscode.postMessage({ type: "pdfLoaded" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[PDF Viewer] Error loading PDF:", msg);
      vscode.postMessage({ type: "error", error: msg });
    }
  }
  async function renderPage(pageNum) {
    if (!pdfRenderer || !canvasRenderer || rendering) return;
    rendering = true;
    try {
      const dims = pageDimensions[pageNum - 1];
      if (!dims) throw new Error(`No dimensions for page ${pageNum}`);
      const dpi = 96;
      const pixelWidth = Math.round(dims.width * scale * dpi / 72);
      const pixelHeight = Math.round(dims.height * scale * dpi / 72);
      const imageData = pdfRenderer.render_page(pageNum - 1, pixelWidth, pixelHeight);
      imageDataCache.set(pageNum, imageData);
      canvasRenderer.renderImageData(imageData, pixelWidth, pixelHeight);
      const canvas = document.getElementById("pdf-canvas");
      if (canvas) {
        canvas.classList.remove("page-transition");
        void canvas.offsetWidth;
        canvas.classList.add("page-transition");
      }
      let textBlocks = [];
      try {
        console.log(`[PDF Viewer] ===== EXTRACTING TEXT page ${pageNum} =====`);
        const textJson = pdfRenderer.get_page_text(pageNum - 1);
        console.log(`[PDF Viewer] Raw JSON length: ${textJson.length}, preview: ${textJson.substring(0, 200)}`);
        const rawBlocks = JSON.parse(textJson);
        console.log(`[PDF Viewer] Parsed ${rawBlocks.length} raw blocks`);
        for (const block of rawBlocks) {
          const x = block.x;
          const y = block.y;
          const w = block.width;
          const h = block.height;
          const fs = block.font_size;
          const text = block.text;
          if (text && typeof x === "number" && typeof y === "number" && typeof w === "number" && typeof h === "number" && isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h) && w > 0 && h > 0) {
            textBlocks.push({ text, x, y, width: w, height: h, font_size: typeof fs === "number" && isFinite(fs) ? fs : 12 });
          }
        }
        console.log(`[PDF Viewer] Valid blocks: ${textBlocks.length} / ${rawBlocks.length}`);
      } catch (textError) {
        console.error("[PDF Viewer] ===== TEXT EXTRACTION FAILED =====", textError);
      }
      canvasRenderer.renderTextLayer(textBlocks, dims.width, dims.height, scale);
      if (formOverlayManager) {
        try {
          const rendererWithForms = pdfRenderer;
          if (typeof rendererWithForms.get_form_fields === "function") {
            const formJson = rendererWithForms.get_form_fields(pageNum - 1);
            const formFields = JSON.parse(formJson);
            if (formFields.length > 0) {
              formOverlayManager.renderFormFields(formFields, dims.width, dims.height, pixelWidth, pixelHeight);
            } else {
              formOverlayManager.removeOverlay();
            }
          } else {
            formOverlayManager.removeOverlay();
          }
        } catch {
          formOverlayManager.removeOverlay();
        }
      }
      currentPage = pageNum;
      vscode.setState({ currentPage, loadedPdfUri, scale });
      const currentPageSpan = document.getElementById("current-page");
      if (currentPageSpan) currentPageSpan.textContent = currentPage.toString();
      const prevButton = document.getElementById("prev-page");
      const nextButton = document.getElementById("next-page");
      if (prevButton) prevButton.disabled = currentPage <= 1;
      if (nextButton) nextButton.disabled = currentPage >= pageCount;
      sidebar?.updateActiveThumbnail(currentPage);
      vscode.postMessage({ type: "pageChanged", page: pageNum });
      if (preloadStrategy === "adjacent") {
        preloadAdjacentPages(pageNum);
      }
      annotationManager?.renderAnnotations(currentPage, scale);
    } catch (error) {
      console.error("[PDF Viewer] Error rendering page:", error);
    } finally {
      rendering = false;
    }
  }
  async function preloadAllPages() {
    if (!pdfRenderer) return;
    const maxPages = Math.min(pageCount, 500);
    const loadingUri = loadedPdfUri;
    console.log(`[PDF Viewer] Preloading ${maxPages} pages...`);
    for (let i = 1; i <= maxPages; i++) {
      if (loadedPdfUri !== loadingUri || !pdfRenderer) return;
      if (imageDataCache.has(i)) continue;
      try {
        const dims = pageDimensions[i - 1];
        const dpi = 96;
        const pw = Math.round(dims.width * scale * dpi / 72);
        const ph = Math.round(dims.height * scale * dpi / 72);
        const img = pdfRenderer.render_page(i - 1, pw, ph);
        imageDataCache.set(i, img);
      } catch (e) {
        console.error(`[PDF Viewer] Failed to preload page ${i}:`, e);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    console.log(`[PDF Viewer] Preload complete`);
  }
  function preloadAdjacentPages(centerPage) {
    if (!pdfRenderer) return;
    const range = 2;
    const start = Math.max(1, centerPage - range);
    const end = Math.min(pageCount, centerPage + range);
    for (let i = start; i <= end; i++) {
      if (imageDataCache.has(i)) continue;
      try {
        const dims = pageDimensions[i - 1];
        const dpi = 96;
        const pw = Math.round(dims.width * scale * dpi / 72);
        const ph = Math.round(dims.height * scale * dpi / 72);
        const img = pdfRenderer.render_page(i - 1, pw, ph);
        imageDataCache.set(i, img);
      } catch (e) {
        console.error(`[PDF Viewer] Failed to preload page ${i}:`, e);
      }
    }
    const minKeep = Math.max(1, centerPage - 5);
    const maxKeep = Math.min(pageCount, centerPage + 5);
    for (const [page] of imageDataCache) {
      if (page < minKeep || page > maxKeep) {
        imageDataCache.delete(page);
      }
    }
  }
  function setupThumbnails() {
    if (!pdfRenderer || !sidebar) return;
    console.log(`[PDF Viewer] Creating ${pageCount} thumbnail placeholders, uri: ${loadedPdfUri}`);
    sidebar.setThumbnailPlaceholders(pageCount, pageDimensions, currentPage, (pageNum) => {
      if (!pdfRenderer) return null;
      const img = pdfRenderer.render_thumbnail(pageNum - 1, 150);
      return new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height
      );
    });
  }
  async function extractOutline() {
    if (!pdfRenderer || !sidebar) return;
    try {
      const outlineJson = pdfRenderer.get_outline();
      const outline = JSON.parse(outlineJson);
      sidebar.setOutline(outline);
    } catch (e) {
      console.error("[PDF Viewer] Failed to extract outline:", e);
      sidebar.setOutline([]);
    }
  }
  function enterContinuousMode() {
    if (!pdfRenderer || pageCount === 0) return;
    scrollMode = "continuous";
    const canvasWrapper = document.getElementById("canvas-wrapper");
    const continuousContainer = document.getElementById("continuous-scroll-container");
    if (!canvasWrapper || !continuousContainer) return;
    canvasWrapper.style.display = "none";
    continuousContainer.style.display = "flex";
    continuousScrollManager = new ContinuousScrollManager(
      continuousContainer,
      pageCount,
      pageDimensions,
      scale,
      (page) => {
        if (!pdfRenderer) throw new Error("No renderer");
        const dims = pageDimensions[page - 1];
        const dpi = 96;
        const pw = Math.round(dims.width * scale * dpi / 72);
        const ph = Math.round(dims.height * scale * dpi / 72);
        return pdfRenderer.render_page(page - 1, pw, ph);
      },
      (page) => {
        if (!pdfRenderer) return [];
        try {
          const textJson = pdfRenderer.get_page_text(page - 1);
          const rawBlocks = JSON.parse(textJson);
          return rawBlocks.filter((b) => {
            const x = b.x;
            const y = b.y;
            const w = b.width;
            const h = b.height;
            return b.text && typeof x === "number" && typeof y === "number" && typeof w === "number" && typeof h === "number" && isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h) && w > 0 && h > 0;
          }).map((b) => ({
            text: b.text,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            font_size: typeof b.font_size === "number" && isFinite(b.font_size) ? b.font_size : 12
          }));
        } catch {
          return [];
        }
      },
      (page) => {
        currentPage = page;
        const span = document.getElementById("current-page");
        if (span) span.textContent = page.toString();
        sidebar?.updateActiveThumbnail(page);
        vscode.setState({ currentPage: page, loadedPdfUri, scale });
      }
    );
    continuousScrollManager.scrollToPage(currentPage);
  }
  function exitContinuousMode() {
    scrollMode = "single";
    continuousScrollManager?.destroy();
    continuousScrollManager = null;
    const canvasWrapper = document.getElementById("canvas-wrapper");
    const continuousContainer = document.getElementById("continuous-scroll-container");
    if (canvasWrapper) canvasWrapper.style.display = "";
    if (continuousContainer) continuousContainer.style.display = "none";
    if (pageCount > 0) renderPage(currentPage);
  }
  function setupUIHandlers() {
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");
    prevButton?.addEventListener("click", () => {
      if (currentPage > 1) renderPage(currentPage - 1);
    });
    nextButton?.addEventListener("click", () => {
      if (currentPage < pageCount) renderPage(currentPage + 1);
    });
    const zoomInButton = document.getElementById("zoom-in");
    const zoomOutButton = document.getElementById("zoom-out");
    let isZooming = false;
    zoomInButton?.addEventListener("click", () => {
      scale *= 1.2;
      imageDataCache.clear();
      renderPage(currentPage);
    });
    zoomOutButton?.addEventListener("click", () => {
      scale /= 1.2;
      imageDataCache.clear();
      renderPage(currentPage);
    });
    const canvasWrapperEl = document.getElementById("canvas-wrapper");
    canvasWrapperEl?.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (isZooming) return;
      isZooming = true;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.5, Math.min(3, scale * delta));
      if (Math.abs(newScale - scale) > 0.01) {
        scale = newScale;
        imageDataCache.clear();
        renderPage(currentPage).then(() => {
          isZooming = false;
        });
      } else {
        isZooming = false;
      }
    }, { passive: false });
    const printButton = document.getElementById("print-btn");
    printButton?.addEventListener("click", () => {
      if (pageCount > 0) vscode.postMessage({ type: "printPdf" });
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        if (pageCount > 0) vscode.postMessage({ type: "printPdf" });
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentPage > 1) renderPage(currentPage - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentPage < pageCount) renderPage(currentPage + 1);
      }
    });
    document.addEventListener("mouseup", () => {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        vscode.postMessage({
          type: "textSelected",
          selection: { startPage: currentPage, endPage: currentPage, text: selection.toString() }
        });
      } else {
        vscode.postMessage({ type: "clearSelection" });
      }
    });
    const toggleSidebarButton = document.getElementById("toggle-sidebar");
    const sidebarEl = document.getElementById("sidebar");
    toggleSidebarButton?.addEventListener("click", () => {
      sidebarEl?.classList.toggle("collapsed");
    });
    const sidebarTabs = document.querySelectorAll(".sidebar-tab");
    const thumbnailsView = document.getElementById("thumbnails-view");
    const outlineView = document.getElementById("outline-view");
    const bookmarksView = document.getElementById("bookmarks-view");
    sidebarTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab;
        sidebarTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        thumbnailsView?.classList.remove("active");
        outlineView?.classList.remove("active");
        bookmarksView?.classList.remove("active");
        if (tabName === "thumbnails") thumbnailsView?.classList.add("active");
        else if (tabName === "outline") outlineView?.classList.add("active");
        else if (tabName === "bookmarks") bookmarksView?.classList.add("active");
      });
    });
    const highlightButtons = document.querySelectorAll(".highlight-btn");
    highlightButtons.forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });
      btn.addEventListener("click", () => {
        const color = btn.dataset.color || "yellow";
        console.log(`[PDF Viewer] Highlight button clicked: ${color}`);
        annotationManager?.setHighlightColor(color);
        highlightButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        annotationManager?.createHighlightFromSelection(currentPage, scale);
      });
    });
    const deleteHighlightButton = document.getElementById("delete-highlight");
    deleteHighlightButton?.addEventListener("click", () => {
      annotationManager?.deleteSelectedAnnotation();
    });
    const addBookmarkButton = document.getElementById("add-bookmark");
    addBookmarkButton?.addEventListener("click", () => {
      if (pageCount <= 0 || !loadedPdfUri) return;
      const container = document.getElementById("bookmarks-header");
      if (!container || container.querySelector(".bookmark-input-row")) return;
      const row = document.createElement("div");
      row.className = "bookmark-input-row";
      const pageInput = document.createElement("input");
      pageInput.type = "number";
      pageInput.className = "bookmark-page-input";
      pageInput.min = "1";
      pageInput.max = pageCount.toString();
      pageInput.value = currentPage.toString();
      pageInput.title = "Page number";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "bookmark-name-input";
      input.placeholder = "Bookmark name";
      input.value = `Page ${currentPage}`;
      const saveBtn = document.createElement("button");
      saveBtn.className = "bookmark-save-btn";
      saveBtn.textContent = "Save";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "bookmark-cancel-btn";
      cancelBtn.textContent = "Cancel";
      pageInput.addEventListener("input", () => {
        const p = parseInt(pageInput.value);
        if (!isNaN(p)) input.value = `Page ${p}`;
      });
      const submit = () => {
        const name = input.value.trim();
        const targetPage = Math.max(1, Math.min(pageCount, parseInt(pageInput.value) || currentPage));
        if (name) {
          vscode.postMessage({
            type: "addAnnotation",
            annotation: {
              pdfUri: loadedPdfUri,
              page: targetPage,
              text: name,
              color: "bookmark",
              boundingBoxes: []
            }
          });
        }
        row.remove();
      };
      const onKeydown = (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") row.remove();
      };
      input.addEventListener("keydown", onKeydown);
      pageInput.addEventListener("keydown", onKeydown);
      saveBtn.addEventListener("click", submit);
      cancelBtn.addEventListener("click", () => row.remove());
      row.appendChild(pageInput);
      row.appendChild(input);
      row.appendChild(saveBtn);
      row.appendChild(cancelBtn);
      container.appendChild(row);
      input.select();
    });
    document.addEventListener("deleteBookmark", ((e) => {
      const annotationId = e.detail;
      if (annotationId) {
        vscode.postMessage({ type: "deleteAnnotation", annotationId });
      }
    }));
    const fitWidthButton = document.getElementById("fit-width");
    const fitPageButton = document.getElementById("fit-page");
    const actualSizeButton = document.getElementById("actual-size");
    function applyFitMode() {
      if (!pageDimensions[currentPage - 1] || currentFitMode === "none") return;
      const wrapper = document.getElementById("canvas-wrapper");
      if (!wrapper) return;
      const dims = pageDimensions[currentPage - 1];
      const dpi = 96;
      const wrapperW = wrapper.clientWidth - 40;
      const wrapperH = wrapper.clientHeight - 40;
      if (currentFitMode === "width") {
        scale = wrapperW / (dims.width * dpi / 72);
      } else if (currentFitMode === "page") {
        scale = Math.min(wrapperW / (dims.width * dpi / 72), wrapperH / (dims.height * dpi / 72));
      } else if (currentFitMode === "actual") {
        scale = 1;
      }
    }
    function setFitMode(mode) {
      currentFitMode = mode;
      [fitWidthButton, fitPageButton, actualSizeButton].forEach((btn) => btn?.classList.remove("active"));
      if (mode === "width") fitWidthButton?.classList.add("active");
      else if (mode === "page") fitPageButton?.classList.add("active");
      else if (mode === "actual") actualSizeButton?.classList.add("active");
      applyFitMode();
      imageDataCache.clear();
      if (pageCount > 0) renderPage(currentPage);
    }
    fitWidthButton?.addEventListener("click", () => setFitMode(currentFitMode === "width" ? "none" : "width"));
    fitPageButton?.addEventListener("click", () => setFitMode(currentFitMode === "page" ? "none" : "page"));
    actualSizeButton?.addEventListener("click", () => setFitMode(currentFitMode === "actual" ? "none" : "actual"));
    const canvasWrapper = document.getElementById("canvas-wrapper");
    if (canvasWrapper && typeof ResizeObserver !== "undefined") {
      const resizeObs = new ResizeObserver(() => {
        if (currentFitMode !== "none" && pageCount > 0) {
          applyFitMode();
          imageDataCache.clear();
          renderPage(currentPage);
        }
      });
      resizeObs.observe(canvasWrapper);
    }
    const rotateButton = document.getElementById("rotate-view");
    rotateButton?.addEventListener("click", () => {
      pageRotation = (pageRotation + 90) % 360;
      const renderContainer = document.getElementById("pdf-render-container");
      if (renderContainer) {
        renderContainer.classList.remove("rotated-90", "rotated-180", "rotated-270");
        if (pageRotation !== 0) renderContainer.classList.add(`rotated-${pageRotation}`);
      }
    });
    const darkModeButton = document.getElementById("dark-mode-reading");
    darkModeButton?.addEventListener("click", () => {
      darkModeReading = !darkModeReading;
      const cvs = document.getElementById("pdf-canvas");
      if (cvs) cvs.style.filter = darkModeReading ? "invert(1) hue-rotate(180deg)" : "";
      darkModeButton.classList.toggle("active", darkModeReading);
    });
    const scrollModeButton = document.getElementById("scroll-mode-toggle");
    scrollModeButton?.addEventListener("click", () => {
      if (scrollMode === "single") {
        enterContinuousMode();
      } else {
        exitContinuousMode();
      }
      scrollModeButton.classList.toggle("active", scrollMode === "continuous");
    });
    const exportAnnotationsButton = document.getElementById("export-annotations");
    exportAnnotationsButton?.addEventListener("click", () => {
      if (pageCount > 0) vscode.postMessage({ type: "exportAnnotations" });
    });
    const redactToolButton = document.getElementById("redact-tool");
    redactToolButton?.addEventListener("mousedown", (e) => e.preventDefault());
    redactToolButton?.addEventListener("click", () => {
      const isActive = annotationManager?.getRedactionMode() ?? false;
      annotationManager?.setRedactionMode(!isActive);
      redactToolButton.classList.toggle("active", !isActive);
      const textLayer = document.getElementById("pdf-text-layer");
      if (textLayer) textLayer.style.cursor = !isActive ? "crosshair" : "text";
    });
    const textLayerEl = document.getElementById("pdf-text-layer");
    if (textLayerEl) {
      let redactStartX = 0;
      let redactStartY = 0;
      let redactPreview = null;
      let isRedactDragging = false;
      textLayerEl.addEventListener("mousedown", (e) => {
        if (!annotationManager?.getRedactionMode()) return;
        e.preventDefault();
        e.stopPropagation();
        isRedactDragging = true;
        const rect = textLayerEl.getBoundingClientRect();
        redactStartX = e.clientX - rect.left;
        redactStartY = e.clientY - rect.top;
        redactPreview = document.createElement("div");
        redactPreview.style.position = "absolute";
        redactPreview.style.background = "rgba(0,0,0,0.5)";
        redactPreview.style.border = "2px dashed #ff0000";
        redactPreview.style.left = redactStartX + "px";
        redactPreview.style.top = redactStartY + "px";
        redactPreview.style.width = "0";
        redactPreview.style.height = "0";
        redactPreview.style.pointerEvents = "none";
        redactPreview.style.zIndex = "10";
        textLayerEl.appendChild(redactPreview);
      });
      textLayerEl.addEventListener("mousemove", (e) => {
        if (!isRedactDragging || !redactPreview) return;
        e.stopPropagation();
        const rect = textLayerEl.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const left = Math.min(redactStartX, curX);
        const top = Math.min(redactStartY, curY);
        const w = Math.abs(curX - redactStartX);
        const h = Math.abs(curY - redactStartY);
        redactPreview.style.left = left + "px";
        redactPreview.style.top = top + "px";
        redactPreview.style.width = w + "px";
        redactPreview.style.height = h + "px";
      });
      textLayerEl.addEventListener("mouseup", (e) => {
        if (!isRedactDragging) return;
        isRedactDragging = false;
        const rect = textLayerEl.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const left = Math.min(redactStartX, curX);
        const top = Math.min(redactStartY, curY);
        const w = Math.abs(curX - redactStartX);
        const h = Math.abs(curY - redactStartY);
        redactPreview?.remove();
        redactPreview = null;
        if (annotationManager?.getRedactionMode()) {
          annotationManager.createRedactionFromDrag(left, top, w, h, currentPage, scale);
        }
      });
    }
    const addSignatureButton = document.getElementById("add-signature");
    addSignatureButton?.addEventListener("click", () => {
      signatureManager?.showModal();
    });
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!target.closest(".pdf-highlight") && !target.closest(".pdf-signature-container") && !target.closest(".resize-handle") && !target.closest("#delete-highlight") && !target.closest(".highlight-btn") && !target.closest("#annotation-toolbar") && !target.closest(".signature-context-menu")) {
        annotationManager?.deselectAll();
      }
    });
    document.addEventListener("mousemove", (e) => {
      signatureManager?.handleGlobalMouseMove(e);
    });
    document.addEventListener("mouseup", () => {
      signatureManager?.handleGlobalMouseUp();
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
