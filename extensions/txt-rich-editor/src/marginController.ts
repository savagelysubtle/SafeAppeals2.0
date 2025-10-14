/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from './logger';

export interface PageMargins {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface PageSize {
	width: number;
	height: number;
	name: string;
}

export interface PageLayout {
	margins: PageMargins;
	orientation: 'portrait' | 'landscape';
	size: PageSize;
	zoom: number;
}

export interface RulerSettings {
	unit: 'inches' | 'centimeters' | 'points';
	showVertical: boolean;
	showHorizontal: boolean;
	markInterval: number;
}

export class MarginController {
	private readonly logger: Logger;
	private currentLayout: PageLayout;
	private isLocked: boolean = false;
	private eventListeners: Map<string, Function[]> = new Map();

	// Standard page sizes at 96 DPI
	private readonly pageSizes: Map<string, PageSize> = new Map([
		['letter', { width: 816, height: 1056, name: 'Letter' }],
		['a4', { width: 794, height: 1123, name: 'A4' }],
		['legal', { width: 816, height: 1344, name: 'Legal' }],
		['tabloid', { width: 1056, height: 1632, name: 'Tabloid' }]
	]);

	constructor(logger: Logger, initialLayout?: Partial<PageLayout>) {
		this.logger = logger;
		this.currentLayout = {
			margins: { top: 96, right: 96, bottom: 96, left: 96 }, // 1 inch at 96 DPI
			orientation: 'portrait',
			size: this.pageSizes.get('letter')!,
			zoom: 1.0,
			...initialLayout
		};
	}

	/**
	 * Get current page layout
	 */
	getLayout(): PageLayout {
		return { ...this.currentLayout };
	}

	/**
	 * Set page layout
	 */
	setLayout(layout: Partial<PageLayout>): void {
		this.currentLayout = { ...this.currentLayout, ...layout };

		this.logger.info('Page layout changed');

		this.emit('layout-changed', this.currentLayout);
	}

	/**
	 * Set page margins
	 */
	setMargins(margins: Partial<PageMargins>): void {
		const newMargins = { ...this.currentLayout.margins, ...margins };
		this.setLayout({ margins: newMargins });
	}

	/**
	 * Set page orientation
	 */
	setOrientation(orientation: 'portrait' | 'landscape'): void {
		const newSize = { ...this.currentLayout.size };

		// Swap dimensions for landscape
		if (orientation === 'landscape') {
			newSize.width = this.currentLayout.size.height;
			newSize.height = this.currentLayout.size.width;
		} else {
			newSize.width = this.currentLayout.size.width;
			newSize.height = this.currentLayout.size.height;
		}

		this.setLayout({ orientation, size: newSize });
	}

	/**
	 * Set page size
	 */
	setPageSize(sizeName: string): void {
		const size = this.pageSizes.get(sizeName);
		if (!size) {
			this.logger.warn(`Unknown page size: ${sizeName}`);
			return;
		}

		const newSize = { ...size };

		// Adjust for orientation
		if (this.currentLayout.orientation === 'landscape') {
			newSize.width = size.height;
			newSize.height = size.width;
		}

		this.setLayout({ size: newSize });
	}

	/**
	 * Set zoom level
	 */
	setZoom(zoom: number): void {
		const clampedZoom = Math.max(0.25, Math.min(3.0, zoom));
		this.setLayout({ zoom: clampedZoom });
	}

	/**
	 * Lock margins (hide drag handles, freeze rulers)
	 */
	lockMargins(locked: boolean): void {
		this.isLocked = locked;
		this.logger.info(`Margins ${locked ? 'locked' : 'unlocked'}`);
		this.emit('margins-locked', locked);
	}

	/**
	 * Check if margins are locked
	 */
	areMarginsLocked(): boolean {
		return this.isLocked;
	}

	/**
	 * Get available page sizes
	 */
	getAvailablePageSizes(): PageSize[] {
		return Array.from(this.pageSizes.values());
	}

	/**
	 * Get page size by name
	 */
	getPageSize(name: string): PageSize | undefined {
		return this.pageSizes.get(name);
	}

	/**
	 * Calculate content area dimensions
	 */
	getContentArea(): { width: number; height: number; x: number; y: number } {
		const { margins, size, zoom } = this.currentLayout;

		return {
			width: (size.width - margins.left - margins.right) * zoom,
			height: (size.height - margins.top - margins.bottom) * zoom,
			x: margins.left * zoom,
			y: margins.top * zoom
		};
	}

	/**
	 * Convert inches to pixels at current DPI
	 */
	inchesToPixels(inches: number): number {
		return inches * 96; // 96 DPI
	}

	/**
	 * Convert pixels to inches at current DPI
	 */
	pixelsToInches(pixels: number): number {
		return pixels / 96; // 96 DPI
	}

	/**
	 * Convert points to pixels
	 */
	pointsToPixels(points: number): number {
		return points * (96 / 72); // 96 DPI, 72 points per inch
	}

	/**
	 * Convert pixels to points
	 */
	pixelsToPoints(pixels: number): number {
		return pixels * (72 / 96); // 96 DPI, 72 points per inch
	}

	/**
	 * Get ruler marks for horizontal ruler
	 */
	getHorizontalRulerMarks(): Array<{ position: number; label: string; isMajor: boolean }> {
		const marks: Array<{ position: number; label: string; isMajor: boolean }> = [];
		const { size, zoom } = this.currentLayout;
		const width = size.width * zoom;

		// Mark every inch
		for (let i = 0; i <= width; i += 96 * zoom) {
			const inches = this.pixelsToInches(i / zoom);
			marks.push({
				position: i,
				label: Math.floor(inches).toString(),
				isMajor: Math.floor(inches) % 2 === 0
			});
		}

		return marks;
	}

	/**
	 * Get ruler marks for vertical ruler
	 */
	getVerticalRulerMarks(): Array<{ position: number; label: string; isMajor: boolean }> {
		const marks: Array<{ position: number; label: string; isMajor: boolean }> = [];
		const { size, zoom } = this.currentLayout;
		const height = size.height * zoom;

		// Mark every inch
		for (let i = 0; i <= height; i += 96 * zoom) {
			const inches = this.pixelsToInches(i / zoom);
			marks.push({
				position: i,
				label: Math.floor(inches).toString(),
				isMajor: Math.floor(inches) % 2 === 0
			});
		}

		return marks;
	}

	/**
	 * Get page break positions
	 */
	getPageBreaks(): number[] {
		const breaks: number[] = [];
		const { size, zoom } = this.currentLayout;
		const pageHeight = size.height * zoom;

		// Calculate where page breaks would occur
		// This is a simplified version - in reality, you'd need to measure content height
		let currentY = pageHeight;
		while (currentY < 10000) { // Arbitrary limit
			breaks.push(currentY);
			currentY += pageHeight;
		}

		return breaks;
	}

	/**
	 * Validate margins
	 */
	validateMargins(margins: PageMargins): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];
		const { size } = this.currentLayout;

		if (margins.left < 0) errors.push('Left margin cannot be negative');
		if (margins.right < 0) errors.push('Right margin cannot be negative');
		if (margins.top < 0) errors.push('Top margin cannot be negative');
		if (margins.bottom < 0) errors.push('Bottom margin cannot be negative');

		if (margins.left + margins.right >= size.width) {
			errors.push('Left and right margins exceed page width');
		}

		if (margins.top + margins.bottom >= size.height) {
			errors.push('Top and bottom margins exceed page height');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Reset to default layout
	 */
	resetToDefault(): void {
		this.setLayout({
			margins: { top: 96, right: 96, bottom: 96, left: 96 },
			orientation: 'portrait',
			size: this.pageSizes.get('letter')!,
			zoom: 1.0
		});
	}

	/**
	 * Export layout as CSS
	 */
	exportAsCSS(): string {
		const { margins, size, zoom } = this.currentLayout;
		const contentArea = this.getContentArea();

		return `
			.document-page {
				width: ${size.width}px;
				height: ${size.height}px;
				transform: scale(${zoom});
				transform-origin: top left;
			}

			.document-content {
				width: ${contentArea.width}px;
				height: ${contentArea.height}px;
				margin-left: ${contentArea.x}px;
				margin-top: ${contentArea.y}px;
			}

			@page {
				size: ${size.name} ${this.currentLayout.orientation};
				margin: ${this.pixelsToInches(margins.top)}in ${this.pixelsToInches(margins.right)}in ${this.pixelsToInches(margins.bottom)}in ${this.pixelsToInches(margins.left)}in;
			}
		`;
	}

	/**
	 * Export layout as JSON
	 */
	exportAsJSON(): string {
		return JSON.stringify(this.currentLayout, null, 2);
	}

	/**
	 * Import layout from JSON
	 */
	importFromJSON(json: string): boolean {
		try {
			const layout = JSON.parse(json);
			this.setLayout(layout);
			return true;
		} catch (error) {
			this.logger.error('Failed to import layout from JSON:', error);
			return false;
		}
	}

	/**
	 * Event emitter functionality
	 */
	on(event: string, listener: Function): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(listener);
	}

	off(event: string, listener: Function): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	private emit(event: string, data: any): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.forEach(listener => {
				try {
					listener(data);
				} catch (error) {
					this.logger.error(`Error in event listener for ${event}:`, error);
				}
			});
		}
	}

	/**
	 * Dispose the margin controller
	 */
	dispose(): void {
		this.logger.info('Disposing margin controller');
		this.eventListeners.clear();
	}
}
