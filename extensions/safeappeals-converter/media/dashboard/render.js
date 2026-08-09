// Copyright (c) Safe Appeals. All rights reserved.

(function (global) {
	function renderMergeByPageRow(document, item, index, strings) {
		const row = document.createElement('div');
		row.className = 'merge-page-row';
		row.dataset.index = String(index);

		const name = document.createElement('span');
		name.className = 'pdf-name';
		name.textContent = item.displayName;

		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'page-input';
		input.dataset.index = String(index);
		input.placeholder = strings.pageExample;
		input.value = item.pages.join(',');
		input.setAttribute('aria-label', strings.pagesFor.replace('{0}', item.displayName));
		input.setAttribute('aria-describedby', `page-error-${index}`);

		const error = document.createElement('span');
		error.id = `page-error-${index}`;
		error.className = 'page-range-error';
		error.setAttribute('role', 'alert');

		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'remove-pdf-btn';
		remove.dataset.index = String(index);
		remove.setAttribute('aria-label', strings.remove.replace('{0}', item.displayName));
		remove.textContent = '×';

		row.append(name, input, remove, error);
		return row;
	}

	const api = { renderMergeByPageRow };
	global.converterDashboardRender = api;
	if (typeof module !== 'undefined') {
		module.exports = api;
	}
})(globalThis);
