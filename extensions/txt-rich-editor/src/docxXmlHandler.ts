/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { Logger } from './logger';

export interface DocxDocument {
	xml: string;
	styles?: string;
	numbering?: string;
	relationships?: string;
	images: Map<string, Uint8Array>;
	pageLayout?: DocxPageLayout;
}

export interface DocxPageLayout {
	margins: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
	pageSize: {
		width: number;
		height: number;
	};
	orientation: 'portrait' | 'landscape';
}

export interface DocxStyle {
	id: string;
	name: string;
	type: 'paragraph' | 'character' | 'table';
	properties: Record<string, string>;
}

export class DocxXmlHandler {
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Parse DOCX file into structured document data
	 */
	async parseDocx(buffer: Uint8Array): Promise<DocxDocument> {
		try {
			this.logger.info('Parsing DOCX file...');
			const zip = new JSZip();
			await zip.loadAsync(buffer);

			// Extract main document XML
			const documentXml = await zip.file('word/document.xml')?.async('text') || '';
			const stylesXml = await zip.file('word/styles.xml')?.async('text');
			const numberingXml = await zip.file('word/numbering.xml')?.async('text');
			const relationshipsXml = await zip.file('word/_rels/document.xml.rels')?.async('text');

			// Extract images
			const images = new Map<string, Uint8Array>();
			const imageFiles = Object.keys(zip.files).filter(path =>
				path.startsWith('word/media/') &&
				(path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif'))
			);

			for (const imagePath of imageFiles) {
				const imageData = await zip.file(imagePath)?.async('uint8array');
				if (imageData) {
					const fileName = imagePath.split('/').pop() || '';
					images.set(fileName, imageData);
				}
			}

			// Extract page layout from document XML
			const parser = new DOMParser();
			const doc = parser.parseFromString(documentXml, 'text/xml');
			const pageLayout = this.extractPageLayout(doc);

			this.logger.info(`Parsed DOCX with images and page layout`);

			return {
				xml: documentXml,
				styles: stylesXml,
				numbering: numberingXml,
				relationships: relationshipsXml,
				images,
				pageLayout
			};
		} catch (error) {
			this.logger.error('Failed to parse DOCX:', error);
			throw new Error(`Failed to parse DOCX: ${error}`);
		}
	}

	/**
	 * Convert DOCX XML to HTML
	 */
	docxXmlToHtml(docxDoc: DocxDocument): string {
		try {
			this.logger.info('Converting DOCX XML to HTML...');
			const parser = new DOMParser();
			const doc = parser.parseFromString(docxDoc.xml, 'text/xml');

			// Parse styles if available
			const styles = docxDoc.styles ? this.parseStyles(docxDoc.styles) : new Map<string, DocxStyle>();

			// Convert document body
			const bodyElement = doc.getElementsByTagName('w:body')[0];
			if (!bodyElement) {
				throw new Error('No document body found');
			}

			// Extract page layout information
			const pageLayout = this.extractPageLayout(doc);

			const htmlContent = this.convertElementToHtml(bodyElement, styles);

			this.logger.info('Successfully converted DOCX XML to HTML');
			return htmlContent;
		} catch (error) {
			this.logger.error('Failed to convert DOCX XML to HTML:', error);
			throw new Error(`Failed to convert DOCX XML to HTML: ${error}`);
		}
	}

	/**
	 * Convert HTML to DOCX XML
	 */
	htmlToDocxXml(html: string): string {
		try {
			this.logger.info('Converting HTML to DOCX XML...');
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');

			// Create DOCX document structure
			const docxDoc = this.createDocxDocument();
			const bodyElement = docxDoc.getElementsByTagName('w:body')[0];

			// Convert HTML elements to DOCX XML
			const htmlBody = doc.body;
			if (htmlBody) {
				this.convertHtmlToDocxElements(htmlBody, bodyElement);
			}

			const serializer = new XMLSerializer();
			const xmlString = serializer.serializeToString(docxDoc);

			this.logger.info('Successfully converted HTML to DOCX XML');
			return xmlString;
		} catch (error) {
			this.logger.error('Failed to convert HTML to DOCX XML:', error);
			throw new Error(`Failed to convert HTML to DOCX XML: ${error}`);
		}
	}

	/**
	 * Generate DOCX buffer from XML
	 */
	async generateDocxBuffer(docxXml: string, images: Map<string, Uint8Array> = new Map()): Promise<Uint8Array> {
		try {
			this.logger.info('Generating DOCX buffer...');
			const zip = new JSZip();

			// Add document XML
			zip.file('word/document.xml', docxXml);

			// Add default styles
			const defaultStyles = this.getDefaultStyles();
			zip.file('word/styles.xml', defaultStyles);

			// Add default numbering
			const defaultNumbering = this.getDefaultNumbering();
			zip.file('word/numbering.xml', defaultNumbering);

			// Add relationships
			const relationships = this.getDefaultRelationships();
			zip.file('word/_rels/document.xml.rels', relationships);

			// Add images
			for (const [fileName, imageData] of images) {
				zip.file(`word/media/${fileName}`, imageData);
			}

			// Add content types
			const contentType = this.getContentTypes(images);
			zip.file('[Content_Types].xml', contentType);

			// Add app properties
			const appProps = this.getAppProperties();
			zip.file('docProps/app.xml', appProps);

			// Add core properties
			const coreProps = this.getCoreProperties();
			zip.file('docProps/core.xml', coreProps);

			const buffer = await zip.generateAsync({ type: 'uint8array' });
			this.logger.info('Successfully generated DOCX buffer');
			return buffer;
		} catch (error) {
			this.logger.error('Failed to generate DOCX buffer:', error);
			throw new Error(`Failed to generate DOCX buffer: ${error}`);
		}
	}

	/**
	 * Extract page layout information from DOCX document
	 */
	private extractPageLayout(doc: Document): DocxPageLayout | undefined {
		try {
			// Look for section properties in the document
			const sectPrElements = doc.getElementsByTagName('w:sectPr');
			if (sectPrElements.length === 0) {
				this.logger.info('No section properties found, using defaults');
				return undefined;
			}

			const sectPr = sectPrElements[0];
			const pageLayout: DocxPageLayout = {
				margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // Default 1 inch in twips
				pageSize: { width: 12240, height: 15840 }, // Default Letter size in twips
				orientation: 'portrait'
			};

			// Extract page size
			const pgSz = sectPr.getElementsByTagName('w:pgSz')[0];
			if (pgSz) {
				const width = pgSz.getAttribute('w:w');
				const height = pgSz.getAttribute('w:h');
				const orient = pgSz.getAttribute('w:orient');

				if (width) pageLayout.pageSize.width = parseInt(width);
				if (height) pageLayout.pageSize.height = parseInt(height);
				if (orient === 'landscape') {
					pageLayout.orientation = 'landscape';
					// Swap width and height for landscape
					const temp = pageLayout.pageSize.width;
					pageLayout.pageSize.width = pageLayout.pageSize.height;
					pageLayout.pageSize.height = temp;
				}
			}

			// Extract margins
			const pgMar = sectPr.getElementsByTagName('w:pgMar')[0];
			if (pgMar) {
				const top = pgMar.getAttribute('w:top');
				const right = pgMar.getAttribute('w:right');
				const bottom = pgMar.getAttribute('w:bottom');
				const left = pgMar.getAttribute('w:left');

				if (top) pageLayout.margins.top = parseInt(top);
				if (right) pageLayout.margins.right = parseInt(right);
				if (bottom) pageLayout.margins.bottom = parseInt(bottom);
				if (left) pageLayout.margins.left = parseInt(left);
			}

			this.logger.info(`Extracted page layout: ${JSON.stringify(pageLayout)}`);
			return pageLayout;
		} catch (error) {
			this.logger.error(`Failed to extract page layout: ${error}`);
			return undefined;
		}
	}

	/**
	 * Parse DOCX styles into a map
	 */
	private parseStyles(stylesXml: string): Map<string, DocxStyle> {
		const styles = new Map<string, DocxStyle>();
		const parser = new DOMParser();
		const doc = parser.parseFromString(stylesXml, 'text/xml');

		const styleElements = doc.getElementsByTagName('w:style');
		for (let i = 0; i < styleElements.length; i++) {
			const styleElement = styleElements[i];
			const styleId = styleElement.getAttribute('w:styleId');
			const styleName = styleElement.getElementsByTagName('w:name')[0]?.getAttribute('w:val');
			const styleType = styleElement.getAttribute('w:type');

			if (styleId && styleName) {
				const properties: Record<string, string> = {};

				// Parse style properties
				const pPr = styleElement.getElementsByTagName('w:pPr')[0];
				const rPr = styleElement.getElementsByTagName('w:rPr')[0];

				if (pPr) {
					this.parseStyleProperties(pPr, properties);
				}
				if (rPr) {
					this.parseStyleProperties(rPr, properties);
				}

				styles.set(styleId, {
					id: styleId,
					name: styleName,
					type: styleType as 'paragraph' | 'character' | 'table',
					properties
				});
			}
		}

		return styles;
	}

	/**
	 * Parse style properties from XML element
	 */
	private parseStyleProperties(element: Element, properties: Record<string, string>): void {
		const children = element.children;
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const tagName = child.tagName;
			const val = child.getAttribute('w:val');

			switch (tagName) {
				case 'w:b':
					properties['bold'] = 'true';
					break;
				case 'w:i':
					properties['italic'] = 'true';
					break;
				case 'w:u':
					properties['underline'] = val || 'single';
					break;
				case 'w:sz':
					properties['fontSize'] = val || '24';
					break;
				case 'w:color':
					properties['color'] = val || '000000';
					break;
				case 'w:jc':
					properties['justification'] = val || 'left';
					break;
			}
		}
	}

	/**
	 * Convert DOCX element to HTML
	 */
	private convertElementToHtml(element: Element, _styles: Map<string, DocxStyle>): string {
		let html = '';

		const children = element.children;
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const tagName = child.tagName;

			switch (tagName) {
				case 'w:p':
					html += this.convertParagraphToHtml(child, _styles);
					break;
				case 'w:tbl':
					html += this.convertTableToHtml(child, _styles);
					break;
				case 'w:sectPr':
					// Section properties - skip for now
					break;
			}
		}

		return html;
	}

	/**
	 * Convert DOCX paragraph to HTML
	 */
	private convertParagraphToHtml(paragraph: Element, styles: Map<string, DocxStyle>): string {
		let html = '<p>';

		const runs = paragraph.getElementsByTagName('w:r');
		for (let i = 0; i < runs.length; i++) {
			const run = runs[i];
			html += this.convertRunToHtml(run, styles);
		}

		html += '</p>';
		return html;
	}

	/**
	 * Convert DOCX run to HTML
	 */
	private convertRunToHtml(run: Element, _styles: Map<string, DocxStyle>): string {
		let html = '';
		const textElements = run.getElementsByTagName('w:t');

		for (let i = 0; i < textElements.length; i++) {
			const textElement = textElements[i];
			const text = textElement.textContent || '';

			// Apply formatting based on run properties
			const rPr = run.getElementsByTagName('w:rPr')[0];
			if (rPr) {
				html += this.applyRunFormatting(text, rPr);
			} else {
				html += text;
			}
		}

		return html;
	}

	/**
	 * Apply run formatting to text
	 */
	private applyRunFormatting(text: string, rPr: Element): string {
		let formattedText = text;

		// Check for bold
		if (rPr.getElementsByTagName('w:b').length > 0) {
			formattedText = `<b>${formattedText}</b>`;
		}

		// Check for italic
		if (rPr.getElementsByTagName('w:i').length > 0) {
			formattedText = `<i>${formattedText}</i>`;
		}

		// Check for underline
		if (rPr.getElementsByTagName('w:u').length > 0) {
			formattedText = `<u>${formattedText}</u>`;
		}

		return formattedText;
	}

	/**
	 * Convert DOCX table to HTML
	 */
	private convertTableToHtml(table: Element, styles: Map<string, DocxStyle>): string {
		let html = '<table>';

		const rows = table.getElementsByTagName('w:tr');
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			html += '<tr>';

			const cells = row.getElementsByTagName('w:tc');
			for (let j = 0; j < cells.length; j++) {
				const cell = cells[j];
				html += '<td>';
				html += this.convertElementToHtml(cell, styles);
				html += '</td>';
			}

			html += '</tr>';
		}

		html += '</table>';
		return html;
	}

	/**
	 * Create basic DOCX document structure
	 */
	private createDocxDocument(): Document {
		const parser = new DOMParser();
		const docxTemplate = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
	<w:body>
	</w:body>
</w:document>`;
		return parser.parseFromString(docxTemplate, 'text/xml');
	}

	/**
	 * Convert HTML elements to DOCX XML elements
	 */
	private convertHtmlToDocxElements(htmlElement: Element, docxElement: Element): void {
		const children = htmlElement.children;
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const tagName = child.tagName.toLowerCase();

			switch (tagName) {
				case 'p':
					this.convertHtmlParagraphToDocx(child, docxElement);
					break;
				case 'h1':
				case 'h2':
				case 'h3':
				case 'h4':
				case 'h5':
				case 'h6':
					this.convertHtmlHeadingToDocx(child, docxElement);
					break;
				case 'ul':
				case 'ol':
					this.convertHtmlListToDocx(child, docxElement);
					break;
				case 'table':
					this.convertHtmlTableToDocx(child, docxElement);
					break;
				case 'blockquote':
					this.convertHtmlBlockquoteToDocx(child, docxElement);
					break;
			}
		}
	}

	/**
	 * Convert HTML paragraph to DOCX
	 */
	private convertHtmlParagraphToDocx(htmlP: Element, docxElement: Element): void {
		const pElement = docxElement.ownerDocument.createElement('w:p');
		const pPrElement = docxElement.ownerDocument.createElement('w:pPr');
		pElement.appendChild(pPrElement);

		// Convert inline elements
		this.convertHtmlInlineToDocx(htmlP, pElement);

		docxElement.appendChild(pElement);
	}

	/**
	 * Convert HTML heading to DOCX
	 */
	private convertHtmlHeadingToDocx(htmlHeading: Element, docxElement: Element): void {
		const pElement = docxElement.ownerDocument.createElement('w:p');
		const pPrElement = docxElement.ownerDocument.createElement('w:pPr');

		// Set heading style
		const pStyleElement = docxElement.ownerDocument.createElement('w:pStyle');
		pStyleElement.setAttribute('w:val', `Heading${htmlHeading.tagName[1]}`);
		pPrElement.appendChild(pStyleElement);

		pElement.appendChild(pPrElement);

		// Convert inline elements
		this.convertHtmlInlineToDocx(htmlHeading, pElement);

		docxElement.appendChild(pElement);
	}

	/**
	 * Convert HTML list to DOCX
	 */
	private convertHtmlListToDocx(htmlList: Element, docxElement: Element): void {
		const listItems = htmlList.getElementsByTagName('li');
		for (let i = 0; i < listItems.length; i++) {
			const listItem = listItems[i];
			const pElement = docxElement.ownerDocument.createElement('w:p');
			const pPrElement = docxElement.ownerDocument.createElement('w:pPr');

			// Set list style
			const numPrElement = docxElement.ownerDocument.createElement('w:numPr');
			const ilvlElement = docxElement.ownerDocument.createElement('w:ilvl');
			ilvlElement.setAttribute('w:val', '0');
			const numIdElement = docxElement.ownerDocument.createElement('w:numId');
			numIdElement.setAttribute('w:val', htmlList.tagName === 'ol' ? '1' : '2');

			numPrElement.appendChild(ilvlElement);
			numPrElement.appendChild(numIdElement);
			pPrElement.appendChild(numPrElement);
			pElement.appendChild(pPrElement);

			// Convert inline elements
			this.convertHtmlInlineToDocx(listItem, pElement);

			docxElement.appendChild(pElement);
		}
	}

	/**
	 * Convert HTML table to DOCX
	 */
	private convertHtmlTableToDocx(htmlTable: Element, docxElement: Element): void {
		const tableElement = docxElement.ownerDocument.createElement('w:tbl');

		const rows = htmlTable.getElementsByTagName('tr');
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const trElement = docxElement.ownerDocument.createElement('w:tr');

			const cells = row.getElementsByTagName('td');
			for (let j = 0; j < cells.length; j++) {
				const cell = cells[j];
				const tcElement = docxElement.ownerDocument.createElement('w:tc');

				// Convert cell content
				this.convertHtmlInlineToDocx(cell, tcElement);

				trElement.appendChild(tcElement);
			}

			tableElement.appendChild(trElement);
		}

		docxElement.appendChild(tableElement);
	}

	/**
	 * Convert HTML blockquote to DOCX
	 */
	private convertHtmlBlockquoteToDocx(htmlBlockquote: Element, docxElement: Element): void {
		const pElement = docxElement.ownerDocument.createElement('w:p');
		const pPrElement = docxElement.ownerDocument.createElement('w:pPr');

		// Set blockquote style
		const pStyleElement = docxElement.ownerDocument.createElement('w:pStyle');
		pStyleElement.setAttribute('w:val', 'Blockquote');
		pPrElement.appendChild(pStyleElement);

		pElement.appendChild(pPrElement);

		// Convert inline elements
		this.convertHtmlInlineToDocx(htmlBlockquote, pElement);

		docxElement.appendChild(pElement);
	}

	/**
	 * Convert HTML inline elements to DOCX
	 */
	private convertHtmlInlineToDocx(htmlElement: Element, docxElement: Element): void {
		const textContent = htmlElement.textContent || '';
		if (textContent.trim()) {
			const runElement = docxElement.ownerDocument.createElement('w:r');
			const textElement = docxElement.ownerDocument.createElement('w:t');
			textElement.textContent = textContent;
			runElement.appendChild(textElement);
			docxElement.appendChild(runElement);
		}

		// Handle inline formatting
		const children = htmlElement.children;
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const tagName = child.tagName.toLowerCase();

			if (['b', 'strong', 'i', 'em', 'u', 's', 'strike'].includes(tagName)) {
				const runElement = docxElement.ownerDocument.createElement('w:r');
				const rPrElement = docxElement.ownerDocument.createElement('w:rPr');

				// Apply formatting
				if (['b', 'strong'].includes(tagName)) {
					const boldElement = docxElement.ownerDocument.createElement('w:b');
					rPrElement.appendChild(boldElement);
				}
				if (['i', 'em'].includes(tagName)) {
					const italicElement = docxElement.ownerDocument.createElement('w:i');
					rPrElement.appendChild(italicElement);
				}
				if (tagName === 'u') {
					const underlineElement = docxElement.ownerDocument.createElement('w:u');
					rPrElement.appendChild(underlineElement);
				}
				if (['s', 'strike'].includes(tagName)) {
					const strikeElement = docxElement.ownerDocument.createElement('w:strike');
					rPrElement.appendChild(strikeElement);
				}

				runElement.appendChild(rPrElement);

				const textElement = docxElement.ownerDocument.createElement('w:t');
				textElement.textContent = child.textContent || '';
				runElement.appendChild(textElement);

				docxElement.appendChild(runElement);
			}
		}
	}

	/**
	 * Get default DOCX styles
	 */
	private getDefaultStyles(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
		<w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
		<w:qFormat/>
		<w:pPr>
			<w:spacing w:before="240" w:after="120"/>
		</w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
		<w:qFormat/>
		<w:pPr>
			<w:spacing w:before="200" w:after="100"/>
		</w:pPr>
    <w:rPr>
      <w:b/>
			<w:sz w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
		<w:qFormat/>
		<w:pPr>
			<w:spacing w:before="160" w:after="80"/>
		</w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
	}

	/**
	 * Get default DOCX numbering
	 */
	private getDefaultNumbering(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
	<w:abstractNum w:abstractNumId="1">
		<w:multiLevelType w:val="hybridMultilevel"/>
		<w:lvl w:ilvl="0">
			<w:start w:val="1"/>
			<w:numFmt w:val="decimal"/>
			<w:lvlText w:val="%1."/>
			<w:lvlJc w:val="left"/>
		</w:lvl>
	</w:abstractNum>
	<w:num w:numId="1">
		<w:abstractNumId w:val="1"/>
	</w:num>
	<w:abstractNum w:abstractNumId="2">
		<w:multiLevelType w:val="hybridMultilevel"/>
		<w:lvl w:ilvl="0">
			<w:start w:val="1"/>
			<w:numFmt w:val="bullet"/>
			<w:lvlText w:val="•"/>
			<w:lvlJc w:val="left"/>
		</w:lvl>
	</w:abstractNum>
	<w:num w:numId="2">
		<w:abstractNumId w:val="2"/>
	</w:num>
</w:numbering>`;
	}

	/**
	 * Get default DOCX relationships
	 */
	private getDefaultRelationships(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
	<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;
	}

	/**
	 * Get content types XML
	 */
	private getContentTypes(images: Map<string, Uint8Array>): string {
		let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
	<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
	<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
	<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`;

		// Add image content types
		for (const fileName of images.keys()) {
			const extension = fileName.split('.').pop()?.toLowerCase();
			switch (extension) {
				case 'png':
					contentTypes += `\n\t<Override PartName="/word/media/${fileName}" ContentType="image/png"/>`;
					break;
				case 'jpg':
				case 'jpeg':
					contentTypes += `\n\t<Override PartName="/word/media/${fileName}" ContentType="image/jpeg"/>`;
					break;
				case 'gif':
					contentTypes += `\n\t<Override PartName="/word/media/${fileName}" ContentType="image/gif"/>`;
					break;
			}
		}

		contentTypes += '\n</Types>';
		return contentTypes;
	}

	/**
	 * Get app properties XML
	 */
	private getAppProperties(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
	<Application>VS Code Rich Text Editor</Application>
	<DocSecurity>0</DocSecurity>
	<ScaleCrop>false</ScaleCrop>
	<SharedDoc>false</SharedDoc>
	<HyperlinksChanged>false</HyperlinksChanged>
	<AppVersion>1.0</AppVersion>
</Properties>`;
	}

	/**
	 * Get core properties XML
	 */
	private getCoreProperties(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
	<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Rich Text Document</dc:title>
	<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">VS Code Rich Text Editor</dc:creator>
	<cp:lastModifiedBy>VS Code Rich Text Editor</cp:lastModifiedBy>
	<dcterms:created xmlns:dcterms="http://purl.org/dc/terms/" xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${new Date().toISOString()}</dcterms:created>
	<dcterms:modified xmlns:dcterms="http://purl.org/dc/terms/" xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;
	}
}
