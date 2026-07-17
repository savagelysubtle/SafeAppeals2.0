/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Orientation } from '../../../../../base/browser/ui/sash/sash.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import * as nls from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation, Extensions as ViewExtensions } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { IAudioRecorderService } from '../../common/audioRecorder/IAudioRecorderService.js';
import { AudioRecorderPane } from './audioRecorderPane.js';

// Import to trigger service registration
import './audioRecorderService.js';

// ============================================================================
// View Container Registration
// ============================================================================

export const AUDIO_RECORDER_VIEW_CONTAINER_ID = 'workbench.view.audioRecorder';
export const AUDIO_RECORDER_VIEW_ID = AUDIO_RECORDER_VIEW_CONTAINER_ID;

// Register view container in the Activity Bar (Sidebar)
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: AUDIO_RECORDER_VIEW_CONTAINER_ID,
	title: nls.localize2('audioRecorderContainer', 'Audio Recorder'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [AUDIO_RECORDER_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 7, // Position after Timeline
	rejectAddedViews: true,
	icon: Codicon.mic, // Microphone icon for audio recorder
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: AUDIO_RECORDER_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('audioRecorder', 'Audio Recorder'),
	ctorDescriptor: new SyncDescriptor(AudioRecorderPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 100,
	order: 1,
}], container);

// ============================================================================
// Commands / Actions
// ============================================================================

class OpenAudioRecorderAction extends Action2 {
	static readonly ID = 'void.openAudioRecorder';

	constructor() {
		super({
			id: OpenAudioRecorderAction.ID,
			title: nls.localize2('openAudioRecorder', 'Open Audio Recorder'),
			icon: Codicon.mic,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true, // Show in command palette
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(AUDIO_RECORDER_VIEW_ID, true);
	}
}

registerAction2(OpenAudioRecorderAction);

// ============================================================================
// Start Recording Action
// ============================================================================

class StartRecordingAction extends Action2 {
	static readonly ID = 'void.startRecording';

	constructor() {
		super({
			id: StartRecordingAction.ID,
			title: nls.localize2('startRecording', 'Start Audio Recording'),
			icon: Codicon.record,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const audioRecorderService = accessor.get(IAudioRecorderService);

		// Open the recorder view first
		await viewsService.openView(AUDIO_RECORDER_VIEW_ID, true);

		// Start recording
		if (audioRecorderService.state === 'idle') {
			await audioRecorderService.startRecording();
		}
	}
}

registerAction2(StartRecordingAction);

// ============================================================================
// Stop Recording Action
// ============================================================================

class StopRecordingAction extends Action2 {
	static readonly ID = 'void.stopRecording';

	constructor() {
		super({
			id: StopRecordingAction.ID,
			title: nls.localize2('stopRecording', 'Stop Audio Recording'),
			icon: Codicon.primitiveSquare,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const audioRecorderService = accessor.get(IAudioRecorderService);

		// Stop recording
		if (audioRecorderService.state === 'recording' || audioRecorderService.state === 'paused') {
			await audioRecorderService.stopRecording();
		}
	}
}

registerAction2(StopRecordingAction);

// ============================================================================
// Import Audio Action
// ============================================================================

class ImportAudioAction extends Action2 {
	static readonly ID = 'void.importAudio';

	constructor() {
		super({
			id: ImportAudioAction.ID,
			title: nls.localize2('importAudio', 'Import Audio File'),
			icon: Codicon.folderOpened,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const fileDialogService = accessor.get(IFileDialogService);
		const notificationService = accessor.get(INotificationService);
		const audioRecorderService = accessor.get(IAudioRecorderService);
		const viewsService = accessor.get(IViewsService);

		// Show file picker
		const result = await fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: [
				{ name: 'Audio Files', extensions: ['wav', 'mp3', 'm4a', 'ogg', 'webm', 'flac'] }
			],
			title: 'Import Audio File'
		});

		if (result && result.length > 0) {
			try {
				await audioRecorderService.importAudio(result[0].fsPath);
				// Open the recorder view
				await viewsService.openView(AUDIO_RECORDER_VIEW_ID, true);
				notificationService.info('Audio file imported successfully');
			} catch (error) {
				notificationService.error(`Failed to import audio file: ${error}`);
			}
		}
	}
}

registerAction2(ImportAudioAction);
