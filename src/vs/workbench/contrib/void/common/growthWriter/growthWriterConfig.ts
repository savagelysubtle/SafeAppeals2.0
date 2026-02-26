/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IScheduleConfig, ISiloConfig, Silo } from './growthWriterTypes.js'

// ============================================
// SILO CONFIGURATION
// ============================================

export const SILO_CONFIGS: Record<Silo, ISiloConfig> = {
	lawyers: {
		name: 'lawyers',
		displayName: 'Legal Professionals',
		audience: 'Lawyers, paralegals, and legal advocates',
		contentAngle: 'Case document organization, appeal workflows, legal file management',
		subreddits: ['LawFirm', 'legaladvicecanada', 'lawyers', 'WorkersComp', 'paralegal'],
		monitorKeywords: [
			'organize case files', 'document management law', 'legal paperwork',
			'case file organization', 'legal document management', 'appeal documents',
			'workers comp files', 'legal file management', 'case management software',
		],
	},
	researchers: {
		name: 'researchers',
		displayName: 'Academics & Researchers',
		audience: 'PhD students, postdocs, and academic researchers',
		contentAngle: 'Dissertation organization, research paper management, reference management',
		subreddits: ['PhD', 'AskAcademia', 'GradSchool', 'academia', 'ResearchPapers'],
		monitorKeywords: [
			'organize research papers', 'dissertation files', 'reference manager',
			'research organization', 'academic document management', 'literature review organization',
			'thesis files', 'research workflow', 'paper management',
		],
	},
	students: {
		name: 'students',
		displayName: 'College Students',
		audience: 'Undergraduate and graduate students',
		contentAngle: 'Grade appeals, essay organization, study document management',
		subreddits: ['college', 'GradSchool', 'ApplyingToCollege', 'StudentLoans', 'studytips'],
		monitorKeywords: [
			'organize school files', 'grade appeal', 'essay organization',
			'study notes organization', 'college documents', 'assignment management',
			'student file management', 'school paperwork',
		],
	},
	business: {
		name: 'business',
		displayName: 'Business & Consulting',
		audience: 'Entrepreneurs, consultants, and freelancers',
		contentAngle: 'Client reports, proposals, business document management',
		subreddits: ['Entrepreneur', 'consulting', 'smallbusiness', 'startups', 'freelance'],
		monitorKeywords: [
			'organize client docs', 'proposal management', 'business documents',
			'client file organization', 'project documentation', 'business paperwork',
			'consultant document management', 'report organization',
		],
	},
}

// ============================================
// SCHEDULE CONFIGURATION
// ============================================

export const DEFAULT_SCHEDULE: IScheduleConfig = {
	siloScheduleOfSilo: {
		lawyers: { preferredDay: 'monday', priority: 1, platforms: ['reddit', 'twitter'] },
		researchers: { preferredDay: 'wednesday', priority: 2, platforms: ['reddit', 'twitter'] },
		students: { preferredDay: 'thursday', priority: 3, platforms: ['reddit', 'twitter'] },
		business: { preferredDay: 'friday', priority: 4, platforms: ['twitter', 'linkedin'] },
	},
	allowOverride: true,
	maxBlogsPerWeek: 4,
}

// ============================================
// UTM TRACKING
// ============================================

export const UTM_BASE_URL = 'https://safeappeals.com/blog'

export function buildUtmUrl(slug: string, source: string, medium: string, campaign: string, content?: string): string {
	const url = new URL(`${UTM_BASE_URL}/${slug}`)
	url.searchParams.set('utm_source', source)
	url.searchParams.set('utm_medium', medium)
	url.searchParams.set('utm_campaign', campaign)
	if (content) {
		url.searchParams.set('utm_content', content)
	}
	return url.toString()
}

// ============================================
// BLOG CMS API
// ============================================

export const BLOG_CMS_API_URL = 'https://api.safeappeals.com/blog/posts'

// ============================================
// REDDIT API
// ============================================

export const REDDIT_USER_AGENT = 'electron:com.safeappeals.growthwriter:v1.0.0 (by /u/SafeAppeals)'
export const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
export const REDDIT_API_BASE = 'https://oauth.reddit.com'
export const REDDIT_RATE_LIMIT_QPM = 60
export const REDDIT_COOLDOWN_DAYS = 7

// ============================================
// TWITTER API
// ============================================

export const TWITTER_API_BASE = 'https://api.x.com/2'
export const TWITTER_TOKEN_URL = 'https://api.x.com/2/oauth2/token'
export const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
export const TWITTER_TWEETS_PER_DAY = 5
export const TWITTER_TWEET_CHAR_LIMIT = 280
export const TWITTER_URL_CHAR_COUNT = 23

// ============================================
// LINKEDIN API
// ============================================

export const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest'
export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/native-pkce/authorization'
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
export const LINKEDIN_POST_CHAR_LIMIT = 3000

// ============================================
// CONTENT QUALITY
// ============================================

export const SEMANTIC_SIMILARITY_THRESHOLD = 0.85

export const BANNED_PHRASES = [
	'game-changer', 'revolutionary', 'cutting-edge', 'leverage', 'synergy',
	'deep dive', 'unpack', 'at the end of the day', 'it goes without saying',
	'in this article we will', 'without further ado', 'buckle up',
	'in today\'s fast-paced world', 'in this digital age', 'paradigm shift',
	'thought leader', 'best-in-class', 'move the needle', 'circle back',
	'low-hanging fruit', 'take it to the next level', 'robust solution',
]

// ============================================
// PROMPT TEMPLATES
// ============================================

export const BLOG_SYSTEM_PROMPT = `You are an expert SEO content writer for SafeAppeals, a document organization and AI workspace tool.

Your job is to write compelling, audience-specific blog posts that:
- Demonstrate how SafeAppeals solves real problems for the target audience
- Are grounded in factual product capabilities from the provided RAG context
- Follow SEO best practices: keyword-rich H2/H3 headers, meta description, natural keyword density
- Sound like a knowledgeable professional, NOT a marketing brochure
- Include specific, actionable tips that readers can use immediately

Voice Rules:
- Write in first person plural ("we built", "our users") or second person ("you can", "your files")
- Use concrete examples with realistic scenarios
- Vary sentence length — mix short punchy sentences with longer explanatory ones
- NO banned AI-detection phrases (game-changer, revolutionary, deep dive, unpack, etc.)
- NO filler introductions — start with the problem or a compelling hook`

export const BLOG_USER_PROMPT_TEMPLATE = `Write a blog post for the "{silo}" audience ({audience}).

**Topic**: {title}
**Content Angle**: {content_angle}
**Target Keywords**: {keywords}

**RAG Context (product facts — use these)**:
{rag_context}

**Requirements**:
1. ~2000 words, HTML format
2. Compelling H1 title (include primary keyword)
3. Meta description (~155 chars) as an HTML comment at the top
4. 4-6 H2 sections with descriptive, keyword-rich headings
5. At least 2 specific SafeAppeals features mentioned naturally
6. End with a soft CTA — not "sign up now" but "if you're dealing with X, tools like SafeAppeals can help"
7. Include 1-2 internal links where natural

Output the complete HTML content only, no markdown wrapper.`

export const REDDIT_COMMENT_SYSTEM_PROMPT = `You are a helpful Reddit user who happens to use SafeAppeals for document organization. You are NOT a marketer — you are genuinely trying to help.

Rules:
- Answer the question FIRST with real, practical advice
- Only mention SafeAppeals if it genuinely helps (not every comment needs a plug)
- When you do mention it, be casual: "I've been using SafeAppeals for this" not "Check out SafeAppeals!"
- Match the subreddit's tone — r/LawFirm is professional, r/college is casual
- Never use marketing language or superlatives
- Keep it under 300 words
- If including a blog link, introduce it naturally: "I actually wrote a guide on this: [link]"
- NO banned phrases (game-changer, revolutionary, etc.)`

export const REDDIT_COMMENT_USER_PROMPT_TEMPLATE = `You're commenting on a Reddit post in r/{subreddit}.

**Post Title**: {post_title}
**Post Body**: {post_body}

**Relevant SafeAppeals context** (use only if genuinely helpful):
{rag_context}

**Blog post to optionally link** (only if relevant to the question):
{blog_url}

Write a genuinely helpful comment that answers the user's question. Only mention SafeAppeals or the blog link if it naturally fits the answer.`

export const TWEET_SYSTEM_PROMPT = `You write tweets for SafeAppeals, a document organization and AI workspace tool.

Rules:
- 280 character limit (URLs count as 23 chars)
- Mix content types: tips, feature highlights, blog links, questions
- Sound human and conversational, not corporate
- Use 1-2 relevant hashtags maximum
- No thread of identical-sounding tweets
- Vary between informational, promotional, and engagement tweets
- NO banned marketing phrases`

export const TWEET_USER_PROMPT_TEMPLATE = `Generate a tweet for the "{silo}" silo.

**Blog post** (if promoting): {blog_title} — {blog_url}
**Content type**: {content_type}

**SafeAppeals context**:
{rag_context}

Write a single tweet (280 chars max). If including a URL, remember it counts as 23 characters.`

export const LINKEDIN_SYSTEM_PROMPT = `You write LinkedIn posts for SafeAppeals, targeting business professionals and consultants.

Rules:
- Professional but not stiff — thought leadership tone
- 1000-1500 characters (well under the 3000 limit)
- Start with a hook line that makes people stop scrolling
- Include a personal angle or industry insight
- End with a question or call-to-discussion (drives engagement)
- No hashtag spam — 3 max, placed at the end
- NO banned marketing phrases`

export const LINKEDIN_USER_PROMPT_TEMPLATE = `Write a LinkedIn post for the business/consulting audience.

**Topic**: {title}
**Blog post** (if linking): {blog_url}

**SafeAppeals context**:
{rag_context}

Write a professional LinkedIn post (1000-1500 chars). Focus on the business value and real-world impact.`

// ============================================
// FEW-SHOT EXAMPLES (placeholders — populated from marketing workspace)
// ============================================

export const DEFAULT_FEW_SHOT_EXAMPLES: Record<Silo, { blogExcerpt: string; redditComment: string; tweetThread: string[] }> = {
	lawyers: {
		blogExcerpt: 'When you\'re handling a workers\' comp appeal, the last thing you need is to spend 30 minutes digging through folders to find the right IME report...',
		redditComment: 'I had the same problem organizing case files across multiple appeals. What worked for me was setting up a folder structure by claim number with subfolders for medical, legal correspondence, and evidence. I wrote a full guide on this actually: [link]',
		tweetThread: [
			'Lawyers: how much time do you spend looking for case documents? The average attorney spends 2+ hours/week just searching for files.',
			'Here are 3 quick wins for organizing your case files...',
		],
	},
	researchers: {
		blogExcerpt: 'If your dissertation research folder looks like a digital junk drawer, you\'re not alone. Most PhD students don\'t set up proper file organization until it\'s too late...',
		redditComment: 'I struggled with this during my PhD too. The key is organizing by project/chapter, not by file type. I found a tool that helped me index everything with AI tagging — made literature reviews way faster.',
		tweetThread: [
			'PhD students: your research doesn\'t have to live in chaos.',
			'3 file organization mistakes that cost researchers hours every week...',
		],
	},
	students: {
		blogExcerpt: 'Filing a grade appeal can feel overwhelming, especially when you\'re not sure what evidence to include or how to organize your case...',
		redditComment: 'I went through a grade appeal last semester. The biggest thing that helped was organizing ALL my evidence chronologically — syllabus, assignments, grading rubric, emails with the professor. Having everything in order made the appeal letter basically write itself.',
		tweetThread: [
			'Grade appeal season is coming. Here\'s how to organize your evidence so your appeal actually gets taken seriously.',
			'Step 1: Gather everything — syllabus, assignments, emails, rubrics...',
		],
	},
	business: {
		blogExcerpt: 'When a client asks "where\'s that deliverable from last quarter?" you need to answer in seconds, not minutes. Here\'s how smart consultants organize client files...',
		redditComment: 'I run a small consulting firm and client file organization was killing our productivity. We switched to organizing by client > project > deliverable type and it cut our file search time in half.',
		tweetThread: [
			'Consultants: your client files are a reflection of your professionalism.',
			'If a client asks for last quarter\'s report, can you find it in 30 seconds?',
		],
	},
}
