import { useState, useEffect, useCallback } from 'react';
import { applyTheme } from '../shared/applyTheme';
import { useThemeListener } from '../shared/useThemeListener';
import FilterListEditor from './components/FilterListEditor';

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
  const [browsers, setBrowsers] = useState([]);
  const [version, setVersion] = useState('');

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const s = await window.settingsAPI.getSettings();
      setSettings(s);

      applyTheme(s);

      const u = await window.settingsAPI.getUsers();
      setUsers(u || []);

      const b = await window.settingsAPI.detectBrowsers();
      setBrowsers(b || []);

      // Auto-default to Asana desktop app if installed and no preference set yet
      if (!s.openLinksIn || s.openLinksIn === 'default') {
        const hasAsanaApp = (b || []).some(br => br.id === 'asana-desktop');
        if (hasAsanaApp) {
          await window.settingsAPI.setSettings({ openLinksIn: 'asana-desktop' });
          setSettings(prev => ({ ...prev, openLinksIn: 'asana-desktop' }));
        }
      }

      const v = await window.settingsAPI.getVersion();
      setVersion(v);
    }
    init();
  }, []);

  // ── Theme Events ────────────────────────────────────────────

  useThemeListener(window.settingsAPI);

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

  // ── Filter List Helpers (shared add/remove for all 4 lists) ─

  const addFilterItem = useCallback((settingsKey, value) => {
    if (!value.trim()) return;
    setSettings(prev => {
      const list = [...(prev[settingsKey] || []), value.trim()];
      window.settingsAPI.setSettings({ [settingsKey]: list });
      return { ...prev, [settingsKey]: list };
    });
  }, []);

  const removeFilterItem = useCallback((settingsKey, index) => {
    setSettings(prev => {
      const list = [...(prev[settingsKey] || [])];
      list.splice(index, 1);
      window.settingsAPI.setSettings({ [settingsKey]: list });
      return { ...prev, [settingsKey]: list };
    });
  }, []);

  // ── Polling ─────────────────────────────────────────────────

  const handlePollIntervalChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (val && val >= 1 && val <= 60) {
      updateSetting('pollIntervalMinutes', val);
    }
  }, [updateSetting]);

  // ── Task Fetch Limit ───────────────────────────────────────

  const handleMaxSearchPagesChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (val && val >= 1 && val <= 100) {
      updateSetting('maxSearchPages', val);
    }
  }, [updateSetting]);

  // ── Hotkey ──────────────────────────────────────────────────

  const handleHotkeyChange = useCallback((e) => {
    updateSetting('globalHotkey', e.target.value);
    // Re-register the global hotkey in the main process
    window.settingsAPI.reRegisterHotkey();
  }, [updateSetting]);

  const handleOpenLinksInChange = useCallback((e) => {
    updateSetting('openLinksIn', e.target.value);
  }, [updateSetting]);

  if (!settings) return null;

  const isApiKeySet = settings.apiKeyVerified;
  const currentTheme = document.documentElement.dataset.theme;

  return (
    <div className="settings-container">
      <div className="settings-drag-region">
        <span>Settings</span>
        <button className="settings-close-btn" onClick={() => window.settingsAPI.closeSettings()} title="Close">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
          </svg>
        </button>
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

          <div className="form-row">
            <span className="form-label">Task Fetch Limit</span>
            <div className="polling-row">
              <input
                className="polling-input"
                type="number"
                min="1"
                max="100"
                value={settings.maxSearchPages || 20}
                onChange={handleMaxSearchPagesChange}
              />
              <span className="polling-unit">pages (100 tasks each)</span>
            </div>
          </div>
          {(settings.maxSearchPages || 20) > 30 && (
            <div className="api-key-hint" style={{ marginTop: '-4px' }}>
              High page limits increase API calls per poll. Each page is one Asana API request.
            </div>
          )}

          <div className="form-row">
            <span className="form-label">Open Asana links in</span>
            <select
              className="form-input"
              value={settings.openLinksIn || 'default'}
              onChange={handleOpenLinksInChange}
            >
              {browsers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
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

        {/* ── Inclusion Lists ── */}
        <div className={`settings-section ${!isApiKeySet ? 'settings-disabled' : ''}`}>
          <div className="settings-section-title">Inclusion Filters</div>
          <div className="filter-hint">When set, only items matching at least one pattern will be shown.</div>

          <FilterListEditor
            label="Included Tasks (name pattern)"
            placeholder="Partial name match..."
            items={settings.includedTaskPatterns || []}
            onAdd={(value) => addFilterItem('includedTaskPatterns', value)}
            onRemove={(index) => removeFilterItem('includedTaskPatterns', index)}
          />

          <FilterListEditor
            label="Included Projects (name pattern)"
            placeholder="Partial name match..."
            items={settings.includedProjectPatterns || []}
            onAdd={(value) => addFilterItem('includedProjectPatterns', value)}
            onRemove={(index) => removeFilterItem('includedProjectPatterns', index)}
            style={{ marginTop: '12px' }}
          />
        </div>

        {/* ── Exclusion Lists ── */}
        <div className={`settings-section ${!isApiKeySet ? 'settings-disabled' : ''}`}>
          <div className="settings-section-title">Exclusion Lists</div>

          <FilterListEditor
            label="Excluded Tasks (GID or name pattern)"
            placeholder="GID or partial name match..."
            items={settings.excludedTaskPatterns || []}
            onAdd={(value) => addFilterItem('excludedTaskPatterns', value)}
            onRemove={(index) => removeFilterItem('excludedTaskPatterns', index)}
          />

          <FilterListEditor
            label="Excluded Projects (GID or name pattern)"
            placeholder="GID or partial name match..."
            items={settings.excludedProjectPatterns || []}
            onAdd={(value) => addFilterItem('excludedProjectPatterns', value)}
            onRemove={(index) => removeFilterItem('excludedProjectPatterns', index)}
            style={{ marginTop: '12px' }}
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="settings-footer">
        <div className="settings-footer-info">
          Panoptisana v{version} by MipYip
        </div>
        <div className="settings-footer-actions">
          <button onClick={() => window.settingsAPI.quit()}>Quit Panoptisana</button>
          <button onClick={() => window.settingsAPI.checkForUpdates()}>Check for Updates</button>
          <button className="btn-primary" onClick={() => window.settingsAPI.closeSettings()}>Close</button>
        </div>
      </div>
    </div>
  );
}
