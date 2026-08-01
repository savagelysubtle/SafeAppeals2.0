/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import {
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	TextRun,
} from 'docx';

export interface DocxBlock {
	type: 'heading' | 'paragraph' | 'listItem';
	text: string;
	level?: number;
}

export interface DocxCreateContent {
	title?: string;
	blocks?: DocxBlock[];
	/** Plain paragraphs split on blank lines when blocks omitted. */
	body?: string;
}

function headingLevel(level: number | undefined): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
	switch (level) {
		case 1: return HeadingLevel.HEADING_1;
		case 2: return HeadingLevel.HEADING_2;
		case 3: return HeadingLevel.HEADING_3;
		case 4: return HeadingLevel.HEADING_4;
		default: return HeadingLevel.HEADING_1;
	}
}

function blocksFromContent(content: DocxCreateContent): Paragraph[] {
	const paragraphs: Paragraph[] = [];

	if (content.title) {
		paragraphs.push(new Paragraph({
			text: content.title,
			heading: HeadingLevel.TITLE,
		}));
	}

	if (content.blocks && content.blocks.length > 0) {
		for (const block of content.blocks) {
			const text = block.text ?? '';
			if (block.type === 'heading') {
				paragraphs.push(new Paragraph({
					text,
					heading: headingLevel(block.level),
				}));
			} else if (block.type === 'listItem') {
				paragraphs.push(new Paragraph({
					children: [new TextRun(text)],
					bullet: { level: 0 },
				}));
			} else {
				paragraphs.push(new Paragraph({
					children: [new TextRun(text)],
				}));
			}
		}
		return paragraphs;
	}

	const body = content.body ?? '';
	const chunks = body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
	if (chunks.length === 0 && !content.title) {
		paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
		return paragraphs;
	}
	for (const chunk of chunks) {
		for (const line of chunk.split('\n')) {
			paragraphs.push(new Paragraph({
				children: [new TextRun(line)],
			}));
		}
	}
	return paragraphs;
}

/**
 * Build a minimal .docx buffer from structured content (host-side / headless).
 */
export async function createDocxBuffer(content: DocxCreateContent): Promise<Uint8Array> {
	const doc = new Document({
		sections: [{
			children: blocksFromContent(content),
		}],
	});
	const buffer = await Packer.toBuffer(doc);
	return new Uint8Array(buffer);
}
