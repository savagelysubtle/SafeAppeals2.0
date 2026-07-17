/*--------------------------------------------------------------------------------------
 *  PDF Form Filling Overlay
 *  Detects interactive form fields reported by the Rust WASM module and renders
 *  HTML input elements positioned over the canvas so users can fill them in.
 *  Values are stored in-memory; they do not round-trip back to the PDF bytes.
 *--------------------------------------------------------------------------------------*/

export interface FormField {
	x: number;
	y: number;
	width: number;
	height: number;
	field_type: string; // 'text' | 'checkbox' | 'radio' | 'select'
	field_name: string;
}

export class FormOverlayManager {
	private overlay: HTMLElement | null = null;
	private fieldValues: Map<string, string> = new Map();

	constructor(
		private readonly renderContainer: HTMLElement,
	) {}

	/**
	 * Render HTML form inputs over the canvas based on detected form fields.
	 * @param fields - Form field descriptors from the Rust WASM module
	 * @param pageWidth - Page width in PDF points
	 * @param pageHeight - Page height in PDF points
	 * @param canvasWidth - Canvas pixel width
	 * @param canvasHeight - Canvas pixel height
	 */
	renderFormFields(
		fields: FormField[],
		pageWidth: number,
		pageHeight: number,
		canvasWidth: number,
		canvasHeight: number,
	) {
		this.removeOverlay();

		if (!fields || fields.length === 0) return;

		const overlay = document.createElement('div');
		overlay.id = 'pdf-form-overlay';
		overlay.style.position = 'absolute';
		overlay.style.left = '0';
		overlay.style.top = '0';
		overlay.style.width = canvasWidth + 'px';
		overlay.style.height = canvasHeight + 'px';
		overlay.style.pointerEvents = 'none';
		overlay.style.zIndex = '4';

		const scaleX = canvasWidth / pageWidth;
		const scaleY = canvasHeight / pageHeight;

		for (const field of fields) {
			const left = field.x * scaleX;
			const top = field.y * scaleY;
			const width = field.width * scaleX;
			const height = field.height * scaleY;

			const wrapper = document.createElement('div');
			wrapper.style.position = 'absolute';
			wrapper.style.left = left + 'px';
			wrapper.style.top = top + 'px';
			wrapper.style.width = width + 'px';
			wrapper.style.height = height + 'px';
			wrapper.style.pointerEvents = 'auto';

			const savedValue = this.fieldValues.get(field.field_name) || '';

			if (field.field_type === 'checkbox') {
				const input = document.createElement('input');
				input.type = 'checkbox';
				input.className = 'pdf-form-checkbox';
				input.checked = savedValue === 'checked';
				input.style.width = width + 'px';
				input.style.height = height + 'px';
				input.style.margin = '0';
				input.style.cursor = 'pointer';
				input.addEventListener('change', () => {
					this.fieldValues.set(field.field_name, input.checked ? 'checked' : '');
				});
				wrapper.appendChild(input);
			} else {
				const input = document.createElement('input');
				input.type = 'text';
				input.className = 'pdf-form-input';
				input.value = savedValue;
				input.placeholder = field.field_name || '';
				input.style.width = '100%';
				input.style.height = '100%';
				input.style.boxSizing = 'border-box';
				input.style.border = '1px solid var(--vscode-focusBorder, rgba(0,120,215,0.6))';
				input.style.background = 'rgba(255, 255, 255, 0.85)';
				input.style.color = '#000';
				input.style.fontSize = Math.min(height * 0.7, 14) + 'px';
				input.style.padding = '1px 3px';
				input.style.outline = 'none';
				input.style.borderRadius = '2px';
				input.addEventListener('input', () => {
					this.fieldValues.set(field.field_name, input.value);
				});
				wrapper.appendChild(input);
			}

			overlay.appendChild(wrapper);
		}

		this.renderContainer.appendChild(overlay);
		this.overlay = overlay;
	}

	removeOverlay() {
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = null;
		}
	}

	getValues(): Record<string, string> {
		return Object.fromEntries(this.fieldValues);
	}

	clearValues() {
		this.fieldValues.clear();
	}
}
