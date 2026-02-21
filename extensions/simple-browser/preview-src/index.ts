/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onceDocumentLoaded } from './events';

const vscode = acquireVsCodeApi();

function getSettings() {
	const element = document.getElementById('simple-browser-settings');
	if (element) {
		const data = element.getAttribute('data-settings');
		if (data) {
			return JSON.parse(data);
		}
	}

	throw new Error(`Could not load settings`);
}

const settings = getSettings();

const iframe = document.querySelector('iframe')!;
const header = document.querySelector('.header')!;
const input = header.querySelector<HTMLInputElement>('.url-input')!;
const forwardButton = header.querySelector<HTMLButtonElement>('.forward-button')!;
const backButton = header.querySelector<HTMLButtonElement>('.back-button')!;
const reloadButton = header.querySelector<HTMLButtonElement>('.reload-button')!;
const homeButton = header.querySelector<HTMLButtonElement>('.home-button')!;
const openExternalButton = header.querySelector<HTMLButtonElement>('.open-external-button')!;
const loadingIndicator = document.querySelector<HTMLElement>('.loading-indicator')!;

const navigationHistory: string[] = [];
let historyIndex = -1;

function updateNavButtons() {
	backButton.disabled = historyIndex <= 0;
	forwardButton.disabled = historyIndex >= navigationHistory.length - 1;
}

function showLoading(show: boolean) {
	loadingIndicator.classList.toggle('visible', show);
}

function normalizeUrl(rawUrl: string): string {
	const trimmed = rawUrl.trim();
	if (!trimmed) {
		return trimmed;
	}
	if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
		return trimmed;
	}
	if (trimmed.includes('.') && !trimmed.includes(' ')) {
		return 'https://' + trimmed;
	}
	return trimmed;
}

window.addEventListener('message', e => {
	switch (e.data.type) {
		case 'focus':
			{
				iframe.focus();
				break;
			}
		case 'didChangeFocusLockIndicatorEnabled':
			{
				toggleFocusLockIndicatorEnabled(e.data.enabled);
				break;
			}
	}
});

onceDocumentLoaded(() => {
	setInterval(() => {
		const iframeFocused = document.activeElement?.tagName === 'IFRAME';
		document.body.classList.toggle('iframe-focused', iframeFocused);
	}, 50);

	iframe.addEventListener('load', () => {
		showLoading(false);
	});

	input.addEventListener('change', e => {
		const rawUrl = (e.target as HTMLInputElement).value;
		const url = normalizeUrl(rawUrl);
		input.value = url;
		navigateTo(url, true);
	});

	input.addEventListener('keydown', e => {
		if (e.key === 'Enter') {
			input.blur();
			const url = normalizeUrl(input.value);
			input.value = url;
			navigateTo(url, true);
		} else if (e.key === 'Escape') {
			input.blur();
		}
	});

	document.addEventListener('keydown', e => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
			e.preventDefault();
			input.focus();
			input.select();
		}
	});

	forwardButton.addEventListener('click', () => {
		if (historyIndex < navigationHistory.length - 1) {
			historyIndex++;
			const url = navigationHistory[historyIndex];
			input.value = url;
			navigateTo(url, false);
			updateNavButtons();
		}
	});

	backButton.addEventListener('click', () => {
		if (historyIndex > 0) {
			historyIndex--;
			const url = navigationHistory[historyIndex];
			input.value = url;
			navigateTo(url, false);
			updateNavButtons();
		}
	});

	homeButton.addEventListener('click', () => {
		const homeUrl = settings.homeUrl || 'https://www.google.com';
		input.value = homeUrl;
		navigateTo(homeUrl, true);
	});

	openExternalButton.addEventListener('click', () => {
		vscode.postMessage({
			type: 'openExternal',
			url: input.value
		});
	});

	reloadButton.addEventListener('click', () => {
		navigateTo(input.value, false);
	});

	navigateTo(settings.url, true);
	input.value = settings.url;

	toggleFocusLockIndicatorEnabled(settings.focusLockIndicatorEnabled);
	updateNavButtons();

	function navigateTo(rawUrl: string, addToHistory: boolean): void {
		showLoading(true);

		try {
			const url = new URL(rawUrl);
			url.searchParams.append('vscodeBrowserReqId', Date.now().toString());
			iframe.src = url.toString();
		} catch {
			iframe.src = rawUrl;
		}

		if (addToHistory) {
			if (historyIndex < navigationHistory.length - 1) {
				navigationHistory.splice(historyIndex + 1);
			}
			navigationHistory.push(rawUrl);
			historyIndex = navigationHistory.length - 1;
			updateNavButtons();
		}

		vscode.setState({ url: rawUrl });
	}
});

function toggleFocusLockIndicatorEnabled(enabled: boolean) {
	document.body.classList.toggle('enable-focus-lock-indicator', enabled);
}
