import { app, BrowserWindow, nativeTheme, ipcMain, screen, globalShortcut, dialog } from 'electron';
import path from 'path';
import { createTray, getTray } from './tray';
import { registerIpcHandlers, broadcastSettingsToRenderer } from './ipc-handlers';
import { Store } from './store';
import { AsanaAPI } from './asana-api';
import { DemoAsanaAPI } from './demo-asana-api';
import { DEMO_CURRENT_USER } from './demo-data';
import { autoUpdater } from 'electron-updater';
import { THEME_BG_COLORS, WINDOW_SIZE, SETTINGS_WINDOW_SIZE, UPDATE_DIALOG_SIZE, TIMING, DEFAULT_SETTINGS } from './constants';

import type { UpdateInfo } from 'electron-updater';
import type { ResolvedTheme, UpdateDialogInitData, PollDataPacket, AsanaAPILike } from '../shared/types';

const isDev = process.argv.includes('--dev');

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLING
// ══════════════════════════════════════════════════════════════════════════════

process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE' || error.message?.includes('EPIPE')) return;
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
});

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════════════════════════════════

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let updateDialogWindow: (BrowserWindow & { _initData?: UpdateDialogInitData }) | null = null;
let store: Store | null = null;
let asanaApi: AsanaAPILike | null = null;

// ══════════════════════════════════════════════════════════════════════════════
// AUTO-UPDATER
// ══════════════════════════════════════════════════════════════════════════════

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let isManualUpdateCheck = false;
let isRestartingForUpdate = false;

function formatReleaseNotes(info: UpdateInfo): string {
  if (!info.releaseNotes) return '';
  if (typeof info.releaseNotes === 'string') return info.releaseNotes;
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes.map(n => typeof n === 'string' ? n : n.note || '').join('\n\n');
  }
  return '';
}

function showUpdateDialog(mode: UpdateDialogInitData['mode'], options: { currentVersion?: string; newVersion?: string; releaseNotes?: string }): void {
  // Close old dialog first — clear reference BEFORE close to prevent the old
  // 'closed' handler from nulling the new window reference (race condition).
  const oldWindow = updateDialogWindow;
  updateDialogWindow = null;
  if (oldWindow && !oldWindow.isDestroyed()) {
    oldWindow.close();
  }

  const theme = resolveTheme();

  // Center over main window if available, otherwise OS default
  const pos: { x?: number; y?: number } = {};
  if (mainWindow && !mainWindow.isDestroyed()) {
    const b = mainWindow.getBounds();
    pos.x = Math.round(b.x + (b.width - UPDATE_DIALOG_SIZE.WIDTH) / 2);
    pos.y = Math.round(b.y + (b.height - UPDATE_DIALOG_SIZE.HEIGHT) / 2);
  }

  const newWindow = new BrowserWindow({
    width: UPDATE_DIALOG_SIZE.WIDTH,
    height: UPDATE_DIALOG_SIZE.HEIGHT,
    ...pos,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    backgroundColor: THEME_BG_COLORS[theme],
    webPreferences: {
      preload: path.join(__dirname, 'update-dialog-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  }) as BrowserWindow & { _initData?: UpdateDialogInitData };

  updateDialogWindow = newWindow;

  // Store init data for the dialog
  newWindow._initData = {
    mode,
    currentVersion: options.currentVersion || app.getVersion(),
    newVersion: options.newVersion || '',
    releaseNotes: options.releaseNotes || '',
    theme
  };

  const url = isDev
    ? 'http://localhost:5173/src/update-dialog/index.html'
    : `file://${path.join(__dirname, '../../dist-renderer/src/update-dialog/index.html')}`;

  newWindow.loadURL(url);

  newWindow.on('closed', () => {
    // Only null if this is still the current dialog (prevents race with showUpdateDialog re-entry)
    if (updateDialogWindow === newWindow) {
      updateDialogWindow = null;
    }
  });
}

autoUpdater.on('update-available', (info: UpdateInfo) => {
  isManualUpdateCheck = false;
  showUpdateDialog('update-available', {
    newVersion: info.version,
    releaseNotes: formatReleaseNotes(info)
  });
});

autoUpdater.on('update-not-available', () => {
  if (isManualUpdateCheck) {
    isManualUpdateCheck = false;
    dialog.showMessageBox({
      type: 'info',
      title: 'No Updates Available',
      message: 'You\'re running the latest version.',
      buttons: ['OK']
    });
  }
});

autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
  const releaseNotes = formatReleaseNotes(info);
  if (store && releaseNotes) {
    store.setSettings({ pendingWhatsNewNotes: releaseNotes });
  }
  showUpdateDialog('update-downloaded', {
    newVersion: info.version,
    releaseNotes
  });
});

autoUpdater.on('download-progress', (progress: { percent: number }) => {
  const percent = Math.round(progress.percent);
  if (updateDialogWindow && !updateDialogWindow.isDestroyed()) {
    updateDialogWindow.webContents.send('app:download-progress', percent);
  }
});

autoUpdater.on('error', (err: Error) => {
  if (!isDev) {
    console.error('Auto-updater error:', err);
    if (isManualUpdateCheck || err.message?.includes('download')) {
      isManualUpdateCheck = false;
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'Failed to check for updates.',
        detail: err.message || 'Please try again later.',
        buttons: ['OK']
      });
    }
  }
});

// ── Update IPC handlers ───────────────────────────────────────

ipcMain.handle('update-dialog:get-init-data', () => {
  if (updateDialogWindow && updateDialogWindow._initData) {
    return updateDialogWindow._initData;
  }
  return null;
});

ipcMain.handle('app:check-for-updates', () => {
  isManualUpdateCheck = true;
  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error('[main] Update check failed:', err.message);
  });
});

ipcMain.handle('app:download-update', () => {
  autoUpdater.downloadUpdate().catch((err: Error) => {
    console.error('[main] Download update failed:', err.message);
  });
});

ipcMain.handle('app:restart-for-update', () => {
  isRestartingForUpdate = true;
  const trayRef = getTray();
  if (trayRef) trayRef.destroy();
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.on('update-dialog:close', () => {
  if (updateDialogWindow && !updateDialogWindow.isDestroyed()) {
    updateDialogWindow.close();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════════════════

function resolveTheme(): ResolvedTheme {
  const settings = store ? store.getSettings() : {};
  const themeSetting = settings.theme || 'system';
  if (themeSetting === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return themeSetting as ResolvedTheme;
}

function broadcastTheme(theme: ResolvedTheme): void {
  const windows = [mainWindow, settingsWindow, updateDialogWindow];
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme:changed', theme);
    }
  }
}

function broadcastAccent(accent: string): void {
  const windows = [mainWindow, settingsWindow];
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('accent:changed', accent);
    }
  }
}

ipcMain.on('app:apply-theme', (_, theme: string) => {
  if (store) store.setSettings({ theme });
  broadcastTheme(resolveTheme());
});

ipcMain.on('app:apply-accent', (_, accent: string) => {
  if (store) store.setSettings({ accentColor: accent });
  broadcastAccent(accent);
});

nativeTheme.on('updated', () => {
  const settings = store ? store.getSettings() : {};
  if (settings.theme === 'system') {
    broadcastTheme(resolveTheme());
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WINDOW MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

function createMainWindow(): BrowserWindow {
  const settings = store!.getSettings();
  const theme = resolveTheme();

  // Restore saved bounds or use defaults
  const bounds: { x?: number; y?: number; width: number; height: number } = settings.windowBounds || {
    width: WINDOW_SIZE.DEFAULT_WIDTH,
    height: WINDOW_SIZE.DEFAULT_HEIGHT
  };

  // Validate bounds are on a visible display
  if (bounds.x !== undefined && bounds.y !== undefined) {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some(d => {
      const area = d.workArea;
      return bounds.x! >= area.x - 50 && bounds.x! < area.x + area.width &&
             bounds.y! >= area.y - 50 && bounds.y! < area.y + area.height;
    });
    if (!onScreen) {
      delete bounds.x;
      delete bounds.y;
    }
  }

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: WINDOW_SIZE.MIN_WIDTH,
    minHeight: WINDOW_SIZE.MIN_HEIGHT,
    maxWidth: WINDOW_SIZE.MAX_WIDTH,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: THEME_BG_COLORS[theme],
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const url = isDev
    ? 'http://localhost:5173/src/renderer/index.html'
    : `file://${path.join(__dirname, '../../dist-renderer/src/renderer/index.html')}`;

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  // Save window bounds on move/resize
  let boundsTimer: ReturnType<typeof setTimeout> | null = null;
  const saveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        store!.setSettings({ windowBounds: mainWindow.getBounds() });
      }
    }, TIMING.SAVE_DEBOUNCE_MS);
  };
  mainWindow.on('move', saveBounds);
  mainWindow.on('resize', saveBounds);

  // Hide instead of close
  mainWindow.on('close', (e) => {
    if (!isRestartingForUpdate && !(app as any).isQuitting) {
      e.preventDefault();
      mainWindow!.hide();
    }
  });

  return mainWindow;
}

function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function hideMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const theme = resolveTheme();

  // Center over main window if available, otherwise OS default
  const pos: { x?: number; y?: number } = {};
  if (mainWindow && !mainWindow.isDestroyed()) {
    const b = mainWindow.getBounds();
    pos.x = Math.round(b.x + (b.width - SETTINGS_WINDOW_SIZE.WIDTH) / 2);
    pos.y = Math.round(b.y + (b.height - SETTINGS_WINDOW_SIZE.HEIGHT) / 2);
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WINDOW_SIZE.WIDTH,
    height: SETTINGS_WINDOW_SIZE.HEIGHT,
    ...pos,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    backgroundColor: THEME_BG_COLORS[theme],
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const url = isDev
    ? 'http://localhost:5173/src/settings/index.html'
    : `file://${path.join(__dirname, '../../dist-renderer/src/settings/index.html')}`;

  settingsWindow.loadURL(url);

  settingsWindow.once('ready-to-show', () => {
    settingsWindow!.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // Broadcast updated settings to renderer for instant filter updates
    if (store) {
      broadcastSettingsToRenderer(store, () => mainWindow);
    }
    // Trigger a fresh poll for non-filter changes (user selection, interval, etc.)
    if (asanaApi) {
      asanaApi.refresh();
    }
  });
}

// Handle settings open from both renderer and tray
ipcMain.on('window:open-settings', () => {
  openSettings();
});

// Re-register global hotkey when changed in settings
ipcMain.on('app:re-register-hotkey', () => {
  registerGlobalHotkey();
});

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL HOTKEY
// ══════════════════════════════════════════════════════════════════════════════

let currentHotkey: string | null = null;

function registerGlobalHotkey(): void {
  const settings = store!.getSettings();
  const hotkey = settings.globalHotkey || DEFAULT_SETTINGS.globalHotkey;

  // Unregister previous hotkey
  if (currentHotkey) {
    try { globalShortcut.unregister(currentHotkey); } catch (_) { /* ignore */ }
  }

  try {
    globalShortcut.register(hotkey, () => {
      if (mainWindow!.isVisible()) {
        hideMainWindow();
      } else {
        showMainWindow();
      }
    });
    currentHotkey = hotkey;
  } catch (err) {
    console.error('[main] Failed to register hotkey:', (err as Error).message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

ipcMain.on('app:quit', () => {
  (app as any).isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  // Hide from dock (tray-only app)
  if (app.dock) {
    app.dock.hide();
  }

  // Initialize store
  store = new Store();

  // Apply default settings for any missing values
  const currentSettings = store.getSettings();
  const mergedSettings = { ...DEFAULT_SETTINGS, ...currentSettings };
  store.setSettings(mergedSettings);

  // Initialize Asana API (or demo substitute)
  const isDemo = process.env.PANOPTISANA_DEMO === '1';

  if (isDemo) {
    console.log('[demo] Demo mode active — using fake Asana data');
    // Only seed demo settings if not already configured (preserve real user data)
    const demoSettings = store.getSettings();
    if (!demoSettings.currentUserId) {
      store.setSettings({ currentUserId: DEMO_CURRENT_USER.gid });
    }
    store.setSettings({ apiKeyVerified: true });
    asanaApi = new DemoAsanaAPI({ store });
  } else {
    asanaApi = new AsanaAPI({
      store,
      getApiKey: () => {
        const settings = store!.getSettings();
        return settings.apiKey ? store!.decryptApiKey(settings.apiKey) : null;
      }
    });
  }

  // Register IPC handlers
  registerIpcHandlers({
    store,
    asanaApi,
    getMainWindow: () => mainWindow,
    getSettingsWindow: () => settingsWindow
  });

  // Create main window
  createMainWindow();

  // Create tray
  createTray(mainWindow!, showMainWindow, hideMainWindow, openSettings);

  // Register global hotkey
  registerGlobalHotkey();

  // Start polling if API key is verified (demo mode always starts)
  const settings = store.getSettings();
  if (isDemo || (settings.apiKeyVerified && settings.apiKey)) {
    asanaApi.startPolling(
      settings.pollIntervalMinutes || TIMING.DEFAULT_POLL_INTERVAL_MINUTES,
      (data: PollDataPacket) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('asana:data-updated', data);
        }
      },
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('asana:poll-started');
        }
      }
    );
  }

  // Check for updates (after brief delay)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, TIMING.INITIAL_UPDATE_DELAY_MS);

    // Periodic update checks
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, TIMING.UPDATE_CHECK_INTERVAL_MS);
  }

  // Show "What's New" if pending
  if ((settings as any).pendingWhatsNewNotes) {
    showUpdateDialog('whats-new', {
      releaseNotes: (settings as any).pendingWhatsNewNotes
    });
    store.setSettings({ pendingWhatsNewNotes: null });
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (store) store.flush();
});

app.on('window-all-closed', () => {
  // Don't quit on window close - we're a tray app
  // No-op: prevents default quit behavior for tray-only app
});
