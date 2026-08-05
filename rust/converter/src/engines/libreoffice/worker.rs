// Copyright (c) Safe Appeals. All rights reserved.

//! Warm LibreOffice headless worker with dedicated profile and watchdog.

use super::detect::{detect_soffice, SofficeInstall};
use crate::engines::error::{EngineError, EngineResult};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const DEFAULT_JOB_TIMEOUT_MS: u64 = 120_000;
const DEFAULT_MAX_RESTARTS: u32 = 3;
const DEFAULT_ACCEPT_PORT: u16 = 2002;

/// Manages a long-lived LibreOffice listener process.
#[derive(Debug)]
pub struct LibreOfficeWorker {
	install: Option<SofficeInstall>,
	profile_dir: PathBuf,
	listener: Mutex<Option<Child>>,
	job_mutex: Mutex<()>,
	healthy: AtomicBool,
	restart_count: Mutex<u32>,
	max_restarts: u32,
	job_timeout: Duration,
	accept_port: u16,
}

impl Default for LibreOfficeWorker {
	fn default() -> Self {
		Self::new()
	}
}

impl LibreOfficeWorker {
	pub fn new() -> Self {
		let profile_dir = std::env::temp_dir().join("safeappeals-lo-profile");
		Self {
			install: None,
			profile_dir,
			listener: Mutex::new(None),
			job_mutex: Mutex::new(()),
			healthy: AtomicBool::new(false),
			restart_count: Mutex::new(0),
			max_restarts: DEFAULT_MAX_RESTARTS,
			job_timeout: Duration::from_millis(DEFAULT_JOB_TIMEOUT_MS),
			accept_port: DEFAULT_ACCEPT_PORT,
		}
	}

	pub fn with_profile_dir(mut self, dir: PathBuf) -> Self {
		self.profile_dir = dir;
		self
	}

	pub fn with_job_timeout(mut self, timeout_ms: u64) -> Self {
		self.job_timeout = Duration::from_millis(timeout_ms.max(1_000));
		self
	}

	pub fn profile_dir(&self) -> &Path {
		&self.profile_dir
	}

	pub fn install(&self) -> Option<&SofficeInstall> {
		self.install.as_ref()
	}

	pub fn is_available(&self) -> bool {
		super::feature_enabled()
			&& self.install.is_some()
			&& self.healthy.load(Ordering::SeqCst)
	}

	pub fn is_healthy(&self) -> bool {
		self.is_available() && self.listener_alive()
	}

	/// Detect soffice on the system without starting the warm listener.
	pub fn probe(&mut self, timeout_ms: Option<u64>) -> bool {
		if !super::feature_enabled() {
			self.mark_unhealthy();
			return false;
		}
		if let Some(ms) = timeout_ms {
			self.job_timeout = Duration::from_millis(ms.max(1_000));
		}
		if let Ok(mut count) = self.restart_count.lock() {
			*count = 0;
		}
		match detect_soffice() {
			Some(install) => {
				self.install = Some(install);
				self.healthy.store(true, Ordering::SeqCst);
				true
			}
			None => {
				self.install = None;
				self.mark_unhealthy();
				false
			}
		}
	}

	/// Probe for soffice and start the warm listener if found.
	pub fn probe_and_start(&mut self, timeout_ms: Option<u64>) -> bool {
		if !self.probe(timeout_ms) {
			return false;
		}
		match self.ensure_listener() {
			Ok(()) => self.is_healthy(),
			Err(_) => {
				self.mark_unhealthy();
				false
			}
		}
	}

	/// Acquire job lock, ensure health, run conversion closure under timeout.
	pub fn with_job<F, T>(&self, f: F) -> EngineResult<T>
	where
		F: FnOnce() -> EngineResult<T>,
	{
		let _guard = self
			.job_mutex
			.lock()
			.map_err(|_| EngineError::Internal("LO job mutex poisoned".into()))?;

		if self.install.is_none() {
			return Err(EngineError::Conversion(
				"LibreOffice is not installed".into(),
			));
		}
		if !self.healthy.load(Ordering::SeqCst) {
			return Err(EngineError::Conversion(
				"LibreOffice worker is unavailable".into(),
			));
		}
		self.ensure_listener()?;

		f()
	}

	pub fn run_convert_command(
		&self,
		args: &[String],
	) -> EngineResult<std::process::Output> {
		let install = self
			.install
			.as_ref()
			.ok_or_else(|| EngineError::Conversion("LibreOffice not installed".into()))?;

		let mut cmd = Command::new(&install.binary);
		cmd.args(args);
		cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

		let start = Instant::now();
		let mut child = cmd
			.spawn()
			.map_err(|e| EngineError::conversion(format!("soffice spawn: {e}")))?;

		loop {
			if let Some(status) = child
				.try_wait()
				.map_err(|e| EngineError::conversion(format!("soffice wait: {e}")))?
			{
				let output = child
					.wait_with_output()
					.map_err(|e| EngineError::conversion(format!("soffice output: {e}")))?;
				if !status.success() {
					let stderr = String::from_utf8_lossy(&output.stderr);
					return Err(EngineError::conversion(format!(
						"soffice exited with {status}: {stderr}"
					)));
				}
				return Ok(output);
			}
			if start.elapsed() > self.job_timeout {
				let _ = child.kill();
				let _ = child.wait();
				self.handle_job_failure();
				return Err(EngineError::conversion(format!(
					"soffice job timed out after {}ms",
					self.job_timeout.as_millis()
				)));
			}
			std::thread::sleep(Duration::from_millis(100));
		}
	}

	pub fn build_convert_args(
		&self,
		convert_filter: &str,
		input: &Path,
		out_dir: &Path,
	) -> Vec<String> {
		let mut args = self.base_soffice_args();
		args.push("--convert-to".into());
		args.push(convert_filter.into());
		args.push("--outdir".into());
		args.push(out_dir.to_string_lossy().into_owned());
		args.push(input.to_string_lossy().into_owned());
		args
	}

	fn base_soffice_args(&self) -> Vec<String> {
		vec![
			"--headless".into(),
			"--invisible".into(),
			"--nologo".into(),
			"--nodefault".into(),
			"--norestore".into(),
			"--nolockcheck".into(),
			"--nofirststartwizard".into(),
			format!("-env:UserInstallation={}", profile_url(&self.profile_dir)),
			"-env:org.openoffice.Office.Common/Macro/SecurityLevel=4".into(),
		]
	}

	fn listener_args(&self) -> Vec<String> {
		let mut args = self.base_soffice_args();
		args.push(format!(
			"--accept=socket,host=127.0.0.1,port={};urp;StarOffice.ServiceManager",
			self.accept_port
		));
		args
	}

	fn ensure_listener(&self) -> EngineResult<()> {
		if self.listener_alive() {
			self.healthy.store(true, Ordering::SeqCst);
			return Ok(());
		}

		let restarts = *self
			.restart_count
			.lock()
			.map_err(|_| EngineError::Internal("LO restart mutex poisoned".into()))?;
		if restarts >= self.max_restarts {
			self.mark_unhealthy();
			return Err(EngineError::Conversion(format!(
				"LibreOffice worker exceeded restart budget ({})",
				self.max_restarts
			)));
		}

		let install = self
			.install
			.as_ref()
			.ok_or_else(|| EngineError::Conversion("LibreOffice not installed".into()))?;

		std::fs::create_dir_all(&self.profile_dir).map_err(EngineError::Io)?;
		self.write_macro_hardening()?;

		let child = Command::new(&install.binary)
			.args(self.listener_args())
			.stdout(Stdio::null())
			.stderr(Stdio::null())
			.spawn()
			.map_err(|e| EngineError::conversion(format!("LO listener spawn: {e}")))?;

		{
			let mut listener = self
				.listener
				.lock()
				.map_err(|_| EngineError::Internal("LO listener mutex poisoned".into()))?;
			*listener = Some(child);
		}

		std::thread::sleep(Duration::from_secs(2));

		if self.listener_alive() {
			self.healthy.store(true, Ordering::SeqCst);
			Ok(())
		} else {
			self.handle_listener_death();
			Err(EngineError::conversion("LibreOffice listener failed to start"))
		}
	}

	fn write_macro_hardening(&self) -> EngineResult<()> {
		// Belt-and-suspenders: registrymodifications alongside SecurityLevel=4 env.
		let user_dir = self.profile_dir.join("user");
		std::fs::create_dir_all(&user_dir).map_err(EngineError::Io)?;
		let xcu = user_dir.join("registrymodifications.xcu");
		if xcu.exists() {
			return Ok(());
		}
		let contents = r#"<?xml version="1.0" encoding="UTF-8"?>
<oor:component-data xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" oor:name="Common" oor:package="org.openoffice.Office">
  <node oor:name="Macro">
    <prop oor:name="SecurityLevel" oor:op="fuse">
      <value xs:type="xs:short">4</value>
    </prop>
  </node>
</oor:component-data>
"#;
		std::fs::write(xcu, contents).map_err(EngineError::Io)?;
		Ok(())
	}

	fn listener_alive(&self) -> bool {
		let mut listener = match self.listener.lock() {
			Ok(g) => g,
			Err(_) => return false,
		};
		match listener.as_mut() {
			Some(child) => match child.try_wait() {
				Ok(None) => true,
				Ok(Some(_)) | Err(_) => false,
			},
			None => false,
		}
	}

	fn handle_job_failure(&self) {
		if !self.listener_alive() {
			self.mark_unhealthy();
		}
	}

	fn handle_listener_death(&self) {
		if let Ok(mut listener) = self.listener.lock() {
			let _ = listener.take();
		}
		if let Ok(mut count) = self.restart_count.lock() {
			*count += 1;
		}
		self.mark_unhealthy();
	}

	fn mark_unhealthy(&self) {
		self.healthy.store(false, Ordering::SeqCst);
	}

	pub fn shutdown(&mut self) {
		self.mark_unhealthy();
		if let Ok(mut listener) = self.listener.lock() {
			if let Some(mut child) = listener.take() {
				let _ = child.kill();
				let _ = child.wait();
			}
		}
	}
}

fn profile_url(path: &Path) -> String {
	let abs = path
		.canonicalize()
		.unwrap_or_else(|_| path.to_path_buf());
	format!("file://{}", abs.to_string_lossy().replace('\\', "/"))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn worker_unavailable_without_soffice() {
		let worker = LibreOfficeWorker::new()
			.with_profile_dir(std::env::temp_dir().join("sa-lo-test-unavail"));
		assert!(!worker.is_available());
	}

	#[test]
	fn macro_hardening_writes_registry() {
		let dir = tempfile::tempdir().unwrap();
		let worker = LibreOfficeWorker::new().with_profile_dir(dir.path().to_path_buf());
		worker.write_macro_hardening().unwrap();
		assert!(worker.profile_dir().join("user/registrymodifications.xcu").exists());
	}
}
