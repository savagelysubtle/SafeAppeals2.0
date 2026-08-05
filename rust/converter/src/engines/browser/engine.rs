// Copyright (c) Safe Appeals. All rights reserved.

//! Browser engine state: detect on configure, spawn on convert.

use super::detect::{detect_chromium, BrowserInstall};
use std::path::PathBuf;
use std::time::Duration;

/// Holds detected Chrome/Chromium binary; spawns headless only on convert.
#[derive(Debug)]
pub struct BrowserEngine {
	install: Option<BrowserInstall>,
	configured_path: Option<PathBuf>,
	job_timeout: Option<Duration>,
}

impl Default for BrowserEngine {
	fn default() -> Self {
		Self::new()
	}
}

impl BrowserEngine {
	pub fn new() -> Self {
		Self {
			install: None,
			configured_path: None,
			job_timeout: None,
		}
	}

	pub fn with_configured_path(mut self, path: PathBuf) -> Self {
		self.configured_path = Some(path);
		self
	}

	pub fn install(&self) -> Option<&BrowserInstall> {
		self.install.as_ref()
	}

	pub fn is_available(&self) -> bool {
		self.install.is_some()
	}

	pub fn job_timeout(&self) -> Option<Duration> {
		self.job_timeout
	}

	/// Detect browser binary (`--version` only; no headless spawn).
	pub fn probe(&mut self, configured_path: Option<PathBuf>, timeout_ms: Option<u64>) -> bool {
		if let Some(ms) = timeout_ms {
			self.job_timeout = Some(Duration::from_millis(ms.max(1_000)));
		}
		let path = configured_path.or_else(|| self.configured_path.clone());
		match detect_chromium(path.as_deref()) {
			Some(install) => {
				self.install = Some(install);
				true
			}
			None => {
				self.install = None;
				false
			}
		}
	}
}
