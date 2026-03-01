---
name: Growth Writer Phase 4
overview: "Implement Reddit integration: a RedditClient in electron-main for OAuth2 script-app auth, subreddit monitoring, commenting, and posting; a RedditMonitorService in the browser for finding opportunities and generating comments; plus warm-up enforcement and credential storage via Electron safeStorage."
todos:
  - id: reddit-client
    content: Create electron-main/growthWriter/redditClient.ts -- Reddit API client with authenticate(), getCombinedNew(), searchSubreddit(), submitComment(), submitPost(), getMe(), batchCheckItems(), checkShadowban(). Auto-re-auth on 401/expiry. Rate limit tracking via response headers. Uses REDDIT_USER_AGENT.
    status: completed
  - id: types-reddit
    content: Add Reddit IPC commands (authenticateReddit, monitorSubreddits, searchSubreddit, postRedditComment, getRedditAccountHealth, storeRedditCredentials, loadRedditCredentials) and IRedditPost/IRedditAccountHealth interfaces to growthWriterTypes.ts
    status: completed
  - id: channel-reddit
    content: "Add Reddit IPC cases to growthWriterChannel.ts: lazy RedditClient instantiation, safeStorage credential encrypt/decrypt (following DocuSign pattern), warm-up check before posting, all Reddit API commands"
    status: completed
  - id: monitor-service
    content: Create browser/growthWriter/redditMonitorService.ts -- IRedditMonitorService with scanForOpportunities(), generateCommentForOpportunity(), approveComment(), postComment(), getAccountHealth(), seedSubredditConfigs(), warm-up enforcement logic
    status: completed
  - id: contribution-import
    content: Add import './growthWriter/redditMonitorService.js' to browser/void.contribution.ts to register singleton
    status: completed
isProject: false
---
