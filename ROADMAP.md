# Panoptisana - Roadmap

## Project Overview

Open-source Asana task and project visibility tool for macOS. Displays a searchable list of incomplete tasks and active projects with comment tracking and auto-updates.

## Current Version: 0.5.6

### Core Features (v0.1.0)
- [x] Searchable task list with sorting
- [x] Searchable project list
- [x] Comment toggling with new comment highlighting
- [x] Settings: API key management (encrypted at rest)
- [x] Settings: User selection ("I am" + "show only my tasks")
- [x] Settings: Polling interval
- [x] Settings: Exclusion lists (tasks + projects)
- [x] Settings: Theme (dark/light/system) + accent colors
- [x] Settings: Global hotkey (Ctrl+Shift+A)
- [x] Tray-only app (hidden from Dock/Cmd+Tab)
- [x] Auto-update via GitHub releases
- [x] Copy GID / Open Task buttons

### v0.2.0 Additions
- [x] "Only my projects" filter checkbox
- [x] Inclusion filter lists (tasks + projects)
- [x] Right-click context menu (exclude item, copy GID)
- [x] Fix: "Show only my tasks" now filters to direct assignments only
- [x] Fix: `currentUserId` settings read correctly

### v0.2.1 Additions
- [x] Renamed from Panorasana to Panoptisana
- [x] SQLite storage engine (`better-sqlite3`) replacing JSON file store
- [x] Auto-backup on launch + corruption detection/recovery (`PRAGMA quick_check`)
- [x] `sandbox: true` on all BrowserWindows
- [x] API key verify-first with rollback on failure
- [x] IPC settings masking (API key never reaches renderer)
- [x] XSS protection for release notes (`marked` + `DOMPurify`)
- [x] Asana API rate-limit retry (HTTP 429, up to 3 retries)
- [x] Error banner with Retry button
- [x] Global hotkey re-registration via IPC
- [x] Shared `applyTheme` / `useThemeListener` utilities
- [x] Shared `base.css` across all 3 renderers
- [x] Reusable `FilterListEditor` component
- [x] Tray null/destroyed window guards
- [x] Removed legacy AES-256-GCM encryption

### v0.2.2 Additions
- [x] Always on top (all windows)
- [x] Remove macOS "traffic light" window controls (`frame: false`)
- [x] Minimize-to-tray button in main window title bar
- [x] Close button in settings window title bar
- [x] App icon resized to 512x512 (electron-builder requirement)

### v0.2.3 Additions
- [x] Fix: Task list capped at 100 (search endpoint pagination with manual `created_at`-based fallback)
- [x] Settings: Configurable task fetch page limit

### v0.2.4 Additions
- [x] Status bar: filtered vs total count (e.g. "142 of 2052 tasks")
- [x] Polling indicator with pulsing amber dot and "Refreshing..." text
- [x] Spinning refresh button + disabled state during active poll
- [x] Fix: `restartPolling()` preserves `onPollStarted` callback
- [x] Fix: Settings close triggers fresh poll (not stale cached data)

### v0.3.0 Additions
- [x] "Projects" dropdown above task list — filter tasks to a single project (obeys exclusion/inclusion lists, "show only my tasks", and "show tasks for" user lists)
- [x] Status bar count reflects active client-side filters (project dropdown, search, "Only my projects")

### v0.4.0 Additions
- [x] "Complete" button on tasks with double-confirm safety (arm → confirm → complete, 3s auto-reset)
- [x] Comment link parsing — clickable URLs, Asana profile links resolve to `[UserName]`
- [x] "Open Asana links in..." setting — auto-detects installed browsers + Asana desktop app
- [x] Task metadata: project name / section column (second metadata row)
- [x] Task metadata: relative "last modified" timestamp
- [x] Clear search button (X icon) in search bar
- [x] Status bar count decrements immediately on task completion

### v0.5.0 Additions
- [x] Full TypeScript migration — all 29 source files converted to strict TypeScript
- [x] Dual tsconfig: `tsconfig.main.json` (CJS for main process) + `tsconfig.renderer.json` (Vite builds)
- [x] Shared types in `src/shared/types.ts` (domain types, IPC contracts, preload APIs)
- [x] Window augmentation in `src/shared/global.d.ts`
- [x] Strict mode: `noUnusedLocals`, `noUnusedParameters`
- [x] CI gates on typecheck; release script includes typecheck step
- [x] Updated CODING_STANDARDS.md to reflect TypeScript adoption

### v0.5.1 Additions
- [x] Client-side exclusion/inclusion filtering — filters apply instantly in the renderer via `useMemo` instead of waiting for an Asana API re-poll
- [x] `settings:updated` IPC event — main process broadcasts settings changes to renderer for instant filter feedback
- [x] Right-click "Exclude" is now instant (no re-poll needed)
- [x] Settings window close broadcasts updated settings immediately, background re-poll for non-filter changes

### v0.5.2 Additions
- [x] Demo mode via `PANOPTISANA_DEMO=1` env var — fake Asana data for screenshots/video
- [x] `AsanaAPILike` interface — polymorphic API contract for real and demo implementations
- [x] Repo renamed to `panoptisana`, CI badge added to README
- [x] Lint cleanup: 5 `eqeqeq` warnings fixed in `App.tsx`
- [x] Fix: Auto-updater dialog race condition — old dialog's `closed` event nulled the new dialog reference
- [x] Fix: Download progress now shown inline in update dialog (removed separate progress window)

### v0.5.3 Additions
- [x] Fix: Multi-user task count inflated — `unfilteredTaskCount` now computed after deduplication

### v0.5.4 Additions
- [x] Fix: Settings and update dialog windows now open centered over the main window instead of defaulting to the primary display

### v0.5.5 Additions
- [x] Project section GID surfacing — toggle to show section names and copy-GID buttons on each project (mirrors the comment toggle pattern on tasks)
- [x] Project field GID surfacing — tabbed "Sections & Fields" panel on each project, with copy-GID buttons and CSV export for both sections and fields

### v0.5.6 Additions
- [x] Task item UI redesign — GID surfaced below task name, always-visible copy buttons for name/GID/assignee/project/section
- [x] Subtask indicator — "subtask of [Parent Task Name]" shown when task has a parent
- [x] Collapsible project list — primary project always shown, extra projects behind "+N more" toggle
- [x] Per-project section display with copy-GID — format: `project name [copy] / section name [copy]`
- [x] Assignee name clickable to copy profile GID
- [x] Right-side buttons reordered: Complete, Open Task, Copy URL
- [x] `parent` field added to `AsanaTask` type and API opt_fields
- [x] `section.gid` added to task memberships for per-section copy-GID

## Next Immediate

- [x] Fix: Shell injection in `ipc-handlers.ts` — `execSync` with string interpolation replaced by `execFile` with argument array (v0.5.6 code review)
- [x] Fix: Type-unsafe `as any` casts in all 3 preload files — typed against `IpcEventChannelMap` (v0.5.6 code review)
- [ ] Fix: CSV export save dialog appears behind the main window — needs `alwaysOnTop` or parent window handling so the native save dialog is visible
- [ ] Fix: "Only my projects" checkbox missing from the Projects tab — regression, needs immediate resolution
- [ ] Verify: Status bar "out of X" total no longer appears when using "Show tasks for" multi-select — only the filtered count is shown. This may be working as intended, further verification required
- [ ] Fix: Changing "Show tasks for" user selection does not immediately update the task list — may be blocked by an in-progress poll, or the settings broadcast isn't triggering a re-filter/re-poll. Possible solution: clear the task list on user selection change and show a "Display conditions changed, refetching..." message until the re-poll completes. Needs investigation (pre-v1)
- [ ] Comment count — display number of comments on each task in the task list
- [ ] First-pull loading state — show "Loading..." or similar on the main screen after entering an API key for the first time, so the empty list doesn't look broken while the initial poll runs

## Pre-v1: Code Quality / Architecture

### Refactoring
- [ ] Extract auto-updater from `main.ts` into `updater.ts` — auto-updater logic is ~150 lines including all event handlers and 5 IPC handlers
- [ ] Unify polling callback construction — `onUpdate`/`onPollStarted` callbacks are built identically in `main.ts` (startup) and `ipc-handlers.ts` (after key verification). Extract a single factory function
- [ ] Move update IPC handlers (`update-dialog:*`, `app:check-for-updates`, `app:download-update`, `app:restart-for-update`) into the extracted updater module so the full IPC surface is auditable from fewer files
- [ ] Extract `_getCache(key)` private method in `store.ts` — `getCachedTasks`/`getCachedProjects`/`getCachedUsers` are identical (get row, parse JSON, return `[]`)
- [ ] DRY: `visibleProjectCount` in `App.tsx` duplicates the filter logic from `ProjectList.tsx` (membership + search). Extract shared filter function or compute count inside `ProjectList` and lift it via callback
- [ ] Move `ACCENT_COLORS` to a shared constants file
- [ ] Replace `app.isQuitting` monkey-patch on the Electron `app` object with a module-level `let isQuitting` variable
- [ ] Replace `updateDialogWindow._initData` with a module-scoped variable instead of storing data on the BrowserWindow object
- [ ] TypeScript: replace `(err as Error).message` casts with a shared `toErrorMessage()` utility
- [x] TypeScript: remove `as any` casts on preload IPC event handlers — type the `IpcRendererEvent` callbacks against the IPC channel maps for proper type safety at the boundary (v0.5.6 code review)
- [ ] DRY: Extract `useCopyToClipboard` hook — 6 nearly identical copy handlers in `TaskItem.tsx` (~60 lines), same pattern in `ProjectList.tsx`. Extract to shared hook, extract `<CopyButton />` component
- [ ] DRY: Deduplicate export handlers in `ProjectList.tsx` — sections CSV and fields CSV export handlers are nearly identical, extract shared `exportCsvData()` helper
- [ ] Split `components.css` (825 lines) — monolith styles tasks, projects, comments, status bar, error banner. Split into per-component files (`task-item.css`, `project-list.css`, `status-bar.css`). Replace hardcoded `#ffffff` with CSS variable, extract repeated truncation/flex-center patterns into utility classes
- [ ] Split `SettingsApp.tsx` (468 lines) — extract General, Filters, About tabs into separate components
- [ ] Split `demo-data.ts` (399 lines) — separate demo users, projects, and tasks into individual files for readability
- [ ] Fix mutable global `_sectionCounter` in `demo-data.ts` — makes `getDemoTasks()` non-idempotent. Scope inside the function or use deterministic IDs
- [ ] Add `React.memo` to `TaskItem` and `ProjectList` — both rendered in `.map()` loops with object props; list can exceed 2000 items
- [ ] Replace hardcoded colors in `settings.css` (`#ffffff`, `#f5f5f7`, `#1a1a2e`) with CSS variables from `variables.css`
- [ ] TypeScript: tighten `Settings.accentColor` from `string` to `AccentColor` union type
- [ ] TypeScript: tighten `Settings.openLinksIn` from `string` to union type (`'default' | 'asana-desktop' | string`)
- [ ] TypeScript: standardize null/optional patterns in `types.ts` — `AsanaTask` mixes `string | null` and `?: string` for optional fields
- [ ] Replace non-null assertions (`seg.url!`, `store!`) with optional chaining or type narrowing guards

### Security
- [ ] Add CSP headers to all BrowserWindows (production builds)
- [x] Route external URL opens through IPC + `shell.openExternal` instead of `window.open` in renderer (`TaskItem.tsx`, `ProjectList.tsx`)
- [x] ~~Removed `executeJavaScript` string interpolation in download progress window~~ — replaced with IPC-based progress in v0.5.2
- [x] Fix shell injection via `execSync` in `ipc-handlers.ts` — replaced with `execFile` argument array (v0.5.6 code review)
- [ ] Add `noopener,noreferrer` to `window.open()` call in `SettingsApp.tsx` (GitHub link)
- [ ] Fix API key verification race condition — key is stored before verification completes; crash during verification leaves unverified key persisted. Store only on success

### Input Validation
- [ ] Validate hotkey format before registering (reject invalid accelerator strings)
- [ ] Debounce hotkey input in Settings to avoid rapid re-registration on every keystroke
- [ ] Validate URL format in `app:open-url` handler before passing to `shell.openExternal`

### Testing & Documentation
- [x] Unit tests for `applyItemFilters` logic (54 tests in `filters.test.ts` and `formatters.test.ts`)
- [ ] Add JSDoc to shared utilities (applyTheme, useThemeListener)

## Task Detail View (timing TBD — pre or post v1)

- [ ] Slide-out task detail panel — a detail view that slides out from the task list, showing full task information in a more spacious layout
- [ ] Full comment history — list view shows only the latest comment; detail view shows all comments with scrolling
- [ ] Subtask and parent task navigation — display subtasks on the detail view with clickable links, and link back to parent task if the task is a subtask
- [ ] Quick-comment buttons — preset comment templates for common responses (e.g. "Meeting needed to discuss", "Blocked — waiting on dependency", "In progress — will update by EOD") posted directly to the task via the Asana API

## Next Up (Post v1)

- [x] "Open Asana links in..." selector — detect installed browsers and Asana desktop app, let user choose where links open
- [ ] "Sort by last comment" sort option for task list
- [ ] Post a comment to a task from within the app
- [ ] OAuth authentication (PKCE flow with localhost callback) as alternative to PAT — "Connect to Asana" button for easier onboarding
- [x] SQLite storage engine (`better-sqlite3`) — replace JSON file store with SQLite for structured queries, task/comment caching, and offline history. Include auto-backup on launch and corruption detection with automatic recovery from latest backup
- [ ] Comment change detection — track comment count + latest `created_at` timestamp per task instead of `modified_at`. More accurate new-comment highlighting without false positives from non-comment changes. Depends on SQLite migration for comment caching

## Feature Backlog

### High Priority
- [ ] Inbox slide-out drawer — Asana inbox notifications panel that slides in from the window edge via CSS `transform: translateX()`. Main process detects window position relative to screen bounds (`screen.getDisplayMatching`) to determine slide direction (left or right edge). Fixed-position overlay, no separate window
- [ ] Task count badges in tray menu
- [ ] Notification for new comments
- [ ] Keyboard navigation in task list
- [x] Task subtask indicator (v0.5.6 — "subtask of [Parent]"; full subtask listing planned in Task Detail View)

### Medium Priority
- [ ] Custom sort persistence
- [ ] Task grouping (by project, by assignee, by section)
- [ ] Project status display
- [ ] Search history

### Low Priority
- [ ] Multiple workspace support
- [ ] Custom fields display
- [ ] Export task list
- [ ] Window position memory per display

### Code Quality / Hardening (Post v1)
- [ ] Accessibility: add aria labels and keyboard navigation to task/project lists
- [ ] Structured logging (replace bare console.log/warn/error)
- [ ] Error boundary components for each renderer — crash in one component takes down entire window
- [x] Performance: memoize filtered/sorted task and project lists (useMemo) — done in v0.5.1
- [ ] Fix `suppressHighlight` in `TaskItem.tsx` — once set to `true` it never resets; new comments from other users won't trigger highlight until remount
- [ ] Clean up `setInterval` for auto-update checks on app quit
- [ ] Fix `useThemeListener` potential listener leak — unstable API ref could cause listener attach/detach churn
- [ ] Remove unused Vite alias `@shared-styles` from `vite.config.ts`
- [ ] Memoize regex construction in `formatters.ts` `parseCommentSegments` — currently rebuilds on every call
- [ ] Use stable keys in `FilterListEditor.tsx` `.map()` — currently uses array index

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 40 |
| UI | React 19 |
| Build | Vite 7 |
| Packaging | electron-builder |
| Auto-update | electron-updater |
| Storage | SQLite (better-sqlite3) |
| Language | TypeScript (strict mode) |

## Gotchas

- Asana search API has rate limits; polling interval should be >= 1 minute
- Asana search API `assignee` parameter returns collaborator/follower tasks, not just direct assignments — requires client-side post-filtering
- Template images for tray must be black-on-transparent PNG
- `app.dock.hide()` must be called before window creation
- Global hotkey registration can fail silently if another app holds it
- Asana `/tasks/search` endpoint does not support standard `next_page`/`offset` pagination — requires manual `created_at.after` pagination sorted ascending
