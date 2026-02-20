import { ipcMain, app, dialog, screen, Menu, shell, clipboard, BrowserWindow } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';

import type { Store } from './store';
import type { MaskedSettings, ContextMenuItem, BrowserInfo, AsanaAPILike, LinkPreview } from '../shared/types';
import { extractTitleFromHtml } from '../shared/formatters';

/** Send masked settings to the main renderer so it can re-apply client-side filters */
export function broadcastSettingsToRenderer(store: Store, getMainWindow: () => BrowserWindow | null): void {
  const mainWin = getMainWindow();
  if (mainWin && !mainWin.isDestroyed()) {
    const settings = store.getSettings();
    const masked: MaskedSettings = {
      ...settings,
      apiKey: settings.apiKey ? '••••••••' : null
    } as MaskedSettings;
    mainWin.webContents.send('settings:updated', masked);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLER REGISTRATION
// ══════════════════════════════════════════════════════════════════════════════

interface IpcHandlerDeps {
  store: Store;
  asanaApi: AsanaAPILike;
  getMainWindow: () => BrowserWindow | null;
  getSettingsWindow: () => BrowserWindow | null;
}

export function registerIpcHandlers({ store, asanaApi, getMainWindow, getSettingsWindow }: IpcHandlerDeps): void {

  // Helper: return settings with apiKey masked
  function getMaskedSettings(): MaskedSettings {
    const settings = store.getSettings();
    return {
      ...settings,
      apiKey: settings.apiKey ? '••••••••' : null
    } as MaskedSettings;
  }

  // ── Store: Settings ─────────────────────────────────────────

  ipcMain.handle('store:get-settings', () => {
    return getMaskedSettings();
  });

  ipcMain.handle('store:set-settings', (_, updates: Partial<MaskedSettings>) => {
    if (!updates || typeof updates !== 'object') return;

    // Don't allow setting apiKey through this handler
    delete (updates as Record<string, unknown>).apiKey;
    delete (updates as Record<string, unknown>).apiKeyVerified;

    store.setSettings(updates);

    // If poll interval changed, restart polling
    if ('pollIntervalMinutes' in updates) {
      asanaApi.restartPolling(updates.pollIntervalMinutes!);
    }

    // Always return masked settings
    return getMaskedSettings();
  });

  // ── Store: Comment Tracking ─────────────────────────────────

  ipcMain.handle('store:get-seen-timestamps', () => {
    return store.getSeenTimestamps();
  });

  ipcMain.handle('store:set-seen-timestamp', (_, taskGid: string, timestamp: string) => {
    if (typeof taskGid !== 'string' || typeof timestamp !== 'string') return;
    store.setSeenTimestamp(taskGid, timestamp);
  });

  // ── Asana: API Key ──────────────────────────────────────────

  ipcMain.handle('asana:verify-api-key', async (_, key: string) => {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Invalid key' };
    }

    const trimmedKey = key.trim();

    // Verify the key before persisting it — use a temporary in-memory key
    const originalApiKey = store.getSettings().apiKey;
    const encrypted = store.encryptApiKey(trimmedKey);
    store.setSettings({ apiKey: encrypted });

    const result = await asanaApi.verifyApiKey();

    if (result.valid) {
      // Key verified — keep it persisted
      store.setSettings({ apiKeyVerified: true });

      // Fetch workspace users after verification
      try {
        const workspaces = await asanaApi.getWorkspaces();
        if (workspaces.length > 0) {
          const users = await asanaApi.getUsers(workspaces[0].gid);
          store.setCachedUsers(users);
        }
      } catch (err) {
        console.error('[ipc] Failed to fetch users after key verify:', (err as Error).message);
      }

      // Start polling
      const settings = store.getSettings();
      asanaApi.startPolling(
        settings.pollIntervalMinutes || 5,
        (data) => {
          const mainWin = getMainWindow();
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('asana:data-updated', data);
          }
        },
        () => {
          const mainWin = getMainWindow();
          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('asana:poll-started');
          }
        }
      );

      return { valid: true, user: result.user };
    } else {
      // Key failed — restore previous key (or clear if none existed)
      store.setSettings({ apiKey: originalApiKey || null, apiKeyVerified: false });
      return { valid: false, error: result.error };
    }
  });

  ipcMain.handle('asana:remove-api-key', () => {
    store.setSettings({ apiKey: null, apiKeyVerified: false });
    asanaApi.stopPolling();
    store.setCachedTasks([]);
    store.setCachedProjects([]);
    store.setCachedUsers([]);
  });

  // ── Asana: Data ─────────────────────────────────────────────

  ipcMain.handle('asana:get-tasks', () => {
    return store.getCachedTasks();
  });

  ipcMain.handle('asana:get-projects', () => {
    return store.getCachedProjects();
  });

  ipcMain.handle('asana:get-users', () => {
    return store.getCachedUsers();
  });

  ipcMain.handle('asana:get-user-membership-map', () => {
    return store.getUserMembershipMap();
  });

  ipcMain.handle('asana:get-task-comments', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') return [];
    try {
      return await asanaApi.getTaskComments(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch comments:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:get-project-sections', async (_, projectGid: string) => {
    if (!projectGid || typeof projectGid !== 'string') return [];
    try {
      return await asanaApi.getProjectSections(projectGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch sections:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:get-project-fields', async (_, projectGid: string) => {
    if (!projectGid || typeof projectGid !== 'string') return [];
    try {
      return await asanaApi.getProjectFields(projectGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch fields:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:get-task-detail', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') throw new Error('Invalid task GID');
    try {
      return await asanaApi.getTaskDetail(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch task detail:', (err as Error).message);
      throw err;
    }
  });

  ipcMain.handle('asana:get-subtasks', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') return [];
    try {
      return await asanaApi.getSubtasks(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch subtasks:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:get-task-attachments', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') return [];
    try {
      return await asanaApi.getTaskAttachments(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch attachments:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:get-task-dependencies', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') return [];
    try {
      return await asanaApi.getTaskDependencies(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch dependencies:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:get-task-dependents', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') return [];
    try {
      return await asanaApi.getTaskDependents(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch dependents:', (err as Error).message);
      return [];
    }
  });

  ipcMain.handle('asana:add-comment', async (_, taskGid: string, text: string) => {
    if (!taskGid || typeof taskGid !== 'string') return { success: false, error: 'Invalid task GID' };
    if (!text || typeof text !== 'string') return { success: false, error: 'Empty comment text' };
    try {
      const comment = await asanaApi.addComment(taskGid, text);
      return { success: true, comment };
    } catch (err) {
      console.error('[ipc] Failed to add comment:', (err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('asana:complete-task', async (_, taskGid: string) => {
    if (!taskGid || typeof taskGid !== 'string') return { success: false };
    try {
      await asanaApi.completeTask(taskGid);
      return { success: true };
    } catch (err) {
      console.error('[ipc] Failed to complete task:', (err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('asana:refresh', async () => {
    await asanaApi.refresh();
  });

  // ── Inbox ────────────────────────────────────────────────────

  ipcMain.handle('inbox:fetch-notifications', async () => {
    try {
      const tasks = store.getCachedTasks();
      const settings = store.getSettings();
      const limit = settings.inboxTaskLimit ?? 25;
      const currentUserId = settings.currentUserId ?? null;
      const notifications = await asanaApi.fetchInboxNotifications(tasks, currentUserId, limit);
      return { notifications };
    } catch (err) {
      console.error('[ipc] Failed to fetch inbox notifications:', (err as Error).message);
      return { notifications: [], error: (err as Error).message };
    }
  });

  ipcMain.handle('inbox:get-archived-gids', () => {
    return store.getArchivedInboxGids();
  });

  ipcMain.handle('inbox:archive', (_, storyGid: string) => {
    if (!storyGid || typeof storyGid !== 'string') return;
    store.archiveInboxItem(storyGid);
  });

  ipcMain.handle('inbox:archive-all', (_, storyGids: string[]) => {
    if (!Array.isArray(storyGids)) return;
    store.archiveAllInboxItems(storyGids);
  });

  ipcMain.handle('inbox:mark-opened', () => {
    store.setLastInboxOpenedAt(Date.now());
    // Clear the dot immediately without waiting for next poll
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('asana:data-updated', { hasNewInboxActivity: false });
    }
  });

  ipcMain.handle('window:get-slide-direction', (): 'left' | 'right' => {
    const mainWin = getMainWindow();
    if (!mainWin || mainWin.isDestroyed()) return 'right';

    const winBounds = mainWin.getBounds();
    const display = screen.getDisplayMatching(winBounds);
    const screenBounds = display.workArea;

    const distToLeft = winBounds.x - screenBounds.x;
    const distToRight = (screenBounds.x + screenBounds.width) - (winBounds.x + winBounds.width);

    // If window is closer to the right edge, slide from left; otherwise from right
    return distToRight <= distToLeft ? 'left' : 'right';
  });

  // ── App ─────────────────────────────────────────────────────

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:export-csv', async (_, filename: string, csv: string) => {
    if (!filename || typeof filename !== 'string' || typeof csv !== 'string') return false;
    const result = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, csv, 'utf-8');
    return true;
  });

  // ── Window ──────────────────────────────────────────────────

  ipcMain.on('window:hide', () => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.hide();
    }
  });

  ipcMain.on('settings:close', () => {
    const settingsWin = getSettingsWindow();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.close();
    }
  });

  // ── Link Opening ───────────────────────────────────────────

  ipcMain.handle('app:open-url', (_, url: string) => {
    if (!url || typeof url !== 'string') return;
    const settings = store.getSettings();
    const openWith = settings.openLinksIn || 'default';

    if (openWith === 'asana-desktop') {
      // Asana desktop app uses asana:// protocol
      const asanaUrl = url.replace(/^https?:\/\/app\.asana\.com/, 'asana:/');
      shell.openExternal(asanaUrl).catch(() => {
        // Fallback to default browser if Asana app fails
        shell.openExternal(url).catch(() => {});
      });
    } else if (openWith === 'default') {
      shell.openExternal(url).catch(() => {});
    } else {
      // Specific browser bundle ID (e.g. com.google.Chrome)
      execFile('open', ['-b', openWith, url], (err) => {
        if (err) {
          // Fallback to default browser
          shell.openExternal(url).catch(() => {});
        }
      });
    }
  });

  // ── Link Preview ─────────────────────────────────────────

  const linkPreviewCache = new Map<string, LinkPreview>();

  ipcMain.handle('app:fetch-link-preview', async (_, url: string): Promise<LinkPreview> => {
    const empty: LinkPreview = { url, title: null, siteName: null };
    if (!url || typeof url !== 'string') return empty;

    // Return cached result if available
    const cached = linkPreviewCache.get(url);
    if (cached) return cached;

    try {
      // Validate URL
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return empty;

      // Fetch with 5s timeout — only need the head of the HTML for <title> and og:site_name
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Panoptisana Link Preview' },
        redirect: 'follow'
      });
      clearTimeout(timeout);

      if (!response.ok) {
        linkPreviewCache.set(url, empty);
        return empty;
      }

      // Read only the first 32KB — title and og tags are always in <head>
      const reader = response.body?.getReader();
      if (!reader) {
        linkPreviewCache.set(url, empty);
        return empty;
      }

      let html = '';
      const decoder = new TextDecoder();
      const maxBytes = 32768;

      while (html.length < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});

      const { title, siteName } = extractTitleFromHtml(html);
      const result: LinkPreview = { url, title, siteName };
      linkPreviewCache.set(url, result);
      return result;
    } catch {
      linkPreviewCache.set(url, empty);
      return empty;
    }
  });

  ipcMain.handle('app:detect-browsers', (): BrowserInfo[] => {
    const browsers: BrowserInfo[] = [];

    // Always include default browser option
    browsers.push({ id: 'default', name: 'Default Browser' });

    // Detect common macOS browsers
    const knownBrowsers = [
      { id: 'com.google.Chrome', name: 'Google Chrome', path: '/Applications/Google Chrome.app' },
      { id: 'com.apple.Safari', name: 'Safari', path: '/Applications/Safari.app' },
      { id: 'com.mozilla.firefox', name: 'Firefox', path: '/Applications/Firefox.app' },
      { id: 'company.thebrowser.Browser', name: 'Arc', path: '/Applications/Arc.app' },
      { id: 'com.brave.Browser', name: 'Brave', path: '/Applications/Brave Browser.app' },
      { id: 'com.microsoft.edgemac', name: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app' },
      { id: 'com.operasoftware.Opera', name: 'Opera', path: '/Applications/Opera.app' },
      { id: 'ai.perplexity.comet', name: 'Comet', path: '/Applications/Comet.app' }
    ];

    for (const browser of knownBrowsers) {
      if (fs.existsSync(browser.path)) {
        browsers.push({ id: browser.id, name: browser.name });
      }
    }

    // Detect Asana desktop app
    if (fs.existsSync('/Applications/Asana.app')) {
      browsers.push({ id: 'asana-desktop', name: 'Asana Desktop App' });
    }

    return browsers;
  });

  // ── Context Menu ──────────────────────────────────────────

  ipcMain.on('context-menu:item', (_, { type, name, gid }: ContextMenuItem) => {
    const excludeKey = type === 'task' ? 'excludedTaskPatterns' : 'excludedProjectPatterns';
    const pinKey = type === 'task' ? 'pinnedTaskGids' : 'pinnedProjectGids';

    // Check if item is currently pinned
    const settings = store.getSettings();
    const rawPinned = settings[pinKey];
    const pinnedList = Array.isArray(rawPinned) ? rawPinned as string[] : [];
    const isPinned = pinnedList.includes(gid);

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: isPinned ? 'Unpin' : 'Pin to Top',
        click: () => {
          const rawCurrent = store.getSettings()[pinKey];
          const current = Array.isArray(rawCurrent) ? rawCurrent as string[] : [];
          const updated = isPinned
            ? current.filter(g => g !== gid)
            : [...current, gid];
          store.setSettings({ [pinKey]: updated });
          broadcastSettingsToRenderer(store, getMainWindow);
        }
      },
      { type: 'separator' },
      {
        label: `Exclude "${name.length > 30 ? name.substring(0, 30) + '\u2026' : name}"`,
        click: () => {
          const currentSettings = store.getSettings() as Record<string, unknown>;
          const list = [...((currentSettings[excludeKey] as string[]) || []), name];
          store.setSettings({ [excludeKey]: list });
          // Notify renderer to re-apply filters instantly (no re-poll needed)
          broadcastSettingsToRenderer(store, getMainWindow);
        }
      },
      { type: 'separator' },
      {
        label: 'Copy GID',
        click: () => {
          clipboard.writeText(gid);
        }
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: getMainWindow() || undefined });
  });

  // ── Link Context Menu ──────────────────────────────────────

  ipcMain.on('context-menu:link', (_, url: string) => {
    if (!url || typeof url !== 'string') return;

    const settings = store.getSettings();
    const openWith = settings.openLinksIn || 'default';

    const openLink = () => {
      if (openWith === 'asana-desktop' && url.startsWith('https://app.asana.com')) {
        const asanaUrl = url.replace(/^https?:\/\/app\.asana\.com/, 'asana:/');
        shell.openExternal(asanaUrl).catch(() => {
          shell.openExternal(url).catch(() => {});
        });
      } else if (openWith === 'default') {
        shell.openExternal(url).catch(() => {});
      } else {
        execFile('open', ['-b', openWith, url], (err) => {
          if (err) shell.openExternal(url).catch(() => {});
        });
      }
    };

    const linkMenu = Menu.buildFromTemplate([
      { label: 'Open Link', click: openLink },
      { type: 'separator' },
      { label: 'Copy Link URL', click: () => clipboard.writeText(url) }
    ]);
    linkMenu.popup({ window: getMainWindow() || undefined });
  });
}
