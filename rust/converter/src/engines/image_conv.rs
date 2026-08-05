// Copyright (c) Safe Appeals. All rights reserved.

use crate::engines::error::{EngineError, EngineResult};
use ::image::codecs::jpeg::JpegEncoder;
use ::image::codecs::png::PngEncoder;
use ::image::io::Reader as ImageReader;
use ::image::{ColorType, DynamicImage, GenericImageView, ImageEncoder, ImageFormat};
use printpdf::{Image, ImageTransform, Mm, PdfDocument};
use serde_json::Value;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

pub fn image2pdf(input: &Path, output: &Path) -> EngineResult<()> {
	let img = ImageReader::open(input)
		.map_err(|e| EngineError::conversion(format!("image open: {e}")))?
		.decode()?;
	let (width, height) = img.dimensions();
	let width_mm = Mm(width as f32 / 72.0 * 25.4);
	let height_mm = Mm(height as f32 / 72.0 * 25.4);
	let (doc, page1, layer1) = PdfDocument::new("Image", width_mm, height_mm, "Layer 1");
	let layer = doc.get_page(page1).get_layer(layer1);
	let pdf_image = Image::from_dynamic_image(&img);
	let transform = ImageTransform {
		translate_x: Some(Mm(0.0)),
		translate_y: Some(Mm(0.0)),
		rotate: None,
		scale_x: None,
		scale_y: None,
		dpi: Some(72.0),
	};
	pdf_image.add_to_layer(layer, transform);
	doc.save(&mut BufWriter::new(File::create(output)?))?;
	Ok(())
}

pub fn image2image(input: &Path, output: &Path, options: &Value) -> EngineResult<()> {
	let img = ImageReader::open(input)
		.map_err(|e| EngineError::conversion(format!("image open: {e}")))?
		.decode()?;
	let format = output
		.extension()
		.and_then(|e| e.to_str())
		.map(|ext| match ext.to_lowercase().as_str() {
			"jpg" | "jpeg" => ImageFormat::Jpeg,
			"png" => ImageFormat::Png,
			"gif" => ImageFormat::Gif,
			"webp" => ImageFormat::WebP,
			"bmp" => ImageFormat::Bmp,
			other => ImageFormat::from_extension(other).unwrap_or(ImageFormat::Png),
		})
		.unwrap_or(ImageFormat::Png);

	let quality = options
		.get("quality")
		.and_then(|v| v.as_u64())
		.unwrap_or(85) as u8;

	let rgb = img.to_rgb8();
	let (w, h) = rgb.dimensions();
	let mut file = BufWriter::new(File::create(output)?);
	match format {
		ImageFormat::Jpeg => {
			let encoder = JpegEncoder::new_with_quality(&mut file, quality);
			encoder.write_image(rgb.as_raw(), w, h, ColorType::Rgb8)?;
		}
		ImageFormat::Png => {
			let encoder = PngEncoder::new(&mut file);
			encoder.write_image(rgb.as_raw(), w, h, ColorType::Rgb8)?;
		}
		_ => {
			DynamicImage::ImageRgb8(rgb).save(output)?;
		}
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;
	use ::image::{ImageBuffer, Rgb};

	#[test]
	fn image2pdf_and_image2image() {
		let tmp = tempfile::tempdir().unwrap();
		let png = tmp.path().join("in.png");
		let pdf = tmp.path().join("out.pdf");
		let jpg = tmp.path().join("out.jpg");
		let img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(10, 10, |x, y| {
			Rgb([(x * 25) as u8, (y * 25) as u8, 128])
		});
		img.save(&png).unwrap();
		image2pdf(&png, &pdf).unwrap();
		assert!(pdf.exists());
		image2image(&png, &jpg, &Value::Null).unwrap();
		assert!(jpg.exists());
	}
}
