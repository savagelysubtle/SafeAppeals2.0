// Copyright (c) Safe Appeals. All rights reserved.

(function () {
	const vscode = acquireVsCodeApi();

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
		startConvert: document.getElementById('start-convert'),
		startBatch: document.getElementById('start-batch'),
		startMerge: document.getElementById('start-merge'),
		progressSection: document.getElementById('progress-section'),
		progressFill: document.getElementById('progress-fill'),
		progressMessage: document.getElementById('progress-message'),
		resultSection: document.getElementById('result-section'),
		resultMessage: document.getElementById('result-message'),
	};

	document.getElementById('pick-input').addEventListener('click', () => vscode.postMessage({ type: 'pickInput' }));
	document.getElementById('pick-output').addEventListener('click', () => vscode.postMessage({ type: 'pickOutput' }));
	document.getElementById('pick-batch').addEventListener('click', () => vscode.postMessage({ type: 'pickBatchInputs' }));
	document.getElementById('pick-merge-inputs').addEventListener('click', () => vscode.postMessage({ type: 'pickMergeInputs' }));
	document.getElementById('pick-merge-output').addEventListener('click', () => vscode.postMessage({ type: 'pickMergeOutput' }));

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
		showProgress(0, 'Starting…');
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
		showProgress(0, 'Starting batch…');
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
		showProgress(0, 'Merging…');
		vscode.postMessage({
			type: 'mergePdfs',
			inputs: state.mergeInputs,
			output: state.mergeOutput,
		});
	});

	window.addEventListener('message', (event) => {
		const msg = event.data;
		switch (msg.type) {
			case 'bootstrap':
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
				updateSelectedConversion();
				updateBatchButton();
				updateMergeButton();
				break;
			case 'progress':
				showProgress(msg.progress, msg.message);
				break;
			case 'result':
				showResult(msg.success, msg.message, msg.outputPath);
				break;
		}
	});

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
			els.sidecarStatus.textContent = 'sa-converter sidecar is not available.';
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
	}

	function populateSelect(select, conversions, availableOnly) {
		select.innerHTML = '';
		const keys = Object.keys(conversions.conversions).sort();
		for (const key of keys) {
			const spec = conversions.conversions[key];
			if (availableOnly && !spec.available) {
				continue;
			}
			const option = document.createElement('option');
			option.value = key;
			option.textContent = spec.available ? key : `${key} (unavailable)`;
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
		els.fidelityBadge.textContent = `${spec.fidelity} · ${spec.engine}`;

		if (!spec.available) {
			els.installGuidance.classList.remove('hidden');
			els.installGuidance.textContent = spec.install_hint || 'This conversion requires additional software.';
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
