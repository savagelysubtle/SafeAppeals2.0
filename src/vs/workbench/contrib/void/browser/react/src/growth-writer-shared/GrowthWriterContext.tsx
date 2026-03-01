import { createContext, useContext } from 'react'

interface IPCChannel {
	call<T = unknown>(command: string, arg?: unknown): Promise<T>
}

export interface SchedulerState {
	enabled: boolean
	running: boolean
	lastRunAt: string | null
	nextRunAt: string | null
	pendingActions: string[]
}

export interface GrowthWriterContextType {
	channel: IPCChannel
	openView: (viewType: string, viewData?: Record<string, string>) => void
	workspaceId: string
	generateIdeas?: (silo: string, count?: number) => Promise<BlogIdea[]>
	generateBlogForIdea?: (ideaId: string) => Promise<Campaign>
	schedulerState?: SchedulerState
	setSchedulerEnabled?: (enabled: boolean) => void
	runSchedulerNow?: () => Promise<void>
}

export const GrowthWriterContext = createContext<GrowthWriterContextType | null>(null)

export const useGrowthWriter = () => {
	const ctx = useContext(GrowthWriterContext)
	if (!ctx) throw new Error('useGrowthWriter must be used within GrowthWriterContext')
	return ctx
}

export interface BlogIdea {
	id: string
	silo: string
	title: string
	content_angle: string
	status: string
	created_at: string
}

export interface Campaign {
	id: string
	silo: string
	blog_idea_id: string | null
	blog_title: string | null
	blog_slug: string | null
	blog_content: string | null
	blog_cms_id: string | null
	blog_url: string | null
	status: string
	scheduled_for: string | null
	generated_at: string | null
	approved_at: string | null
	published_at: string | null
	error_message: string | null
}

export interface SocialPost {
	id: string
	campaign_id: string
	platform: string
	content: string
	status: string
	external_id: string | null
	posted_at: string | null
	engagement_metrics: string | null
}

export interface RedditOpportunity {
	id: string
	subreddit: string
	post_id: string
	post_title: string
	post_url: string
	relevance_score: number
	generated_comment: string | null
	status: string
	created_at: string
}

export const SILO_LABELS: Record<string, string> = {
	lawyers: 'Lawyers',
	workers_comp: "Workers' Comp",
	researchers: 'Researchers',
	students: 'Students',
	business: 'Business',
}

export const SILO_COLORS: Record<string, string> = {
	lawyers: '#3b82f6',
	workers_comp: '#ef4444',
	researchers: '#8b5cf6',
	students: '#f59e0b',
	business: '#10b981',
}
