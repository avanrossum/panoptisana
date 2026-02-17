import { contextBridge, ipcRenderer } from 'electron';

import type { SettingsAPI, ResolvedTheme } from '../shared/types';

const settingsAPI: SettingsAPI = {
  // ── Settings ────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('store:get-settings'),
  setSettings: (updates) => ipcRenderer.invoke('store:set-settings', updates),

  // ── API Key ─────────────────────────────────────────────────
  verifyApiKey: (key) => ipcRenderer.invoke('asana:verify-api-key', key),
  removeApiKey: () => ipcRenderer.invoke('asana:remove-api-key'),

  // ── Users ───────────────────────────────────────────────────
  getUsers: () => ipcRenderer.invoke('asana:get-users'),

  // ── Theme ───────────────────────────────────────────────────
  applyTheme: (theme) => ipcRenderer.send('app:apply-theme', theme),
  applyAccent: (accent) => ipcRenderer.send('app:apply-accent', accent),

  // ── App ─────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  detectBrowsers: () => ipcRenderer.invoke('app:detect-browsers'),
  quit: () => ipcRenderer.send('app:quit'),
  reRegisterHotkey: () => ipcRenderer.send('app:re-register-hotkey'),

  // ── Window ──────────────────────────────────────────────────
  closeSettings: () => ipcRenderer.send('settings:close'),

  // ── Events ──────────────────────────────────────────────────
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

contextBridge.exposeInMainWorld('settingsAPI', settingsAPI);
