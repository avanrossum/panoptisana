const { ipcMain, app } = require('electron');

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLER REGISTRATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Register all IPC handlers
 * @param {Object} deps - { store, asanaApi, getMainWindow, getSettingsWindow }
 */
function registerIpcHandlers({ store, asanaApi, getMainWindow, getSettingsWindow }) {

  // ── Store: Settings ─────────────────────────────────────────

  ipcMain.handle('store:get-settings', () => {
    const settings = store.getSettings();
    // Never send the raw encrypted API key to renderer
    return {
      ...settings,
      apiKey: settings.apiKey ? '••••••••' : null
    };
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

    return store.getSettings();
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
    console.log('[ipc] Verifying API key, length:', trimmedKey.length, 'starts with:', trimmedKey.substring(0, 2));

    // Temporarily set the key for verification
    const encrypted = store.encryptApiKey(trimmedKey);
    store.setSettings({ apiKey: encrypted });

    // Verify round-trip encryption
    const decrypted = store.decryptApiKey(encrypted);
    console.log('[ipc] Decrypt round-trip OK:', decrypted === trimmedKey, 'decrypted length:', decrypted?.length);

    const result = await asanaApi.verifyApiKey();

    if (result.valid) {
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
      asanaApi.startPolling(settings.pollIntervalMinutes || 5, (data) => {
        const mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('asana:data-updated', data);
        }
      });

      return { valid: true, user: result.user };
    } else {
      // Key failed - remove it
      store.setSettings({ apiKey: null, apiKeyVerified: false });
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

  ipcMain.handle('asana:refresh', async () => {
    await asanaApi._poll();
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

  ipcMain.on('window:open-settings', () => {
    // Handled in main.js via openSettings()
  });

  ipcMain.on('settings:close', () => {
    const settingsWin = getSettingsWindow();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.close();
    }
  });
}

module.exports = { registerIpcHandlers };
