/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';
import { BLOG_CMS_API_URL_DEFAULT } from '../../common/growthWriter/growthWriterConfig.js';

export interface ICMSPublishRequest {
	title: string
	content: string
	slug: string
	excerpt: string | null
	status: 'published'
	tags: string[]
	meta_description: string | null
}

export interface ICMSPublishResult {
	id: string
	slug: string
	url: string
}

export class BlogPublisher {
	constructor(
		private readonly logService: ILogService,
	) {}

	async publish(request: ICMSPublishRequest): Promise<ICMSPublishResult> {
		const apiKey = process.env.BLOG_API_KEY
		if (!apiKey) {
			throw new Error('BLOG_API_KEY environment variable is not set. Cannot publish to CMS.')
		}

		const apiUrl = process.env.BLOG_CMS_API_URL || BLOG_CMS_API_URL_DEFAULT
		this.logService.info(`[BlogPublisher] Publishing blog: "${request.title}" (slug: ${request.slug}) to ${apiUrl}`)

		const body: Record<string, unknown> = {
			title: request.title,
			content: request.content,
			slug: request.slug,
			status: request.status,
			tags: request.tags,
		}

		if (request.excerpt) {
			body.excerpt = request.excerpt
		}
		if (request.meta_description) {
			body.meta_description = request.meta_description
		}

		let response: Response
		try {
			response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey,
				},
				body: JSON.stringify(body),
			})
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			this.logService.error(`[BlogPublisher] Network error: ${msg}`)
			throw new Error(`Blog CMS API unreachable: ${msg}`)
		}

		if (!response.ok) {
			const errorBody = await response.text().catch(() => '(no response body)')
			this.logService.error(`[BlogPublisher] CMS API error ${response.status}: ${errorBody}`)

			if (response.status === 401 || response.status === 403) {
				throw new Error(`Blog CMS authentication failed (${response.status}). Check BLOG_API_KEY.`)
			}
			if (response.status === 409) {
				throw new Error(`Blog slug "${request.slug}" already exists. Choose a different title or slug.`)
			}
			throw new Error(`Blog CMS API error ${response.status}: ${errorBody}`)
		}

		const result = await response.json() as { post: { id: string; slug: string } }
		const publishedUrl = `https://safeappeals.com/blog/${result.post.slug}`

		this.logService.info(`[BlogPublisher] Published successfully: ${publishedUrl} (CMS ID: ${result.post.id})`)

		return {
			id: result.post.id,
			slug: result.post.slug,
			url: publishedUrl,
		}
	}
}
