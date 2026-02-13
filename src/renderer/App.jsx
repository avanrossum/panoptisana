import { useState, useEffect, useCallback, useRef } from 'react';
import TaskList from './components/TaskList';
import ProjectList from './components/ProjectList';
import Icon from './components/Icon';
import { ICON_PATHS } from './icons';
import './styles/components.css';

// ══════════════════════════════════════════════════════════════════════════════
// APP - Main renderer root component
// ══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('modified');
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [version, setVersion] = useState('');
  const [seenTimestamps, setSeenTimestamps] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const searchRef = useRef(null);

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const settings = await window.electronAPI.getSettings();

        // Apply theme
        const theme = settings.theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : settings.theme;
        document.documentElement.dataset.theme = theme || 'dark';
        document.documentElement.dataset.accent = settings.accentColor || 'blue';

        setIsConnected(!!settings.apiKeyVerified);

        // Load cached data
        const [cachedTasks, cachedProjects, seen, ver] = await Promise.all([
          window.electronAPI.getTasks(),
          window.electronAPI.getProjects(),
          window.electronAPI.getSeenTimestamps(),
          window.electronAPI.getVersion()
        ]);

        setTasks(cachedTasks || []);
        setProjects(cachedProjects || []);
        setSeenTimestamps(seen || {});

        // Set current user ID for comment highlight suppression & project filter
        if (settings.currentUserId) {
          setCurrentUserId(settings.currentUserId);
        }
        setVersion(ver);
      } catch (err) {
        console.error('Init failed:', err);
      }
    }
    init();
  }, []);

  // ── Data Updates ────────────────────────────────────────────

  useEffect(() => {
    const unsubData = window.electronAPI.onDataUpdate((data) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      if (data.tasks) setTasks(data.tasks);
      if (data.projects) setProjects(data.projects);
      setIsConnected(true);
    });

    return () => unsubData();
  }, []);

  // ── Theme Events ────────────────────────────────────────────

  useEffect(() => {
    const unsubTheme = window.electronAPI.onThemeChanged((theme) => {
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.dataset.theme = theme;
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-transitioning');
      });
    });

    const unsubAccent = window.electronAPI.onAccentChanged((accent) => {
      document.documentElement.dataset.accent = accent;
    });

    return () => {
      unsubTheme();
      unsubAccent();
    };
  }, []);

  // ── Keyboard Shortcut ───────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      // Cmd/Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Handlers ────────────────────────────────────────────────

  const handleOpenSettings = useCallback(() => {
    window.electronAPI.openSettings();
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      await window.electronAPI.refreshData();
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleMarkSeen = useCallback(async (taskGid, modifiedAt) => {
    await window.electronAPI.setSeenTimestamp(taskGid, modifiedAt);
    setSeenTimestamps(prev => ({ ...prev, [taskGid]: modifiedAt }));
  }, []);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="app-container">
      {/* Title Bar / Drag Region */}
      <div className="drag-region">
        <span className="app-title">Panorasana</span>
        <div className="title-actions">
          <button className="icon-btn" onClick={handleRefresh} title="Refresh">
            <Icon path={ICON_PATHS.refresh} size={16} />
          </button>
          <button className="icon-btn" onClick={handleOpenSettings} title="Settings">
            <Icon path={ICON_PATHS.settings} size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <Icon path={ICON_PATHS.warning} size={14} />
          <span>{error}</span>
          <button className="error-banner-dismiss" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <div className="search-wrapper">
          <span className="search-icon">
            <Icon path={ICON_PATHS.search} size={14} />
          </span>
          <input
            ref={searchRef}
            className="search-input"
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sort / Filter Bar */}
      {activeTab === 'tasks' && (
        <div className="sort-bar">
          <span className="sort-label">Sort by:</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="modified">Last Modified</option>
            <option value="due">Due Date</option>
            <option value="name">Name</option>
            <option value="assignee">Assignee</option>
            <option value="created">Created</option>
          </select>
        </div>
      )}
      {activeTab === 'projects' && currentUserId && (
        <div className="filter-bar">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={myProjectsOnly}
              onChange={(e) => setMyProjectsOnly(e.target.checked)}
            />
            <span>Only my projects</span>
          </label>
        </div>
      )}

      {/* Content */}
      <div className="list-container">
        {!isConnected ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icon path={ICON_PATHS.key} size={32} />
            </div>
            <div className="empty-state-title">No API Key Configured</div>
            <div className="empty-state-text">Add your Asana API key in Settings to get started.</div>
            <button className="empty-state-btn" onClick={handleOpenSettings}>
              Open Settings
            </button>
          </div>
        ) : activeTab === 'tasks' ? (
          <TaskList
            tasks={tasks}
            searchQuery={searchQuery}
            sortBy={sortBy}
            seenTimestamps={seenTimestamps}
            onMarkSeen={handleMarkSeen}
            currentUserId={currentUserId}
          />
        ) : (
          <ProjectList
            projects={projects}
            searchQuery={searchQuery}
            myProjectsOnly={myProjectsOnly}
            currentUserId={currentUserId}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-left">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span>
            {isConnected
              ? `${activeTab === 'tasks' ? tasks.length : projects.length} ${activeTab}`
              : 'Not connected'}
          </span>
        </div>
        <span>v{version}</span>
      </div>
    </div>
  );
}
