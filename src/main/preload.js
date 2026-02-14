const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
    const handler = (_, data) => callback(data);
    ipcRenderer.on('asana:data-updated', handler);
    return () => ipcRenderer.removeListener('asana:data-updated', handler);
  },
  onPollStarted: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('asana:poll-started', handler);
    return () => ipcRenderer.removeListener('asana:poll-started', handler);
  },
  onThemeChanged: (callback) => {
    const handler = (_, theme) => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },
  onAccentChanged: (callback) => {
    const handler = (_, accent) => callback(accent);
    ipcRenderer.on('accent:changed', handler);
    return () => ipcRenderer.removeListener('accent:changed', handler);
  }
});
