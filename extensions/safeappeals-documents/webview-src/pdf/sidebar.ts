/*--------------------------------------------------------------------------------------
 *  PDF Viewer Sidebar
 *  Handles thumbnails, outline, and bookmarks tabs.
 *  Thumbnails are rendered lazily: placeholder tiles are created for every page up
 *  front, an IntersectionObserver detects tiles near the viewport, and a queue paints
 *  one WASM-rendered thumbnail per animation frame so the main viewer stays responsive.
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

const THUMBNAIL_WIDTH = 150;
// A4 portrait fallback when page dimensions are unavailable
const DEFAULT_PAGE_ASPECT = 297 / 210;

export class Sidebar {
	private thumbnailsContainer: HTMLElement;
	private outlineContainer: HTMLElement;
	private bookmarksContainer: HTMLElement;
	private onNavigate: (page: number) => void;

	// Lazy thumbnail state
	private thumbObserver: IntersectionObserver | null = null;
	private thumbQueue: number[] = [];
	private thumbWorkScheduled = false;
	private renderedThumbs = new Set<number>();
	private thumbCanvases = new Map<number, HTMLCanvasElement>();
	private renderThumbnail: ((pageNum: number) => ImageData | null) | null = null;
	// Bumped on every reset so in-flight rAF callbacks/observer entries from a
	// previous document are ignored instead of painting stale content.
	private thumbGeneration = 0;

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
	 * Create placeholder tiles for every page immediately (page number + aspect-ratio
	 * box). Actual pixels are rendered on demand as tiles scroll into view.
	 *
	 * @param renderThumbnail Callback that rasterizes one page via WASM and returns a
	 * detached ImageData copy (safe from pdfium buffer reuse), or null on failure.
	 */
	setThumbnailPlaceholders(
		pageCount: number,
		pageDimensions: Array<{ width: number; height: number }>,
		activePage: number,
		renderThumbnail: (pageNum: number) => ImageData | null,
	) {
		this.clearThumbnails();
		this.renderThumbnail = renderThumbnail;
		const generation = this.thumbGeneration;

		// Root defaults to the viewport, which nested scroll containers still clip
		// against; 300px margin pre-renders tiles just outside the visible band.
		this.thumbObserver = new IntersectionObserver((entries) => {
			if (generation !== this.thumbGeneration) {
				return;
			}
			for (const entry of entries) {
				if (!entry.isIntersecting) {
					continue;
				}
				const page = parseInt((entry.target as HTMLElement).dataset.page || '0');
				if (page > 0 && !this.renderedThumbs.has(page) && !this.thumbQueue.includes(page)) {
					this.thumbQueue.push(page);
				}
			}
			this.scheduleThumbnailWork();
		}, { rootMargin: '300px 0px', threshold: 0 });

		const fragment = document.createDocumentFragment();
		for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
			const dims = pageDimensions[pageNum - 1];
			const aspect = dims && dims.width > 0 ? dims.height / dims.width : DEFAULT_PAGE_ASPECT;

			const thumbItem = document.createElement('div');
			thumbItem.className = 'thumbnail-item';
			thumbItem.dataset.page = pageNum.toString();

			const thumbCanvas = document.createElement('canvas');
			thumbCanvas.className = 'thumbnail-canvas';
			thumbCanvas.width = THUMBNAIL_WIDTH;
			thumbCanvas.height = Math.max(1, Math.round(THUMBNAIL_WIDTH * aspect));

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

			fragment.appendChild(thumbItem);
			this.thumbCanvases.set(pageNum, thumbCanvas);
		}
		this.thumbnailsContainer.appendChild(fragment);

		for (const canvas of this.thumbCanvases.values()) {
			this.thumbObserver.observe(canvas.parentElement!);
		}

		// Make sure the active page's tile fills in promptly even before scrolling.
		this.prioritizeThumbnail(activePage);
	}

	/**
	 * Move a page to the front of the render queue (visible range / active page first).
	 */
	prioritizeThumbnail(pageNum: number) {
		if (pageNum <= 0 || this.renderedThumbs.has(pageNum) || !this.thumbCanvases.has(pageNum)) {
			return;
		}
		const idx = this.thumbQueue.indexOf(pageNum);
		if (idx >= 0) {
			this.thumbQueue.splice(idx, 1);
		}
		this.thumbQueue.unshift(pageNum);
		this.scheduleThumbnailWork();
	}

	/**
	 * Drain the queue one page per animation frame so WASM rasterization never
	 * blocks the main viewer for more than a single tile at a time.
	 */
	private scheduleThumbnailWork() {
		if (this.thumbWorkScheduled || this.thumbQueue.length === 0) {
			return;
		}
		this.thumbWorkScheduled = true;
		const generation = this.thumbGeneration;
		requestAnimationFrame(() => {
			this.thumbWorkScheduled = false;
			if (generation !== this.thumbGeneration) {
				return;
			}
			const page = this.thumbQueue.shift();
			if (page !== undefined && !this.renderedThumbs.has(page)) {
				this.paintThumbnail(page);
			}
			this.scheduleThumbnailWork();
		});
	}

	private paintThumbnail(pageNum: number) {
		const canvas = this.thumbCanvases.get(pageNum);
		if (!canvas || !this.renderThumbnail) {
			return;
		}
		try {
			const imageData = this.renderThumbnail(pageNum);
			if (!imageData) {
				return;
			}
			canvas.width = imageData.width;
			canvas.height = imageData.height;
			canvas.getContext('2d')?.putImageData(imageData, 0, 0);
			this.renderedThumbs.add(pageNum);
			// Painted canvases are the cache: once rendered we stop observing, so
			// re-scrolls never re-rasterize the page.
			const item = canvas.parentElement;
			if (item) {
				this.thumbObserver?.unobserve(item);
			}
		} catch (e) {
			console.error(`[PDF Viewer] Failed to render thumbnail for page ${pageNum}:`, e);
		}
	}

	/**
	 * Tear down observer, queue, and tiles. Safe to call between document loads.
	 */
	clearThumbnails() {
		this.thumbGeneration++;
		this.thumbObserver?.disconnect();
		this.thumbObserver = null;
		this.thumbQueue.length = 0;
		this.thumbWorkScheduled = false;
		this.renderedThumbs.clear();
		this.thumbCanvases.clear();
		this.renderThumbnail = null;
		this.thumbnailsContainer.innerHTML = '';
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
		// Active page jumps the render queue if its tile is still a placeholder.
		this.prioritizeThumbnail(pageNum);
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
