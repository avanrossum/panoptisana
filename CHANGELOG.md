# Changelog

All notable changes to Panoptisana will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.10] - 2026-02-19

### Added
- Task detail panel — full-width overlay replacing inline comment toggling, with description, subtasks, all comments, and project memberships
- Subtask and parent task navigation — click subtasks to drill in, "subtask of" link to navigate to parent, back button to return
- Comment composer with @mention support — type `@` to trigger a user dropdown, mentions converted to Asana profile links on submit
- "View" button on task items — opens the detail panel (replaces the old comment toggle)
- Inbox task clicks now open the task detail panel instead of opening Asana in a browser
- "Open in Asana" button on each inbox notification — dedicated external link icon for opening in browser/Asana app
- 3 new API endpoints: `getTaskDetail` (task with notes field), `getSubtasks`, `addComment` (POST story)
- `CommentRenderer` component — extracted from TaskItem for reuse in the detail panel
- `CommentComposer` component — textarea with @mention dropdown and send button
- `replaceMentionsWithLinks()` formatter — converts `@Display Name` to Asana profile URLs before posting
- `buildProjectMemberships()` moved to shared `formatters.ts` for reuse across TaskItem and TaskDetailPanel
- 9 new tests for `replaceMentionsWithLinks()` (single/multiple mentions, case-insensitive, unknown names, edge positions)
- Demo mode: task detail returns lorem ipsum description, 2-3 demo subtasks, fabricated comment on submit
- Membership GID reverse lookup in `parseCommentSegments()` — resolves Asana's workspace membership GIDs in profile URLs to display names via a three-source pipeline (user cache, html_text extraction, reverse membership map)
- 6 new tests for membership GID resolution in comment parsing

### Fixed
- Profile links in comments rendered as `[Profile]` instead of user names — Asana profile URLs in comment `text` use workspace membership GIDs (not user GIDs), which weren't being resolved. Added reverse membership map lookup as a third name resolution source
- Stale closure in `CommentComposer` — `handleKeyDown` callback was missing `handleSubmit` and `selectMention` from its dependency array, causing Ctrl+Enter submit and @mention selection to reference stale state

### Removed
- Inline comment toggle on task items — replaced by the task detail panel
- Comment-related state in TaskItem (`commentsExpanded`, `comments`, `loadingComments`, `suppressHighlight`)
- `.comment-toggle`, `.comment-badge`, `.comments-section` CSS classes
- Dead `currentUserId` and `cachedUsers` props from TaskItem and TaskList — only needed by the removed inline comment toggle

## [0.5.9] - 2026-02-19

### Added
- Inbox notification dot — accent-colored dot on the inbox button indicates new activity since the inbox was last opened, computed during the existing poll cycle with zero additional API calls
- `lastInboxOpenedAt` timestamp persisted in SQLite settings for cross-session dot state
- Demo mode always shows the inbox dot for screenshots/video

## [0.5.8] - 2026-02-19

### Added
- Inbox slide-out drawer — notification panel showing recent activity (comments, assignments, status changes, reactions) from tasks assigned to you, accessible via the inbox button in the title bar or Cmd/Ctrl+I
- Drawer slides in from the window edge — main process detects proximity to screen bounds and slides from the opposite side for optimal visibility
- Per-notification archive with optimistic UI update, plus bulk "Archive All" with double-confirm safety pattern
- 35+ story subtype labels with human-readable mapping (e.g. "Comment", "Assigned", "Moved", "Due Date Changed") and smart fallback for unknown subtypes
- Sticker/reaction emoji display support with resilient API field fallback
- `inbox_archived` SQLite table for persisting archive state across sessions
- Demo mode: 8 realistic inbox notifications with varied subtypes (comment, assignment, project add, due date change, section move, attachment)

### Fixed
- Settings window showed demo mode users after switching to live mode — `DemoAsanaAPI` wrote fake users to SQLite cache, and the live API skipped user fetching when cache was non-empty. Now uses a session-scoped flag to refresh users once per app launch regardless of cache state
- Asana API story fetch could silently fail when requesting extended fields (`sticker_name`, `num_likes`) on certain story types — now falls back to base fields automatically on first failure

## [0.5.7] - 2026-02-19

### Added
- Pinned tasks and projects — pin important items to the top of the list via right-click context menu ("Pin to Top" / "Unpin") or the inline pin button in the actions column
- Pinned state persists across sessions (stored in SQLite settings)
- Pinned items float to the top regardless of sort order while preserving relative sort order within each group (pinned and unpinned)
- Visual treatment: gold/amber left border on pinned items; pin button turns amber when active
- All existing filters (exclusion, inclusion, search, project dropdown) still apply to pinned items — pinning is a sort override, not a filter bypass

### Changed
- Projects tab UI redesign — project items now mirror the task item layout for visual consistency
- Project name row with always-visible copy button
- Project GID row with monospace GID and copy button (replaces the previous "Copy GID" action button)
- Meta row showing project owner name and relative "last modified" timestamp
- Actions column reordered: Pin, Open Project, Copy URL (vertical layout matching task items)

### Fixed
- Stale pinned GIDs — pinned task/project GID arrays are now pruned when items no longer exist in live Asana data (prevents unbounded growth)
- Replace unsafe `as string[]` type assertions with `Array.isArray()` runtime guards in `ipc-handlers.ts`

### Improved
- Extract generic `applyPinnedPartition<T>()` helper — replaces duplicated stable partition logic in task and project sort functions
- Extract `useCopyToClipboard` / `useCopyToClipboardKeyed` hooks — replaces 11 identical copy handlers across `TaskItem.tsx` and `ProjectList.tsx`
- Deduplicate `.project-item-actions` CSS — consolidated with identical `.task-item-actions` class

## [0.5.6] - 2026-02-17

### Changed
- Task item UI redesign — task items now surface more Asana data for sprint management and automation workflows
- Task GID displayed directly below task name with always-visible copy button
- Task name has its own always-visible copy button
- Subtask indicator — tasks that are subtasks now show "subtask of [Parent Task Name]"
- Assignee name is clickable to copy the assignee's profile GID
- All projects a task belongs to are surfaced with format: `project name [copy] / section name [copy]`
- Collapsible project list — primary project always shown; if only one extra, both shown; if 3+, extra projects collapse behind a "+N more" toggle
- Right-side buttons reordered: Complete (top), Open Task, Copy URL
- Copy buttons use always-visible style (0.5 opacity, full opacity on hover) instead of hidden-until-hover

### Added
- `parent` field on `AsanaTask` type — tracks subtask relationships (`parent.gid`, `parent.name`)
- `section.gid` in task memberships — enables copy-GID for individual sections within the task item
- `buildProjectMemberships()` helper — joins task `projects[]` with `memberships[]` to build enriched per-project section data
- Demo data: 2 subtask examples with parent references and multi-project membership

## [0.5.5] - 2026-02-16

### Added
- Project section & field GID surfacing — "Sections & Fields" toggle on each project expands a tabbed panel with copy-GID buttons for both sections and custom fields
- CSV export for sections and fields — "Export CSV" button on each tab saves a CSV file via native save dialog
- Fields tab shows field name, type, and GID; includes hint message about needing at least one task in the project

## [0.5.4] - 2026-02-16

### Fixed
- Settings and update dialog windows open on the primary display instead of near the main window — now center over the main window's current bounds so they appear on the correct monitor

## [0.5.3] - 2026-02-16

### Fixed
- Multi-user task count doubled — `unfilteredTaskCount` summed raw API response sizes before deduplication, inflating "out of X" in the status bar when multiple users were selected in "Show tasks for"

## [0.5.2] - 2026-02-16

### Added
- Demo mode (`PANOPTISANA_DEMO=1`) — launches with realistic fake Asana data for screenshots and video, zero network traffic
- `DemoAsanaAPI` class in `demo-asana-api.ts` — drop-in replacement for `AsanaAPI` with static demo data
- `demo-data.ts` — 25 tasks, 10 projects, 8 users with realistic names, dates, and project colors
- `AsanaAPILike` interface in `types.ts` — shared contract satisfied by both `AsanaAPI` and `DemoAsanaAPI`

### Fixed
- Auto-updater dialog goes empty after clicking "Download Update" — race condition in `showUpdateDialog()` where the old dialog's async `closed` event nulled the new dialog's reference, causing `getInitData()` to return `null`
- Download progress now displays inline in the update dialog instead of a separate 280x70 window that was hidden behind the dialog

### Changed
- `PollCallback` and `PollStartedCallback` types moved from `asana-api.ts` to `types.ts` (shared across both API implementations)
- `ipc-handlers.ts` now types `asanaApi` as `AsanaAPILike` for polymorphic dispatch
- Repo renamed from `asana-list` to `panoptisana` — updated electron-builder config, release script, README
- CI badge added to README
- Fixed 5 `eqeqeq` lint warnings in `App.tsx` (`!=` replaced with `!== null && !== undefined`)
- Removed separate download progress window — replaced with `app:download-progress` IPC event sent to update dialog renderer

## [0.5.1] - 2026-02-15

### Changed
- Exclusion/inclusion filters now apply client-side in the renderer for instant feedback — no more waiting for an Asana API re-poll after filter changes
- Right-click "Exclude" context menu action is now instant — broadcasts updated settings to renderer instead of triggering a full re-poll
- Settings window close broadcasts updated filter settings to renderer immediately, then triggers a background re-poll for non-filter changes (user selection, etc.)
- Unfiltered task/project data is now cached and sent to renderer; `applyItemFilters` runs in `App.tsx` via `useMemo`

### Added
- `settings:updated` IPC event channel — main process broadcasts masked settings to renderer on filter changes
- `onSettingsChanged` listener in preload and `ElectronAPI` interface
- `FilterSettings` state in `App.tsx` for tracking filter-relevant settings independently

### Removed
- Server-side `_applyFilters()` method from `AsanaAPI` class (filtering moved to renderer)

## [0.5.0] - 2026-02-15

### Changed
- Full TypeScript migration — all 29 source files converted from JavaScript to strict TypeScript
- Dual tsconfig architecture: `tsconfig.main.json` (CJS output for main process) + `tsconfig.renderer.json` (type checking only, Vite builds)
- Shared type definitions in `src/shared/types.ts` (Asana domain types, IPC channel contracts, preload API interfaces)
- Window augmentation in `src/shared/global.d.ts` (`window.electronAPI`, `window.settingsAPI`, `window.updateAPI`)
- Strict mode enabled: `noUnusedLocals`, `noUnusedParameters`, `strict: true`
- Build pipeline: three concurrent dev processes (Vite + `tsc --watch` + Electron) coordinated via `wait-on`
- CI workflow gates on `typecheck` step before lint and test
- Release script includes `npm run typecheck` before lint/test

## [0.4.0] - 2026-02-14

### Added
- "Complete" button on each task with double-confirm safety (click once to arm, again to confirm, 3s auto-reset)
- Comment link parsing — URLs in comments are now clickable, Asana profile links resolve to user display names (e.g. `[Lauren Lopez]`)
- "Open Asana links in..." setting — auto-detects installed browsers (Chrome, Safari, Firefox, Arc, Brave, Edge, Opera, Comet) and Asana desktop app; defaults to Asana app when installed
- Task metadata: project name and section/column displayed on each task item (second metadata row)
- Task metadata: relative "last modified" timestamp (e.g. "3m ago", "2h ago", "5d ago")
- Clear search button (X icon) in search bar — appears when text is entered, clears and refocuses on click
- Status bar task count decrements immediately when completing a task (no longer waits for next poll)

### Changed
- "Complete" button styling improved for readability — visible border with green hover state
- Task metadata split into two rows: assignee/due/modified on row 1, project/section on row 2

## [0.3.0] - 2026-02-14

### Added
- "Project" filter dropdown above task list — filter tasks to a single project (populated from projects referenced on tasks, sorted alphabetically)
- Status bar count reflects active filters (project dropdown, search, "Only my projects" checkbox)
- Auto-clear: project filter resets if the selected project disappears from task data after a poll
- Context-aware empty state messages when project filter yields no results

## [0.2.4] - 2026-02-14

### Added
- Status bar shows filtered vs total task/project count (e.g. "142 of 2052 tasks")
- Polling indicator: pulsing amber status dot and "Refreshing..." text during data fetch
- Spinning refresh button animation while polling is in progress
- Refresh button and Retry button disabled during active poll to prevent duplicate requests
- `asana:poll-started` IPC event for poll lifecycle tracking in renderer

### Fixed
- `restartPolling()` now preserves the `onPollStarted` callback (was dropped on poll interval change)
- Settings window close now triggers a fresh poll instead of sending stale cached data

## [0.2.3] - 2026-02-14

### Fixed
- Task list no longer capped at 100 items — Asana search endpoint uses manual `created_at`-based pagination to fetch all incomplete tasks

### Added
- "Task Fetch Limit" setting in General section — configurable page cap (1-100 pages, 100 tasks per page) with warning for high values

## [0.2.2] - 2026-02-14

### Added
- Always-on-top for all windows (main, settings, update dialog)
- Minimize-to-tray button in main window title bar
- Close button in settings window title bar

### Changed
- Removed macOS traffic light window controls (`frame: false` replaces `titleBarStyle: 'hiddenInset'`)
- App icon resized to 512x512 (fixes electron-builder packaging requirement)

## [0.2.1] - 2026-02-14

### Changed
- Renamed app from Panorasana to Panoptisana
- Replaced JSON file store with SQLite (`better-sqlite3`) for improved reliability and corruption resistance
  - Settings stored as key-value rows, cached Asana data as JSON blobs, comment timestamps as individual rows
  - WAL mode enabled for concurrent read performance
  - Auto-backup on launch with `PRAGMA quick_check` corruption detection and automatic recovery

### Removed
- Legacy AES-256-GCM API key encryption (fully migrated to `safeStorage` in v0.2.0)

### Security
- All BrowserWindows now use `sandbox: true`
- API key verification uses verify-first pattern with rollback on failure
- IPC never returns raw API key to renderer (masked as `'••••••••'`)
- XSS protection via `marked` + `DOMPurify` for release notes rendering

### Improved
- Extracted shared `applyTheme` utility and `useThemeListener` hook across all 3 renderers
- Extracted shared `base.css` (reset, body, scrollbar, buttons) imported by all 3 renderers
- Extracted reusable `FilterListEditor` component replacing 4 duplicated filter list blocks
- Asana API rate-limit retry: HTTP 429 → Retry-After header, up to 3 retries
- Error banner with Retry button for connection issues
- Global hotkey re-registration via IPC (no restart needed)
- Tray click handler guards against null/destroyed windows

## [0.2.0] - 2026-02-13

### Added
- "Only my projects" filter checkbox on the Projects tab
- Inclusion filter lists for tasks and projects (show only items matching a pattern)
- Right-click context menu on tasks and projects: "Exclude" and "Copy GID"
- Project membership data fetched from Asana API (`members.gid`)

### Fixed
- "Show only my tasks" now correctly filters to directly-assigned tasks only (Asana search API was returning collaborator/follower tasks)
- `currentUserId` was not being read from settings (typo: `iAmUserId` → `currentUserId`), breaking comment highlight suppression

## [0.1.0] - 2026-02-13

### Added
- Initial release
- Searchable task list with sort by modified, due date, name, assignee, created
- Searchable project list with color dots
- Task comment toggling with new-comment highlighting
- Settings window with API key management (AES-256-GCM encrypted at rest)
- User selection: "I am" dropdown, "show only my tasks" checkbox, multi-user selection
- Configurable polling interval (1-60 minutes)
- Exclusion lists for tasks and projects (GID or name pattern)
- Theme support: dark, light, system (7 accent colors)
- Global hotkey: Ctrl+Shift+A to show/hide
- System tray icon with context menu
- Hidden from Dock and Cmd+Tab
- Auto-update via GitHub releases
- Copy GID and Open Task/Project buttons on each item
- Single-instance enforcement
