// Copyright (c) Safe Appeals. All rights reserved.

(function () {
	const vscode = acquireVsCodeApi();
	const defaults = { searchPackSize: '~350 MB', ocrSize: '~7.0 GB' };

	const els = {
		headline: document.getElementById('headline'),
		subtitle: document.getElementById('subtitle'),
		beat: document.getElementById('beat'),
		status: document.getElementById('status'),
		primary: document.getElementById('primary'),
		secondary: document.getElementById('secondary'),
		skipAll: document.getElementById('skip-all'),
	};

	let state = {
		session: null,
		doneSummary: null,
		busy: false,
		statusMessage: undefined,
		mlAvailable: false,
	};

	els.skipAll.addEventListener('click', () => {
		if (state.busy) {
			return;
		}
		vscode.postMessage({ type: 'skipAll' });
	});

	els.primary.addEventListener('click', () => {
		if (state.busy || !state.session) {
			return;
		}
		const beat = state.session.beat;
		if (beat === 'educate' || beat === 'scan') {
			vscode.postMessage({ type: 'continue' });
			return;
		}
		if (beat === 'searchPack') {
			vscode.postMessage({ type: 'installSearchPack' });
			return;
		}
		if (beat === 'ocr') {
			if (state.session.ocrEligible) {
				vscode.postMessage({ type: 'installOcr' });
			} else {
				vscode.postMessage({ type: 'continue' });
			}
			return;
		}
		if (beat === 'done') {
			vscode.postMessage({ type: 'scaffoldCoreReferences' });
		}
	});

	els.secondary.addEventListener('click', () => {
		if (state.busy || !state.session) {
			return;
		}
		const beat = state.session.beat;
		if (beat === 'searchPack') {
			vscode.postMessage({ type: 'skipSearchPack' });
			return;
		}
		if (beat === 'ocr' && state.session.ocrEligible) {
			vscode.postMessage({ type: 'skipOcr' });
			return;
		}
		if (beat === 'done') {
			vscode.postMessage({ type: 'finish' });
		}
	});

	window.addEventListener('message', (event) => {
		const msg = event.data;
		if (!msg || msg.type !== 'state') {
			return;
		}
		state = {
			session: msg.session,
			doneSummary: msg.doneSummary,
			busy: Boolean(msg.busy),
			statusMessage: msg.statusMessage,
			mlAvailable: Boolean(msg.mlAvailable),
		};
		render();
	});

	function render() {
		const session = state.session;
		if (!session) {
			return;
		}

		renderStatus();
		els.skipAll.disabled = state.busy;
		els.primary.disabled = state.busy;
		els.secondary.disabled = state.busy;

		switch (session.beat) {
			case 'educate':
				renderEducate();
				break;
			case 'scan':
				renderScan(session);
				break;
			case 'searchPack':
				renderSearchPack(session);
				break;
			case 'ocr':
				renderOcr(session);
				break;
			case 'done':
				renderDone(session);
				break;
		}
	}

	function renderStatus() {
		if (!state.statusMessage) {
			els.status.classList.add('hidden');
			els.status.textContent = '';
			els.status.classList.remove('error', 'busy');
			return;
		}
		els.status.classList.remove('hidden');
		els.status.textContent = state.statusMessage;
		els.status.classList.toggle('busy', state.busy);
		els.status.classList.toggle('error', !state.busy && /fail|refus|not |error|unavailable/i.test(state.statusMessage));
	}

	function setActions(primaryLabel, secondaryLabel) {
		els.primary.textContent = primaryLabel;
		els.primary.classList.remove('hidden');
		if (secondaryLabel) {
			els.secondary.textContent = secondaryLabel;
			els.secondary.classList.remove('hidden');
		} else {
			els.secondary.classList.add('hidden');
			els.secondary.textContent = '';
		}
	}

	function renderEducate() {
		els.headline.textContent = 'Search Without Sending the File Out';
		els.subtitle.textContent =
			'Private Search builds an index on this computer so you can find passages in your case files without uploading the whole file for every search.';
		els.beat.innerHTML =
			'<p>Cloud chat still sends the text you choose when you ask the assistant a question. Private Search is different: the index stays here, and you review every draft it helps you write.</p>' +
			'<p>This short setup checks what this computer can run and installs optional search tools only with your consent.</p>';
		setActions('Continue', null);
	}

	function renderScan(session) {
		els.headline.textContent = 'Checking This Computer';
		els.subtitle.textContent = 'A quick look at memory and free disk — no downloads yet.';
		const hw = session.hw;
		if (!hw) {
			els.beat.innerHTML = '<p>Checking this computer…</p>';
			setActions('Continue', null);
			els.primary.disabled = true;
			return;
		}
		const verdictClass = hw.verdict === 'ready-for-scanned' ? 'ready' : 'limited';
		const details = (hw.technicalDetails || []).map(escapeHtml).join('\n');
		els.beat.innerHTML =
			'<ul class="hw-list">' +
			`<li>${escapeHtml(hw.graphicsMemoryLabel)}</li>` +
			`<li>${escapeHtml(hw.systemMemoryLabel)}</li>` +
			`<li>${escapeHtml(hw.freeDiskLabel)}</li>` +
			'</ul>' +
			`<p class="verdict ${verdictClass}">${escapeHtml(hw.verdictLabel)}</p>` +
			`<p>${escapeHtml(hw.reasonLine)}</p>` +
			`<details class="details"><summary>Technical details</summary><pre>${details}</pre></details>`;
		setActions('Continue', null);
	}

	function renderSearchPack(session) {
		els.headline.textContent = 'Install Search Tools';
		const size = formatSessionSize(session.searchPackDiskMb, defaults.searchPackSize);
		els.subtitle.textContent = `Install the embedding and ranking models Private Search needs (${size}). They stay on this computer.`;
		let body =
			'<p>These tools help find relevant passages in your indexed files. Nothing is sent out to install or run them.</p>';
		if (session.searchPackError) {
			body += `<p>${escapeHtml(session.searchPackError)}</p>`;
		}
		if (!state.mlAvailable) {
			body += '<p>Safe Appeals ML is not available, so install is disabled. You can skip and continue later.</p>';
		}
		els.beat.innerHTML = body;
		setActions('Install Search Tools', 'Not Now');
		if (!state.mlAvailable) {
			els.primary.disabled = true;
		}
	}

	function renderOcr(session) {
		els.headline.textContent = 'Read Scanned PDFs (Optional)';
		if (!session.ocrEligible) {
			els.subtitle.textContent = 'This computer is set up for text PDFs and searchable documents.';
			els.beat.innerHTML =
				'<p>Scanned-PDF reading tools are not offered here. You can still index born-digital PDFs and other text documents with Private Search.</p>';
			setActions('Continue', null);
			return;
		}
		const size = formatSessionSize(session.ocrDiskMb, defaults.ocrSize);
		els.subtitle.textContent = `Optionally install tools to read scanned PDFs privately (${size}).`;
		let body =
			'<p>Only install this if you work with image-only PDFs. Text PDFs do not need it.</p>';
		if (session.ocrError) {
			body += `<p>${escapeHtml(session.ocrError)}</p>`;
		}
		els.beat.innerHTML = body;
		setActions('Install Scanned PDF Tools', 'Skip');
		if (!state.mlAvailable) {
			els.primary.disabled = true;
		}
	}

	function renderDone(session) {
		els.headline.textContent = 'You’re Set';
		els.subtitle.textContent = 'Here’s what is ready on this computer.';
		const summary = state.doneSummary || {
			searchPackLine: '',
			ocrLine: '',
			reopenHint: 'You can reopen Private Search Setup anytime from Help or the command palette.',
		};
		els.beat.innerHTML =
			'<div class="summary-lines">' +
			`<p>${escapeHtml(summary.searchPackLine)}</p>` +
			`<p>${escapeHtml(summary.ocrLine)}</p>` +
			'<p>Next, create a <code>core_references/</code> folder and a workspace <code>AGENTS.md</code> so Private Search and the agent know your shared references and case rules.</p>' +
			`<p>${escapeHtml(summary.reopenHint)}</p>` +
			'</div>';
		setActions('Create Core References Folder', 'Continue to Getting Started');
	}

	function formatSessionSize(diskMb, fallback) {
		if (typeof diskMb !== 'number' || !Number.isFinite(diskMb)) {
			return fallback;
		}
		if (diskMb >= 1000) {
			return `~${(diskMb / 1000).toFixed(diskMb >= 10000 ? 0 : 1)} GB`;
		}
		return `~${diskMb} MB`;
	}

	function escapeHtml(value) {
		return String(value ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	vscode.postMessage({ type: 'ready' });
})();
