/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAccessor } from "../util/services.js";
import { ConversionSelector } from "./ConversionSelector.js";
import { ConversionProgress } from "./ConversionProgress.js";
import { ConversionHistory } from "./ConversionHistory.js";
import { URI } from "../../../../../../../base/common/uri.js";

interface ConversionResult {
	success: boolean;
	output_path?: string;
	duration?: number;
	error?: string;
	error_type?: string;
}

interface HistoryItem {
	id: string;
	input: string;
	output: string;
	type: string;
	status: "pending" | "converting" | "success" | "error";
	result?: ConversionResult;
	timestamp: Date;
}

interface ProgressInfo {
	percent: number;
	message: string;
	current_file?: string;
}

// Map conversion types to their target file extensions
const TARGET_EXTENSION_OF_CONVERSION: Record<string, string> = {
	"md2pdf": "pdf",
	"md2html": "html",
	"md2docx": "docx",
	"pdf2md": "md",
	"pdf2html": "html",
	"pdf2images": "png",
	"pdf2ocr": "pdf",
	"docx2pdf": "pdf",
	"docx2md": "md",
	"html2pdf": "pdf",
	"image2pdf": "pdf",
	"image2text": "txt",
};

function getTargetExtension(conversionType: string): string {
	return TARGET_EXTENSION_OF_CONVERSION[conversionType] || "";
}

export const FileConverterDashboard: React.FC = () => {
	const accessor = useAccessor();

	// Get services properly
	const fileDialogService = useMemo(() => accessor.get("IFileDialogService"), [accessor]);
	const openerService = useMemo(() => accessor.get("IOpenerService"), [accessor]);
	const commandService = useMemo(() => accessor.get("ICommandService"), [accessor]);
	const workspaceContextService = useMemo(() => {
		try {
			return accessor.get("IWorkspaceContextService");
		} catch (error) {
			console.error("[FileConverterDashboard] Failed to get IWorkspaceContextService:", error);
			return null;
		}
	}, [accessor]);
	const fileConverterService = useMemo(() => {
		try {
			return accessor.get("IFileConverterService");
		} catch (error) {
			console.error("[FileConverterDashboard] Failed to get FileConverterService:", error);
			return null;
		}
	}, [accessor]);

	// Get workspace folder as default output directory
	const workspaceFolder = useMemo(() => {
		if (workspaceContextService) {
			const workspace = workspaceContextService.getWorkspace();
			if (workspace.folders && workspace.folders.length > 0) {
				return workspace.folders[0].uri.fsPath;
			}
		}
		return "";
	}, [workspaceContextService]);

	const [currentStep, setCurrentStep] = useState<"select" | "converting" | "complete">("select");
	const [selectedFile, setSelectedFile] = useState<string>("");
	// Split output into directory and filename
	const [outputDir, setOutputDir] = useState<string>("");
	const [outputFilename, setOutputFilename] = useState<string>("");
	const [conversionType, setConversionType] = useState<string>("");
	const [progress, setProgress] = useState<ProgressInfo>({ percent: 0, message: "" });
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [currentResult, setCurrentResult] = useState<ConversionResult | null>(null);
	const [availableConversions, setAvailableConversions] = useState<Record<string, any>>({});
	const [isDragging, setIsDragging] = useState(false);

	// Compute full output path from dir + filename
	const outputPath = useMemo(() => {
		if (!outputDir || !outputFilename) return "";
		// Handle both Windows and Unix path separators
		const separator = outputDir.includes("\\") ? "\\" : "/";
		// Remove trailing separator if present
		const cleanDir = outputDir.endsWith(separator) ? outputDir.slice(0, -1) : outputDir;
		return `${cleanDir}${separator}${outputFilename}`;
	}, [outputDir, outputFilename]);

	// Auto-set output directory to workspace when it becomes available
	useEffect(() => {
		if (!outputDir && workspaceFolder) {
			setOutputDir(workspaceFolder);
		}
	}, [workspaceFolder, outputDir]);

	// Auto-generate output filename when input file or conversion type changes
	useEffect(() => {
		if (selectedFile && conversionType) {
			const inputFileName = selectedFile.split(/[\\/]/).pop() || "";
			const baseName = inputFileName.replace(/\.[^.]+$/, "");
			const targetExtension = getTargetExtension(conversionType);
			const newFilename = baseName + (targetExtension ? `.${targetExtension}` : "");
			setOutputFilename(newFilename);
		}
	}, [selectedFile, conversionType]);

	useEffect(() => {
		const loadConversions = async () => {
			if (fileConverterService) {
				try {
					const conversions = await (fileConverterService as any).getAvailableConversions();
					setAvailableConversions(conversions);
				} catch (error) {
					console.error("[FileConverterDashboard] Error loading conversions:", error);
				}
			}
		};
		loadConversions();
	}, [fileConverterService]);

	const handleFileSelect = useCallback(async () => {
		try {
			const result = await fileDialogService.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				title: "Select File to Convert"
			});
			if (result && result.length > 0) {
				const uri = result[0];
				setSelectedFile(uri.fsPath);
			}
		} catch (error) {
			console.error("[FileConverterDashboard] Error selecting file:", error);
		}
	}, [fileDialogService]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		// Try to get file path from various sources
		// 1. Standard browser file drop
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const file = e.dataTransfer.files[0];
			const filePath = (file as any).path;
			if (filePath) {
				setSelectedFile(filePath);
				return;
			}
		}

		// 2. VS Code file explorer drag - check for URI in text data
		const uriList = e.dataTransfer.getData('text/uri-list');
		if (uriList) {
			const lines = uriList.split('\n').filter(line => line && !line.startsWith('#'));
			if (lines.length > 0) {
				try {
					const uri = URI.parse(lines[0]);
					if (uri.fsPath) {
						setSelectedFile(uri.fsPath);
						return;
					}
				} catch (err) {
					console.error('[FileConverterDashboard] Failed to parse URI:', err);
				}
			}
		}

		// 3. Check for CodeDataTransfers (VS Code internal format)
		const resourceUrls = e.dataTransfer.getData('ResourceURLs');
		if (resourceUrls) {
			try {
				const urls = JSON.parse(resourceUrls);
				if (Array.isArray(urls) && urls.length > 0) {
					const uri = URI.parse(urls[0]);
					if (uri.fsPath) {
						setSelectedFile(uri.fsPath);
						return;
					}
				}
			} catch (err) {
				console.error('[FileConverterDashboard] Failed to parse ResourceURLs:', err);
			}
		}

		// 4. Check for plain text path
		const textData = e.dataTransfer.getData('text/plain');
		if (textData && (textData.includes('/') || textData.includes('\\'))) {
			// Looks like a file path
			setSelectedFile(textData);
		}
	}, []);

	// Handle directory selection (separate from filename)
	const handleOutputDirSelect = useCallback(async () => {
		try {
			// Default to current outputDir or workspace folder
			const defaultUri = outputDir ? URI.file(outputDir) : (workspaceFolder ? URI.file(workspaceFolder) : undefined);

			const result = await fileDialogService.showOpenDialog({
				title: "Select Output Directory",
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri
			});
			if (result && result.length > 0) {
				setOutputDir(result[0].fsPath);
			}
		} catch (error) {
			console.error("[FileConverterDashboard] Error selecting output directory:", error);
		}
	}, [fileDialogService, outputDir, workspaceFolder]);

	// Handle filename change (user can type directly)
	const handleFilenameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setOutputFilename(e.target.value);
	}, []);

	const handleStartConversion = useCallback(async () => {
		if (!selectedFile || !outputPath || !conversionType) return;

		setCurrentStep("converting");
		setProgress({ percent: 0, message: "Starting conversion..." });

		const historyItem: HistoryItem = {
			id: Date.now().toString(),
			input: selectedFile,
			output: outputPath,
			type: conversionType,
			status: "converting",
			timestamp: new Date()
		};

		setHistory(prev => [historyItem, ...prev]);

		try {
			if (fileConverterService) {
				const progressDisposable = (fileConverterService as any).onProgress((p: any) => {
					setProgress(p);
				});

				try {
					const result = await (fileConverterService as any).convert(selectedFile, outputPath, conversionType);
					setCurrentResult(result);
					setCurrentStep("complete");
					setHistory(prev => prev.map(item =>
						item.id === historyItem.id
							? { ...item, status: result.success ? "success" : "error", result }
							: item
					));
				} finally {
					progressDisposable.dispose();
				}
			}
		} catch (error) {
			const errorResult: ConversionResult = {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				error_type: "conversion"
			};
			setCurrentResult(errorResult);
			setCurrentStep("complete");
			setHistory(prev => prev.map(item =>
				item.id === historyItem.id ? { ...item, status: "error", result: errorResult } : item
			));
		}
	}, [selectedFile, outputPath, conversionType, fileConverterService]);

	const handleNewConversion = useCallback(() => {
		setCurrentStep("select");
		// Reset to workspace folder, clear filename
		setOutputDir(workspaceFolder);
		setOutputFilename("");
		setProgress({ percent: 0, message: "" });
		setCurrentResult(null);
	}, [workspaceFolder]);

	const openFile = useCallback(async (path: string) => {
		try {
			await openerService.open(URI.file(path));
		} catch (e) {
			console.error("Failed to open file:", e);
		}
	}, [openerService]);

	const revealFile = useCallback(async (path: string) => {
		try {
			// Use the VSCode command to reveal file in OS file explorer (same as Shift+Alt+R)
			await commandService.executeCommand("revealFileInOS", URI.file(path));
		} catch (e) {
			console.error("Failed to reveal file:", e);
		}
	}, [commandService]);

	const renderContent = () => {
		switch (currentStep) {
			case "select":
				return (
					<ConversionSelector
						selectedFile={selectedFile}
						outputDir={outputDir}
						outputFilename={outputFilename}
						outputPath={outputPath}
						conversionType={conversionType}
						availableConversions={availableConversions}
						onFileSelect={handleFileSelect}
						onOutputDirSelect={handleOutputDirSelect}
						onFilenameChange={handleFilenameChange}
						onTypeChange={setConversionType}
						onStartConversion={handleStartConversion}
						isDragging={isDragging}
					/>
				);

			case "converting":
				return (
					<ConversionProgress
						progress={progress}
						inputFile={selectedFile}
						outputFile={outputPath}
						conversionType={conversionType}
					/>
				);

			case "complete":
				return (
					<div className="flex flex-col items-center justify-center h-full p-8">
						<div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${currentResult?.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
							<span className={`text-3xl ${currentResult?.success ? 'text-green-500' : 'text-red-500'}`}>
								{currentResult?.success ? '✓' : '✗'}
							</span>
						</div>
						<h3 className="text-xl font-semibold text-void-fg-1 mb-2">
							{currentResult?.success ? "Conversion Complete!" : "Conversion Failed"}
						</h3>
						{currentResult?.success ? (
							<div className="text-center mb-8">
								<p className="text-void-fg-3 mb-4">Your file has been successfully converted.</p>
								<div className="flex gap-3 justify-center">
									<button
										onClick={() => openFile(currentResult.output_path!)}
										className="px-4 py-2 bg-void-bg-2 text-void-fg-1 rounded hover:bg-void-bg-2-hover transition-colors text-sm flex items-center gap-2"
									>
										<span>👁</span> Open File
									</button>
									<button
										onClick={() => revealFile(currentResult.output_path!)}
										className="px-4 py-2 bg-void-bg-2 text-void-fg-1 rounded hover:bg-void-bg-2-hover transition-colors text-sm flex items-center gap-2"
									>
										<span>📁</span> Show in Folder
									</button>
								</div>
							</div>
						) : (
							<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8 max-w-md w-full">
								<p className="text-red-400 text-sm text-center">{currentResult?.error || "An unknown error occurred."}</p>
							</div>
						)}
						<button onClick={handleNewConversion} className="px-6 py-3 bg-void-button-primary text-void-button-primary-text rounded-lg font-medium hover:bg-void-button-primary-hover transition-all flex items-center gap-2">
							<span>←</span> Convert Another File
						</button>
					</div>
				);
		}
	};

	return (
		<div
			className={`void-scope h-full flex flex-col bg-void-bg-1 ${isDragging ? 'bg-blue-500/10' : ''}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-void-border-2 bg-void-bg-2">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 bg-void-button-primary rounded-md flex items-center justify-center text-void-button-primary-text">⇄</div>
					<div>
						<h2 className="text-base font-bold text-void-fg-1 leading-none">Transmutations</h2>
						<p className="text-xs text-void-fg-3 mt-1">AiChemist File Converter</p>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 overflow-hidden flex flex-col">
				{renderContent()}
			</div>

			{/* History Section */}
			{history.length > 0 && currentStep === "select" && (
				<div className="border-t border-void-border-2 bg-void-bg-2 max-h-[40%] flex flex-col">
					<ConversionHistory history={history} onOpen={openFile} onReveal={revealFile} />
				</div>
			)}

			{/* Drag Overlay */}
			{isDragging && (
				<div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center z-50 border-4 border-void-button-primary border-dashed m-4 rounded-xl">
					<div className="text-center pointer-events-none">
						<p className="text-4xl mb-4">📄</p>
						<p className="text-2xl font-bold text-void-fg-1">Drop file to convert</p>
					</div>
				</div>
			)}
		</div>
	);
};
