/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const GROWTH_DB_NAME = 'growth_writer.db'

export const CREATE_BLOG_IDEAS_TABLE = `
CREATE TABLE IF NOT EXISTS growth_blog_ideas (
    id TEXT PRIMARY KEY,
    silo TEXT NOT NULL CHECK (silo IN ('lawyers', 'researchers', 'students', 'business')),
    title TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    content_angle TEXT,
    source TEXT NOT NULL DEFAULT 'ai',
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    embedding_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    used_at TEXT
);
`

export const CREATE_BLOG_IDEAS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_ideas_silo_status ON growth_blog_ideas(silo, status);
`

export const CREATE_CAMPAIGNS_TABLE = `
CREATE TABLE IF NOT EXISTS growth_campaigns (
    id TEXT PRIMARY KEY,
    silo TEXT NOT NULL CHECK (silo IN ('lawyers', 'researchers', 'students', 'business')),
    blog_idea_id TEXT REFERENCES growth_blog_ideas(id),
    blog_title TEXT,
    blog_slug TEXT,
    blog_content TEXT,
    blog_cms_id TEXT,
    blog_url TEXT,
    status TEXT NOT NULL DEFAULT 'generating',
    scheduled_for TEXT,
    generated_at TEXT,
    approved_at TEXT,
    published_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

export const CREATE_CAMPAIGNS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON growth_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_silo ON growth_campaigns(silo, scheduled_for);
`

export const CREATE_SOCIAL_POSTS_TABLE = `
CREATE TABLE IF NOT EXISTS growth_social_posts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES growth_campaigns(id),
    platform TEXT NOT NULL CHECK (platform IN ('reddit', 'twitter', 'linkedin')),
    channel TEXT,
    post_type TEXT,
    title TEXT,
    body TEXT NOT NULL,
    content_hash TEXT,
    utm_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_for TEXT,
    posted_at TEXT,
    post_url TEXT,
    reddit_parent_id TEXT,
    error_message TEXT,
    metrics TEXT,
    metrics_updated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

export const CREATE_SOCIAL_POSTS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_social_campaign ON growth_social_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_social_status ON growth_social_posts(status, platform);
CREATE INDEX IF NOT EXISTS idx_social_hash ON growth_social_posts(content_hash);
`

export const CREATE_SUBREDDIT_CONFIG_TABLE = `
CREATE TABLE IF NOT EXISTS growth_subreddit_config (
    id TEXT PRIMARY KEY,
    silo TEXT NOT NULL CHECK (silo IN ('lawyers', 'researchers', 'students', 'business')),
    subreddit_name TEXT NOT NULL,
    display_name TEXT,
    rules_summary TEXT,
    monitor_keywords TEXT,
    cooldown_days INTEGER NOT NULL DEFAULT 7,
    last_posted_at TEXT,
    last_commented_at TEXT,
    total_posts INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(silo, subreddit_name)
);
`

export const CREATE_SUBREDDIT_CONFIG_INDEX = `
CREATE INDEX IF NOT EXISTS idx_subreddit_silo ON growth_subreddit_config(silo, is_active);
`

export const CREATE_REDDIT_OPPORTUNITIES_TABLE = `
CREATE TABLE IF NOT EXISTS growth_reddit_opportunities (
    id TEXT PRIMARY KEY,
    subreddit TEXT NOT NULL,
    silo TEXT NOT NULL,
    reddit_post_id TEXT NOT NULL UNIQUE,
    reddit_post_title TEXT NOT NULL,
    reddit_post_url TEXT NOT NULL,
    reddit_post_body TEXT,
    matched_keywords TEXT,
    relevance_score REAL,
    status TEXT NOT NULL DEFAULT 'found',
    comment_body TEXT,
    social_post_id TEXT REFERENCES growth_social_posts(id),
    found_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT
);
`

export const CREATE_REDDIT_OPPORTUNITIES_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON growth_reddit_opportunities(status, silo);
CREATE INDEX IF NOT EXISTS idx_opportunities_reddit ON growth_reddit_opportunities(reddit_post_id);
`

export const CREATE_PLATFORM_AUTH_TABLE = `
CREATE TABLE IF NOT EXISTS growth_platform_auth (
    platform TEXT PRIMARY KEY CHECK (platform IN ('reddit', 'twitter', 'linkedin')),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    expires_at TEXT,
    account_name TEXT,
    account_karma INTEGER,
    warmup_started_at TEXT,
    warmup_complete INTEGER DEFAULT 0,
    removal_count INTEGER DEFAULT 0,
    last_removal_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);
`

export const ALL_CREATE_STATEMENTS = [
	CREATE_BLOG_IDEAS_TABLE,
	CREATE_BLOG_IDEAS_INDEX,
	CREATE_CAMPAIGNS_TABLE,
	CREATE_CAMPAIGNS_INDEXES,
	CREATE_SOCIAL_POSTS_TABLE,
	CREATE_SOCIAL_POSTS_INDEXES,
	CREATE_SUBREDDIT_CONFIG_TABLE,
	CREATE_SUBREDDIT_CONFIG_INDEX,
	CREATE_REDDIT_OPPORTUNITIES_TABLE,
	CREATE_REDDIT_OPPORTUNITIES_INDEXES,
	CREATE_PLATFORM_AUTH_TABLE,
]
