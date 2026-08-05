/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	HwCapabilityProbe,
	parseNvidiaSmiCsv,
	parseProcMeminfo,
} from '../hwCapabilityProbe';
import type { HwCapabilityProbeDeps } from '../hwCapabilityProbe';

suite('hwCapabilityProbe', () => {
	test('parseProcMeminfo reads MemTotal and MemAvailable', () => {
		const text = [
			'MemTotal:       16384000 kB',
			'MemFree:         1024000 kB',
			'MemAvailable:    8192000 kB',
		].join('\n');
		assert.deepStrictEqual(parseProcMeminfo(text), {
			totalRamMb: 16000,
			freeRamMb: 8000,
		});
	});

	test('parseProcMeminfo falls back to MemFree when MemAvailable missing', () => {
		const text = [
			'MemTotal:        4096000 kB',
			'MemFree:         2048000 kB',
		].join('\n');
		assert.deepStrictEqual(parseProcMeminfo(text), {
			totalRamMb: 4000,
			freeRamMb: 2000,
		});
	});

	test('parseNvidiaSmiCsv reads first GPU row', () => {
		assert.deepStrictEqual(
			parseNvidiaSmiCsv('NVIDIA GeForce RTX 3080, 10240\nNVIDIA GeForce RTX 3060, 12288\n'),
			{ gpuVramMb: 10240, gpuName: 'NVIDIA GeForce RTX 3080' },
		);
	});

	test('parseNvidiaSmiCsv tolerates empty stdout', () => {
		assert.deepStrictEqual(parseNvidiaSmiCsv(''), {
			gpuVramMb: undefined,
			gpuName: undefined,
		});
	});

	test('snapshot uses injected fakes and never throws on GPU failure', async () => {
		const deps: HwCapabilityProbeDeps = {
			platform: () => 'linux',
			arch: () => 'x64',
			release: () => '6.8.0-test',
			cpus: () => [{ model: 'Fake CPU', speed: 2400, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }],
			readFile: async () => [
				'MemTotal:       32768000 kB',
				'MemAvailable:   16384000 kB',
			].join('\n'),
			diskFreeMb: async () => 120_000,
			execFile: async () => {
				throw new Error('nvidia-smi missing');
			},
			now: () => 1_700_000_000_000,
		};
		const probe = new HwCapabilityProbe(deps);
		const snapshot = await probe.snapshot();
		assert.deepStrictEqual(
			{
				platform: snapshot.platform,
				arch: snapshot.arch,
				osRelease: snapshot.osRelease,
				cpuModel: snapshot.cpuModel,
				cpuCount: snapshot.cpuCount,
				totalRamMb: snapshot.totalRamMb,
				freeRamMb: snapshot.freeRamMb,
				diskFreeMb: snapshot.diskFreeMb,
				gpuVramMb: snapshot.gpuVramMb,
				gpuName: snapshot.gpuName,
				probedAt: snapshot.probedAt,
			},
			{
				platform: 'linux',
				arch: 'x64',
				osRelease: '6.8.0-test',
				cpuModel: 'Fake CPU',
				cpuCount: 1,
				totalRamMb: 32000,
				freeRamMb: 16000,
				diskFreeMb: 120000,
				gpuVramMb: undefined,
				gpuName: undefined,
				probedAt: 1_700_000_000_000,
			},
		);
	});

	test('snapshot includes nvidia-smi GPU when exec succeeds', async () => {
		const probe = new HwCapabilityProbe({
			platform: () => 'linux',
			arch: () => 'x64',
			release: () => '6.8.0',
			cpus: () => [{ model: 'CPU', speed: 1, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }],
			totalmem: () => 16 * 1024 * 1024 * 1024,
			freemem: () => 8 * 1024 * 1024 * 1024,
			diskFreeMb: async () => 50_000,
			execFile: async () => ({ stdout: 'Tesla T4, 15360\n', stderr: '' }),
			now: () => 42,
		});
		const snapshot = await probe.snapshot();
		assert.strictEqual(snapshot.gpuName, 'Tesla T4');
		assert.strictEqual(snapshot.gpuVramMb, 15360);
	});

	test('snapshot falls back to os.totalmem when meminfo unreadable', async () => {
		const probe = new HwCapabilityProbe({
			platform: () => 'linux',
			arch: () => 'x64',
			release: () => '6.8.0',
			cpus: () => [{ model: 'CPU', speed: 1, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }],
			readFile: async () => {
				throw new Error('EACCES');
			},
			totalmem: () => 8 * 1024 * 1024 * 1024,
			freemem: () => 2 * 1024 * 1024 * 1024,
			diskFreeMb: async () => 10_000,
			execFile: async () => ({ stdout: '', stderr: '' }),
			now: () => 1,
		});
		const snapshot = await probe.snapshot();
		assert.strictEqual(snapshot.totalRamMb, 8192);
		assert.strictEqual(snapshot.freeRamMb, 2048);
	});
});
