/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
// IStorageService removed - now using per-workspace SQLite storage only

import { findLast, findLastIdx } from '../../../../base/common/arraysFind.js';
import { timeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { shorten } from '../../../../base/common/labels.js';
import { deepClone } from '../../../../base/common/objects.js';
import { truncate } from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Position } from '../../../../editor/common/core/position.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IChatThreadStorageService } from '../common/chat/chatThreadStorageService.js';
import { ChatMessage, CheckpointEntry, CodespanLocationLink, StagingSelectionItem, ToolMessage } from '../common/chatThreadServiceTypes.js';
import { IContextTrackingService } from '../common/contextTrackingService.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';
import { VoidFileSnapshot } from '../common/editCodeServiceTypes.js';
import { IMCPService } from '../common/mcpService.js';
import { RawMCPToolCall } from '../common/mcpServiceTypes.js';
import { IMetricsService } from '../common/metricsService.js';
import { chat_userMessageContent, isABuiltinToolName } from '../common/prompt/prompts.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { AnthropicReasoning, getErrorMessage, RawToolCallObj, RawToolParamsObj } from '../common/sendLLMMessageTypes.js';
// Storage keys removed - now using per-workspace SQLite storage only
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, ToolCallParams, ToolName, ToolResult } from '../common/tools/toolsServiceTypes.js';
import { IVoidModelService } from '../common/voidModelService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { FeatureName, ModelSelection, ModelSelectionOptions } from '../common/voidSettingsTypes.js';
import { ICloudLLMRouterService } from './cloudLLMRouterService.js';
import { IConvertToLLMMessageService } from './convertToLLMMessageService.js';
import { IEditCodeService } from './editCodeServiceInterface.js';
import { IToolsService } from './tools/toolsService.js';


// related to retrying when LLM message has error
const CHAT_RETRIES = 3
const RETRY_DELAY = 2500


const findStagingSelectionIndex = (currentSelections: StagingSelectionItem[] | undefined, newSelection: StagingSelectionItem): number | null => {
	if (!currentSelections) return null

	for (let i = 0; i < currentSelections.length; i += 1) {
		const s = currentSelections[i]

		if (s.uri.fsPath !== newSelection.uri.fsPath) continue

		if (s.type === 'File' && newSelection.type === 'File') {
			return i
		}
		if (s.type === 'CodeSelection' && newSelection.type === 'CodeSelection') {
			if (s.uri.fsPath !== newSelection.uri.fsPath) continue
			// if there's any collision return true
			const [oldStart, oldEnd] = s.range
			const [newStart, newEnd] = newSelection.range
			if (oldStart !== newStart || oldEnd !== newEnd) continue
			return i
		}
		if (s.type === 'Folder' && newSelection.type === 'Folder') {
			return i
		}
	}
	return null
}


/*

Store a checkpoint of all "before" files on each x.
x's show up before user messages and LLM edit tool calls.

x     A          (edited A -> A')
(... user modified changes ...)
User message

x     A' B C     (edited A'->A'', B->B', C->C')
LLM Edit
x
LLM Edit
x
LLM Edit


INVARIANT:
A checkpoint appears before every LLM message, and before every user message (before user really means directly after LLM is done).
*/


type UserMessageType = ChatMessage & { role: 'user' }
type UserMessageState = UserMessageType['state']
const defaultMessageState: UserMessageState = {
	stagingSelections: [],
	isBeingEdited: false,
}

// a 'thread' means a chat message history

type WhenMounted = {
	textAreaRef: { current: HTMLTextAreaElement | null }; // the textarea that this thread has, gets set in SidebarChat
	scrollToBottom: () => void;
}



export type ThreadType = {
	id: string; // store the id here too
	createdAt: string; // ISO string
	lastModified: string; // ISO string

	messages: ChatMessage[];
	filesWithUserChanges: Set<string>;

	// this doesn't need to go in a state object, but feels right
	state: {
		currCheckpointIdx: number | null; // the latest checkpoint we're at (null if not at a particular checkpoint, like if the chat is streaming, or chat just finished and we haven't clicked on a checkpt)

		stagingSelections: StagingSelectionItem[];
		focusedMessageIdx: number | undefined; // index of the user message that is being edited (undefined if none)

		linksOfMessageIdx: { // eg. link = linksOfMessageIdx[4]['RangeFunction']
			[messageIdx: number]: {
				[codespanName: string]: CodespanLocationLink
			}
		}


		mountedInfo?: {
			whenMounted: Promise<WhenMounted>
			_whenMountedResolver: (res: WhenMounted) => void
			mountedIsResolvedRef: { current: boolean };
		}


	};
}

type ChatThreads = {
	[id: string]: undefined | ThreadType;
}


export type ThreadsState = {
	allThreads: ChatThreads;
	currentThreadId: string; // intended for internal use only
}

export type IsRunningType =
	| 'LLM' // the LLM is currently streaming
	| 'tool' // whether a tool is currently running
	| 'awaiting_user' // awaiting user call
	| 'idle' // nothing is running now, but the chat should still appear like it's going (used in-between calls)
	| undefined

export type ThreadStreamState = {
	[threadId: string]: undefined | {
		isRunning: undefined;
		error?: { message: string, fullError: Error | null, };
		llmInfo?: undefined;
		toolInfo?: undefined;
		interrupt?: undefined;
	} | { // an assistant message is being written
		isRunning: 'LLM';
		error?: undefined;
		llmInfo: {
			displayContentSoFar: string;
			reasoningSoFar: string;
			toolCallSoFar: RawToolCallObj | null;
		};
		toolInfo?: undefined;
		interrupt: Promise<() => void>; // calling this should have no effect on state - would be too confusing. it just cancels the tool
	} | { // a tool is being run
		isRunning: 'tool';
		error?: undefined;
		llmInfo?: undefined;
		toolInfo: {
			toolName: ToolName;
			toolParams: ToolCallParams<ToolName>;
			id: string;
			content: string;
			rawParams: RawToolParamsObj;
			mcpServerName: string | undefined;
		};
		interrupt: Promise<() => void>;
	} | {
		isRunning: 'awaiting_user';
		error?: undefined;
		llmInfo?: undefined;
		toolInfo?: undefined;
		interrupt?: undefined;
	} | {
		isRunning: 'idle';
		error?: undefined;
		llmInfo?: undefined;
		toolInfo?: undefined;
		interrupt: 'not_needed' | Promise<() => void>; // calling this should have no effect on state - would be too confusing. it just cancels the tool
	}
}

const newThreadObject = () => {
	const now = new Date().toISOString()
	return {
		id: generateUuid(),
		createdAt: now,
		lastModified: now,
		messages: [],
		state: {
			currCheckpointIdx: null,
			stagingSelections: [],
			focusedMessageIdx: undefined,
			linksOfMessageIdx: {},
		},
		filesWithUserChanges: new Set()
	} satisfies ThreadType
}






export interface IChatThreadService {
	readonly _serviceBrand: undefined;

	readonly state: ThreadsState;
	readonly streamState: ThreadStreamState; // not persistent

	onDidChangeCurrentThread: Event<void>;
	onDidChangeStreamState: Event<{ threadId: string }>

	getCurrentThread(): ThreadType;
	openNewThread(): void;
	switchToThread(threadId: string): void;

	// thread selector
	deleteThread(threadId: string): void;
	duplicateThread(threadId: string): void;

	// exposed getters/setters
	// these all apply to current thread
	getCurrentMessageState: (messageIdx: number) => UserMessageState
	setCurrentMessageState: (messageIdx: number, newState: Partial<UserMessageState>) => void
	getCurrentThreadState: () => ThreadType['state']
	setCurrentThreadState: (newState: Partial<ThreadType['state']>) => void

	// you can edit multiple messages - the one you're currently editing is "focused", and we add items to that one when you press cmd+L.
	getCurrentFocusedMessageIdx(): number | undefined;
	isCurrentlyFocusingMessage(): boolean;
	setCurrentlyFocusedMessageIdx(messageIdx: number | undefined): void;

	popStagingSelections(numPops?: number): void;
	addNewStagingSelection(newSelection: StagingSelectionItem): void;

	dangerousSetState: (newState: ThreadsState) => void;
	resetState: () => void;

	// // current thread's staging selections
	// closeCurrentStagingSelectionsInMessage(opts: { messageIdx: number }): void;
	// closeCurrentStagingSelectionsInThread(): void;

	// codespan links (link to symbols in the markdown)
	getCodespanLink(opts: { codespanStr: string, messageIdx: number, threadId: string }): CodespanLocationLink | undefined;
	addCodespanLink(opts: { newLinkText: string, newLinkLocation: CodespanLocationLink, messageIdx: number, threadId: string }): void;
	generateCodespanLink(opts: { codespanStr: string, threadId: string }): Promise<CodespanLocationLink>;
	getRelativeStr(uri: URI): string | undefined

	// entry pts
	abortRunning(threadId: string): Promise<void>;
	dismissStreamError(threadId: string): void;

	// call to edit a message
	editUserMessageAndStreamResponse({ userMessage, messageIdx, threadId }: { userMessage: string, messageIdx: number, threadId: string }): Promise<void>;

	// call to add a message
	addUserMessageAndStreamResponse({ userMessage, threadId }: { userMessage: string, threadId: string }): Promise<void>;

	// approve/reject
	approveLatestToolRequest(threadId: string): void;
	rejectLatestToolRequest(threadId: string): void;

	// jump to history
	jumpToCheckpointBeforeMessageIdx(opts: { threadId: string, messageIdx: number, jumpToUserModified: boolean }): void;

	focusCurrentChat: () => Promise<void>
	blurCurrentChat: () => Promise<void>

	// context window management
	summarizeThread(threadId: string, preserveCount?: number): Promise<void>;
	getContextUsage(threadId: string): { totalTokens: number; contextWindow: number; usagePercent: number } | null;
}

export const IChatThreadService = createDecorator<IChatThreadService>('voidChatThreadService');
class ChatThreadService extends Disposable implements IChatThreadService {
	_serviceBrand: undefined;

	// this fires when the current thread changes at all (a switch of currentThread, or a message added to it, etc)
	private readonly _onDidChangeCurrentThread = new Emitter<void>();
	readonly onDidChangeCurrentThread: Event<void> = this._onDidChangeCurrentThread.event;

	private readonly _onDidChangeStreamState = new Emitter<{ threadId: string }>();
	readonly onDidChangeStreamState: Event<{ threadId: string }> = this._onDidChangeStreamState.event;

	readonly streamState: ThreadStreamState = {}
	state: ThreadsState // allThreads is persisted, currentThread is not

	// Workspace ID tracking for per-workspace storage
	private cachedWorkspaceId: string | null = null

	// used in checkpointing
	// private readonly _userModifiedFilesToCheckInCheckpoints = new LRUCache<string, null>(50)



	constructor(
		@IVoidModelService private readonly _voidModelService: IVoidModelService,
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@ICloudLLMRouterService private readonly _cloudLLMRouterService: ICloudLLMRouterService,
		@IToolsService private readonly _toolsService: IToolsService,
		@IVoidSettingsService private readonly _settingsService: IVoidSettingsService,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IMetricsService private readonly _metricsService: IMetricsService,
		@IEditCodeService private readonly _editCodeService: IEditCodeService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IConvertToLLMMessageService private readonly _convertToLLMMessagesService: IConvertToLLMMessageService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IDirectoryStrService private readonly _directoryStringService: IDirectoryStrService,
		@IFileService private readonly _fileService: IFileService,
		@IMCPService private readonly _mcpService: IMCPService,
		@IContextTrackingService private readonly _contextTrackingService: IContextTrackingService,
		@IChatThreadStorageService private readonly _chatThreadStorageService: IChatThreadStorageService,
	) {
		super()
		this.state = { allThreads: {}, currentThreadId: null as unknown as string } // default state

		// STEP 1: Create an initial empty thread immediately (no storage access)
		this.openNewThread()
		console.log(`[ChatThreadService] Created initial thread (per-workspace storage will load when ready)`)

		// STEP 2: Load from per-workspace storage (storage service handles retries)
		this._loadFromWorkspaceStorage()

		// Listen for workspace changes to reload threads
		this._register(
			this._workspaceContextService.onDidChangeWorkspaceFolders(() => {
				const oldId = this.cachedWorkspaceId
				this.cachedWorkspaceId = null // Force recalculation
				const newId = this._getWorkspaceId()
				if (oldId !== newId) {
					console.log(`[ChatThreadService] Workspace changed: ${oldId} -> ${newId}`)
					// Reset storage availability and load threads for new workspace
					this.perWorkspaceStorageAvailable = false
					this._loadFromWorkspaceStorage()
				}
			})
		)


		// keep track of user-modified files
		// const disposablesOfModelId: { [modelId: string]: IDisposable[] } = {}
		// this._register(
		// 	this._modelService.onModelAdded(e => {
		// 		if (!(e.id in disposablesOfModelId)) disposablesOfModelId[e.id] = []
		// 		disposablesOfModelId[e.id].push(
		// 			e.onDidChangeContent(() => { this._userModifiedFilesToCheckInCheckpoints.set(e.uri.fsPath, null) })
		// 		)
		// 	})
		// )
		// this._register(this._modelService.onModelRemoved(e => {
		// 	if (!(e.id in disposablesOfModelId)) return
		// 	disposablesOfModelId[e.id].forEach(d => d.dispose())
		// }))

	}

	async focusCurrentChat() {
		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const s = await thread.state.mountedInfo?.whenMounted
		if (!this.isCurrentlyFocusingMessage()) {
			s?.textAreaRef.current?.focus()
		}
	}
	async blurCurrentChat() {
		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const s = await thread.state.mountedInfo?.whenMounted
		if (!this.isCurrentlyFocusingMessage()) {
			s?.textAreaRef.current?.blur()
		}
	}



	dangerousSetState = (newState: ThreadsState) => {
		this.state = newState
		this._onDidChangeCurrentThread.fire()
	}
	resetState = () => {
		this.state = { allThreads: {}, currentThreadId: null as unknown as string } // see constructor
		this.openNewThread()
		this._onDidChangeCurrentThread.fire()
	}

	// URI revival is now handled in the ChatThreadStorageService on the main process side

	/**
	 * Compute workspace ID following RAGService pattern
	 */
	private _getWorkspaceId(): string | null {
		// Return cached value if available
		if (this.cachedWorkspaceId !== null) {
			return this.cachedWorkspaceId
		}

		const folders = this._workspaceContextService.getWorkspace().folders
		if (folders.length === 0) {
			// No workspace open - return null to use fallback storage
			console.log('[ChatThreadService] No workspace folder open - using fallback storage')
			return null
		}

		const folderPath = folders[0].uri.fsPath
		// Create a simple hash from the folder path
		let hash = 0
		for (let i = 0; i < folderPath.length; i++) {
			const char = folderPath.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Convert to 32bit integer
		}
		// Convert to hex string and take first 16 chars
		const hexHash = Math.abs(hash).toString(16).padStart(8, '0')
		this.cachedWorkspaceId = hexHash.substring(0, 16)
		console.log(`[ChatThreadService] Computed workspaceId: ${this.cachedWorkspaceId} for folder: ${folderPath}`)
		return this.cachedWorkspaceId
	}

	/**
	 * Track if per-workspace storage is available
	 */
	private perWorkspaceStorageAvailable = false

	/**
	 * Load from workspace storage (storage service handles retries internally)
	 */
	private async _loadFromWorkspaceStorage(): Promise<void> {
		const workspaceId = this._getWorkspaceId()
		if (!workspaceId) {
			console.log('[ChatThreadService] No workspace folder open - threads will not be persisted')
			return
		}

		try {
			console.log(`[ChatThreadService] Loading threads from workspace ${workspaceId}...`)
			const workspaceThreads = await this._chatThreadStorageService.readAllThreads(workspaceId)
			this.perWorkspaceStorageAvailable = true
			console.log(`[ChatThreadService] ✓ Per-workspace storage ready`)

			// If workspace has saved threads, load them
			if (workspaceThreads && Object.keys(workspaceThreads).length > 0) {
				// Keep the current thread ID if it exists in loaded threads, otherwise use first
				const currentThreadId = this.state.currentThreadId
				const newCurrentThreadId = workspaceThreads[currentThreadId] ? currentThreadId : Object.keys(workspaceThreads)[0]

				this.state = {
					allThreads: workspaceThreads,
					currentThreadId: newCurrentThreadId
				}
				console.log(`[ChatThreadService] Loaded ${Object.keys(workspaceThreads).length} threads from workspace ${workspaceId}`)
				this._onDidChangeCurrentThread.fire()
			} else {
				console.log(`[ChatThreadService] No saved threads in workspace ${workspaceId}, using new thread`)
			}
		} catch (error: any) {
			console.warn(`[ChatThreadService] Per-workspace storage unavailable: ${error.message}`)
			console.warn('[ChatThreadService] Threads will be created fresh and may not persist across restarts')
		}
	}

	/**
	 * Store threads to per-workspace storage only
	 * No global storage - threads are isolated per workspace
	 */
	private _storeAllThreads(threads: ChatThreads): void {
		const workspaceId = this._getWorkspaceId()
		console.log(`[ChatThreadService] _storeAllThreads called. workspaceId=${workspaceId}, perWorkspaceStorageAvailable=${this.perWorkspaceStorageAvailable}`)

		if (!workspaceId) {
			// No workspace open - threads won't be persisted
			console.warn('[ChatThreadService] No workspace - threads not persisted')
			return
		}

		if (!this.perWorkspaceStorageAvailable) {
			// IPC not ready yet - try to save anyway (it might work now)
			console.log('[ChatThreadService] Storage flag not set - attempting save anyway...')
		}

		// Store to per-workspace SQLite database
		this._chatThreadStorageService.storeAllThreads(workspaceId, threads)
			.then(() => {
				console.log(`[ChatThreadService] ✓ Threads saved successfully to workspace ${workspaceId}`)
				this.perWorkspaceStorageAvailable = true // Mark as available after successful save
			})
			.catch(error => {
				console.warn('[ChatThreadService] Failed to save threads:', error.message)
			})
	}


	// this should be the only place this.state = ... appears besides constructor
	private _setState(state: Partial<ThreadsState>, doNotRefreshMountInfo?: boolean) {
		const newState = {
			...this.state,
			...state
		}

		this.state = newState

		this._onDidChangeCurrentThread.fire()


		// if we just switched to a thread, update its current stream state if it's not streaming to possibly streaming
		const threadId = newState.currentThreadId
		const streamState = this.streamState[threadId]
		if (streamState?.isRunning === undefined && !streamState?.error) {

			// set streamState
			const messages = newState.allThreads[threadId]?.messages
			const lastMessage = messages && messages[messages.length - 1]
			// if awaiting user but stream state doesn't indicate it (happens if restart Void)
			if (lastMessage && lastMessage.role === 'tool' && lastMessage.type === 'tool_request')
				this._setStreamState(threadId, { isRunning: 'awaiting_user', })

			// if running now but stream state doesn't indicate it (happens if restart Void), cancel that last tool
			if (lastMessage && lastMessage.role === 'tool' && lastMessage.type === 'running_now') {

				this._updateLatestTool(threadId, { role: 'tool', type: 'rejected', content: lastMessage.content, id: lastMessage.id, rawParams: lastMessage.rawParams, result: null, name: lastMessage.name, params: lastMessage.params, mcpServerName: lastMessage.mcpServerName })
			}

		}


		// if we did not just set the state to true, set mount info
		if (doNotRefreshMountInfo) return

		let whenMountedResolver: (w: WhenMounted) => void
		const whenMountedPromise = new Promise<WhenMounted>((res) => whenMountedResolver = res)

		this._setThreadState(threadId, {
			mountedInfo: {
				whenMounted: whenMountedPromise,
				mountedIsResolvedRef: { current: false },
				_whenMountedResolver: (w: WhenMounted) => {
					whenMountedResolver(w)
					const mountInfo = this.state.allThreads[threadId]?.state.mountedInfo
					if (mountInfo) mountInfo.mountedIsResolvedRef.current = true
				},
			}
		}, true) // do not trigger an update



	}


	private _setStreamState(threadId: string, state: ThreadStreamState[string]) {
		this.streamState[threadId] = state
		this._onDidChangeStreamState.fire({ threadId })
	}


	// ---------- streaming ----------



	private _currentModelSelectionProps = () => {
		// these settings should not change throughout the loop (eg anthropic breaks if you change its thinking mode and it's using tools)
		const featureName: FeatureName = 'Chat'
		const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName]
		const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : undefined
		return { modelSelection, modelSelectionOptions }
	}



	private _swapOutLatestStreamingToolWithResult = (threadId: string, tool: ChatMessage & { role: 'tool' }) => {
		const messages = this.state.allThreads[threadId]?.messages
		if (!messages) return false
		const lastMsg = messages[messages.length - 1]
		if (!lastMsg) return false

		if (lastMsg.role === 'tool' && lastMsg.type !== 'invalid_params') {
			this._editMessageInThread(threadId, messages.length - 1, tool)
			return true
		}
		return false
	}
	private _updateLatestTool = (threadId: string, tool: ChatMessage & { role: 'tool' }) => {
		const swapped = this._swapOutLatestStreamingToolWithResult(threadId, tool)
		if (swapped) return
		this._addMessageToThread(threadId, tool)
	}

	approveLatestToolRequest(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		const lastMsg = thread.messages[thread.messages.length - 1]
		if (!(lastMsg.role === 'tool' && lastMsg.type === 'tool_request')) return // should never happen

		const callThisToolFirst: ToolMessage<ToolName> = lastMsg

		this._wrapRunAgentToNotify(
			this._runChatAgent({ callThisToolFirst, threadId, ...this._currentModelSelectionProps() })
			, threadId
		)
	}
	rejectLatestToolRequest(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		const lastMsg = thread.messages[thread.messages.length - 1]

		let params: ToolCallParams<ToolName>
		if (lastMsg.role === 'tool' && lastMsg.type !== 'invalid_params') {
			params = lastMsg.params
		}
		else return

		const { name, id, rawParams, mcpServerName } = lastMsg

		const errorMessage = this.toolErrMsgs.rejected
		this._updateLatestTool(threadId, { role: 'tool', type: 'rejected', params: params, name: name, content: errorMessage, result: null, id, rawParams, mcpServerName })
		this._setStreamState(threadId, undefined)
	}

	private _computeMCPServerOfToolName = (toolName: string) => {
		return this._mcpService.getMCPTools()?.find(t => t.name === toolName)?.mcpServerName
	}

	async abortRunning(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		// add assistant message
		if (this.streamState[threadId]?.isRunning === 'LLM') {
			const { displayContentSoFar, reasoningSoFar, toolCallSoFar } = this.streamState[threadId].llmInfo
			this._addMessageToThread(threadId, { role: 'assistant', displayContent: displayContentSoFar, reasoning: reasoningSoFar, anthropicReasoning: null })
			if (toolCallSoFar) {
				// Handle both single and multiple tool calls - just log the first for interruption
				const firstToolName = 'name' in toolCallSoFar ? toolCallSoFar.name : toolCallSoFar.toolCalls[0].name
				this._addMessageToThread(threadId, { role: 'interrupted_streaming_tool', name: firstToolName, mcpServerName: this._computeMCPServerOfToolName(firstToolName) })
			}
		}
		// add tool that's running
		else if (this.streamState[threadId]?.isRunning === 'tool') {
			const { toolName, toolParams, id, content: content_, rawParams, mcpServerName } = this.streamState[threadId].toolInfo
			const content = content_ || this.toolErrMsgs.interrupted
			this._updateLatestTool(threadId, { role: 'tool', name: toolName, params: toolParams, id, content, rawParams, type: 'rejected', result: null, mcpServerName })
		}
		// reject the tool for the user if relevant
		else if (this.streamState[threadId]?.isRunning === 'awaiting_user') {
			this.rejectLatestToolRequest(threadId)
		}
		else if (this.streamState[threadId]?.isRunning === 'idle') {
			// do nothing
		}

		this._addUserCheckpoint({ threadId })

		// interrupt any effects
		const interrupt = await this.streamState[threadId]?.interrupt
		if (typeof interrupt === 'function')
			interrupt()


		this._setStreamState(threadId, undefined)
	}



	private readonly toolErrMsgs = {
		rejected: 'Tool call was rejected by the user.',
		interrupted: 'Tool call was interrupted by the user.',
		errWhenStringifying: (error: any) => `Tool call succeeded, but there was an error stringifying the output.\n${getErrorMessage(error)}`
	}


	// private readonly _currentlyRunningToolInterruptor: { [threadId: string]: (() => void) | undefined } = {}


	// returns true when the tool call is waiting for user approval
	private _runToolCall = async (
		threadId: string,
		toolName: ToolName,
		toolId: string,
		mcpServerName: string | undefined,
		opts: { preapproved: true, unvalidatedToolParams: RawToolParamsObj, validatedParams: ToolCallParams<ToolName> } | { preapproved: false, unvalidatedToolParams: RawToolParamsObj },
	): Promise<{ awaitingUserApproval?: boolean, interrupted?: boolean }> => {

		console.log('[ChatThreadService] _runToolCall called:', {
			toolName,
			toolId,
			unvalidatedParams: opts.unvalidatedToolParams,
			preapproved: opts.preapproved
		})

		// compute these below
		let toolParams: ToolCallParams<ToolName>
		let toolResult: ToolResult<ToolName>
		let toolResultStr: string

		// Check if it's a built-in tool
		const isBuiltInTool = isABuiltinToolName(toolName)
		console.log('[ChatThreadService] _runToolCall - isBuiltInTool:', isBuiltInTool, 'toolName:', toolName)


		if (!opts.preapproved) { // skip this if pre-approved
			// 1. validate tool params
			try {
				console.log('[ChatThreadService] Validating tool params for:', toolName)
				if (isBuiltInTool) {
					console.log('[ChatThreadService] Calling validateParams for built-in tool:', toolName, 'with params:', opts.unvalidatedToolParams)
					const params = this._toolsService.validateParams[toolName](opts.unvalidatedToolParams)
					toolParams = params
					console.log('[ChatThreadService] ✅ Validation successful, validated params:', toolParams)
				}
				else {
					toolParams = opts.unvalidatedToolParams
					console.log('[ChatThreadService] MCP tool, using raw params:', toolParams)
				}
			}
			catch (error) {
				const errorMessage = getErrorMessage(error)
				console.error('[ChatThreadService] ❌ Tool param validation failed:', {
					toolName,
					error: errorMessage,
					rawParams: opts.unvalidatedToolParams
				})
				this._addMessageToThread(threadId, { role: 'tool', type: 'invalid_params', rawParams: opts.unvalidatedToolParams, result: null, name: toolName, content: errorMessage, id: toolId, mcpServerName })
				return {}
			}
			// once validated, add checkpoint for edit
			if (toolName === 'edit_file') { this._addToolEditCheckpoint({ threadId, uri: (toolParams as BuiltinToolCallParams['edit_file']).uri }) }
			if (toolName === 'rewrite_file') { this._addToolEditCheckpoint({ threadId, uri: (toolParams as BuiltinToolCallParams['rewrite_file']).uri }) }

			// 2. if tool requires approval, break from the loop, awaiting approval

			const approvalType = isBuiltInTool ? approvalTypeOfBuiltinToolName[toolName] : 'MCP tools'
			if (approvalType) {
				const autoApprove = this._settingsService.state.globalSettings.autoApprove[approvalType]
				// add a tool_request because we use it for UI if a tool is loading (this should be improved in the future)
				this._addMessageToThread(threadId, { role: 'tool', type: 'tool_request', content: '(Awaiting user permission...)', result: null, name: toolName, params: toolParams, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })
				if (!autoApprove) {
					return { awaitingUserApproval: true }
				}
			}
		}
		else {
			toolParams = opts.validatedParams
		}






		// 3. call the tool
		// this._setStreamState(threadId, { isRunning: 'tool' }, 'merge')
		const runningTool = { role: 'tool', type: 'running_now', name: toolName, params: toolParams, content: '(value not received yet...)', result: null, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName } as const
		this._updateLatestTool(threadId, runningTool)


		let interrupted = false
		let resolveInterruptor: (r: () => void) => void = () => { }
		const interruptorPromise = new Promise<() => void>(res => { resolveInterruptor = res })
		try {

			// set stream state
			this._setStreamState(threadId, { isRunning: 'tool', interrupt: interruptorPromise, toolInfo: { toolName, toolParams, id: toolId, content: 'interrupted...', rawParams: opts.unvalidatedToolParams, mcpServerName } })

			if (isBuiltInTool) {
				console.log('[ChatThreadService] Calling built-in tool:', toolName, 'with params:', toolParams)
				const { result, interruptTool } = await this._toolsService.callTool[toolName](toolParams as any)
				const interruptor = () => { interrupted = true; interruptTool?.() }
				resolveInterruptor(interruptor)

				console.log('[ChatThreadService] Tool call returned, awaiting result...')
				toolResult = await result
				console.log('[ChatThreadService] ✅ Tool result received:', {
					toolName,
					resultType: typeof toolResult,
					resultPreview: typeof toolResult === 'string' ? toolResult.substring(0, 200) : JSON.stringify(toolResult).substring(0, 200)
				})
			}
			else {
				const mcpTools = this._mcpService.getMCPTools()
				const mcpTool = mcpTools?.find(t => t.name === toolName)
				if (!mcpTool) { throw new Error(`MCP tool ${toolName} not found`) }

				resolveInterruptor(() => { })

				toolResult = (await this._mcpService.callMCPTool({
					serverName: mcpTool.mcpServerName ?? 'unknown_mcp_server',
					toolName: toolName,
					params: toolParams
				})).result
			}

			if (interrupted) { return { interrupted: true } } // the tool result is added where we interrupt, not here
		}
		catch (error) {
			resolveInterruptor(() => { }) // resolve for the sake of it
			if (interrupted) { return { interrupted: true } } // the tool result is added where we interrupt, not here

			const errorMessage = getErrorMessage(error)
			this._updateLatestTool(threadId, { role: 'tool', type: 'tool_error', params: toolParams, result: errorMessage, name: toolName, content: errorMessage, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })
			return {}
		}

		// 4. stringify the result to give to the LLM
		try {
			if (isBuiltInTool) {
				toolResultStr = this._toolsService.stringOfResult[toolName](toolParams as any, toolResult as any)
			}
			// For MCP tools, handle the result based on its type
			else {
				toolResultStr = this._mcpService.stringifyResult(toolResult as RawMCPToolCall)
			}
		} catch (error) {
			const errorMessage = this.toolErrMsgs.errWhenStringifying(error)
			this._updateLatestTool(threadId, { role: 'tool', type: 'tool_error', params: toolParams, result: errorMessage, name: toolName, content: errorMessage, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })
			return {}
		}

		// 5. add to history and keep going
		this._updateLatestTool(threadId, { role: 'tool', type: 'success', params: toolParams, result: toolResult, name: toolName, content: toolResultStr, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName })
		return {}
	};




	private async _runChatAgent({
		threadId,
		modelSelection,
		modelSelectionOptions,
		callThisToolFirst,
	}: {
		threadId: string,
		modelSelection: ModelSelection | null,
		modelSelectionOptions: ModelSelectionOptions | undefined,

		callThisToolFirst?: ToolMessage<ToolName> & { type: 'tool_request' }
	}) {


		let interruptedWhenIdle = false
		const idleInterruptor = Promise.resolve(() => { interruptedWhenIdle = true })
		// _runToolCall does not need setStreamState({idle}) before it, but it needs it after it. (handles its own setStreamState)

		// above just defines helpers, below starts the actual function
		const { chatMode } = this._settingsService.state.globalSettings // should not change as we loop even if user changes it, so it goes here
		const { overridesOfModel } = this._settingsService.state

		let nMessagesSent = 0
		let shouldSendAnotherMessage = true
		let isRunningWhenEnd: IsRunningType = undefined

		// before enter loop, call tool
		if (callThisToolFirst) {
			const { interrupted } = await this._runToolCall(threadId, callThisToolFirst.name, callThisToolFirst.id, callThisToolFirst.mcpServerName, { preapproved: true, unvalidatedToolParams: callThisToolFirst.rawParams, validatedParams: callThisToolFirst.params })
			if (interrupted) {
				this._setStreamState(threadId, undefined)
				this._addUserCheckpoint({ threadId })

			}
		}
		this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })  // just decorative, for clarity


		// tool use loop
		while (shouldSendAnotherMessage) {
			// false by default each iteration
			shouldSendAnotherMessage = false
			isRunningWhenEnd = undefined
			nMessagesSent += 1

			this._setStreamState(threadId, { isRunning: 'idle', interrupt: idleInterruptor })

			const chatMessages = this.state.allThreads[threadId]?.messages ?? []
			const { messages, separateSystemMessage } = await this._convertToLLMMessagesService.prepareLLMChatMessages({
				chatMessages,
				modelSelection,
				chatMode
			})

			if (interruptedWhenIdle) {
				this._setStreamState(threadId, undefined)
				return
			}

			let shouldRetryLLM = true
			let nAttempts = 0
			while (shouldRetryLLM) {
				shouldRetryLLM = false
				nAttempts += 1

				type ResTypes =
					| { type: 'llmDone', toolCall?: RawToolCallObj, info: { fullText: string, fullReasoning: string, anthropicReasoning: AnthropicReasoning[] | null } }
					| { type: 'llmError', error?: { message: string; fullError: Error | null; } }
					| { type: 'llmAborted' }

				let resMessageIsDonePromise: (res: ResTypes) => void // resolves when user approves this tool use (or if tool doesn't require approval)
				const messageIsDonePromise = new Promise<ResTypes>((res, rej) => { resMessageIsDonePromise = res })

				// Use cloud router service to automatically route through cloud if enabled
				const llmCancelToken = this._cloudLLMRouterService.sendLLMMessage({
					messagesType: 'chatMessages',
					chatMode,
					messages: messages,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel,
					logging: { loggingName: `Chat - ${chatMode}`, loggingExtras: { threadId, nMessagesSent, chatMode } },
					separateSystemMessage: separateSystemMessage,
					onText: ({ fullText, fullReasoning, toolCall }) => {
						const hasEditDocumentTag = fullText.includes('<edit_document>')
						const hasToolCall = !!toolCall

						// DEBUG: Check for ANY tool call XML tags (both legacy and ANTML formats)
						const hasLegacyToolTag = fullText.includes('<rag_') || fullText.includes('<read_file') || fullText.includes('<edit_') || fullText.includes('<create_file')
						const hasAntmlToolTag = fullText.includes('<function_calls>') || fullText.includes('<invoke name=')
						const hasAnyToolTag = hasLegacyToolTag || hasAntmlToolTag

						// DEBUG: If XML is present but no toolCall, the wrapper might not be working
						if ((hasEditDocumentTag || hasAnyToolTag) && !hasToolCall) {
							console.error('[ChatThreadService] ❌ TOOL CALL XML FOUND but NOT PARSED!', {
								fullTextLength: fullText.length,
								fullTextPreview: fullText.substring(0, 300),
								toolCall,
								chatMode,
								hasEditDocumentTag,
								hasLegacyToolTag,
								hasAntmlToolTag,
								note: hasAntmlToolTag
									? 'ANTML format detected - cloudLLMRouterService should parse this'
									: 'extractXMLToolsWrapper is NOT working! Check if it is being called in main process',
								likelyIssue: 'specialToolFormat may be set when it should be undefined'
							})
						}

						console.log('[ChatThreadService] onText received:', {
							fullTextLength: fullText.length,
							hasToolCall,
							toolCallInfo: toolCall ? ('name' in toolCall ? `single: ${toolCall.name}` : `multiple: ${toolCall.toolCalls.length} tools`) : 'none',
							fullTextPreview: fullText.substring(0, 200),
							hasEditDocumentTag,
							hasLegacyToolTag,
							hasAntmlToolTag,
							chatMode
						})
						this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: fullText, reasoningSoFar: fullReasoning, toolCallSoFar: toolCall ?? null }, interrupt: Promise.resolve(() => { if (llmCancelToken) this._llmMessageService.abort(llmCancelToken) }) })
					},
					onFinalMessage: async ({ fullText, fullReasoning, toolCall, anthropicReasoning, }) => {
						console.log('[ChatThreadService] onFinalMessage received:', {
							hasToolCall: !!toolCall,
							toolCallInfo: toolCall ? ('name' in toolCall ? `single: ${toolCall.name}, isDone: ${toolCall.isDone}` : `multiple: ${toolCall.toolCalls.length} tools`) : 'none',
							toolCallParams: toolCall ? ('name' in toolCall ? Object.keys(toolCall.rawParams) : toolCall.toolCalls.map(t => Object.keys(t.rawParams))) : [],
							fullTextLength: fullText.length
						})
						resMessageIsDonePromise({ type: 'llmDone', toolCall, info: { fullText, fullReasoning, anthropicReasoning } }) // resolve with tool calls
					},
					onError: async (error) => {
						resMessageIsDonePromise({ type: 'llmError', error: error })
					},
					onAbort: () => {
						// stop the loop to free up the promise, but don't modify state (already handled by whatever stopped it)
						resMessageIsDonePromise({ type: 'llmAborted' })
						this._metricsService.capture('Agent Loop Done (Aborted)', { nMessagesSent, chatMode })
					},
				})

				// mark as streaming
				if (!llmCancelToken) {
					this._setStreamState(threadId, { isRunning: undefined, error: { message: 'There was an unexpected error when sending your chat message.', fullError: null } })
					break
				}

				this._setStreamState(threadId, { isRunning: 'LLM', llmInfo: { displayContentSoFar: '', reasoningSoFar: '', toolCallSoFar: null }, interrupt: Promise.resolve(() => this._llmMessageService.abort(llmCancelToken)) })
				const llmRes = await messageIsDonePromise // wait for message to complete

				// if something else started running in the meantime
				if (this.streamState[threadId]?.isRunning !== 'LLM') {
					// console.log('Chat thread interrupted by a newer chat thread', this.streamState[threadId]?.isRunning)
					return
				}

				// llm res aborted
				if (llmRes.type === 'llmAborted') {
					this._setStreamState(threadId, undefined)
					return
				}
				// llm res error
				else if (llmRes.type === 'llmError') {
					// error, should retry
					if (nAttempts < CHAT_RETRIES) {
						shouldRetryLLM = true
						this._setStreamState(threadId, { isRunning: 'idle', interrupt: idleInterruptor })
						await timeout(RETRY_DELAY)
						if (interruptedWhenIdle) {
							this._setStreamState(threadId, undefined)
							return
						}
						else
							continue // retry
					}
					// error, but too many attempts
					else {
						const { error } = llmRes
						const { displayContentSoFar, reasoningSoFar, toolCallSoFar } = this.streamState[threadId].llmInfo
						this._addMessageToThread(threadId, { role: 'assistant', displayContent: displayContentSoFar, reasoning: reasoningSoFar, anthropicReasoning: null })
						if (toolCallSoFar) {
							const firstToolName = 'name' in toolCallSoFar ? toolCallSoFar.name : toolCallSoFar.toolCalls[0].name
							this._addMessageToThread(threadId, { role: 'interrupted_streaming_tool', name: firstToolName, mcpServerName: this._computeMCPServerOfToolName(firstToolName) })
						}

						this._setStreamState(threadId, { isRunning: undefined, error })
						this._addUserCheckpoint({ threadId })
						return
					}
				}

				// llm res success
				const { toolCall, info } = llmRes

				console.log('[ChatThreadService] LLM response received:', {
					hasToolCall: !!toolCall,
					toolCallInfo: toolCall ? ('name' in toolCall ? `single: ${toolCall.name} (id: ${toolCall.id})` : `multiple: ${toolCall.toolCalls.length} tools`) : 'none',
					fullTextLength: info.fullText.length,
					fullTextPreview: info.fullText.substring(0, 100)
				})

				// ⚠️ VALIDATION: Warn if LLM claims to have done something without a tool call
				// This helps detect when the LLM is "hallucinating" actions instead of using tools
				if (!toolCall) {
					const claimedActionPatterns = [
						"I've edited", "I've rewritten", "I've updated", "I've created", "I've modified",
						"I have edited", "I have rewritten", "I have updated", "I have created", "I have modified",
						"I've now edited", "I've now rewritten", "I've now updated", "I've now created",
						"I've completely rewritten", "I've successfully", "The file has been",
						"I made the changes", "Changes have been applied", "I updated the file"
					]
					const lowerText = info.fullText.toLowerCase()
					const claimedAction = claimedActionPatterns.find(pattern => lowerText.includes(pattern.toLowerCase()))
					if (claimedAction) {
						console.warn(`[ChatThreadService] ⚠️ LLM CLAIMS ACTION WITHOUT TOOL CALL! Pattern: "${claimedAction}"`)
						console.warn('[ChatThreadService] Response text:', info.fullText.substring(0, 300))
						console.warn('[ChatThreadService] This may indicate a tool calling failure - the LLM described an action but did not actually call the tool.')
					}
				}

				this._addMessageToThread(threadId, { role: 'assistant', displayContent: info.fullText, reasoning: info.fullReasoning, anthropicReasoning: info.anthropicReasoning })

				this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' }) // just decorative for clarity

				// call tool if there is one
				if (toolCall) {
					console.log('[ChatThreadService] ✅ Tool call(s) detected')

					// NEW: Check if multiple tool calls (ANTML format)
					if ('toolCalls' in toolCall && toolCall.format === 'antml') {
						console.log(`[ChatThreadService] 🔄 Parallel execution: ${toolCall.toolCalls.length} tools`)

						try {
							// Execute all tools in parallel
							const toolPromises = toolCall.toolCalls.map(async (singleCall) => {
								const mcpTools = this._mcpService.getMCPTools()
								const mcpTool = mcpTools?.find(t => t.name === singleCall.name)

								console.log(`[ChatThreadService] Executing tool: ${singleCall.name}`)

								return await this._runToolCall(
									threadId,
									singleCall.name,
									singleCall.id,
									mcpTool?.mcpServerName,
									{ preapproved: false, unvalidatedToolParams: singleCall.rawParams }
								)
							})

							// Wait for all to complete
							const results = await Promise.all(toolPromises)

							console.log('[ChatThreadService] ✅ All parallel tools completed:', {
								count: results.length,
								results: results.map(r => ({ awaitingUserApproval: r.awaitingUserApproval, interrupted: r.interrupted }))
							})

							// Check if any interrupted or need approval
							const interrupted = results.some(r => r.interrupted)
							const awaitingApproval = results.some(r => r.awaitingUserApproval)

							if (interrupted) {
								this._setStreamState(threadId, undefined)
								return
							}
							if (awaitingApproval) { isRunningWhenEnd = 'awaiting_user' }
							else { shouldSendAnotherMessage = true }

							this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' })
						} catch (error) {
							console.error('[ChatThreadService] ❌ ERROR executing parallel tool calls:', error)
							console.error('[ChatThreadService] Error details:', {
								errorMessage: error instanceof Error ? error.message : String(error),
								stack: error instanceof Error ? error.stack : undefined
							})
							throw error
						}
					}
					// OLD: Single tool call (legacy format or single ANTML call)
					else if ('name' in toolCall) {
						console.log('[ChatThreadService] Executing single tool:', {
							name: toolCall.name,
							id: toolCall.id,
							rawParams: toolCall.rawParams,
							isDone: toolCall.isDone,
							doneParams: toolCall.doneParams,
							rawParamsKeys: Object.keys(toolCall.rawParams)
						})
						try {
							const mcpTools = this._mcpService.getMCPTools()
							const mcpTool = mcpTools?.find(t => t.name === toolCall.name)

							console.log('[ChatThreadService] About to call _runToolCall')
							const { awaitingUserApproval, interrupted } = await this._runToolCall(threadId, toolCall.name, toolCall.id, mcpTool?.mcpServerName, { preapproved: false, unvalidatedToolParams: toolCall.rawParams })
							console.log('[ChatThreadService] ✅ Tool execution completed:', {
								name: toolCall.name,
								awaitingUserApproval,
								interrupted
							})
							if (interrupted) {
								this._setStreamState(threadId, undefined)
								return
							}
							if (awaitingUserApproval) { isRunningWhenEnd = 'awaiting_user' }
							else { shouldSendAnotherMessage = true }

							this._setStreamState(threadId, { isRunning: 'idle', interrupt: 'not_needed' }) // just decorative, for clarity
						} catch (error) {
							console.error('[ChatThreadService] ❌ ERROR executing tool call:', error)
							console.error('[ChatThreadService] Error details:', {
								name: toolCall.name,
								errorMessage: error instanceof Error ? error.message : String(error),
								stack: error instanceof Error ? error.stack : undefined
							})
							throw error // Re-throw to prevent silent failure
						}
					} else {
						console.warn('[ChatThreadService] ⚠️ Unknown tool call format:', toolCall)
					}
				} else {
					console.log('[ChatThreadService] No tool call to execute - toolCall is:', toolCall)
				}

			} // end while (attempts)
		} // end while (send message)

		// if awaiting user approval, keep isRunning true, else end isRunning
		this._setStreamState(threadId, { isRunning: isRunningWhenEnd })

		// add checkpoint before the next user message
		if (!isRunningWhenEnd) this._addUserCheckpoint({ threadId })

		// capture number of messages sent
		this._metricsService.capture('Agent Loop Done', { nMessagesSent, chatMode })
	}


	private _addCheckpoint(threadId: string, checkpoint: CheckpointEntry) {
		this._addMessageToThread(threadId, checkpoint)
		// // update latest checkpoint idx to the one we just added
		// const newThread = this.state.allThreads[threadId]
		// if (!newThread) return // should never happen
		// const currCheckpointIdx = newThread.messages.length - 1
		// this._setThreadState(threadId, { currCheckpointIdx: currCheckpointIdx })
	}



	private _editMessageInThread(threadId: string, messageIdx: number, newMessage: ChatMessage,) {
		const { allThreads } = this.state
		const oldThread = allThreads[threadId]
		if (!oldThread) return // should never happen
		// update state and store it
		const newThreads = {
			...allThreads,
			[oldThread.id]: {
				...oldThread,
				lastModified: new Date().toISOString(),
				messages: [
					...oldThread.messages.slice(0, messageIdx),
					newMessage,
					...oldThread.messages.slice(messageIdx + 1, Infinity),
				],
			}
		}
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads }) // the current thread just changed (it had a message added to it)
	}


	private _getCheckpointInfo = (checkpointMessage: ChatMessage & { role: 'checkpoint' }, fsPath: string, opts: { includeUserModifiedChanges: boolean }) => {
		const voidFileSnapshot = checkpointMessage.voidFileSnapshotOfURI ? checkpointMessage.voidFileSnapshotOfURI[fsPath] ?? null : null
		if (!opts.includeUserModifiedChanges) { return { voidFileSnapshot, } }

		const userModifiedVoidFileSnapshot = fsPath in checkpointMessage.userModifications.voidFileSnapshotOfURI ? checkpointMessage.userModifications.voidFileSnapshotOfURI[fsPath] ?? null : null
		return { voidFileSnapshot: userModifiedVoidFileSnapshot ?? voidFileSnapshot, }
	}

	private _computeNewCheckpointInfo({ threadId }: { threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		const lastCheckpointIdx = findLastIdx(thread.messages, (m) => m.role === 'checkpoint') ?? -1
		if (lastCheckpointIdx === -1) return

		const voidFileSnapshotOfURI: { [fsPath: string]: VoidFileSnapshot | undefined } = {}

		// add a change for all the URIs in the checkpoint history
		const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: 0, hiIdx: lastCheckpointIdx, }) ?? {}
		for (const fsPath in lastIdxOfURI ?? {}) {
			const { model } = this._voidModelService.getModelFromFsPath(fsPath)
			if (!model) continue
			const checkpoint2 = thread.messages[lastIdxOfURI[fsPath]] || null
			if (!checkpoint2) continue
			if (checkpoint2.role !== 'checkpoint') continue
			const res = this._getCheckpointInfo(checkpoint2, fsPath, { includeUserModifiedChanges: false })
			if (!res) continue
			const { voidFileSnapshot: oldVoidFileSnapshot } = res

			// if there was any change to the str or diffAreaSnapshot, update. rough approximation of equality, oldDiffAreasSnapshot === diffAreasSnapshot is not perfect
			const voidFileSnapshot = this._editCodeService.getVoidFileSnapshot(URI.file(fsPath))
			if (oldVoidFileSnapshot === voidFileSnapshot) continue
			voidFileSnapshotOfURI[fsPath] = voidFileSnapshot
		}

		// // add a change for all user-edited files (that aren't in the history)
		// for (const fsPath of this._userModifiedFilesToCheckInCheckpoints.keys()) {
		// 	if (fsPath in lastIdxOfURI) continue // if already visisted, don't visit again
		// 	const { model } = this._voidModelService.getModelFromFsPath(fsPath)
		// 	if (!model) continue
		// 	currStrOfFsPath[fsPath] = model.getValue(EndOfLinePreference.LF)
		// }

		return { voidFileSnapshotOfURI }
	}


	private _addUserCheckpoint({ threadId }: { threadId: string }) {
		const { voidFileSnapshotOfURI } = this._computeNewCheckpointInfo({ threadId }) ?? {}
		this._addCheckpoint(threadId, {
			role: 'checkpoint',
			type: 'user_edit',
			voidFileSnapshotOfURI: voidFileSnapshotOfURI ?? {},
			userModifications: { voidFileSnapshotOfURI: {}, },
		})
	}
	// call this right after LLM edits a file
	private _addToolEditCheckpoint({ threadId, uri, }: { threadId: string, uri: URI }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		const { model } = this._voidModelService.getModel(uri)
		if (!model) return // should never happen
		const diffAreasSnapshot = this._editCodeService.getVoidFileSnapshot(uri)
		this._addCheckpoint(threadId, {
			role: 'checkpoint',
			type: 'tool_edit',
			voidFileSnapshotOfURI: { [uri.fsPath]: diffAreasSnapshot },
			userModifications: { voidFileSnapshotOfURI: {} },
		})
	}


	private _getCheckpointBeforeMessage = ({ threadId, messageIdx }: { threadId: string, messageIdx: number }): [CheckpointEntry, number] | undefined => {
		const thread = this.state.allThreads[threadId]
		if (!thread) return undefined
		for (let i = messageIdx; i >= 0; i--) {
			const message = thread.messages[i]
			if (message.role === 'checkpoint') {
				return [message, i]
			}
		}
		return undefined
	}

	private _getCheckpointsBetween({ threadId, loIdx, hiIdx }: { threadId: string, loIdx: number, hiIdx: number }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return { lastIdxOfURI: {} } // should never happen
		const lastIdxOfURI: { [fsPath: string]: number } = {}
		for (let i = loIdx; i <= hiIdx; i += 1) {
			const message = thread.messages[i]
			if (message?.role !== 'checkpoint') continue
			for (const fsPath in message.voidFileSnapshotOfURI) { // do not include userModified.beforeStrOfURI here, jumping should not include those changes
				lastIdxOfURI[fsPath] = i
			}
		}
		return { lastIdxOfURI }
	}

	private _readCurrentCheckpoint(threadId: string): [CheckpointEntry, number] | undefined {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		const { currCheckpointIdx } = thread.state
		if (currCheckpointIdx === null) return

		const checkpoint = thread.messages[currCheckpointIdx]
		if (!checkpoint) return
		if (checkpoint.role !== 'checkpoint') return
		return [checkpoint, currCheckpointIdx]
	}
	private _addUserModificationsToCurrCheckpoint({ threadId }: { threadId: string }) {
		const { voidFileSnapshotOfURI } = this._computeNewCheckpointInfo({ threadId }) ?? {}
		const res = this._readCurrentCheckpoint(threadId)
		if (!res) return
		const [checkpoint, checkpointIdx] = res
		this._editMessageInThread(threadId, checkpointIdx, {
			...checkpoint,
			userModifications: { voidFileSnapshotOfURI: voidFileSnapshotOfURI ?? {}, },
		})
	}


	private _makeUsStandOnCheckpoint({ threadId }: { threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return
		if (thread.state.currCheckpointIdx === null) {
			const lastMsg = thread.messages[thread.messages.length - 1]
			if (lastMsg?.role !== 'checkpoint')
				this._addUserCheckpoint({ threadId })
			this._setThreadState(threadId, { currCheckpointIdx: thread.messages.length - 1 })
		}
	}

	jumpToCheckpointBeforeMessageIdx({ threadId, messageIdx, jumpToUserModified }: { threadId: string, messageIdx: number, jumpToUserModified: boolean }) {

		// if null, add a new temp checkpoint so user can jump forward again
		this._makeUsStandOnCheckpoint({ threadId })

		const thread = this.state.allThreads[threadId]
		if (!thread) return
		if (this.streamState[threadId]?.isRunning) return

		const c = this._getCheckpointBeforeMessage({ threadId, messageIdx })
		if (c === undefined) return // should never happen

		const fromIdx = thread.state.currCheckpointIdx
		if (fromIdx === null) return // should never happen

		const [_, toIdx] = c
		if (toIdx === fromIdx) return

		// console.log(`going from ${fromIdx} to ${toIdx}`)

		// update the user's checkpoint
		this._addUserModificationsToCurrCheckpoint({ threadId })

		/*
if undoing

A,B,C are all files.
x means a checkpoint where the file changed.

A B C D E F G H I
  x x x x x   x           <-- you can't always go up to find the "before" version; sometimes you need to go down
  | | | | |   | x
--x-|-|-|-x---x-|-----     <-- to
	| | | | x   x
	| | x x |
	| |   | |
----x-|---x-x-------     <-- from
	  x

We need to revert anything that happened between to+1 and from.
**We do this by finding the last x from 0...`to` for each file and applying those contents.**
We only need to do it for files that were edited since `to`, ie files between to+1...from.
*/
		if (toIdx < fromIdx) {
			const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: toIdx + 1, hiIdx: fromIdx })

			const idxes = function* () {
				for (let k = toIdx; k >= 0; k -= 1) { // first go up
					yield k
				}
				for (let k = toIdx + 1; k < thread.messages.length; k += 1) { // then go down
					yield k
				}
			}

			for (const fsPath in lastIdxOfURI) {
				// find the first instance of this file starting at toIdx (go up to latest file; if there is none, go down)
				for (const k of idxes()) {
					const message = thread.messages[k]
					if (message.role !== 'checkpoint') continue
					const res = this._getCheckpointInfo(message, fsPath, { includeUserModifiedChanges: jumpToUserModified })
					if (!res) continue
					const { voidFileSnapshot } = res
					if (!voidFileSnapshot) continue
					this._editCodeService.restoreVoidFileSnapshot(URI.file(fsPath), voidFileSnapshot)
					break
				}
			}
		}

		/*
if redoing

A B C D E F G H I J
  x x x x x   x     x
  | | | | |   | x x x
--x-|-|-|-x---x-|-|---     <-- from
	| | | | x   x
	| | x x |
	| |   | |
----x-|---x-x-----|---     <-- to
	  x           x


We need to apply latest change for anything that happened between from+1 and to.
We only need to do it for files that were edited since `from`, ie files between from+1...to.
*/
		if (toIdx > fromIdx) {
			const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: fromIdx + 1, hiIdx: toIdx })
			for (const fsPath in lastIdxOfURI) {
				// apply lowest down content for each uri
				for (let k = toIdx; k >= fromIdx + 1; k -= 1) {
					const message = thread.messages[k]
					if (message.role !== 'checkpoint') continue
					const res = this._getCheckpointInfo(message, fsPath, { includeUserModifiedChanges: jumpToUserModified })
					if (!res) continue
					const { voidFileSnapshot } = res
					if (!voidFileSnapshot) continue
					this._editCodeService.restoreVoidFileSnapshot(URI.file(fsPath), voidFileSnapshot)
					break
				}
			}
		}

		this._setThreadState(threadId, { currCheckpointIdx: toIdx })
	}


	private _wrapRunAgentToNotify(p: Promise<void>, threadId: string) {
		const notify = ({ error }: { error: string | null }) => {
			const thread = this.state.allThreads[threadId]
			if (!thread) return
			const userMsg = findLast(thread.messages, m => m.role === 'user')
			if (!userMsg) return
			if (userMsg.role !== 'user') return
			const messageContent = truncate(userMsg.displayContent, 50, '...')

			this._notificationService.notify({
				severity: error ? Severity.Warning : Severity.Info,
				message: error ? `Error: ${error} ` : `A new Chat result is ready.`,
				source: messageContent,
				sticky: true,
				actions: {
					primary: [{
						id: 'void.goToChat',
						enabled: true,
						label: `Jump to Chat`,
						tooltip: '',
						class: undefined,
						run: () => {
							this.switchToThread(threadId)
							// scroll to bottom
							this.state.allThreads[threadId]?.state.mountedInfo?.whenMounted.then(m => {
								m.scrollToBottom()
							})
						}
					}]
				},
			})
		}

		p.then(() => {
			if (threadId !== this.state.currentThreadId) notify({ error: null })
		}).catch((e) => {
			if (threadId !== this.state.currentThreadId) notify({ error: getErrorMessage(e) })
			throw e
		})
	}

	dismissStreamError(threadId: string): void {
		this._setStreamState(threadId, undefined)
	}


	private async _addUserMessageAndStreamResponse({ userMessage, _chatSelections, threadId }: { userMessage: string, _chatSelections?: StagingSelectionItem[], threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		// interrupt existing stream
		if (this.streamState[threadId]?.isRunning) {
			await this.abortRunning(threadId)
		}

		// Check for auto-summarization before adding message
		const { contextWindowAutoSummarize, contextWindowAutoSummarizeThreshold, contextWindowPreserveRecentMessages } = this._settingsService.state.globalSettings
		if (contextWindowAutoSummarize) {
			const usage = this.getContextUsage(threadId)
			if (usage && usage.usagePercent >= contextWindowAutoSummarizeThreshold) {
				// Auto-summarize before adding new message
				await this.summarizeThread(threadId, contextWindowPreserveRecentMessages)
			}
		}

		// add dummy before this message to keep checkpoint before user message idea consistent
		if (thread.messages.length === 0) {
			this._addUserCheckpoint({ threadId })
		}


		// add user's message to chat history
		const instructions = userMessage
		const currSelns: StagingSelectionItem[] = _chatSelections ?? thread.state.stagingSelections

		const userMessageContent = await chat_userMessageContent(instructions, currSelns, { directoryStrService: this._directoryStringService, fileService: this._fileService }) // user message + names of files (NOT content)
		const userHistoryElt: ChatMessage = { role: 'user', content: userMessageContent, displayContent: instructions, selections: currSelns, state: defaultMessageState }
		this._addMessageToThread(threadId, userHistoryElt)

		this._setThreadState(threadId, { currCheckpointIdx: null }) // no longer at a checkpoint because started streaming

		this._wrapRunAgentToNotify(
			this._runChatAgent({ threadId, ...this._currentModelSelectionProps(), }),
			threadId,
		)

		// scroll to bottom
		this.state.allThreads[threadId]?.state.mountedInfo?.whenMounted.then(m => {
			m.scrollToBottom()
		})
	}


	async addUserMessageAndStreamResponse({ userMessage, _chatSelections, threadId }: { userMessage: string, _chatSelections?: StagingSelectionItem[], threadId: string }) {
		const thread = this.state.allThreads[threadId];
		if (!thread) return

		// if there's a current checkpoint, delete all messages after it
		if (thread.state.currCheckpointIdx !== null) {
			const checkpointIdx = thread.state.currCheckpointIdx;
			const newMessages = thread.messages.slice(0, checkpointIdx + 1);

			// Update the thread with truncated messages
			const newThreads = {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					lastModified: new Date().toISOString(),
					messages: newMessages,
				}
			};
			this._storeAllThreads(newThreads);
			this._setState({ allThreads: newThreads });
		}

		// Now call the original method to add the user message and stream the response
		await this._addUserMessageAndStreamResponse({ userMessage, _chatSelections, threadId });

	}

	editUserMessageAndStreamResponse: IChatThreadService['editUserMessageAndStreamResponse'] = async ({ userMessage, messageIdx, threadId }) => {

		const thread = this.state.allThreads[threadId]
		if (!thread) return // should never happen

		if (thread.messages?.[messageIdx]?.role !== 'user') {
			throw new Error(`Error: editing a message with role !=='user'`)
		}

		// get prev and curr selections before clearing the message
		const currSelns = thread.messages[messageIdx].state.stagingSelections || [] // staging selections for the edited message

		// clear messages up to the index
		const slicedMessages = thread.messages.slice(0, messageIdx)
		this._setState({
			allThreads: {
				...this.state.allThreads,
				[thread.id]: {
					...thread,
					messages: slicedMessages
				}
			}
		})

		// re-add the message and stream it
		this._addUserMessageAndStreamResponse({ userMessage, _chatSelections: currSelns, threadId })
	}

	// ---------- the rest ----------

	private _getAllSeenFileURIs(threadId: string) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return []

		const fsPathsSet = new Set<string>()
		const uris: URI[] = []
		const addURI = (uri: URI) => {
			if (!fsPathsSet.has(uri.fsPath)) uris.push(uri)
			fsPathsSet.add(uri.fsPath)
			uris.push(uri)
		}

		for (const m of thread.messages) {
			// URIs of user selections
			if (m.role === 'user') {
				for (const sel of m.selections ?? []) {
					addURI(sel.uri)
				}
			}
			// URIs of files that have been read
			else if (m.role === 'tool' && m.type === 'success' && m.name === 'read_file') {
				const params = m.params as BuiltinToolCallParams['read_file']
				addURI(params.uri)
			}
		}
		return uris
	}



	getRelativeStr = (uri: URI) => {
		const isInside = this._workspaceContextService.isInsideWorkspace(uri)
		if (isInside) {
			const f = this._workspaceContextService.getWorkspace().folders.find(f => uri.fsPath.startsWith(f.uri.fsPath))
			if (f) { return uri.fsPath.replace(f.uri.fsPath, '') }
			else { return undefined }
		}
		else {
			return undefined
		}
	}


	// gets the location of codespan link so the user can click on it
	generateCodespanLink: IChatThreadService['generateCodespanLink'] = async ({ codespanStr: _codespanStr, threadId }) => {

		// process codespan to understand what we are searching for
		// TODO account for more complicated patterns eg `ITextEditorService.openEditor()`
		const functionOrMethodPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/; // `fUnCt10n_name`
		const functionParensPattern = /^([^\s(]+)\([^)]*\)$/; // `functionName( args )`

		let target = _codespanStr // the string to search for
		let codespanType: 'file-or-folder' | 'function-or-class'
		if (target.includes('.') || target.includes('/')) {

			codespanType = 'file-or-folder'
			target = _codespanStr

		} else if (functionOrMethodPattern.test(target)) {

			codespanType = 'function-or-class'
			target = _codespanStr

		} else if (functionParensPattern.test(target)) {
			const match = target.match(functionParensPattern)
			if (match && match[1]) {

				codespanType = 'function-or-class'
				target = match[1]

			}
			else { return null }
		}
		else {
			return null
		}

		// get history of all AI and user added files in conversation + store in reverse order (MRU)
		const prevUris = this._getAllSeenFileURIs(threadId).reverse()

		if (codespanType === 'file-or-folder') {
			const doesUriMatchTarget = (uri: URI) => uri.path.includes(target)

			// check if any prevFiles are the `target`
			for (const [idx, uri] of prevUris.entries()) {
				if (doesUriMatchTarget(uri)) {

					// shorten it

					// TODO make this logic more general
					const prevUriStrs = prevUris.map(uri => uri.fsPath)
					const shortenedUriStrs = shorten(prevUriStrs)
					let displayText = shortenedUriStrs[idx]
					const ellipsisIdx = displayText.lastIndexOf('…/');
					if (ellipsisIdx >= 0) {
						displayText = displayText.slice(ellipsisIdx + 2)
					}

					return { uri, displayText }
				}
			}

			// else search codebase for `target`
			let uris: URI[] = []
			try {
				const { result } = await this._toolsService.callTool['search_pathnames_only']({ query: target, includePattern: null, pageNumber: 0 })
				const { uris: uris_ } = await result
				uris = uris_
			} catch (e) {
				return null
			}

			for (const [idx, uri] of uris.entries()) {
				if (doesUriMatchTarget(uri)) {

					// TODO make this logic more general
					const prevUriStrs = prevUris.map(uri => uri.fsPath)
					const shortenedUriStrs = shorten(prevUriStrs)
					let displayText = shortenedUriStrs[idx]
					const ellipsisIdx = displayText.lastIndexOf('…/');
					if (ellipsisIdx >= 0) {
						displayText = displayText.slice(ellipsisIdx + 2)
					}


					return { uri, displayText }
				}
			}

		}


		if (codespanType === 'function-or-class') {


			// check all prevUris for the target
			for (const uri of prevUris) {

				const modelRef = await this._voidModelService.getModelSafe(uri)
				const { model } = modelRef
				if (!model) continue

				const matches = model.findMatches(
					target,
					false, // searchOnlyEditableRange
					false, // isRegex
					true,  // matchCase
					null, //' ',   // wordSeparators
					true   // captureMatches
				);

				const firstThree = matches.slice(0, 3);

				// take first 3 occurences, attempt to goto definition on them
				for (const match of firstThree) {
					const position = new Position(match.range.startLineNumber, match.range.startColumn);
					const definitionProviders = this._languageFeaturesService.definitionProvider.ordered(model);

					for (const provider of definitionProviders) {

						const _definitions = await provider.provideDefinition(model, position, CancellationToken.None);

						if (!_definitions) continue;

						const definitions = Array.isArray(_definitions) ? _definitions : [_definitions];

						for (const definition of definitions) {

							return {
								uri: definition.uri,
								selection: {
									startLineNumber: definition.range.startLineNumber,
									startColumn: definition.range.startColumn,
									endLineNumber: definition.range.endLineNumber,
									endColumn: definition.range.endColumn,
								},
								displayText: _codespanStr,
							};

							// const defModelRef = await this._textModelService.createModelReference(definition.uri);
							// const defModel = defModelRef.object.textEditorModel;

							// try {
							// 	const symbolProviders = this._languageFeaturesService.documentSymbolProvider.ordered(defModel);

							// 	for (const symbolProvider of symbolProviders) {
							// 		const symbols = await symbolProvider.provideDocumentSymbols(
							// 			defModel,
							// 			CancellationToken.None
							// 		);

							// 		if (symbols) {
							// 			const symbol = symbols.find(s => {
							// 				const symbolRange = s.range;
							// 				return symbolRange.startLineNumber <= definition.range.startLineNumber &&
							// 					symbolRange.endLineNumber >= definition.range.endLineNumber &&
							// 					(symbolRange.startLineNumber !== definition.range.startLineNumber || symbolRange.startColumn <= definition.range.startColumn) &&
							// 					(symbolRange.endLineNumber !== definition.range.endLineNumber || symbolRange.endColumn >= definition.range.endColumn);
							// 			});

							// 			// if we got to a class/function get the full range and return
							// 			if (symbol?.kind === SymbolKind.Function || symbol?.kind === SymbolKind.Method || symbol?.kind === SymbolKind.Class) {
							// 				return {
							// 					uri: definition.uri,
							// 					selection: {
							// 						startLineNumber: definition.range.startLineNumber,
							// 						startColumn: definition.range.startColumn,
							// 						endLineNumber: definition.range.endLineNumber,
							// 						endColumn: definition.range.endColumn,
							// 					}
							// 				};
							// 			}
							// 		}
							// 	}
							// } finally {
							// 	defModelRef.dispose();
							// }
						}
					}
				}
			}

			// unlike above do not search codebase (doesnt make sense)

		}

		return null

	}

	getCodespanLink({ codespanStr, messageIdx, threadId }: { codespanStr: string, messageIdx: number, threadId: string }): CodespanLocationLink | undefined {
		const thread = this.state.allThreads[threadId]
		if (!thread) return undefined;

		const links = thread.state.linksOfMessageIdx?.[messageIdx]
		if (!links) return undefined;

		const link = links[codespanStr]

		return link
	}

	async addCodespanLink({ newLinkText, newLinkLocation, messageIdx, threadId }: { newLinkText: string, newLinkLocation: CodespanLocationLink, messageIdx: number, threadId: string }) {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({

			allThreads: {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					state: {
						...thread.state,
						linksOfMessageIdx: {
							...thread.state.linksOfMessageIdx,
							[messageIdx]: {
								...thread.state.linksOfMessageIdx?.[messageIdx],
								[newLinkText]: newLinkLocation
							}
						}
					}

				}
			}
		})
	}


	getCurrentThread(): ThreadType {
		const state = this.state
		const thread = state.allThreads[state.currentThreadId]
		if (!thread) throw new Error(`Current thread should never be undefined`)
		return thread
	}

	getCurrentFocusedMessageIdx() {
		const thread = this.getCurrentThread()

		// get the focusedMessageIdx
		const focusedMessageIdx = thread.state.focusedMessageIdx
		if (focusedMessageIdx === undefined) return;

		// check that the message is actually being edited
		const focusedMessage = thread.messages[focusedMessageIdx]
		if (focusedMessage.role !== 'user') return;
		if (!focusedMessage.state) return;

		return focusedMessageIdx
	}

	isCurrentlyFocusingMessage() {
		return this.getCurrentFocusedMessageIdx() !== undefined
	}

	switchToThread(threadId: string) {
		this._setState({ currentThreadId: threadId })
	}


	openNewThread() {
		// if a thread with 0 messages already exists, switch to it
		const { allThreads: currentThreads } = this.state
		for (const threadId in currentThreads) {
			if (currentThreads[threadId]!.messages.length === 0) {
				// switch to the existing empty thread and exit
				this.switchToThread(threadId)
				return
			}
		}
		// otherwise, start a new thread
		const newThread = newThreadObject()

		// update state
		const newThreads: ChatThreads = {
			...currentThreads,
			[newThread.id]: newThread
		}
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads, currentThreadId: newThread.id })
	}


	deleteThread(threadId: string): void {
		const { allThreads: currentThreads } = this.state

		// delete the thread
		const newThreads = { ...currentThreads };
		delete newThreads[threadId];

		// store the updated threads
		this._storeAllThreads(newThreads);
		this._setState({ ...this.state, allThreads: newThreads })
	}

	duplicateThread(threadId: string) {
		const { allThreads: currentThreads } = this.state
		const threadToDuplicate = currentThreads[threadId]
		if (!threadToDuplicate) return
		const newThread = {
			...deepClone(threadToDuplicate),
			id: generateUuid(),
		}
		const newThreads = {
			...currentThreads,
			[newThread.id]: newThread,
		}
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads })
	}


	private _addMessageToThread(threadId: string, message: ChatMessage) {
		const { allThreads } = this.state
		const oldThread = allThreads[threadId]
		if (!oldThread) return // should never happen
		// update state and store it
		const newThreads = {
			...allThreads,
			[oldThread.id]: {
				...oldThread,
				lastModified: new Date().toISOString(),
				messages: [
					...oldThread.messages,
					message
				],
			}
		}
		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads }) // the current thread just changed (it had a message added to it)
	}

	// sets the currently selected message (must be undefined if no message is selected)
	setCurrentlyFocusedMessageIdx(messageIdx: number | undefined) {

		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({
			allThreads: {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					state: {
						...thread.state,
						focusedMessageIdx: messageIdx,
					}
				}
			}
		})

		// // when change focused message idx, jump - do not jump back when click edit, too confusing.
		// if (messageIdx !== undefined)
		// 	this.jumpToCheckpointBeforeMessageIdx({ threadId, messageIdx, jumpToUserModified: true })
	}


	addNewStagingSelection(newSelection: StagingSelectionItem): void {

		const focusedMessageIdx = this.getCurrentFocusedMessageIdx()

		// set the selections to the proper value
		let selections: StagingSelectionItem[] = []
		let setSelections = (s: StagingSelectionItem[]) => { }

		if (focusedMessageIdx === undefined) {
			selections = this.getCurrentThreadState().stagingSelections
			setSelections = (s: StagingSelectionItem[]) => this.setCurrentThreadState({ stagingSelections: s })
		} else {
			selections = this.getCurrentMessageState(focusedMessageIdx).stagingSelections
			setSelections = (s) => this.setCurrentMessageState(focusedMessageIdx, { stagingSelections: s })
		}

		// if matches with existing selection, overwrite (since text may change)
		const idx = findStagingSelectionIndex(selections, newSelection)
		if (idx !== null && idx !== -1) {
			setSelections([
				...selections!.slice(0, idx),
				newSelection,
				...selections!.slice(idx + 1, Infinity)
			])
		}
		// if no match, add it
		else {
			setSelections([...(selections ?? []), newSelection])
		}
	}


	// Pops the staging selections from the current thread's state
	popStagingSelections(numPops: number): void {

		numPops = numPops ?? 1;

		const focusedMessageIdx = this.getCurrentFocusedMessageIdx()

		// set the selections to the proper value
		let selections: StagingSelectionItem[] = []
		let setSelections = (s: StagingSelectionItem[]) => { }

		if (focusedMessageIdx === undefined) {
			selections = this.getCurrentThreadState().stagingSelections
			setSelections = (s: StagingSelectionItem[]) => this.setCurrentThreadState({ stagingSelections: s })
		} else {
			selections = this.getCurrentMessageState(focusedMessageIdx).stagingSelections
			setSelections = (s) => this.setCurrentMessageState(focusedMessageIdx, { stagingSelections: s })
		}

		setSelections([
			...selections.slice(0, selections.length - numPops)
		])

	}

	// set message.state
	private _setCurrentMessageState(state: Partial<UserMessageState>, messageIdx: number): void {

		const threadId = this.state.currentThreadId
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({
			allThreads: {
				...this.state.allThreads,
				[threadId]: {
					...thread,
					messages: thread.messages.map((m, i) =>
						i === messageIdx && m.role === 'user' ? {
							...m,
							state: {
								...m.state,
								...state
							},
						} : m
					)
				}
			}
		})

	}

	// set thread.state
	private _setThreadState(threadId: string, state: Partial<ThreadType['state']>, doNotRefreshMountInfo?: boolean): void {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		this._setState({
			allThreads: {
				...this.state.allThreads,
				[thread.id]: {
					...thread,
					state: {
						...thread.state,
						...state
					}
				}
			}
		}, doNotRefreshMountInfo)

	}


	// closeCurrentStagingSelectionsInThread = () => {
	// 	const currThread = this.getCurrentThreadState()

	// 	// close all stagingSelections
	// 	const closedStagingSelections = currThread.stagingSelections.map(s => ({ ...s, state: { ...s.state, isOpened: false } }))

	// 	const newThread = currThread
	// 	newThread.stagingSelections = closedStagingSelections

	// 	this.setCurrentThreadState(newThread)

	// }

	// closeCurrentStagingSelectionsInMessage: IChatThreadService['closeCurrentStagingSelectionsInMessage'] = ({ messageIdx }) => {
	// 	const currMessage = this.getCurrentMessageState(messageIdx)

	// 	// close all stagingSelections
	// 	const closedStagingSelections = currMessage.stagingSelections.map(s => ({ ...s, state: { ...s.state, isOpened: false } }))

	// 	const newMessage = currMessage
	// 	newMessage.stagingSelections = closedStagingSelections

	// 	this.setCurrentMessageState(messageIdx, newMessage)

	// }



	getCurrentThreadState = () => {
		const currentThread = this.getCurrentThread()
		return currentThread.state
	}
	setCurrentThreadState = (newState: Partial<ThreadType['state']>) => {
		this._setThreadState(this.state.currentThreadId, newState)
	}

	// gets `staging` and `setStaging` of the currently focused element, given the index of the currently selected message (or undefined if no message is selected)

	getCurrentMessageState(messageIdx: number): UserMessageState {
		const currMessage = this.getCurrentThread()?.messages?.[messageIdx]
		if (!currMessage || currMessage.role !== 'user') return defaultMessageState
		return currMessage.state
	}
	setCurrentMessageState(messageIdx: number, newState: Partial<UserMessageState>) {
		const currMessage = this.getCurrentThread()?.messages?.[messageIdx]
		if (!currMessage || currMessage.role !== 'user') return
		this._setCurrentMessageState(newState, messageIdx)
	}

	// ============================================
	// CONTEXT WINDOW MANAGEMENT
	// ============================================

	/**
	 * Get context usage information for a thread
	 */
	getContextUsage(threadId: string): { totalTokens: number; contextWindow: number; usagePercent: number } | null {
		const thread = this.state.allThreads[threadId]
		if (!thread) return null

		const modelSelection = this._settingsService.state.modelSelectionOfFeature['Chat']
		if (!modelSelection) return null

		// Use the context tracking service for calculations
		const usage = this._contextTrackingService.getContextUsageForThread(
			thread.messages,
			modelSelection.providerName,
			modelSelection.modelName
		)

		return {
			totalTokens: usage.totalTokens,
			contextWindow: usage.availableInputTokens,
			usagePercent: usage.usagePercent
		}
	}

	/**
	 * Summarize thread conversation to reduce context usage.
	 * This sends a summarization request to the LLM, then replaces older messages
	 * with a summary message while preserving recent messages.
	 */
	async summarizeThread(threadId: string, preserveCount: number = 4): Promise<void> {
		const thread = this.state.allThreads[threadId]
		if (!thread) return

		// Filter out checkpoints and get content messages only
		const contentMessages = thread.messages.filter(m =>
			m.role === 'user' || m.role === 'assistant' || m.role === 'tool'
		)

		// Need at least preserveCount + 2 messages to summarize
		if (contentMessages.length <= preserveCount + 1) {
			this._notificationService.info('Not enough messages to summarize.')
			return
		}

		// Split messages to summarize vs preserve
		const preserveStartIdx = Math.max(0, contentMessages.length - preserveCount)
		const messagesToSummarize = contentMessages.slice(0, preserveStartIdx)
		const messagesToPreserve = contentMessages.slice(preserveStartIdx)

		if (messagesToSummarize.length === 0) {
			this._notificationService.info('Nothing to summarize.')
			return
		}

		// Create a summary of the conversation
		const summaryContent = this._createConversationSummary(messagesToSummarize)

		// Build new messages array:
		// 1. Checkpoints at the beginning
		// 2. Summary message
		// 3. Preserved recent messages
		// 4. Checkpoints at the end
		const checkpointsBeforeIdx = thread.messages.findIndex(m => m.role !== 'checkpoint')
		const checkpointsBefore = checkpointsBeforeIdx > 0 ? thread.messages.slice(0, checkpointsBeforeIdx) : []

		const newMessages: ChatMessage[] = [
			...checkpointsBefore,
			// Add a new checkpoint before the summary
			{
				role: 'checkpoint',
				type: 'user_edit',
				voidFileSnapshotOfURI: {},
				userModifications: { voidFileSnapshotOfURI: {} },
			},
			// Summary as a "system-like" user message
			{
				role: 'user',
				content: `[Conversation Summary]\n${summaryContent}`,
				displayContent: `📋 **Conversation Summary** (${messagesToSummarize.length} messages condensed)\n\n${summaryContent}`,
				selections: [],
				state: {
					stagingSelections: [],
					isBeingEdited: false,
				},
			},
			// Assistant acknowledgment
			{
				role: 'assistant',
				displayContent: 'I\'ve noted the conversation summary. The context has been condensed to free up space. How can I help you continue?',
				reasoning: '',
				anthropicReasoning: null,
			},
			...messagesToPreserve,
		]

		// Update the thread with new messages
		const newThreads = {
			...this.state.allThreads,
			[threadId]: {
				...thread,
				lastModified: new Date().toISOString(),
				messages: newMessages,
			}
		}

		this._storeAllThreads(newThreads)
		this._setState({ allThreads: newThreads })

		this._notificationService.info(
			`Summarized ${messagesToSummarize.length} messages. ${messagesToPreserve.length} recent messages preserved.`
		)

		this._metricsService.capture('Thread Summarized', {
			threadId,
			messagesSummarized: messagesToSummarize.length,
			messagesPreserved: messagesToPreserve.length,
		})
	}

	/**
	 * Create a text summary of conversation messages
	 */
	private _createConversationSummary(messages: ChatMessage[]): string {
		const summaryParts: string[] = []

		// Group messages by conversation turns
		let currentTurn: string[] = []
		let lastRole: string | null = null

		for (const message of messages) {
			if (message.role === 'user') {
				if (currentTurn.length > 0 && lastRole !== 'user') {
					summaryParts.push(currentTurn.join('\n'))
					currentTurn = []
				}
				const content = message.displayContent || message.content || ''
				if (content.trim()) {
					currentTurn.push(`• User asked: ${this._truncateText(content, 200)}`)
				}
				lastRole = 'user'
			} else if (message.role === 'assistant') {
				const content = message.displayContent || ''
				if (content.trim()) {
					currentTurn.push(`• Assistant responded: ${this._truncateText(content, 300)}`)
				}
				lastRole = 'assistant'
			} else if (message.role === 'tool') {
				currentTurn.push(`• Tool "${message.name}" was used`)
				lastRole = 'tool'
			}
		}

		if (currentTurn.length > 0) {
			summaryParts.push(currentTurn.join('\n'))
		}

		return summaryParts.join('\n\n')
	}

	/**
	 * Truncate text to a maximum length with ellipsis
	 */
	private _truncateText(text: string, maxLength: number): string {
		// Remove code blocks for summary
		const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, '[code block]')
		const trimmed = withoutCodeBlocks.trim().replace(/\n+/g, ' ')
		if (trimmed.length <= maxLength) return trimmed
		return trimmed.substring(0, maxLength - 3) + '...'
	}

}

registerSingleton(IChatThreadService, ChatThreadService, InstantiationType.Eager);
