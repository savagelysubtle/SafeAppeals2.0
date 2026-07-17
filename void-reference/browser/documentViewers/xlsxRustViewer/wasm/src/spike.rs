use wasm_bindgen::prelude::*;
use rust_xlsxwriter::Workbook;

#[wasm_bindgen]
pub fn create_simple_xlsx() -> Result<Vec<u8>, JsError> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    worksheet.write(0, 0, "Hello").map_err(|e| JsError::new(&e.to_string()))?;
    worksheet.write(0, 1, "from").map_err(|e| JsError::new(&e.to_string()))?;
    worksheet.write(0, 2, "Rust!").map_err(|e| JsError::new(&e.to_string()))?;
    worksheet.write_number(1, 0, 123.0).map_err(|e| JsError::new(&e.to_string()))?;
    worksheet.write_number(1, 1, 456.78).map_err(|e| JsError::new(&e.to_string()))?;

    let buf = workbook.save_to_buffer().map_err(|e| JsError::new(&e.to_string()))?;
    Ok(buf)
}
