use wasm_bindgen::prelude::*;
use pdfium_render::prelude::*;
use serde::Serialize;
use web_sys::ImageData;

fn log(msg: &str) {
    web_sys::console::log_1(&JsValue::from_str(msg));
}

// Serde models for JSON boundary

#[derive(Serialize)]
pub struct PdfMetadata {
    pub page_count: u32,
    pub pages: Vec<PageInfo>,
}

#[derive(Serialize)]
pub struct PageInfo {
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize)]
pub struct TextBlock {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub font_size: f64,
}

#[derive(Serialize)]
pub struct OutlineItem {
    pub title: String,
    pub page_index: Option<i32>,
    pub children: Vec<OutlineItem>,
}

#[derive(Serialize)]
pub struct FormField {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub field_type: String,
    pub field_name: String,
}

#[derive(Serialize)]
pub struct PageDimensions {
    pub width: f64,
    pub height: f64,
}

// Static Pdfium instance (initialized once, lives for the lifetime of the WASM module)
use std::sync::OnceLock;

static PDFIUM: OnceLock<Pdfium> = OnceLock::new();

fn get_pdfium() -> &'static Pdfium {
    PDFIUM.get_or_init(|| {
        let bindings = Pdfium::bind_to_system_library()
            .expect("Failed to bind to PDFium system library");
        Pdfium::new(bindings)
    })
}

#[wasm_bindgen]
pub struct PdfRenderer {
    // Store the raw PDF bytes so we can re-open the document on demand.
    // pdfium-render documents hold references to Pdfium which complicates
    // storing them in a struct with wasm_bindgen. Instead we re-open from
    // bytes each time an operation is needed. For performance-critical paths
    // (render_page), the caller should batch calls.
    pdf_bytes: Option<Vec<u8>>,
    page_count: u32,
    password: Option<String>,
}

#[wasm_bindgen]
impl PdfRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PdfRenderer {
        PdfRenderer {
            pdf_bytes: None,
            page_count: 0,
            password: None,
        }
    }

    /// Load PDF from bytes. Returns JSON metadata: { page_count, pages: [{width, height}] }
    pub fn load(&mut self, data: &[u8]) -> Result<String, JsError> {
        let pdfium = get_pdfium();

        // Try loading the document to validate and extract metadata
        let document = pdfium
            .load_pdf_from_byte_slice(data, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to load PDF: {:?}", e)))?;

        let page_count = document.pages().len() as u32;
        let mut pages = Vec::with_capacity(page_count as usize);

        for index in 0..page_count {
            let page = document
                .pages()
                .get(index as i32)
                .map_err(|e| JsError::new(&format!("Failed to get page {}: {:?}", index, e)))?;

            pages.push(PageInfo {
                width: page.width().value as f64,
                height: page.height().value as f64,
            });
        }

        // Store bytes for later operations
        self.pdf_bytes = Some(data.to_vec());
        self.page_count = page_count;

        let metadata = PdfMetadata { page_count, pages };

        serde_json::to_string(&metadata)
            .map_err(|e| JsError::new(&format!("JSON serialization failed: {}", e)))
    }

    /// Render a page to ImageData at target pixel dimensions.
    pub fn render_page(
        &self,
        index: i32,
        width: u16,
        height: u16,
    ) -> Result<ImageData, JsError> {
        let bytes = self
            .pdf_bytes
            .as_ref()
            .ok_or_else(|| JsError::new("No PDF loaded"))?;

        let pdfium = get_pdfium();
        let document = pdfium
            .load_pdf_from_byte_slice(bytes, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to open PDF: {:?}", e)))?;

        let page = document
            .pages()
            .get(index)
            .map_err(|e| JsError::new(&format!("Failed to get page {}: {:?}", index, e)))?;

        let config = PdfRenderConfig::new()
            .set_target_size(width as Pixels, height as Pixels)
            .render_form_data(true)
            .render_annotations(true);

        let bitmap = page
            .render_with_config(&config)
            .map_err(|e| JsError::new(&format!("Render failed: {:?}", e)))?;

        bitmap
            .as_image_data()
            .map_err(|e| JsError::new(&format!("ImageData conversion failed: {:?}", e)))
    }

    /// Render a thumbnail for a page, scaling width to max_width and preserving aspect ratio.
    pub fn render_thumbnail(
        &self,
        index: i32,
        max_width: u16,
    ) -> Result<ImageData, JsError> {
        let bytes = self
            .pdf_bytes
            .as_ref()
            .ok_or_else(|| JsError::new("No PDF loaded"))?;

        let pdfium = get_pdfium();
        let document = pdfium
            .load_pdf_from_byte_slice(bytes, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to open PDF: {:?}", e)))?;

        let page = document
            .pages()
            .get(index)
            .map_err(|e| JsError::new(&format!("Failed to get page {}: {:?}", index, e)))?;

        let config = PdfRenderConfig::new()
            .set_target_width(max_width as Pixels);

        let bitmap = page
            .render_with_config(&config)
            .map_err(|e| JsError::new(&format!("Thumbnail render failed: {:?}", e)))?;

        bitmap
            .as_image_data()
            .map_err(|e| JsError::new(&format!("ImageData conversion failed: {:?}", e)))
    }

    /// Extract text from a page with bounding boxes.
    /// Returns JSON array: [{text, x, y, width, height, font_size}]
    ///
    /// Uses three strategies in priority order:
    /// 1. Page objects API (iterates text objects with bounds - works even without system fonts)
    /// 2. Text page chars API (character-level bounds)
    /// 3. Text page segments API (segment-level bounds)
    pub fn get_page_text(&self, index: i32) -> Result<String, JsError> {
        let bytes = self
            .pdf_bytes
            .as_ref()
            .ok_or_else(|| JsError::new("No PDF loaded"))?;

        let pdfium = get_pdfium();
        let document = pdfium
            .load_pdf_from_byte_slice(bytes, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to open PDF: {:?}", e)))?;

        let page = document
            .pages()
            .get(index)
            .map_err(|e| JsError::new(&format!("Failed to get page {}: {:?}", index, e)))?;

        let page_height = page.height().value as f64;
        let mut blocks: Vec<TextBlock> = Vec::new();

        // Strategy 1: Page objects API — iterates rendered text objects directly.
        // This bypasses FPDFText_LoadPage and works even when the WASM binary
        // cannot resolve non-embedded fonts.
        // Each text object is split into lines so that spans are line-sized
        // rather than paragraph-sized, enabling granular text selection.
        let mut text_obj_count = 0u32;
        for obj in page.objects().iter() {
            if let Some(text_obj) = obj.as_text_object() {
                text_obj_count += 1;
                let text = text_obj.text();
                if text.trim().is_empty() {
                    continue;
                }
                if let Ok(quad) = obj.bounds() {
                    let obj_left = quad.left().value as f64;
                    let obj_right = quad.right().value as f64;
                    let obj_top = quad.top().value as f64;
                    let obj_bottom = quad.bottom().value as f64;
                    let obj_w = obj_right - obj_left;
                    let obj_h = obj_top - obj_bottom;
                    let font_size = text_obj.scaled_font_size().value as f64;

                    if obj_w <= 0.0 || obj_h <= 0.0 {
                        continue;
                    }

                    // Split text into lines and distribute vertically
                    let lines: Vec<&str> = text.split('\n')
                        .flat_map(|l| l.split('\r'))
                        .collect();
                    let non_empty_lines: Vec<&str> = lines.iter()
                        .filter(|l| !l.trim().is_empty())
                        .copied()
                        .collect();

                    if non_empty_lines.is_empty() {
                        continue;
                    }

                    if non_empty_lines.len() == 1 {
                        // Single-line text object: use font_size for height
                        let line_h = font_size.max(1.0).min(obj_h);
                        blocks.push(TextBlock {
                            text: non_empty_lines[0].to_string(),
                            x: obj_left,
                            y: page_height - obj_top,
                            width: obj_w,
                            height: line_h,
                            font_size,
                        });
                    } else {
                        // Multi-line: distribute lines evenly within the bounding box
                        let line_h = obj_h / non_empty_lines.len() as f64;
                        for (i, line) in non_empty_lines.iter().enumerate() {
                            let line_top = obj_top - (i as f64 * line_h);
                            blocks.push(TextBlock {
                                text: line.to_string(),
                                x: obj_left,
                                y: page_height - line_top,
                                width: obj_w,
                                height: line_h,
                                font_size,
                            });
                        }
                    }
                }
            }
        }

        log(&format!("[WASM] Strategy 1 (page objects): {} text objects -> {} blocks", text_obj_count, blocks.len()));

        // Strategy 2: If page objects gave us nothing, try character-level extraction
        if blocks.is_empty() {
            if let Ok(text_page) = page.text() {
                let char_count = text_page.chars().len();
                log(&format!("[WASM] Strategy 2 (chars): {} chars found", char_count));

                if char_count > 0 {
                    let mut current_text = String::new();
                    let mut block_left = f64::MAX;
                    let mut block_top = f64::MAX;
                    let mut block_right = f64::MIN;
                    let mut block_bottom = f64::MIN;
                    let mut last_char_right: f64 = 0.0;
                    let mut last_char_y: f64 = 0.0;
                    let mut current_font_size: f64 = 12.0;
                    let mut is_first_char = true;

                    for char_ref in text_page.chars().iter() {
                        let unicode = match char_ref.unicode_char() {
                            Some(c) => c,
                            None => continue,
                        };

                        if unicode.is_control() {
                            if !current_text.is_empty() && block_left < f64::MAX {
                                blocks.push(TextBlock {
                                    text: current_text.clone(),
                                    x: block_left,
                                    y: page_height - block_top,
                                    width: block_right - block_left,
                                    height: block_top - block_bottom,
                                    font_size: current_font_size,
                                });
                            }
                            current_text.clear();
                            block_left = f64::MAX;
                            block_top = f64::MAX;
                            block_right = f64::MIN;
                            block_bottom = f64::MIN;
                            is_first_char = true;
                            continue;
                        }

                        if let Ok(rect) = char_ref.tight_bounds() {
                            let char_left = rect.left().value as f64;
                            let char_bottom = rect.bottom().value as f64;
                            let char_right = rect.right().value as f64;
                            let char_top = rect.top().value as f64;

                            if !is_first_char {
                                let y_diff = (char_bottom - last_char_y).abs();
                                let x_gap = char_left - last_char_right;
                                if y_diff > current_font_size * 0.5 || x_gap > current_font_size * 2.0 {
                                    if !current_text.is_empty() && block_left < f64::MAX {
                                        blocks.push(TextBlock {
                                            text: current_text.clone(),
                                            x: block_left,
                                            y: page_height - block_top,
                                            width: block_right - block_left,
                                            height: block_top - block_bottom,
                                            font_size: current_font_size,
                                        });
                                    }
                                    current_text.clear();
                                    block_left = f64::MAX;
                                    block_top = f64::MAX;
                                    block_right = f64::MIN;
                                    block_bottom = f64::MIN;
                                }
                            }

                            current_text.push(unicode);
                            block_left = block_left.min(char_left);
                            block_bottom = block_bottom.min(char_bottom);
                            block_right = block_right.max(char_right);
                            block_top = block_top.max(char_top);
                            last_char_right = char_right;
                            last_char_y = char_bottom;
                            current_font_size = (char_top - char_bottom).max(1.0);
                            is_first_char = false;
                        } else {
                            current_text.push(unicode);
                        }
                    }

                    if !current_text.is_empty() && block_left < f64::MAX {
                        blocks.push(TextBlock {
                            text: current_text,
                            x: block_left,
                            y: page_height - block_top,
                            width: block_right - block_left,
                            height: block_top - block_bottom,
                            font_size: current_font_size,
                        });
                    }
                    log(&format!("[WASM] Strategy 2 produced {} blocks", blocks.len()));
                }

                // Strategy 3: Segments fallback
                if blocks.is_empty() {
                    let segments = text_page.segments();
                    log(&format!("[WASM] Strategy 3 (segments): {} segments", segments.len()));
                    for seg in segments.iter() {
                        let seg_text = seg.text();
                        if seg_text.trim().is_empty() {
                            continue;
                        }
                        let bounds = seg.bounds();
                        let w = (bounds.right().value - bounds.left().value) as f64;
                        let h = (bounds.top().value - bounds.bottom().value) as f64;
                        if w > 0.0 && h > 0.0 {
                            blocks.push(TextBlock {
                                text: seg_text,
                                x: bounds.left().value as f64,
                                y: page_height - bounds.top().value as f64,
                                width: w,
                                height: h,
                                font_size: 12.0,
                            });
                        }
                    }
                    log(&format!("[WASM] Strategy 3 produced {} blocks", blocks.len()));
                }
            } else {
                log("[WASM] page.text() failed, no text API available");
            }
        }

        log(&format!("[WASM] Final: {} text blocks for page {}", blocks.len(), index));

        serde_json::to_string(&blocks)
            .map_err(|e| JsError::new(&format!("JSON serialization failed: {}", e)))
    }

    /// Get document outline as JSON tree.
    pub fn get_outline(&self) -> Result<String, JsError> {
        let bytes = self
            .pdf_bytes
            .as_ref()
            .ok_or_else(|| JsError::new("No PDF loaded"))?;

        let pdfium = get_pdfium();
        let document = pdfium
            .load_pdf_from_byte_slice(bytes, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to open PDF: {:?}", e)))?;

        // Use the flat iterator since we can't easily get a hierarchical tree
        // from the bookmark API in 0.9. Build a flat list of bookmarks.
        let mut items: Vec<OutlineItem> = Vec::new();
        for bookmark in document.bookmarks().iter() {
            let title = bookmark.title().unwrap_or_default();
            let page_index = bookmark
                .destination()
                .and_then(|dest| dest.page_index().ok())
                .map(|idx| idx as i32);

            items.push(OutlineItem {
                title,
                page_index,
                children: Vec::new(),
            });
        }

        serde_json::to_string(&items)
            .map_err(|e| JsError::new(&format!("JSON serialization failed: {}", e)))
    }

    /// Get page dimensions in PDF points.
    pub fn get_page_dimensions(&self, index: i32) -> Result<String, JsError> {
        let bytes = self
            .pdf_bytes
            .as_ref()
            .ok_or_else(|| JsError::new("No PDF loaded"))?;

        let pdfium = get_pdfium();
        let document = pdfium
            .load_pdf_from_byte_slice(bytes, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to open PDF: {:?}", e)))?;

        let page = document
            .pages()
            .get(index)
            .map_err(|e| JsError::new(&format!("Failed to get page {}: {:?}", index, e)))?;

        let dims = PageDimensions {
            width: page.width().value as f64,
            height: page.height().value as f64,
        };

        serde_json::to_string(&dims)
            .map_err(|e| JsError::new(&format!("JSON serialization failed: {}", e)))
    }

    /// Detect interactive form fields (widget annotations) on a page.
    /// Returns JSON array: [{x, y, width, height, field_type, field_name}]
    /// Coordinates are in PDF points with top-left origin (y is flipped from PDF space).
    pub fn get_form_fields(&self, index: i32) -> Result<String, JsError> {
        let bytes = self
            .pdf_bytes
            .as_ref()
            .ok_or_else(|| JsError::new("No PDF loaded"))?;

        let pdfium = get_pdfium();
        let document = pdfium
            .load_pdf_from_byte_slice(bytes, self.password.as_deref())
            .map_err(|e| JsError::new(&format!("Failed to open PDF: {:?}", e)))?;

        let page = document
            .pages()
            .get(index)
            .map_err(|e| JsError::new(&format!("Failed to get page {}: {:?}", index, e)))?;

        let page_height = page.height().value as f64;
        let mut fields: Vec<FormField> = Vec::new();

        for annotation in page.annotations().iter() {
            if annotation.annotation_type() == PdfPageAnnotationType::Widget {
                if let Ok(bounds) = annotation.bounds() {
                    let x = bounds.left().value as f64;
                    let top = bounds.top().value as f64;
                    let w = (bounds.right().value - bounds.left().value) as f64;
                    let h = (bounds.top().value - bounds.bottom().value) as f64;
                    if w > 0.0 && h > 0.0 {
                        fields.push(FormField {
                            x,
                            y: page_height - top,
                            width: w,
                            height: h,
                            field_type: "text".to_string(),
                            field_name: String::new(),
                        });
                    }
                }
            }
        }

        log(&format!("[WASM] get_form_fields: {} fields on page {}", fields.len(), index));

        serde_json::to_string(&fields)
            .map_err(|e| JsError::new(&format!("JSON serialization failed: {}", e)))
    }

    /// Get total page count.
    pub fn page_count(&self) -> u32 {
        self.page_count
    }

    /// Free the loaded document and release memory.
    pub fn close(&mut self) {
        self.pdf_bytes = None;
        self.page_count = 0;
    }
}

