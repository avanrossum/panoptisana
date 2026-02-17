import { contextBridge, ipcRenderer } from 'electron';

import type { UpdateAPI, ResolvedTheme } from '../shared/types';

const updateAPI: UpdateAPI = {
  getInitData: () => ipcRenderer.invoke('update-dialog:get-init-data'),
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  restartForUpdate: () => ipcRenderer.invoke('app:restart-for-update'),
  close: () => ipcRenderer.send('update-dialog:close'),

  onThemeChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, theme: ResolvedTheme) => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },

  onDownloadProgress: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, percent: number) => callback(percent);
    ipcRenderer.on('app:download-progress', handler);
    return () => ipcRenderer.removeListener('app:download-progress', handler);
  }
};

contextBridge.exposeInMainWorld('updateAPI', updateAPI);
