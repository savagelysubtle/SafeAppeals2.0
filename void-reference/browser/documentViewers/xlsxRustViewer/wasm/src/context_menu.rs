use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct ContextMenuItem {
    pub id: String,
    pub label: String,
    pub shortcut: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ContextMenuResponse {
    pub items: Vec<ContextMenuItem>,
}

#[wasm_bindgen]
pub struct ContextMenuManager;

#[wasm_bindgen]
impl ContextMenuManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ContextMenuManager {
        ContextMenuManager
    }

    pub fn get_context_menu(&self, row: u32, col: u32) -> Result<String, JsError> {
        let items = vec![
            ContextMenuItem {
                id: "cut".to_string(),
                label: "Cut".to_string(),
                shortcut: Some("Ctrl+X".to_string()),
            },
            ContextMenuItem {
                id: "copy".to_string(),
                label: "Copy".to_string(),
                shortcut: Some("Ctrl+C".to_string()),
            },
            ContextMenuItem {
                id: "paste".to_string(),
                label: "Paste".to_string(),
                shortcut: Some("Ctrl+V".to_string()),
            },
            ContextMenuItem {
                id: "delete_row".to_string(),
                label: format!("Delete Row {}", row + 1),
                shortcut: None,
            },
             ContextMenuItem {
                id: "delete_col".to_string(),
                label: format!("Delete Column {}", get_col_name(col)),
                shortcut: None,
            },
            ContextMenuItem {
                id: "insert_row_above".to_string(),
                label: "Insert Row Above".to_string(),
                shortcut: None,
            },
            ContextMenuItem {
                id: "insert_col_left".to_string(),
                label: "Insert Column Left".to_string(),
                shortcut: None,
            },
        ];

        let response = ContextMenuResponse { items };
        let json = serde_json::to_string(&response).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(json)
    }
}

fn get_col_name(mut col_idx: u32) -> String {
    let mut name = String::new();
    loop {
        let remainder = col_idx % 26;
        name.insert(0, (b'A' + remainder as u8) as char);
        if col_idx < 26 {
            break;
        }
        col_idx = (col_idx / 26) - 1;
    }
    name
}
