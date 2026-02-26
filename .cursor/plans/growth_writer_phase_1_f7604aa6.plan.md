---
name: Growth Writer Phase 1
overview: "Implement Phase 1 of the Growth Writer extension: foundation types, config, database schema, IPC channel skeleton, and the blog_writer ChatMode with system prompt integration."
todos:
  - id: types
    content: Create common/growthWriter/growthWriterTypes.ts with all interfaces and type definitions
    status: completed
  - id: config
    content: Create common/growthWriter/growthWriterConfig.ts with silo definitions, schedule, and prompt templates
    status: completed
  - id: db-schema
    content: Create common/growthWriter/growthWriterDatabase.ts with SQLite schema constants
    status: completed
  - id: db-ops
    content: Create electron-main/growthWriter/growthWriterDatabase.ts with SQLite CRUD operations
    status: completed
  - id: ipc-channel
    content: Create electron-main/growthWriter/growthWriterChannel.ts IPC channel skeleton
    status: completed
  - id: chatmode-type
    content: Modify voidSettingsTypes.ts to add blog_writer to ChatMode union
    status: completed
  - id: system-prompt
    content: "Modify systemPrompt.ts: add blog_writer identity override, section exclusion, workflow, and parallel strategy"
    status: completed
  - id: tools-gate
    content: Modify prompts.ts to add blog_writer to tool access and MCP tools gate
    status: completed
  - id: sidebar-ui
    content: Modify SidebarChat.tsx to add blog_writer to mode dropdown
    status: completed
  - id: ipc-register
    content: Modify app.ts to import and register GrowthWriterChannel
    status: completed
isProject: false
---
