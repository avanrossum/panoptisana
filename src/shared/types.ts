// ══════════════════════════════════════════════════════════════════════════════
// SHARED TYPE DEFINITIONS
// Single source of truth for all types that cross the IPC boundary.
// Imported by both main process (via tsc → CJS) and renderer (via Vite → ESM).
// ══════════════════════════════════════════════════════════════════════════════


// ── String Literal Unions ──────────────────────────────────────────────────

export type ThemeSetting = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';
export type AccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'amber' | 'green';
export type SortBy = 'modified' | 'due' | 'name' | 'assignee' | 'created';
export type ItemFilterType = 'task' | 'project';


// ── Asana Domain Types ─────────────────────────────────────────────────────

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  photo?: { image_60x60?: string } | null;
}

export interface AsanaProject {
  gid: string;
  name: string;
  archived: boolean;
  color: string;
  modified_at: string;
  owner?: { gid?: string; name: string } | null;
  members?: { gid: string }[];
  current_status?: { title: string; color: string } | null;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
  projects?: { gid: string; name: string }[];
  memberships?: { project?: { gid: string }; section?: { gid: string; name: string } }[];
  parent?: { gid: string; name: string } | null;
  due_on: string | null;
  due_at: string | null;
  created_at: string;
  modified_at: string;
  num_subtasks?: number;
}

export interface AsanaComment {
  gid: string;
  text: string;
  html_text?: string;
  created_at: string;
  created_by?: { gid?: string; name: string };
  type: 'comment';
}

export interface TaskDetail {
  gid: string;
  name: string;
  notes: string;
  html_notes?: string;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
  projects?: { gid: string; name: string }[];
  memberships?: { project?: { gid: string }; section?: { gid: string; name: string } }[];
  parent?: { gid: string; name: string } | null;
  due_on: string | null;
  due_at: string | null;
  created_at: string;
  modified_at: string;
  num_subtasks?: number;
}

export interface AsanaSubtask {
  gid: string;
  name: string;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
  due_on: string | null;
}

export interface AddCommentResult {
  success: boolean;
  comment?: AsanaComment;
  error?: string;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  siteName: string | null;
}

export interface AsanaAttachment {
  gid: string;
  name: string;
  download_url: string | null;
  view_url: string | null;
  permanent_url: string | null;
  host: string;
  resource_subtype: string;
  size: number | null;
  created_at: string;
}

export interface AsanaDependency {
  gid: string;
  name: string;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
}

export interface AsanaSection {
  gid: string;
  name: string;
}

export interface AsanaField {
  gid: string;
  name: string;
  type: string;
}

export interface AsanaWorkspace {
  gid: string;
  name?: string;
}

export interface AsanaStory {
  gid: string;
  text: string;
  html_text?: string;
  created_at: string;
  created_by?: { gid?: string; name: string };
  type: string;
  resource_subtype: string;
  sticker_name?: string | null;
  num_likes?: number;
}

export interface InboxNotification {
  storyGid: string;
  taskGid: string;
  taskName: string;
  text: string;
  createdAt: string;
  createdBy?: { gid?: string; name: string };
  resourceSubtype: string;
  stickerName?: string | null;
  numLikes?: number;
}

export interface InboxFetchResult {
  notifications: InboxNotification[];
  error?: string;
}


// ── Application Settings ───────────────────────────────────────────────────

export interface EncryptedApiKey {
  safeStorage: true;
  data: string;  // base64-encoded buffer from safeStorage.encryptString()
}

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface Settings {
  theme: ThemeSetting;
  accentColor: string;
  pollIntervalMinutes: number;
  globalHotkey: string;
  showOnlyMyTasks: boolean;
  currentUserId: string | null;
  selectedUserIds: string[];
  excludedTaskGids: string[];
  excludedTaskPatterns: string[];
  excludedProjectGids: string[];
  excludedProjectPatterns: string[];
  includedTaskPatterns: string[];
  includedProjectPatterns: string[];
  pinnedTaskGids: string[];
  pinnedProjectGids: string[];
  openLinksIn: string;
  apiKey: EncryptedApiKey | null;
  apiKeyVerified: boolean;
  windowBounds: WindowBounds | null;
  maxSearchPages?: number;
  inboxTaskLimit?: number;
}

/** Settings as seen by the renderer — apiKey masked as '••••••••' or null */
export type MaskedSettings = Omit<Settings, 'apiKey'> & {
  apiKey: string | null;
};


// ── Callback Types ────────────────────────────────────────────────────────

export type PollCallback = (data: PollDataPacket) => void;
export type PollStartedCallback = () => void;


// ── AsanaAPI Interface ────────────────────────────────────────────────────
// Shared interface satisfied by both AsanaAPI (real) and DemoAsanaAPI (fake).
// Used by main.ts and ipc-handlers.ts to type the API client polymorphically.

export interface AsanaAPILike {
  verifyApiKey(): Promise<VerifyApiKeyResult>;
  getWorkspaces(): Promise<AsanaWorkspace[]>;
  getUsers(workspaceGid: string): Promise<AsanaUser[]>;
  getTaskComments(taskGid: string): Promise<AsanaComment[]>;
  getTaskStories(taskGid: string): Promise<AsanaStory[]>;
  fetchInboxNotifications(tasks: AsanaTask[], currentUserId: string | null, limit: number): Promise<InboxNotification[]>;
  getProjectSections(projectGid: string): Promise<AsanaSection[]>;
  getProjectFields(projectGid: string): Promise<AsanaField[]>;
  getTaskDetail(taskGid: string): Promise<TaskDetail>;
  getSubtasks(taskGid: string): Promise<AsanaSubtask[]>;
  getTaskAttachments(taskGid: string): Promise<AsanaAttachment[]>;
  getTaskDependencies(taskGid: string): Promise<AsanaDependency[]>;
  getTaskDependents(taskGid: string): Promise<AsanaDependency[]>;
  addComment(taskGid: string, text: string): Promise<AsanaComment>;
  completeTask(taskGid: string): Promise<{ data: unknown }>;
  startPolling(interval: number, onUpdate: PollCallback, onPollStarted?: PollStartedCallback): void;
  stopPolling(): void;
  restartPolling(interval: number): void;
  refresh(): Promise<void>;
}


// ── IPC Result Types ───────────────────────────────────────────────────────

export interface PollDataPacket {
  tasks?: AsanaTask[];
  projects?: AsanaProject[];
  unfilteredTaskCount?: number;
  unfilteredProjectCount?: number;
  hasNewInboxActivity?: boolean;
  workspaceGid?: string;
  error?: string;
}

export interface VerifyApiKeyResult {
  valid: boolean;
  user?: AsanaUser;
  error?: string;
}

export interface CompleteTaskResult {
  success: boolean;
  error?: string;
}

export interface BrowserInfo {
  id: string;
  name: string;
}

export interface ContextMenuItem {
  type: ItemFilterType;
  name: string;
  gid: string;
}

export interface UpdateDialogInitData {
  mode: 'update-available' | 'update-downloaded' | 'whats-new';
  currentVersion: string;
  newVersion: string;
  releaseNotes: string;
  theme: ResolvedTheme;
}


// ── IPC Channel Maps ───────────────────────────────────────────────────────
// Typed contracts for every IPC channel. Enables compile-time checking of
// channel names, argument types, and return types across the process boundary.

/** Invoke channels: request/response via ipcMain.handle / ipcRenderer.invoke */
export interface IpcInvokeChannelMap {
  'store:get-settings':       { args: [];                                    return: MaskedSettings };
  'store:set-settings':       { args: [updates: Partial<MaskedSettings>];    return: MaskedSettings | void };
  'store:get-seen-timestamps':{ args: [];                                    return: Record<string, string> };
  'store:set-seen-timestamp': { args: [taskGid: string, timestamp: string];  return: void };

  'asana:verify-api-key':     { args: [key: string];                         return: VerifyApiKeyResult };
  'asana:remove-api-key':     { args: [];                                    return: void };
  'asana:get-tasks':          { args: [];                                    return: AsanaTask[] };
  'asana:get-projects':       { args: [];                                    return: AsanaProject[] };
  'asana:get-users':          { args: [];                                    return: AsanaUser[] };
  'asana:get-user-membership-map': { args: [];                               return: Record<string, string> };
  'asana:get-task-comments':  { args: [taskGid: string];                     return: AsanaComment[] };
  'asana:get-project-sections': { args: [projectGid: string];               return: AsanaSection[] };
  'asana:get-project-fields': { args: [projectGid: string];                 return: AsanaField[] };
  'asana:get-task-detail':    { args: [taskGid: string];                     return: TaskDetail };
  'asana:get-subtasks':       { args: [taskGid: string];                     return: AsanaSubtask[] };
  'asana:get-task-attachments': { args: [taskGid: string];                   return: AsanaAttachment[] };
  'asana:get-task-dependencies': { args: [taskGid: string];                  return: AsanaDependency[] };
  'asana:get-task-dependents': { args: [taskGid: string];                    return: AsanaDependency[] };
  'asana:add-comment':        { args: [taskGid: string, text: string];       return: AddCommentResult };
  'asana:complete-task':      { args: [taskGid: string];                     return: CompleteTaskResult };
  'asana:refresh':            { args: [];                                    return: void };

  'inbox:fetch-notifications':{ args: [];                                    return: InboxFetchResult };
  'inbox:get-archived-gids':  { args: [];                                    return: string[] };
  'inbox:archive':            { args: [storyGid: string];                    return: void };
  'inbox:archive-all':        { args: [storyGids: string[]];                 return: void };
  'inbox:mark-opened':        { args: [];                                    return: void };

  'window:get-slide-direction': { args: [];                                  return: 'left' | 'right' };

  'app:get-version':          { args: [];                                    return: string };
  'app:check-for-updates':    { args: [];                                    return: void };
  'app:open-url':             { args: [url: string];                         return: void };
  'app:detect-browsers':      { args: [];                                    return: BrowserInfo[] };
  'app:download-update':      { args: [];                                    return: void };
  'app:restart-for-update':   { args: [];                                    return: void };
  'app:export-csv':           { args: [filename: string, csv: string];       return: boolean };
  'app:fetch-link-preview':   { args: [url: string];                         return: LinkPreview };

  'update-dialog:get-init-data': { args: [];                                 return: UpdateDialogInitData | null };
}

/** Send channels: fire-and-forget via ipcMain.on / ipcRenderer.send */
export interface IpcSendChannelMap {
  'window:hide':              { args: [] };
  'window:open-settings':     { args: [] };
  'settings:close':           { args: [] };
  'app:quit':                 { args: [] };
  'app:apply-theme':          { args: [theme: ThemeSetting] };
  'app:apply-accent':         { args: [accent: string] };
  'app:re-register-hotkey':   { args: [] };
  'context-menu:item':        { args: [item: ContextMenuItem] };
  'context-menu:link':        { args: [url: string] };
  'update-dialog:close':      { args: [] };
}

/** Event channels: main → renderer via webContents.send */
export interface IpcEventChannelMap {
  'asana:data-updated':       { args: [data: PollDataPacket] };
  'asana:poll-started':       { args: [] };
  'settings:updated':         { args: [settings: MaskedSettings] };
  'theme:changed':            { args: [theme: ResolvedTheme] };
  'accent:changed':           { args: [accent: string] };
  'app:download-progress':    { args: [percent: number] };
}


// ── Preload API Interfaces ─────────────────────────────────────────────────
// These define the shape of window.electronAPI, window.settingsAPI, etc.

export interface ElectronAPI {
  // Settings
  getSettings(): Promise<MaskedSettings>;
  setSettings(updates: Partial<MaskedSettings>): Promise<MaskedSettings | void>;

  // Asana data
  getTasks(): Promise<AsanaTask[]>;
  getProjects(): Promise<AsanaProject[]>;
  getUsers(): Promise<AsanaUser[]>;
  getUserMembershipMap(): Promise<Record<string, string>>;
  getTaskComments(taskGid: string): Promise<AsanaComment[]>;
  getProjectSections(projectGid: string): Promise<AsanaSection[]>;
  getProjectFields(projectGid: string): Promise<AsanaField[]>;
  getTaskDetail(taskGid: string): Promise<TaskDetail>;
  getSubtasks(taskGid: string): Promise<AsanaSubtask[]>;
  getTaskAttachments(taskGid: string): Promise<AsanaAttachment[]>;
  getTaskDependencies(taskGid: string): Promise<AsanaDependency[]>;
  getTaskDependents(taskGid: string): Promise<AsanaDependency[]>;
  addComment(taskGid: string, text: string): Promise<AddCommentResult>;
  completeTask(taskGid: string): Promise<CompleteTaskResult>;
  refreshData(): Promise<void>;

  // Export
  exportCsv(filename: string, csv: string): Promise<boolean>;

  // Link previews
  fetchLinkPreview(url: string): Promise<LinkPreview>;

  // API key
  verifyApiKey(key: string): Promise<VerifyApiKeyResult>;
  removeApiKey(): Promise<void>;

  // Comment tracking
  getSeenTimestamps(): Promise<Record<string, string>>;
  setSeenTimestamp(taskGid: string, timestamp: string): Promise<void>;

  // Inbox
  fetchInboxNotifications(): Promise<InboxFetchResult>;
  getArchivedInboxGids(): Promise<string[]>;
  archiveInboxItem(storyGid: string): Promise<void>;
  archiveAllInboxItems(storyGids: string[]): Promise<void>;
  markInboxOpened(): Promise<void>;
  getSlideDirection(): Promise<'left' | 'right'>;

  // Context menu
  showItemContextMenu(item: ContextMenuItem): void;
  showLinkContextMenu(url: string): void;

  // Window controls
  hideWindow(): void;
  openSettings(): void;

  // App
  getVersion(): Promise<string>;
  checkForUpdates(): Promise<void>;
  openUrl(url: string): Promise<void>;
  quit(): void;

  // Theme
  applyTheme(theme: ThemeSetting): void;
  applyAccent(accent: string): void;

  // Events from main
  onDataUpdate(callback: (data: PollDataPacket) => void): () => void;
  onPollStarted(callback: () => void): () => void;
  onSettingsChanged(callback: (settings: MaskedSettings) => void): () => void;
  onThemeChanged(callback: (theme: ResolvedTheme) => void): () => void;
  onAccentChanged(callback: (accent: string) => void): () => void;
}

export interface SettingsAPI {
  // Settings
  getSettings(): Promise<MaskedSettings>;
  setSettings(updates: Partial<MaskedSettings>): Promise<MaskedSettings | void>;

  // API key
  verifyApiKey(key: string): Promise<VerifyApiKeyResult>;
  removeApiKey(): Promise<void>;

  // Users
  getUsers(): Promise<AsanaUser[]>;

  // Theme
  applyTheme(theme: ThemeSetting): void;
  applyAccent(accent: string): void;

  // App
  getVersion(): Promise<string>;
  checkForUpdates(): Promise<void>;
  detectBrowsers(): Promise<BrowserInfo[]>;
  quit(): void;
  reRegisterHotkey(): void;

  // Window
  closeSettings(): void;

  // Events
  onThemeChanged(callback: (theme: ResolvedTheme) => void): () => void;
  onAccentChanged(callback: (accent: string) => void): () => void;
}

export interface UpdateAPI {
  getInitData(): Promise<UpdateDialogInitData | null>;
  downloadUpdate(): Promise<void>;
  restartForUpdate(): Promise<void>;
  close(): void;

  onThemeChanged(callback: (theme: ResolvedTheme) => void): () => void;
  onDownloadProgress(callback: (percent: number) => void): () => void;
}
