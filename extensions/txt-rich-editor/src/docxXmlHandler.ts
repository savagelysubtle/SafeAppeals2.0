/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import JSZip from 'jszip';

/**
 * DOCX XML Handler - Bidirectional converter between DOCX XML and HTML
 * Handles the full DOCX structure including formatting, styles, and document structure
 */

export interface DocxDocument {
	xml: string; // The word/document.xml content
	styles?: string; // The word/styles.xml content
	numbering?: string; // The word/numbering.xml content
	relationships?: string; // The word/_rels/document.xml.rels
	contentTypes?: string; // The [Content_Types].xml
}

export class DocxXmlHandler {
	/**
	 * Parse DOCX file buffer and extract XML components
	 */
	public async parseDocxBuffer(buffer: Uint8Array): Promise<DocxDocument> {
		try {
			console.log('Loading DOCX buffer, size:', buffer.length);
			const zip = new JSZip();
			const loadedZip = await zip.loadAsync(buffer);
			console.log('DOCX ZIP loaded successfully');

			const docxDoc: DocxDocument = {
				xml: '',
			};

			// Extract main document XML
			const documentXml = loadedZip.file('word/document.xml');
			if (documentXml) {
				docxDoc.xml = await documentXml.async('text');
				console.log('Extracted document.xml, length:', docxDoc.xml.length);
			} else {
				console.error('word/document.xml not found in DOCX');
				throw new Error('Invalid DOCX file: missing document.xml');
			}

			// Extract styles
			const stylesXml = loadedZip.file('word/styles.xml');
			if (stylesXml) {
				docxDoc.styles = await stylesXml.async('text');
				console.log('Extracted styles.xml, length:', docxDoc.styles.length);
			}

			// Extract numbering (for lists)
			const numberingXml = loadedZip.file('word/numbering.xml');
			if (numberingXml) {
				docxDoc.numbering = await numberingXml.async('text');
				console.log('Extracted numbering.xml, length:', docxDoc.numbering.length);
			}

			// Extract relationships
			const relsXml = loadedZip.file('word/_rels/document.xml.rels');
			if (relsXml) {
				docxDoc.relationships = await relsXml.async('text');
				console.log('Extracted document.xml.rels, length:', docxDoc.relationships.length);
			}

			// Extract content types
			const contentTypesXml = loadedZip.file('[Content_Types].xml');
			if (contentTypesXml) {
				docxDoc.contentTypes = await contentTypesXml.async('text');
				console.log('Extracted [Content_Types].xml, length:', docxDoc.contentTypes.length);
			}

			console.log('DOCX parsing completed successfully');
			return docxDoc;
		} catch (error) {
			console.error('Error parsing DOCX buffer:', error);
			throw error;
		}
	}

	/**
	 * Convert DOCX XML to HTML for editing
	 */
	public docxXmlToHtml(docxDoc: DocxDocument): string {
		try {
			console.log('Starting DOCX XML to HTML conversion...');
			console.log('XML preview:', docxDoc.xml.substring(0, 200) + '...');

			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(docxDoc.xml, 'text/xml');

			// Check for parsing errors
			const parserError = xmlDoc.getElementsByTagName('parsererror');
			if (parserError.length > 0) {
				console.error('XML parsing error:', parserError[0].textContent);
				throw new Error('Failed to parse DOCX XML');
			}

			// Get the body element using multiple methods
			let body: Element | null = null;

			// Try different ways to find the body element
			body = xmlDoc.getElementsByTagName('w:body')[0] as Element;
			if (!body) {
				body = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'body')[0] as Element;
			}
			if (!body) {
				// Search all elements for body
				const allElements = xmlDoc.getElementsByTagName('*');
				for (let i = 0; i < allElements.length; i++) {
					const elem = allElements[i];
					if (elem.localName === 'body' || elem.tagName === 'w:body') {
						body = elem as Element;
						break;
					}
				}
			}

			if (!body) {
				console.warn('No body element found in DOCX');
				return '<p>Empty document</p>';
			}

			console.log('Found body element:', body.tagName);

			const htmlParts: string[] = [];

			// Process each paragraph and other elements
			const children = Array.from(body.children);
			console.log('Body children count:', children.length);

			for (const child of children) {
				const localName = child.localName || child.tagName.split(':').pop();
				console.log('Processing element:', child.tagName, 'localName:', localName);

				if (localName === 'p') {
					// Process paragraph
					const html = this.processParagraph(child as Element);
					console.log('Paragraph HTML:', html.substring(0, 100) + '...');
					htmlParts.push(html);
				} else if (localName === 'tbl') {
					// Process table
					const html = this.processTable(child as Element);
					console.log('Table HTML:', html.substring(0, 100) + '...');
					htmlParts.push(html);
				} else if (localName === 'sectPr') {
					// Section properties - skip
					continue;
				} else {
					console.log('Unhandled element:', child.tagName);
				}
			}

			const result = htmlParts.join('\n');
			console.log('DOCX XML converted to HTML, length:', result.length);
			return result;
		} catch (error) {
			console.error('Error converting DOCX XML to HTML:', error);
			throw error;
		}
	}

	/**
	 * Process a paragraph element
	 */
	private processParagraph(pElem: Element): string {
		// Get runs using namespace-aware methods
		const runs = this.getChildrenByLocalName(pElem, 'r');
		const paragraphProps = this.getChildByLocalName(pElem, 'pPr');

		// Check for heading level
		let headingLevel = 0;
		let alignment = '';
		let isList = false;
		// let listType = 'bullet'; // Reserved for future use

		if (paragraphProps) {
			// Check for heading style
			const pStyle = this.getChildByLocalName(paragraphProps, 'pStyle');
			if (pStyle) {
				const styleVal = pStyle.getAttribute('w:val') || pStyle.getAttributeNS('*', 'val');
				if (styleVal?.match(/^Heading(\d)$/)) {
					headingLevel = parseInt(RegExp.$1);
				}
			}

			// Check for alignment
			const jc = this.getChildByLocalName(paragraphProps, 'jc');
			if (jc) {
				const alignVal = jc.getAttribute('w:val') || jc.getAttributeNS('*', 'val');
				if (alignVal === 'center') alignment = 'center';
				else if (alignVal === 'right') alignment = 'right';
				else if (alignVal === 'both') alignment = 'justify';
			}

			// Check for numbering (lists)
			const numPr = this.getChildByLocalName(paragraphProps, 'numPr');
			if (numPr) {
				isList = true;
			}
		}

		// Process text runs
		let textContent = '';
		for (const run of runs) {
			textContent += this.processRun(run);
		}

		// If empty paragraph, add br
		if (textContent.trim() === '') {
			textContent = '&nbsp;';
		}

		// Build HTML
		let html = '';
		const style = alignment ? ` style="text-align: ${alignment}"` : '';

		if (isList) {
			html = `<li${style}>${textContent}</li>`;
		} else if (headingLevel > 0) {
			html = `<h${headingLevel}${style}>${textContent}</h${headingLevel}>`;
		} else {
			html = `<p${style}>${textContent}</p>`;
		}

		return html;
	}

	/**
	 * Helper to get children by local name (namespace-agnostic)
	 */
	private getChildrenByLocalName(elem: Element, localName: string): Element[] {
		const result: Element[] = [];

		// Try different methods to find elements
		// Method 1: Direct tag name search
		const directElements = elem.getElementsByTagName(localName);
		for (let i = 0; i < directElements.length; i++) {
			if (directElements[i].parentElement === elem) {
				result.push(directElements[i] as Element);
			}
		}

		// Method 2: Namespace-aware search
		const nsElements = elem.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', localName);
		for (let i = 0; i < nsElements.length; i++) {
			if (nsElements[i].parentElement === elem && !result.includes(nsElements[i] as Element)) {
				result.push(nsElements[i] as Element);
			}
		}

		// Method 3: Manual traversal (fallback)
		if (result.length === 0) {
			for (let i = 0; i < elem.children.length; i++) {
				const child = elem.children[i];
				const childLocalName = child.localName || child.tagName.split(':').pop();
				if (childLocalName === localName) {
					result.push(child as Element);
				}
			}
		}

		return result;
	}

	/**
	 * Helper to get first child by local name (namespace-agnostic)
	 */
	private getChildByLocalName(elem: Element, localName: string): Element | undefined {
		// Try different methods to find element
		// Method 1: Direct tag name search
		const directElement = elem.getElementsByTagName(localName)[0];
		if (directElement && directElement.parentElement === elem) {
			return directElement as Element;
		}

		// Method 2: Namespace-aware search
		const nsElement = elem.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', localName)[0];
		if (nsElement && nsElement.parentElement === elem) {
			return nsElement as Element;
		}

		// Method 3: Manual traversal (fallback)
		for (let i = 0; i < elem.children.length; i++) {
			const child = elem.children[i];
			const childLocalName = child.localName || child.tagName.split(':').pop();
			if (childLocalName === localName) {
				return child as Element;
			}
		}

		return undefined;
	}

	/**
	 * Process a run (text with formatting)
	 */
	private processRun(runElem: Element): string {
		// Get text elements using namespace-aware method
		const textElems = this.getChildrenByLocalName(runElem, 't');
		if (textElems.length === 0) {
			// Check for breaks or tabs
			const br = this.getChildByLocalName(runElem, 'br');
			if (br) return '<br>';
			const tab = this.getChildByLocalName(runElem, 'tab');
			if (tab) return '&nbsp;&nbsp;&nbsp;&nbsp;';
			return '';
		}

		let text = '';
		for (const textElem of textElems) {
			text += textElem.textContent || '';
		}

		// Check for formatting
		const runProps = this.getChildByLocalName(runElem, 'rPr');
		let isBold = false;
		let isItalic = false;
		let isUnderline = false;
		let isStrikethrough = false;
		let isHighlight = false;

		if (runProps) {
			isBold = this.getChildByLocalName(runProps, 'b') !== undefined;
			isItalic = this.getChildByLocalName(runProps, 'i') !== undefined;
			isUnderline = this.getChildByLocalName(runProps, 'u') !== undefined;
			isStrikethrough = this.getChildByLocalName(runProps, 'strike') !== undefined;
			isHighlight = this.getChildByLocalName(runProps, 'highlight') !== undefined;
		}

		// Escape XML/HTML
		text = this.escapeXml(text);

		// Apply formatting
		if (isHighlight) text = `<mark>${text}</mark>`;
		if (isBold) text = `<b>${text}</b>`;
		if (isItalic) text = `<i>${text}</i>`;
		if (isUnderline) text = `<u>${text}</u>`;
		if (isStrikethrough) text = `<s>${text}</s>`;

		return text;
	}

	/**
	 * Process a table element
	 */
	private processTable(tblElem: Element): string {
		console.log('Processing table element:', tblElem.tagName);

		const rows = this.getChildrenByLocalName(tblElem, 'tr');
		console.log('Found rows:', rows.length);

		if (rows.length === 0) {
			console.warn('No rows found in table');
			return '<p>Empty table</p>';
		}

		let html = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 1em 0;">';

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			console.log(`Processing row ${i}:`, row.tagName);
			html += '<tr>';

			const cells = this.getChildrenByLocalName(row, 'tc');
			console.log(`Row ${i} has ${cells.length} cells`);

			for (let j = 0; j < cells.length; j++) {
				const cellElem = cells[j];
				console.log(`Processing cell ${j}:`, cellElem.tagName);

				const paragraphs = this.getChildrenByLocalName(cellElem, 'p');
				let cellContent = '';

				if (paragraphs.length === 0) {
					// Check for direct text content
					cellContent = cellElem.textContent || '';
					if (cellContent.trim()) {
						cellContent = `<p>${this.escapeXml(cellContent)}</p>`;
					} else {
						cellContent = '<p>&nbsp;</p>';
					}
				} else {
					for (const para of paragraphs) {
						cellContent += this.processParagraph(para);
					}
				}

				html += `<td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">${cellContent}</td>`;
			}

			html += '</tr>';
		}

		html += '</table>';
		console.log('Generated table HTML:', html.substring(0, 200) + '...');
		return html;
	}

	/**
	 * Convert HTML back to DOCX XML
	 */
	public htmlToDocxXml(html: string, baseDoc?: DocxDocument): DocxDocument {
		const parser = new DOMParser();
		const htmlDoc = parser.parseFromString(html, 'text/html');

		// Build DOCX XML structure
		let documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
		documentXml += '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n';
		documentXml += '  <w:body>\n';

		// Process HTML elements
		const bodyChildren = Array.from(htmlDoc.body.children);
		for (const child of bodyChildren) {
			documentXml += this.htmlElementToDocxXml(child as Element, '    ');
		}

		documentXml += '  </w:body>\n';
		documentXml += '</w:document>';

		return {
			xml: documentXml,
			styles: baseDoc?.styles || this.getDefaultStyles(),
			numbering: baseDoc?.numbering,
			relationships: baseDoc?.relationships || this.getDefaultRelationships(),
			contentTypes: baseDoc?.contentTypes || this.getDefaultContentTypes(),
		};
	}

	/**
	 * Convert HTML element to DOCX XML
	 */
	private htmlElementToDocxXml(elem: Element, indent: string): string {
		const tagName = elem.tagName.toLowerCase();
		let xml = '';

		switch (tagName) {
			case 'p':
				xml = this.htmlParagraphToDocxXml(elem, indent);
				break;
			case 'h1':
			case 'h2':
			case 'h3':
			case 'h4':
			case 'h5':
			case 'h6':
				xml = this.htmlHeadingToDocxXml(elem, indent);
				break;
			case 'ul':
			case 'ol':
				xml = this.htmlListToDocxXml(elem, indent);
				break;
			case 'table':
				xml = this.htmlTableToDocxXml(elem, indent);
				break;
			case 'br':
				// Skip br tags as they're handled in paragraph processing
				break;
			default:
				// For unknown elements, try to process children
				const children = Array.from(elem.children);
				for (const child of children) {
					xml += this.htmlElementToDocxXml(child as Element, indent);
				}
				break;
		}

		return xml;
	}

	/**
	 * Convert HTML paragraph to DOCX XML
	 */
	private htmlParagraphToDocxXml(elem: Element, indent: string): string {
		const alignment = (elem as HTMLElement).style?.textAlign || '';
		let xml = `${indent}<w:p>\n`;

		// Add paragraph properties if needed
		if (alignment && alignment !== 'left') {
			xml += `${indent}  <w:pPr>\n`;
			xml += `${indent}    <w:jc w:val="${this.htmlAlignmentToDocx(alignment)}"/>\n`;
			xml += `${indent}  </w:pPr>\n`;
		}

		// Process text content with formatting
		xml += this.htmlTextToDocxRuns(elem, indent + '  ');

		xml += `${indent}</w:p>\n`;
		return xml;
	}

	/**
	 * Convert HTML heading to DOCX XML
	 */
	private htmlHeadingToDocxXml(elem: Element, indent: string): string {
		const level = elem.tagName[1]; // Get number from h1, h2, etc.
		let xml = `${indent}<w:p>\n`;
		xml += `${indent}  <w:pPr>\n`;
		xml += `${indent}    <w:pStyle w:val="Heading${level}"/>\n`;
		xml += `${indent}  </w:pPr>\n`;
		xml += this.htmlTextToDocxRuns(elem, indent + '  ');
		xml += `${indent}</w:p>\n`;
		return xml;
	}

	/**
	 * Convert HTML list to DOCX XML
	 */
	private htmlListToDocxXml(elem: Element, indent: string): string {
		const listItems = elem.getElementsByTagName('li');
		let xml = '';

		for (let i = 0; i < listItems.length; i++) {
			xml += `${indent}<w:p>\n`;
			xml += `${indent}  <w:pPr>\n`;
			xml += `${indent}    <w:numPr>\n`;
			xml += `${indent}      <w:ilvl w:val="0"/>\n`;
			xml += `${indent}      <w:numId w:val="1"/>\n`;
			xml += `${indent}    </w:numPr>\n`;
			xml += `${indent}  </w:pPr>\n`;
			xml += this.htmlTextToDocxRuns(listItems[i] as Element, indent + '  ');
			xml += `${indent}</w:p>\n`;
		}

		return xml;
	}

	/**
	 * Convert HTML table to DOCX XML
	 */
	private htmlTableToDocxXml(elem: Element, indent: string): string {
		let xml = `${indent}<w:tbl>\n`;
		const rows = elem.getElementsByTagName('tr');

		for (let i = 0; i < rows.length; i++) {
			xml += `${indent}  <w:tr>\n`;
			const cells = (rows[i] as Element).getElementsByTagName('td');

			for (let j = 0; j < cells.length; j++) {
				xml += `${indent}    <w:tc>\n`;
				xml += `${indent}      <w:tcPr><w:tcBorders/></w:tcPr>\n`;

				// Process cell content
				const cellChildren = Array.from((cells[j] as Element).children);
				for (const child of cellChildren) {
					xml += this.htmlElementToDocxXml(child as Element, indent + '      ');
				}

				xml += `${indent}    </w:tc>\n`;
			}

			xml += `${indent}  </w:tr>\n`;
		}

		xml += `${indent}</w:tbl>\n`;
		return xml;
	}

	/**
	 * Convert HTML text content to DOCX runs
	 */
	private htmlTextToDocxRuns(elem: Element, indent: string): string {
		let xml = '';
		const processNode = (node: Node): string => {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent || '';
				if (text.trim() === '') return '';

				return `${indent}<w:r>\n${indent}  <w:t xml:space="preserve">${this.escapeXml(text)}</w:t>\n${indent}</w:r>\n`;
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				const tagName = el.tagName.toLowerCase();

				let runXml = `${indent}<w:r>\n`;
				const hasFormatting = ['b', 'i', 'u', 's', 'strong', 'em'].includes(tagName);

				if (hasFormatting) {
					runXml += `${indent}  <w:rPr>\n`;
					if (tagName === 'b' || tagName === 'strong') runXml += `${indent}    <w:b/>\n`;
					if (tagName === 'i' || tagName === 'em') runXml += `${indent}    <w:i/>\n`;
					if (tagName === 'u') runXml += `${indent}    <w:u w:val="single"/>\n`;
					if (tagName === 's') runXml += `${indent}    <w:strike/>\n`;
					runXml += `${indent}  </w:rPr>\n`;
				}

				const text = el.textContent || '';
				if (text.trim()) {
					runXml += `${indent}  <w:t xml:space="preserve">${this.escapeXml(text)}</w:t>\n`;
				}
				runXml += `${indent}</w:r>\n`;

				return runXml;
			}

			return '';
		};

		// Process child nodes
		const children = Array.from(elem.childNodes);
		for (const child of children) {
			xml += processNode(child);
		}

		// If no runs were generated, add an empty one
		if (xml === '') {
			xml = `${indent}<w:r>\n${indent}  <w:t xml:space="preserve"> </w:t>\n${indent}</w:r>\n`;
		}

		return xml;
	}

	/**
	 * Convert HTML alignment to DOCX alignment
	 */
	private htmlAlignmentToDocx(alignment: string): string {
		switch (alignment) {
			case 'center': return 'center';
			case 'right': return 'right';
			case 'justify': return 'both';
			default: return 'left';
		}
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Get default styles.xml
	 */
	private getDefaultStyles(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
	}

	/**
	 * Get default relationships
	 */
	private getDefaultRelationships(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
	}

	/**
	 * Get default content types
	 */
	private getDefaultContentTypes(): string {
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
	}

	/**
	 * Generate a complete DOCX buffer from DocxDocument
	 */
	public async generateDocxBuffer(docxDoc: DocxDocument): Promise<Uint8Array> {
		const zip = new JSZip();

		// Add main document
		zip.file('word/document.xml', docxDoc.xml);

		// Add styles
		if (docxDoc.styles) {
			zip.file('word/styles.xml', docxDoc.styles);
		}

		// Add numbering
		if (docxDoc.numbering) {
			zip.file('word/numbering.xml', docxDoc.numbering);
		}

		// Add relationships
		zip.file('word/_rels/document.xml.rels', docxDoc.relationships || this.getDefaultRelationships());

		// Add content types
		zip.file('[Content_Types].xml', docxDoc.contentTypes || this.getDefaultContentTypes());

		// Add _rels/.rels (root relationships)
		zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

		// Generate ZIP
		const buffer = await zip.generateAsync({ type: 'uint8array' });
		return buffer;
	}
}

