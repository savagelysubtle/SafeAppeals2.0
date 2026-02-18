use wasm_bindgen::prelude::*;

pub mod renderer;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
    log("[PDF Viewer WASM] Panic hook initialized");
}
