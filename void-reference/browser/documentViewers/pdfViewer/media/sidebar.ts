/*--------------------------------------------------------------------------------------
 *  PDF Viewer Sidebar
 *  Handles thumbnails, outline, and bookmarks tabs.
 *  Thumbnails are rendered via WASM ImageData painted onto small canvases.
 *--------------------------------------------------------------------------------------*/

export interface OutlineItem {
	title: string;
	page_index: number | null;
	children: OutlineItem[];
}

export interface Bookmark {
	id: string;
	page: number;
	text: string;
}

export class Sidebar {
	private thumbnailsContainer: HTMLElement;
	private outlineContainer: HTMLElement;
	private bookmarksContainer: HTMLElement;
	private onNavigate: (page: number) => void;

	constructor(
		thumbnailsContainer: HTMLElement,
		outlineContainer: HTMLElement,
		bookmarksContainer: HTMLElement,
		onNavigate: (page: number) => void
	) {
		this.thumbnailsContainer = thumbnailsContainer;
		this.outlineContainer = outlineContainer;
		this.bookmarksContainer = bookmarksContainer;
		this.onNavigate = onNavigate;
	}

	/**
	 * Set thumbnail images from WASM-rendered ImageData objects.
	 */
	setThumbnails(thumbnails: Array<{ pageNum: number; imageData: ImageData }>, activePage: number) {
		this.thumbnailsContainer.innerHTML = '';

		for (const { pageNum, imageData } of thumbnails) {
			const thumbItem = document.createElement('div');
			thumbItem.className = 'thumbnail-item';
			thumbItem.dataset.page = pageNum.toString();

			const thumbCanvas = document.createElement('canvas');
			thumbCanvas.className = 'thumbnail-canvas';
			thumbCanvas.width = imageData.width;
			thumbCanvas.height = imageData.height;

			const thumbCtx = thumbCanvas.getContext('2d');
			if (thumbCtx) {
				thumbCtx.putImageData(imageData, 0, 0);
			}

			const label = document.createElement('div');
			label.className = 'thumbnail-label';
			label.textContent = `Page ${pageNum}`;

			thumbItem.appendChild(thumbCanvas);
			thumbItem.appendChild(label);

			thumbItem.addEventListener('click', () => {
				this.onNavigate(pageNum);
			});

			if (pageNum === activePage) {
				thumbItem.classList.add('active');
			}

			this.thumbnailsContainer.appendChild(thumbItem);
		}
	}

	/**
	 * Update which thumbnail is highlighted as active.
	 */
	updateActiveThumbnail(pageNum: number) {
		const thumbnails = this.thumbnailsContainer.querySelectorAll('.thumbnail-item');
		thumbnails.forEach(thumb => {
			const el = thumb as HTMLElement;
			if (parseInt(el.dataset.page || '0') === pageNum) {
				el.classList.add('active');
				el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			} else {
				el.classList.remove('active');
			}
		});
	}

	/**
	 * Set the document outline from WASM-extracted data.
	 */
	setOutline(items: OutlineItem[]) {
		this.outlineContainer.innerHTML = '';

		if (!items || items.length === 0) {
			this.outlineContainer.innerHTML = '<div class="outline-empty">No outline available</div>';
			return;
		}

		this.renderOutlineItems(items, this.outlineContainer, 1);
	}

	private renderOutlineItems(items: OutlineItem[], container: HTMLElement, level: number) {
		for (const item of items) {
			const outlineItem = document.createElement('div');
			outlineItem.className = `outline-item level-${Math.min(level, 3)}`;
			outlineItem.textContent = item.title;
			outlineItem.title = item.title;

			if (item.page_index !== null && item.page_index !== undefined) {
				outlineItem.style.cursor = 'pointer';
				const pageIndex = item.page_index;
				outlineItem.addEventListener('click', () => {
					this.onNavigate(pageIndex + 1); // Convert 0-indexed to 1-indexed
				});
			}

			container.appendChild(outlineItem);

			if (item.children && item.children.length > 0) {
				this.renderOutlineItems(item.children, container, level + 1);
			}
		}
	}

	/**
	 * Render bookmarks in the sidebar from annotation data.
	 */
	renderBookmarks(bookmarks: Bookmark[]) {
		this.bookmarksContainer.innerHTML = '';

		if (!bookmarks || bookmarks.length === 0) {
			this.bookmarksContainer.innerHTML = '<div class="bookmarks-empty">No bookmarks yet</div>';
			return;
		}

		// Sort by page
		const sorted = [...bookmarks].sort((a, b) => a.page - b.page);

		for (const bookmark of sorted) {
			const item = document.createElement('div');
			item.className = 'bookmark-item';
			item.dataset.annotationId = bookmark.id;

			const label = document.createElement('span');
			label.className = 'bookmark-label';
			label.textContent = bookmark.text || `Page ${bookmark.page}`;

			const pageNum = document.createElement('span');
			pageNum.className = 'bookmark-page';
			pageNum.textContent = `p.${bookmark.page}`;

			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'bookmark-delete';
			deleteBtn.textContent = '\u00d7';
			deleteBtn.title = 'Delete bookmark';
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				// Dispatched via custom event, handled by main.ts
				document.dispatchEvent(new CustomEvent('deleteBookmark', { detail: bookmark.id }));
			});

			item.appendChild(label);
			item.appendChild(pageNum);
			item.appendChild(deleteBtn);

			item.addEventListener('click', () => {
				this.onNavigate(bookmark.page);
			});

			this.bookmarksContainer.appendChild(item);
		}
	}
}
