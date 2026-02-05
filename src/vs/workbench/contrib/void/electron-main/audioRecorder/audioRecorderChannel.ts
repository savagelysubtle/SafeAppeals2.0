/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { IChannel, IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import {
	ExportFormat,
	Recording,
	RecordingStatus,
	TranscriptionResult
} from '../../common/audioRecorder/audioRecorderTypes.js';
import { IAudioRecorderMainService } from './audioRecorderMainService.js';

// ============================================================================
// Audio Recorder IPC Channel (Main Process Side)
// ============================================================================

export class AudioRecorderChannel implements IServerChannel {
	constructor(private service: IAudioRecorderMainService) {
		console.log('[AudioRecorderChannel] Constructor called');
	}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_ctx: unknown, command: string, args?: any): Promise<any> {
		const workspaceId = args?.workspaceId;

		console.log(`[AudioRecorderChannel] IPC call: ${command} | workspaceId: ${workspaceId}`);

		switch (command) {
			case 'initialize':
				return this.service.initialize(workspaceId);

			case 'switchWorkspace':
				return this.service.switchWorkspace(workspaceId);

			case 'getRecordings':
				return this.service.getRecordings(workspaceId);

			case 'getRecording':
				return this.service.getRecording(workspaceId, args.id);

			case 'saveRecording':
				return this.service.saveRecording(
					workspaceId,
					args.audioData,
					args.filename,
					args.duration,
					args.isImported
				);

			case 'updateRecording':
				return this.service.updateRecording(workspaceId, args.id, args.updates);

			case 'deleteRecording':
				return this.service.deleteRecording(workspaceId, args.id);

			case 'getAudioData':
				return this.service.getAudioData(workspaceId, args.recordingId);

			case 'importAudioFile':
				return this.service.importAudioFile(workspaceId, args.sourcePath);

			case 'updateTranscription':
				return this.service.updateTranscription(workspaceId, args.recordingId, args.result);

			case 'updateTranscriptionStatus':
				return this.service.updateTranscriptionStatus(workspaceId, args.recordingId, args.status);

			case 'exportRecording':
				return this.service.exportRecording(workspaceId, args.recordingId, args.format);

			default:
				throw new Error(`Unknown command: ${command}`);
		}
	}
}

// ============================================================================
// Audio Recorder Channel Client (Browser Process Side)
// ============================================================================

export class AudioRecorderChannelClient {
	constructor(private readonly channel: IChannel) { }

	async initialize(workspaceId: string): Promise<void> {
		return this.channel.call('initialize', { workspaceId });
	}

	async switchWorkspace(workspaceId: string): Promise<void> {
		return this.channel.call('switchWorkspace', { workspaceId });
	}

	async getRecordings(workspaceId: string): Promise<Recording[]> {
		return this.channel.call('getRecordings', { workspaceId });
	}

	async getRecording(workspaceId: string, id: string): Promise<Recording | undefined> {
		return this.channel.call('getRecording', { workspaceId, id });
	}

	async saveRecording(
		workspaceId: string,
		audioData: Uint8Array,
		filename: string,
		duration: number,
		isImported: boolean
	): Promise<Recording> {
		return this.channel.call('saveRecording', {
			workspaceId,
			audioData,
			filename,
			duration,
			isImported
		});
	}

	async updateRecording(workspaceId: string, id: string, updates: Partial<Recording>): Promise<Recording | undefined> {
		return this.channel.call('updateRecording', { workspaceId, id, updates });
	}

	async deleteRecording(workspaceId: string, id: string): Promise<void> {
		return this.channel.call('deleteRecording', { workspaceId, id });
	}

	async getAudioData(workspaceId: string, recordingId: string): Promise<Uint8Array> {
		return this.channel.call('getAudioData', { workspaceId, recordingId });
	}

	async importAudioFile(workspaceId: string, sourcePath: string): Promise<Recording> {
		return this.channel.call('importAudioFile', { workspaceId, sourcePath });
	}

	async updateTranscription(workspaceId: string, recordingId: string, result: TranscriptionResult): Promise<Recording | undefined> {
		return this.channel.call('updateTranscription', { workspaceId, recordingId, result });
	}

	async updateTranscriptionStatus(workspaceId: string, recordingId: string, status: RecordingStatus): Promise<void> {
		return this.channel.call('updateTranscriptionStatus', { workspaceId, recordingId, status });
	}

	async exportRecording(workspaceId: string, recordingId: string, format: ExportFormat): Promise<string> {
		return this.channel.call('exportRecording', { workspaceId, recordingId, format });
	}
}
