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
  outputDir: string;
  outputFilename: string;
  outputPath: string;
  conversionType: string;
  availableConversions: Record<string, ConversionInfo>;
  onFileSelect: () => void;
  onOutputDirSelect: () => void;
  onFilenameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  "image2text": { source_formats: ["png", "jpg", "jpeg", "gif", "bmp", "tiff"], target_formats: ["txt"], description: "Image → Text (OCR)" }
};

export const ConversionSelector: React.FC<ConversionSelectorProps> = ({
  selectedFile, outputDir, outputFilename, outputPath, conversionType, availableConversions,
  onFileSelect, onOutputDirSelect, onFilenameChange, onTypeChange, onStartConversion, isDragging
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
    info.source_formats.some((fmt) => fmt.toLowerCase() === detectedExtension || detectedExtension === "jpeg" && fmt === "jpg")
    );
  }, [conversions, detectedExtension]);

  React.useEffect(() => {
    if (applicableConversions.length === 1 && !conversionType) {
      onTypeChange(applicableConversions[0][0]);
    }
  }, [applicableConversions, conversionType, onTypeChange]);

  const canConvert = selectedFile && outputPath && conversionType;

  return (
    <div className="void-flex void-flex-col void-h-full void-w-full">
			{/* Scrollable content area */}
			<div
        className="void-flex-1 void-overflow-y-auto void-custom-scrollbar void-p-6 void-space-y-6 void-w-full void-max-w-3xl void-mx-auto">
        
				{/* Step 1: File Selection */}
				<div className="void-space-y-2">
					<label className="void-flex void-items-center void-gap-2 void-text-sm void-font-semibold void-text-void-fg-1">
						<div className="void-w-6 void-h-6 void-rounded-full void-bg-void-button-primary void-text-void-button-primary-text void-flex void-items-center void-justify-center void-text-xs">1</div>
						Select File
					</label>
					<div
            onClick={onFileSelect}
            className={`void-group void-relative void-border-2 void-border-dashed void-rounded-xl void-p-6 void-transition-all void-cursor-pointer ${
            selectedFile ? "void-border-void-button-primary void-bg-void-button-primary/5" : "void-border-void-border-3 hover:void-border-void-button-primary hover:void-bg-void-bg-2"}`}>



            
						<div className="void-flex void-flex-col void-items-center void-justify-center void-text-center">
							{selectedFile ?
              <>
									<div className="void-w-12 void-h-12 void-bg-void-bg-1 void-rounded-lg void-shadow-sm void-flex void-items-center void-justify-center void-mb-2 void-text-2xl">📄</div>
									<p className="void-font-medium void-text-void-fg-1 void-mb-1 void-break-all void-line-clamp-2 void-text-sm" title={selectedFile.split(/[\\/]/).pop()}>{selectedFile.split(/[\\/]/).pop()}</p>
									<p className="void-text-xs void-text-void-fg-3">Click to change file</p>
								</> :

              <>
									<p className="void-text-3xl void-mb-2">📤</p>
									<p className="void-font-medium void-text-void-fg-1 void-mb-1 void-text-sm">Drag & Drop file here</p>
									<p className="void-text-xs void-text-void-fg-3">or click to browse</p>
								</>
              }
						</div>
					</div>
				</div>

				{/* Step 2: Conversion Options */}
				<div className={`void-space-y-3 void-transition-opacity void-duration-300 ${!selectedFile ? "void-opacity-50 void-pointer-events-none" : ""}`}>
					<label className="void-flex void-items-center void-gap-2 void-text-sm void-font-semibold void-text-void-fg-1">
						<div className="void-w-6 void-h-6 void-rounded-full void-bg-void-button-primary void-text-void-button-primary-text void-flex void-items-center void-justify-center void-text-xs">2</div>
						Choose Conversion
					</label>
					<div className="void-grid void-grid-cols-2 void-gap-2">
						{applicableConversions.length > 0 ?
            applicableConversions.map(([key, info]) =>
            <button
              key={key}
              onClick={() => onTypeChange(key)}
              className={`void-flex void-items-center void-gap-2 void-p-2.5 void-rounded-lg void-border void-transition-all ${
              conversionType === key ? "void-bg-void-button-primary void-border-void-button-primary void-text-void-button-primary-text" : "void-bg-void-bg-1 void-border-void-border-2 hover:void-border-void-button-primary void-text-void-fg-1"}`}>



              
									<div className={`void-w-7 void-h-7 void-rounded void-flex void-items-center void-justify-center void-text-sm ${conversionType === key ? "void-bg-white/20" : "void-bg-void-bg-2"}`}>→</div>
									<div className="void-text-left"><div className="void-font-medium void-text-xs">{info.description}</div></div>
								</button>
            ) :

            <div className="void-col-span-2 void-p-3 void-bg-void-bg-1 void-rounded-lg void-border void-border-void-border-2 void-text-center void-text-void-fg-3 void-text-sm">
								{selectedFile ? 'No compatible conversions found for this file type.' : 'Select a file to see options.'}
							</div>
            }
					</div>
				</div>

				{/* Step 3: Output Location */}
				<div className={`void-space-y-4 void-transition-opacity void-duration-300 ${!conversionType ? "void-opacity-50 void-pointer-events-none" : ""}`}>
					<label className="void-flex void-items-center void-gap-2 void-text-sm void-font-semibold void-text-void-fg-1">
						<div className="void-w-6 void-h-6 void-rounded-full void-bg-void-button-primary void-text-void-button-primary-text void-flex void-items-center void-justify-center void-text-xs">3</div>
						Output Location
					</label>

					{/* Directory Selection */}
					<div className="void-space-y-2">
						<label className="void-text-xs void-text-void-fg-3 void-font-medium">Directory</label>
						<div className="void-flex void-gap-2">
							<input
                type="text"
                value={outputDir}
                readOnly
                className="void-flex-1 void-px-3 void-py-2.5 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded-lg void-text-void-fg-2 void-text-sm void-font-mono void-truncate"
                placeholder="Select output directory..."
                title={outputDir} />
              
							<button
                onClick={onOutputDirSelect}
                className="void-shrink-0 void-px-3 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded-lg void-text-void-fg-1 hover:void-bg-void-bg-2"
                title="Change Output Directory">
                📁</button>
						</div>
					</div>

					{/* Filename Input */}
					<div className="void-space-y-2">
						<label className="void-text-xs void-text-void-fg-3 void-font-medium">Filename</label>
						<input
              type="text"
              value={outputFilename}
              onChange={onFilenameChange}
              className="void-w-full void-px-3 void-py-2.5 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded-lg void-text-void-fg-1 void-text-sm"
              placeholder="Enter output filename..." />
            
					</div>
				</div>
			</div>

			{/* Fixed Convert Button at bottom */}
			<div className="void-shrink-0 void-p-4 void-border-t void-border-void-border-2 void-bg-void-bg-2 void-w-full">
				<div className="void-max-w-3xl void-mx-auto void-w-full">
					<button
            onClick={onStartConversion}
            disabled={!canConvert}
            className={`void-w-full void-h-[42px] void-px-8 void-rounded-lg void-font-semibold void-transition-all void-flex void-items-center void-justify-center void-gap-2 ${
            canConvert ? "void-bg-void-button-primary void-text-void-button-primary-text hover:void-bg-void-button-primary-hover void-shadow-lg" : "void-bg-void-bg-1 void-text-void-fg-4 void-cursor-not-allowed void-border void-border-void-border-2"}`}>



            
						<span>Convert Now</span><span>▶</span>
					</button>
				</div>
			</div>
		</div>);

};