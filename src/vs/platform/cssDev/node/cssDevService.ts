/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { relative } from 'path';
import { promises } from 'fs';
import { FileAccess } from '../../../base/common/network.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

export const ICSSDevelopmentService = createDecorator<ICSSDevelopmentService>('ICSSDevelopmentService');

export interface ICSSDevelopmentService {
	_serviceBrand: undefined;
	isEnabled: boolean;
	getCssModules(): Promise<string[]>;
}

export class CSSDevelopmentService implements ICSSDevelopmentService {

	declare _serviceBrand: undefined;

	private _cssModules?: Promise<string[]>;

	constructor(
		@IEnvironmentService private readonly envService: IEnvironmentService,
		@ILogService private readonly logService: ILogService
	) { }

	get isEnabled(): boolean {
		return !this.envService.isBuilt;
	}

	getCssModules(): Promise<string[]> {
		this._cssModules ??= this.computeCssModules();
		return this._cssModules;
	}

	private async computeCssModules(): Promise<string[]> {
		if (!this.isEnabled) {
			this.logService.info('[CSS_DEV] Service is disabled (isBuilt=true)');
			return [];
		}

		this.logService.info('[CSS_DEV] Starting CSS module computation...');

		try {
			const rg = await import('@vscode/ripgrep');
			this.logService.info(`[CSS_DEV] Ripgrep path: ${rg.rgPath}`);

			return await new Promise<string[]>((resolve) => {
				const sw = StopWatch.create();
				const chunks: string[][] = [];
				const decoder = new TextDecoder();
				const basePath = FileAccess.asFileUri('').fsPath;

				this.logService.info(`[CSS_DEV] Base path: ${basePath}`);

				const process = spawn(rg.rgPath, ['-g', '**/*.css', '--files', '--no-ignore', basePath], {});

				// Add timeout to prevent hanging
				const timeout = setTimeout(() => {
					this.logService.error('[CSS_DEV] Ripgrep timeout, falling back to file system');
					process.kill();
					resolve(this.fallbackCssDetection());
				}, 10000); // 10 second timeout

				process.stdout.on('data', data => {
					const chunk = decoder.decode(data, { stream: true });
					chunks.push(chunk.split('\n').filter(Boolean));
				});

				process.stderr.on('data', data => {
					this.logService.error('[CSS_DEV] Ripgrep stderr:', data.toString());
				});

				process.on('error', err => {
					clearTimeout(timeout);
					this.logService.error('[CSS_DEV] FAILED to compute CSS data', err);
					resolve(this.fallbackCssDetection());
				});

				process.on('close', (code) => {
					clearTimeout(timeout);
					this.logService.info(`[CSS_DEV] Ripgrep process closed with code: ${code}`);
					const result = chunks.flat().map(path => relative(basePath, path).replace(/\\/g, '/')).filter(Boolean).sort();
					this.logService.info(`[CSS_DEV] DONE, ${result.length} css modules (${Math.round(sw.elapsed())}ms)`);
					if (result.length > 0) {
						this.logService.info(`[CSS_DEV] First few CSS files: ${result.slice(0, 5).join(', ')}`);
					}
					resolve(result);
				});
			});
		} catch (error) {
			this.logService.error('[CSS_DEV] Failed to import ripgrep, falling back to file system:', error);
			return this.fallbackCssDetection();
		}
	}

	private async fallbackCssDetection(): Promise<string[]> {
		this.logService.info('[CSS_DEV] Using fallback CSS detection...');

		try {
			const basePath = FileAccess.asFileUri('').fsPath;
			const cssFiles: string[] = [];

			const findCssFiles = async (dir: string): Promise<void> => {
				try {
					const entries = await promises.readdir(dir, { withFileTypes: true });

					for (const entry of entries) {
						const fullPath = `${dir}/${entry.name}`;

						if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
							await findCssFiles(fullPath);
						} else if (entry.isFile() && entry.name.endsWith('.css')) {
							const relativePath = relative(basePath, fullPath).replace(/\\/g, '/');
							cssFiles.push(relativePath);
						}
					}
				} catch (err) {
					// Ignore permission errors
				}
			};

			await findCssFiles(basePath);

			this.logService.info(`[CSS_DEV] Fallback found ${cssFiles.length} CSS files`);
			if (cssFiles.length > 0) {
				this.logService.info(`[CSS_DEV] First few CSS files: ${cssFiles.slice(0, 5).join(', ')}`);
			}

			return cssFiles.sort();
		} catch (error) {
			this.logService.error('[CSS_DEV] Fallback CSS detection failed:', error);
			return [];
		}
	}
}
