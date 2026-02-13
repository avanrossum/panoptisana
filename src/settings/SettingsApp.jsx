import { useState, useEffect, useCallback } from 'react';

const ACCENT_COLORS = [
  { name: 'blue', dark: '#3b82f6', light: '#2563eb' },
  { name: 'purple', dark: '#8b5cf6', light: '#7c3aed' },
  { name: 'pink', dark: '#ec4899', light: '#db2777' },
  { name: 'red', dark: '#f43f5e', light: '#e11d48' },
  { name: 'orange', dark: '#f97316', light: '#ea580c' },
  { name: 'amber', dark: '#f59e0b', light: '#d97706' },
  { name: 'green', dark: '#10b981', light: '#059669' }
];

export default function SettingsApp() {
  const [settings, setSettings] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [users, setUsers] = useState([]);
  const [version, setVersion] = useState('');

  // Exclusion inputs
  const [taskExclusionInput, setTaskExclusionInput] = useState('');
  const [projectExclusionInput, setProjectExclusionInput] = useState('');

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const s = await window.settingsAPI.getSettings();
      setSettings(s);

      const theme = s.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : s.theme;
      document.documentElement.dataset.theme = theme || 'dark';
      document.documentElement.dataset.accent = s.accentColor || 'blue';

      const u = await window.settingsAPI.getUsers();
      setUsers(u || []);

      const v = await window.settingsAPI.getVersion();
      setVersion(v);
    }
    init();
  }, []);

  // ── Theme Events ────────────────────────────────────────────

  useEffect(() => {
    const unsubTheme = window.settingsAPI.onThemeChanged((theme) => {
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.dataset.theme = theme;
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-transitioning');
      });
    });

    const unsubAccent = window.settingsAPI.onAccentChanged((accent) => {
      document.documentElement.dataset.accent = accent;
    });

    return () => { unsubTheme(); unsubAccent(); };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────

  const updateSetting = useCallback(async (key, value) => {
    const update = { [key]: value };
    await window.settingsAPI.setSettings(update);
    setSettings(prev => ({ ...prev, ...update }));
  }, []);

  // ── API Key ─────────────────────────────────────────────────

  const handleVerifyKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;
    setVerifying(true);
    setApiKeyStatus(null);
    try {
      const result = await window.settingsAPI.verifyApiKey(apiKeyInput.trim());
      if (result.valid) {
        setApiKeyStatus({ valid: true, message: `Verified as ${result.user?.name || 'user'}` });
        setApiKeyInput('');
        setSettings(prev => ({ ...prev, apiKey: '••••••••', apiKeyVerified: true }));
        // Refresh users
        const u = await window.settingsAPI.getUsers();
        setUsers(u || []);
      } else {
        setApiKeyStatus({ valid: false, message: result.error || 'Invalid key' });
      }
    } catch (err) {
      setApiKeyStatus({ valid: false, message: err.message });
    }
    setVerifying(false);
  }, [apiKeyInput]);

  const handleRemoveKey = useCallback(async () => {
    await window.settingsAPI.removeApiKey();
    setSettings(prev => ({ ...prev, apiKey: null, apiKeyVerified: false }));
    setApiKeyStatus(null);
    setUsers([]);
  }, []);

  // ── Theme ───────────────────────────────────────────────────

  const handleThemeChange = useCallback((theme) => {
    window.settingsAPI.applyTheme(theme);
    updateSetting('theme', theme);
  }, [updateSetting]);

  const handleAccentChange = useCallback((accent) => {
    window.settingsAPI.applyAccent(accent);
    updateSetting('accentColor', accent);
  }, [updateSetting]);

  // ── User Selection ──────────────────────────────────────────

  const handleCurrentUserChange = useCallback((e) => {
    updateSetting('currentUserId', e.target.value || null);
  }, [updateSetting]);

  const handleShowOnlyMyTasks = useCallback((e) => {
    updateSetting('showOnlyMyTasks', e.target.checked);
  }, [updateSetting]);

  const handleToggleUser = useCallback((userId) => {
    setSettings(prev => {
      const selected = prev.selectedUserIds || [];
      const updated = selected.includes(userId)
        ? selected.filter(id => id !== userId)
        : [...selected, userId];
      window.settingsAPI.setSettings({ selectedUserIds: updated });
      return { ...prev, selectedUserIds: updated };
    });
  }, []);

  // ── Exclusions ──────────────────────────────────────────────

  const addExclusion = useCallback((type, value) => {
    if (!value.trim()) return;
    const key = type === 'task' ? 'excludedTaskPatterns' : 'excludedProjectPatterns';
    setSettings(prev => {
      const list = [...(prev[key] || []), value.trim()];
      window.settingsAPI.setSettings({ [key]: list });
      return { ...prev, [key]: list };
    });
  }, []);

  const removeExclusion = useCallback((type, index) => {
    const key = type === 'task' ? 'excludedTaskPatterns' : 'excludedProjectPatterns';
    setSettings(prev => {
      const list = [...(prev[key] || [])];
      list.splice(index, 1);
      window.settingsAPI.setSettings({ [key]: list });
      return { ...prev, [key]: list };
    });
  }, []);

  // ── Polling ─────────────────────────────────────────────────

  const handlePollIntervalChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (val && val >= 1 && val <= 60) {
      updateSetting('pollIntervalMinutes', val);
    }
  }, [updateSetting]);

  // ── Hotkey ──────────────────────────────────────────────────

  const handleHotkeyChange = useCallback((e) => {
    updateSetting('globalHotkey', e.target.value);
  }, [updateSetting]);

  if (!settings) return null;

  const isApiKeySet = settings.apiKeyVerified;
  const currentTheme = document.documentElement.dataset.theme;

  return (
    <div className="settings-container">
      <div className="settings-drag-region">
        <span>Settings</span>
      </div>

      <div className="settings-content">
        {/* ── API Key ── */}
        <div className="settings-section">
          <div className="settings-section-title">Asana Personal Access Token</div>
          {isApiKeySet ? (
            <div>
              <div className="form-row">
                <span className="form-label" style={{ color: 'var(--success)' }}>API key verified</span>
                <button className="btn-danger" onClick={handleRemoveKey}>Remove Key</button>
              </div>
            </div>
          ) : (
            <div className="form-row stacked">
              <div className="api-key-row">
                <input
                  className="api-key-input"
                  type="password"
                  placeholder="Enter your Asana Personal Access Token"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyKey()}
                />
                <button className="btn-primary" onClick={handleVerifyKey} disabled={verifying || !apiKeyInput.trim()}>
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
              {apiKeyStatus && (
                <div className={`api-key-status ${apiKeyStatus.valid ? 'valid' : 'invalid'}`}>
                  {apiKeyStatus.message}
                </div>
              )}
              <div className="api-key-hint">
                Not an app secret.{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); window.open('https://app.asana.com/0/my-apps', '_blank'); }}>
                  Create a Personal Access Token
                </a>
                {' '}&rarr; starts with 1/
              </div>
            </div>
          )}
        </div>

        {/* ── Theme ── */}
        <div className="settings-section">
          <div className="settings-section-title">Appearance</div>
          <div className="form-row">
            <span className="form-label">Theme</span>
            <div className="theme-options">
              {['dark', 'light', 'system'].map(t => (
                <button
                  key={t}
                  className={`theme-option ${settings.theme === t ? 'active' : ''}`}
                  onClick={() => handleThemeChange(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <span className="form-label">Accent Color</span>
            <div className="accent-colors">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.name}
                  className={`accent-swatch ${settings.accentColor === c.name ? 'active' : ''}`}
                  style={{ background: currentTheme === 'dark' ? c.dark : c.light }}
                  onClick={() => handleAccentChange(c.name)}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── General ── */}
        <div className={`settings-section ${!isApiKeySet ? 'settings-disabled' : ''}`}>
          <div className="settings-section-title">General</div>

          <div className="form-row">
            <span className="form-label">Global Hotkey</span>
            <input
              className="hotkey-input"
              type="text"
              value={settings.globalHotkey || 'Ctrl+Shift+A'}
              onChange={handleHotkeyChange}
            />
          </div>

          <div className="form-row">
            <span className="form-label">Polling Interval</span>
            <div className="polling-row">
              <input
                className="polling-input"
                type="number"
                min="1"
                max="60"
                value={settings.pollIntervalMinutes || 5}
                onChange={handlePollIntervalChange}
              />
              <span className="polling-unit">minutes</span>
            </div>
          </div>
        </div>

        {/* ── User Selection ── */}
        <div className={`settings-section ${!isApiKeySet ? 'settings-disabled' : ''}`}>
          <div className="settings-section-title">User Settings</div>

          <div className="form-row">
            <span className="form-label">I am:</span>
            <select
              className="form-input"
              value={settings.currentUserId || ''}
              onChange={handleCurrentUserChange}
            >
              <option value="">Select user...</option>
              {users.map(u => (
                <option key={u.gid} value={u.gid}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="checkbox-row">
            <input
              type="checkbox"
              id="showOnlyMyTasks"
              checked={settings.showOnlyMyTasks || false}
              onChange={handleShowOnlyMyTasks}
            />
            <label htmlFor="showOnlyMyTasks">Show only my tasks</label>
          </div>

          {!settings.showOnlyMyTasks && (
            <div>
              <div className="form-label" style={{ marginBottom: '4px' }}>Show tasks for:</div>
              <div className="user-list">
                {users.map(u => (
                  <div key={u.gid} className="user-list-item" onClick={() => handleToggleUser(u.gid)}>
                    <input
                      type="checkbox"
                      checked={(settings.selectedUserIds || []).includes(u.gid)}
                      readOnly
                    />
                    <span>{u.name}</span>
                  </div>
                ))}
                {users.length === 0 && (
                  <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    No users loaded. Verify API key first.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Exclusion Lists ── */}
        <div className={`settings-section ${!isApiKeySet ? 'settings-disabled' : ''}`}>
          <div className="settings-section-title">Exclusion Lists</div>

          <div className="form-label">Excluded Tasks (GID or name pattern)</div>
          <div className="exclusion-list">
            <div className="exclusion-add-row">
              <input
                type="text"
                placeholder="GID or partial name match..."
                value={taskExclusionInput}
                onChange={(e) => setTaskExclusionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addExclusion('task', taskExclusionInput);
                    setTaskExclusionInput('');
                  }
                }}
              />
              <button onClick={() => {
                addExclusion('task', taskExclusionInput);
                setTaskExclusionInput('');
              }}>+ Add</button>
            </div>
            {(settings.excludedTaskPatterns || []).length > 0 && (
              <div className="exclusion-items">
                {(settings.excludedTaskPatterns || []).map((item, i) => (
                  <div key={i} className="exclusion-item">
                    <span className="exclusion-item-text">{item}</span>
                    <button className="exclusion-delete-btn" onClick={() => removeExclusion('task', i)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-label" style={{ marginTop: '12px' }}>Excluded Projects (GID or name pattern)</div>
          <div className="exclusion-list">
            <div className="exclusion-add-row">
              <input
                type="text"
                placeholder="GID or partial name match..."
                value={projectExclusionInput}
                onChange={(e) => setProjectExclusionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addExclusion('project', projectExclusionInput);
                    setProjectExclusionInput('');
                  }
                }}
              />
              <button onClick={() => {
                addExclusion('project', projectExclusionInput);
                setProjectExclusionInput('');
              }}>+ Add</button>
            </div>
            {(settings.excludedProjectPatterns || []).length > 0 && (
              <div className="exclusion-items">
                {(settings.excludedProjectPatterns || []).map((item, i) => (
                  <div key={i} className="exclusion-item">
                    <span className="exclusion-item-text">{item}</span>
                    <button className="exclusion-delete-btn" onClick={() => removeExclusion('project', i)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="settings-footer">
        <div className="settings-footer-info">
          Panorasana v{version} by MipYip
        </div>
        <div className="settings-footer-actions">
          <button onClick={() => window.settingsAPI.quit()}>Quit Panorasana</button>
          <button onClick={() => window.settingsAPI.checkForUpdates()}>Check for Updates</button>
          <button className="btn-primary" onClick={() => window.settingsAPI.closeSettings()}>Close</button>
        </div>
      </div>
    </div>
  );
}
