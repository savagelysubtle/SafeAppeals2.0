// DOCX Viewer Webview Script
(function () {
	// Communication with host
	const vscode = acquireVsCodeApi();

	// Get previous state if it exists
	const previousState = vscode.getState() || {};

	let docxRendered = false;
	let contentModified = false;
	let docxUri = null;

	// Get DOM elements
	const container = document.getElementById('docx-container');
	// Add unified scrollbar class
	container.classList.add('void-scrollbar');

	const saveBtn = document.getElementById('save-btn');
	const statusText = document.getElementById('status-text');

	// Page navigation elements
	const prevPageBtn = document.getElementById('prev-page-btn');
	const nextPageBtn = document.getElementById('next-page-btn');
	const pageInfo = document.getElementById('page-info');
	const pageSizeSelect = document.getElementById('page-size-select');
	const marginPresetSelect = document.getElementById('margin-preset-select');
	const wordWrapBtn = document.getElementById('word-wrap-btn');
	const showMarginsBtn = document.getElementById('show-margins-btn');
	let currentPage = 1;
	let totalPages = 1;
	let wordWrapEnabled = true;
	let currentPageSize = 'letter';
	let currentMarginPreset = 'normal';
	let showMarginGuides = false;
	let isCheckingOverflow = false;

	// Ribbon buttons
	const boldBtn = document.getElementById('bold-btn');
	const italicBtn = document.getElementById('italic-btn');
	const underlineBtn = document.getElementById('underline-btn');
	const strikethroughBtn = document.getElementById('strikethrough-btn');
	const textColorInput = document.getElementById('text-color');
	const highlightColorInput = document.getElementById('highlight-color');

	const fontFamilySelect = document.getElementById('font-family');
	const fontSizeSelect = document.getElementById('font-size');

	const alignLeftBtn = document.getElementById('align-left-btn');
	const alignCenterBtn = document.getElementById('align-center-btn');
	const alignRightBtn = document.getElementById('align-right-btn');
	const justifyBtn = document.getElementById('justify-btn');
	const bulletsBtn = document.getElementById('bullets-btn');
	const numberingBtn = document.getElementById('numbering-btn');
	const indentBtn = document.getElementById('indent-btn');
	const outdentBtn = document.getElementById('outdent-btn');

	const headingStyleSelect = document.getElementById('heading-style');

	const insertTableBtn = document.getElementById('insert-table-btn');
	const insertImageBtn = document.getElementById('insert-image-btn');
	const pageBreakBtn = document.getElementById('page-break-btn');

	const marginsBtn = document.getElementById('margins-btn');
	const keepWithNextBtn = document.getElementById('keep-with-next-btn');

	// Track modification state
	function trackModification() {
		if (!contentModified) {
			contentModified = true;
			updateStatus('Modified');
			vscode.postMessage({ type: 'contentChanged' });
		}
	}

	// Execute formatting command
	function execFormatCommand(command, value = null) {
		document.execCommand(command, false, value);
		trackModification();
		updateActiveStates();
	}

	// Notify host that webview is ready
	vscode.postMessage({ type: 'ready' });

	// Listen for messages from host
	window.addEventListener('message', async (event) => {
		const message = event.data;

		switch (message.type) {
			case 'loadDOCX':
				await handleLoadDOCX(message);
				break;
			case 'saveComplete':
				handleSaveComplete(message);
				break;
			case 'executeOperations':
				executeDocumentOperations(message.operations);
				break;
		}
	});

	async function handleLoadDOCX(message) {
		try {
			console.log('[DOCX Webview] Loading DOCX...');
			console.log('[DOCX Webview] Base64 data length:', message.data.length);
			docxUri = message.docxUri;

			// Convert base64 to Blob
			const binaryString = atob(message.data);
			console.log('[DOCX Webview] Binary string length:', binaryString.length);

			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Verify ZIP signature (first 4 bytes should be PK.. = 0x50 0x4B 0x03 0x04)
			if (bytes.length >= 4) {
				const signature = Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ');
				console.log('[DOCX Webview] First 4 bytes (ZIP signature):', signature);
				console.log('[DOCX Webview] Is valid ZIP?', bytes[0] === 0x50 && bytes[1] === 0x4B);
			}

			const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
			console.log('[DOCX Webview] Blob size:', blob.size, 'bytes');

			// If blob is 0 or very small, show error immediately
			if (blob.size === 0) {
				throw new Error('DOCX file is empty (0 bytes). The file may not have been created yet or is corrupted.');
			}
			if (blob.size < 100) {
				throw new Error(`DOCX file is too small (${blob.size} bytes). Minimum expected size is ~1200 bytes for a valid DOCX.`);
			}

			// Clear container
			container.innerHTML = '';

			// Create a temporary container for initial rendering
			const tempContainer = document.createElement('div');
			tempContainer.style.position = 'absolute';
			tempContainer.style.visibility = 'hidden';
			document.body.appendChild(tempContainer);

			// Render using docx-preview library
			const options = {
				className: 'docx',
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
				ignoreFonts: false,
				breakPages: true,
				ignoreLastRenderedPageBreak: false,
				experimental: true,
				trimXmlDeclaration: true,
				renderHeaders: true,
				renderFooters: true,
				renderFootnotes: true,
				renderEndnotes: true,
				debug: false
			};

			await docx.renderAsync(blob, tempContainer, null, options);

			// Create paginated layout
			createPaginatedView(tempContainer);

			// Remove temporary container
			document.body.removeChild(tempContainer);

			docxRendered = true;
			contentModified = false;
			updateStatus('Ready - Click to edit');

			console.log('[DOCX Webview] DOCX loaded and ready for editing');

		} catch (error) {
			console.error('[DOCX Webview] Failed to load DOCX:', error);
			container.innerHTML = `<div style="padding: 20px; color: var(--vscode-errorForeground);">
				Error loading document: ${error.message}
			</div>`;
		}
	}

	/**
	 * Create paginated view from rendered content
	 */
	function createPaginatedView(sourceContainer) {
		const docxWrapper = sourceContainer.querySelector('.docx-wrapper');
		if (!docxWrapper) {
			console.warn('[DOCX Webview] No docx-wrapper found');
			return;
		}

		// Create pages container
		const pagesContainer = document.createElement('div');
		pagesContainer.className = 'pages-container';

		// Get all content from the rendered docx
		const content = docxWrapper.cloneNode(true);

		// Check if docx-preview already created pages
		const existingPages = content.querySelectorAll('section');

		if (existingPages.length > 1) {
			// docx-preview already broke content into pages
			console.log(`[DOCX Webview] Found ${existingPages.length} pre-rendered pages`);

			existingPages.forEach((section, index) => {
				const page = document.createElement('div');
				page.className = `docx-page word-wrap-enabled size-${currentPageSize} margin-${currentMarginPreset}`;
				page.contentEditable = 'true';
				page.setAttribute('data-page-number', index + 1);

				// Move section content into page
				while (section.firstChild) {
					page.appendChild(section.firstChild);
				}

				// Add page number
				const pageNumber = document.createElement('div');
				pageNumber.className = 'page-number';
				pageNumber.textContent = `Page ${index + 1}`;
				page.appendChild(pageNumber);

				// Track modifications
				page.addEventListener('input', () => {
					trackModification();
					checkPageOverflow(page);
				});

				// Handle backspace to delete empty pages
				page.addEventListener('keydown', (e) => {
					if (e.key === 'Backspace') {
						handleBackspaceForPageDeletion(page);
					} else if (e.key === 'Enter') {
						// Debounce Enter key - don't check overflow immediately
						// The input event will handle it
					}
				});

				pagesContainer.appendChild(page);
			});
		} else {
			// Create single page if no pre-rendered pages
			console.log('[DOCX Webview] Creating single page view');

			const page = document.createElement('div');
			page.className = `docx-page word-wrap-enabled size-${currentPageSize} margin-${currentMarginPreset}`;
			page.contentEditable = 'true';
			page.setAttribute('data-page-number', '1');

			// Move all content to page
			while (content.firstChild) {
				page.appendChild(content.firstChild);
			}

			// Add page number
			const pageNumber = document.createElement('div');
			pageNumber.className = 'page-number';
			pageNumber.textContent = 'Page 1';
			page.appendChild(pageNumber);

			// Track modifications
			page.addEventListener('input', () => {
				trackModification();
				checkPageOverflow(page);
			});

			// Handle backspace to delete empty pages
			page.addEventListener('keydown', (e) => {
				if (e.key === 'Backspace') {
					handleBackspaceForPageDeletion(page);
				} else if (e.key === 'Enter') {
					// Debounce Enter key - don't check overflow immediately
					// The input event will handle it
				}
			});

			pagesContainer.appendChild(page);
		}

		// Add to container
		container.appendChild(pagesContainer);

		totalPages = pagesContainer.children.length;
		currentPage = 1;
		updatePageNavigation();

		console.log(`[DOCX Webview] Created ${totalPages} page(s)`);
	}

	/**
	 * Check if page content exceeds page height and create new page if needed
	 */
	function checkPageOverflow(page) {
		if (isCheckingOverflow) {
			console.log('[DOCX Webview] ⚠️ Already checking overflow, skipping');
			return;
		}

		// Use setTimeout instead of requestAnimationFrame for better reliability
		setTimeout(() => {
			if (isCheckingOverflow) {
				console.log('[DOCX Webview] ⚠️ Already checking overflow in timeout, skipping');
				return;
			}

			isCheckingOverflow = true;

			try {
				const pageNumber = page.querySelector('.page-number');

				// Calculate available content height (page height minus padding minus page number space)
				const pageHeight = page.offsetHeight;
				const computedStyle = window.getComputedStyle(page);
				const paddingTop = parseFloat(computedStyle.paddingTop);
				const paddingBottom = parseFloat(computedStyle.paddingBottom);
				const pageNumberHeight = pageNumber ? pageNumber.offsetHeight + 20 : 30; // Add buffer

				const maxContentHeight = pageHeight - paddingTop - paddingBottom - pageNumberHeight;

				// Get all content elements (excluding page number)
				let contentElements = Array.from(page.children).filter(child =>
					!child.classList.contains('page-number')
				);

				// If there's only one element and it's a section/article/div wrapper, look inside it
				if (contentElements.length === 1) {
					const wrapper = contentElements[0];
					const wrapperTag = wrapper.tagName.toLowerCase();
					if (wrapperTag === 'section' || wrapperTag === 'article' || wrapperTag === 'div') {
						// Use the children of the wrapper instead
						const innerElements = Array.from(wrapper.children);
						if (innerElements.length > 0) {
							console.log(`[DOCX Webview] Found ${wrapperTag} wrapper with ${innerElements.length} children, using children as content elements`);
							contentElements = innerElements;
						}
					}
				}

				console.log(`[DOCX Webview] Page ${page.getAttribute('data-page-number')} check:`);
				console.log(`  - Page height: ${pageHeight}px`);
				console.log(`  - Max content height: ${maxContentHeight}px`);
				console.log(`  - Content elements: ${contentElements.length}`);

				// If no content elements, don't check overflow
				if (contentElements.length === 0) {
					console.log('  - No content elements, skipping overflow check');
					return;
				}

				// Calculate total content height using scrollHeight for accuracy
				let totalContentHeight = 0;
				contentElements.forEach((element, idx) => {
					const elementHeight = Math.max(element.offsetHeight, element.scrollHeight);
					const marginTop = parseFloat(window.getComputedStyle(element).marginTop);
					const marginBottom = parseFloat(window.getComputedStyle(element).marginBottom);
					const totalElementHeight = elementHeight + marginTop + marginBottom;
					totalContentHeight += totalElementHeight;

					if (idx < 5) { // Only log first 5 to avoid spam
						console.log(`  - Element ${idx}: ${element.tagName}, height=${totalElementHeight.toFixed(2)}px, accumulated=${totalContentHeight.toFixed(2)}px`);
					}
				});

				console.log(`  - Total content height: ${totalContentHeight.toFixed(2)}px`);
				console.log(`  - Overflow: ${totalContentHeight > maxContentHeight ? 'YES' : 'NO'} (${(totalContentHeight - maxContentHeight).toFixed(2)}px)`);

				// If content exceeds available height, create new page
				if (totalContentHeight > maxContentHeight) {
					console.log(`[DOCX Webview] ⚠️ Page overflow detected: ${totalContentHeight}px > ${maxContentHeight}px`);
					createNewPageFromOverflow(page, contentElements, maxContentHeight);
				}
			} finally {
				isCheckingOverflow = false;
			}
		}, 150); // Slightly longer delay to avoid double-calls
	}

	/**
	 * Create a new page and move overflow content to it
	 */
	function createNewPageFromOverflow(currentPage, contentElements, maxHeight) {
		const pagesContainer = container.querySelector('.pages-container');
		if (!pagesContainer) return;

		const currentPageNum = parseInt(currentPage.getAttribute('data-page-number'));
		const pageNumber = currentPage.querySelector('.page-number');

		console.log(`[DOCX Webview] 📄 Creating overflow page from page ${currentPageNum}`);
		console.log(`  - Total elements on current page: ${contentElements.length}`);
		console.log(`  - Max content height allowed: ${maxHeight.toFixed(2)}px`);

		// Find where to split content
		let accumulatedHeight = 0;
		let splitIndex = contentElements.length; // Start at end (move nothing by default)

		for (let i = 0; i < contentElements.length; i++) {
			const element = contentElements[i];
			// Use scrollHeight for better overflow detection
			const elementHeight = Math.max(element.offsetHeight, element.scrollHeight);
			const marginTop = parseFloat(window.getComputedStyle(element).marginTop);
			const marginBottom = parseFloat(window.getComputedStyle(element).marginBottom);
			const totalElementHeight = elementHeight + marginTop + marginBottom;

			console.log(`  - Element ${i} (${element.tagName}): ${totalElementHeight.toFixed(2)}px, accumulated: ${accumulatedHeight.toFixed(2)}px`);

			// Check if adding this element would exceed the limit
			if (accumulatedHeight + totalElementHeight > maxHeight) {
				splitIndex = i; // This is the FIRST element that overflows
				console.log(`  ⚠️ Element ${i} would overflow! Split index set to ${i}`);
				break;
			}

			accumulatedHeight += totalElementHeight;
		}

		console.log(`  - Final split index: ${splitIndex}`);
		console.log(`  - Elements to move: ${contentElements.length - splitIndex}`);

		// If nothing overflows or nothing to move, don't create a page
		if (splitIndex >= contentElements.length) {
			console.warn('[DOCX Webview] ⚠️ No content overflows, not creating new page');
			return;
		}

		// If splitIndex is 0, DON'T create a page - this means all content fits
		// This happens when Enter creates a new paragraph that causes slight overflow
		if (splitIndex === 0) {
			console.warn('[DOCX Webview] ⚠️ Split index is 0 - refusing to move all content. Page may need manual break.');
			return;
		}

		// Create new page
		const newPage = document.createElement('div');
		const wrapClass = wordWrapEnabled ? 'word-wrap-enabled' : 'word-wrap-disabled';
		newPage.className = `docx-page ${wrapClass} size-${currentPageSize} margin-${currentMarginPreset}`;
		newPage.contentEditable = 'true';

		// Create a wrapper section for the new page to match structure
		const newWrapper = document.createElement('section');
		newWrapper.className = 'docx';

		// Move ONLY overflow content to new page (elements from splitIndex onwards)
		const elementsToMove = [];
		for (let i = splitIndex; i < contentElements.length; i++) {
			elementsToMove.push(contentElements[i]);
			console.log(`  - Queuing element ${i} (${contentElements[i].tagName}) for move`);
		}

		console.log(`  - Moving ${elementsToMove.length} elements to new page`);

		// Now append them to the new wrapper
		elementsToMove.forEach((el, idx) => {
			newWrapper.appendChild(el);
			console.log(`  - Moved element ${idx}: ${el.tagName}`);
		});

		// Add wrapper to new page
		newPage.appendChild(newWrapper);

		// Add page number to new page (will be updated during renumbering)
		const newPageNumber = document.createElement('div');
		newPageNumber.className = 'page-number';
		newPageNumber.textContent = `Page ${currentPageNum + 1}`;
		newPage.appendChild(newPageNumber);

		// Track modifications on new page
		newPage.addEventListener('input', () => {
			trackModification();
			checkPageOverflow(newPage);
		});

		// Handle backspace to delete empty pages
		newPage.addEventListener('keydown', (e) => {
			if (e.key === 'Backspace') {
				handleBackspaceForPageDeletion(newPage);
			} else if (e.key === 'Enter') {
				// Debounce Enter key
			}
		});

		// Insert new page AFTER current page in DOM order
		console.log(`  - Attempting to insert new page after current page ${currentPageNum}`);

		// Use nextSibling to insert right after currentPage
		if (currentPage.nextSibling) {
			pagesContainer.insertBefore(newPage, currentPage.nextSibling);
			console.log(`  ✓ Inserted new page right after current page (before its next sibling)`);
		} else {
			// currentPage is the last child, append to end
			pagesContainer.appendChild(newPage);
			console.log(`  ✓ Appended new page to end (current page was last)`);
		}

		// Renumber ALL pages in DOM order to maintain sequential numbering
		const allPages = Array.from(pagesContainer.querySelectorAll('.docx-page'));
		console.log(`  - Renumbering ${allPages.length} total pages in DOM order`);

		allPages.forEach((p, index) => {
			const oldNum = p.getAttribute('data-page-number');
			const newNum = index + 1;
			p.setAttribute('data-page-number', newNum);
			const pNum = p.querySelector('.page-number');
			if (pNum) {
				pNum.textContent = `Page ${newNum}`;
			}
			console.log(`    - Page at DOM index ${index}: ${oldNum || 'new'} → Page ${newNum}`);
		});

		// Update total pages
		totalPages = allPages.length;
		updatePageNavigation();

		console.log(`[DOCX Webview] ✅ Created new page. Total pages now: ${totalPages}`);

		// Focus the new page so cursor moves there
		setTimeout(() => {
			newPage.focus();
			// Move cursor to start of new page content
			const selection = window.getSelection();
			const range = document.createRange();
			const firstContentElement = newWrapper.firstChild;
			if (firstContentElement) {
				range.setStart(firstContentElement, 0);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
				console.log(`  ✓ Moved cursor to new page`);
			}
		}, 50);
	}

	/**
	 * Handle backspace key to delete empty pages
	 */
	function handleBackspaceForPageDeletion(page) {
		const pagesContainer = container.querySelector('.pages-container');
		if (!pagesContainer) return;

		const allPages = Array.from(pagesContainer.querySelectorAll('.docx-page'));
		if (allPages.length <= 1) return; // Don't delete if it's the only page

		// Check if page is empty (only has page number or wrapper with no content)
		const pageNumber = page.querySelector('.page-number');
		const contentElements = Array.from(page.children).filter(child =>
			!child.classList.contains('page-number')
		);

		let isEmpty = false;
		if (contentElements.length === 0) {
			isEmpty = true;
		} else if (contentElements.length === 1) {
			const wrapper = contentElements[0];
			const innerContent = wrapper.textContent.trim();
			if (innerContent === '') {
				isEmpty = true;
			}
		}

		if (isEmpty && window.getSelection().toString() === '') {
			console.log(`[DOCX Webview] Deleting empty page ${page.getAttribute('data-page-number')}`);

			// Focus previous page before deletion
			const currentIndex = allPages.indexOf(page);
			if (currentIndex > 0) {
				const prevPage = allPages[currentIndex - 1];
				prevPage.focus();

				// Move cursor to end of previous page
				const selection = window.getSelection();
				const range = document.createRange();
				const lastChild = prevPage.lastChild;
				if (lastChild && !lastChild.classList.contains('page-number')) {
					range.selectNodeContents(lastChild);
					range.collapse(false);
					selection.removeAllRanges();
					selection.addRange(range);
				}
			}

			// Remove the empty page
			page.remove();

			// Renumber remaining pages
			const remainingPages = pagesContainer.querySelectorAll('.docx-page');
			remainingPages.forEach((p, index) => {
				p.setAttribute('data-page-number', index + 1);
				const pNum = p.querySelector('.page-number');
				if (pNum) {
					pNum.textContent = `Page ${index + 1}`;
				}
			});

			totalPages = remainingPages.length;
			updatePageNavigation();
			trackModification();
		}
	}

	/**
	 * Update page navigation state
	 */
	function updatePageNavigation() {
		pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
		prevPageBtn.disabled = currentPage <= 1;
		nextPageBtn.disabled = currentPage >= totalPages;
	}

	/**
	 * Navigate to a specific page
	 */
	function navigateToPage(pageNumber) {
		const pages = container.querySelectorAll('.docx-page');
		if (pageNumber < 1 || pageNumber > pages.length) {
			return;
		}

		currentPage = pageNumber;
		const targetPage = pages[pageNumber - 1];

		// Scroll to page with smooth animation
		targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });

		updatePageNavigation();
	}

	// Page navigation event listeners
	prevPageBtn.addEventListener('click', () => {
		if (currentPage > 1) {
			navigateToPage(currentPage - 1);
		}
	});

	nextPageBtn.addEventListener('click', () => {
		if (currentPage < totalPages) {
			navigateToPage(currentPage + 1);
		}
	});

	// Update current page on scroll
	let scrollTimeout;
	container.addEventListener('scroll', () => {
		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(() => {
			const pages = container.querySelectorAll('.docx-page');
			const containerRect = container.getBoundingClientRect();
			const containerTop = containerRect.top;

			// Find which page is most visible
			let closestPage = 1;
			let smallestDistance = Infinity;

			pages.forEach((page, index) => {
				const pageRect = page.getBoundingClientRect();
				const pageTop = pageRect.top;
				const distance = Math.abs(pageTop - containerTop);

				if (distance < smallestDistance) {
					smallestDistance = distance;
					closestPage = index + 1;
				}
			});

			if (closestPage !== currentPage) {
				currentPage = closestPage;
				updatePageNavigation();
			}
		}, 100);
	});

	// Page size selector
	pageSizeSelect.addEventListener('change', (e) => {
		const newSize = e.target.value;
		const pages = container.querySelectorAll('.docx-page');

		// Update all pages with new size
		pages.forEach(page => {
			// Remove old size class
			page.classList.remove('size-letter', 'size-legal', 'size-tabloid', 'size-a4', 'size-a3');
			// Add new size class
			page.classList.add(`size-${newSize}`);
		});

		currentPageSize = newSize;
		console.log(`[DOCX Webview] Page size changed to: ${newSize}`);
		trackModification();
	});

	// Margin preset selector
	marginPresetSelect.addEventListener('change', (e) => {
		const newMargin = e.target.value;

		if (newMargin === 'custom') {
			// Open custom margins dialog
			showMarginsDialog();
			return;
		}

		const pages = container.querySelectorAll('.docx-page');

		// Update all pages with new margin
		pages.forEach(page => {
			// Remove old margin classes
			page.classList.remove('margin-normal', 'margin-narrow', 'margin-moderate', 'margin-wide');
			// Add new margin class
			page.classList.add(`margin-${newMargin}`);
		});

		currentMarginPreset = newMargin;
		console.log(`[DOCX Webview] Margin preset changed to: ${newMargin}`);
		trackModification();
	});

	// Show margin guides toggle
	showMarginsBtn.addEventListener('click', () => {
		showMarginGuides = !showMarginGuides;
		const pagesContainer = container.querySelector('.pages-container');

		if (showMarginGuides) {
			pagesContainer.classList.add('show-margin-guides');
			showMarginsBtn.classList.add('active');
		} else {
			pagesContainer.classList.remove('show-margin-guides');
			showMarginsBtn.classList.remove('active');
		}

		console.log(`[DOCX Webview] Margin guides ${showMarginGuides ? 'shown' : 'hidden'}`);
	});

	// Word wrap toggle
	wordWrapBtn.addEventListener('click', () => {
		wordWrapEnabled = !wordWrapEnabled;
		const pages = container.querySelectorAll('.docx-page');

		pages.forEach(page => {
			if (wordWrapEnabled) {
				page.classList.remove('word-wrap-disabled');
				page.classList.add('word-wrap-enabled');
			} else {
				page.classList.remove('word-wrap-enabled');
				page.classList.add('word-wrap-disabled');
			}
		});

		// Update button state
		wordWrapBtn.classList.toggle('active', wordWrapEnabled);

		console.log(`[DOCX Webview] Word wrap ${wordWrapEnabled ? 'enabled' : 'disabled'}`);
	});

	// ===== FORMATTING TOOLBAR EVENT HANDLERS =====

	// Basic text formatting
	boldBtn.addEventListener('click', () => execFormatCommand('bold'));
	italicBtn.addEventListener('click', () => execFormatCommand('italic'));
	underlineBtn.addEventListener('click', () => execFormatCommand('underline'));
	strikethroughBtn.addEventListener('click', () => execFormatCommand('strikeThrough'));

	// Font family and size
	fontFamilySelect.addEventListener('change', (e) => {
		const fontFamily = e.target.value;
		const selection = window.getSelection();

		if (selection.rangeCount > 0 && !selection.isCollapsed) {
			// Apply to selected text
			const range = selection.getRangeAt(0);

			try {
				const span = document.createElement('span');
				span.style.fontFamily = fontFamily;
				range.surroundContents(span);
			} catch (err) {
				// If surroundContents fails (e.g., partial element selection), extract and wrap
				const fragment = range.extractContents();
				const span = document.createElement('span');
				span.style.fontFamily = fontFamily;
				span.appendChild(fragment);
				range.insertNode(span);

				// Restore selection
				const newRange = document.createRange();
				newRange.selectNodeContents(span);
				selection.removeAllRanges();
				selection.addRange(newRange);
			}
		}

		trackModification();
		updateActiveStates();
	});

	fontSizeSelect.addEventListener('change', (e) => {
		const fontSize = e.target.value + 'px';
		const selection = window.getSelection();

		if (selection.rangeCount > 0 && !selection.isCollapsed) {
			// Apply to selected text
			const range = selection.getRangeAt(0);

			try {
				const span = document.createElement('span');
				span.style.fontSize = fontSize;
				range.surroundContents(span);
			} catch (err) {
				// Fallback: manually wrap contents
				const fragment = range.extractContents();
				const span = document.createElement('span');
				span.style.fontSize = fontSize;
				span.appendChild(fragment);
				range.insertNode(span);

				// Restore selection
				const newRange = document.createRange();
				newRange.selectNodeContents(span);
				selection.removeAllRanges();
				selection.addRange(newRange);
			}
		}

		trackModification();
		updateActiveStates();
	});

	// Text color
	textColorInput.addEventListener('change', (e) => {
		execFormatCommand('foreColor', e.target.value);
	});

	// Highlight color
	highlightColorInput.addEventListener('change', (e) => {
		execFormatCommand('hiliteColor', e.target.value);
	});

	// Paragraph alignment
	alignLeftBtn.addEventListener('click', () => execFormatCommand('justifyLeft'));
	alignCenterBtn.addEventListener('click', () => execFormatCommand('justifyCenter'));
	alignRightBtn.addEventListener('click', () => execFormatCommand('justifyRight'));
	justifyBtn.addEventListener('click', () => execFormatCommand('justifyFull'));

	// Lists
	bulletsBtn.addEventListener('click', () => execFormatCommand('insertUnorderedList'));
	numberingBtn.addEventListener('click', () => execFormatCommand('insertOrderedList'));

	// Indent/Outdent
	indentBtn.addEventListener('click', () => execFormatCommand('indent'));
	outdentBtn.addEventListener('click', () => execFormatCommand('outdent'));

	// Heading styles
	headingStyleSelect.addEventListener('change', (e) => {
		const tag = e.target.value;
		if (tag) {
			execFormatCommand('formatBlock', tag);
		} else {
			execFormatCommand('formatBlock', 'p');
		}
	});

	// Insert page break
	pageBreakBtn.addEventListener('click', insertPageBreak);

	// Insert table
	insertTableBtn.addEventListener('click', insertTable);

	// Insert image
	insertImageBtn.addEventListener('click', insertImage);

	// Margins dialog
	marginsBtn.addEventListener('click', showMarginsDialog);

	// Keep with next toggle
	keepWithNextBtn.addEventListener('click', toggleKeepWithNext);

	// ===== FORMATTING FUNCTIONS =====

	function toggleKeepWithNext() {
		const selection = window.getSelection();
		if (!selection.rangeCount) return;

		// Find the paragraph or heading element
		let element = selection.anchorNode;
		while (element && element !== container) {
			if (element.tagName && (
				element.tagName.toLowerCase() === 'p' ||
				element.tagName.toLowerCase().match(/^h[1-6]$/)
			)) {
				break;
			}
			element = element.parentElement;
		}

		if (!element || !element.tagName) {
			console.warn('[DOCX Webview] No paragraph or heading selected');
			return;
		}

		// Toggle keep-with-next class
		element.classList.toggle('keep-with-next');

		const isEnabled = element.classList.contains('keep-with-next');
		console.log(`[DOCX Webview] Keep with next ${isEnabled ? 'enabled' : 'disabled'} for element`);

		trackModification();
		updateActiveStates();
	}

	function insertPageBreak() {
		const selection = window.getSelection();
		if (!selection.rangeCount) return;

		const range = selection.getRangeAt(0);

		// Find which page we're in
		let currentPageEl = range.startContainer;
		while (currentPageEl && !currentPageEl.classList?.contains('docx-page')) {
			currentPageEl = currentPageEl.parentElement;
		}

		if (!currentPageEl) return;

		// Create a new page
		const pagesContainer = container.querySelector('.pages-container');
		if (!pagesContainer) return;

		const currentPageNum = parseInt(currentPageEl.getAttribute('data-page-number'));

		// Get content after cursor
		const afterContent = range.extractContents();

		// Create new page
		const newPage = document.createElement('div');
		const wrapClass = wordWrapEnabled ? 'word-wrap-enabled' : 'word-wrap-disabled';
		newPage.className = `docx-page ${wrapClass} size-${currentPageSize} margin-${currentMarginPreset}`;
		newPage.contentEditable = 'true';
		newPage.setAttribute('data-page-number', currentPageNum + 1);
		newPage.appendChild(afterContent);

		// Add page number
		const pageNumber = document.createElement('div');
		pageNumber.className = 'page-number';
		pageNumber.textContent = `Page ${currentPageNum + 1}`;
		newPage.appendChild(pageNumber);

		// Track modifications
		newPage.addEventListener('input', () => trackModification());

		// Insert new page after current
		const nextPage = currentPageEl.nextElementSibling;
		if (nextPage) {
			pagesContainer.insertBefore(newPage, nextPage);
		} else {
			pagesContainer.appendChild(newPage);
		}

		// Renumber all subsequent pages
		const allPages = pagesContainer.querySelectorAll('.docx-page');
		allPages.forEach((page, index) => {
			page.setAttribute('data-page-number', index + 1);
			const pageNum = page.querySelector('.page-number');
			if (pageNum) {
				pageNum.textContent = `Page ${index + 1}`;
			}
		});

		// Update total pages
		totalPages = allPages.length;
		updatePageNavigation();

		// Focus on new page
		newPage.focus();

		trackModification();
	}

	function insertTable() {
		const rows = prompt('Number of rows:', '3');
		const cols = prompt('Number of columns:', '3');

		if (!rows || !cols) return;

		let tableHTML = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 12px 0;">';
		for (let i = 0; i < parseInt(rows); i++) {
			tableHTML += '<tr>';
			for (let j = 0; j < parseInt(cols); j++) {
				tableHTML += '<td style="border: 1px solid var(--vscode-panel-border); padding: 8px;">&nbsp;</td>';
			}
			tableHTML += '</tr>';
		}
		tableHTML += '</table>';

		execFormatCommand('insertHTML', tableHTML);
	}

	function insertImage() {
		const url = prompt('Enter image URL:');
		if (!url) return;

		const imgHTML = `<img src="${url}" style="max-width: 100%; height: auto; margin: 12px 0;" />`;
		execFormatCommand('insertHTML', imgHTML);
	}

	function showMarginsDialog() {
		const dialog = document.createElement('div');
		dialog.className = 'margins-dialog';
		dialog.innerHTML = `
			<div class="dialog-content">
				<h3>Page Margins</h3>
				<label>Top: <input type="number" id="margin-top" value="40" min="0" step="5"> px</label>
				<label>Right: <input type="number" id="margin-right" value="40" min="0" step="5"> px</label>
				<label>Bottom: <input type="number" id="margin-bottom" value="40" min="0" step="5"> px</label>
				<label>Left: <input type="number" id="margin-left" value="40" min="0" step="5"> px</label>
				<div>
					<button id="apply-margins">Apply</button>
					<button id="cancel-margins">Cancel</button>
				</div>
			</div>
		`;

		document.body.appendChild(dialog);

		// Get current margins
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (docxWrapper) {
			const style = window.getComputedStyle(docxWrapper);
			const currentPadding = style.padding.split(' ');
			if (currentPadding.length >= 4) {
				document.getElementById('margin-top').value = parseInt(currentPadding[0]);
				document.getElementById('margin-right').value = parseInt(currentPadding[1]);
				document.getElementById('margin-bottom').value = parseInt(currentPadding[2]);
				document.getElementById('margin-left').value = parseInt(currentPadding[3]);
			}
		}

		// Apply button
		document.getElementById('apply-margins').addEventListener('click', () => {
			const top = document.getElementById('margin-top').value;
			const right = document.getElementById('margin-right').value;
			const bottom = document.getElementById('margin-bottom').value;
			const left = document.getElementById('margin-left').value;

			adjustMargins(top, right, bottom, left);
			document.body.removeChild(dialog);
		});

		// Cancel button
		document.getElementById('cancel-margins').addEventListener('click', () => {
			document.body.removeChild(dialog);
		});

		// Close on background click
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				document.body.removeChild(dialog);
			}
		});
	}

	function adjustMargins(top, right, bottom, left) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (docxWrapper) {
			docxWrapper.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
			trackModification();
		}
	}

	// Update active button states based on current selection
	function updateActiveStates() {
		try {
			// Update format buttons
			boldBtn.classList.toggle('active', document.queryCommandState('bold'));
			italicBtn.classList.toggle('active', document.queryCommandState('italic'));
			underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
			strikethroughBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));

			alignLeftBtn.classList.toggle('active', document.queryCommandState('justifyLeft'));
			alignCenterBtn.classList.toggle('active', document.queryCommandState('justifyCenter'));
			alignRightBtn.classList.toggle('active', document.queryCommandState('justifyRight'));
			justifyBtn.classList.toggle('active', document.queryCommandState('justifyFull'));

			bulletsBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
			numberingBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'));

			// Update font family - check both queryCommandValue and computed style
			const selection = window.getSelection();
			if (selection.anchorNode) {
				const element = selection.anchorNode.nodeType === Node.TEXT_NODE
					? selection.anchorNode.parentElement
					: selection.anchorNode;

				if (element) {
					const computedStyle = window.getComputedStyle(element);
					const fontFamily = computedStyle.fontFamily.replace(/['"]/g, '').split(',')[0].trim();

					// Try to match with dropdown options
					const options = Array.from(fontFamilySelect.options);
					const matchingOption = options.find(opt =>
						opt.value.toLowerCase() === fontFamily.toLowerCase()
					);

					if (matchingOption) {
						fontFamilySelect.value = matchingOption.value;
					}

					// Check for keep-with-next on current paragraph
					let parent = element;
					while (parent && parent !== container) {
						if (parent.tagName && (
							parent.tagName.toLowerCase() === 'p' ||
							parent.tagName.toLowerCase().match(/^h[1-6]$/)
						)) {
							keepWithNextBtn.classList.toggle('active', parent.classList.contains('keep-with-next'));
							break;
						}
						parent = parent.parentElement;
					}
				}
			}

			// Update heading style based on current block
			if (selection.anchorNode) {
				let parent = selection.anchorNode.parentElement;
				while (parent && parent !== container) {
					const tagName = parent.tagName.toLowerCase();
					if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
						headingStyleSelect.value = tagName;
						break;
					} else if (tagName === 'p') {
						headingStyleSelect.value = '';
						break;
					}
					parent = parent.parentElement;
				}
			}
		} catch (e) {
			// Ignore errors from queryCommandState
		}
	}

	// Update active states on selection change
	document.addEventListener('selectionchange', updateActiveStates);

	// Save button handler
	saveBtn.addEventListener('click', () => {
		if (!docxRendered || !contentModified) {
			return;
		}

		saveDocument();
	});

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		// Ctrl+S or Cmd+S to save
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			saveDocument();
		}

		// Ctrl+B for bold
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			execFormatCommand('bold');
		}

		// Ctrl+I for italic
		if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
			e.preventDefault();
			execFormatCommand('italic');
		}

		// Ctrl+U for underline
		if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
			e.preventDefault();
			execFormatCommand('underline');
		}

		// Ctrl+Shift+L for align left
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
			e.preventDefault();
			execFormatCommand('justifyLeft');
		}

		// Ctrl+Shift+E for align center
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
			e.preventDefault();
			execFormatCommand('justifyCenter');
		}

		// Ctrl+Shift+R for align right
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
			e.preventDefault();
			execFormatCommand('justifyRight');
		}

		// Ctrl+Shift+7 for numbered list
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') {
			e.preventDefault();
			execFormatCommand('insertOrderedList');
		}

		// Ctrl+Shift+8 for bullet list
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') {
			e.preventDefault();
			execFormatCommand('insertUnorderedList');
		}

		// Ctrl+Enter for page break
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			insertPageBreak();
		}

		// Page Up - navigate to previous page
		if (e.key === 'PageUp' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
			if (currentPage > 1) {
				e.preventDefault();
				navigateToPage(currentPage - 1);
			}
		}

		// Page Down - navigate to next page
		if (e.key === 'PageDown' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
			if (currentPage < totalPages) {
				e.preventDefault();
				navigateToPage(currentPage + 1);
			}
		}

		// Ctrl+Z or Cmd+Z for undo (browser default)
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
			// Browser will handle undo
			if (contentModified) {
				updateStatus('Modified');
			}
		}

		// Ctrl+Y or Cmd+Shift+Z for redo (browser default)
		if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
			// Browser will handle redo
			if (contentModified) {
				updateStatus('Modified');
			}
		}
	});

	function saveDocument() {
		if (!docxRendered) {
			return;
		}

		updateStatus('Saving...');
		saveBtn.disabled = true;

		// Get all pages
		const pages = container.querySelectorAll('.docx-page');
		let html = '';
		let text = '';

		pages.forEach(page => {
			// Clone page content without page number
			const pageClone = page.cloneNode(true);
			const pageNum = pageClone.querySelector('.page-number');
			if (pageNum) {
				pageNum.remove();
			}

			html += pageClone.innerHTML + '\n<div class="page-break"></div>\n';
			text += page.innerText.replace(/Page \d+/g, '').trim() + '\n\n';
		});

		// Get margins from first page (assuming all pages have same margins)
		let margins = { top: 96, right: 96, bottom: 96, left: 96 }; // Default 1 inch = 96px

		// Send to host for saving
		vscode.postMessage({
			type: 'saveRequested',
			html: html,
			text: text.trim(),
			margins: margins
		});
	}

	function handleSaveComplete(message) {
		saveBtn.disabled = false;

		if (message.success) {
			contentModified = false;
			updateStatus('Saved');
			setTimeout(() => {
				if (!contentModified) {
					updateStatus('Ready');
				}
			}, 2000);
		} else {
			updateStatus('Save failed: ' + (message.error || 'Unknown error'));
		}
	}

	function updateStatus(text) {
		statusText.textContent = text;
	}

	// Text selection handler for Ctrl+K
	document.addEventListener('selectionchange', () => {
		const selection = window.getSelection();
		if (selection && !selection.isCollapsed) {
			const selectedText = selection.toString().trim();
			if (selectedText) {
				// Get selected HTML for context
				const range = selection.getRangeAt(0);
				const clonedSelection = range.cloneContents();
				const div = document.createElement('div');
				div.appendChild(clonedSelection);
				const selectedHtml = div.innerHTML;

				vscode.postMessage({
					type: 'textSelected',
					selection: {
						text: selectedText,
						html: selectedHtml
					}
				});
			}
		} else {
			vscode.postMessage({ type: 'clearSelection' });
		}
	});

	// Initial status
	updateStatus('Ready');

	// ===== AGENT EDIT OPERATIONS =====

	/**
	 * Execute document operations from agent tool calls
	 */
	function executeDocumentOperations(operations) {
		if (!docxRendered || !Array.isArray(operations)) {
			console.warn('[DOCX Webview] Cannot execute operations: document not rendered or invalid operations');
			return;
		}

		console.log(`[DOCX Webview] Executing ${operations.length} operation(s)`);

		operations.forEach(op => {
			try {
				switch (op.type) {
					case 'format_text':
						applyTextFormatting(op);
						break;
					case 'insert_text':
						insertTextAtPosition(op);
						break;
					case 'insert_table':
						insertTable(op.rows, op.cols);
						break;
					case 'insert_page_break':
						insertPageBreak();
						break;
					case 'set_margins':
						if (op.margins) {
							adjustMargins(op.margins.top, op.margins.right, op.margins.bottom, op.margins.left);
						}
						break;
					case 'replace_text':
						replaceText(op.search, op.replace, op.all);
						break;
					default:
						console.warn(`[DOCX Webview] Unknown operation type: ${op.type}`);
				}
			} catch (error) {
				console.error(`[DOCX Webview] Error executing operation ${op.type}:`, error);
			}
		});

		// Mark as modified and notify host
		trackModification();
		updateStatus(`Applied ${operations.length} edit operation(s)`);
	}

	/**
	 * Apply text formatting to a range
	 */
	function applyTextFormatting(op) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (!docxWrapper) return;

		// This is a simplified implementation
		// In a real implementation, you'd need to:
		// 1. Find the text range by character position
		// 2. Create a selection
		// 3. Apply the formatting commands

		const textContent = docxWrapper.innerText;
		const start = op.range?.start || 0;
		const end = op.range?.end || textContent.length;

		// For now, we'll apply formatting to current selection or entire document
		const selection = window.getSelection();

		if (op.format.bold !== undefined) {
			document.execCommand('bold', false, null);
		}
		if (op.format.italic !== undefined) {
			document.execCommand('italic', false, null);
		}
		if (op.format.underline !== undefined) {
			document.execCommand('underline', false, null);
		}
		if (op.format.fontSize) {
			document.execCommand('fontSize', false, '7');
			const span = document.createElement('span');
			span.style.fontSize = op.format.fontSize + 'px';
		}
		if (op.format.fontFamily) {
			document.execCommand('fontName', false, op.format.fontFamily);
		}
		if (op.format.color) {
			document.execCommand('foreColor', false, op.format.color);
		}

		console.log(`[DOCX Webview] Applied text formatting`);
	}

	/**
	 * Insert text at a position
	 */
	function insertTextAtPosition(op) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (!docxWrapper) return;

		// Insert at the end for now (simplified)
		const p = document.createElement('p');
		p.textContent = op.text;
		docxWrapper.appendChild(p);

		console.log(`[DOCX Webview] Inserted text: "${op.text}"`);
	}

	/**
	 * Replace text in document
	 */
	function replaceText(search, replace, all = false) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (!docxWrapper) return;

		let count = 0;
		const walk = document.createTreeWalker(docxWrapper, NodeFilter.SHOW_TEXT);
		const nodes = [];
		while (walk.nextNode()) {
			nodes.push(walk.currentNode);
		}

		nodes.forEach(node => {
			if (node.nodeValue) {
				if (all) {
					const newValue = node.nodeValue.split(search).join(replace);
					if (newValue !== node.nodeValue) {
						node.nodeValue = newValue;
						count++;
					}
				} else if (node.nodeValue.includes(search)) {
					node.nodeValue = node.nodeValue.replace(search, replace);
					count++;
				}
			}
		});

		console.log(`[DOCX Webview] Replaced ${count} occurrence(s) of "${search}" with "${replace}"`);
	}

})();


