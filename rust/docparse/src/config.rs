// Copyright (c) Safe Appeals. All rights reserved.

use clap::Parser;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::PathBuf;
use thiserror::Error;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 8742;

#[derive(Debug, Error)]
pub enum ConfigError {
	#[error("host must be loopback (127.0.0.1, localhost, or ::1); got {0}")]
	NonLoopbackHost(String),
	#[error("invalid port {0}")]
	InvalidPort(String),
}

/// Resolved sidecar configuration from CLI flags and environment.
#[derive(Debug, Clone)]
pub struct ServerConfig {
	pub bind_host: IpAddr,
	pub port: u16,
	pub model_dir: Option<PathBuf>,
	pub infer_script: Option<PathBuf>,
	pub python: Option<String>,
}

#[derive(Debug, Parser)]
#[command(name = "sa-docparse", about = "SafeAppeals DocParse HTTP sidecar for Unlimited-OCR")]
struct Cli {
	/// Loopback bind address (127.0.0.1 by default).
	#[arg(long, env = "SA_DOCPARSE_HOST", default_value = DEFAULT_HOST)]
	host: String,

	/// TCP port to listen on.
	#[arg(long, env = "SA_DOCPARSE_PORT", default_value_t = DEFAULT_PORT)]
	port: u16,

	/// Path to consent-installed Unlimited-OCR model pack.
	#[arg(long, env = "SA_DOCPARSE_MODEL_DIR")]
	model_dir: Option<PathBuf>,

	/// Override path to infer_unlimited_ocr.py.
	#[arg(long, env = "SA_DOCPARSE_INFER_SCRIPT")]
	infer_script: Option<PathBuf>,

	/// Python interpreter for OCR helper (defaults to python3 on PATH).
	#[arg(long, env = "SA_DOCPARSE_PYTHON")]
	python: Option<String>,
}

impl ServerConfig {
	pub fn from_env_args() -> Result<Self, ConfigError> {
		let cli = Cli::parse();
		Self::from_parts(
			&cli.host,
			cli.port,
			cli.model_dir,
			cli.infer_script,
			cli.python,
		)
	}

	pub fn from_parts(
		host: &str,
		port: u16,
		model_dir: Option<PathBuf>,
		infer_script: Option<PathBuf>,
		python: Option<String>,
	) -> Result<Self, ConfigError> {
		let bind_host = parse_loopback_host(host)?;
		if port == 0 {
			return Err(ConfigError::InvalidPort(host.to_string()));
		}
		Ok(Self {
			bind_host,
			port,
			model_dir,
			infer_script,
			python,
		})
	}

	pub fn bind_addr(&self) -> String {
		format!("{}:{}", self.bind_host, self.port)
	}
}

/// Accept only loopback hosts — fail closed for remote bind attempts.
pub fn parse_loopback_host(host: &str) -> Result<IpAddr, ConfigError> {
	let trimmed = host.trim();
	match trimmed.to_ascii_lowercase().as_str() {
		"127.0.0.1" => Ok(IpAddr::V4(Ipv4Addr::LOCALHOST)),
		"localhost" => Ok(IpAddr::V4(Ipv4Addr::LOCALHOST)),
		"::1" => Ok(IpAddr::V6(Ipv6Addr::LOCALHOST)),
		other => {
			if let Ok(ip) = other.parse::<IpAddr>() {
				if is_loopback_ip(ip) {
					return Ok(ip);
				}
			}
			Err(ConfigError::NonLoopbackHost(trimmed.to_string()))
		}
	}
}

fn is_loopback_ip(ip: IpAddr) -> bool {
	match ip {
		IpAddr::V4(v4) => v4.is_loopback(),
		IpAddr::V6(v6) => v6.is_loopback(),
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn accepts_loopback_hosts() {
		assert!(parse_loopback_host("127.0.0.1").is_ok());
		assert!(parse_loopback_host("localhost").is_ok());
		assert!(parse_loopback_host("::1").is_ok());
	}

	#[test]
	fn rejects_remote_host() {
		assert!(parse_loopback_host("0.0.0.0").is_err());
		assert!(parse_loopback_host("192.168.1.1").is_err());
	}
}
