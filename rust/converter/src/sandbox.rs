// Copyright (c) Safe Appeals. All rights reserved.

//! Path sandbox: allowlisted roots, canonicalization, symlink resolution.

use std::path::{Component, Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SandboxError {
	#[error("no roots configured; call configure first")]
	NoRootsConfigured,
	#[error("path escape detected: {0}")]
	PathEscape(String),
	#[error("path outside allowlisted roots: {0}")]
	OutsideRoots(String),
	#[error("invalid path: {0}")]
	InvalidPath(String),
}

/// Path sandbox enforcing allowlisted workspace roots.
#[derive(Debug, Default, Clone)]
pub struct Sandbox {
	roots: Vec<PathBuf>,
}

impl Sandbox {
	pub fn new() -> Self {
		Self { roots: Vec::new() }
	}

	/// Replace allowlisted roots with canonicalized absolute paths.
	pub fn configure(&mut self, roots: &[String]) -> Result<(), SandboxError> {
		let mut canonical_roots = Vec::with_capacity(roots.len());
		for root in roots {
			let path = PathBuf::from(root);
			let canonical = canonicalize_path(&path).map_err(|e| {
				SandboxError::InvalidPath(format!("{}: {e}", root))
			})?;
			canonical_roots.push(canonical);
		}
		self.roots = canonical_roots;
		Ok(())
	}

	pub fn roots(&self) -> &[PathBuf] {
		&self.roots
	}

	/// Validate that `path` resolves inside one of the configured roots.
	pub fn validate_path(&self, path: &str) -> Result<PathBuf, SandboxError> {
		if self.roots.is_empty() {
			return Err(SandboxError::NoRootsConfigured);
		}

		if path.starts_with("file://") {
			return Err(SandboxError::InvalidPath(format!(
				"file:// URLs are not allowed: {path}"
			)));
		}

		let input = PathBuf::from(path);

		// Reject obvious parent-segment escapes before canonicalization.
		for component in input.components() {
			if matches!(component, Component::ParentDir) {
				return Err(SandboxError::PathEscape(path.to_string()));
			}
		}

		let canonical = canonicalize_path(&input)
			.map_err(|e| SandboxError::InvalidPath(format!("{path}: {e}")))?;

		for root in &self.roots {
			if is_under_root(&canonical, root) {
				return Ok(canonical);
			}
		}

		Err(SandboxError::OutsideRoots(path.to_string()))
	}
}

/// Canonicalize a path, resolving symlinks when the target exists.
fn canonicalize_path(path: &Path) -> Result<PathBuf, String> {
	if path.exists() {
		path.canonicalize()
			.map_err(|e| format!("canonicalize failed: {e}"))
	} else {
		// For non-existent paths (e.g. output files), canonicalize the parent
		// and rejoin the file name so we still resolve symlinks in the directory chain.
		let parent = path
			.parent()
			.filter(|p| !p.as_os_str().is_empty())
			.unwrap_or_else(|| Path::new("."));

		let file_name = path.file_name();

		let canonical_parent = if parent.exists() {
			parent
				.canonicalize()
				.map_err(|e| format!("canonicalize parent failed: {e}"))?
		} else {
			// Walk up to find the nearest existing ancestor.
			let mut current = parent.to_path_buf();
			loop {
				if current.exists() {
					break current
						.canonicalize()
						.map_err(|e| format!("canonicalize ancestor failed: {e}"))?;
				}
				if !current.pop() {
					return Err("no existing ancestor for path".to_string());
				}
			}
		};

		// Re-apply remaining non-existent suffix components (reject ParentDir).
		let suffix = path.strip_prefix(parent).unwrap_or(path);
		let mut result = canonical_parent;
		for component in suffix.components() {
			match component {
				Component::ParentDir => {
					return Err("path escape via parent dir".to_string());
				}
				Component::CurDir => {}
				Component::Normal(name) => result.push(name),
				Component::RootDir | Component::Prefix(_) => {}
			}
		}

		if let Some(name) = file_name {
			// If suffix was empty (path is just a filename), ensure name is present.
			if result.file_name() != Some(name) {
				result.push(name);
			}
		}

		Ok(result)
	}
}

fn is_under_root(path: &Path, root: &Path) -> bool {
	if path == root {
		return true;
	}
	let mut root_with_sep = root.as_os_str().to_os_string();
	root_with_sep.push(std::path::MAIN_SEPARATOR_STR);
	path.starts_with(Path::new(&root_with_sep))
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::fs;
	use tempfile::TempDir;

	fn configure_sandbox(dir: &Path) -> Sandbox {
		let mut sandbox = Sandbox::new();
		sandbox
			.configure(&[dir.to_string_lossy().to_string()])
			.expect("configure sandbox");
		sandbox
	}

	#[test]
	fn accepts_path_inside_root() {
		let tmp = TempDir::new().unwrap();
		let file = tmp.path().join("doc.docx");
		fs::write(&file, b"test").unwrap();

		let sandbox = configure_sandbox(tmp.path());
		let result = sandbox.validate_path(file.to_str().unwrap());
		assert!(result.is_ok());
	}

	#[test]
	fn accepts_nonexistent_output_under_root() {
		let tmp = TempDir::new().unwrap();
		let output = tmp.path().join("out.pdf");

		let sandbox = configure_sandbox(tmp.path());
		let result = sandbox.validate_path(output.to_str().unwrap());
		assert!(result.is_ok());
	}

	#[test]
	fn rejects_path_outside_root() {
		let tmp = TempDir::new().unwrap();
		let other = TempDir::new().unwrap();
		let outside = other.path().join("secret.pdf");
		fs::write(&outside, b"x").unwrap();

		let sandbox = configure_sandbox(tmp.path());
		let err = sandbox
			.validate_path(outside.to_str().unwrap())
			.unwrap_err();
		assert!(matches!(err, SandboxError::OutsideRoots(_)));
	}

	#[test]
	fn rejects_parent_dir_escape() {
		let tmp = TempDir::new().unwrap();
		let sandbox = configure_sandbox(tmp.path());
		let escape = tmp.path().join("..").join("etc").join("passwd");
		let err = sandbox
			.validate_path(escape.to_str().unwrap())
			.unwrap_err();
		assert!(matches!(err, SandboxError::PathEscape(_)));
	}

	#[test]
	fn rejects_symlink_escape() {
		let tmp = TempDir::new().unwrap();
		let outside = TempDir::new().unwrap();
		let secret = outside.path().join("secret.txt");
		fs::write(&secret, b"secret").unwrap();

		let link = tmp.path().join("link.txt");
		std::os::unix::fs::symlink(&secret, &link).unwrap();

		let sandbox = configure_sandbox(tmp.path());
		let err = sandbox.validate_path(link.to_str().unwrap()).unwrap_err();
		assert!(matches!(err, SandboxError::OutsideRoots(_)));
	}

	#[test]
	fn rejects_when_no_roots_configured() {
		let sandbox = Sandbox::new();
		let err = sandbox.validate_path("/tmp/file").unwrap_err();
		assert!(matches!(err, SandboxError::NoRootsConfigured));
	}

	#[test]
	fn rejects_prefix_bypass_sibling_path() {
		let root_dir = TempDir::new().unwrap();
		let root = root_dir.path().to_path_buf();
		let sibling_name = format!("{}-evil", root.file_name().unwrap().to_string_lossy());
		let sibling = root.parent().unwrap().join(sibling_name);
		fs::create_dir_all(&sibling).unwrap();
		let evil_file = sibling.join("secret.txt");
		fs::write(&evil_file, b"secret").unwrap();

		let sandbox = configure_sandbox(root_dir.path());
		let err = sandbox
			.validate_path(evil_file.to_str().unwrap())
			.unwrap_err();
		assert!(matches!(err, SandboxError::OutsideRoots(_)));
	}

	#[test]
	fn rejects_file_url_scheme() {
		let tmp = TempDir::new().unwrap();
		let file = tmp.path().join("doc.docx");
		fs::write(&file, b"test").unwrap();

		let sandbox = configure_sandbox(tmp.path());
		let file_url = format!("file://{}", file.display());
		let err = sandbox.validate_path(&file_url).unwrap_err();
		assert!(matches!(err, SandboxError::InvalidPath(_)));
	}
}
