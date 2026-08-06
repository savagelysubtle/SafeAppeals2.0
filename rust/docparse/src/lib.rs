// Copyright (c) Safe Appeals. All rights reserved.

//! DocParse HTTP sidecar library — digital PDF extraction and optional OCR bridge.

pub mod config;
pub mod model;
pub mod ocr;
pub mod pdf;
pub mod server;

pub use config::ServerConfig;
pub use model::{check_model_dir, ModelHealth};
pub use pdf::{extract_pages_from_file, pages_to_markdown, has_substantial_text, ParseResult};
