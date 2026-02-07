/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	ExportFormat,
	Recording,
	RecordingStatus,
	TranscriptSegment,
	TranscriptionResult
} from '../../common/audioRecorder/audioRecorderTypes.js';

// Import native modules dynamically using createRequire for proper loading
// in VSCode's ES module context
const require = createRequire(import.meta.url);

let Database: typeof import('better-sqlite3') | undefined;
try {
	Database = require('better-sqlite3');
} catch {
	// Will be handled in initialize()
}

// Import whisper-node-addon for local transcription
// The transcribe function returns segments in various formats depending on whisper.cpp version
let whisperTranscribe: ((options: {
	fname_inp?: string;
	pcmf32?: Float32Array;
	model: string;
	language?: string;
	use_gpu?: boolean;
	flash_attn?: boolean;
	no_prints?: boolean;
	translate?: boolean;
	no_timestamps?: boolean;
}) => Promise<unknown>) | undefined;

try {
	const whisperAddon = require('@kutalia/whisper-node-addon');
	whisperTranscribe = whisperAddon.transcribe;
} catch {
	// Will be handled in transcribe()
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
	// audioData accepts multiple types to handle IPC serialization (Array is most reliable via IPC)
	saveRecording(workspaceId: string, audioData: Uint8Array | number[] | { [key: number]: number }, filename: string, duration: number, isImported: boolean): Promise<Recording>;
	updateRecording(workspaceId: string, id: string, updates: Partial<Recording>): Promise<Recording | undefined>;
	deleteRecording(workspaceId: string, id: string): Promise<void>;
	renameRecording(workspaceId: string, id: string, newName: string): Promise<Recording | undefined>;

	// File operations
	getAudioData(workspaceId: string, recordingId: string): Promise<Uint8Array>;
	importAudioFile(workspaceId: string, sourcePath: string): Promise<Recording>;

	// Transcription
	transcribe(workspaceId: string, recordingId: string): Promise<TranscriptionResult>;
	isModelLoaded(): boolean;
	updateTranscription(workspaceId: string, recordingId: string, result: TranscriptionResult): Promise<Recording | undefined>;
	updateTranscriptionStatus(workspaceId: string, recordingId: string, status: RecordingStatus): Promise<void>;

	// Export
	exportRecording(workspaceId: string, recordingId: string, format: ExportFormat, workspacePath?: string): Promise<string>;
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
		let db = this.workspaceDatabases.get(workspaceId);
		if (!db) {
			// Lazily initialize database if not yet initialized
			this.logService.info(`AudioRecorderMainService: Lazily initializing database for workspace ${workspaceId}`);

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

			db = new Database(dbPath);
			this.createTables(db);
			this.workspaceDatabases.set(workspaceId, db);
			this._currentWorkspaceId = workspaceId;

			this.logService.info(`AudioRecorderMainService: Lazy initialized database at ${dbPath}`);
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
		audioData: Uint8Array | number[] | { [key: number]: number },
		filename: string,
		duration: number,
		isImported: boolean
	): Promise<Recording> {
		const db = this.getDatabase(workspaceId);
		const recordingsDir = this.getRecordingsDir(workspaceId);

		const id = crypto.randomUUID();
		const filepath = path.join(recordingsDir, filename);

		// Handle IPC serialization: Uint8Array may arrive as Array or plain Object
		// when passed through Electron IPC from browser to main process
		let buffer: Buffer;
		if (audioData instanceof Uint8Array) {
			buffer = Buffer.from(audioData);
		} else if (Buffer.isBuffer(audioData)) {
			buffer = audioData;
		} else if (Array.isArray(audioData)) {
			// Array of bytes - most reliable IPC format
			buffer = Buffer.from(audioData);
		} else if (typeof audioData === 'object' && audioData !== null) {
			// IPC serialized Uint8Array may arrive as {0: byte, 1: byte, ...}
			const keys = Object.keys(audioData).map(Number).sort((a, b) => a - b);
			const bytes = new Uint8Array(keys.length);
			for (let i = 0; i < keys.length; i++) {
				bytes[i] = (audioData as Record<number, number>)[keys[i]];
			}
			buffer = Buffer.from(bytes);
		} else {
			throw new Error(`Invalid audioData type: ${typeof audioData}`);
		}

		// Save audio file
		fs.writeFileSync(filepath, buffer);
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

	async renameRecording(workspaceId: string, id: string, newName: string): Promise<Recording | undefined> {
		const db = this.getDatabase(workspaceId);
		const recording = await this.getRecording(workspaceId, id);

		if (!recording) {
			throw new Error(`Recording not found: ${id}`);
		}

		// Sanitize the new name (remove invalid characters for filenames)
		const sanitizedName = newName.replace(/[<>:"/\\|?*]/g, '_').trim();
		if (!sanitizedName) {
			throw new Error('Invalid filename');
		}

		// Ensure the new name has the correct extension
		const oldExt = path.extname(recording.filename);
		const newExt = path.extname(sanitizedName);
		const finalName = newExt ? sanitizedName : sanitizedName + oldExt;

		// Update the filename in the database (keep the same filepath - just update display name)
		const stmt = db.prepare('UPDATE recordings SET filename = ? WHERE id = ? AND workspace_id = ?');
		stmt.run(finalName, id, workspaceId);

		this.logService.info(`AudioRecorderMainService: Renamed recording ${id} from ${recording.filename} to ${finalName}`);

		return this.getRecording(workspaceId, id);
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
		// Use a unique internal filename for the file on disk to avoid conflicts
		const internalFilename = `imported_${id}${ext}`;
		const filepath = path.join(recordingsDir, internalFilename);

		// Copy file
		fs.copyFileSync(sourcePath, filepath);
		const stats = fs.statSync(filepath);

		// Try to get duration using ffprobe
		const duration = await this.getAudioDuration(filepath);
		this.logService.info(`AudioRecorderMainService: Detected duration: ${duration} seconds`);

		// Insert into database - use the ORIGINAL filename for display, internal filename for the file path
		const db = this.getDatabase(workspaceId);
		const stmt = db.prepare(`
			INSERT INTO recordings (id, workspace_id, filename, filepath, duration_seconds, file_size_bytes, is_imported, original_filename)
			VALUES (?, ?, ?, ?, ?, ?, 1, ?)
		`);

		// Use originalFilename for the display name (filename column), keep original_filename for reference
		stmt.run(id, workspaceId, originalFilename, filepath, duration, stats.size, originalFilename);

		const recording = await this.getRecording(workspaceId, id);
		if (!recording) {
			throw new Error('Failed to import recording');
		}

		this.logService.info(`AudioRecorderMainService: Imported ${originalFilename} as ${id} (duration: ${duration}s)`);
		return recording;
	}

	// ========================================================================
	// Audio Format Helpers
	// ========================================================================

	/**
	 * Get the path to bundled FFmpeg binaries, or null if not bundled
	 */
	private getBundledFFmpegDir(): string | null {
		const currentDir = path.dirname(fileURLToPath(import.meta.url));
		const platform = process.platform;
		const ffmpegBinName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

		// Check multiple possible locations for bundled FFmpeg
		const possiblePaths = [
			// Packaged app: resources folder next to the executable
			// On Windows: {install_dir}/resources/ffmpeg/win32/
			// On macOS: {app_bundle}/Contents/Resources/ffmpeg/darwin/
			// On Linux: {install_dir}/resources/ffmpeg/linux/
			path.join(process.resourcesPath || '', 'ffmpeg', platform),

			// Development: relative to source (from out folder)
			path.resolve(currentDir, '../../../../../../resources/ffmpeg', platform),

			// Development: from project root
			path.resolve(currentDir, '../../../../../../../resources/ffmpeg', platform),

			// Alternative: current working directory
			path.join(process.cwd(), 'resources', 'ffmpeg', platform),
		];

		for (const ffmpegDir of possiblePaths) {
			const ffmpegBin = path.join(ffmpegDir, ffmpegBinName);
			if (fs.existsSync(ffmpegBin)) {
				this.logService.info(`AudioRecorderMainService: Found bundled FFmpeg at ${ffmpegDir}`);
				return ffmpegDir;
			}
		}

		this.logService.info('AudioRecorderMainService: No bundled FFmpeg found, will use system FFmpeg');
		return null;
	}

	/**
	 * Get the ffmpeg command (bundled or system)
	 */
	private getFFmpegCommand(): string {
		const bundledDir = this.getBundledFFmpegDir();
		if (bundledDir) {
			return path.join(bundledDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
		}
		return 'ffmpeg';
	}

	/**
	 * Get the ffprobe command (bundled or system)
	 */
	private getFFprobeCommand(): string {
		const bundledDir = this.getBundledFFmpegDir();
		if (bundledDir) {
			return path.join(bundledDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
		}
		return 'ffprobe';
	}

	/**
	 * Check if ffmpeg is available (bundled or system)
	 */
	private async isFFmpegAvailable(): Promise<boolean> {
		const ffmpegCmd = this.getFFmpegCommand();
		return new Promise((resolve) => {
			const ffmpeg = spawn(ffmpegCmd, ['-version']);
			ffmpeg.on('error', () => resolve(false));
			ffmpeg.on('close', (code) => resolve(code === 0));
		});
	}

	/**
	 * Get audio duration using ffprobe
	 */
	private async getAudioDuration(filePath: string): Promise<number> {
		const ffprobeCmd = this.getFFprobeCommand();
		return new Promise((resolve) => {
			const ffprobe = spawn(ffprobeCmd, [
				'-v', 'error',
				'-show_entries', 'format=duration',
				'-of', 'default=noprint_wrappers=1:nokey=1',
				filePath
			]);

			let output = '';
			ffprobe.stdout.on('data', (data) => {
				output += data.toString();
			});

			ffprobe.on('error', () => {
				this.logService.warn('AudioRecorderMainService: ffprobe not available, duration will be 0');
				resolve(0);
			});

			ffprobe.on('close', () => {
				const duration = parseFloat(output.trim());
				resolve(isNaN(duration) ? 0 : duration);
			});
		});
	}

	/**
	 * Convert audio file to WAV format (16kHz, mono) for Whisper
	 * Returns the path to the converted file, or the original if already WAV
	 */
	private async convertToWavForWhisper(filePath: string): Promise<{ wavPath: string; needsCleanup: boolean }> {
		const ext = path.extname(filePath).toLowerCase();

		// If already WAV, use as-is
		if (ext === '.wav') {
			return { wavPath: filePath, needsCleanup: false };
		}

		// Check if ffmpeg is available
		const hasFFmpeg = await this.isFFmpegAvailable();
		if (!hasFFmpeg) {
			this.logService.warn('AudioRecorderMainService: ffmpeg not available, attempting direct transcription');
			return { wavPath: filePath, needsCleanup: false };
		}

		// Convert to WAV
		const tempWavPath = filePath.replace(ext, '_converted.wav');
		const ffmpegCmd = this.getFFmpegCommand();

		return new Promise((resolve, reject) => {
			this.logService.info(`AudioRecorderMainService: Converting ${ext} to WAV using ${ffmpegCmd}...`);

			const ffmpeg = spawn(ffmpegCmd, [
				'-y',           // Overwrite output file if exists
				'-i', filePath, // Input file
				'-ar', '16000', // Sample rate 16kHz (what Whisper expects)
				'-ac', '1',     // Mono channel
				'-c:a', 'pcm_s16le', // 16-bit PCM
				tempWavPath
			]);

			let stderr = '';
			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			ffmpeg.on('error', (err) => {
				this.logService.error('AudioRecorderMainService: ffmpeg conversion error:', err);
				reject(new Error(`FFmpeg conversion failed: ${err.message}`));
			});

			ffmpeg.on('close', (code) => {
				if (code === 0) {
					this.logService.info('AudioRecorderMainService: Audio converted to WAV successfully');
					resolve({ wavPath: tempWavPath, needsCleanup: true });
				} else {
					this.logService.error(`AudioRecorderMainService: ffmpeg exited with code ${code}: ${stderr}`);
					reject(new Error(`FFmpeg conversion failed with code ${code}`));
				}
			});
		});
	}

	// ========================================================================
	// Transcription
	// ========================================================================

	/**
	 * Get the path to the GGML whisper model
	 * Model is downloaded via scripts/download-whisper-model.js to resources/models/whisper/
	 */
	private getModelPath(): string {
		const currentDir = path.dirname(fileURLToPath(import.meta.url));

		// Check multiple possible locations for the model
		const possiblePaths = [
			// Development: relative to source
			path.resolve(currentDir, '../../../../../../resources/models/whisper/distil-large-v3.5/ggml-model.bin'),
			// Production: relative to out
			path.resolve(currentDir, '../../../../../../../resources/models/whisper/distil-large-v3.5/ggml-model.bin'),
			// Alternative paths
			path.join(process.cwd(), 'resources/models/whisper/distil-large-v3.5/ggml-model.bin'),
		];

		const modelPath = possiblePaths.find(p => fs.existsSync(p));
		if (!modelPath) {
			throw new Error(`Whisper model not found. Run 'node scripts/download-whisper-model.js' to download the model. Checked paths: ${possiblePaths.join(', ')}`);
		}

		return modelPath;
	}

	async transcribe(workspaceId: string, recordingId: string): Promise<TranscriptionResult> {
		const recording = await this.getRecording(workspaceId, recordingId);
		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		// Update status to transcribing
		await this.updateTranscriptionStatus(workspaceId, recordingId, 'transcribing');

		let wavConversion: { wavPath: string; needsCleanup: boolean } | null = null;

		try {
			this.logService.info(`AudioRecorderMainService: Starting transcription for ${recordingId}`);
			this.logService.info(`AudioRecorderMainService: File path: ${recording.filePath}`);

			// Check if whisper-node-addon is available
			if (!whisperTranscribe) {
				throw new Error('Whisper transcription is not available. The whisper-node-addon module failed to load.');
			}

			// Get the model path
			const modelPath = this.getModelPath();
			this.logService.info(`AudioRecorderMainService: Using model at ${modelPath}`);

			// Convert to WAV if necessary (Whisper expects WAV format)
			wavConversion = await this.convertToWavForWhisper(recording.filePath);
			this.logService.info(`AudioRecorderMainService: Using audio file: ${wavConversion.wavPath}`);

			// Run transcription using whisper-node-addon
			this.logService.info('AudioRecorderMainService: Running transcription...');
			const whisperResult = await whisperTranscribe({
				fname_inp: wavConversion.wavPath,
				model: modelPath,
				language: 'en',
				use_gpu: true,
				no_prints: true,
				translate: false,
				no_timestamps: false
			});

			// Log the raw result for debugging
			this.logService.info(`AudioRecorderMainService: Raw whisper result type: ${typeof whisperResult}`);
			this.logService.info(`AudioRecorderMainService: Raw whisper result: ${JSON.stringify(whisperResult).substring(0, 500)}`);

			// Parse the result - whisper-node-addon can return different formats
			const transcriptionResult = this.parseWhisperOutput(whisperResult);

			// Check if transcription result is empty
			if (!transcriptionResult.text || transcriptionResult.text.trim() === '') {
				this.logService.warn('AudioRecorderMainService: Transcription returned empty text');
			}

			// Save to database
			await this.updateTranscription(workspaceId, recordingId, transcriptionResult);

			this.logService.info(`AudioRecorderMainService: Transcription complete for ${recordingId}`);
			return transcriptionResult;
		} catch (error) {
			this.logService.error('AudioRecorderMainService: Transcription failed:', error);
			await this.updateTranscriptionStatus(workspaceId, recordingId, 'failed');
			throw error;
		} finally {
			// Clean up temporary WAV file if we created one
			if (wavConversion?.needsCleanup && fs.existsSync(wavConversion.wavPath)) {
				try {
					fs.unlinkSync(wavConversion.wavPath);
					this.logService.info('AudioRecorderMainService: Cleaned up temporary WAV file');
				} catch (cleanupError) {
					this.logService.warn('AudioRecorderMainService: Failed to clean up temp file:', cleanupError);
				}
			}
		}
	}

	/**
	 * Parse whisper-node-addon output into TranscriptionResult
	 * The output can be:
	 * - A string with timestamps: "[00:00:00.000 --> 00:00:05.000] Text here\n..."
	 * - An array of segment objects: [{ start: 0, end: 5000, text: "..." }, ...]
	 * - An object with segments property
	 */
	private parseWhisperOutput(output: unknown): TranscriptionResult {
		const segments: TranscriptSegment[] = [];
		let fullText = '';

		// Handle different output formats
		if (typeof output === 'string') {
			// String format with timestamps
			const lines = output.split('\n').filter(line => line.trim());

			// Parse timestamped lines like: [00:00:00.000 --> 00:00:05.000] Text here
			const timestampRegex = /\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.*)/;

			for (const line of lines) {
				const match = line.match(timestampRegex);
				if (match) {
					const startH = parseInt(match[1]);
					const startM = parseInt(match[2]);
					const startS = parseInt(match[3]);
					const startMs = parseInt(match[4]);
					const endH = parseInt(match[5]);
					const endM = parseInt(match[6]);
					const endS = parseInt(match[7]);
					const endMs = parseInt(match[8]);
					const text = match[9].trim();

					const start = startH * 3600 + startM * 60 + startS + startMs / 1000;
					const end = endH * 3600 + endM * 60 + endS + endMs / 1000;

					segments.push({ start, end, text });
					fullText += (fullText ? ' ' : '') + text;
				} else if (line.trim()) {
					// Non-timestamped text (fallback)
					fullText += (fullText ? ' ' : '') + line.trim();
				}
			}
		} else if (Array.isArray(output)) {
			// Array of segment objects
			for (const seg of output) {
				if (seg && typeof seg === 'object') {
					// Timestamps might be in milliseconds or seconds
					const start = typeof seg.start === 'number' ? (seg.start > 1000 ? seg.start / 1000 : seg.start) : 0;
					const end = typeof seg.end === 'number' ? (seg.end > 1000 ? seg.end / 1000 : seg.end) : 0;
					const text = String(seg.text || seg.speech || '').trim();

					if (text) {
						segments.push({ start, end, text });
						fullText += (fullText ? ' ' : '') + text;
					}
				}
			}
		} else if (output && typeof output === 'object') {
			// Object with various possible properties
			const obj = output as Record<string, unknown>;

			// Handle whisper-node-addon format: { transcription: [["00:00:00.000", "00:00:05.000", " text"], ...] }
			if (Array.isArray(obj.transcription)) {
				for (const seg of obj.transcription) {
					if (Array.isArray(seg) && seg.length >= 3) {
						// Format: [startTimeStr, endTimeStr, text]
						const startTimeStr = String(seg[0]);
						const endTimeStr = String(seg[1]);
						const text = String(seg[2]).trim();

						// Parse time strings like "00:00:00.000"
						const start = this.parseTimeString(startTimeStr);
						const end = this.parseTimeString(endTimeStr);

						if (text) {
							segments.push({ start, end, text });
							fullText += (fullText ? ' ' : '') + text;
						}
					}
				}
			} else if (Array.isArray(obj.segments)) {
				return this.parseWhisperOutput(obj.segments);
			} else if (typeof obj.text === 'string') {
				fullText = obj.text;
			} else if (Array.isArray(obj.results)) {
				return this.parseWhisperOutput(obj.results);
			}
		}

		return {
			text: fullText,
			segments,
			language: 'en'
		};
	}

	/**
	 * Parse a time string like "00:00:05.123" into seconds
	 */
	private parseTimeString(timeStr: string): number {
		const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
		if (match) {
			const hours = parseInt(match[1]);
			const minutes = parseInt(match[2]);
			const seconds = parseInt(match[3]);
			const milliseconds = parseInt(match[4]);
			return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
		}
		return 0;
	}

	/**
	 * Check if the transcription model is available
	 */
	isModelLoaded(): boolean {
		if (!whisperTranscribe) {
			return false;
		}
		// Check if model file exists
		try {
			this.getModelPath();
			return true;
		} catch {
			return false;
		}
	}

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

	async exportRecording(workspaceId: string, recordingId: string, format: ExportFormat, workspacePath?: string): Promise<string> {
		const recording = await this.getRecording(workspaceId, recordingId);
		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		if (!recording.transcript) {
			throw new Error('Recording has no transcript to export');
		}

		// Determine export directory: use workspace path if provided, otherwise fall back to recordings dir
		let exportDir: string;
		if (workspacePath) {
			// Export to a 'transcripts' folder in the workspace
			exportDir = path.join(workspacePath, 'transcripts');
		} else {
			// Fall back to the recordings directory in the database folder
			exportDir = this.getRecordingsDir(workspaceId);
		}

		// Ensure export directory exists
		if (!fs.existsSync(exportDir)) {
			fs.mkdirSync(exportDir, { recursive: true });
		}

		const baseName = path.basename(recording.filename, path.extname(recording.filename));

		this.logService.info(`AudioRecorderMainService: Exporting ${recordingId} to ${exportDir} as ${format}`);

		switch (format) {
			case 'txt':
				return this.exportAsTxt(recording, exportDir, baseName);
			case 'srt':
				return this.exportAsSrt(recording, exportDir, baseName);
			case 'json':
				return this.exportAsJson(recording, exportDir, baseName);
			case 'docx':
				return this.exportAsDocx(recording, exportDir, baseName);
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
