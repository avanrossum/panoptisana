const { ipcMain, app, Menu, shell } = require('electron');
const { execSync } = require('child_process');
const fs = require('fs');

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLER REGISTRATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Register all IPC handlers
 * @param {Object} deps - { store, asanaApi, getMainWindow, getSettingsWindow }
 */
function registerIpcHandlers({ store, asanaApi, getMainWindow, getSettingsWindow }) {

  // Helper: return settings with apiKey masked
  function getMaskedSettings() {
    const settings = store.getSettings();
    return {
      ...settings,
      apiKey: settings.apiKey ? '••••••••' : null
    };
  }

  // ── Store: Settings ─────────────────────────────────────────

  ipcMain.handle('store:get-settings', () => {
    return getMaskedSettings();
  });

  ipcMain.handle('store:set-settings', (_, updates) => {
    if (!updates || typeof updates !== 'object') return;

    // Don't allow setting apiKey through this handler
    delete updates.apiKey;
    delete updates.apiKeyVerified;

    store.setSettings(updates);

    // If poll interval changed, restart polling
    if ('pollIntervalMinutes' in updates) {
      asanaApi.restartPolling(updates.pollIntervalMinutes);
    }

    // Always return masked settings
    return getMaskedSettings();
  });

  // ── Store: Comment Tracking ─────────────────────────────────

  ipcMain.handle('store:get-seen-timestamps', () => {
    return store.getSeenTimestamps();
  });

  ipcMain.handle('store:set-seen-timestamp', (_, taskGid, timestamp) => {
    if (typeof taskGid !== 'string' || typeof timestamp !== 'string') return;
    store.setSeenTimestamp(taskGid, timestamp);
  });

  // ── Asana: API Key ──────────────────────────────────────────

  ipcMain.handle('asana:verify-api-key', async (_, key) => {
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
        console.error('[ipc] Failed to fetch users after key verify:', err.message);
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

  ipcMain.handle('asana:get-task-comments', async (_, taskGid) => {
    if (!taskGid || typeof taskGid !== 'string') return [];
    try {
      return await asanaApi.getTaskComments(taskGid);
    } catch (err) {
      console.error('[ipc] Failed to fetch comments:', err.message);
      return [];
    }
  });

  ipcMain.handle('asana:complete-task', async (_, taskGid) => {
    if (!taskGid || typeof taskGid !== 'string') return { success: false };
    try {
      await asanaApi.completeTask(taskGid);
      return { success: true };
    } catch (err) {
      console.error('[ipc] Failed to complete task:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('asana:refresh', async () => {
    await asanaApi.refresh();
  });

  // ── App ─────────────────────────────────────────────────────

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
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

  ipcMain.handle('app:open-url', (_, url) => {
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
      try {
        execSync(`open -b "${openWith}" "${url}"`);
      } catch (_) {
        // Fallback to default browser
        shell.openExternal(url).catch(() => {});
      }
    }
  });

  ipcMain.handle('app:detect-browsers', () => {
    const browsers = [];

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

  ipcMain.on('context-menu:item', (event, { type, name, gid }) => {
    const excludeKey = type === 'task' ? 'excludedTaskPatterns' : 'excludedProjectPatterns';
    const template = [
      {
        label: `Exclude "${name.length > 30 ? name.substring(0, 30) + '…' : name}"`,
        click: () => {
          const settings = store.getSettings();
          const list = [...(settings[excludeKey] || []), name];
          store.setSettings({ [excludeKey]: list });
          // Re-poll to apply the new exclusion immediately
          asanaApi.refresh();
        }
      },
      { type: 'separator' },
      {
        label: 'Copy GID',
        click: () => {
          const { clipboard } = require('electron');
          clipboard.writeText(gid);
        }
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: getMainWindow() });
  });
}

module.exports = { registerIpcHandlers };
