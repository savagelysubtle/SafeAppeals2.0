/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	resolveActivateToast,
	resolvePrivateSearchBarState,
} from '../privateSearchStatus';

suite('privateSearchStatus', () => {
	test('resolvePrivateSearchBarState prefers indexing spinner', () => {
		assert.deepStrictEqual(
			resolvePrivateSearchBarState({
				available: true,
				disableCode: undefined,
				isSecondary: false,
				indexing: true,
				documentCount: 12,
			}),
			{
				kind: 'indexing',
				text: '$(sync~spin) Private Search',
				tooltip: 'Indexing workspace files…',
			},
		);
	});

	test('resolvePrivateSearchBarState maps models-missing to setupNeeded', () => {
		assert.deepStrictEqual(
			resolvePrivateSearchBarState({
				available: false,
				disableCode: 'models-missing',
				isSecondary: false,
				indexing: false,
				documentCount: 0,
			}),
			{
				kind: 'setupNeeded',
				text: '$(warning) Private Search',
				tooltip: 'Local search models not installed. Click for status.',
			},
		);
	});

	test('resolvePrivateSearchBarState maps secondary available to readOnlySearch', () => {
		assert.deepStrictEqual(
			resolvePrivateSearchBarState({
				available: true,
				disableCode: undefined,
				isSecondary: true,
				indexing: false,
				documentCount: 3,
			}),
			{
				kind: 'readOnlySearch',
				text: '$(search) Private Search · 3 docs (read-only)',
				tooltip: 'On-device search (read-only). Indexing runs in the main window.',
			},
		);
	});

	test('resolvePrivateSearchBarState maps native/crypto/index-lock to unavailable', () => {
		assert.strictEqual(
			resolvePrivateSearchBarState({
				available: false,
				disableCode: 'native-missing',
				isSecondary: false,
				indexing: false,
				documentCount: undefined,
			}).kind,
			'unavailable',
		);
		assert.strictEqual(
			resolvePrivateSearchBarState({
				available: false,
				disableCode: 'index-lock-busy',
				isSecondary: false,
				indexing: false,
				documentCount: undefined,
			}).kind,
			'unavailable',
		);
		assert.strictEqual(
			resolvePrivateSearchBarState({
				available: false,
				disableCode: 'crypto-unavailable',
				isSecondary: false,
				indexing: false,
				documentCount: undefined,
			}).kind,
			'unavailable',
		);
	});

	test('resolvePrivateSearchBarState ready shows doc count', () => {
		assert.deepStrictEqual(
			resolvePrivateSearchBarState({
				available: true,
				disableCode: undefined,
				isSecondary: false,
				indexing: false,
				documentCount: 7,
			}),
			{
				kind: 'ready',
				text: '$(search) Private Search · 7 docs',
				tooltip: 'On-device search. Click for status.',
			},
		);
	});

	test('resolveActivateToast covers ready, setup, and hard-disable', () => {
		assert.deepStrictEqual(
			resolveActivateToast({
				available: true,
				disableCode: undefined,
				isSecondary: false,
				indexingOrScanScheduled: true,
			}),
			{ kind: 'runningAndIndexing' },
		);
		assert.deepStrictEqual(
			resolveActivateToast({
				available: false,
				disableCode: 'models-missing',
				isSecondary: false,
				indexingOrScanScheduled: false,
			}),
			{ kind: 'modelsMissing' },
		);
		assert.deepStrictEqual(
			resolveActivateToast({
				available: false,
				disableCode: 'native-missing',
				isSecondary: false,
				indexingOrScanScheduled: false,
			}),
			{ kind: 'unavailable', code: 'native-missing' },
		);
		assert.deepStrictEqual(
			resolveActivateToast({
				available: false,
				disableCode: 'index-lock-busy',
				isSecondary: false,
				indexingOrScanScheduled: false,
			}),
			{ kind: 'unavailable', code: 'index-lock-busy' },
		);
		assert.deepStrictEqual(
			resolveActivateToast({
				available: true,
				disableCode: undefined,
				isSecondary: true,
				indexingOrScanScheduled: false,
			}),
			{ kind: 'none' },
		);
		assert.deepStrictEqual(
			resolveActivateToast({
				available: true,
				disableCode: undefined,
				isSecondary: false,
				indexingOrScanScheduled: false,
			}),
			{ kind: 'none' },
		);
	});
});
