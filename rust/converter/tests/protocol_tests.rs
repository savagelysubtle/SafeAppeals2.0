// Copyright (c) Safe Appeals. All rights reserved.

//! Integration tests for the NDJSON protocol loop.

use sa_converter::protocol::{read_request, Response};
use sa_converter::registry::{all_keys, resolve_key};
use sa_converter::Server;
use std::io::{Cursor, Write};
use std::process::{Command, Stdio};
use tempfile::TempDir;

fn exchange(server: &mut Server, requests: &[&str]) -> Vec<String> {
	let mut responses = Vec::new();
	for line in requests {
		let mut input = Cursor::new(format!("{line}\n"));
		let req = read_request(&mut input).unwrap().unwrap();
		let mut output = Vec::new();
		server.handle_request(&req, &mut output).unwrap();
		responses.push(String::from_utf8(output).unwrap());
	}
	responses
}

#[test]
fn protocol_id_correlation_across_methods() {
	let mut server = Server::new();
	let responses = exchange(
		&mut server,
		&[
			r#"{"id":"a","method":"ping","params":{}}"#,
			r#"{"id":"b","method":"get_available_conversions","params":{}}"#,
			r#"{"id":"c","method":"shutdown","params":{}}"#,
		],
	);

	let ping: Response = serde_json::from_str(responses[0].trim()).unwrap();
	assert_eq!(ping.id, "a");

	let conv: Response = serde_json::from_str(responses[1].trim()).unwrap();
	assert_eq!(conv.id, "b");
	assert!(conv.result.get("conversions").is_some());

	let shutdown: Response = serde_json::from_str(responses[2].trim()).unwrap();
	assert_eq!(shutdown.id, "c");
	assert!(server.shutdown_requested());
}

#[test]
fn configure_then_convert_path_validation() {
	let tmp = TempDir::new().unwrap();
	let root = tmp.path().to_string_lossy().to_string();
	let good_input = tmp.path().join("file.md");
	std::fs::write(&good_input, b"text").unwrap();
	let good_output = tmp.path().join("out.html");

	let outside = TempDir::new().unwrap();
	let bad_input = outside.path().join("evil.md");
	std::fs::write(&bad_input, b"bad").unwrap();

	let mut server = Server::new();
	let responses = exchange(
		&mut server,
		&[
			&format!(r#"{{"id":"cfg","method":"configure","params":{{"roots":["{root}"]}}}}"#),
			&format!(
				r#"{{"id":"ok","method":"convert","params":{{"input":"{}","output":"{}","type":"md2html"}}}}"#,
				good_input.display(),
				good_output.display()
			),
			&format!(
				r#"{{"id":"bad","method":"convert","params":{{"input":"{}","output":"{}","type":"md2html"}}}}"#,
				bad_input.display(),
				good_output.display()
			),
		],
	);

	assert!(responses[0].contains(r#""roots""#));
	assert!(
		responses[1].contains(r#""success":true"#)
			|| responses[1].contains("NOT_IMPLEMENTED")
			|| responses[1].contains("ENGINE_UNAVAILABLE")
			|| responses[1].contains("CONVERSION_FAILED")
	);
	assert!(responses[2].contains("PATH_OUTSIDE_ROOTS"));
}

#[test]
fn registry_lists_all_canonical_keys() {
	let keys = all_keys();
	assert_eq!(keys.len(), 41);
	assert_eq!(resolve_key("pdf2ocr"), "pdf2ocr_layer");
	assert!(keys.contains(&"pdf2ocr_layer".to_string()));
}

#[test]
fn binary_ping_smoke() {
	let bin = env!("CARGO_BIN_EXE_sa-converter");
	let mut child = Command::new(bin)
		.stdin(Stdio::piped())
		.stdout(Stdio::piped())
		.stderr(Stdio::null())
		.spawn()
		.expect("spawn sa-converter");

	{
		let stdin = child.stdin.as_mut().unwrap();
		writeln!(stdin, r#"{{"id":"smoke","method":"ping","params":{{}}}}"#).unwrap();
		writeln!(stdin, r#"{{"id":"bye","method":"shutdown","params":{{}}}}"#).unwrap();
	}

	let output = child.wait_with_output().unwrap();
	assert!(output.status.success());
	let stdout = String::from_utf8(output.stdout).unwrap();
	assert!(stdout.contains(r#""ok":true"#));
	assert!(stdout.contains("0.1.0"));
}

#[test]
fn binary_skips_blank_lines_and_survives_malformed_json() {
	let bin = env!("CARGO_BIN_EXE_sa-converter");
	let mut child = Command::new(bin)
		.stdin(Stdio::piped())
		.stdout(Stdio::piped())
		.stderr(Stdio::piped())
		.spawn()
		.expect("spawn sa-converter");

	{
		let stdin = child.stdin.as_mut().unwrap();
		writeln!(stdin).unwrap();
		writeln!(stdin, "{{not valid json}}").unwrap();
		writeln!(
			stdin,
			r#"{{"id":"bad","method":123,"params":{{}}}}"#
		)
		.unwrap();
		writeln!(stdin, r#"{{"id":"ok","method":"ping","params":{{}}}}"#).unwrap();
		writeln!(stdin, r#"{{"id":"bye","method":"shutdown","params":{{}}}}"#).unwrap();
	}

	let output = child.wait_with_output().unwrap();
	assert!(output.status.success());
	let stdout = String::from_utf8(output.stdout).unwrap();
	assert!(stdout.contains(r#""id":"bad""#));
	assert!(stdout.contains("INVALID_REQUEST"));
	assert!(stdout.contains(r#""id":"ok""#));
	let stderr = String::from_utf8(output.stderr).unwrap();
	assert!(stderr.contains("invalid JSON request (no id)"));
}

#[test]
fn sandbox_rejects_prefix_bypass_via_server() {
	let root_dir = TempDir::new().unwrap();
	let root = root_dir.path().to_string_lossy().to_string();
	let sibling_name = format!(
		"{}-evil",
		root_dir
			.path()
			.file_name()
			.unwrap()
			.to_string_lossy()
	);
	let sibling = root_dir.path().parent().unwrap().join(sibling_name);
	std::fs::create_dir_all(&sibling).unwrap();
	let evil_file = sibling.join("secret.txt");
	std::fs::write(&evil_file, b"secret").unwrap();

	let mut server = Server::new();
	let responses = exchange(
		&mut server,
		&[
			&format!(r#"{{"id":"cfg","method":"configure","params":{{"roots":["{root}"]}}}}"#),
			&format!(
				r#"{{"id":"evil","method":"convert","params":{{"input":"{}","output":"{}/out.html","type":"md2html"}}}}"#,
				evil_file.display(),
				root_dir.path().display()
			),
		],
	);

	assert!(responses[0].contains(r#""roots""#));
	assert!(responses[1].contains("PATH_OUTSIDE_ROOTS"));
}
