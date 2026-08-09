// Copyright (c) Safe Appeals. All rights reserved.

(function () {
	const vscode = acquireVsCodeApi();
	const { renderMergeByPageRow } = globalThis.converterDashboardRender;
	const { validatePageRangeInput } = globalThis.converterPageRanges;

	const state = {
		conversions: { conversions: {}, aliases: {} },
		sidecarReady: false,
		selectedKey: '',
		batchKey: '',
		inputPath: '',
		outputPath: '',
		batchInputs: [],
		mergeInputs: [],
		mergeOutput: '',
		mergeByPageInputs: [], // Array of { path: string, pages: number[], fileName: string }
		mergeByPageOutput: '',
		uiStrings: {},
	};

	const els = {
		sidecarStatus: document.getElementById('sidecar-status'),
		conversionSelect: document.getElementById('conversion-select'),
		batchConversionSelect: document.getElementById('batch-conversion-select'),
		fidelityBadge: document.getElementById('fidelity-badge'),
		installGuidance: document.getElementById('install-guidance'),
		inputPath: document.getElementById('input-path'),
		outputPath: document.getElementById('output-path'),
		batchInputs: document.getElementById('batch-inputs'),
		mergeInputs: document.getElementById('merge-inputs'),
		mergeOutput: document.getElementById('merge-output'),
		mergeByPageList: document.getElementById('merge-by-page-list'),
		mergeByPageOutput: document.getElementById('merge-by-page-output'),
		mergeByPageTitle: document.getElementById('merge-by-page-title'),
		mergeByPageInputsLabel: document.getElementById('merge-by-page-inputs-label'),
		mergeByPageOutputLabel: document.getElementById('merge-by-page-output-label'),
		pickMergeByPageInputs: document.getElementById('pick-merge-by-page-inputs'),
		pickMergeByPageOutput: document.getElementById('pick-merge-by-page-output'),
		startConvert: document.getElementById('start-convert'),
		startBatch: document.getElementById('start-batch'),
		startMerge: document.getElementById('start-merge'),
		startMergeByPage: document.getElementById('start-merge-by-page'),
		progressSection: document.getElementById('progress-section'),
		progressFill: document.getElementById('progress-fill'),
		progressMessage: document.getElementById('progress-message'),
		resultSection: document.getElementById('result-section'),
		resultMessage: document.getElementById('result-message'),
		dashboardHeading: document.getElementById('dashboard-heading'),
		dashboardSubtitle: document.getElementById('dashboard-subtitle'),
		singleConversionTitle: document.getElementById('single-conversion-title'),
		conversionLabel: document.getElementById('conversion-label'),
		inputLabel: document.getElementById('input-label'),
		outputLabel: document.getElementById('output-label'),
		pickInput: document.getElementById('pick-input'),
		pickOutput: document.getElementById('pick-output'),
		batchConversionTitle: document.getElementById('batch-conversion-title'),
		batchConversionLabel: document.getElementById('batch-conversion-label'),
		batchInputsLabel: document.getElementById('batch-inputs-label'),
		pickBatch: document.getElementById('pick-batch'),
		mergeTitle: document.getElementById('merge-title'),
		mergeInputsLabel: document.getElementById('merge-inputs-label'),
		mergeOutputLabel: document.getElementById('merge-output-label'),
		pickMergeInputs: document.getElementById('pick-merge-inputs'),
		pickMergeOutput: document.getElementById('pick-merge-output'),
		progressTitle: document.getElementById('progress-title'),
		resultTitle: document.getElementById('result-title'),
	};

	document.getElementById('pick-input').addEventListener('click', () => vscode.postMessage({ type: 'pickInput' }));
	document.getElementById('pick-output').addEventListener('click', () => vscode.postMessage({ type: 'pickOutput' }));
	document.getElementById('pick-batch').addEventListener('click', () => vscode.postMessage({ type: 'pickBatchInputs' }));
	document.getElementById('pick-merge-inputs').addEventListener('click', () => vscode.postMessage({ type: 'pickMergeInputs' }));
	document.getElementById('pick-merge-output').addEventListener('click', () => vscode.postMessage({ type: 'pickMergeOutput' }));
	document.getElementById('pick-merge-by-page-inputs').addEventListener('click', () => vscode.postMessage({ type: 'pickMergeByPageInputs' }));
	document.getElementById('pick-merge-by-page-output').addEventListener('click', () => vscode.postMessage({ type: 'pickMergeByPageOutput' }));

	// Event delegation for merge-by-page list (page inputs and remove buttons)
	els.mergeByPageList.addEventListener('input', (e) => {
		const input = e.target.closest('.page-input');
		if (!input) return;
		const index = parseInt(input.dataset.index, 10);
		const item = state.mergeByPageInputs[index];
		const errorElement = input.closest('.merge-page-row').querySelector('.page-range-error');
		validatePageRangeInput(input, item, errorElement, state.uiStrings);
		updateMergeByPageButton();
	});

	els.mergeByPageList.addEventListener('click', (e) => {
		const removeBtn = e.target.closest('.remove-pdf-btn');
		if (!removeBtn) return;
		const index = parseInt(removeBtn.dataset.index, 10);
		state.mergeByPageInputs.splice(index, 1);
		renderMergeByPageList();
		updateMergeByPageButton();
	});

	els.conversionSelect.addEventListener('change', () => {
		state.selectedKey = els.conversionSelect.value;
		updateSelectedConversion();
	});

	els.batchConversionSelect.addEventListener('change', () => {
		state.batchKey = els.batchConversionSelect.value;
		updateBatchButton();
	});

	els.startConvert.addEventListener('click', () => {
		if (!state.selectedKey || !state.inputPath || !state.outputPath) {
			return;
		}
		showProgress(0, state.uiStrings.starting);
		vscode.postMessage({
			type: 'convert',
			conversionKey: state.selectedKey,
			input: state.inputPath,
			output: state.outputPath,
		});
	});

	els.startBatch.addEventListener('click', () => {
		if (!state.batchKey || state.batchInputs.length === 0) {
			return;
		}
		showProgress(0, state.uiStrings.startingBatch);
		vscode.postMessage({
			type: 'batchConvert',
			conversionKey: state.batchKey,
			inputs: state.batchInputs,
		});
	});

	els.startMerge.addEventListener('click', () => {
		if (state.mergeInputs.length < 2 || !state.mergeOutput) {
			return;
		}
		showProgress(0, state.uiStrings.merging);
		vscode.postMessage({
			type: 'mergePdfs',
			inputs: state.mergeInputs,
			output: state.mergeOutput,
		});
	});

	els.startMergeByPage.addEventListener('click', () => {
		if (state.mergeByPageInputs.length === 0 || !state.mergeByPageOutput || state.mergeByPageInputs.some(item => item.valid === false)) {
			return;
		}
		// Filter out entries with no pages selected
		const validInputs = state.mergeByPageInputs.filter(item => item.pages.length > 0);
		if (validInputs.length === 0) {
			return;
		}
		showProgress(0, state.uiStrings.mergingByPage);
		vscode.postMessage({
			type: 'mergePdfsByPage',
			inputs: validInputs.map(item => ({ path: item.path, pages: item.pages })),
			output: state.mergeByPageOutput,
		});
	});

	window.addEventListener('message', (event) => {
		const msg = event.data;
		switch (msg.type) {
			case 'bootstrap':
				state.uiStrings = msg.uiStrings;
				applyLocalizedStrings();
				applyConversions(msg.conversions, msg.sidecarReady, msg.sidecarError);
				break;
			case 'conversionsUpdated':
				applyConversions(msg.conversions, msg.sidecarReady, msg.sidecarError);
				break;
			case 'paths':
				if (msg.input !== undefined) {
					state.inputPath = msg.input;
					els.inputPath.value = msg.input;
				}
				if (msg.output !== undefined) {
					state.outputPath = msg.output;
					els.outputPath.value = msg.output;
				}
				if (msg.batchInputs) {
					state.batchInputs = msg.batchInputs;
					els.batchInputs.value = msg.batchInputs.join(', ');
				}
				if (msg.mergeInputs) {
					state.mergeInputs = msg.mergeInputs;
					els.mergeInputs.value = msg.mergeInputs.join(', ');
				}
				if (msg.mergeOutput !== undefined) {
					state.mergeOutput = msg.mergeOutput;
					els.mergeOutput.value = msg.mergeOutput;
				}
				if (msg.mergeByPageInputs) {
					state.mergeByPageInputs = msg.mergeByPageInputs.map(item => ({
						path: item.path,
						pages: item.pages,
						displayName: item.displayName,
						pageCount: item.pageCount,
						valid: true,
					}));
					renderMergeByPageList();
				}
				if (msg.mergeByPageOutput !== undefined) {
					state.mergeByPageOutput = msg.mergeByPageOutput;
					els.mergeByPageOutput.value = msg.mergeByPageOutput;
				}
				updateSelectedConversion();
				updateBatchButton();
				updateMergeButton();
				updateMergeByPageButton();
				break;
			case 'progress':
				showProgress(msg.progress, msg.message);
				break;
			case 'result':
				showResult(msg.success, msg.message, msg.outputPath);
				break;
			case 'addToMerge':
				addToMergeList(msg.path);
				break;
		}
	});

	function applyLocalizedStrings() {
		document.title = state.uiStrings.dashboardTitle;
		els.dashboardHeading.textContent = state.uiStrings.dashboardTitle;
		els.dashboardSubtitle.textContent = state.uiStrings.dashboardSubtitle;
		els.singleConversionTitle.textContent = state.uiStrings.singleConversion;
		els.conversionLabel.textContent = state.uiStrings.conversion;
		els.inputLabel.textContent = state.uiStrings.input;
		els.inputPath.placeholder = state.uiStrings.pickInputFile;
		els.pickInput.textContent = state.uiStrings.browse;
		els.outputLabel.textContent = state.uiStrings.output;
		els.outputPath.placeholder = state.uiStrings.pickOutputFile;
		els.pickOutput.textContent = state.uiStrings.browse;
		els.startConvert.textContent = state.uiStrings.start;
		els.batchConversionTitle.textContent = state.uiStrings.batchConversion;
		els.batchConversionLabel.textContent = state.uiStrings.conversion;
		els.batchInputsLabel.textContent = state.uiStrings.inputs;
		els.batchInputs.placeholder = state.uiStrings.pickInputFiles;
		els.pickBatch.textContent = state.uiStrings.browse;
		els.startBatch.textContent = state.uiStrings.startBatch;
		els.mergeTitle.textContent = state.uiStrings.mergePdfs;
		els.mergeInputsLabel.textContent = state.uiStrings.inputs;
		els.mergeInputs.placeholder = state.uiStrings.pickPdfFiles;
		els.pickMergeInputs.textContent = state.uiStrings.browse;
		els.mergeOutputLabel.textContent = state.uiStrings.output;
		els.mergeOutput.placeholder = state.uiStrings.pickOutputPdf;
		els.pickMergeOutput.textContent = state.uiStrings.browse;
		els.startMerge.textContent = state.uiStrings.merge;
		els.mergeByPageTitle.textContent = state.uiStrings.mergeByPageTitle;
		els.mergeByPageInputsLabel.textContent = state.uiStrings.inputs;
		els.pickMergeByPageInputs.textContent = state.uiStrings.browsePdfs;
		els.mergeByPageOutputLabel.textContent = state.uiStrings.output;
		els.mergeByPageOutput.placeholder = state.uiStrings.pickOutputPdf;
		els.pickMergeByPageOutput.textContent = state.uiStrings.browse;
		els.startMergeByPage.textContent = state.uiStrings.mergeByPageAction;
		els.progressTitle.textContent = state.uiStrings.progress;
		els.resultTitle.textContent = state.uiStrings.result;
	}

	function applyConversions(conversions, sidecarReady, sidecarError) {
		state.conversions = conversions;
		state.sidecarReady = sidecarReady !== false;

		if (sidecarError) {
			els.sidecarStatus.classList.remove('hidden');
			els.sidecarStatus.classList.add('error');
			els.sidecarStatus.textContent = sidecarError;
		} else if (!state.sidecarReady) {
			els.sidecarStatus.classList.remove('hidden');
			els.sidecarStatus.classList.add('error');
			els.sidecarStatus.textContent = state.uiStrings.sidecarUnavailable;
		} else {
			els.sidecarStatus.classList.add('hidden');
		}

		populateSelect(els.conversionSelect, conversions);
		populateSelect(els.batchConversionSelect, conversions, true);

		if (!state.selectedKey && els.conversionSelect.options.length) {
			state.selectedKey = els.conversionSelect.value;
		}
		if (!state.batchKey && els.batchConversionSelect.options.length) {
			state.batchKey = els.batchConversionSelect.value;
		}
		updateSelectedConversion();
		updateBatchButton();
		updateMergeButton();
		updateMergeByPageButton();
	}

	function populateSelect(select, conversions, availableOnly) {
		select.replaceChildren();
		const keys = Object.keys(conversions.conversions).sort();
		for (const key of keys) {
			const spec = conversions.conversions[key];
			if (availableOnly && !spec.available) {
				continue;
			}
			const option = document.createElement('option');
			option.value = key;
			option.textContent = spec.available ? key : state.uiStrings.unavailable.replace('{0}', key);
			select.appendChild(option);
		}
	}

	function getSpec(key) {
		const canonical = state.conversions.aliases[key] || key;
		return state.conversions.conversions[canonical];
	}

	function updateSelectedConversion() {
		const spec = getSpec(state.selectedKey);
		if (!spec) {
			els.fidelityBadge.classList.add('hidden');
			els.installGuidance.classList.add('hidden');
			els.startConvert.disabled = true;
			return;
		}

		els.fidelityBadge.classList.remove('hidden');
		els.fidelityBadge.className = `badge ${spec.fidelity}`;
		const fidelityLabels = {
			'office-fidelity': state.uiStrings.fidelityOffice,
			semantic: state.uiStrings.fidelitySemantic,
			'browser-print': state.uiStrings.fidelityBrowserPrint,
			'preview-fast': state.uiStrings.fidelityPreviewFast,
			'pdf-ops': state.uiStrings.fidelityPdfOperations,
			ocr: state.uiStrings.fidelityOcr,
		};
		els.fidelityBadge.textContent = `${fidelityLabels[spec.fidelity] || spec.fidelity} · ${spec.engine}`;

		if (!spec.available) {
			els.installGuidance.classList.remove('hidden');
			els.installGuidance.textContent = spec.install_hint || state.uiStrings.additionalSoftware;
			els.startConvert.disabled = true;
		} else {
			els.installGuidance.classList.add('hidden');
			els.startConvert.disabled = !state.sidecarReady || !state.inputPath || !state.outputPath;
		}
	}

	function updateBatchButton() {
		const spec = getSpec(state.batchKey);
		els.startBatch.disabled = !state.sidecarReady || !spec?.available || state.batchInputs.length === 0;
	}

	function updateMergeButton() {
		els.startMerge.disabled = !state.sidecarReady || state.mergeInputs.length < 2 || !state.mergeOutput;
	}

	function updateMergeByPageButton() {
		const spec = getSpec('merge_pdfs_by_page');
		const hasValidInputs = state.mergeByPageInputs.some(item => item.pages.length > 0);
		const hasInvalidInputs = state.mergeByPageInputs.some(item => item.valid === false);
		els.startMergeByPage.disabled = !state.sidecarReady || !spec?.available || !hasValidInputs || hasInvalidInputs || !state.mergeByPageOutput;
	}

	function renderMergeByPageList() {
		if (state.mergeByPageInputs.length === 0) {
			els.mergeByPageList.replaceChildren();
			const placeholder = document.createElement('p');
			placeholder.className = 'placeholder';
			placeholder.textContent = state.uiStrings.noPdfsSelected;
			els.mergeByPageList.appendChild(placeholder);
			return;
		}

		els.mergeByPageList.replaceChildren(...state.mergeByPageInputs.map((item, index) =>
			renderMergeByPageRow(document, item, index, state.uiStrings)));
	}

	function addToMergeList(path) {
		// Check if already in list
		if (state.mergeInputs.includes(path)) {
			return;
		}
		state.mergeInputs.push(path);
		els.mergeInputs.value = state.mergeInputs.join(', ');
		updateMergeButton();
	}

	function showProgress(progress, message) {
		els.progressSection.classList.remove('hidden');
		els.progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
		els.progressMessage.textContent = message;
	}

	function showResult(success, message, outputPath) {
		els.resultSection.classList.remove('hidden');
		els.resultMessage.className = success ? 'success' : 'error';
		els.resultMessage.textContent = outputPath ? `${message} → ${outputPath}` : message;
		if (success) {
			els.progressFill.style.width = '100%';
		}
	}

	vscode.postMessage({ type: 'ready' });
})();
