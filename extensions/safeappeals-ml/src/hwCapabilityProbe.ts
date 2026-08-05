/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { execFile as execFileCb } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import { promisify } from 'node:util';
import type { HwSnapshot } from './types';

const execFileAsync = promisify(execFileCb);

const BYTES_PER_MB = 1024 * 1024;

export interface HwCapabilityProbeDeps {
	readonly readFile?: (path: string, encoding: BufferEncoding) => Promise<string>;
	readonly execFile?: (
		file: string,
		args: readonly string[],
		options?: { timeout?: number; encoding?: BufferEncoding },
	) => Promise<{ stdout: string; stderr: string }>;
	readonly totalmem?: () => number;
	readonly freemem?: () => number;
	readonly cpus?: () => os.CpuInfo[];
	readonly platform?: () => NodeJS.Platform;
	readonly arch?: () => string;
	readonly release?: () => string;
	readonly diskFreeMb?: (probePath: string) => Promise<number>;
	/** Path used for free-disk measurement (default: home or cwd). */
	readonly diskPath?: string;
	readonly now?: () => number;
}

/**
 * Best-effort OS/HW probe. Never throws from {@link snapshot}; failed
 * sub-probes leave fields at safe fallbacks (`undefined` for unknown GPU).
 */
export class HwCapabilityProbe {
	private readonly readFile: NonNullable<HwCapabilityProbeDeps['readFile']>;
	private readonly execFile: NonNullable<HwCapabilityProbeDeps['execFile']>;
	private readonly totalmem: () => number;
	private readonly freemem: () => number;
	private readonly cpus: () => os.CpuInfo[];
	private readonly platform: () => NodeJS.Platform;
	private readonly arch: () => string;
	private readonly release: () => string;
	private readonly diskFreeMb: (probePath: string) => Promise<number>;
	private readonly diskPath: string;
	private readonly now: () => number;

	constructor(deps: HwCapabilityProbeDeps = {}) {
		this.readFile = deps.readFile ?? ((p, enc) => fs.readFile(p, enc));
		this.execFile = deps.execFile ?? (async (file, args, options) => {
			const result = await execFileAsync(file, [...args], {
				timeout: options?.timeout ?? 5_000,
				encoding: options?.encoding ?? 'utf8',
			});
			return { stdout: String(result.stdout), stderr: String(result.stderr) };
		});
		this.totalmem = deps.totalmem ?? (() => os.totalmem());
		this.freemem = deps.freemem ?? (() => os.freemem());
		this.cpus = deps.cpus ?? (() => os.cpus());
		this.platform = deps.platform ?? (() => os.platform());
		this.arch = deps.arch ?? (() => os.arch());
		this.release = deps.release ?? (() => os.release());
		this.diskFreeMb = deps.diskFreeMb ?? (probePath => defaultDiskFreeMb(probePath));
		this.diskPath = deps.diskPath ?? (os.homedir() || process.cwd());
		this.now = deps.now ?? (() => Date.now());
	}

	async snapshot(): Promise<HwSnapshot> {
		const platform = this.platform();
		const cpuList = this.cpus();
		const ram = await this.readRamMb(platform);
		const diskFreeMb = await this.safeDiskFreeMb();
		const gpu = await this.readGpuBestEffort();

		return {
			platform,
			arch: this.arch(),
			osRelease: this.release(),
			cpuModel: cpuList[0]?.model?.trim() || 'unknown',
			cpuCount: Math.max(cpuList.length, 1),
			totalRamMb: ram.totalRamMb,
			freeRamMb: ram.freeRamMb,
			diskFreeMb,
			gpuVramMb: gpu.gpuVramMb,
			gpuName: gpu.gpuName,
			probedAt: this.now(),
		};
	}

	private async readRamMb(platform: NodeJS.Platform): Promise<{ totalRamMb: number; freeRamMb: number }> {
		if (platform === 'linux') {
			try {
				const text = await this.readFile('/proc/meminfo', 'utf8');
				const parsed = parseProcMeminfo(text);
				if (parsed) {
					return parsed;
				}
			} catch {
				// fall through to os.*
			}
		}
		return {
			totalRamMb: bytesToMb(this.totalmem()),
			freeRamMb: bytesToMb(this.freemem()),
		};
	}

	private async safeDiskFreeMb(): Promise<number> {
		try {
			const value = await this.diskFreeMb(this.diskPath);
			return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
		} catch {
			return 0;
		}
	}

	private async readGpuBestEffort(): Promise<{ gpuVramMb: number | undefined; gpuName: string | undefined }> {
		try {
			const { stdout } = await this.execFile(
				'nvidia-smi',
				['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
				{ timeout: 4_000 },
			);
			return parseNvidiaSmiCsv(stdout);
		} catch {
			return { gpuVramMb: undefined, gpuName: undefined };
		}
	}
}

export function bytesToMb(bytes: number): number {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return 0;
	}
	return Math.floor(bytes / BYTES_PER_MB);
}

/**
 * Parse Linux `/proc/meminfo`. Prefers MemAvailable for free; falls back to MemFree.
 */
export function parseProcMeminfo(text: string): { totalRamMb: number; freeRamMb: number } | undefined {
	const totalKb = matchMeminfoKb(text, 'MemTotal');
	if (totalKb === undefined) {
		return undefined;
	}
	const availableKb = matchMeminfoKb(text, 'MemAvailable') ?? matchMeminfoKb(text, 'MemFree') ?? 0;
	return {
		totalRamMb: Math.floor(totalKb / 1024),
		freeRamMb: Math.floor(availableKb / 1024),
	};
}

function matchMeminfoKb(text: string, key: string): number | undefined {
	const re = new RegExp(`^${key}:\\s*(\\d+)\\s*kB`, 'm');
	const match = re.exec(text);
	if (!match) {
		return undefined;
	}
	const value = Number(match[1]);
	return Number.isFinite(value) ? value : undefined;
}

/**
 * Parse first GPU row from `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits`.
 */
export function parseNvidiaSmiCsv(stdout: string): { gpuVramMb: number | undefined; gpuName: string | undefined } {
	const line = stdout
		.split(/\r?\n/)
		.map(l => l.trim())
		.find(l => l.length > 0);
	if (!line) {
		return { gpuVramMb: undefined, gpuName: undefined };
	}
	const comma = line.lastIndexOf(',');
	if (comma < 0) {
		return { gpuVramMb: undefined, gpuName: line || undefined };
	}
	const name = line.slice(0, comma).trim() || undefined;
	const vramRaw = Number(line.slice(comma + 1).trim());
	const gpuVramMb = Number.isFinite(vramRaw) && vramRaw > 0 ? Math.floor(vramRaw) : undefined;
	return { gpuVramMb, gpuName: name };
}

async function defaultDiskFreeMb(probePath: string): Promise<number> {
	const stats = await fs.statfs(probePath);
	const freeBytes = Number(stats.bavail) * Number(stats.bsize);
	return bytesToMb(freeBytes);
}
