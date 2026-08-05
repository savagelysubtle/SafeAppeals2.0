// Copyright (c) Safe Appeals. All rights reserved.

//! Detect system Chrome / Chromium for browser-print.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Resolved browser installation for headless print-to-PDF.
#[derive(Debug, Clone)]
pub struct BrowserInstall {
	pub binary: PathBuf,
	pub source: String,
}

/// Search env override, PATH, and common install locations.
pub fn detect_chromium(configured_path: Option<&Path>) -> Option<BrowserInstall> {
	if let Some(path) = configured_path {
		if path.is_file() && verify_browser(path) {
			return Some(BrowserInstall {
				binary: path.to_path_buf(),
				source: "configure".into(),
			});
		}
	}

	if let Ok(env_path) = std::env::var("SAFEAPPEALS_CHROME_PATH") {
		let path = PathBuf::from(env_path);
		if path.is_file() && verify_browser(&path) {
			return Some(BrowserInstall {
				binary: path,
				source: "SAFEAPPEALS_CHROME_PATH".into(),
			});
		}
	}

	for name in browser_path_names() {
		if let Some(path) = find_in_path(name) {
			if verify_browser(&path) {
				return Some(BrowserInstall {
					binary: path,
					source: "PATH".into(),
				});
			}
		}
	}

	for candidate in common_install_paths() {
		if candidate.is_file() && verify_browser(&candidate) {
			return Some(BrowserInstall {
				binary: candidate,
				source: "common_install_path".into(),
			});
		}
	}

	None
}

fn browser_path_names() -> &'static [&'static str] {
	&[
		"google-chrome-stable",
		"google-chrome",
		"chromium-browser",
		"chromium",
	]
}

fn find_in_path(name: &str) -> Option<PathBuf> {
	let path_var = std::env::var_os("PATH")?;
	for dir in std::env::split_paths(&path_var) {
		let candidate = dir.join(name);
		if candidate.is_file() {
			return Some(candidate);
		}
		#[cfg(windows)]
		{
			let candidate = dir.join(format!("{name}.exe"));
			if candidate.is_file() {
				return Some(candidate);
			}
		}
	}
	None
}

fn common_install_paths() -> Vec<PathBuf> {
	let mut paths = Vec::new();
	#[cfg(target_os = "linux")]
	{
		paths.extend(
			[
				"/usr/bin/google-chrome-stable",
				"/usr/bin/google-chrome",
				"/usr/bin/chromium-browser",
				"/usr/bin/chromium",
				"/snap/bin/chromium",
			]
			.map(PathBuf::from),
		);
	}
	#[cfg(target_os = "macos")]
	{
		paths.extend(
			[
				"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
				"/Applications/Chromium.app/Contents/MacOS/Chromium",
			]
			.map(PathBuf::from),
		);
	}
	#[cfg(windows)]
	{
		for prefix in [
			r"C:\Program Files\Google\Chrome\Application\chrome.exe",
			r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
			r"C:\Program Files\Chromium\Application\chrome.exe",
		] {
			paths.push(PathBuf::from(prefix));
		}
	}
	paths
}

fn verify_browser(path: &Path) -> bool {
	Command::new(path)
		.arg("--version")
		.output()
		.map(|o| o.status.success())
		.unwrap_or(false)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn detect_returns_none_or_valid_binary() {
		match detect_chromium(None) {
			None => {}
			Some(install) => {
				assert!(install.binary.is_file());
				assert!(verify_browser(&install.binary));
			}
		}
	}
}
