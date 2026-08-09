// Copyright (c) Safe Appeals. All rights reserved.

(function (global) {
	const MAX_EXPANDED_PAGE_COUNT = 100_000;

	class PageRangeError extends Error {
		constructor(code, value, pageCount) {
			super(code);
			this.code = code;
			this.value = value;
			this.pageCount = pageCount;
		}
	}

	function parsePageRanges(input, pageCount) {
		const trimmed = input.trim();
		if (!trimmed) {
			throw new PageRangeError('empty');
		}
		const pages = [];
		for (const rawPart of trimmed.split(',')) {
			const part = rawPart.trim();
			const match = /^(?<start>[1-9]\d*)(?:\s*-\s*(?<end>[1-9]\d*))?$/.exec(part);
			if (!match?.groups) {
				throw new PageRangeError('format', part || rawPart);
			}
			const start = Number(match.groups.start);
			const end = match.groups.end === undefined ? start : Number(match.groups.end);
			if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
				throw new PageRangeError('format', part);
			}
			if (end < start) {
				throw new PageRangeError('order', part);
			}
			if (pageCount !== undefined && end > pageCount) {
				throw new PageRangeError('bounds', String(end), pageCount);
			}
			if (end - start + 1 > MAX_EXPANDED_PAGE_COUNT) {
				throw new PageRangeError('format', part);
			}
			for (let page = start; page <= end; page++) {
				pages.push(page);
			}
		}
		const seen = new Set();
		for (const page of pages) {
			if (!Number.isSafeInteger(page) || page < 1) {
				throw new PageRangeError('format', String(page));
			}
			if (seen.has(page)) {
				throw new PageRangeError('duplicate', String(page));
			}
			if (pageCount !== undefined && page > pageCount) {
				throw new PageRangeError('bounds', String(page), pageCount);
			}
			seen.add(page);
		}
		return [...seen].sort((a, b) => a - b);
	}

	function validatePageRangeInput(input, item, errorElement, strings) {
		try {
			item.pages = parsePageRanges(input.value, item.pageCount);
			item.valid = true;
			input.setAttribute('aria-invalid', 'false');
			errorElement.textContent = '';
		} catch (error) {
			item.pages = [];
			item.valid = false;
			input.setAttribute('aria-invalid', 'true');
			const key = error instanceof PageRangeError
				? `range${error.code[0].toUpperCase()}${error.code.slice(1)}`
				: 'rangeInvalid';
			const replacements = {
				'{0}': error instanceof PageRangeError ? error.value || '' : '',
				'{1}': error instanceof PageRangeError ? String(error.pageCount || '') : '',
			};
			errorElement.textContent = Object.entries(replacements).reduce(
				(message, [placeholder, value]) => message.replace(placeholder, value),
				strings[key] || strings.rangeInvalid,
			);
		}
		return item.valid;
	}

	const api = { PageRangeError, parsePageRanges, validatePageRangeInput };
	global.converterPageRanges = api;
	if (typeof module !== 'undefined') {
		module.exports = api;
	}
})(globalThis);
