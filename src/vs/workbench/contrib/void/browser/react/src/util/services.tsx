/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import {
	DisposableStore,
	IDisposable,
} from "../../../../../../../base/common/lifecycle.js";
import { ColorScheme } from "../../../../../../../platform/theme/common/theme.js";
import { RefreshModelStateOfProvider } from "../../../../../../../workbench/contrib/void/common/refreshModelService.js";
import { VoidSettingsState } from "../../../../../../../workbench/contrib/void/common/voidSettingsService.js";
import { RefreshableProviderName } from "../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js";

import { ServicesAccessor } from "../../../../../../../editor/browser/editorExtensions.js";
import { IModelService } from "../../../../../../../editor/common/services/model.js";
import { IClipboardService } from "../../../../../../../platform/clipboard/common/clipboardService.js";
import {
	IContextMenuService,
	IContextViewService,
} from "../../../../../../../platform/contextview/browser/contextView.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { IExplorerService } from "../../../../../../../workbench/contrib/files/browser/files.js";
import { IExtensionTransferService } from "../../../../../../../workbench/contrib/void/browser/extensionTransferService.js";
import { IRefreshModelService } from "../../../../../../../workbench/contrib/void/common/refreshModelService.js";
import { IVoidSettingsService } from "../../../../../../../workbench/contrib/void/common/voidSettingsService.js";
import { ILLMMessageService } from "../../../../common/sendLLMMessageService.js";

import { URI } from "../../../../../../../base/common/uri.js";
import { ICodeEditorService } from "../../../../../../../editor/browser/services/codeEditorService.js";
import { ILanguageService } from "../../../../../../../editor/common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../../../../editor/common/languages/languageConfigurationRegistry.js";
import { ILanguageFeaturesService } from "../../../../../../../editor/common/services/languageFeatures.js";
import { IAccessibilityService } from "../../../../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import {
	IDialogService,
	IFileDialogService,
} from "../../../../../../../platform/dialogs/common/dialogs.js";
import { IEnvironmentService } from "../../../../../../../platform/environment/common/environment.js";
import { IExtensionManagementService } from "../../../../../../../platform/extensionManagement/common/extensionManagement.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { INativeHostService } from "../../../../../../../platform/native/common/native.js";
import { INotificationService } from "../../../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../../../platform/opener/common/opener.js";
import {
	IStorageService,
	StorageScope,
} from "../../../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../../../platform/workspace/common/workspace.js";
import { IMetricsService } from "../../../../../../../workbench/contrib/void/common/metricsService.js";
import { IEditorService } from "../../../../../../../workbench/services/editor/common/editorService.js";
import { IPathService } from "../../../../../../../workbench/services/path/common/pathService.js";
import { ILanguageDetectionService } from "../../../../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { ISearchService } from "../../../../../../services/search/common/search.js";
import { ITerminalService } from "../../../../../terminal/browser/terminal.js";
import { IDocumentViewerService } from "../../../../common/documentViewerService.js";
import {
	IEmailDraftService,
	IEmailService,
} from "../../../../common/emailService.js";
import { IMCPService } from "../../../../common/mcpService.js";
import { IRAGService } from "../../../../common/rag/ragService.js";
import { OPT_OUT_KEY } from "../../../../common/storageKeys.js";
import { ICalendarSyncStateService } from "../../../../common/timeline/calendarSyncTypes.js";
import { ITimelineService } from "../../../../common/timeline/timelineTypes.js";
import { IVoidModelService } from "../../../../common/voidModelService.js";
import { IGoogleCalendarClientService } from "../../../calendar/googleCalendarClientService.js";
import { IOutlookCalendarClientService } from "../../../calendar/outlookCalendarClientService.js";
import {
	IChatThreadService,
	ThreadsState,
	ThreadStreamState,
} from "../../../chatThreadService.js";
import { ICloudLLMRouterService } from "../../../cloudLLMRouterService.js";
import { IConvertToLLMMessageService } from "../../../convertToLLMMessageService.js";
import { IDocuSignService } from "../../../docuSign/docuSignService.js";
import { IEditCodeService } from "../../../editCodeServiceInterface.js";
import { IFileConverterService } from "../../../fileConverter/fileConverterService.js";
import { IFileOrganizerService } from "../../../fileOrganizer/fileOrganizerService.js";
import { IFileOrgContextService } from "../../../fileOrgContextService.js";
import { IRAGAutoIndexService } from "../../../rag/ragAutoIndexService.js";
import { ITerminalToolService } from "../../../tools/terminalToolService.js";
import { IToolsService } from "../../../tools/toolsService.js";
import { IVoidCloudService } from "../../../voidCloudService.js";
import { IVoidCommandBarService } from "../../../voidCommandBarService.js";

// normally to do this you'd use a useEffect that calls .onDidChangeState(), but useEffect mounts too late and misses initial state changes

// even if React hasn't mounted yet, the variables are always updated to the latest state.
// React listens by adding a setState function to these listeners.

let chatThreadsState: ThreadsState;
const chatThreadsStateListeners: Set<(s: ThreadsState) => void> = new Set();

let chatThreadsStreamState: ThreadStreamState;
const chatThreadsStreamStateListeners: Set<(threadId: string) => void> =
	new Set();

let settingsState: VoidSettingsState;
const settingsStateListeners: Set<(s: VoidSettingsState) => void> = new Set();

let refreshModelState: RefreshModelStateOfProvider;
const refreshModelStateListeners: Set<
	(s: RefreshModelStateOfProvider) => void
> = new Set();
const refreshModelProviderListeners: Set<
	(p: RefreshableProviderName, s: RefreshModelStateOfProvider) => void
> = new Set();

let colorThemeState: ColorScheme;
const colorThemeStateListeners: Set<(s: ColorScheme) => void> = new Set();

const ctrlKZoneStreamingStateListeners: Set<
	(diffareaid: number, s: boolean) => void
> = new Set();
const commandBarURIStateListeners: Set<(uri: URI) => void> = new Set();
const activeURIListeners: Set<(uri: URI | null) => void> = new Set();

const mcpListeners: Set<() => void> = new Set();

// File Org Context Service listeners for auto-reload
const fileOrgConfigListeners: Set<() => void> = new Set();

// must call this before you can use any of the hooks below
// this should only be called ONCE! this is the only place you don't need to dispose onDidChange. If you use state.onDidChange anywhere else, make sure to dispose it!
export const _registerServices = (accessor: ServicesAccessor) => {
	const disposables: IDisposable[] = [];

	_registerAccessor(accessor);

	const stateServices = {
		chatThreadsStateService: accessor.get(IChatThreadService),
		settingsStateService: accessor.get(IVoidSettingsService),
		refreshModelService: accessor.get(IRefreshModelService),
		themeService: accessor.get(IThemeService),
		editCodeService: accessor.get(IEditCodeService),
		voidCommandBarService: accessor.get(IVoidCommandBarService),
		modelService: accessor.get(IModelService),
		mcpService: accessor.get(IMCPService),
	};

	const {
		settingsStateService,
		chatThreadsStateService,
		refreshModelService,
		themeService,
		editCodeService,
		voidCommandBarService,
		modelService,
		mcpService,
	} = stateServices;

	chatThreadsState = chatThreadsStateService.state;
	disposables.push(
		chatThreadsStateService.onDidChangeCurrentThread(() => {
			chatThreadsState = chatThreadsStateService.state;
			chatThreadsStateListeners.forEach((l) => l(chatThreadsState));
		}),
	);

	// same service, different state
	chatThreadsStreamState = chatThreadsStateService.streamState;
	disposables.push(
		chatThreadsStateService.onDidChangeStreamState(({ threadId }) => {
			chatThreadsStreamState = chatThreadsStateService.streamState;
			chatThreadsStreamStateListeners.forEach((l) => l(threadId));
		}),
	);

	settingsState = settingsStateService.state;
	disposables.push(
		settingsStateService.onDidChangeState(() => {
			settingsState = settingsStateService.state;
			settingsStateListeners.forEach((l) => l(settingsState));
		}),
	);

	refreshModelState = refreshModelService.state;
	disposables.push(
		refreshModelService.onDidChangeState((providerName) => {
			refreshModelState = refreshModelService.state;
			refreshModelStateListeners.forEach((l) => l(refreshModelState));
			refreshModelProviderListeners.forEach((l) =>
				l(providerName, refreshModelState),
			); // no state
		}),
	);

	colorThemeState = themeService.getColorTheme().type;
	disposables.push(
		themeService.onDidColorThemeChange(({ type }) => {
			colorThemeState = type;
			colorThemeStateListeners.forEach((l) => l(colorThemeState));
		}),
	);

	// no state
	disposables.push(
		editCodeService.onDidChangeStreamingInCtrlKZone(({ diffareaid }) => {
			const isStreaming = editCodeService.isCtrlKZoneStreaming({ diffareaid });
			ctrlKZoneStreamingStateListeners.forEach((l) =>
				l(diffareaid, isStreaming),
			);
		}),
	);

	disposables.push(
		voidCommandBarService.onDidChangeState(({ uri }) => {
			commandBarURIStateListeners.forEach((l) => l(uri));
		}),
	);

	disposables.push(
		voidCommandBarService.onDidChangeActiveURI(({ uri }) => {
			activeURIListeners.forEach((l) => l(uri));
		}),
	);

	disposables.push(
		mcpService.onDidChangeState(() => {
			mcpListeners.forEach((l) => l());
		}),
	);

	// File Org Context Service - notify React when config changes
	try {
		const fileOrgContextService = accessor.get(IFileOrgContextService);
		disposables.push(
			fileOrgContextService.onDidConfigChange(() => {
				fileOrgConfigListeners.forEach((l) => l());
			}),
		);
	} catch {
		// Service may not be available in all contexts
	}

	return disposables;
};

const getReactAccessor = (accessor: ServicesAccessor) => {
	const reactAccessor = {
		IModelService: accessor.get(IModelService),
		IClipboardService: accessor.get(IClipboardService),
		IContextViewService: accessor.get(IContextViewService),
		IContextMenuService: accessor.get(IContextMenuService),
		IFileService: accessor.get(IFileService),
		IHoverService: accessor.get(IHoverService),
		IThemeService: accessor.get(IThemeService),
		ILLMMessageService: accessor.get(ILLMMessageService),
		IRefreshModelService: accessor.get(IRefreshModelService),
		IVoidSettingsService: accessor.get(IVoidSettingsService),
		IEditCodeService: accessor.get(IEditCodeService),
		IChatThreadService: accessor.get(IChatThreadService),

		IInstantiationService: accessor.get(IInstantiationService),
		ICodeEditorService: accessor.get(ICodeEditorService),
		ICommandService: accessor.get(ICommandService),
		IContextKeyService: accessor.get(IContextKeyService),
		INotificationService: accessor.get(INotificationService),
		IAccessibilityService: accessor.get(IAccessibilityService),
		ILanguageConfigurationService: accessor.get(ILanguageConfigurationService),
		ILanguageDetectionService: accessor.get(ILanguageDetectionService),
		ILanguageFeaturesService: accessor.get(ILanguageFeaturesService),
		IKeybindingService: accessor.get(IKeybindingService),
		ISearchService: accessor.get(ISearchService),

		IExplorerService: accessor.get(IExplorerService),
		IEnvironmentService: accessor.get(IEnvironmentService),
		IConfigurationService: accessor.get(IConfigurationService),
		IPathService: accessor.get(IPathService),
		IMetricsService: accessor.get(IMetricsService),
		ITerminalToolService: accessor.get(ITerminalToolService),
		ILanguageService: accessor.get(ILanguageService),
		IVoidModelService: accessor.get(IVoidModelService),
		IWorkspaceContextService: accessor.get(IWorkspaceContextService),

		IVoidCommandBarService: accessor.get(IVoidCommandBarService),
		INativeHostService: accessor.get(INativeHostService),
		IToolsService: accessor.get(IToolsService),
		IConvertToLLMMessageService: accessor.get(IConvertToLLMMessageService),
		ITerminalService: accessor.get(ITerminalService),
		IExtensionManagementService: accessor.get(IExtensionManagementService),
		IExtensionTransferService: accessor.get(IExtensionTransferService),
		IMCPService: accessor.get(IMCPService),

		IStorageService: accessor.get(IStorageService),
		IFileOrganizerService: accessor.get(IFileOrganizerService),
		IVoidCloudService: accessor.get(IVoidCloudService),
		IDialogService: accessor.get(IDialogService),
		IFileDialogService: accessor.get(IFileDialogService),
		IOpenerService: accessor.get(IOpenerService),
		IFileConverterService: accessor.get(IFileConverterService),
		IEditorService: accessor.get(IEditorService),
		URI: URI,
		ITimelineService: accessor.get(ITimelineService),
		ICalendarSyncStateService: accessor.get(ICalendarSyncStateService),
		IGoogleCalendarClientService: accessor.get(IGoogleCalendarClientService),
		IOutlookCalendarClientService: accessor.get(IOutlookCalendarClientService),
		IDocuSignService: accessor.get(IDocuSignService),
		IRAGAutoIndexService: accessor.get(IRAGAutoIndexService),
		IRAGService: accessor.get(IRAGService),
		IEmailService: accessor.get(IEmailService),
		IEmailDraftService: accessor.get(IEmailDraftService),
		ICloudLLMRouterService: accessor.get(ICloudLLMRouterService),
		IDocumentViewerService: accessor.get(IDocumentViewerService),
	} as const;
	return reactAccessor;
};

type ReactAccessor = ReturnType<typeof getReactAccessor>;

let reactAccessor_: ReactAccessor | null = null;
const _registerAccessor = (accessor: ServicesAccessor) => {
	const reactAccessor = getReactAccessor(accessor);
	reactAccessor_ = reactAccessor;
};

// -- services --
// Stable accessor wrapper to prevent re-render loops when used in useEffect dependencies
let stableAccessorWrapper_: {
	get: <S extends keyof ReactAccessor>(service: S) => ReactAccessor[S];
} | null = null;

export const useAccessor = () => {
	if (!reactAccessor_) {
		throw new Error(`⚠️ Void useAccessor was called before _registerServices!`);
	}

	// Return stable reference - don't create new object on each call
	if (!stableAccessorWrapper_) {
		stableAccessorWrapper_ = {
			get: <S extends keyof ReactAccessor>(service: S): ReactAccessor[S] =>
				reactAccessor_![service],
		};
	}

	return stableAccessorWrapper_;
};

// -- state of services --

export const useSettingsState = () => {
	const [s, ss] = useState(settingsState);
	useEffect(() => {
		ss(settingsState);
		settingsStateListeners.add(ss);
		return () => {
			settingsStateListeners.delete(ss);
		};
	}, [ss]);
	return s;
};

export const useChatThreadsState = () => {
	const [s, ss] = useState(chatThreadsState);
	useEffect(() => {
		ss(chatThreadsState);
		chatThreadsStateListeners.add(ss);
		return () => {
			chatThreadsStateListeners.delete(ss);
		};
	}, [ss]);
	return s;
	// allow user to set state natively in react
	// const ss: React.Dispatch<React.SetStateAction<ThreadsState>> = (action)=>{
	// 	_ss(action)
	// 	if (typeof action === 'function') {
	// 		const newState = action(chatThreadsState)
	// 		chatThreadsState = newState
	// 	} else {
	// 		chatThreadsState = action
	// 	}
	// }
	// return [s, ss] as const
};

export const useChatThreadsStreamState = (threadId: string) => {
	const [s, ss] = useState<ThreadStreamState[string] | undefined>(
		chatThreadsStreamState[threadId],
	);
	useEffect(() => {
		ss(chatThreadsStreamState[threadId]);
		const listener = (threadId_: string) => {
			if (threadId_ !== threadId) return;
			ss(chatThreadsStreamState[threadId]);
		};
		chatThreadsStreamStateListeners.add(listener);
		return () => {
			chatThreadsStreamStateListeners.delete(listener);
		};
	}, [ss, threadId]);
	return s;
};

export const useFullChatThreadsStreamState = () => {
	const [s, ss] = useState(chatThreadsStreamState);
	useEffect(() => {
		ss(chatThreadsStreamState);
		const listener = () => {
			ss(chatThreadsStreamState);
		};
		chatThreadsStreamStateListeners.add(listener);
		return () => {
			chatThreadsStreamStateListeners.delete(listener);
		};
	}, [ss]);
	return s;
};

export const useRefreshModelState = () => {
	const [s, ss] = useState(refreshModelState);
	useEffect(() => {
		ss(refreshModelState);
		refreshModelStateListeners.add(ss);
		return () => {
			refreshModelStateListeners.delete(ss);
		};
	}, [ss]);
	return s;
};

export const useRefreshModelListener = (
	listener: (
		providerName: RefreshableProviderName,
		s: RefreshModelStateOfProvider,
	) => void,
) => {
	useEffect(() => {
		refreshModelProviderListeners.add(listener);
		return () => {
			refreshModelProviderListeners.delete(listener);
		};
	}, [listener, refreshModelProviderListeners]);
};

export const useCtrlKZoneStreamingState = (
	listener: (diffareaid: number, s: boolean) => void,
) => {
	useEffect(() => {
		ctrlKZoneStreamingStateListeners.add(listener);
		return () => {
			ctrlKZoneStreamingStateListeners.delete(listener);
		};
	}, [listener, ctrlKZoneStreamingStateListeners]);
};

export const useIsDark = () => {
	const [s, ss] = useState(colorThemeState);
	useEffect(() => {
		ss(colorThemeState);
		colorThemeStateListeners.add(ss);
		return () => {
			colorThemeStateListeners.delete(ss);
		};
	}, [ss]);

	// s is the theme, return isDark instead of s
	const isDark = s === ColorScheme.DARK || s === ColorScheme.HIGH_CONTRAST_DARK;
	return isDark;
};

export const useCommandBarURIListener = (listener: (uri: URI) => void) => {
	useEffect(() => {
		commandBarURIStateListeners.add(listener);
		return () => {
			commandBarURIStateListeners.delete(listener);
		};
	}, [listener]);
};
export const useCommandBarState = () => {
	const accessor = useAccessor();
	const commandBarService = accessor.get("IVoidCommandBarService");
	const [s, ss] = useState({
		stateOfURI: commandBarService.stateOfURI,
		sortedURIs: commandBarService.sortedURIs,
	});
	const listener = useCallback(() => {
		ss({
			stateOfURI: commandBarService.stateOfURI,
			sortedURIs: commandBarService.sortedURIs,
		});
	}, [commandBarService]);
	useCommandBarURIListener(listener);

	return s;
};

// roughly gets the active URI - this is used to get the history of recent URIs
export const useActiveURI = () => {
	const accessor = useAccessor();
	const commandBarService = accessor.get("IVoidCommandBarService");
	const [s, ss] = useState(commandBarService.activeURI);
	useEffect(() => {
		const listener = () => {
			ss(commandBarService.activeURI);
		};
		activeURIListeners.add(listener);
		return () => {
			activeURIListeners.delete(listener);
		};
	}, []);
	return { uri: s };
};

export const useMCPServiceState = () => {
	const accessor = useAccessor();
	const mcpService = accessor.get("IMCPService");
	const [s, ss] = useState(mcpService.state);
	useEffect(() => {
		const listener = () => {
			ss(mcpService.state);
		};
		mcpListeners.add(listener);
		return () => {
			mcpListeners.delete(listener);
		};
	}, []);
	return s;
};

/**
 * Hook to listen for file org config changes (auto-reload when .fileorg.json changes)
 * Returns a counter that increments on each config change, triggering re-renders
 */
export const useFileOrgConfigListener = (onConfigChange?: () => void) => {
	const [changeCounter, setChangeCounter] = useState(0);

	useEffect(() => {
		const listener = () => {
			setChangeCounter((c) => c + 1);
			onConfigChange?.();
		};
		fileOrgConfigListeners.add(listener);
		return () => {
			fileOrgConfigListeners.delete(listener);
		};
	}, [onConfigChange]);

	return changeCounter;
};

export const useIsOptedOut = () => {
	const accessor = useAccessor();
	const storageService = accessor.get("IStorageService");

	const getVal = useCallback(() => {
		return storageService.getBoolean(
			OPT_OUT_KEY,
			StorageScope.APPLICATION,
			false,
		);
	}, [storageService]);

	const [s, ss] = useState(getVal());

	useEffect(() => {
		const disposables = new DisposableStore();
		const d = storageService.onDidChangeValue(
			StorageScope.APPLICATION,
			OPT_OUT_KEY,
			disposables,
		)((e) => {
			ss(getVal());
		});
		disposables.add(d);
		return () => disposables.clear();
	}, [storageService, getVal]);

	return s;
};

// Cloud service state hook
export const useVoidCloudState = () => {
	const accessor = useAccessor();
	const cloudService = accessor.get("IVoidCloudService");

	const [authState, setAuthState] = useState(cloudService.authState);
	const [creditBalance, setCreditBalance] = useState(
		cloudService.creditBalance,
	);
	const [isOnline, setIsOnline] = useState(cloudService.isOnline());

	useEffect(() => {
		// Update to current state
		setAuthState(cloudService.authState);
		setCreditBalance(cloudService.creditBalance);
		setIsOnline(cloudService.isOnline());

		const disposables = new DisposableStore();

		// Listen for auth state changes
		disposables.add(
			cloudService.onAuthStateChange((event) => {
				setAuthState(cloudService.authState);
			}),
		);

		// Listen for balance changes
		disposables.add(
			cloudService.onBalanceChange((event) => {
				setCreditBalance(event.balance);
			}),
		);

		// Listen for network changes
		disposables.add(
			cloudService.onNetworkChange((event) => {
				setIsOnline(event.isOnline);
			}),
		);

		return () => disposables.dispose();
	}, [cloudService]);

	return {
		authState,
		creditBalance,
		isOnline,
		isSignedIn: cloudService.isSignedIn(),
		isLowCredits: cloudService.isLowCredits(),
		signInWithGoogle: () => cloudService.signInWithGoogle(),
		signOut: () => cloudService.signOut(),
		createCheckoutSession: (packId: "starter" | "pro") =>
			cloudService.createCheckoutSession(packId),
		refreshBalance: () => cloudService.fetchBalance(),
	};
};
