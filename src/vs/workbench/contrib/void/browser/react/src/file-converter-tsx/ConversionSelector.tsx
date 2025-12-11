/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo } from "react";

interface ConversionInfo {
	source_formats: string[];
	target_formats: string[];
	description: string;
}

interface ConversionSelectorProps {
	selectedFile: string;
	outputPath: string;
	conversionType: string;
	availableConversions: Record<string, ConversionInfo>;
	onFileSelect: () => void;
	onOutputSelect: () => void;
	onTypeChange: (type: string) => void;
	onStartConversion: () => void;
	isDragging: boolean;
}

const SUPPORTED_CONVERSIONS: Record<string, ConversionInfo> = {
	"md2pdf": { source_formats: ["md", "markdown"], target_formats: ["pdf"], description: "Markdown → PDF" },
	"md2html": { source_formats: ["md", "markdown"], target_formats: ["html"], description: "Markdown → HTML" },
	"md2docx": { source_formats: ["md", "markdown"], target_formats: ["docx"], description: "Markdown → DOCX" },
	"pdf2md": { source_formats: ["pdf"], target_formats: ["md", "markdown"], description: "PDF → Markdown" },
	"pdf2html": { source_formats: ["pdf"], target_formats: ["html"], description: "PDF → HTML" },
	"pdf2images": { source_formats: ["pdf"], target_formats: ["png", "jpg"], description: "PDF → Images" },
	"pdf2ocr": { source_formats: ["pdf"], target_formats: ["pdf"], description: "PDF OCR Layer" },
	"docx2pdf": { source_formats: ["docx"], target_formats: ["pdf"], description: "DOCX → PDF" },
	"docx2md": { source_formats: ["docx"], target_formats: ["md", "markdown"], description: "DOCX → Markdown" },
	"html2pdf": { source_formats: ["html", "htm"], target_formats: ["pdf"], description: "HTML → PDF" },
	"image2pdf": { source_formats: ["png", "jpg", "jpeg", "gif", "bmp", "tiff"], target_formats: ["pdf"], description: "Image → PDF" },
	"image2text": { source_formats: ["png", "jpg", "jpeg", "gif", "bmp", "tiff"], target_formats: ["txt"], description: "Image → Text (OCR)" },
};

export const ConversionSelector: React.FC<ConversionSelectorProps> = ({
	selectedFile, outputPath, conversionType, availableConversions,
	onFileSelect, onOutputSelect, onTypeChange, onStartConversion, isDragging
}) => {
	const conversions = useMemo(() => ({ ...SUPPORTED_CONVERSIONS, ...availableConversions }), [availableConversions]);

	const detectedExtension = useMemo(() => {
		if (!selectedFile) return "";
		const parts = selectedFile.split(".");
		return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
	}, [selectedFile]);

	const applicableConversions = useMemo(() => {
		if (!detectedExtension) return Object.entries(conversions);
		return Object.entries(conversions).filter(([_, info]) =>
			info.source_formats.some(fmt => fmt.toLowerCase() === detectedExtension || (detectedExtension === "jpeg" && fmt === "jpg"))
		);
	}, [conversions, detectedExtension]);

	React.useEffect(() => {
		if (applicableConversions.length === 1 && !conversionType) {
			onTypeChange(applicableConversions[0][0]);
		}
	}, [applicableConversions, conversionType, onTypeChange]);

	const canConvert = selectedFile && outputPath && conversionType;

	return (
		<div className="p-6 space-y-8 max-w-3xl mx-auto w-full">
			{/* Step 1: File Selection */}
			<div className="space-y-2">
				<label className="flex items-center gap-2 text-sm font-semibold text-void-fg-1">
					<div className="w-6 h-6 rounded-full bg-void-button-primary text-void-button-primary-text flex items-center justify-center text-xs">1</div>
					Select File
				</label>
				<div
					onClick={onFileSelect}
					className={`group relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer ${
						selectedFile
							? 'border-void-button-primary bg-void-button-primary/5'
							: 'border-void-border-3 hover:border-void-button-primary hover:bg-void-bg-2'
					}`}
				>
					<div className="flex flex-col items-center justify-center text-center">
						{selectedFile ? (
							<>
								<div className="w-16 h-16 bg-void-bg-1 rounded-lg shadow-sm flex items-center justify-center mb-3 text-3xl">📄</div>
								<p className="font-medium text-void-fg-1 mb-1 break-all line-clamp-2">{selectedFile.split(/[\\/]/).pop()}</p>
								<p className="text-xs text-void-fg-3">Click to change file</p>
							</>
						) : (
							<>
								<p className="text-4xl mb-4">📤</p>
								<p className="font-medium text-void-fg-1 mb-1">Drag & Drop file here</p>
								<p className="text-sm text-void-fg-3">or click to browse</p>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Step 2: Conversion Options */}
			<div className={`space-y-4 transition-opacity duration-300 ${!selectedFile ? 'opacity-50 pointer-events-none' : ''}`}>
				<label className="flex items-center gap-2 text-sm font-semibold text-void-fg-1">
					<div className="w-6 h-6 rounded-full bg-void-button-primary text-void-button-primary-text flex items-center justify-center text-xs">2</div>
					Choose Conversion
				</label>
				<div className="grid grid-cols-2 gap-3">
					{applicableConversions.length > 0 ? (
						applicableConversions.map(([key, info]) => (
							<button
								key={key}
								onClick={() => onTypeChange(key)}
								className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
									conversionType === key
										? 'bg-void-button-primary border-void-button-primary text-void-button-primary-text'
										: 'bg-void-bg-1 border-void-border-2 hover:border-void-button-primary text-void-fg-1'
								}`}
							>
								<div className={`w-8 h-8 rounded flex items-center justify-center ${conversionType === key ? 'bg-white/20' : 'bg-void-bg-2'}`}>→</div>
								<div className="text-left"><div className="font-medium text-sm">{info.description}</div></div>
							</button>
						))
					) : (
						<div className="col-span-2 p-4 bg-void-bg-1 rounded-lg border border-void-border-2 text-center text-void-fg-3">
							{selectedFile ? 'No compatible conversions found for this file type.' : 'Select a file to see options.'}
						</div>
					)}
				</div>
			</div>

			{/* Step 3: Output & Action */}
			<div className={`space-y-4 transition-opacity duration-300 ${!conversionType ? 'opacity-50 pointer-events-none' : ''}`}>
				<div className="flex items-end gap-4">
					<div className="flex-1 space-y-2">
						<label className="flex items-center gap-2 text-sm font-semibold text-void-fg-1">
							<div className="w-6 h-6 rounded-full bg-void-button-primary text-void-button-primary-text flex items-center justify-center text-xs">3</div>
							Output Location
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								value={outputPath}
								readOnly
								className="flex-1 px-3 py-2.5 bg-void-bg-1 border border-void-border-2 rounded-lg text-void-fg-2 text-sm"
								placeholder="Select output..."
							/>
							<button
								onClick={onOutputSelect}
								className="px-3 bg-void-bg-1 border border-void-border-2 rounded-lg text-void-fg-1 hover:bg-void-bg-2"
								title="Change Output Location"
							>📁</button>
						</div>
					</div>
					<button
						onClick={onStartConversion}
						disabled={!canConvert}
						className={`h-[42px] px-8 rounded-lg font-semibold transition-all flex items-center gap-2 ${
							canConvert
								? "bg-void-button-primary text-void-button-primary-text hover:bg-void-button-primary-hover shadow-lg"
								: "bg-void-bg-1 text-void-fg-4 cursor-not-allowed border border-void-border-2"
						}`}
					>
						<span>Convert</span><span>▶</span>
					</button>
				</div>
			</div>
		</div>
	);
};
