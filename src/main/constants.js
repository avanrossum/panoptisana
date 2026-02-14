// ══════════════════════════════════════════════════════════════════════════════
// APPLICATION CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const THEME_BG_COLORS = {
  dark: '#1a1d23',
  light: '#f5f5f7'
};

const WINDOW_SIZE = {
  MIN_WIDTH: 380,
  MIN_HEIGHT: 500,
  DEFAULT_WIDTH: 420,
  DEFAULT_HEIGHT: 700,
  MAX_WIDTH: 600,
  MAX_HEIGHT: 10000
};

const SETTINGS_WINDOW_SIZE = {
  WIDTH: 520,
  HEIGHT: 640
};

const UPDATE_DIALOG_SIZE = {
  WIDTH: 460,
  HEIGHT: 400
};

const TIMING = {
  SAVE_DEBOUNCE_MS: 500,
  UPDATE_CHECK_INTERVAL_MS: 4 * 60 * 60 * 1000, // 4 hours
  INITIAL_UPDATE_DELAY_MS: 3000,
  DEFAULT_POLL_INTERVAL_MINUTES: 5
};

const DEFAULT_SETTINGS = {
  theme: 'system',
  accentColor: 'blue',
  pollIntervalMinutes: 5,
  globalHotkey: 'Ctrl+Shift+A',
  showOnlyMyTasks: false,
  currentUserId: null,
  selectedUserIds: [],
  excludedTaskGids: [],
  excludedTaskPatterns: [],
  excludedProjectGids: [],
  excludedProjectPatterns: [],
  includedTaskPatterns: [],
  includedProjectPatterns: [],
  openLinksIn: 'default',
  apiKey: null,
  apiKeyVerified: false,
  windowBounds: null
};

module.exports = {
  THEME_BG_COLORS,
  WINDOW_SIZE,
  SETTINGS_WINDOW_SIZE,
  UPDATE_DIALOG_SIZE,
  TIMING,
  DEFAULT_SETTINGS
};
