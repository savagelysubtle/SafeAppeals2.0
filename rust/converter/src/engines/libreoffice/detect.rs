// Copyright (c) Safe Appeals. All rights reserved.

//! Detect system LibreOffice / soffice binary.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Resolved LibreOffice installation.
#[derive(Debug, Clone)]
pub struct SofficeInstall {
	pub binary: PathBuf,
	pub source: String,
}

/// Search PATH and common install locations for `soffice`.
pub fn detect_soffice() -> Option<SofficeInstall> {
	if let Some(path) = find_in_path("soffice") {
		if verify_soffice(&path) {
			return Some(SofficeInstall {
				binary: path,
				source: "PATH".into(),
			});
		}
	}

	for candidate in common_install_paths() {
		if candidate.is_file() && verify_soffice(&candidate) {
			return Some(SofficeInstall {
				binary: candidate,
				source: "common_install_path".into(),
			});
		}
	}

	None
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
		paths.extend([
			"/usr/bin/soffice",
			"/usr/local/bin/soffice",
			"/snap/bin/libreoffice",
			"/usr/lib/libreoffice/program/soffice",
			"/usr/lib64/libreoffice/program/soffice",
		]
		.map(PathBuf::from));
	}
	#[cfg(target_os = "macos")]
	{
		paths.push(PathBuf::from(
			"/Applications/LibreOffice.app/Contents/MacOS/soffice",
		));
	}
	#[cfg(windows)]
	{
		for prefix in [
			r"C:\Program Files\LibreOffice\program\soffice.exe",
			r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
		] {
			paths.push(PathBuf::from(prefix));
		}
	}
	paths
}

fn verify_soffice(path: &Path) -> bool {
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
		match detect_soffice() {
			None => {}
			Some(install) => {
				assert!(install.binary.is_file());
				assert!(verify_soffice(&install.binary));
			}
		}
	}
}
