/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, {
    ButtonHTMLAttributes,
    Fragment,
    KeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { ScrollType } from "../../../../../../../editor/common/editorCommon.js";
import {
    useAccessor,
    useActiveURI,
    useChatThreadsState,
    useChatThreadsStreamState,
    useCommandBarState,
    useFullChatThreadsStreamState,
    useSettingsState,
} from "../util/services.js";

import {
    Check,
    Copy as CopyIcon,
    File,
    Folder,
    Image,
    Pencil,
    RotateCw,
    Text,
    Trash2,
    X
} from "lucide-react";
import { DataTransfers } from "../../../../../../../base/browser/dnd.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { getPathForFile } from "../../../../../../../platform/dnd/browser/dnd.js";
import {
    ChatMode,
    FeatureName,
    isFeatureNameDisabled,
} from "../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js";
import {
    ChatMessage,
    CheckpointEntry,
    StagingSelectionItem,
    ToolMessage,
} from "../../../../common/chatThreadServiceTypes.js";
import { removeMCPToolNamePrefix } from "../../../../common/mcpServiceTypes.js";
import {
    isABuiltinToolName,
    MAX_FILE_CHARS_PAGE
} from "../../../../common/prompt/prompts.js";
import { isSingleToolCall, RawToolCallObj } from "../../../../common/sendLLMMessageTypes.js";
import {
    approvalTypeOfBuiltinToolName,
    BuiltinToolName,
    LintErrorItem,
    ToolName
} from "../../../../common/tools/toolsServiceTypes.js";
import { VOID_CTRL_L_ACTION_ID } from "../../../actionIDs.js";
import { IsRunningType } from "../../../chatThreadService.js";
import { VOID_OPEN_SETTINGS_ACTION_ID } from "../../../voidSettingsPane.js";
import {
    CopyButton,
    EditToolAcceptRejectButtonsHTML,
    IconShell1,
    StatusIndicator,
    useEditToolStreamState,
} from "../markdown/ApplyBlockHoverButtons.js";
import {
    ChatMarkdownRender,
    ChatMessageLocation,
    getApplyBoxId,
} from "../markdown/ChatMarkdownRender.js";
import {
    BlockCode,
    TextAreaFns,
    VoidCustomDropdownBox,
    VoidDiffEditor,
    VoidInputBox2,
} from "../util/inputs.js";
import { ModelDropdown } from "../void-settings-tsx/ModelDropdown.js";
import { ToolApprovalTypeSwitch } from "../void-settings-tsx/Settings.js";
import { WarningBox } from "../void-settings-tsx/WarningBox.js";
import { ContextWindowIndicator } from "./ContextWindowIndicator.js";
import ErrorBoundary from "./ErrorBoundary.js";
import { ErrorDisplay } from "./ErrorDisplay.js";
import { PastThreadsList } from "./SidebarThreadSelector.js";
import {
    BottomChildren,
    CodeChildren,
    getBasename,
    getRelative,
    getTitle,
    ListableToolItem,
    ProseWrapper,
    SmallProseWrapper,
    titleOfBuiltinToolName,
    ToolChildrenWrapper,
    ToolHeaderWrapper,
    toolNameToDesc,
    type ToolHeaderParams
} from "./tool-renderers/index.js";

export const IconX = ({
	size,
	className = "",
	...props
}: { size: number; className?: string } & React.SVGProps<SVGSVGElement>) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			className={className}
			{...props}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M6 18 18 6M6 6l12 12"
			/>
		</svg>
	);
};

const IconArrowUp = ({
	size,
	className = "",
}: {
	size: number;
	className?: string;
}) => {
	return (
		<svg
			width={size}
			height={size}
			className={className}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fill="black"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
			></path>
		</svg>
	);
};

const IconSquare = ({
	size,
	className = "",
}: {
	size: number;
	className?: string;
}) => {
	return (
		<svg
			className={className}
			stroke="black"
			fill="black"
			strokeWidth="0"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
		</svg>
	);
};

export const IconWarning = ({
	size,
	className = "",
}: {
	size: number;
	className?: string;
}) => {
	return (
		<svg
			className={className}
			stroke="currentColor"
			fill="currentColor"
			strokeWidth="0"
			viewBox="0 0 16 16"
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z"
			/>
		</svg>
	);
};

export const IconLoading = ({ className = "" }: { className?: string }) => {
	const [loadingText, setLoadingText] = useState(".");

	useEffect(() => {
		let intervalId;

		// Function to handle the animation
		const toggleLoadingText = () => {
			if (loadingText === "...") {
				setLoadingText(".");
			} else {
				setLoadingText(loadingText + ".");
			}
		};

		// Start the animation loop
		intervalId = setInterval(toggleLoadingText, 300);

		// Cleanup function to clear the interval when component unmounts
		return () => clearInterval(intervalId);
	}, [loadingText, setLoadingText]);

	return <div className={`${className}`}>{loadingText}</div>;
};

// Message Actions Component
const MessageActions = ({
	message,
	messageIdx,
	onCopy,
	onEdit,
	onRegenerate,
	onDelete,
	showEdit = true,
	showRegenerate = false,
	showDelete = false,
}: {
	message: ChatMessage;
	messageIdx: number;
	onCopy: () => void;
	onEdit?: () => void;
	onRegenerate?: () => void;
	onDelete?: () => void;
	showEdit?: boolean;
	showRegenerate?: boolean;
	showDelete?: boolean;
}) => {
	return (
		<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-void-bg-2 rounded p-1 border border-void-border-2">
			<button
				onClick={onCopy}
				className="p-1 hover:bg-void-bg-1 rounded transition-colors"
				data-tooltip-id="void-tooltip"
				data-tooltip-content="Copy message"
			>
				<CopyIcon size={12} className="text-void-fg-3" />
			</button>
			{showEdit && onEdit && (
				<button
					onClick={onEdit}
					className="p-1 hover:bg-void-bg-1 rounded transition-colors"
					data-tooltip-id="void-tooltip"
					data-tooltip-content="Edit message"
				>
					<Pencil size={12} className="text-void-fg-3" />
				</button>
			)}
			{showRegenerate && onRegenerate && (
				<button
					onClick={onRegenerate}
					className="p-1 hover:bg-void-bg-1 rounded transition-colors"
					data-tooltip-id="void-tooltip"
					data-tooltip-content="Regenerate response"
				>
					<RotateCw size={12} className="text-void-fg-3" />
				</button>
			)}
			{showDelete && onDelete && (
				<button
					onClick={onDelete}
					className="p-1 hover:bg-void-bg-1 rounded transition-colors"
					data-tooltip-id="void-tooltip"
					data-tooltip-content="Delete message"
				>
					<Trash2 size={12} className="text-red-400" />
				</button>
			)}
		</div>
	);
};


const nameOfChatMode = {
	drafting: "Drafting",
	research: "Research",
	case_manager: "Case Manager",
	blog_writer: "Blog Writer",
};

const detailOfChatMode = {
	drafting: "Interactive document creation with guidance",
	research: "Deep policy and case document analysis",
	case_manager: "Proactive case workflow management",
	blog_writer: "SEO content creation and social media strategy",
};

const ChatModeDropdown = ({ className }: { className: string }) => {
	const accessor = useAccessor();

	const voidSettingsService = accessor.get("IVoidSettingsService");
	const settingsState = useSettingsState();

	const options: ChatMode[] = useMemo(
		() => ["drafting", "research", "case_manager", "blog_writer"],
		[]
	);

	const onChangeOption = useCallback(
		(newVal: ChatMode) => {
			voidSettingsService.setGlobalSetting("chatMode", newVal);
		},
		[voidSettingsService]
	);

	return (
		<VoidCustomDropdownBox
			className={className}
			options={options}
			selectedOption={settingsState.globalSettings.chatMode}
			onChangeOption={onChangeOption}
			getOptionDisplayName={(val) => nameOfChatMode[val]}
			getOptionDropdownName={(val) => nameOfChatMode[val]}
			getOptionDropdownDetail={(val) => detailOfChatMode[val]}
			getOptionsEqual={(a, b) => a === b}
		/>
	);
};

interface VoidChatAreaProps {
	// Required
	children: React.ReactNode; // This will be the input component

	// Form controls
	onSubmit: () => void;
	onAbort: () => void;
	isStreaming: boolean;
	isDisabled?: boolean;
	divRef?: React.RefObject<HTMLDivElement | null>;

	// UI customization
	className?: string;
	showModelDropdown?: boolean;
	showSelections?: boolean;
	showProspectiveSelections?: boolean;
	loadingIcon?: React.ReactNode;

	selections?: StagingSelectionItem[];
	setSelections?: (s: StagingSelectionItem[]) => void;
	// selections?: any[];
	// onSelectionsChange?: (selections: any[]) => void;

	onClickAnywhere?: () => void;
	// Optional close button
	onClose?: () => void;

	featureName: FeatureName;
}

export const VoidChatArea: React.FC<VoidChatAreaProps> = ({
	children,
	onSubmit,
	onAbort,
	onClose,
	onClickAnywhere,
	divRef,
	isStreaming = false,
	isDisabled = false,
	className = "",
	showModelDropdown = true,
	showSelections = false,
	showProspectiveSelections = false,
	selections,
	setSelections,
	featureName,
	loadingIcon,
}) => {
	const [isDragging, setIsDragging] = useState(false);
	const [dragFileCount, setDragFileCount] = useState(0);
	const [isDraggingFolder, setIsDraggingFolder] = useState(false);
	const accessor = useAccessor();
	const fileService = accessor.get("IFileService");
	const dialogService = accessor.get("IDialogService");
	const notificationService = accessor.get("INotificationService");
	const ragAutoIndexService = accessor.get("IRAGAutoIndexService");
	const documentViewerService = accessor.get("IDocumentViewerService");

	// Debug service availability
	console.log("Service availability:", {
		fileService: !!fileService,
		dialogService: !!dialogService,
		notificationService: !!notificationService,
		ragAutoIndexService: !!ragAutoIndexService,
		documentViewerService: !!documentViewerService
	});

	// If dialogService is not available, try to get it again or use fallback
	if (!dialogService) {
		console.warn("DialogService not available, using fallback");
	}

	// Common exclusion patterns (like .gitignore)
	const shouldExcludeFile = (uri: URI): boolean => {
		const path = uri.fsPath;
		const excludePatterns = [
			"node_modules",
			".git",
			".vscode",
			".idea",
			"__pycache__",
			".pytest_cache",
			".venv",
			"venv",
			"*.pyc",
			"*.pyo",
			"*.class",
			"*.dll",
			"*.exe",
			"*.o",
			"*.so",
		];

		// Allow COMMIT_EDITMSG files even if they're in .git directory
		const fileName = path.split(/[/\\]/).pop();
		if (fileName === "COMMIT_EDITMSG") {
			return false;
		}

		// Check if path contains any excluded pattern as a complete directory name
		const result = excludePatterns.some((pattern) => {
			if (pattern.startsWith("*.")) {
				// Handle file extension patterns - exact match only
				const ext = pattern.substring(1).toLowerCase();
				return path.toLowerCase().endsWith(ext);
			}

			// Split path into segments
			const segments = path.split(/[/\\]/);

			// Check if any directory segment exactly matches the pattern
			// Don't match partial filenames
			for (let i = 0; i < segments.length - 1; i++) {
				// Exclude last segment (filename)
				if (segments[i] === pattern) {
					console.log(`Excluding file ${path} because directory segment "${segments[i]}" matches pattern "${pattern}"`);
					return true;
				}
			}

			return false;
		});

		if (result) {
			console.log(`File ${path} excluded by pattern matching`);
		}

		return result;
	};

	// Check file size and warn if too large
	const checkFileSize = async (
		uri: URI
	): Promise<{ isValid: boolean; size: number }> => {
		try {
			const stat = await fileService.stat(uri);
			const sizeInMB = stat.size / (1024 * 1024);
			const MAX_FILE_SIZE_MB = 200; // Increased from 50MB to 200MB for document files
			const WARN_FILE_SIZE_MB = 10; // Increased warning threshold

			if (sizeInMB > MAX_FILE_SIZE_MB) {
				return { isValid: false, size: sizeInMB };
			}

			// Only warn for files > 10MB to avoid spam for normal document files
			if (sizeInMB > WARN_FILE_SIZE_MB) {
				// Show warning but allow
				console.warn(`Large file: ${uri.fsPath} (${sizeInMB.toFixed(2)}MB)`);
			}

			return { isValid: true, size: sizeInMB };
		} catch (err) {
			console.error("Error checking file size:", err);
			return { isValid: true, size: 0 };
		}
	};

	// Helper function to get language/type for a file based on extension
	const getFileLanguage = (uri: URI): string => {
		const ext = uri.path.split('.').pop()?.toLowerCase() || '';
		switch (ext) {
			case 'pdf':
				return 'pdf';
			case 'docx':
			case 'doc':
				return 'docx';
			case 'xlsx':
			case 'xls':
				return 'xlsx';
			case 'ts':
			case 'tsx':
				return 'typescript';
			case 'js':
			case 'jsx':
				return 'javascript';
			case 'py':
				return 'python';
			case 'md':
				return 'markdown';
			case 'json':
				return 'json';
			case 'html':
				return 'html';
			case 'css':
				return 'css';
			case 'yaml':
			case 'yml':
				return 'yaml';
			default:
				return 'plaintext';
		}
	};

	// Helper function to check if file is a binary document (PDF, DOCX, XLSX)
	const isBinaryDocument = (uri: URI): boolean => {
		const ext = uri.path.split('.').pop()?.toLowerCase() || '';
		return ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext);
	};

	/**
	 * Helper function to create a file selection with intelligent content extraction.
	 * For PDFs: Extracts full text content so the agent can see the document
	 *           Shows notification if OCR was used for scanned PDFs
	 * For other documents: May extract content based on document type
	 * For regular files: Creates standard file selection
	 */
	const createFileSelectionWithContent = async (
		uri: URI
	): Promise<StagingSelectionItem> => {
		const language = getFileLanguage(uri);

		// Check if this is a PDF - extract full content for chat context
		if (documentViewerService.isPDFFile(uri)) {
			try {
				console.log(`[Smart PDF Drop] Extracting full content from: ${uri.fsPath}`);
				const startTime = Date.now();

				// Use getFullTextContentWithOCRInfo to extract all pages and get OCR status
				const result = await documentViewerService.getFullTextContentWithOCRInfo(uri);

				const elapsed = Date.now() - startTime;
				console.log(`[Smart PDF Drop] Extracted ${result?.text?.length || 0} chars in ${elapsed}ms${result?.wasOCR ? ' (via OCR)' : ''}`);

				if (result && result.text) {
					// Show notification if OCR was used (scanned PDF)
					if (result.wasOCR) {
						const fileName = uri.fsPath.split(/[/\\]/).pop() || 'document.pdf';
						notificationService.info(`Scanned PDF detected: "${fileName}" was processed with OCR (${result.ocrLanguage || 'eng'})`);
					}

					// Create file selection with ragContext containing the full PDF text
					const fileName = uri.fsPath.split(/[/\\]/).pop() || 'document.pdf';
					const ragContext = `Document: ${fileName}\n\n${result.text}`;
					console.log(`[Smart PDF Drop] ✅ Creating selection with ragContext (${ragContext.length} chars)`);
					console.log(`[Smart PDF Drop] ragContext preview: ${ragContext.substring(0, 200)}...`);
					return {
						type: "File",
						uri,
						language,
						state: {
							wasAddedAsCurrentFile: false,
							ragContext: ragContext
						},
					};
				} else {
					console.log(`[Smart PDF Drop] ⚠️ No text in result - result.text is empty or undefined`);
				}
			} catch (error) {
				console.error(`[Smart PDF Drop] Failed to extract PDF content:`, error);
				notificationService.warn(`Could not extract PDF text. The agent may have limited visibility into this document.`);
			}
		}

		// For non-PDFs or if PDF extraction failed, create standard selection
		return {
			type: "File",
			uri,
			language,
			state: { wasAddedAsCurrentFile: false },
		};
	};

	// Helper function to create a readable file tree representation
	const createFileTree = async (folderUri: URI, prefix: string = ""): Promise<string> => {
		let tree = "";
		try {
			console.log(`Starting scan of folder: ${folderUri.fsPath}`);
			const entries = await fileService.resolve(folderUri, {
				resolveMetadata: true,
			});

			console.log(`Folder ${folderUri.fsPath} has ${entries.children?.length || 0} children`);
			if (!entries.children || entries.children.length === 0) {
				console.log(`No children found for folder ${folderUri.fsPath}`);
				return "";
			}

			console.log(`Processing ${entries.children.length} items in ${folderUri.fsPath}`);

			// Sort directories first, then files, alphabetically
			const sortedChildren = entries.children.sort((a, b) => {
				if (a.isDirectory && !b.isDirectory) return -1;
				if (!a.isDirectory && b.isDirectory) return 1;
				return a.name.localeCompare(b.name);
			});

			for (let i = 0; i < sortedChildren.length; i++) {
				const child = sortedChildren[i];
				const isLast = i === sortedChildren.length - 1;
				const connector = isLast ? "└── " : "├── ";
				const nextPrefix = prefix + (isLast ? "    " : "│   ");

				// Check exclusion patterns - don't show excluded items in tree
				if (shouldExcludeFile(child.resource)) {
					continue;
				}

				if (child.isDirectory) {
					tree += `${prefix}${connector}${child.name}/\n`;
					tree += await createFileTree(child.resource, nextPrefix);
				} else {
					// Check file size - show size for large files
					const sizeCheck = await checkFileSize(child.resource);
					const sizeInfo = sizeCheck.size > 10 ? ` (${sizeCheck.size.toFixed(1)}MB)` : "";
					tree += `${prefix}${connector}${child.name}${sizeInfo}\n`;
				}
			}
		} catch (err) {
			console.error("Error creating file tree:", err);
		}
		return tree;
	};

	// Helper function to recursively collect files from a folder with smart handling
	const collectFilesFromFolder = async (
		folderUri: URI
	): Promise<{
		uris: URI[];
		skippedCount: number;
		largeFilesSkipped: number;
		isFileTree: boolean;
		fileTreeContent?: string;
		totalSizeMB?: number;
	}> => {
		const fileUris: URI[] = [];
		let skippedCount = 0;
		let largeFilesSkipped = 0;
		let totalSizeMB = 0;

		// First pass: scan all files to calculate total size
		const scanFolder = async (uri: URI): Promise<{ files: URI[], totalSize: number, skipped: number, largeSkipped: number }> => {
			const files: URI[] = [];
			let totalSize = 0;
			let skipped = 0;
			let largeSkipped = 0;

			try {
				const entries = await fileService.resolve(uri, {
					resolveMetadata: true,
				});

				if (entries.children) {
					for (const child of entries.children) {
						// Check exclusion patterns
						if (shouldExcludeFile(child.resource)) {
							skipped++;
							continue;
						}

						if (child.isDirectory) {
						console.log(`Scanning subdirectory: ${child.resource.fsPath}`);
						const subResult = await scanFolder(child.resource);
						files.push(...subResult.files);
						totalSize += subResult.totalSize;
						skipped += subResult.skipped;
						largeSkipped += subResult.largeSkipped;
						console.log(`Subdirectory ${child.resource.fsPath} results: ${subResult.files.length} files, ${subResult.totalSize}MB total`);
					} else {
						// Check if file should be excluded
						if (shouldExcludeFile(child.resource)) {
							skipped++;
							console.log(`File ${child.resource.fsPath} excluded by pattern`);
							continue;
						}

						// Check file size
						const sizeCheck = await checkFileSize(child.resource);
						if (!sizeCheck.isValid) {
							largeSkipped++;
							console.log(`File ${child.resource.fsPath} too large: ${sizeCheck.size}MB`);
							continue;
						}

						files.push(child.resource);
						totalSize += sizeCheck.size;
						console.log(`Added file ${child.resource.fsPath} (${sizeCheck.size}MB)`);
					}
					}
				}
			} catch (err) {
				console.error("Error scanning folder:", err);
			}

			return { files, totalSize, skipped, largeSkipped };
		};

		const scanResult = await scanFolder(folderUri);
		totalSizeMB = scanResult.totalSize;
		skippedCount = scanResult.skipped;
		largeFilesSkipped = scanResult.largeSkipped;

		console.log("Folder scan results:", {
			folderUri: folderUri.fsPath,
			totalFiles: scanResult.files.length,
			totalSizeMB,
			skippedCount,
			largeFilesSkipped,
			remainingFiles: scanResult.files.length - skippedCount - largeFilesSkipped
		});

		// Smart decision: if total size is reasonable, include all files
		const MAX_TOTAL_SIZE_MB = 50; // If folder total is under 50MB, include all files
		const MAX_FILES_FOR_INLINE = 20; // If under 20 files, always include

		if (totalSizeMB <= MAX_TOTAL_SIZE_MB || scanResult.files.length <= MAX_FILES_FOR_INLINE) {
			// Include all files
			fileUris.push(...scanResult.files);
			return {
				uris: fileUris,
				skippedCount,
				largeFilesSkipped,
				isFileTree: false,
				totalSizeMB
			};
		} else {
			// Create file tree representation instead
			const folderName = folderUri.fsPath.split(/[/\\]/).pop() || "folder";
			const fileTree = await createFileTree(folderUri);
			const treeContent = `📁 ${folderName}/\n${fileTree}\n\n📊 Summary:\n- Total files: ${scanResult.files.length}\n- Total size: ${totalSizeMB.toFixed(1)}MB\n- Filtered out: ${skippedCount} files\n- Too large: ${largeFilesSkipped} files\n\nThis folder contains many files. The AI can analyze this structure and request specific files to read using tools.`;

			return {
				uris: [], // No actual files, just the tree
				skippedCount,
				largeFilesSkipped,
				isFileTree: true,
				fileTreeContent: treeContent,
				totalSizeMB
			};
		}
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		if (!setSelections || !selections) return;

		const newSelections: StagingSelectionItem[] = [];
		const MAX_FILES = 50; // Limit to prevent performance issues
		const CONFIRMATION_THRESHOLD = 10; // Show confirmation for more than 10 files

		let totalFilesProcessed = 0;
		let totalSkipped = 0;
		let totalLargeFilesSkipped = 0;

		try {
			// 1. Handle internal VSCode Explorer drags (DataTransfers.RESOURCES)
			const rawResourcesData = e.dataTransfer.getData(DataTransfers.RESOURCES);
			if (rawResourcesData) {
				try {
					const resources = JSON.parse(rawResourcesData);
					// resources can be array of strings (URI paths) or array of {uri: string}
					const uris = Array.isArray(resources)
						? resources.map((r) =>
								typeof r === "string" ? URI.parse(r) : URI.parse(r.uri)
						  )
						: [];

					for (const uri of uris) {
						console.log(`Processing dragged item: ${uri.fsPath}`);
						if (newSelections.length >= MAX_FILES) break;

						// Check exclusion patterns for single files too
						if (shouldExcludeFile(uri)) {
							console.log(`Dragged item ${uri.fsPath} excluded by pattern`);
							totalSkipped++;
							continue;
						}

						const stat = await fileService.stat(uri);
						console.log(`Item ${uri.fsPath} is ${stat.isDirectory ? 'directory' : 'file'}`);
						if (stat.isDirectory) {
							// Handle folder with smart file/folder tree logic
							const result = await collectFilesFromFolder(uri);

							totalSkipped += result.skippedCount;
							totalLargeFilesSkipped += result.largeFilesSkipped;

							if (result.isFileTree && result.fileTreeContent) {
								// Create a virtual file with the folder tree
								const folderName = uri.fsPath.split(/[/\\]/).pop() || "folder";
								const treeUri = URI.parse(`folder-tree://${folderName}.txt`);
								const language = "plaintext";

								newSelections.push({
									type: "File",
									uri: treeUri,
									language,
									state: {
										wasAddedAsCurrentFile: false,
										virtualContent: result.fileTreeContent,
										isVirtualFile: true
									},
								});
								totalFilesProcessed += 1;

								notificationService.info(`Added folder structure for "${folderName}" (${result.totalSizeMB?.toFixed(1)}MB total)`);
							} else {
								// Show confirmation if many files
								if (result.uris.length >= CONFIRMATION_THRESHOLD) {
									const folderName = uri.fsPath.split(/[/\\]/).pop() || "folder";
									const response = dialogService?.confirm ? await dialogService.confirm({
										message: `Add ${result.uris.length} files from "${folderName}"?`,
										detail:
											totalSkipped > 0
												? `${totalSkipped} files were filtered out (node_modules, build artifacts, etc.)${
														totalLargeFilesSkipped > 0
															? `\n${totalLargeFilesSkipped} files skipped (>200MB)`
															: ""
												  }`
												: totalLargeFilesSkipped > 0
												? `${totalLargeFilesSkipped} files skipped (>200MB)`
												: undefined,
										type: "question",
									}) : { confirmed: true }; // Default to confirmed if dialog service unavailable

									if (!response.confirmed) {
										notificationService.info("File drop cancelled");
										return;
									}
								}

								for (const fileUri of result.uris) {
									const language = getFileLanguage(fileUri);
									newSelections.push({
										type: "File",
										uri: fileUri,
										language,
										state: { wasAddedAsCurrentFile: false },
									});
								}
								totalFilesProcessed += result.uris.length;
							}
						} else {
							// Check file size for single files
							const sizeCheck = await checkFileSize(uri);
							if (!sizeCheck.isValid) {
								notificationService.warn(
									`File too large: ${uri.fsPath} (${sizeCheck.size.toFixed(
										2
									)}MB, max 200MB)`
								);
								continue;
							}

							// Add single file with intelligent content extraction (PDFs get full text)
							const selection = await createFileSelectionWithContent(uri);
							newSelections.push(selection);
							totalFilesProcessed++;
						}
					}
				} catch (err) {
					console.error("Error parsing VSCode resources:", err);
					notificationService.error(`Error processing files: ${err}`);
				}
			}

			// 2. Fallback: Handle text/uri-list format (some VSCode components use this)
			if (newSelections.length === 0) {
				const uriList = e.dataTransfer.getData("text/uri-list");
				if (uriList) {
					const uris = uriList
						.split("\n")
						.map((line) => line.trim())
						.filter((line) => line && !line.startsWith("#"))
						.map((line) => {
							try {
								return URI.parse(line);
							} catch {
								return null;
							}
						})
						.filter((uri): uri is URI => uri !== null);

					for (const uri of uris) {
						if (newSelections.length >= MAX_FILES) break;

						if (shouldExcludeFile(uri)) {
							totalSkipped++;
							continue;
						}

						try {
							const stat = await fileService.stat(uri);
							if (stat.isDirectory) {
								const result = await collectFilesFromFolder(uri);

								totalSkipped += result.skippedCount;
								totalLargeFilesSkipped += result.largeFilesSkipped;

								if (result.isFileTree && result.fileTreeContent) {
									// Create a virtual file with the folder tree
									const folderName = uri.fsPath.split(/[/\\]/).pop() || "folder";
									const treeUri = URI.parse(`folder-tree://${folderName}.txt`);
									const language = "plaintext";

									newSelections.push({
										type: "File",
										uri: treeUri,
										language,
										state: {
											wasAddedAsCurrentFile: false,
											virtualContent: result.fileTreeContent,
											isVirtualFile: true
										},
									});
									totalFilesProcessed += 1;

									notificationService.info(`Added folder structure for "${folderName}" (${result.totalSizeMB?.toFixed(1)}MB total)`);
								} else {
									if (result.uris.length >= CONFIRMATION_THRESHOLD) {
										const folderName =
											uri.fsPath.split(/[/\\]/).pop() || "folder";
										const response = dialogService?.confirm ? await dialogService.confirm({
											message: `Add ${result.uris.length} files from "${folderName}"?`,
											detail:
												totalSkipped > 0
													? `${totalSkipped} files were filtered out${
															totalLargeFilesSkipped > 0
																? `, ${totalLargeFilesSkipped} files skipped (>200MB)`
																: ""
													  }`
													: totalLargeFilesSkipped > 0
													? `${totalLargeFilesSkipped} files skipped (>200MB)`
													: undefined,
											type: "question",
										}) : { confirmed: true }; // Default to confirmed if dialog service unavailable

										if (!response.confirmed) {
											notificationService.info("File drop cancelled");
											return;
										}
									}

									for (const fileUri of result.uris) {
										const language = getFileLanguage(fileUri);
										newSelections.push({
											type: "File",
											uri: fileUri,
											language,
											state: { wasAddedAsCurrentFile: false },
										});
									}
									totalFilesProcessed += result.uris.length;
								}
							} else {
								const sizeCheck = await checkFileSize(uri);
								if (!sizeCheck.isValid) {
									notificationService.warn(
										`File too large: ${uri.fsPath} (${sizeCheck.size.toFixed(
											2
										)}MB)`
									);
									continue;
								}

								// Add single file with intelligent content extraction (PDFs get full text)
								const selection = await createFileSelectionWithContent(uri);
								newSelections.push(selection);
								totalFilesProcessed++;
							}
						} catch (err) {
							console.error("Error processing URI from uri-list:", err);
						}
					}
				}
			}

			// 3. Handle external file drops from OS file manager (Windows Explorer, Finder, etc.)
			if (newSelections.length === 0 && e.dataTransfer.files.length > 0) {
				const files = Array.from(e.dataTransfer.files);

				for (const file of files) {
					if (newSelections.length >= MAX_FILES) break;

					try {
						// Use VSCode's safe getPathForFile API instead of (file as any).path
						const filePath = getPathForFile(file);
						if (!filePath) {
							console.warn("Could not get path for file:", file.name);
							continue;
						}

						const uri = URI.file(filePath);

						if (shouldExcludeFile(uri)) {
							totalSkipped++;
							continue;
						}

						const stat = await fileService.stat(uri);

						if (stat.isDirectory) {
							// Handle folder with smart file/folder tree logic
							const result = await collectFilesFromFolder(uri);

							totalSkipped += result.skippedCount;
							totalLargeFilesSkipped += result.largeFilesSkipped;

							if (result.isFileTree && result.fileTreeContent) {
								// Create a virtual file with the folder tree
								const folderName = uri.fsPath.split(/[/\\]/).pop() || "folder";
								const treeUri = URI.parse(`folder-tree://${folderName}.txt`);
								const language = "plaintext";

								newSelections.push({
									type: "File",
									uri: treeUri,
									language,
									state: {
										wasAddedAsCurrentFile: false,
										virtualContent: result.fileTreeContent,
										isVirtualFile: true
									},
								});
								totalFilesProcessed += 1;

								notificationService.info(`Added folder structure for "${folderName}" (${result.totalSizeMB?.toFixed(1)}MB total)`);
							} else {
								if (result.uris.length >= CONFIRMATION_THRESHOLD) {
									const folderName = uri.fsPath.split(/[/\\]/).pop() || "folder";
									const response = dialogService?.confirm ? await dialogService.confirm({
										message: `Add ${result.uris.length} files from "${folderName}"?`,
										detail:
											totalSkipped > 0
												? `${totalSkipped} files were filtered out${
														totalLargeFilesSkipped > 0
															? `, ${totalLargeFilesSkipped} files skipped (>200MB)`
															: ""
												  }`
												: totalLargeFilesSkipped > 0
												? `${totalLargeFilesSkipped} files skipped (>200MB)`
												: undefined,
										type: "question",
									}) : { confirmed: true }; // Default to confirmed if dialog service unavailable

									if (!response.confirmed) {
										notificationService.info("File drop cancelled");
										return;
									}
								}

								for (const fileUri of result.uris) {
									const language = getFileLanguage(fileUri);
									newSelections.push({
										type: "File",
										uri: fileUri,
										language,
										state: { wasAddedAsCurrentFile: false },
									});
								}
								totalFilesProcessed += result.uris.length;
							}
						} else {
							// Check file size
							const sizeCheck = await checkFileSize(uri);
							if (!sizeCheck.isValid) {
								notificationService.warn(
									`File too large: ${file.name} (${sizeCheck.size.toFixed(
										2
									)}MB, max 200MB)`
								);
								continue;
							}

							// Add single file with intelligent content extraction (PDFs get full text)
							const selection = await createFileSelectionWithContent(uri);
							newSelections.push(selection);
							totalFilesProcessed++;
						}
					} catch (err) {
						console.error("Error adding file:", file.name, err);
						notificationService.error(`Error adding file ${file.name}: ${err}`);
					}
				}
			}

			// Add the new selections if any were found
			if (newSelections.length > 0) {
				setSelections([...selections, ...newSelections]);

				// Auto-index documents in the background (non-blocking)
				// This ensures dropped documents are available for RAG search
				for (const selection of newSelections) {
					ragAutoIndexService.indexSelectionIfNeeded(selection).catch((err) => {
						console.error("RAG auto-index failed:", err);
					});
				}

				// Show success notification with details
				let message = `Added ${newSelections.length} file(s) to chat context`;
				if (totalSkipped > 0 || totalLargeFilesSkipped > 0) {
					const details = [];
					if (totalSkipped > 0) details.push(`${totalSkipped} filtered`);
					if (totalLargeFilesSkipped > 0)
						details.push(`${totalLargeFilesSkipped} too large`);
					message += ` (${details.join(", ")})`;
				}
				notificationService.info(message);

				console.log(
					`Added ${newSelections.length} file(s), skipped ${totalSkipped}, ${totalLargeFilesSkipped} too large`
				);
			} else {
				const reason =
					totalSkipped > 0
						? `All ${totalSkipped} files were filtered out (node_modules, build artifacts, etc.)`
						: totalLargeFilesSkipped > 0
						? `All files were too large (>200MB)`
						: "No valid files or folders found in drop event";

				notificationService.warn(reason);
				console.warn(reason);
			}
		} catch (err) {
			console.error("Error handling drop:", err);
			notificationService.error(`Error handling file drop: ${err}`);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);

		// Try to detect file count and if folders are being dragged
		const items = e.dataTransfer.items;
		if (items && items.length > 0) {
			setDragFileCount(items.length);

			// Check if any item is a directory
			let hasFolder = false;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				// For external drops, we can't easily detect folders until drop
				// For internal drops, check if it's a directory
				if (item.kind === "file") {
					const entry = item.webkitGetAsEntry?.();
					if (entry?.isDirectory) {
						hasFolder = true;
						break;
					}
				}
			}
			setIsDraggingFolder(hasFolder);
		} else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			setDragFileCount(e.dataTransfer.files.length);
		}
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// Only set to false if leaving the container entirely
		if (e.currentTarget === e.target) {
			setIsDragging(false);
			setDragFileCount(0);
			setIsDraggingFolder(false);
		}
	};

	return (
		<div
			ref={divRef}
			className={`
				gap-x-1
                flex flex-col p-2 relative input text-left shrink-0
                rounded-md
                bg-void-bg-1
			transition-all duration-200
			border ${
				isDragging
					? "border-void-button-primary border-2 bg-void-button-primary/10"
					: "border-void-border-3 focus-within:border-void-border-1 hover:border-void-border-1"
			}
			max-h-[80vh] overflow-y-auto
			void-scrollbar
                ${className}
            `}
			onClick={(e) => {
				onClickAnywhere?.();
			}}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
		>
			{isDragging && (
				<div className="absolute inset-0 flex items-center justify-center bg-void-button-primary/20 z-50 pointer-events-none rounded-md">
					<div className="text-void-button-primary font-medium flex items-center gap-2">
						{isDraggingFolder ? <Folder size={20} /> : <File size={20} />}
						<span>
							{isDraggingFolder
								? "Drop folder to add all files"
								: dragFileCount > 1
								? `Drop ${dragFileCount} files to attach`
								: "Drop files to attach"}
						</span>
					</div>
				</div>
			)}
			{/* Selections section */}
			{showSelections && selections && setSelections && (
				<SelectedFiles
					type="staging"
					selections={selections}
					setSelections={setSelections}
					showProspectiveSelections={showProspectiveSelections}
				/>
			)}

			{/* Input section */}
			<div className="relative w-full">
				{children}

				{/* Close button (X) if onClose is provided */}
				{onClose && (
					<div className="absolute -top-1 -right-1 cursor-pointer z-1">
						<IconX
							size={12}
							className="stroke-[2] opacity-80 text-void-fg-3 hover:brightness-95"
							onClick={onClose}
						/>
					</div>
				)}
			</div>

			{/* Bottom row */}
			<div className="flex flex-row justify-between items-end gap-1">
				{showModelDropdown && (
					<div className="flex flex-col gap-y-1">
						<div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-nowrap ">
							{featureName === "Chat" && (
								<ChatModeDropdown className="text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-2 rounded py-0.5 px-1" />
							)}
							<ModelDropdown
								featureName={featureName}
								className="text-xs text-void-fg-3 bg-void-bg-1 rounded"
							/>
						</div>
					</div>
				)}

				<div className="flex items-center gap-2">
					{isStreaming && loadingIcon}

					{isStreaming ? (
						<ButtonStop onClick={onAbort} />
					) : (
						<ButtonSubmit onClick={onSubmit} disabled={isDisabled} />
					)}
				</div>
			</div>
		</div>
	);
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
const DEFAULT_BUTTON_SIZE = 22;
export const ButtonSubmit = ({
	className,
	disabled,
	...props
}: ButtonProps & Required<Pick<ButtonProps, "disabled">>) => {
	return (
		<button
			type="button"
			className={`rounded-full flex-shrink-0 flex-grow-0 flex items-center justify-center
			${disabled ? "bg-vscode-disabled-fg cursor-default" : "bg-white cursor-pointer"}
			${className}
		`}
			// data-tooltip-id='void-tooltip'
			// data-tooltip-content={'Send'}
			// data-tooltip-place='left'
			{...props}
		>
			<IconArrowUp size={DEFAULT_BUTTON_SIZE} className="stroke-[2] p-[2px]" />
		</button>
	);
};

export const ButtonStop = ({
	className,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => {
	return (
		<button
			className={`rounded-full flex-shrink-0 flex-grow-0 cursor-pointer flex items-center justify-center
			bg-white
			${className}
		`}
			type="button"
			{...props}
		>
			<IconSquare size={DEFAULT_BUTTON_SIZE} className="stroke-[3] p-[7px]" />
		</button>
	);
};

const scrollToBottom = (divRef: { current: HTMLElement | null }) => {
	if (divRef.current) {
		divRef.current.scrollTop = divRef.current.scrollHeight;
	}
};

const ScrollToBottomContainer = ({
	children,
	className,
	style,
	scrollContainerRef,
}: {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	scrollContainerRef: React.MutableRefObject<HTMLDivElement | null>;
}) => {
	const [isAtBottom, setIsAtBottom] = useState(true); // Start at bottom

	const divRef = scrollContainerRef;

	const onScroll = () => {
		const div = divRef.current;
		if (!div) return;

		const isBottom =
			Math.abs(div.scrollHeight - div.clientHeight - div.scrollTop) < 4;

		setIsAtBottom(isBottom);
	};

	// When children change (new messages added)
	useEffect(() => {
		if (isAtBottom) {
			scrollToBottom(divRef);
		}
	}, [children, isAtBottom]); // Dependency on children to detect new messages

	// Initial scroll to bottom
	useEffect(() => {
		scrollToBottom(divRef);
	}, []);

	return (
		<div ref={divRef} onScroll={onScroll} className={className} style={style}>
			{children}
		</div>
	);
};

// Path helpers (getRelative, getFolderName, getBasename) are now imported from ./tool-renderers/

// Open file utility function
export const voidOpenFileFn = (
	uri: URI,
	accessor: ReturnType<typeof useAccessor>,
	range?: [number, number]
) => {
	const commandService = accessor.get("ICommandService");
	const editorService = accessor.get("ICodeEditorService");

	// Get editor selection from CodeSelection range
	let editorSelection = undefined;

	// If we have a selection, create an editor selection from the range
	if (range) {
		editorSelection = {
			startLineNumber: range[0],
			startColumn: 1,
			endLineNumber: range[1],
			endColumn: Number.MAX_SAFE_INTEGER,
		};
	}

	// open the file
	commandService.executeCommand("vscode.open", uri).then(() => {
		// select the text
		setTimeout(() => {
			if (!editorSelection) return;

			const editor = editorService.getActiveCodeEditor();
			if (!editor) return;

			editor.setSelection(editorSelection);
			editor.revealRange(editorSelection, ScrollType.Immediate);
		}, 50); // needed when document was just opened and needs to initialize
	});
};

export const SelectedFiles = ({
	type,
	selections,
	setSelections,
	showProspectiveSelections,
	messageIdx,
}:
	| {
			type: "past";
			selections: StagingSelectionItem[];
			setSelections?: undefined;
			showProspectiveSelections?: undefined;
			messageIdx: number;
	  }
	| {
			type: "staging";
			selections: StagingSelectionItem[];
			setSelections: (newSelections: StagingSelectionItem[]) => void;
			showProspectiveSelections?: boolean;
			messageIdx?: number;
	  }) => {
	const accessor = useAccessor();
	const commandService = accessor.get("ICommandService");
	const modelReferenceService = accessor.get("IVoidModelService");

	// state for tracking prospective files
	const { uri: currentURI } = useActiveURI();
	const [recentUris, setRecentUris] = useState<URI[]>([]);
	const maxRecentUris = 10;
	const maxProspectiveFiles = 3;
	useEffect(() => {
		// handle recent files
		if (!currentURI) return;
		setRecentUris((prev) => {
			const withoutCurrent = prev.filter(
				(uri) => uri.fsPath !== currentURI.fsPath
			); // remove duplicates
			const withCurrent = [currentURI, ...withoutCurrent];
			return withCurrent.slice(0, maxRecentUris);
		});
	}, [currentURI]);
	const [prospectiveSelections, setProspectiveSelections] = useState<
		StagingSelectionItem[]
	>([]);

	// handle prospective files
	useEffect(() => {
		const computeRecents = async () => {
			const prospectiveURIs = recentUris
				.filter(
					(uri) =>
					!selections.find(
						(s) => s.type === "File" && s.uri?.fsPath === uri.fsPath
					)
				)
				.slice(0, maxProspectiveFiles);

			const answer: StagingSelectionItem[] = [];
			for (const uri of prospectiveURIs) {
				answer.push({
					type: "File",
					uri: uri,
					language:
						(
							await modelReferenceService.getModelSafe(uri)
						).model?.getLanguageId() || "plaintext",
					state: { wasAddedAsCurrentFile: false },
				});
			}
			return answer;
		};

		// add a prospective file if type === 'staging' and if the user is in a file, and if the file is not selected yet
		if (type === "staging" && showProspectiveSelections) {
			computeRecents().then((a) => setProspectiveSelections(a));
		} else {
			setProspectiveSelections([]);
		}
	}, [recentUris, selections, type, showProspectiveSelections]);

	const allSelections = [...selections, ...prospectiveSelections];

	if (allSelections.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center flex-wrap text-left relative gap-x-0.5 gap-y-1 pb-0.5">
			{allSelections.map((selection, i) => {
				const isThisSelectionProspective = i > selections.length - 1;

				const thisKey =
					selection.type === "CodeSelection"
						? selection.type +
						  selection.language +
						  selection.range +
						  selection.state.wasAddedAsCurrentFile +
						  (selection.uri?.fsPath ?? i)
						: selection.type === "File"
						? selection.type +
						  selection.language +
						  selection.state.wasAddedAsCurrentFile +
						  (selection.uri?.fsPath ?? i)
						: selection.type === "Folder"
						? selection.type +
						  selection.language +
						  selection.state +
						  (selection.uri?.fsPath ?? i)
						: i;

				const SelectionIcon =
					selection.type === "File"
						? File
						: selection.type === "Folder"
						? Folder
						: selection.type === "CodeSelection"
						? Text
						: selection.type === "Image"
						? Image
						: (undefined as never);

				return (
					<div // container for summarybox and code
						key={thisKey}
						className={`flex flex-col space-y-[1px]`}
					>
						{/* tooltip for file path */}
						<span
							className="truncate overflow-hidden text-ellipsis"
							data-tooltip-id="void-tooltip"
							data-tooltip-content={getRelative(selection.uri, accessor)}
							data-tooltip-place="top"
							data-tooltip-delay-show={3000}
						>
							{/* summarybox */}
							<div
								className={`
								flex items-center gap-1 relative
								px-1
								w-fit h-fit
								select-none
								text-xs text-nowrap
								border rounded-sm
								${
									isThisSelectionProspective
										? "bg-void-bg-1 text-void-fg-3 opacity-80"
										: "bg-void-bg-1 hover:brightness-95 text-void-fg-1"
								}
								${isThisSelectionProspective ? "border-void-border-2" : "border-void-border-1"}
								hover:border-void-border-1
								transition-all duration-150
							`}
								onClick={() => {
									if (type !== "staging") return; // (never)
									if (isThisSelectionProspective) {
										// add prospective selection to selections
										setSelections([...selections, selection]);
									} else if (selection.type === "File") {
										// open files
										voidOpenFileFn(selection.uri, accessor);

										const wasAddedAsCurrentFile =
											selection.state.wasAddedAsCurrentFile;
										if (wasAddedAsCurrentFile) {
											// make it so the file is added permanently, not just as the current file
											const newSelection: StagingSelectionItem = {
												...selection,
												state: {
													...selection.state,
													wasAddedAsCurrentFile: false,
												},
											};
											setSelections([
												...selections.slice(0, i),
												newSelection,
												...selections.slice(i + 1),
											]);
										}
									} else if (selection.type === "CodeSelection") {
										voidOpenFileFn(selection.uri, accessor, selection.range);
									} else if (selection.type === "Folder") {
										// TODO!!! reveal in tree
									} else if (selection.type === "Image") {
										// Open the image file
										voidOpenFileFn(selection.uri, accessor);
									}
								}}
							>
								{<SelectionIcon size={10} />}

								{
									// file name and range
									getBasename(selection.uri?.fsPath) +
										(selection.type === "CodeSelection"
											? ` (${selection.range[0]}-${selection.range[1]})`
											: "")
								}

								{selection.type === "File" &&
								selection.state.wasAddedAsCurrentFile &&
								messageIdx === undefined &&
								currentURI?.fsPath === selection.uri?.fsPath ? (
									<span
										className={`text-[8px] 'void-opacity-60 text-void-fg-4`}
									>
										{`(Current File)`}
									</span>
								) : null}

								{type === "staging" && !isThisSelectionProspective ? ( // X button
									<div // box for making it easier to click
										className="cursor-pointer z-1 self-stretch flex items-center justify-center"
										onClick={(e) => {
											e.stopPropagation(); // don't open/close selection
											if (type !== "staging") return;
											setSelections([
												...selections.slice(0, i),
												...selections.slice(i + 1),
											]);
										}}
									>
										<IconX className="stroke-[2]" size={10} />
									</div>
								) : (
									<></>
								)}
							</div>
						</span>
					</div>
				);
			})}
		</div>
	);
};

// ToolHeaderWrapper and ToolHeaderParams are now imported from ./tool-renderers/

const EditTool = ({
	toolMessage,
	threadId,
	messageIdx,
	content,
}: Parameters<ResultWrapper<"edit_file" | "rewrite_file">>[0] & {
	content: string;
}) => {
	const accessor = useAccessor();
	const isError = false;
	const isRejected = toolMessage.type === "rejected";

	const title = getTitle(toolMessage);

	const { desc1, desc1Info } = toolNameToDesc(
		toolMessage.name,
		toolMessage.params,
		accessor
	);
	const icon = null;

	const { rawParams, params, name } = toolMessage;
	const desc1OnClick = () => voidOpenFileFn(params.uri, accessor);
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		desc1OnClick,
		desc1Info,
		isError,
		icon,
		isRejected,
	};

	const editToolType = toolMessage.name === "edit_file" ? "diff" : "rewrite";
	if (
		toolMessage.type === "running_now" ||
		toolMessage.type === "tool_request"
	) {
		componentParams.children = (
			<ToolChildrenWrapper className="bg-void-bg-3">
				<EditToolChildren uri={params.uri} code={content} type={editToolType} />
			</ToolChildrenWrapper>
		);
		// JumpToFileButton removed in favor of FileLinkText
	} else if (
		toolMessage.type === "success" ||
		toolMessage.type === "rejected" ||
		toolMessage.type === "tool_error"
	) {
		// add apply box
		const applyBoxId = getApplyBoxId({
			threadId: threadId,
			messageIdx: messageIdx,
			tokenIdx: "N/A",
		});
		componentParams.desc2 = (
			<EditToolHeaderButtons
				applyBoxId={applyBoxId}
				uri={params.uri}
				codeStr={content}
				toolName={name}
				threadId={threadId}
			/>
		);

		// add children
		componentParams.children = (
			<ToolChildrenWrapper className="bg-void-bg-3">
				<EditToolChildren uri={params.uri} code={content} type={editToolType} />
			</ToolChildrenWrapper>
		);

		if (toolMessage.type === "success" || toolMessage.type === "rejected") {
			const { result } = toolMessage;
			componentParams.bottomChildren = (
				<BottomChildren title="Lint errors">
					{result?.lintErrors?.map((error, i) => (
						<div key={i} className="whitespace-nowrap">
							Lines {error.startLineNumber}-{error.endLineNumber}:{" "}
							{error.message}
						</div>
					))}
				</BottomChildren>
			);
		} else if (toolMessage.type === "tool_error") {
			// error
			const { result } = toolMessage;
			componentParams.bottomChildren = (
				<BottomChildren title="Error">
					<CodeChildren>{result}</CodeChildren>
				</BottomChildren>
			);
		}
	}

	return <ToolHeaderWrapper {...componentParams} />;
};

// SimplifiedToolHeader is now imported from ./tool-renderers/

const UserMessageComponent = ({
	chatMessage,
	messageIdx,
	isCheckpointGhost,
	currCheckpointIdx,
	_scrollToBottom,
}: {
	chatMessage: ChatMessage & { role: "user" };
	messageIdx: number;
	currCheckpointIdx: number | undefined;
	isCheckpointGhost: boolean;
	_scrollToBottom: (() => void) | null;
}) => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get("IChatThreadService");

	// global state
	let isBeingEdited = false;
	let stagingSelections: StagingSelectionItem[] = [];
	let setIsBeingEdited = (_: boolean) => {};
	let setStagingSelections = (_: StagingSelectionItem[]) => {};

	if (messageIdx !== undefined) {
		const _state = chatThreadsService.getCurrentMessageState(messageIdx);
		isBeingEdited = _state.isBeingEdited;
		stagingSelections = _state.stagingSelections;
		setIsBeingEdited = (v) =>
			chatThreadsService.setCurrentMessageState(messageIdx, {
				isBeingEdited: v,
			});
		setStagingSelections = (s) =>
			chatThreadsService.setCurrentMessageState(messageIdx, {
				stagingSelections: s,
			});
	}

	// local state
	const mode: ChatBubbleMode = isBeingEdited ? "edit" : "display";
	const [isFocused, setIsFocused] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isDisabled, setIsDisabled] = useState(false);
	const [textAreaRefState, setTextAreaRef] =
		useState<HTMLTextAreaElement | null>(null);
	const textAreaFnsRef = useRef<TextAreaFns | null>(null);
	// initialize on first render, and when edit was just enabled
	const _mustInitialize = useRef(true);
	const _justEnabledEdit = useRef(false);
	useEffect(() => {
		const canInitialize = mode === "edit" && textAreaRefState;
		const shouldInitialize =
			_justEnabledEdit.current || _mustInitialize.current;
		if (canInitialize && shouldInitialize) {
			setStagingSelections(
				(chatMessage.selections || []).map((s) => {
					// quick hack so we dont have to do anything more
					if (s.type === "File")
						return {
							...s,
							state: { ...s.state, wasAddedAsCurrentFile: false },
						};
					else return s;
				})
			);

			if (textAreaFnsRef.current)
				textAreaFnsRef.current.setValue(chatMessage.displayContent || "");

			textAreaRefState.focus();

			_justEnabledEdit.current = false;
			_mustInitialize.current = false;
		}
	}, [
		chatMessage,
		mode,
		_justEnabledEdit,
		textAreaRefState,
		textAreaFnsRef.current,
		_justEnabledEdit.current,
		_mustInitialize.current,
	]);

	const onOpenEdit = () => {
		setIsBeingEdited(true);
		chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
		_justEnabledEdit.current = true;
	};
	const onCloseEdit = () => {
		setIsFocused(false);
		setIsHovered(false);
		setIsBeingEdited(false);
		chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);
	};

	const EditSymbol = mode === "display" ? Pencil : X;

	const handleCopyMessage = () => {
		navigator.clipboard.writeText(chatMessage.displayContent || "");
	};

	const handleRegenerateFrom = async () => {
		const threadId = chatThreadsService.state.currentThreadId;
		await chatThreadsService.abortRunning(threadId);
		// Re-send the user message to regenerate the response
		await chatThreadsService.editUserMessageAndStreamResponse({
			userMessage: chatMessage.content,
			messageIdx,
			threadId,
		});
	};

	let chatbubbleContents: React.ReactNode;
	if (mode === "display") {
		chatbubbleContents = (
			<>
				<SelectedFiles
					type="past"
					messageIdx={messageIdx}
					selections={chatMessage.selections || []}
				/>
				<span className="px-0.5">{chatMessage.displayContent}</span>
			</>
		);
	} else if (mode === "edit") {
		const onSubmit = async () => {
			if (isDisabled) return;
			if (!textAreaRefState) return;
			if (messageIdx === undefined) return;

			// cancel any streams on this thread
			const threadId = chatThreadsService.state.currentThreadId;

			await chatThreadsService.abortRunning(threadId);

			// update state
			setIsBeingEdited(false);
			chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);

			// stream the edit
			const userMessage = textAreaRefState.value;
			try {
				await chatThreadsService.editUserMessageAndStreamResponse({
					userMessage,
					messageIdx,
					threadId,
				});
			} catch (e) {
				console.error("Error while editing message:", e);
			}
			await chatThreadsService.focusCurrentChat();
			requestAnimationFrame(() => _scrollToBottom?.());
		};

		const onAbort = async () => {
			const threadId = chatThreadsService.state.currentThreadId;
			await chatThreadsService.abortRunning(threadId);
		};

		const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Escape") {
				onCloseEdit();
			}
			if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
				onSubmit();
			}
		};

		if (!chatMessage.content) {
			// don't show if empty and not loading (if loading, want to show).
			return null;
		}

		chatbubbleContents = (
			<VoidChatArea
				featureName="Chat"
				onSubmit={onSubmit}
				onAbort={onAbort}
				isStreaming={false}
				isDisabled={isDisabled}
				showSelections={true}
				showProspectiveSelections={false}
				selections={stagingSelections}
				setSelections={setStagingSelections}
			>
				<VoidInputBox2
					enableAtToMention
					ref={setTextAreaRef}
					className="min-h-[81px] max-h-[500px] px-0.5"
					placeholder="Edit your message..."
					onChangeText={(text) => setIsDisabled(!text)}
					onFocus={() => {
						setIsFocused(true);
						chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
					}}
					onBlur={() => {
						setIsFocused(false);
					}}
					onKeyDown={onKeyDown}
					fnsRef={textAreaFnsRef}
					multiline={true}
				/>
			</VoidChatArea>
		);
	}

	const isMsgAfterCheckpoint =
		currCheckpointIdx !== undefined && currCheckpointIdx === messageIdx - 1;

	return (
		<div
			// align chatbubble accoridng to role
			className={`
        relative ml-auto group
        ${
					mode === "edit"
						? "w-full max-w-full"
						: mode === "display"
						? `self-end w-fit max-w-full whitespace-pre-wrap`
						: "" // user words should be pre
				}

        ${
					isCheckpointGhost && !isMsgAfterCheckpoint
						? "opacity-50 pointer-events-none"
						: ""
				}
    `}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{mode === "display" && (
				<MessageActions
					message={chatMessage}
					messageIdx={messageIdx}
					onCopy={handleCopyMessage}
					onEdit={onOpenEdit}
					onRegenerate={handleRegenerateFrom}
					showEdit={true}
					showRegenerate={true}
					showDelete={false}
				/>
			)}
			<div
				// style chatbubble according to role
				className={`
            text-left rounded-lg max-w-full
            ${
							mode === "edit"
								? ""
								: mode === "display"
								? "p-2 flex flex-col bg-void-bg-1 text-void-fg-1 overflow-x-auto cursor-pointer"
								: ""
						}
        `}
				onClick={() => {
					if (mode === "display") {
						onOpenEdit();
					}
				}}
			>
				{chatbubbleContents}
			</div>

			<div
				className="absolute -top-1 -right-1 translate-x-0 -translate-y-0 z-1"
				// data-tooltip-id='void-tooltip'
				// data-tooltip-content='Edit message'
				// data-tooltip-place='left'
			>
				<EditSymbol
					size={18}
					className={`
                    cursor-pointer
                    p-[2px]
                    bg-void-bg-1 border border-void-border-1 rounded-md
                    transition-opacity duration-200 ease-in-out
                    ${
											isHovered || (isFocused && mode === "edit")
												? "opacity-100"
												: "opacity-0"
										}
                `}
					onClick={() => {
						if (mode === "display") {
							onOpenEdit();
						} else if (mode === "edit") {
							onCloseEdit();
						}
					}}
				/>
			</div>
		</div>
	);
};

// SmallProseWrapper and ProseWrapper are now imported from ./tool-renderers/

const AssistantMessageComponent = ({
	chatMessage,
	isCheckpointGhost,
	isCommitted,
	messageIdx,
}: {
	chatMessage: ChatMessage & { role: "assistant" };
	isCheckpointGhost: boolean;
	messageIdx: number;
	isCommitted: boolean;
}) => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get("IChatThreadService");

	const reasoningStr = chatMessage.reasoning?.trim() || null;
	const hasReasoning = !!reasoningStr;
	const isDoneReasoning = !!chatMessage.displayContent;
	const thread = chatThreadsService.getCurrentThread();

	const chatMessageLocation: ChatMessageLocation = {
		threadId: thread.id,
		messageIdx: messageIdx,
	};

	const isEmpty = !chatMessage.displayContent && !chatMessage.reasoning;
	if (isEmpty) return null;

	const handleCopyMessage = () => {
		const textToCopy = [reasoningStr, chatMessage.displayContent]
			.filter(Boolean)
			.join("\n\n");
		navigator.clipboard.writeText(textToCopy);
	};

	const handleRegenerateFrom = async () => {
		const threadId = chatThreadsService.state.currentThreadId;
		await chatThreadsService.abortRunning(threadId);
		// Find the previous user message to regenerate from
		const thread = chatThreadsService.getCurrentThread();
		let userMessageIdx = messageIdx - 1;
		while (
			userMessageIdx >= 0 &&
			thread.messages[userMessageIdx].role !== "user"
		) {
			userMessageIdx--;
		}
		if (userMessageIdx >= 0) {
			const userMessage = thread.messages[userMessageIdx];
			if (userMessage.role === "user") {
				await chatThreadsService.editUserMessageAndStreamResponse({
					userMessage: userMessage.content,
					messageIdx: userMessageIdx,
					threadId,
				});
			}
		}
	};

	return (
		<div className="relative group">
			<MessageActions
				message={chatMessage}
				messageIdx={messageIdx}
				onCopy={handleCopyMessage}
				onRegenerate={handleRegenerateFrom}
				showEdit={false}
				showRegenerate={true}
				showDelete={false}
			/>
			{/* reasoning token */}
			{hasReasoning && (
				<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
					<ReasoningWrapper
						isDoneReasoning={isDoneReasoning}
						isStreaming={!isCommitted}
					>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={reasoningStr}
								chatMessageLocation={chatMessageLocation}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ReasoningWrapper>
				</div>
			)}

			{/* assistant message */}
			{chatMessage.displayContent && (
				<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
					<ProseWrapper>
						<ChatMarkdownRender
							string={chatMessage.displayContent || ""}
							chatMessageLocation={chatMessageLocation}
							isApplyEnabled={true}
							isLinkDetectionEnabled={true}
						/>
					</ProseWrapper>
				</div>
			)}
		</div>
	);
};

const ReasoningWrapper = ({
	isDoneReasoning,
	isStreaming,
	children,
}: {
	isDoneReasoning: boolean;
	isStreaming: boolean;
	children: React.ReactNode;
}) => {
	const isDone = isDoneReasoning || !isStreaming;
	const isWriting = !isDone;
	const [isOpen, setIsOpen] = useState(isWriting);
	useEffect(() => {
		if (!isWriting) setIsOpen(false); // if just finished reasoning, close
	}, [isWriting]);
	return (
		<ToolHeaderWrapper
			title="Reasoning"
			desc1={isWriting ? <IconLoading /> : ""}
			isOpen={isOpen}
			onClick={() => setIsOpen((v) => !v)}
		>
			<ToolChildrenWrapper>
				<div className="!select-text cursor-auto">{children}</div>
			</ToolChildrenWrapper>
		</ToolHeaderWrapper>
	);
};

// should either be past or "-ing" tense, not present tense. Eg. when the LLM searches for something, the user expects it to say "I searched for X" or "I am searching for X". Not "I search X".

// Title helpers (loadingTitleWrapper, titleOfBuiltinToolName, getTitle, toolNameToDesc) are now imported from ./tool-renderers/

const ToolRequestAcceptRejectButtons = ({
	toolName,
}: {
	toolName: ToolName;
}) => {
	const accessor = useAccessor();
	const chatThreadsService = accessor.get("IChatThreadService");
	const metricsService = accessor.get("IMetricsService");
	const voidSettingsService = accessor.get("IVoidSettingsService");
	const voidSettingsState = useSettingsState();

	const onAccept = useCallback(() => {
		try {
			// this doesn't need to be wrapped in try/catch anymore
			const threadId = chatThreadsService.state.currentThreadId;
			chatThreadsService.approveLatestToolRequest(threadId);
			metricsService.capture("Tool Request Accepted", {});
		} catch (e) {
			console.error("Error while approving message in chat:", e);
		}
	}, [chatThreadsService, metricsService]);

	const onReject = useCallback(() => {
		try {
			const threadId = chatThreadsService.state.currentThreadId;
			chatThreadsService.rejectLatestToolRequest(threadId);
		} catch (e) {
			console.error("Error while approving message in chat:", e);
		}
		metricsService.capture("Tool Request Rejected", {});
	}, [chatThreadsService, metricsService]);

	const approveButton = (
		<button
			onClick={onAccept}
			className={`
                px-2 py-1
                bg-[var(--vscode-button-background)]
                text-[var(--vscode-button-foreground)]
                hover:bg-[var(--vscode-button-hoverBackground)]
                rounded
                text-sm font-medium
            `}
		>
			Approve
		</button>
	);

	const cancelButton = (
		<button
			onClick={onReject}
			className={`
                px-2 py-1
                bg-[var(--vscode-button-secondaryBackground)]
                text-[var(--vscode-button-secondaryForeground)]
                hover:bg-[var(--vscode-button-secondaryHoverBackground)]
                rounded
                text-sm font-medium
            `}
		>
			Cancel
		</button>
	);

	const approvalType = isABuiltinToolName(toolName)
		? approvalTypeOfBuiltinToolName[toolName]
		: "MCP tools";
	const approvalToggle = approvalType ? (
		<div key={approvalType} className="flex items-center ml-2 gap-x-1">
			<ToolApprovalTypeSwitch
				size="xs"
				approvalType={approvalType}
				desc={`Auto-approve ${approvalType}`}
			/>
		</div>
	) : null;

	return (
		<div className="flex gap-2 mx-0.5 items-center">
			{approveButton}
			{cancelButton}
			{approvalToggle}
		</div>
	);
};

// ToolChildrenWrapper, CodeChildren, and ListableToolItem are now imported from ./tool-renderers/
// Re-export for backward compatibility
export { CodeChildren, getBasename, getRelative, ListableToolItem, ToolChildrenWrapper } from "./tool-renderers/index.js";

const EditToolChildren = ({
	uri,
	code,
	type,
}: {
	uri: URI | undefined;
	code: string;
	type: "diff" | "rewrite";
}) => {
	const content =
		type === "diff" ? (
			<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
		) : (
			<ChatMarkdownRender
				string={`\`\`\`\n${code}\n\`\`\``}
				codeURI={uri}
				chatMessageLocation={undefined}
			/>
		);

	return (
		<div className="!select-text cursor-auto">
			<SmallProseWrapper>{content}</SmallProseWrapper>
		</div>
	);
};

const LintErrorChildren = ({ lintErrors }: { lintErrors: LintErrorItem[] }) => {
	return (
		<div className="text-xs text-void-fg-4 opacity-80 border-l-2 border-void-warning px-2 py-0.5 flex flex-col gap-0.5 overflow-x-auto whitespace-nowrap">
			{lintErrors.map((error, i) => (
				<div key={i}>
					Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}
				</div>
			))}
		</div>
	);
};

// BottomChildren is now imported from ./tool-renderers/

const EditToolHeaderButtons = ({
	applyBoxId,
	uri,
	codeStr,
	toolName,
	threadId,
}: {
	threadId: string;
	applyBoxId: string;
	uri: URI;
	codeStr: string;
	toolName: "edit_file" | "rewrite_file";
}) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri });
	return (
		<div className="flex items-center gap-1">
			{/* <StatusIndicatorForApplyButton applyBoxId={applyBoxId} uri={uri} /> */}
			{/* <JumpToFileButton uri={uri} /> */}
			{streamState === "idle-no-changes" && (
				<CopyButton codeStr={codeStr} toolTipName="Copy" />
			)}
			<EditToolAcceptRejectButtonsHTML
				type={toolName}
				codeStr={codeStr}
				applyBoxId={applyBoxId}
				uri={uri}
				threadId={threadId}
			/>
		</div>
	);
};

const InvalidTool = ({
	toolName,
	message,
	mcpServerName,
}: {
	toolName: ToolName;
	message: string;
	mcpServerName: string | undefined;
}) => {
	const accessor = useAccessor();
	const title = getTitle({
		name: toolName,
		type: "invalid_params",
		mcpServerName,
	});
	const desc1 = "Invalid parameters";
	const icon = null;
	const isError = true;
	const componentParams: ToolHeaderParams = { title, desc1, isError, icon };

	componentParams.children = (
		<ToolChildrenWrapper>
			<CodeChildren className="bg-void-bg-3">{message}</CodeChildren>
		</ToolChildrenWrapper>
	);
	return <ToolHeaderWrapper {...componentParams} />;
};

const CanceledTool = ({
	toolName,
	mcpServerName,
}: {
	toolName: ToolName;
	mcpServerName: string | undefined;
}) => {
	const accessor = useAccessor();
	const title = getTitle({ name: toolName, type: "rejected", mcpServerName });
	const desc1 = "";
	const icon = null;
	const isRejected = true;
	const componentParams: ToolHeaderParams = { title, desc1, icon, isRejected };
	return <ToolHeaderWrapper {...componentParams} />;
};

const CommandTool = ({
	toolMessage,
	type,
	threadId,
}: { threadId: string } & (
	| {
			toolMessage: Exclude<
				ToolMessage<"run_command">,
				{ type: "invalid_params" }
			>;
			type: "run_command";
	  }
	| {
			toolMessage: Exclude<
				ToolMessage<"run_persistent_command">,
				{ type: "invalid_params" }
			>;
			type: "run_persistent_command";
	  }
)) => {
	const accessor = useAccessor();

	const commandService = accessor.get("ICommandService");
	const terminalToolsService = accessor.get("ITerminalToolService");
	const toolsService = accessor.get("IToolsService");
	const isError = false;
	const title = getTitle(toolMessage);
	const { desc1, desc1Info } = toolNameToDesc(
		toolMessage.name,
		toolMessage.params,
		accessor
	);
	const icon = null;
	const streamState = useChatThreadsStreamState(threadId);

	const divRef = useRef<HTMLDivElement | null>(null);

	const isRejected = toolMessage.type === "rejected";
	const { rawParams, params } = toolMessage;
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		desc1Info,
		isError,
		icon,
		isRejected,
	};

	const effect = async () => {
		if (streamState?.isRunning !== "tool") return;
		if (type !== "run_command" || toolMessage.type !== "running_now") return;

		// wait for the interruptor so we know it's running

		await streamState?.interrupt;
		const container = divRef.current;
		if (!container) return;

		const terminal = terminalToolsService.getTemporaryTerminal(
			toolMessage.params.terminalId
		);
		if (!terminal) return;

		try {
			terminal.attachToElement(container);
			terminal.setVisible(true);
		} catch {}

		// Listen for size changes of the container and keep the terminal layout in sync.
		const resizeObserver = new ResizeObserver((entries) => {
			const height = entries[0].borderBoxSize[0].blockSize;
			const width = entries[0].borderBoxSize[0].inlineSize;
			if (typeof terminal.layout === "function") {
				terminal.layout({ width, height });
			}
		});

		resizeObserver.observe(container);
		return () => {
			terminal.detachFromElement();
			resizeObserver?.disconnect();
		};
	};

	useEffect(() => {
		effect();
	}, [terminalToolsService, toolMessage, toolMessage.type, type]);

	if (toolMessage.type === "success") {
		const { result } = toolMessage;

		// it's unclear that this is a button and not an icon.
		// componentParams.desc2 = <JumpToTerminalButton
		// 	onClick={() => { terminalToolsService.openTerminal(terminalId) }}
		// />

		let msg: string;
		// Terminal functionality disabled - toolsService methods commented out
		// if (type === 'run_command') msg = toolsService.stringOfResult['run_command'](toolMessage.params, result)
		// else msg = toolsService.stringOfResult['run_persistent_command'](toolMessage.params, result)
		msg = "Terminal functionality disabled";

		if (type === "run_persistent_command") {
			// componentParams.info = persistentTerminalNameOfId(toolMessage.params.persistentTerminalId) // Terminal functionality disabled
		}

		componentParams.children = (
			<ToolChildrenWrapper className="whitespace-pre text-nowrap overflow-auto text-sm">
				<div className="!select-text cursor-auto">
					<BlockCode initValue={`${msg.trim()}`} language="shellscript" />
				</div>
			</ToolChildrenWrapper>
		);
	} else if (toolMessage.type === "tool_error") {
		const { result } = toolMessage;
		componentParams.bottomChildren = (
			<BottomChildren title="Error">
				<CodeChildren>{result}</CodeChildren>
			</BottomChildren>
		);
	} else if (toolMessage.type === "running_now") {
		if (type === "run_command")
			componentParams.children = (
				<div ref={divRef} className="relative h-[300px] text-sm" />
			);
	} else if (
		toolMessage.type === "rejected" ||
		toolMessage.type === "tool_request"
	) {
	}

	return (
		<>
			<ToolHeaderWrapper
				{...componentParams}
				isOpen={
					type === "run_command" && toolMessage.type === "running_now"
						? true
						: undefined
				}
			/>
		</>
	);
};

type WrapperProps<T extends ToolName> = {
	toolMessage: Exclude<ToolMessage<T>, { type: "invalid_params" }>;
	messageIdx: number;
	threadId: string;
};
const MCPToolWrapper = ({ toolMessage }: WrapperProps<string>) => {
	const accessor = useAccessor();
	const mcpService = accessor.get("IMCPService");

	const title = getTitle(toolMessage);
	const desc1 = removeMCPToolNamePrefix(toolMessage.name);
	const icon = null;

	if (toolMessage.type === "running_now") return null; // do not show running

	const isError = false;
	const isRejected = toolMessage.type === "rejected";
	const { rawParams, params } = toolMessage;
	const componentParams: ToolHeaderParams = {
		title,
		desc1,
		isError,
		icon,
		isRejected,
	};

	const paramsStr = JSON.stringify(params, null, 2);
	componentParams.desc2 = (
		<CopyButton codeStr={paramsStr} toolTipName={`Copy inputs: ${paramsStr}`} />
	);

	componentParams.info = !toolMessage.mcpServerName
		? "MCP tool not found"
		: undefined;

	// Add copy inputs button in desc2

	if (toolMessage.type === "success" || toolMessage.type === "tool_request") {
		const { result } = toolMessage;
		const resultStr = result ? mcpService.stringifyResult(result) : "null";
		componentParams.children = (
			<ToolChildrenWrapper>
				<SmallProseWrapper>
					<ChatMarkdownRender
						string={`\`\`\`json\n${resultStr}\n\`\`\``}
						chatMessageLocation={undefined}
						isApplyEnabled={false}
						isLinkDetectionEnabled={true}
					/>
				</SmallProseWrapper>
			</ToolChildrenWrapper>
		);
	} else if (toolMessage.type === "tool_error") {
		const { result } = toolMessage;
		componentParams.bottomChildren = (
			<BottomChildren title="Error">
				<CodeChildren>{result}</CodeChildren>
			</BottomChildren>
		);
	}

	return <ToolHeaderWrapper {...componentParams} />;
};

type ResultWrapper<T extends ToolName> = (
	props: WrapperProps<T>
) => React.ReactNode;

const builtinToolNameToComponent: {
	[T in BuiltinToolName]: { resultWrapper: ResultWrapper<T> };
} = {
	read_file: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");

			const title = getTitle(toolMessage);

			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			let range: [number, number] | undefined = undefined;
			if (
				toolMessage.params.startLine !== null ||
				toolMessage.params.endLine !== null
			) {
				const start =
					toolMessage.params.startLine === null
						? `1`
						: `${toolMessage.params.startLine}`;
				const end =
					toolMessage.params.endLine === null
						? ``
						: `${toolMessage.params.endLine}`;
				const addStr = `(${start}-${end})`;
				componentParams.desc1 += ` ${addStr}`;
				range = [params.startLine || 1, params.endLine || 1];
			}

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor, range);
				};
				if (result.hasNextPage && params.pageNumber === 1)
					// first page
					componentParams.desc2 = `(truncated after ${
						Math.round(MAX_FILE_CHARS_PAGE) / 1000
					}k)`;
				else if (params.pageNumber > 1)
					// subsequent pages
					componentParams.desc2 = `(part ${params.pageNumber})`;
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	get_dir_tree: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");

			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.uri) {
				const rel = getRelative(params.uri, accessor);
				if (rel) componentParams.info = `Only search in ${rel}`;
			}

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={`\`\`\`\n${result.str}\n\`\`\``}
								chatMessageLocation={undefined}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	ls_dir: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const explorerService = accessor.get("IExplorerService");
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.uri) {
				const rel = getRelative(params.uri, accessor);
				if (rel) componentParams.info = `Only search in ${rel}`;
			}

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.numResults = result.children?.length;
				componentParams.hasNextPage = result.hasNextPage;
				componentParams.children =
					!result.children ||
					(result.children.length ?? 0) === 0 ? undefined : (
						<ToolChildrenWrapper>
							{result.children.map((child, i) => (
								<ListableToolItem
									key={i}
									name={`${child.name}${child.isDirectory ? "/" : ""}`}
									className="w-full overflow-auto"
									onClick={() => {
										voidOpenFileFn(child.uri, accessor);
										// commandService.executeCommand('workbench.view.explorer'); // open in explorer folders view instead
										// explorerService.select(child.uri, true);
									}}
								/>
							))}
							{result.hasNextPage && (
								<ListableToolItem
									name={`Results truncated (${result.itemsRemaining} remaining).`}
									isSmall={true}
									className="w-full overflow-auto"
								/>
							)}
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	search_pathnames_only: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.includePattern) {
				componentParams.info = `Only search in ${params.includePattern}`;
			}

			if (toolMessage.type === "success") {
				const { result, rawParams } = toolMessage;
				componentParams.numResults = result.uris.length;
				componentParams.hasNextPage = result.hasNextPage;
				componentParams.children =
					result.uris.length === 0 ? undefined : (
						<ToolChildrenWrapper>
							{result.uris.map((uri, i) => (
								<ListableToolItem
									key={i}
									name={getBasename(uri.fsPath)}
									className="w-full overflow-auto"
									onClick={() => {
										voidOpenFileFn(uri, accessor);
									}}
								/>
							))}
							{result.hasNextPage && (
								<ListableToolItem
									name={"Results truncated."}
									isSmall={true}
									className="w-full overflow-auto"
								/>
							)}
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	search_for_files: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (params.searchInFolder || params.isRegex) {
				let info: string[] = [];
				if (params.searchInFolder) {
					const rel = getRelative(params.searchInFolder, accessor);
					if (rel) info.push(`Only search in ${rel}`);
				}
				if (params.isRegex) {
					info.push(`Uses regex search`);
				}
				componentParams.info = info.join("; ");
			}

			if (toolMessage.type === "success") {
				const { result, rawParams } = toolMessage;
				componentParams.numResults = result.uris.length;
				componentParams.hasNextPage = result.hasNextPage;
				componentParams.children =
					result.uris.length === 0 ? undefined : (
						<ToolChildrenWrapper>
							{result.uris.map((uri, i) => (
								<ListableToolItem
									key={i}
									name={getBasename(uri.fsPath)}
									className="w-full overflow-auto"
									onClick={() => {
										voidOpenFileFn(uri, accessor);
									}}
								/>
							))}
							{result.hasNextPage && (
								<ListableToolItem
									name={`Results truncated.`}
									isSmall={true}
									className="w-full overflow-auto"
								/>
							)}
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}
			return <ToolHeaderWrapper {...componentParams} />;
		},
	},

	search_in_file: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const toolsService = accessor.get("IToolsService");
			const title = getTitle(toolMessage);
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			const infoarr: string[] = [];
			const uriStr = getRelative(params.uri, accessor);
			if (uriStr) infoarr.push(uriStr);
			if (params.isRegex) infoarr.push("Uses regex search");
			componentParams.info = infoarr.join("; ");

			if (toolMessage.type === "success") {
				const { result } = toolMessage; // result is array of snippets
				componentParams.numResults = result.lines.length;
				componentParams.children =
					result.lines.length === 0 ? undefined : (
						<ToolChildrenWrapper>
							<CodeChildren className="bg-void-bg-3">
								<pre className="font-mono whitespace-pre">
									{toolsService.stringOfResult["search_in_file"](
										params,
										result
									)}
								</pre>
							</CodeChildren>
						</ToolChildrenWrapper>
					);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},

	read_lint_errors: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");

			const title = getTitle(toolMessage);

			const { uri } = toolMessage.params ?? {};
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			componentParams.info = getRelative(uri, accessor); // full path

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
				if (result.lintErrors)
					componentParams.children = (
						<LintErrorChildren lintErrors={result.lintErrors} />
					);
				else componentParams.children = `No lint errors found.`;
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				// JumpToFileButton removed in favor of FileLinkText
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},

	// ---

	create_file_or_folder: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			componentParams.info = getRelative(params.uri, accessor); // full path

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "rejected") {
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				if (params) {
					componentParams.onClick = () => {
						voidOpenFileFn(params.uri, accessor);
					};
				}
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			} else if (toolMessage.type === "running_now") {
				// nothing more is needed
			} else if (toolMessage.type === "tool_request") {
				// nothing more is needed
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	delete_file_or_folder: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const isFolder = toolMessage.params?.isFolder ?? false;
			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			componentParams.info = getRelative(params.uri, accessor); // full path

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "rejected") {
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				if (params) {
					componentParams.onClick = () => {
						voidOpenFileFn(params.uri, accessor);
					};
				}
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			} else if (toolMessage.type === "running_now") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			} else if (toolMessage.type === "tool_request") {
				const { result } = toolMessage;
				componentParams.onClick = () => {
					voidOpenFileFn(params.uri, accessor);
				};
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	rewrite_file: {
		resultWrapper: (params) => {
			return (
				<EditTool {...params} content={params.toolMessage.params.newContent} />
			);
		},
	},
	edit_file: {
		resultWrapper: (params) => {
			return (
				<EditTool
					{...params}
					content={params.toolMessage.params.searchReplaceBlocks}
				/>
			);
		},
	},

	// ---

	run_command: {
		resultWrapper: (params) => {
			return <CommandTool {...params} type="run_command" />;
		},
	}, // Terminal functionality disabled

	run_persistent_command: {
		resultWrapper: (params) => {
			return <CommandTool {...params} type="run_persistent_command" />;
		},
	}, // Terminal functionality disabled
	open_persistent_terminal: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const terminalToolsService = accessor.get("ITerminalToolService");

			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const title = getTitle(toolMessage);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			const relativePath = params.cwd
				? getRelative(URI.file(params.cwd), accessor)
				: "";
			componentParams.info = relativePath
				? `Running in ${relativePath}`
				: undefined;

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				const { persistentTerminalId } = result;
				// componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId) // Terminal functionality disabled
				componentParams.onClick = () =>
					terminalToolsService.focusPersistentTerminal(persistentTerminalId);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	kill_persistent_terminal: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const commandService = accessor.get("ICommandService");
			const terminalToolsService = accessor.get("ITerminalToolService");

			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const title = getTitle(toolMessage);
			const icon = null;

			if (toolMessage.type === "tool_request") return null; // do not show past requests
			if (toolMessage.type === "running_now") return null; // do not show running

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const { rawParams, params } = toolMessage;
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { persistentTerminalId } = params;
				// componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId) // Terminal functionality disabled
				componentParams.onClick = () =>
					terminalToolsService.focusPersistentTerminal(persistentTerminalId);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	rag_index_document: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.message}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	rag_search_reference: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={result.contextPack}
								chatMessageLocation={undefined}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	rag_search_workspace: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<SmallProseWrapper>
							<ChatMarkdownRender
								string={result.contextPack}
								chatMessageLocation={undefined}
								isApplyEnabled={false}
								isLinkDetectionEnabled={true}
							/>
						</SmallProseWrapper>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	rag_get_stats: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.stats}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	// --- Document editing tool ---
	edit_document: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1, desc1Info } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				desc1Info,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.message || "Document edited successfully"}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	// --- RAG search all tool ---
	rag_search_all: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.contextPack || "No results"}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	// --- Web search tool ---
	web_search: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{JSON.stringify(result, null, 2)}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	// --- Multi link search tool ---
	multi_link_search: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{JSON.stringify(result, null, 2)}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	// --- Timeline tools ---
	timeline_add_event: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{`Event added: ${result.event?.title ?? "Unknown"}`}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	timeline_update_event: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.success ? "Event updated successfully" : "Failed to update event"}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	timeline_delete_event: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.success ? "Event deleted successfully" : "Failed to delete event"}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	timeline_get_events: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.numResults = result.events?.length ?? 0;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{JSON.stringify(result, null, 2)}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	timeline_link_document: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{result.success ? "Document linked to event successfully" : "Failed to link document"}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
	timeline_get_deadlines: {
		resultWrapper: ({ toolMessage }) => {
			const accessor = useAccessor();
			const title = getTitle(toolMessage);
			const { desc1 } = toolNameToDesc(
				toolMessage.name,
				toolMessage.params,
				accessor
			);
			const icon = null;

			if (toolMessage.type === "tool_request") return null;
			if (toolMessage.type === "running_now") return null;

			const isError = false;
			const isRejected = toolMessage.type === "rejected";
			const componentParams: ToolHeaderParams = {
				title,
				desc1,
				isError,
				icon,
				isRejected,
			};

			if (toolMessage.type === "success") {
				const { result } = toolMessage;
				const totalCount = (result.upcoming?.length ?? 0) + (result.overdue?.length ?? 0);
				componentParams.numResults = totalCount;
				componentParams.children = (
					<ToolChildrenWrapper>
						<CodeChildren>{JSON.stringify(result, null, 2)}</CodeChildren>
					</ToolChildrenWrapper>
				);
			} else if (toolMessage.type === "tool_error") {
				const { result } = toolMessage;
				componentParams.bottomChildren = (
					<BottomChildren title="Error">
						<CodeChildren>{result}</CodeChildren>
					</BottomChildren>
				);
			}

			return <ToolHeaderWrapper {...componentParams} />;
		},
	},
};

const Checkpoint = ({
	message,
	threadId,
	messageIdx,
	isCheckpointGhost,
	threadIsRunning,
}: {
	message: CheckpointEntry;
	threadId: string;
	messageIdx: number;
	isCheckpointGhost: boolean;
	threadIsRunning: boolean;
}) => {
	const accessor = useAccessor();
	const chatThreadService = accessor.get("IChatThreadService");
	const streamState = useFullChatThreadsStreamState();

	const isRunning = useChatThreadsStreamState(threadId)?.isRunning;
	const isDisabled = useMemo(() => {
		if (isRunning) return true;
		return !!Object.keys(streamState).find(
			(threadId2) => streamState[threadId2]?.isRunning
		);
	}, [isRunning, streamState]);

	return (
		<div className={`flex items-center justify-center px-2 `}>
			<div
				className={`
                    text-xs
                    text-void-fg-3
                    select-none
                    ${isCheckpointGhost ? "opacity-50" : "opacity-100"}
					${isDisabled ? "cursor-default" : "cursor-pointer"}
                `}
				style={{ position: "relative", display: "inline-block" }} // allow absolute icon
				onClick={() => {
					if (threadIsRunning) return;
					if (isDisabled) return;
					chatThreadService.jumpToCheckpointBeforeMessageIdx({
						threadId,
						messageIdx,
						jumpToUserModified:
							messageIdx ===
							(chatThreadService.state.allThreads[threadId]?.messages.length ??
								0) -
								1,
					});
				}}
				{...(isDisabled
					? {
							"data-tooltip-id": "void-tooltip",
							"data-tooltip-content": `Disabled ${
								isRunning ? "when running" : "because another thread is running"
							}`,
							"data-tooltip-place": "top",
					  }
					: {})}
			>
				Checkpoint
			</div>
		</div>
	);
};

type ChatBubbleMode = "display" | "edit";
type ChatBubbleProps = {
	chatMessage: ChatMessage;
	messageIdx: number;
	isCommitted: boolean;
	chatIsRunning: IsRunningType;
	threadId: string;
	currCheckpointIdx: number | undefined;
	_scrollToBottom: (() => void) | null;
};

const ChatBubble = (props: ChatBubbleProps) => {
	return (
		<ErrorBoundary>
			<_ChatBubble {...props} />
		</ErrorBoundary>
	);
};

const _ChatBubble = ({
	threadId,
	chatMessage,
	currCheckpointIdx,
	isCommitted,
	messageIdx,
	chatIsRunning,
	_scrollToBottom,
}: ChatBubbleProps) => {
	const role = chatMessage.role;

	const isCheckpointGhost =
		messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning; // whether to show as gray (if chat is running, for good measure just dont show any ghosts)

	if (role === "user") {
		return (
			<UserMessageComponent
				chatMessage={chatMessage}
				isCheckpointGhost={isCheckpointGhost}
				currCheckpointIdx={currCheckpointIdx}
				messageIdx={messageIdx}
				_scrollToBottom={_scrollToBottom}
			/>
		);
	} else if (role === "assistant") {
		return (
			<AssistantMessageComponent
				chatMessage={chatMessage}
				isCheckpointGhost={isCheckpointGhost}
				messageIdx={messageIdx}
				isCommitted={isCommitted}
			/>
		);
	} else if (role === "tool") {
		if (chatMessage.type === "invalid_params") {
			return (
				<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
					<InvalidTool
						toolName={chatMessage.name}
						message={chatMessage.content}
						mcpServerName={chatMessage.mcpServerName}
					/>
				</div>
			);
		}

		const toolName = chatMessage.name;
		const isBuiltInTool = isABuiltinToolName(toolName);
		const ToolResultWrapper = isBuiltInTool
			? (builtinToolNameToComponent[toolName]
					?.resultWrapper as ResultWrapper<ToolName>)
			: (MCPToolWrapper as ResultWrapper<ToolName>);

		if (ToolResultWrapper)
			return (
				<>
					<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
						<ToolResultWrapper
							toolMessage={chatMessage}
							messageIdx={messageIdx}
							threadId={threadId}
						/>
					</div>
					{chatMessage.type === "tool_request" ? (
						<div
							className={`${
								isCheckpointGhost ? "opacity-50 pointer-events-none" : ""
							}`}
						>
							<ToolRequestAcceptRejectButtons toolName={chatMessage.name} />
						</div>
					) : null}
				</>
			);
		return null;
	} else if (role === "interrupted_streaming_tool") {
		return (
			<div className={`${isCheckpointGhost ? "opacity-50" : ""}`}>
				<CanceledTool
					toolName={chatMessage.name}
					mcpServerName={chatMessage.mcpServerName}
				/>
			</div>
		);
	} else if (role === "checkpoint") {
		return (
			<Checkpoint
				threadId={threadId}
				message={chatMessage}
				messageIdx={messageIdx}
				isCheckpointGhost={isCheckpointGhost}
				threadIsRunning={!!chatIsRunning}
			/>
		);
	}
};

const CommandBarInChat = () => {
	const { stateOfURI: commandBarStateOfURI, sortedURIs: sortedCommandBarURIs } =
		useCommandBarState();
	const numFilesChanged = sortedCommandBarURIs.length;

	const accessor = useAccessor();
	const editCodeService = accessor.get("IEditCodeService");
	const commandService = accessor.get("ICommandService");
	const chatThreadsState = useChatThreadsState();
	const commandBarState = useCommandBarState();
	const chatThreadsStreamState = useChatThreadsStreamState(
		chatThreadsState.currentThreadId
	);

	// (
	// 	<IconShell1
	// 		Icon={CopyIcon}
	// 		onClick={copyChatToClipboard}
	// 		data-tooltip-id='void-tooltip'
	// 		data-tooltip-place='top'
	// 		data-tooltip-content='Copy chat JSON'
	// 	/>
	// )

	const [fileDetailsOpenedState, setFileDetailsOpenedState] = useState<
		"auto-opened" | "auto-closed" | "user-opened" | "user-closed"
	>("auto-closed");
	const isFileDetailsOpened =
		fileDetailsOpenedState === "auto-opened" ||
		fileDetailsOpenedState === "user-opened";

	useEffect(() => {
		// close the file details if there are no files
		// this converts 'user-closed' to 'auto-closed'
		if (numFilesChanged === 0) {
			setFileDetailsOpenedState("auto-closed");
		}
		// open the file details if it hasnt been closed
		if (numFilesChanged > 0 && fileDetailsOpenedState !== "user-closed") {
			setFileDetailsOpenedState("auto-opened");
		}
	}, [fileDetailsOpenedState, setFileDetailsOpenedState, numFilesChanged]);

	const isFinishedMakingThreadChanges =
		// there are changed files
		commandBarState.sortedURIs.length !== 0 &&
		// none of the files are streaming
		commandBarState.sortedURIs.every(
			(uri) => !commandBarState.stateOfURI[uri.fsPath]?.isStreaming
		);

	// ======== status of agent ========
	// This icon answers the question "is the LLM doing work on this thread?"
	// assume it is single threaded for now
	// green = Running
	// orange = Requires action
	// dark = Done

	const threadStatus =
		chatThreadsStreamState?.isRunning === "awaiting_user"
			? ({ title: "Needs Approval", color: "yellow" } as const)
			: chatThreadsStreamState?.isRunning
			? ({ title: "Running", color: "orange" } as const)
			: ({ title: "Done", color: "dark" } as const);

	const threadStatusHTML = (
		<StatusIndicator
			className="mx-1"
			indicatorColor={threadStatus.color}
			title={threadStatus.title}
		/>
	);

	// ======== info about changes ========
	// num files changed
	// acceptall + rejectall
	// popup info about each change (each with num changes + acceptall + rejectall of their own)

	const numFilesChangedStr =
		numFilesChanged === 0
			? "No files with changes"
			: `${sortedCommandBarURIs.length} file${
					numFilesChanged === 1 ? "" : "s"
			  } with changes`;

	const acceptRejectAllButtons = (
		<div
			// do this with opacity so that the height remains the same at all times
			className={`flex items-center gap-0.5
			${isFinishedMakingThreadChanges ? "" : "opacity-0 pointer-events-none"}`}
		>
			<IconShell1 // RejectAllButtonWrapper
				// text="Reject All"
				// className="text-xs"
				Icon={X}
				onClick={() => {
					sortedCommandBarURIs.forEach((uri) => {
						editCodeService.acceptOrRejectAllDiffAreas({
							uri,
							removeCtrlKs: true,
							behavior: "reject",
							_addToHistory: true,
						});
					});
				}}
				data-tooltip-id="void-tooltip"
				data-tooltip-place="top"
				data-tooltip-content="Reject all"
			/>

			<IconShell1 // AcceptAllButtonWrapper
				// text="Accept All"
				// className="text-xs"
				Icon={Check}
				onClick={() => {
					sortedCommandBarURIs.forEach((uri) => {
						editCodeService.acceptOrRejectAllDiffAreas({
							uri,
							removeCtrlKs: true,
							behavior: "accept",
							_addToHistory: true,
						});
					});
				}}
				data-tooltip-id="void-tooltip"
				data-tooltip-place="top"
				data-tooltip-content="Accept all"
			/>
		</div>
	);

	// !select-text cursor-auto
	const fileDetailsContent = (
		<div className="void-scrollbar px-2 gap-1 w-full overflow-y-auto">
			{sortedCommandBarURIs.map((uri, i) => {
				const basename = getBasename(uri.fsPath);

				const { sortedDiffIds, isStreaming } =
					commandBarStateOfURI[uri.fsPath] ?? {};
				const isFinishedMakingFileChanges = !isStreaming;

				const numDiffs = sortedDiffIds?.length || 0;

				const fileStatus = isFinishedMakingFileChanges
					? ({ title: "Done", color: "dark" } as const)
					: ({ title: "Running", color: "orange" } as const);

				const fileNameHTML = (
					<div
						className="flex items-center gap-1.5 text-void-fg-3 hover:brightness-125 transition-all duration-200 cursor-pointer"
						onClick={() => voidOpenFileFn(uri, accessor)}
					>
						{/* <FileIcon size={14} className="text-void-fg-3" /> */}
						<span className="text-void-fg-3">{basename}</span>
					</div>
				);

				const detailsContent = (
					<div className="flex px-4">
						<span className="text-void-fg-3 opacity-80">
							{numDiffs} diff{numDiffs !== 1 ? "s" : ""}
						</span>
					</div>
				);

				const acceptRejectButtons = (
					<div
						// do this with opacity so that the height remains the same at all times
						className={`flex items-center gap-0.5
					${isFinishedMakingFileChanges ? "" : "opacity-0 pointer-events-none"}
				`}
					>
						{/* <JumpToFileButton
					uri={uri}
					data-tooltip-id='void-tooltip'
					data-tooltip-place='top'
					data-tooltip-content='Go to file'
				/> */}
						<IconShell1 // RejectAllButtonWrapper
							Icon={X}
							onClick={() => {
								editCodeService.acceptOrRejectAllDiffAreas({
									uri,
									removeCtrlKs: true,
									behavior: "reject",
									_addToHistory: true,
								});
							}}
							data-tooltip-id="void-tooltip"
							data-tooltip-place="top"
							data-tooltip-content="Reject file"
						/>
						<IconShell1 // AcceptAllButtonWrapper
							Icon={Check}
							onClick={() => {
								editCodeService.acceptOrRejectAllDiffAreas({
									uri,
									removeCtrlKs: true,
									behavior: "accept",
									_addToHistory: true,
								});
							}}
							data-tooltip-id="void-tooltip"
							data-tooltip-place="top"
							data-tooltip-content="Accept file"
						/>
					</div>
				);

				const fileStatusHTML = (
					<StatusIndicator
						className="mx-1"
						indicatorColor={fileStatus.color}
						title={fileStatus.title}
					/>
				);

				return (
					// name, details
					<div key={i} className="flex justify-between items-center">
						<div className="flex items-center">
							{fileNameHTML}
							{detailsContent}
						</div>
						<div className="flex items-center gap-2">
							{acceptRejectButtons}
							{fileStatusHTML}
						</div>
					</div>
				);
			})}
		</div>
	);

	const fileDetailsButton = (
		<button
			className={`flex items-center gap-1 rounded ${
				numFilesChanged === 0
					? "cursor-pointer"
					: "cursor-pointer hover:brightness-125 transition-all duration-200"
			}`}
			onClick={() =>
				isFileDetailsOpened
					? setFileDetailsOpenedState("user-closed")
					: setFileDetailsOpenedState("user-opened")
			}
			type="button"
			disabled={numFilesChanged === 0}
		>
			<svg
				className="transition-transform duration-200 size-3.5"
				style={{
					transform: isFileDetailsOpened ? "rotate(0deg)" : "rotate(180deg)",
					transition: "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
				}}
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polyline points="18 15 12 9 6 15"></polyline>
			</svg>
			{numFilesChangedStr}
		</button>
	);

	return (
		<>
			{/* file details */}
			<div className="px-2">
				<div
					className={`
						select-none
						flex w-full rounded-t-lg bg-void-bg-3
						text-void-fg-3 text-xs text-nowrap

						overflow-hidden transition-all duration-200 ease-in-out
						${isFileDetailsOpened ? "max-h-24" : "max-h-0"}
					`}
				>
					{fileDetailsContent}
				</div>
			</div>
			{/* main content */}
			<div
				className={`
					select-none
					flex w-full rounded-t-lg bg-void-bg-3
					text-void-fg-3 text-xs text-nowrap
					border-t border-l border-r border-zinc-300/10

					px-2 py-1
					justify-between
				`}
			>
				<div className="flex gap-2 items-center">{fileDetailsButton}</div>
				<div className="flex gap-2 items-center">
					{acceptRejectAllButtons}
					{threadStatusHTML}
				</div>
			</div>
		</>
	);
};

const EditToolSoFar = ({
	toolCallSoFar,
}: {
	toolCallSoFar: RawToolCallObj;
}) => {
	// Guard against MultipleToolCalls - only handle single tool calls
	if (!isSingleToolCall(toolCallSoFar)) return null;
	if (!isABuiltinToolName(toolCallSoFar.name)) return null;

	const accessor = useAccessor();

	const uri = toolCallSoFar.rawParams.uri
		? URI.file(toolCallSoFar.rawParams.uri)
		: undefined;

	const title = titleOfBuiltinToolName[toolCallSoFar.name].proposed;

	const uriDone = toolCallSoFar.doneParams.includes("uri");
	const desc1 = (
		<span className="flex items-center">
			{uriDone
				? getBasename(toolCallSoFar.rawParams["uri"] ?? "unknown")
				: `Generating`}
			<IconLoading />
		</span>
	);

	const desc1OnClick = () => {
		uri && voidOpenFileFn(uri, accessor);
	};

	// If URI has not been specified
	return (
		<ToolHeaderWrapper title={title} desc1={desc1} desc1OnClick={desc1OnClick}>
			<EditToolChildren
				uri={uri}
				code={
					toolCallSoFar.rawParams.search_replace_blocks ??
					toolCallSoFar.rawParams.new_content ??
					""
				}
				type={"rewrite"} // as it streams, show in rewrite format, don't make a diff editor
			/>
			<IconLoading />
		</ToolHeaderWrapper>
	);
};

export const SidebarChat = () => {
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
	const textAreaFnsRef = useRef<TextAreaFns | null>(null);

	const accessor = useAccessor();
	const commandService = accessor.get("ICommandService");
	const chatThreadsService = accessor.get("IChatThreadService");

	const settingsState = useSettingsState();
	// ----- HIGHER STATE -----

	// threads state
	const chatThreadsState = useChatThreadsState();

	const currentThread = chatThreadsService.getCurrentThread();
	const previousMessages = currentThread?.messages ?? [];

	const selections = currentThread.state.stagingSelections;
	const setSelections = (s: StagingSelectionItem[]) => {
		chatThreadsService.setCurrentThreadState({ stagingSelections: s });
	};

	// stream state
	const currThreadStreamState = useChatThreadsStreamState(
		chatThreadsState.currentThreadId
	);
	const isRunning = currThreadStreamState?.isRunning;
	const latestError = currThreadStreamState?.error;
	const { displayContentSoFar, toolCallSoFar, reasoningSoFar } =
		currThreadStreamState?.llmInfo ?? {};

	// this is just if it's currently being generated, NOT if it's currently running
	// Type guard: only single tool calls have isDone property
	const toolIsGenerating = toolCallSoFar && isSingleToolCall(toolCallSoFar) && !toolCallSoFar.isDone; // show loading for slow tools (right now just edit)

	// ----- SIDEBAR CHAT state (local) -----

	// state of current message
	const initVal = "";
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(!initVal);

	const isDisabled =
		instructionsAreEmpty || !!isFeatureNameDisabled("Chat", settingsState);

	const sidebarRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const onSubmit = useCallback(
		async (_forceSubmit?: string) => {
			if (isDisabled && !_forceSubmit) return;
			if (isRunning) return;

			const threadId = chatThreadsService.state.currentThreadId;

			// send message to LLM
			const userMessage = _forceSubmit || textAreaRef.current?.value || "";

			// Handle slash commands
			const trimmedMessage = userMessage.trim().toLowerCase();
			if (trimmedMessage === '/summarize' || trimmedMessage === '/compact') {
				// Summarize the current thread
				const preserveCount = settingsState.globalSettings.contextWindowPreserveRecentMessages ?? 4;
				try {
					await chatThreadsService.summarizeThread(threadId, preserveCount);
				} catch (e) {
					console.error("Error while summarizing thread:", e);
				}
				textAreaFnsRef.current?.setValue("");
				textAreaRef.current?.focus();
				return;
			}

			try {
				await chatThreadsService.addUserMessageAndStreamResponse({
					userMessage,
					threadId,
				});
			} catch (e) {
				console.error("Error while sending message in chat:", e);
			}

			setSelections([]); // clear staging
			textAreaFnsRef.current?.setValue("");
			textAreaRef.current?.focus(); // focus input after submit
		},
		[
			chatThreadsService,
			isDisabled,
			isRunning,
			textAreaRef,
			textAreaFnsRef,
			setSelections,
			settingsState,
		]
	);

	const onAbort = async () => {
		const threadId = currentThread.id;
		await chatThreadsService.abortRunning(threadId);
	};

	const keybindingString = accessor
		.get("IKeybindingService")
		.lookupKeybinding(VOID_CTRL_L_ACTION_ID)
		?.getLabel();

	const threadId = currentThread.id;
	const currCheckpointIdx =
		chatThreadsState.allThreads[threadId]?.state?.currCheckpointIdx ??
		undefined; // if not exist, treat like checkpoint is last message (infinity)

	// resolve mount info
	const isResolved =
		chatThreadsState.allThreads[threadId]?.state.mountedInfo
			?.mountedIsResolvedRef.current;
	useEffect(() => {
		if (isResolved) return;
		chatThreadsState.allThreads[
			threadId
		]?.state.mountedInfo?._whenMountedResolver?.({
			textAreaRef: textAreaRef,
			scrollToBottom: () => scrollToBottom(scrollContainerRef),
		});
	}, [chatThreadsState, threadId, textAreaRef, scrollContainerRef, isResolved]);

	const previousMessagesHTML = useMemo(() => {
		// const lastMessageIdx = previousMessages.findLastIndex(v => v.role !== 'checkpoint')
		// tool request shows up as Editing... if in progress
		return previousMessages.map((message, i) => {
			return (
				<ChatBubble
					key={i}
					currCheckpointIdx={currCheckpointIdx}
					chatMessage={message}
					messageIdx={i}
					isCommitted={true}
					chatIsRunning={isRunning}
					threadId={threadId}
					_scrollToBottom={() => scrollToBottom(scrollContainerRef)}
				/>
			);
		});
	}, [previousMessages, threadId, currCheckpointIdx, isRunning]);

	const streamingChatIdx = previousMessagesHTML.length;
	const currStreamingMessageHTML =
		reasoningSoFar || displayContentSoFar || isRunning ? (
			<ChatBubble
				key={"curr-streaming-msg"}
				currCheckpointIdx={currCheckpointIdx}
				chatMessage={{
					role: "assistant",
					displayContent: displayContentSoFar ?? "",
					reasoning: reasoningSoFar ?? "",
					anthropicReasoning: null,
				}}
				messageIdx={streamingChatIdx}
				isCommitted={false}
				chatIsRunning={isRunning}
				threadId={threadId}
				_scrollToBottom={null}
			/>
		) : null;

	// the tool currently being generated
	// Need to re-check isSingleToolCall because TypeScript doesn't track the boolean
	const generatingTool = toolIsGenerating && toolCallSoFar && isSingleToolCall(toolCallSoFar) ? (
		toolCallSoFar.name === "edit_file" ||
		toolCallSoFar.name === "rewrite_file" ? (
			<EditToolSoFar
				key={"curr-streaming-tool"}
				toolCallSoFar={toolCallSoFar}
			/>
		) : null
	) : null;

	const messagesHTML = (
		<ScrollToBottomContainer
		key={"messages" + chatThreadsState.currentThreadId} // force rerender on all children if id changes
		scrollContainerRef={scrollContainerRef}
		className={`
		flex flex-col
		px-4 py-4 space-y-4
		w-full flex-1 min-h-0
		overflow-x-hidden
		overflow-y-auto
		void-scrollbar
		${previousMessagesHTML.length === 0 && !displayContentSoFar ? "hidden" : ""}
	`}
		>
			{/* previous messages */}
			{previousMessagesHTML}
			{currStreamingMessageHTML}

			{/* Generating tool */}
			{generatingTool}

			{/* loading indicator */}
			{isRunning === "LLM" || (isRunning === "idle" && !toolIsGenerating) ? (
				<ProseWrapper>
					{<IconLoading className="opacity-50 text-sm" />}
				</ProseWrapper>
			) : null}

			{/* error message */}
			{latestError === undefined ? null : (
				<div className="px-2 my-1">
					<ErrorDisplay
						message={latestError.message}
						fullError={latestError.fullError}
						onDismiss={() => {
							chatThreadsService.dismissStreamError(currentThread.id);
						}}
						showDismiss={true}
					/>

					<WarningBox
						className="text-sm my-2 mx-4"
						onClick={() => {
							commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID);
						}}
						text="Open settings"
					/>
				</div>
			)}
		</ScrollToBottomContainer>
	);

	const onChangeText = useCallback(
		(newStr: string) => {
			setInstructionsAreEmpty(!newStr);
		},
		[setInstructionsAreEmpty]
	);
	const onKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
				onSubmit();
			} else if (e.key === "Escape" && isRunning) {
				onAbort();
			}
		},
		[onSubmit, onAbort, isRunning]
	);

	// Handle Ctrl+V paste for images from clipboard using document-level listener
	// This is more reliable than React's synthetic paste event
	const notificationService = accessor.get("INotificationService");
	const selectionsRef = useRef(selections);
	selectionsRef.current = selections; // Keep ref updated

	useEffect(() => {
		const handleDocumentPaste = async (e: ClipboardEvent) => {
			// Only handle paste when our textarea has focus
			if (document.activeElement !== textAreaRef.current) {
				return;
			}

			const items = e.clipboardData?.items;
			if (!items) return;

			// Find image items in clipboard
			const imageItems: DataTransferItem[] = [];
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item.type.startsWith('image/')) {
					imageItems.push(item);
				}
			}

			// If no images found, let the default paste behavior continue (for text)
			if (imageItems.length === 0) return;

			// Prevent default paste behavior since we're handling images
			e.preventDefault();
			e.stopPropagation();

			console.log('[Paste] Found', imageItems.length, 'image(s) in clipboard');

			const newSelections: StagingSelectionItem[] = [];

			for (const item of imageItems) {
				try {
					const file = item.getAsFile();
					if (!file) {
						console.log('[Paste] Could not get file from clipboard item');
						continue;
					}

					console.log('[Paste] Processing file:', file.type, file.size);

					// Determine MIME type
					let mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
					if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
						mimeType = 'image/jpeg';
					} else if (file.type === 'image/gif') {
						mimeType = 'image/gif';
					} else if (file.type === 'image/webp') {
						mimeType = 'image/webp';
					}

					// Check file size (max 20MB for images)
					const MAX_IMAGE_SIZE_MB = 20;
					const sizeInMB = file.size / (1024 * 1024);
					if (sizeInMB > MAX_IMAGE_SIZE_MB) {
						notificationService.warn(`Image too large: ${sizeInMB.toFixed(2)}MB (max ${MAX_IMAGE_SIZE_MB}MB)`);
						continue;
					}

					// Convert to base64
					const base64Data = await new Promise<string>((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => {
							const result = reader.result as string;
							// Remove the data URL prefix (data:image/png;base64,)
							const base64 = result.split(',')[1];
							resolve(base64);
						};
						reader.onerror = reject;
						reader.readAsDataURL(file);
					});

					// Generate a unique URI for the pasted image
					const timestamp = Date.now();
					const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
					const pastedImageUri = URI.parse(`clipboard-image://pasted-${timestamp}.${extension}`);

					// Create the image selection with cached base64 data
					const imageSelection: StagingSelectionItem = {
						type: 'Image',
						uri: pastedImageUri,
						mimeType: mimeType,
						state: {
							wasAddedAsCurrentFile: false,
							base64Data: base64Data // Pre-cached, no need to read from disk
						}
					};

					newSelections.push(imageSelection);
					console.log(`[Paste] Added clipboard image: ${pastedImageUri.toString()} (${sizeInMB.toFixed(2)}MB, ${mimeType})`);

				} catch (err) {
					console.error('Error processing pasted image:', err);
					notificationService.error(`Error processing pasted image: ${err}`);
				}
			}

			// Add the new selections using current ref value
			if (newSelections.length > 0) {
				setSelections([...selectionsRef.current, ...newSelections]);
				notificationService.info(`Added ${newSelections.length} image(s) from clipboard`);
			}
		};

		// Use capture phase to intercept paste before other handlers
		document.addEventListener('paste', handleDocumentPaste, true);

		return () => {
			document.removeEventListener('paste', handleDocumentPaste, true);
		};
	}, [notificationService, setSelections]);

	const inputChatArea = (
		<VoidChatArea
			featureName="Chat"
			onSubmit={() => onSubmit()}
			onAbort={onAbort}
			isStreaming={!!isRunning}
			isDisabled={isDisabled}
			showSelections={true}
			// showProspectiveSelections={previousMessagesHTML.length === 0}
			selections={selections}
			setSelections={setSelections}
			onClickAnywhere={() => {
				textAreaRef.current?.focus();
			}}
		>
			<VoidInputBox2
				enableAtToMention
				className={`min-h-[81px] px-0.5 py-0.5`}
				placeholder={`@ to mention, ${
					keybindingString ? `${keybindingString} to add a selection. ` : ""
				}Enter instructions...`}
				onChangeText={onChangeText}
				onKeyDown={onKeyDown}
				onFocus={() => {
					chatThreadsService.setCurrentlyFocusedMessageIdx(undefined);
				}}
				ref={textAreaRef}
				fnsRef={textAreaFnsRef}
				multiline={true}
			/>
		</VoidChatArea>
	);

	const isLandingPage = previousMessages.length === 0;

	const initiallySuggestedPromptsHTML = (
		<div className="flex flex-col gap-2 w-full text-nowrap text-void-fg-3 select-none">
			{[
				"What are my upcoming deadlines?",
				"Help me draft an appeal letter",
				"Search my case documents for medical findings",
				"Add an event to my timeline",
				"Create a .fileorg.json file for me",
			].map((text, index) => (
				<div
					key={index}
					className="py-1 px-2 rounded text-sm bg-zinc-700/5 hover:bg-zinc-700/10 dark:bg-zinc-300/5 dark:hover:bg-zinc-300/10 cursor-pointer opacity-80 hover:opacity-100"
					onClick={() => onSubmit(text)}
				>
					{text}
				</div>
			))}
		</div>
	);

	// Get model selection for context indicator
	const modelSelection = settingsState.modelSelectionOfFeature?.Chat ?? null;
	const showContextIndicator = settingsState.globalSettings.contextWindowShowIndicator ?? true;

	// Handle summarize click from Context Window Indicator
	const handleSummarizeClick = useCallback(async () => {
		const threadId = chatThreadsService.state.currentThreadId;
		const preserveCount = settingsState.globalSettings.contextWindowPreserveRecentMessages ?? 4;
		try {
			await chatThreadsService.summarizeThread(threadId, preserveCount);
		} catch (e) {
			console.error("Error while summarizing thread:", e);
		}
	}, [chatThreadsService, settingsState]);

	const threadPageInput = (
		<div
			key={"input" + chatThreadsState.currentThreadId}
			className="flex-shrink-0"
		>
			<div className="px-4">
				<CommandBarInChat />
			</div>
			{/* Context Window Indicator */}
			{showContextIndicator && previousMessages.length > 0 && (
				<div className="px-4 py-1">
					<ContextWindowIndicator
						messages={previousMessages}
						providerName={modelSelection?.providerName ?? null}
						modelName={modelSelection?.modelName ?? null}
						overridesOfModel={settingsState.overridesOfModel}
						onSummarizeClick={handleSummarizeClick}
					/>
				</div>
			)}
			<div className="px-2 pb-2">{inputChatArea}</div>
		</div>
	);

	const landingPageInput = (
		<div>
			<div className="pt-8">{inputChatArea}</div>
		</div>
	);

	const landingPageContent = (
		<div
			ref={sidebarRef}
			className="w-full h-full max-h-full flex flex-col overflow-auto px-4"
		>
			<ErrorBoundary>{landingPageInput}</ErrorBoundary>

			{Object.keys(chatThreadsState.allThreads).length > 1 ? ( // show if there are threads
				<ErrorBoundary>
					<div className="pt-8 mb-2 text-void-fg-3 text-root select-none pointer-events-none">
						Previous Threads
					</div>
					<PastThreadsList />
				</ErrorBoundary>
			) : (
				<ErrorBoundary>
					<div className="pt-8 mb-2 text-void-fg-3 text-root select-none pointer-events-none">
						Suggestions
					</div>
					{initiallySuggestedPromptsHTML}
				</ErrorBoundary>
			)}
		</div>
	);

	// const threadPageContent = <div>
	// 	{/* Thread content */}
	// 	<div className='flex flex-col overflow-hidden'>
	// 		<div className={`overflow-hidden ${previousMessages.length === 0 ? 'h-0 max-h-0 pb-2' : ''}`}>
	// 			<ErrorBoundary>
	// 				{messagesHTML}
	// 			</ErrorBoundary>
	// 		</div>
	// 		<ErrorBoundary>
	// 			{inputForm}
	// 		</ErrorBoundary>
	// 	</div>
	// </div>
	const threadPageContent = (
		<div
			ref={sidebarRef}
			className="w-full h-full flex flex-col overflow-hidden"
		>
			<ErrorBoundary>{messagesHTML}</ErrorBoundary>
			<ErrorBoundary>{threadPageInput}</ErrorBoundary>
		</div>
	);

	return (
		<Fragment
			key={threadId} // force rerender when change thread
		>
			{isLandingPage ? landingPageContent : threadPageContent}
		</Fragment>
	);
};
