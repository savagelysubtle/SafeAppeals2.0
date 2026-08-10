/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { evaluateCdpAgentMethod, isCdpMethodDeniedForAgent } from '../../electron-browser/tools/cdpAgentDenyList.js';

suite('cdpAgentDenyList', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('allows common inspect/evaluate methods', () => {
		assert.deepStrictEqual(
			{
				runtime: evaluateCdpAgentMethod('Runtime.evaluate').denied,
				dom: evaluateCdpAgentMethod('DOM.getDocument').denied,
				css: evaluateCdpAgentMethod('CSS.getComputedStyleForNode').denied,
				perf: evaluateCdpAgentMethod('Performance.getMetrics').denied,
				networkEnable: evaluateCdpAgentMethod('Network.enable').denied,
				pageEnable: evaluateCdpAgentMethod('Page.enable').denied,
			},
			{
				runtime: false,
				dom: false,
				css: false,
				perf: false,
				networkEnable: false,
				pageEnable: false,
			},
		);
	});

	test('denies Input.*, cookies, storage, permissions, downloads, target escape', () => {
		const cases = [
			'Input.dispatchKeyEvent',
			'Input.dispatchMouseEvent',
			'Network.getCookies',
			'Network.setCookie',
			'Network.deleteCookies',
			'Network.getAllCookies',
			'Network.clearBrowserCookies',
			'Storage.getCookies',
			'IndexedDB.requestDatabaseNames',
			'CacheStorage.requestCacheNames',
			'Browser.setPermission',
			'Browser.grantPermissions',
			'Browser.resetPermissions',
			'Browser.setDownloadBehavior',
			'Page.setDownloadBehavior',
			'Target.attachToTarget',
			'Target.createTarget',
			'Target.activateTarget',
			'Target.getTargets',
			'Browser.close',
		];
		assert.deepStrictEqual(
			{
				allDenied: cases.every(isCdpMethodDeniedForAgent),
				clearCookies: isCdpMethodDeniedForAgent('Network.clearBrowserCookies'),
				empty: evaluateCdpAgentMethod('').denied,
				noDot: evaluateCdpAgentMethod('RuntimeEvaluate').denied,
				reasonIncludesBlocked: (evaluateCdpAgentMethod('Input.dispatchKeyEvent').reason ?? '').includes('blocked'),
			},
			{
				allDenied: true,
				clearCookies: true,
				empty: true,
				noDot: true,
				reasonIncludesBlocked: true,
			},
		);
	});
});
