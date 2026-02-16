# Panoptisana - Roadmap

## Project Overview

Open-source Asana task and project visibility tool for macOS. Displays a searchable list of incomplete tasks and active projects with comment tracking and auto-updates.

## Current Version: 0.5.4

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

## Next Immediate

- [ ] Fix: "Only my projects" checkbox missing from the Projects tab — regression, needs immediate resolution
- [ ] Create `code_review.md` — document code review standards and process
- [ ] Full code review against `code_review.md` standards — identify issues, improvements, and action items
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
- [ ] TypeScript: remove `as any` casts on preload IPC event handlers — type the `IpcRendererEvent` callbacks against the IPC channel maps for proper type safety at the boundary

### Security
- [ ] Add CSP headers to all BrowserWindows (production builds)
- [x] Route external URL opens through IPC + `shell.openExternal` instead of `window.open` in renderer (`TaskItem.tsx`, `ProjectList.tsx`)
- [x] ~~Removed `executeJavaScript` string interpolation in download progress window~~ — replaced with IPC-based progress in v0.5.2

### Input Validation
- [ ] Validate hotkey format before registering (reject invalid accelerator strings)
- [ ] Debounce hotkey input in Settings to avoid rapid re-registration on every keystroke

### Testing & Documentation
- [x] Unit tests for `applyItemFilters` logic (54 tests in `filters.test.ts` and `formatters.test.ts`)
- [ ] Add JSDoc to shared utilities (applyTheme, useThemeListener)

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
- [ ] Task subtask display

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
- [ ] Error boundary components for each renderer
- [x] Performance: memoize filtered/sorted task and project lists (useMemo) — done in v0.5.1

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
