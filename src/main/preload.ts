import { contextBridge, ipcRenderer } from 'electron';

import type { ElectronAPI, PollDataPacket, MaskedSettings, ResolvedTheme, LinkPreview } from '../shared/types';

const electronAPI: ElectronAPI = {
  // ── Settings ────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('store:get-settings'),
  setSettings: (updates) => ipcRenderer.invoke('store:set-settings', updates),

  // ── Asana Data ──────────────────────────────────────────────
  getTasks: () => ipcRenderer.invoke('asana:get-tasks'),
  getProjects: () => ipcRenderer.invoke('asana:get-projects'),
  getUsers: () => ipcRenderer.invoke('asana:get-users'),
  getUserMembershipMap: () => ipcRenderer.invoke('asana:get-user-membership-map'),
  getTaskComments: (taskGid) => ipcRenderer.invoke('asana:get-task-comments', taskGid),
  getProjectSections: (projectGid) => ipcRenderer.invoke('asana:get-project-sections', projectGid),
  getProjectFields: (projectGid) => ipcRenderer.invoke('asana:get-project-fields', projectGid),
  getTaskDetail: (taskGid) => ipcRenderer.invoke('asana:get-task-detail', taskGid),
  getSubtasks: (taskGid) => ipcRenderer.invoke('asana:get-subtasks', taskGid),
  getTaskAttachments: (taskGid) => ipcRenderer.invoke('asana:get-task-attachments', taskGid),
  getTaskDependencies: (taskGid) => ipcRenderer.invoke('asana:get-task-dependencies', taskGid),
  getTaskDependents: (taskGid) => ipcRenderer.invoke('asana:get-task-dependents', taskGid),
  addComment: (taskGid, text) => ipcRenderer.invoke('asana:add-comment', taskGid, text),
  completeTask: (taskGid) => ipcRenderer.invoke('asana:complete-task', taskGid),
  refreshData: () => ipcRenderer.invoke('asana:refresh'),

  // ── Export ────────────────────────────────────────────────────
  exportCsv: (filename, csv) => ipcRenderer.invoke('app:export-csv', filename, csv),

  // ── API Key ─────────────────────────────────────────────────
  verifyApiKey: (key) => ipcRenderer.invoke('asana:verify-api-key', key),
  removeApiKey: () => ipcRenderer.invoke('asana:remove-api-key'),

  // ── Comment Tracking ────────────────────────────────────────
  getSeenTimestamps: () => ipcRenderer.invoke('store:get-seen-timestamps'),
  setSeenTimestamp: (taskGid, timestamp) => ipcRenderer.invoke('store:set-seen-timestamp', taskGid, timestamp),

  // ── Inbox ──────────────────────────────────────────────────
  fetchInboxNotifications: () => ipcRenderer.invoke('inbox:fetch-notifications'),
  getArchivedInboxGids: () => ipcRenderer.invoke('inbox:get-archived-gids'),
  archiveInboxItem: (storyGid) => ipcRenderer.invoke('inbox:archive', storyGid),
  archiveAllInboxItems: (storyGids) => ipcRenderer.invoke('inbox:archive-all', storyGids),
  markInboxOpened: () => ipcRenderer.invoke('inbox:mark-opened'),
  getSlideDirection: () => ipcRenderer.invoke('window:get-slide-direction'),

  // ── Context Menu ────────────────────────────────────────────
  showItemContextMenu: ({ type, name, gid }) => ipcRenderer.send('context-menu:item', { type, name, gid }),
  showLinkContextMenu: (url) => ipcRenderer.send('context-menu:link', url),

  // ── Window Controls ─────────────────────────────────────────
  hideWindow: () => ipcRenderer.send('window:hide'),
  openSettings: () => ipcRenderer.send('window:open-settings'),

  // ── App ─────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openUrl: (url) => ipcRenderer.invoke('app:open-url', url),
  fetchLinkPreview: (url) => ipcRenderer.invoke('app:fetch-link-preview', url) as Promise<LinkPreview>,
  quit: () => ipcRenderer.send('app:quit'),

  // ── Theme ───────────────────────────────────────────────────
  applyTheme: (theme) => ipcRenderer.send('app:apply-theme', theme),
  applyAccent: (accent) => ipcRenderer.send('app:apply-accent', accent),

  // ── Events from Main ────────────────────────────────────────
  onDataUpdate: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: PollDataPacket) => callback(data);
    ipcRenderer.on('asana:data-updated', handler);
    return () => ipcRenderer.removeListener('asana:data-updated', handler);
  },
  onPollStarted: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('asana:poll-started', handler);
    return () => ipcRenderer.removeListener('asana:poll-started', handler);
  },
  onSettingsChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, settings: MaskedSettings) => callback(settings);
    ipcRenderer.on('settings:updated', handler);
    return () => ipcRenderer.removeListener('settings:updated', handler);
  },
  onThemeChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, theme: ResolvedTheme) => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },
  onAccentChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, accent: string) => callback(accent);
    ipcRenderer.on('accent:changed', handler);
    return () => ipcRenderer.removeListener('accent:changed', handler);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
