import { contextBridge, ipcRenderer } from 'electron';

import type { ElectronAPI } from '../shared/types';

const electronAPI: ElectronAPI = {
  // ── Settings ────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('store:get-settings'),
  setSettings: (updates) => ipcRenderer.invoke('store:set-settings', updates),

  // ── Asana Data ──────────────────────────────────────────────
  getTasks: () => ipcRenderer.invoke('asana:get-tasks'),
  getProjects: () => ipcRenderer.invoke('asana:get-projects'),
  getUsers: () => ipcRenderer.invoke('asana:get-users'),
  getTaskComments: (taskGid) => ipcRenderer.invoke('asana:get-task-comments', taskGid),
  completeTask: (taskGid) => ipcRenderer.invoke('asana:complete-task', taskGid),
  refreshData: () => ipcRenderer.invoke('asana:refresh'),

  // ── API Key ─────────────────────────────────────────────────
  verifyApiKey: (key) => ipcRenderer.invoke('asana:verify-api-key', key),
  removeApiKey: () => ipcRenderer.invoke('asana:remove-api-key'),

  // ── Comment Tracking ────────────────────────────────────────
  getSeenTimestamps: () => ipcRenderer.invoke('store:get-seen-timestamps'),
  setSeenTimestamp: (taskGid, timestamp) => ipcRenderer.invoke('store:set-seen-timestamp', taskGid, timestamp),

  // ── Context Menu ────────────────────────────────────────────
  showItemContextMenu: ({ type, name, gid }) => ipcRenderer.send('context-menu:item', { type, name, gid }),

  // ── Window Controls ─────────────────────────────────────────
  hideWindow: () => ipcRenderer.send('window:hide'),
  openSettings: () => ipcRenderer.send('window:open-settings'),

  // ── App ─────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openUrl: (url) => ipcRenderer.invoke('app:open-url', url),
  quit: () => ipcRenderer.send('app:quit'),

  // ── Theme ───────────────────────────────────────────────────
  applyTheme: (theme) => ipcRenderer.send('app:apply-theme', theme),
  applyAccent: (accent) => ipcRenderer.send('app:apply-accent', accent),

  // ── Events from Main ────────────────────────────────────────
  onDataUpdate: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data as any);
    ipcRenderer.on('asana:data-updated', handler);
    return () => ipcRenderer.removeListener('asana:data-updated', handler);
  },
  onPollStarted: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('asana:poll-started', handler);
    return () => ipcRenderer.removeListener('asana:poll-started', handler);
  },
  onSettingsChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, settings: unknown) => callback(settings as any);
    ipcRenderer.on('settings:updated', handler);
    return () => ipcRenderer.removeListener('settings:updated', handler);
  },
  onThemeChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, theme: unknown) => callback(theme as any);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },
  onAccentChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, accent: unknown) => callback(accent as any);
    ipcRenderer.on('accent:changed', handler);
    return () => ipcRenderer.removeListener('accent:changed', handler);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
