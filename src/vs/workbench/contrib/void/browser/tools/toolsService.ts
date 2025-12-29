import { timeout } from '../../../../../base/common/async.js'
import { CancellationToken } from '../../../../../base/common/cancellation.js'
import { URI } from '../../../../../base/common/uri.js'
import { generateUuid } from '../../../../../base/common/uuid.js'
import { EndOfLinePreference } from '../../../../../editor/common/model.js'
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js'
import { IFileService } from '../../../../../platform/files/common/files.js'
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js'
import { createDecorator, IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js'
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js'
import { IMarkerService, MarkerSeverity } from '../../../../../platform/markers/common/markers.js'
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../../services/search/common/queryBuilder.js'
import { ISearchService } from '../../../../services/search/common/search.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../../common/directoryStrService.js'
import { IDocumentViewerService } from '../../common/documentViewerService.js'
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from '../../common/prompt/prompts.js'
import { RAGContextService } from '../../common/rag/ragContextService.js'
import { IRAGService } from '../../common/rag/ragService.js'
import { RawToolParamsObj } from '../../common/sendLLMMessageTypes.js'
import { BuiltinToolCallParams, BuiltinToolName, BuiltinToolResultType, LintErrorItem } from '../../common/tools/toolsServiceTypes.js'
import { IVoidModelService } from '../../common/voidModelService.js'
import { IVoidSettingsService } from '../../common/voidSettingsService.js'
import { IVoidCloudService } from '../voidCloudService.js'
import { IDocumentCreatorService } from '../documentCreatorService.js'
import { IDocumentEditorService } from '../documentViewers/documentEditorService.js'
import { IEditCodeService } from '../editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { IVoidCommandBarService } from '../voidCommandBarService.js'
import { EventCategory, ITimelineService } from '../../common/timeline/timelineTypes.js'


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] }
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


// We are NOT checking to make sure in workspace
const validateURI = (uriStr: unknown) => {
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	// Look for :// pattern which indicates a scheme is present
	// Examples of supported URIs:
	// - vscode-remote://wsl+Ubuntu/home/user/file.txt (WSL)
	// - vscode-remote://ssh-remote+myserver/home/user/file.txt (SSH)
	// - file:///home/user/file.txt (local file with scheme)
	// - /home/user/file.txt (local file path, will be converted to file://)
	// - C:\Users\file.txt (Windows local path, will be converted to file://)
	if (uriStr.includes('://')) {
		try {
			const uri = URI.parse(uriStr)
			return uri
		} catch (e) {
			// If parsing fails, it's a malformed URI
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	} else {
		// No scheme present, treat as file path
		// This handles regular file paths like /home/user/file.txt or C:\Users\file.txt
		const uri = URI.file(uriStr)
		return uri
	}
}

const validateOptionalURI = (uriStr: unknown) => {
	if (isFalsy(uriStr)) return null
	return validateURI(uriStr)
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}


const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) return 1
	const parsedInt = Number.parseInt(pageNumberUnknown + '')
	if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`)
	if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`)
	return parsedInt
}

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number')
		return numStr
	if (isFalsy(numStr)) return opts.default

	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '')
		if (!Number.isInteger(parsedInt)) return opts.default
		return parsedInt
	}

	return opts.default
}


const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') {
		return b
	}
	return opts.default
}

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (typeof terminalIdUnknown !== 'string') throw new Error(`Invalid LLM output format: persistentTerminalId must be a string, but its type is "${typeof terminalIdUnknown}".`)
	return terminalIdUnknown
}


const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) return true
	return false
}

const VALID_EVENT_CATEGORIES: EventCategory[] = ['injury', 'medical', 'hearing', 'decision', 'deadline', 'filing', 'correspondence', 'custom']

const validateEventCategory = (category: unknown): EventCategory => {
	if (typeof category !== 'string') throw new Error(`Invalid LLM output: category must be a string.`)
	if (!VALID_EVENT_CATEGORIES.includes(category as EventCategory)) {
		throw new Error(`Invalid LLM output: category must be one of: ${VALID_EVENT_CATEGORIES.join(', ')}. Got: "${category}".`)
	}
	return category as EventCategory
}

const validateOptionalEventCategory = (category: unknown): EventCategory | null => {
	if (isFalsy(category)) return null
	return validateEventCategory(category)
}

const validateStringArray = (arr: unknown): string[] => {
	if (isFalsy(arr)) return []
	if (typeof arr === 'string') {
		try {
			const parsed = JSON.parse(arr)
			if (Array.isArray(parsed)) {
				return parsed.map(item => validateStr('array item', item))
			}
		} catch {
			// If it's a single string, wrap it
			return [arr]
		}
	}
	if (Array.isArray(arr)) {
		return arr.map((item, i) => validateStr(`array[${i}]`, item))
	}
	return []
}

const validateDateString = (dateStr: unknown): string => {
	const str = validateStr('date', dateStr)
	// Try to parse as date to validate
	const date = new Date(str)
	if (isNaN(date.getTime())) {
		throw new Error(`Invalid LLM output: date string "${str}" is not a valid date format. Use ISO 8601 (YYYY-MM-DD or full ISO datetime).`)
	}
	return date.toISOString()
}

const validateOptionalDateString = (dateStr: unknown): string | null => {
	if (isFalsy(dateStr)) return null
	return validateDateString(dateStr)
}

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	private readonly braveSearchChannel: IChannel;

	constructor(
		@IFileService fileService: IFileService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IVoidModelService voidModelService: IVoidModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidCommandBarService private readonly commandBarService: IVoidCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IRAGService private readonly ragService: IRAGService,
		@IVoidCloudService private readonly voidCloudService: IVoidCloudService,
		@IDocumentViewerService private readonly documentViewerService: IDocumentViewerService,
		@IDocumentEditorService private readonly documentEditorService: IDocumentEditorService,
		@IDocumentCreatorService private readonly documentCreatorService: IDocumentCreatorService,
		@IMainProcessService mainProcessService: IMainProcessService,
		@ITimelineService private readonly timelineService: ITimelineService,
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		// Get IPC channel for Brave Search (runs in electron-main to avoid CORS)
		this.braveSearchChannel = mainProcessService.getChannel('void-channel-brave-search');

		this.validateParams = {
			read_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)

				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })

				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null

				return { uri, startLine, endLine, pageNumber }
			},
			ls_dir: (params: RawToolParamsObj) => {
				const { uri: uriStr, page_number: pageNumberUnknown } = params

				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: (params: RawToolParamsObj) => {
				const { uri: uriStr, } = params
				const uri = validateURI(uriStr)
				return { uri }
			},
			search_pathnames_only: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: includeUnknown,
					page_number: pageNumberUnknown
				} = params

				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)

				return { query: queryStr, includePattern, pageNumber }

			},
			search_for_files: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: searchInFolderUnknown,
					is_regex: isRegexUnknown,
					page_number: pageNumberUnknown
				} = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = validateOptionalURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return {
					query: queryStr,
					isRegex,
					searchInFolder,
					pageNumber
				}
			},
			search_in_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = validateURI(uriStr);
				const query = validateStr('query', queryUnknown);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query, isRegex };
			},

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params
				const uri = validateURI(uriUnknown)
				return { uri }
			},

			// ---

			create_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown } = params
				const uri = validateURI(uriUnknown)
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isFolder }
			},

			delete_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params
				const uri = validateURI(uriUnknown)
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false })
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isRecursive, isFolder }
			},

			rewrite_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, new_content: newContentUnknown } = params
				const uri = validateURI(uriStr)
				const newContent = validateStr('newContent', newContentUnknown)
				return { uri, newContent }
			},

			edit_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				const uri = validateURI(uriStr)
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown)
				return { uri, searchReplaceBlocks }
			},

			// ---

			run_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				const terminalId = generateUuid()
				return { command, cwd, terminalId }
			},
			run_persistent_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown);
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown)
				return { command, persistentTerminalId };
			},
			open_persistent_terminal: (params: RawToolParamsObj) => {
				const { cwd: cwdUnknown } = params;
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				// No parameters needed; will open a new background terminal
				return { cwd };
			},
			kill_persistent_terminal: (params: RawToolParamsObj) => {
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},

			// --- RAG tools
			rag_index_document: (params: RawToolParamsObj) => {
				const { uri: uriStr, is_policy_manual: isPolicyManualUnknown } = params;
				const uri = validateURI(uriStr);
				const isPolicyManual = validateBoolean(isPolicyManualUnknown, { default: false });
				return { uri, isPolicyManual };
			},
			rag_search_policy: (params: RawToolParamsObj) => {
				const { query: queryUnknown, limit: limitUnknown } = params;
				const query = validateStr('query', queryUnknown);
				const limit = validateNumber(limitUnknown, { default: 8 }) || 8;  // Increased default for MMR diversity
				return { query, limit };
			},
			rag_search_workspace: (params: RawToolParamsObj) => {
				const { query: queryUnknown, limit: limitUnknown } = params;
				const query = validateStr('query', queryUnknown);
				const limit = validateNumber(limitUnknown, { default: 8 }) || 8;  // Increased default for MMR diversity
				return { query, limit };
			},
			rag_search_all: (params: RawToolParamsObj) => {
				const { query: queryUnknown, limit: limitUnknown } = params;
				const query = validateStr('query', queryUnknown);
				const limit = validateNumber(limitUnknown, { default: 8 }) || 8;
				return { query, limit };
			},
			rag_get_stats: (params: RawToolParamsObj) => {
				return {};
			},

			// --- Web Search tools
			web_search: (params: RawToolParamsObj) => {
				const { query: queryUnknown, count: countUnknown, offset: offsetUnknown } = params;
				const query = validateStr('query', queryUnknown);
				const count = validateNumber(countUnknown, { default: 10 });
				const offset = validateNumber(offsetUnknown, { default: 0 });
				return { query, count, offset };
			},
			multi_link_search: (params: RawToolParamsObj) => {
				const { queries: queriesUnknown, count: countUnknown } = params;

				// Handle queries - could be array or JSON string
				let queries: string[];
				if (typeof queriesUnknown === 'string') {
					try {
						queries = JSON.parse(queriesUnknown);
						if (!Array.isArray(queries)) {
							throw new Error('Parsed value is not an array');
						}
					} catch {
						// Treat as single query if not valid JSON array
						queries = [queriesUnknown];
					}
				} else if (Array.isArray(queriesUnknown)) {
					queries = (queriesUnknown as unknown[]).map((q: unknown, i: number) => validateStr(`queries[${i}]`, q));
				} else {
					throw new Error(`Invalid LLM output: queries must be an array of strings.`);
				}

				const count = validateNumber(countUnknown, { default: 10 });
				return { queries, count };
			},

			edit_document: (params: RawToolParamsObj) => {
				const { uri: uriStr, operations: operationsUnknown } = params;
				const uri = validateURI(uriStr);

				// Handle case where operations is sent as a JSON string (common LLM mistake)
				let operationsArray: any[];
				if (typeof operationsUnknown === 'string') {
					try {
						operationsArray = JSON.parse(operationsUnknown);
						if (!Array.isArray(operationsArray)) {
							throw new Error('Parsed value is not an array');
						}
					} catch (parseError) {
						console.error('[edit_document] Failed to parse operations string:', operationsUnknown);
						throw new Error(`Invalid LLM output: operations is a string but not valid JSON. Send operations as a JSON array directly, not as a string.`);
					}
				} else if (Array.isArray(operationsUnknown)) {
					operationsArray = operationsUnknown;
				} else {
					console.error('[edit_document] Invalid operations format. Expected array, got:', typeof operationsUnknown, operationsUnknown);
					throw new Error(`Invalid LLM output: operations must be a JSON array. Received: ${typeof operationsUnknown}. Example: [{"type": "insert_text", "position": 0, "text": "Hello"}]`);
				}

				// Validate each operation has required fields
				const operations = operationsArray.map((op: any, index: number) => {
					if (!op.type) {
						console.error(`[edit_document] Invalid operation at index ${index}: missing type field`, op);
						throw new Error(`Invalid operation at index ${index}: missing "type" field. Each operation must have {"type": "...", ...}`);
					}
					return op;
				});

				return { uri, operations };
			},

			// --- Timeline tools
			timeline_add_event: (params: RawToolParamsObj) => {
				const { date: dateUnknown, title: titleUnknown, description: descriptionUnknown, category: categoryUnknown, is_deadline: isDeadlineUnknown, linked_documents: linkedDocsUnknown } = params
				const date = validateDateString(dateUnknown)
				const title = validateStr('title', titleUnknown)
				const description = validateOptionalStr('description', descriptionUnknown)
				const category = validateEventCategory(categoryUnknown)
				const isDeadline = validateBoolean(isDeadlineUnknown, { default: false })
				const linkedDocuments = validateStringArray(linkedDocsUnknown)
				return { date, title, description, category, isDeadline, linkedDocuments }
			},

			timeline_update_event: (params: RawToolParamsObj) => {
				const { event_id: eventIdUnknown, date: dateUnknown, title: titleUnknown, description: descriptionUnknown, category: categoryUnknown, is_deadline: isDeadlineUnknown, is_complete: isCompleteUnknown } = params
				const eventId = validateStr('event_id', eventIdUnknown)
				const date = validateOptionalDateString(dateUnknown)
				const title = validateOptionalStr('title', titleUnknown)
				const description = validateOptionalStr('description', descriptionUnknown)
				const category = validateOptionalEventCategory(categoryUnknown)
				const isDeadline = isFalsy(isDeadlineUnknown) ? null : validateBoolean(isDeadlineUnknown, { default: false })
				const isComplete = isFalsy(isCompleteUnknown) ? null : validateBoolean(isCompleteUnknown, { default: false })
				return { eventId, date, title, description, category, isDeadline, isComplete }
			},

			timeline_delete_event: (params: RawToolParamsObj) => {
				const { event_id: eventIdUnknown } = params
				const eventId = validateStr('event_id', eventIdUnknown)
				return { eventId }
			},

			timeline_get_events: (params: RawToolParamsObj) => {
				const { category: categoryUnknown, start_date: startDateUnknown, end_date: endDateUnknown, is_deadline: isDeadlineUnknown, limit: limitUnknown } = params
				const category = validateOptionalEventCategory(categoryUnknown)
				const startDate = validateOptionalDateString(startDateUnknown)
				const endDate = validateOptionalDateString(endDateUnknown)
				const isDeadline = isFalsy(isDeadlineUnknown) ? null : validateBoolean(isDeadlineUnknown, { default: false })
				const limit = validateNumber(limitUnknown, { default: 50 }) || 50
				return { category, startDate, endDate, isDeadline, limit }
			},

			timeline_link_document: (params: RawToolParamsObj) => {
				const { event_id: eventIdUnknown, document_uri: documentUriUnknown } = params
				const eventId = validateStr('event_id', eventIdUnknown)
				const documentUri = validateURI(documentUriUnknown)
				return { eventId, documentUri }
			},

			timeline_get_deadlines: (params: RawToolParamsObj) => {
				const { days_ahead: daysAheadUnknown } = params
				const daysAhead = validateNumber(daysAheadUnknown, { default: 30 }) || 30
				return { daysAhead }
			},

		}


		this.callTool = {
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				// Check if this is a document file (DOCX, XLSX, PDF, etc.)
				if (this.documentViewerService.isDocumentFile(uri)) {
					const content = await this.documentViewerService.getTextContent(uri);
					if (content !== null) {
						const totalFileLen = content.length;
						const totalNumLines = content.split('\n').length;

						// Apply pagination
						const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1);
						const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1;
						const fileContents = content.slice(fromIdx, toIdx + 1);
						const hasNextPage = (content.length - 1) - toIdx >= 1;

						return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } };
					}
					// If extraction failed, fall through to regular file handling
				}

				// Regular text file handling
				await voidModelService.initializeModel(uri)
				const { model } = await voidModelService.getModelSafe(uri)
				if (model === null) { throw new Error(`No contents; File does not exist.`) }

				let contents: string
				if (startLine === null && endLine === null) {
					contents = model.getValue(EndOfLinePreference.LF)
				}
				else {
					const startLineNumber = startLine === null ? 1 : startLine
					const endLineNumber = endLine === null ? model.getLineCount() : endLine
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
				}

				const totalNumLines = model.getLineCount()

				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1)
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1
				const fileContents = contents.slice(fromIdx, toIdx + 1) // paginate
				const hasNextPage = (contents.length - 1) - toIdx >= 1
				const totalFileLen = contents.length
				return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } }
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {

				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
					filePattern: queryStr,
					includePattern: includePattern ?? undefined,
					sortByScore: true, // makes results 10x better
				})
				const data = await searchService.fileSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { uris, hasNextPage } }
			},

			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ?
					workspaceContextService.getWorkspace().folders.map(f => f.uri)
					: [searchInFolder]

				const query = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders)

				const data = await searchService.textSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { queryStr, uris, hasNextPage } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) { throw new Error(`No contents; File does not exist.`); }
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			// ---

			create_file_or_folder: async ({ uri, isFolder }) => {
				if (isFolder) {
					await fileService.createFolder(uri)
				} else {
					// Check if this is a document file (DOCX, XLSX)
					const fileExt = uri.path.toLowerCase().split('.').pop();

					if (fileExt === 'docx') {
						// Create a proper empty DOCX file
						await this.documentCreatorService.createEmptyDOCX(uri);
					} else if (fileExt === 'xlsx' || fileExt === 'xls') {
						// Create a proper empty XLSX file
						await this.documentCreatorService.createEmptyXLSX(uri);
					} else {
						// Create regular empty file
						await fileService.createFile(uri);
					}
				}
				return { result: {} }
			},

			delete_file_or_folder: async ({ uri, isRecursive }) => {
				await fileService.del(uri, { recursive: isRecursive })
				return { result: {} }
			},

			rewrite_file: async ({ uri, newContent }) => {
				// Check if this is a document file (DOCX, XLSX, etc.)
				if (this.documentViewerService.isDocumentFile(uri)) {
					throw new Error(`Cannot use rewrite_file on document files (DOCX, XLSX, etc.). Please use the edit_document tool instead to modify document files.`)
				}

				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyRewriteFile({ uri, newContent })
				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})
				return { result: lintErrorsPromise }
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				// Check if this is a document file (DOCX, XLSX, etc.)
				if (this.documentViewerService.isDocumentFile(uri)) {
					throw new Error(`Cannot use edit_file on document files (DOCX, XLSX, etc.). Please use the edit_document tool instead to modify document files.`)
				}

				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks })

				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})

				return { result: lintErrorsPromise }
			},
			// ---
			run_command: async ({ command, cwd, terminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			open_persistent_terminal: async ({ cwd }) => {
				const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd })
				return { result: { persistentTerminalId } }
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				// Close the background terminal by sending exit
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
				return { result: {} }
			},

			// --- RAG tools
			rag_index_document: async ({ uri, isPolicyManual }) => {
				try {
					// CRITICAL: Check if document is already indexed to avoid duplicate costs
					const isAlreadyIndexed = await this.ragService.isDocumentIndexed(uri);

					if (isAlreadyIndexed) {
						return {
							result: {
								success: true,
								message: `Document already indexed (skipped to avoid duplicate costs): ${uri.fsPath || uri.path}`
							}
						};
					}

					// Document not indexed yet, proceed with indexing
					const result = await this.ragService.indexDocument({ uri, isPolicyManual });
					return { result };
				} catch (error) {
					return { result: { success: false, message: `Failed to index document: ${error.message}` } };
				}
			},
			rag_search_policy: async ({ query, limit }) => {
				try {
					const contextPack = await this.ragService.search({
						query,
						scope: 'policy_manual',
						limit
					});
					const contextService = new RAGContextService();
					const formatted = contextService.formatContextPack(contextPack);

					// Add helpful metadata about the search
					const enhancedResult = contextPack.totalResults === 0
						? `No relevant documents found for query: "${query}"\n\nTry:\n- Using different search terms\n- Checking if documents are indexed with rag_get_stats\n- Indexing policy documents first`
						: `Found ${contextPack.totalResults} relevant chunks (after MMR re-ranking and filtering):\n\n${formatted}`;

					return { result: { contextPack: enhancedResult } };
				} catch (error) {
					return { result: { contextPack: `Search failed: ${error.message}` } };
				}
			},
			rag_search_workspace: async ({ query, limit }) => {
				try {
					const contextPack = await this.ragService.search({
						query,
						scope: 'case_index', // Search case files only (not policy manuals)
						limit
					});
					const contextService = new RAGContextService();
					const formatted = contextService.formatContextPack(contextPack);

					// Add helpful metadata about the search
					const enhancedResult = contextPack.totalResults === 0
						? `No relevant case documents found for query: "${query}"\n\nTry:\n- Using different search terms\n- Checking if documents are indexed with rag_get_stats\n- Use rag_search_policy to search policy manuals instead`
						: `Found ${contextPack.totalResults} relevant case file chunks (after MMR re-ranking and filtering):\n\n${formatted}`;

					return { result: { contextPack: enhancedResult } };
				} catch (error) {
					return { result: { contextPack: `Search failed: ${error.message}` } };
				}
			},
			rag_search_all: async ({ query, limit }) => {
				try {
					const contextPack = await this.ragService.search({
						query,
						scope: 'workspace_all', // Search BOTH policy manuals AND case files
						limit
					});
					const contextService = new RAGContextService();
					const formatted = contextService.formatContextPack(contextPack);

					// Add helpful metadata about the search
					const enhancedResult = contextPack.totalResults === 0
						? `No relevant documents found for query: "${query}"\n\nTry:\n- Using different search terms\n- Checking if documents are indexed with rag_get_stats`
						: `Found ${contextPack.totalResults} relevant chunks from ALL sources (policy manuals + case files):\n\n${formatted}`;

					return { result: { contextPack: enhancedResult } };
				} catch (error) {
					return { result: { contextPack: `Search failed: ${error.message}` } };
				}
			},
			rag_get_stats: async () => {
				try {
					const stats = await this.ragService.getStats();
					const hasContent = stats.totalDocuments > 0;

					const statsStr = hasContent
						? `RAG Index Status: ✓ Active

📊 Statistics:
• Total Documents: ${stats.totalDocuments}
• Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB
• Total Chunks: ${stats.chunks.totalChunks}
• Average Tokens per Chunk: ${stats.chunks.avgTokens}

📁 Documents by Type:
${stats.documents.map(d => `  • ${d.filetype}: ${d.typeCount} files (${(d.totalSize / 1024 / 1024).toFixed(2)} MB)`).join('\n')}

💡 Search Tips:
- Use rag_search_policy for policy manual queries (regulations, procedures, rules)
- Use rag_search_workspace for case file queries (medical reports, IME evals, correspondence)
- Use rag_search_all to search BOTH sources at once
- Be specific with search terms for better results
- Increase limit (8-10) for complex topics`
						: `RAG Index Status: ⚠️ Empty

No documents indexed yet. To get started:
1. Use rag_index_document to index PDFs or documents
2. For policy manuals: set is_policy_manual to true
3. For workspace docs: set is_policy_manual to false

Example: rag_index_document with uri="/path/to/document.pdf" and is_policy_manual=true`;

					return { result: { stats: statsStr } };
				} catch (error) {
					return { result: { stats: `Failed to get stats: ${error.message}` } };
				}
			},

			edit_document: async ({ uri, operations }) => {
				try {
					const fileExt = uri.path.toLowerCase().split('.').pop();

					if (fileExt === 'docx') {
						const result = await this.documentEditorService.editDOCX({ uri, operations: operations as any });
						return { result };
					} else if (fileExt === 'xlsx' || fileExt === 'xls') {
						const result = await this.documentEditorService.editXLSX({ uri, operations: operations as any });
						return { result };
					} else {
						return {
							result: {
								success: false,
								error: `Unsupported file type: ${fileExt}. Only DOCX and XLSX files are supported.`
							}
						};
					}
				} catch (error) {
					return {
						result: {
							success: false,
							error: `Failed to edit document: ${error.message}`
						}
					};
				}
			},

			// --- Web Search tools (via IPC to electron-main to avoid CORS or through cloud)
			web_search: async ({ query, count, offset }) => {
				// Check if cloud mode is enabled and user is signed in
				if (this.voidSettingsService.state.globalSettings.voidCloudEnabled && this.voidCloudService.isSignedIn()) {
					// Route through cloud service
					if (!this.voidSettingsService.state.globalSettings.webSearchEnabled) {
						throw new Error('Web Search is disabled. Enable it in Settings > Web Search.');
					}

					// Get user token
					const userToken = this.voidCloudService.authState.session?.accessToken;
					if (!userToken) {
						throw new Error('Cloud authentication session expired. Please sign in again.');
					}

					// Call cloud web search via IPC
					const result = await this.braveSearchChannel.call('cloudWebSearch', {
						userToken,
						query,
						count: count || 10,
						offset: offset || 0,
					}) as BuiltinToolResultType['web_search'];

					return { result };
				} else {
					// Use direct Brave Search API (legacy mode)
					const apiKey = this.voidSettingsService.state.globalSettings.braveSearchApiKey;
					if (!apiKey) {
						throw new Error('Brave Search API key is required. Configure it in Settings > Web Search, or sign in to SafeAppeals Cloud for managed API access.');
					}

					if (!this.voidSettingsService.state.globalSettings.webSearchEnabled) {
						throw new Error('Web Search is disabled. Enable it in Settings > Web Search.');
					}

					// Call electron-main via IPC to avoid CORS
					const result = await this.braveSearchChannel.call('webSearch', {
						apiKey,
						query,
						count: count || 10,
						offset: offset || 0,
					}) as BuiltinToolResultType['web_search'];

					return { result };
				}
			},

			multi_link_search: async ({ queries, count }) => {
				// Check if cloud mode is enabled and user is signed in
				if (this.voidSettingsService.state.globalSettings.voidCloudEnabled && this.voidCloudService.isSignedIn()) {
					// Route through cloud service
					if (!this.voidSettingsService.state.globalSettings.webSearchEnabled) {
						throw new Error('Web Search is disabled. Enable it in Settings > Web Search.');
					}

					// Get user token
					const userToken = this.voidCloudService.authState.session?.accessToken;
					if (!userToken) {
						throw new Error('Cloud authentication session expired. Please sign in again.');
					}

					// Call cloud multi web search via IPC
					const result = await this.braveSearchChannel.call('cloudMultiWebSearch', {
						userToken,
						queries,
						count: count || 10,
					}) as BuiltinToolResultType['multi_link_search'];

					return { result };
				} else {
					// Use direct Brave Search API (legacy mode)
					const apiKey = this.voidSettingsService.state.globalSettings.braveSearchApiKey;
					if (!apiKey) {
						throw new Error('Brave Search API key is required. Configure it in Settings > Web Search, or sign in to SafeAppeals Cloud for managed API access.');
					}

					if (!this.voidSettingsService.state.globalSettings.webSearchEnabled) {
						throw new Error('Web Search is disabled. Enable it in Settings > Web Search.');
					}

					// Call electron-main via IPC to avoid CORS
					const result = await this.braveSearchChannel.call('multiLinkSearch', {
						apiKey,
						queries,
						count: count || 10,
					}) as BuiltinToolResultType['multi_link_search'];

					return { result };
				}
			},

			// --- Timeline tools
			timeline_add_event: async ({ date, title, description, category, isDeadline, linkedDocuments }) => {
				const event = await this.timelineService.addEvent({
					date,
					title,
					description: description ?? undefined,
					category,
					isDeadline,
					linkedDocuments,
				})
				return { result: { event } }
			},

			timeline_update_event: async ({ eventId, date, title, description, category, isDeadline, isComplete }) => {
				const updates: Record<string, unknown> = {}
				if (date !== null) updates.date = date
				if (title !== null) updates.title = title
				if (description !== null) updates.description = description
				if (category !== null) updates.category = category
				if (isDeadline !== null) updates.isDeadline = isDeadline
				if (isComplete !== null) updates.isComplete = isComplete
				await this.timelineService.updateEvent(eventId, updates)
				return { result: { success: true } }
			},

			timeline_delete_event: async ({ eventId }) => {
				await this.timelineService.deleteEvent(eventId)
				return { result: { success: true } }
			},

			timeline_get_events: async ({ category, startDate, endDate, isDeadline, limit }) => {
				let events = this.timelineService.getEventsSorted(true)

				// Apply filters
				if (category !== null) {
					events = events.filter(e => e.category === category)
				}
				if (startDate !== null) {
					const start = new Date(startDate)
					events = events.filter(e => new Date(e.date) >= start)
				}
				if (endDate !== null) {
					const end = new Date(endDate)
					events = events.filter(e => new Date(e.date) <= end)
				}
				if (isDeadline !== null) {
					events = events.filter(e => e.isDeadline === isDeadline)
				}

				const totalCount = events.length
				events = events.slice(0, limit)

				return { result: { events, totalCount } }
			},

			timeline_link_document: async ({ eventId, documentUri }) => {
				await this.timelineService.linkDocument(eventId, documentUri)
				return { result: { success: true } }
			},

			timeline_get_deadlines: async ({ daysAhead }) => {
				const upcoming = this.timelineService.getUpcomingDeadlines(daysAhead)
				const overdue = this.timelineService.getOverdueDeadlines()
				return { result: { upcoming, overdue } }
			},
		}


		const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(more on next page...)' : ''

		const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
			return lintErrors
				.map((e, i) => `Error ${i + 1}:\nLines Affected: ${e.startLineNumber}-${e.endLineNumber}\nError message:${e.message}`)
				.join('\n\n')
				.substring(0, MAX_FILE_CHARS_PAGE)
		}

		// given to the LLM after the call for successful tool calls
		this.stringOfResult = {
			read_file: (params, result) => {
				return `${params.uri.fsPath}\n\`\`\`\n${result.fileContents}\n\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `\nMore info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ''}`
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			// ---
			create_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully created.`
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				const { persistentTerminalId } = params
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},

			// --- RAG tools
			rag_index_document: (params, result) => {
				if (result.success) {
					return `Successfully indexed document: ${params.uri.fsPath}\n${result.message}`;
				} else {
					return `Failed to index document: ${params.uri.fsPath}\n${result.message}`;
				}
			},
			rag_search_policy: (_params, result) => {
				return result.contextPack;
			},
			rag_search_workspace: (_params, result) => {
				return result.contextPack;
			},
			rag_search_all: (_params, result) => {
				return result.contextPack;
			},
			rag_get_stats: (_params, result) => {
				return result.stats;
			},

			edit_document: (params, result) => {
				if (result.success) {
					return result.message || `Successfully edited document: ${params.uri.fsPath}\nOperations applied: ${params.operations.length}`;
				} else {
					return `Failed to edit document: ${params.uri.fsPath}\nError: ${result.error}`;
				}
			},

			// --- Web Search tools
			web_search: (_params, result) => {
				if (result.results.length === 0) {
					return 'No results found.';
				}

				return result.results.map((r, i) => {
					const parts = [
						`${i + 1}. **${r.title}**`,
						`   URL: ${r.url}`,
						`   ${r.description}`,
					];
					if (r.age) {
						parts.push(`   Published: ${r.age}`);
					}
					return parts.join('\n');
				}).join('\n\n');
			},

			multi_link_search: (_params, result) => {
				return result.searchResults.map(search => {
					const header = `## Search: "${search.query}"`;
					if (search.error) {
						return `${header}\n\n❌ Error: ${search.error}`;
					}
					if (search.results.length === 0) {
						return `${header}\n\nNo results found.`;
					}
					const resultsStr = search.results.map((r, i) => {
						const parts = [
							`${i + 1}. **${r.title}**`,
							`   URL: ${r.url}`,
							`   ${r.description}`,
						];
						if (r.age) {
							parts.push(`   Published: ${r.age}`);
						}
						return parts.join('\n');
					}).join('\n\n');
					return `${header}\n\n${resultsStr}`;
				}).join('\n\n---\n\n');
			},

			// --- Timeline tools
			timeline_add_event: (_params, result) => {
				const e = result.event
				const linkedDocsStr = e.linkedDocuments.length > 0
					? `\nLinked Documents: ${e.linkedDocuments.join(', ')}`
					: ''
				return `Successfully added event to timeline:
- ID: ${e.id}
- Date: ${new Date(e.date).toLocaleDateString()}
- Title: ${e.title}
- Category: ${e.category}
- Is Deadline: ${e.isDeadline}${linkedDocsStr}`
			},

			timeline_update_event: (params, _result) => {
				return `Successfully updated event ${params.eventId}.`
			},

			timeline_delete_event: (params, _result) => {
				return `Successfully deleted event ${params.eventId} from timeline.`
			},

			timeline_get_events: (_params, result) => {
				if (result.events.length === 0) {
					return 'No events found matching the criteria.'
				}
				const eventsStr = result.events.map((e, i) => {
					const dateStr = new Date(e.date).toLocaleDateString()
					const deadlineStr = e.isDeadline ? ' [DEADLINE]' : ''
					const completeStr = e.isComplete ? ' ✓' : ''
					const linkedDocsCount = e.linkedDocuments.length > 0 ? ` (${e.linkedDocuments.length} docs)` : ''
					return `${i + 1}. [${dateStr}] ${e.title}${deadlineStr}${completeStr}${linkedDocsCount}
   ID: ${e.id} | Category: ${e.category}${e.description ? `\n   ${e.description}` : ''}`
				}).join('\n\n')
				return `Found ${result.totalCount} event(s):\n\n${eventsStr}`
			},

			timeline_link_document: (params, _result) => {
				return `Successfully linked document to event ${params.eventId}.`
			},

			timeline_get_deadlines: (_params, result) => {
				const formatDeadlineList = (events: typeof result.upcoming, label: string) => {
					if (events.length === 0) return `${label}: None`
					const list = events.map(e => {
						const dateStr = new Date(e.date).toLocaleDateString()
						const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
						return `- [${dateStr}] ${e.title} (${daysUntil > 0 ? `${daysUntil} days` : 'TODAY'})\n  ID: ${e.id}`
					}).join('\n')
					return `${label}:\n${list}`
				}

				const overdueStr = formatDeadlineList(result.overdue, '⚠️ OVERDUE')
				const upcomingStr = formatDeadlineList(result.upcoming, '📅 Upcoming')
				return `${overdueStr}\n\n${upcomingStr}`
			},
		}



	}


	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))

		if (!lintErrors.length) return { lintErrors: null }
		return { lintErrors, }
	}


}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);



