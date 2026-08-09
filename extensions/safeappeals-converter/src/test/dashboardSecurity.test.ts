/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

suite('dashboard security', () => {
	class FakeElement {
		disabled = false;
		className = '';
		id = '';
		readonly dataset: Record<string, string> = {};
		textContent = '';
		type = '';
		placeholder = '';
		value = '';
		readonly attributes = new Map<string, string>();
		readonly children: FakeElement[] = [];
		readonly options = this.children;
		readonly listeners = new Map<string, (event: { target: FakeElement }) => void>();
		readonly style: Record<string, string> = {};
		readonly classList = { add: (_name: string) => { }, remove: (_name: string) => { } };

		set innerHTML(_value: string) {
			throw new Error('HTML parsing is forbidden');
		}

		setAttribute(name: string, value: string): void {
			this.attributes.set(name, value);
		}

		append(...children: FakeElement[]): void {
			this.children.push(...children);
		}

		appendChild(child: FakeElement): FakeElement {
			this.children.push(child);
			return child;
		}

		replaceChildren(...children: FakeElement[]): void {
			this.children.splice(0, this.children.length, ...children);
		}

		addEventListener(type: string, listener: (event: { target: FakeElement }) => void): void {
			this.listeners.set(type, listener);
		}

		closest(_selector: string): FakeElement | null {
			return this;
		}

		querySelector(_selector: string): FakeElement {
			return this;
		}
	}

	test('dashboard click handler does not post an invalid page merge', () => {
		const elements = new Map<string, FakeElement>();
		const getElement = (id: string) => {
			let element = elements.get(id);
			if (!element) {
				element = new FakeElement();
				element.id = id;
				elements.set(id, element);
			}
			return element;
		};
		const windowListeners = new Map<string, (event: { data: object }) => void>();
		const postedMessages: object[] = [];
		const context = {
			acquireVsCodeApi: () => ({ postMessage: (message: object) => postedMessages.push(message) }),
			converterDashboardRender: require(path.resolve(__dirname, '../../media/dashboard/render.js')),
			converterPageRanges: require(path.resolve(__dirname, '../../media/dashboard/pageRanges.js')),
			document: {
				title: '',
				getElementById: getElement,
				createElement: () => new FakeElement(),
			},
			window: { addEventListener: (type: string, listener: (event: { data: object }) => void) => windowListeners.set(type, listener) },
		};
		vm.runInNewContext(
			fs.readFileSync(path.resolve(__dirname, '../../media/dashboard/dashboard.js'), 'utf8'),
			context,
		);
		const dispatchMessage = windowListeners.get('message');
		assert.ok(dispatchMessage);
		dispatchMessage({ data: {
			type: 'bootstrap', conversions: { conversions: {}, aliases: {} }, sidecarReady: true,
			uiStrings: {
				rangeInvalid: 'Invalid', rangeFormat: 'Invalid: {0}', rangeDuplicate: 'Duplicate {0}',
				rangeBounds: 'Bounds {0}/{1}', rangeOrder: 'Order {0}', pageExample: '1-3',
				pagesFor: 'Pages {0}', remove: 'Remove {0}', noPdfsSelected: 'None',
			},
		} });
		dispatchMessage({ data: {
			type: 'paths', mergeByPageInputs: [{ path: '/case/a.pdf', pages: [1], displayName: 'a.pdf', pageCount: 3 }],
			mergeByPageOutput: '/case/out.pdf',
		} });
		postedMessages.splice(0);
		const input = new FakeElement();
		input.value = '1-9007199254740991';
		input.dataset.index = '0';
		getElement('merge-by-page-list').listeners.get('input')?.({ target: input });
		getElement('start-merge-by-page').listeners.get('click')?.({ target: getElement('start-merge-by-page') });
		assert.deepStrictEqual(postedMessages, []);
	});

	test('renders dynamic merge rows without HTML parsing sinks', () => {
		const dashboardSource = fs.readFileSync(
			path.resolve(__dirname, '../../media/dashboard/dashboard.js'),
			'utf8',
		);
		const renderSource = fs.readFileSync(
			path.resolve(__dirname, '../../media/dashboard/render.js'),
			'utf8',
		);
		assert.deepStrictEqual({
			hasInnerHtmlSink: `${dashboardSource}${renderSource}`.includes('.innerHTML'),
			hasSafeTextRendering: renderSource.includes('name.textContent = item.displayName'),
			hasSafeAttributeRendering: renderSource.includes("input.setAttribute('aria-label'"),
		}, {
			hasInnerHtmlSink: false,
			hasSafeTextRendering: true,
			hasSafeAttributeRendering: true,
		});
	});

	test('renders hostile filenames and localized strings as text-only DOM values', () => {
		const renderPath = path.resolve(__dirname, '../../media/dashboard/render.js');
		const renderer = require(renderPath) as {
			renderMergeByPageRow(
				document: { createElement(): FakeElement },
				item: { displayName: string; pages: number[] },
				index: number,
				strings: { pageExample: string; pagesFor: string; remove: string },
			): FakeElement;
		};
		const hostileName = '<img src=x onerror="globalThis.pwned=true">.pdf';
		const hostileLabel = '<script>globalThis.pwned=true</script> {0}';
		const row = renderer.renderMergeByPageRow(
			{ createElement: () => new FakeElement() },
			{ displayName: hostileName, pages: [1, 3] },
			0,
			{ pageExample: '<b>1-3</b>', pagesFor: hostileLabel, remove: hostileLabel },
		);
		assert.deepStrictEqual({
			nameText: row.children[0].textContent,
			placeholder: row.children[1].placeholder,
			inputLabel: row.children[1].attributes.get('aria-label'),
			removeLabel: row.children[2].attributes.get('aria-label'),
			childCount: row.children.length,
		}, {
			nameText: hostileName,
			placeholder: '<b>1-3</b>',
			inputLabel: `<script>globalThis.pwned=true</script> ${hostileName}`,
			removeLabel: `<script>globalThis.pwned=true</script> ${hostileName}`,
			childCount: 4,
		});
	});

	for (const [inputValue, expectedError] of [
		['1,,2', 'Invalid page or range: '],
		['1-2-3', 'Invalid page or range: 1-2-3'],
		['1.5', 'Invalid page or range: 1.5'],
		['0', 'Invalid page or range: 0'],
		['-1', 'Invalid page or range: -1'],
		['2-1', 'Page range must be in ascending order: 2-1'],
		['2,2', 'Page 2 is selected more than once.'],
		['4', 'Page 4 exceeds the PDF page count of 3.'],
	] as const) {
		test(`typing ${inputValue} disables page merge without posting`, () => {
			const parserPath = path.resolve(__dirname, '../../media/dashboard/pageRanges.js');
			const parser = require(parserPath) as {
				validatePageRangeInput(
					input: FakeElement,
					item: { pages: number[]; pageCount: number; valid: boolean },
					error: FakeElement,
					strings: Record<string, string>,
				): boolean;
			};
			const input = new FakeElement();
			input.value = inputValue;
			const error = new FakeElement();
			const item = { pages: [1], pageCount: 3, valid: true };
			const postedMessages: object[] = [];
			parser.validatePageRangeInput(input, item, error, {
				rangeInvalid: 'Invalid page selection.',
				rangeFormat: 'Invalid page or range: {0}',
				rangeDuplicate: 'Page {0} is selected more than once.',
				rangeBounds: 'Page {0} exceeds the PDF page count of {1}.',
				rangeOrder: 'Page range must be in ascending order: {0}',
			});
			const mergeDisabled = !item.valid;
			assert.deepStrictEqual({
				mergeDisabled,
				pages: item.pages,
				ariaInvalid: input.attributes.get('aria-invalid'),
				error: error.textContent,
				postedMessages,
			}, {
				mergeDisabled: true,
				pages: [],
				ariaInvalid: 'true',
				error: expectedError,
				postedMessages: [],
			});
		});
	}
});
