/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	ExportFormat,
	Recording,
	RecordingStatus,
	TranscriptSegment,
	TranscriptionResult
} from '../../common/audioRecorder/audioRecorderTypes.js';

// Import better-sqlite3 dynamically
let Database: typeof import('better-sqlite3') | undefined;
try {
	Database = require('better-sqlite3');
} catch {
	// Will be handled in initialize()
}

type DatabaseType = import('better-sqlite3').Database;

// ============================================================================
// Database Row Types
// ============================================================================

interface RecordingRow {
	id: string;
	workspace_id: string;
	filename: string;
	filepath: string;
	duration_seconds: number | null;
	file_size_bytes: number | null;
	sample_rate: number;
	channels: number;
	created_at: number;
	transcription_status: string;
	transcription_text: string | null;
	transcription_segments: string | null;
	transcription_language: string | null;
	is_imported: number;
	original_filename: string | null;
}

// ============================================================================
// Audio Recorder Main Service Interface
// ============================================================================

export interface IAudioRecorderMainService {
	readonly _serviceBrand: undefined;

	initialize(workspaceId: string): Promise<void>;
	switchWorkspace(workspaceId: string): Promise<void>;

	// Recording management
	getRecordings(workspaceId: string): Promise<Recording[]>;
	getRecording(workspaceId: string, id: string): Promise<Recording | undefined>;
	saveRecording(workspaceId: string, audioData: Uint8Array, filename: string, duration: number, isImported: boolean): Promise<Recording>;
	updateRecording(workspaceId: string, id: string, updates: Partial<Recording>): Promise<Recording | undefined>;
	deleteRecording(workspaceId: string, id: string): Promise<void>;

	// File operations
	getAudioData(workspaceId: string, recordingId: string): Promise<Uint8Array>;
	importAudioFile(workspaceId: string, sourcePath: string): Promise<Recording>;

	// Transcription
	updateTranscription(workspaceId: string, recordingId: string, result: TranscriptionResult): Promise<Recording | undefined>;
	updateTranscriptionStatus(workspaceId: string, recordingId: string, status: RecordingStatus): Promise<void>;

	// Export
	exportRecording(workspaceId: string, recordingId: string, format: ExportFormat): Promise<string>;
}

// ============================================================================
// Audio Recorder Main Service Implementation
// ============================================================================

export class AudioRecorderMainService implements IAudioRecorderMainService {
	readonly _serviceBrand: undefined;

	private workspaceDatabases: Map<string, DatabaseType> = new Map();
	private _currentWorkspaceId: string | null = null;

	constructor(
		@ILogService private readonly logService: ILogService
	) {
		this.logService.info('AudioRecorderMainService: Constructor called');
	}

	// ========================================================================
	// Initialization
	// ========================================================================

	async initialize(workspaceId: string): Promise<void> {
		this.logService.info(`AudioRecorderMainService: Initializing for workspace ${workspaceId}`);

		if (!Database) {
			throw new Error('better-sqlite3 is not available');
		}

		await this.ensureWorkspaceDatabase(workspaceId);
		this._currentWorkspaceId = workspaceId;
	}

	async switchWorkspace(workspaceId: string): Promise<void> {
		this.logService.info(`AudioRecorderMainService: Switching to workspace ${workspaceId}`);
		await this.ensureWorkspaceDatabase(workspaceId);
		this._currentWorkspaceId = workspaceId;
	}

	get currentWorkspaceId(): string | null {
		return this._currentWorkspaceId;
	}

	private async ensureWorkspaceDatabase(workspaceId: string): Promise<DatabaseType> {
		if (this.workspaceDatabases.has(workspaceId)) {
			return this.workspaceDatabases.get(workspaceId)!;
		}

		if (!Database) {
			throw new Error('better-sqlite3 is not available');
		}

		const dbPath = this.getDbPath(workspaceId);
		const recordingsDir = this.getRecordingsDir(workspaceId);

		// Ensure directories exist
		const dbDir = path.dirname(dbPath);
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true });
		}
		if (!fs.existsSync(recordingsDir)) {
			fs.mkdirSync(recordingsDir, { recursive: true });
		}

		const db = new Database(dbPath);
		this.createTables(db);
		this.workspaceDatabases.set(workspaceId, db);

		this.logService.info(`AudioRecorderMainService: Database initialized at ${dbPath}`);
		return db;
	}

	private getBaseDir(): string {
		const homeDir = process.env.HOME || process.env.USERPROFILE || '';
		return path.join(homeDir, '.safe-appeals-navigator', 'databases', 'workspaces');
	}

	private getDbPath(workspaceId: string): string {
		return path.join(this.getBaseDir(), workspaceId, 'audio_recordings.db');
	}

	private getRecordingsDir(workspaceId: string): string {
		return path.join(this.getBaseDir(), workspaceId, 'recordings');
	}

	private createTables(db: DatabaseType): void {
		db.exec(`
			CREATE TABLE IF NOT EXISTS recordings (
				id TEXT PRIMARY KEY,
				workspace_id TEXT NOT NULL,
				filename TEXT NOT NULL,
				filepath TEXT NOT NULL,
				duration_seconds REAL,
				file_size_bytes INTEGER,
				sample_rate INTEGER DEFAULT 16000,
				channels INTEGER DEFAULT 1,
				created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
				transcription_status TEXT DEFAULT 'pending' CHECK(transcription_status IN ('pending', 'transcribing', 'completed', 'failed')),
				transcription_text TEXT,
				transcription_segments TEXT,
				transcription_language TEXT,
				is_imported INTEGER DEFAULT 0,
				original_filename TEXT
			)
		`);

		db.exec(`
			CREATE INDEX IF NOT EXISTS idx_recordings_workspace ON recordings(workspace_id, created_at);
			CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(transcription_status);
		`);
	}

	private getDatabase(workspaceId: string): DatabaseType {
		const db = this.workspaceDatabases.get(workspaceId);
		if (!db) {
			throw new Error(`Database not initialized for workspace ${workspaceId}`);
		}
		return db;
	}

	// ========================================================================
	// Recording Management
	// ========================================================================

	async getRecordings(workspaceId: string): Promise<Recording[]> {
		const db = this.getDatabase(workspaceId);
		const stmt = db.prepare('SELECT * FROM recordings WHERE workspace_id = ? ORDER BY created_at DESC');
		const rows = stmt.all(workspaceId) as RecordingRow[];
		return rows.map(row => this.rowToRecording(row));
	}

	async getRecording(workspaceId: string, id: string): Promise<Recording | undefined> {
		const db = this.getDatabase(workspaceId);
		const stmt = db.prepare('SELECT * FROM recordings WHERE id = ? AND workspace_id = ?');
		const row = stmt.get(id, workspaceId) as RecordingRow | undefined;
		return row ? this.rowToRecording(row) : undefined;
	}

	async saveRecording(
		workspaceId: string,
		audioData: Uint8Array,
		filename: string,
		duration: number,
		isImported: boolean
	): Promise<Recording> {
		const db = this.getDatabase(workspaceId);
		const recordingsDir = this.getRecordingsDir(workspaceId);

		const id = crypto.randomUUID();
		const filepath = path.join(recordingsDir, filename);

		// Save audio file
		fs.writeFileSync(filepath, Buffer.from(audioData));
		const stats = fs.statSync(filepath);

		// Insert into database
		const stmt = db.prepare(`
			INSERT INTO recordings (id, workspace_id, filename, filepath, duration_seconds, file_size_bytes, is_imported)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		stmt.run(id, workspaceId, filename, filepath, duration, stats.size, isImported ? 1 : 0);

		const recording = await this.getRecording(workspaceId, id);
		if (!recording) {
			throw new Error('Failed to save recording');
		}

		this.logService.info(`AudioRecorderMainService: Saved recording ${id} to ${filepath}`);
		return recording;
	}

	async updateRecording(workspaceId: string, id: string, updates: Partial<Recording>): Promise<Recording | undefined> {
		const db = this.getDatabase(workspaceId);

		const allowedFields: (keyof Recording)[] = [
			'status', 'transcript', 'transcriptSegments', 'language', 'duration'
		];

		const fieldMap: Record<string, string> = {
			status: 'transcription_status',
			transcript: 'transcription_text',
			transcriptSegments: 'transcription_segments',
			language: 'transcription_language',
			duration: 'duration_seconds'
		};

		const setClause: string[] = [];
		const values: (string | number | null)[] = [];

		for (const [key, value] of Object.entries(updates)) {
			if (allowedFields.includes(key as keyof Recording)) {
				const dbField = fieldMap[key] || key;
				setClause.push(`${dbField} = ?`);

				if (key === 'transcriptSegments' && value) {
					values.push(JSON.stringify(value));
				} else {
					values.push(value as string | number | null);
				}
			}
		}

		if (setClause.length === 0) {
			return this.getRecording(workspaceId, id);
		}

		values.push(id);
		values.push(workspaceId);

		const stmt = db.prepare(`UPDATE recordings SET ${setClause.join(', ')} WHERE id = ? AND workspace_id = ?`);
		stmt.run(...values);

		return this.getRecording(workspaceId, id);
	}

	async deleteRecording(workspaceId: string, id: string): Promise<void> {
		const db = this.getDatabase(workspaceId);
		const recording = await this.getRecording(workspaceId, id);

		// Delete from database
		const stmt = db.prepare('DELETE FROM recordings WHERE id = ? AND workspace_id = ?');
		stmt.run(id, workspaceId);

		// Delete audio file
		if (recording && fs.existsSync(recording.filePath)) {
			fs.unlinkSync(recording.filePath);
			this.logService.info(`AudioRecorderMainService: Deleted recording ${id} and file ${recording.filePath}`);
		}
	}

	// ========================================================================
	// File Operations
	// ========================================================================

	async getAudioData(workspaceId: string, recordingId: string): Promise<Uint8Array> {
		const recording = await this.getRecording(workspaceId, recordingId);
		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		if (!fs.existsSync(recording.filePath)) {
			throw new Error(`Audio file not found: ${recording.filePath}`);
		}

		return fs.readFileSync(recording.filePath);
	}

	async importAudioFile(workspaceId: string, sourcePath: string): Promise<Recording> {
		const recordingsDir = this.getRecordingsDir(workspaceId);

		const originalFilename = path.basename(sourcePath);
		const id = crypto.randomUUID();
		const ext = path.extname(originalFilename);
		const filename = `imported_${id}${ext}`;
		const filepath = path.join(recordingsDir, filename);

		// Copy file
		fs.copyFileSync(sourcePath, filepath);
		const stats = fs.statSync(filepath);

		// Insert into database
		const db = this.getDatabase(workspaceId);
		const stmt = db.prepare(`
			INSERT INTO recordings (id, workspace_id, filename, filepath, file_size_bytes, is_imported, original_filename)
			VALUES (?, ?, ?, ?, ?, 1, ?)
		`);

		stmt.run(id, workspaceId, filename, filepath, stats.size, originalFilename);

		const recording = await this.getRecording(workspaceId, id);
		if (!recording) {
			throw new Error('Failed to import recording');
		}

		this.logService.info(`AudioRecorderMainService: Imported ${originalFilename} as ${id}`);
		return recording;
	}

	// ========================================================================
	// Transcription
	// ========================================================================

	async updateTranscription(workspaceId: string, recordingId: string, result: TranscriptionResult): Promise<Recording | undefined> {
		const db = this.getDatabase(workspaceId);

		const stmt = db.prepare(`
			UPDATE recordings SET
				transcription_status = 'completed',
				transcription_text = ?,
				transcription_segments = ?,
				transcription_language = ?
			WHERE id = ? AND workspace_id = ?
		`);

		stmt.run(
			result.text,
			JSON.stringify(result.segments),
			result.language,
			recordingId,
			workspaceId
		);

		return this.getRecording(workspaceId, recordingId);
	}

	async updateTranscriptionStatus(workspaceId: string, recordingId: string, status: RecordingStatus): Promise<void> {
		const db = this.getDatabase(workspaceId);
		const stmt = db.prepare('UPDATE recordings SET transcription_status = ? WHERE id = ? AND workspace_id = ?');
		stmt.run(status, recordingId, workspaceId);
	}

	// ========================================================================
	// Export
	// ========================================================================

	async exportRecording(workspaceId: string, recordingId: string, format: ExportFormat): Promise<string> {
		const recording = await this.getRecording(workspaceId, recordingId);
		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		if (!recording.transcript) {
			throw new Error('Recording has no transcript to export');
		}

		const recordingsDir = this.getRecordingsDir(workspaceId);
		const baseName = path.basename(recording.filename, path.extname(recording.filename));

		switch (format) {
			case 'txt':
				return this.exportAsTxt(recording, recordingsDir, baseName);
			case 'srt':
				return this.exportAsSrt(recording, recordingsDir, baseName);
			case 'json':
				return this.exportAsJson(recording, recordingsDir, baseName);
			case 'docx':
				return this.exportAsDocx(recording, recordingsDir, baseName);
			default:
				throw new Error(`Unsupported export format: ${format}`);
		}
	}

	private exportAsTxt(recording: Recording, dir: string, baseName: string): string {
		const filepath = path.join(dir, `${baseName}.txt`);
		fs.writeFileSync(filepath, recording.transcript || '');
		return filepath;
	}

	private exportAsSrt(recording: Recording, dir: string, baseName: string): string {
		const filepath = path.join(dir, `${baseName}.srt`);
		const segments = recording.transcriptSegments || [];

		const srtContent = segments.map((seg, i) => {
			const startTime = this.formatSrtTime(seg.start);
			const endTime = this.formatSrtTime(seg.end);
			return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text.trim()}\n`;
		}).join('\n');

		fs.writeFileSync(filepath, srtContent);
		return filepath;
	}

	private formatSrtTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 1000);
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
	}

	private exportAsJson(recording: Recording, dir: string, baseName: string): string {
		const filepath = path.join(dir, `${baseName}.json`);
		const data = {
			id: recording.id,
			filename: recording.filename,
			duration: recording.duration,
			createdAt: recording.createdAt,
			transcript: recording.transcript,
			segments: recording.transcriptSegments,
			language: recording.language
		};
		fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
		return filepath;
	}

	private async exportAsDocx(recording: Recording, dir: string, baseName: string): Promise<string> {
		const filepath = path.join(dir, `${baseName}.docx`);

		try {
			const { Document, Packer, Paragraph, TextRun } = await import('docx');

			const doc = new Document({
				sections: [{
					properties: {},
					children: [
						new Paragraph({
							children: [
								new TextRun({ text: recording.filename, bold: true, size: 28 })
							]
						}),
						new Paragraph({
							children: [
								new TextRun({
									text: `Date: ${new Date(recording.createdAt).toLocaleString()}`,
									italics: true,
									size: 20
								})
							]
						}),
						new Paragraph({ children: [] }),
						new Paragraph({
							children: [
								new TextRun({ text: recording.transcript || '' })
							]
						})
					]
				}]
			});

			const buffer = await Packer.toBuffer(doc);
			fs.writeFileSync(filepath, buffer);
		} catch (error) {
			this.logService.error('Failed to export as DOCX:', error);
			throw new Error('DOCX export failed. docx library may not be available.');
		}

		return filepath;
	}

	// ========================================================================
	// Utility
	// ========================================================================

	private rowToRecording(row: RecordingRow): Recording {
		let segments: TranscriptSegment[] | undefined;
		if (row.transcription_segments) {
			try {
				segments = JSON.parse(row.transcription_segments);
			} catch {
				segments = undefined;
			}
		}

		// Map database status to our RecordingStatus type
		const statusMap: Record<string, RecordingStatus> = {
			'pending': 'pending',
			'processing': 'transcribing',
			'transcribing': 'transcribing',
			'completed': 'completed',
			'failed': 'failed'
		};

		return {
			id: row.id,
			filename: row.filename,
			filePath: row.filepath,
			createdAt: new Date(row.created_at).toISOString(),
			duration: row.duration_seconds || 0,
			status: statusMap[row.transcription_status] || 'pending',
			transcript: row.transcription_text || undefined,
			transcriptSegments: segments,
			isImported: Boolean(row.is_imported),
			language: row.transcription_language || undefined
		};
	}
}
