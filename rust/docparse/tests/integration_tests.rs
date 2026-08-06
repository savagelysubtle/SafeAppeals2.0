// Copyright (c) Safe Appeals. All rights reserved.

//! HTTP integration tests for sa-docparse (in-process router, no subprocess bind).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use base64::Engine;
use docparse::config::ServerConfig;
use docparse::pdf::write_fixture_pdf;
use docparse::server::{app_state_from_config, build_router};
use http_body_util::BodyExt;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;
use tower::ServiceExt;

fn router_with_model(model_dir: PathBuf) -> axum::Router {
	let config = ServerConfig::from_parts("127.0.0.1", 8742, Some(model_dir), None, None).unwrap();
	build_router(app_state_from_config(config))
}

async fn json_body(response: axum::response::Response) -> serde_json::Value {
	let bytes = response.into_body().collect().await.unwrap().to_bytes();
	serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn health_ok_when_model_pack_present() {
	let model_tmp = tempdir().unwrap();
	fs::write(model_tmp.path().join("config.json"), b"{}").unwrap();
	fs::write(model_tmp.path().join("model.safetensors"), b"x").unwrap();

	let app = router_with_model(model_tmp.path().to_path_buf());
	let response = app
		.oneshot(
			Request::builder()
				.uri("/health")
				.body(Body::empty())
				.unwrap(),
		)
		.await
		.unwrap();
	assert_eq!(response.status(), StatusCode::OK);
	let body = json_body(response).await;
	assert_eq!(body["ok"], true);
	assert_eq!(body["model"], "unlimited-ocr");
}

#[tokio::test]
async fn health_503_when_model_dir_invalid() {
	let model_tmp = tempdir().unwrap();
	fs::write(model_tmp.path().join("config.json"), b"{}").unwrap();

	let app = router_with_model(model_tmp.path().to_path_buf());
	let response = app
		.oneshot(
			Request::builder()
				.uri("/health")
				.body(Body::empty())
				.unwrap(),
		)
		.await
		.unwrap();
	assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
	let body = json_body(response).await;
	assert_eq!(body["ok"], false);
	assert!(body["detail"].as_str().unwrap().contains("safetensors"));
}

#[tokio::test]
async fn parse_digital_pdf_via_http() {
	let model_tmp = tempdir().unwrap();
	fs::write(model_tmp.path().join("config.json"), b"{}").unwrap();
	fs::write(model_tmp.path().join("model.safetensors"), b"x").unwrap();

	let pdf_tmp = tempdir().unwrap();
	let pdf_path = pdf_tmp.path().join("brief.pdf");
	write_fixture_pdf(
		&pdf_path,
		"Appeal brief with enough born-digital text for DocParse extraction.",
	)
	.unwrap();
	let pdf_b64 = base64::engine::general_purpose::STANDARD.encode(fs::read(&pdf_path).unwrap());

	let app = router_with_model(model_tmp.path().to_path_buf());
	let response = app
		.oneshot(
			Request::builder()
				.method("POST")
				.uri("/parse")
				.header("content-type", "application/json")
				.body(Body::from(
					serde_json::json!({
						"sourceUri": "file:///brief.pdf",
						"pdfBase64": pdf_b64,
					})
					.to_string(),
				))
				.unwrap(),
		)
		.await
		.unwrap();
	assert_eq!(response.status(), StatusCode::OK);
	let body = json_body(response).await;
	assert!(body["markdown"].as_str().unwrap().len() > 0);
	assert!(body["pageCount"].as_u64().unwrap() >= 1);
}
