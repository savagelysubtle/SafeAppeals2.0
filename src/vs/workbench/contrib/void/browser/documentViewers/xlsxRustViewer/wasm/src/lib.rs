use wasm_bindgen::prelude::*;

mod spike;
pub mod parser; // Expose the parser module
pub mod formulas; // Expose the formulas module
pub mod context_menu; // Expose the context menu module
pub mod table_ops; // Expose the table_ops module
pub mod writer; // Expose the writer module
pub mod viewport; // Expose the viewport module

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
    log("Panic hook initialized");
}

#[wasm_bindgen]
pub fn greet() -> String {
    "Hello from Rust!".to_string()
}
