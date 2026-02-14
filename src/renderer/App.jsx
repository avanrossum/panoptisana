import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import TaskList from './components/TaskList';
import ProjectList from './components/ProjectList';
import Icon from './components/Icon';
import { ICON_PATHS } from './icons';
import { applyTheme } from '../shared/applyTheme';
import { useThemeListener } from '../shared/useThemeListener';
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
  const [isPolling, setIsPolling] = useState(false);
  const [unfilteredTaskCount, setUnfilteredTaskCount] = useState(null);
  const [unfilteredProjectCount, setUnfilteredProjectCount] = useState(null);
  const [version, setVersion] = useState('');
  const [seenTimestamps, setSeenTimestamps] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [cachedUsers, setCachedUsers] = useState([]);
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [selectedProjectGid, setSelectedProjectGid] = useState('');
  const searchRef = useRef(null);

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const settings = await window.electronAPI.getSettings();

        applyTheme(settings);

        setIsConnected(!!settings.apiKeyVerified);

        // Load cached data
        const [cachedTasks, cachedProjects, seen, ver, users] = await Promise.all([
          window.electronAPI.getTasks(),
          window.electronAPI.getProjects(),
          window.electronAPI.getSeenTimestamps(),
          window.electronAPI.getVersion(),
          window.electronAPI.getUsers()
        ]);

        setTasks(cachedTasks || []);
        setProjects(cachedProjects || []);
        setSeenTimestamps(seen || {});
        setCachedUsers(users || []);

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
      setIsPolling(false);
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      if (data.tasks) setTasks(data.tasks);
      if (data.projects) setProjects(data.projects);
      if (data.unfilteredTaskCount != null) setUnfilteredTaskCount(data.unfilteredTaskCount);
      if (data.unfilteredProjectCount != null) setUnfilteredProjectCount(data.unfilteredProjectCount);
      setIsConnected(true);
    });

    const unsubPollStarted = window.electronAPI.onPollStarted(() => {
      setIsPolling(true);
    });

    return () => {
      unsubData();
      unsubPollStarted();
    };
  }, []);

  // ── Theme Events ────────────────────────────────────────────

  useThemeListener(window.electronAPI);

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

  // ── Derived Data ───────────────────────────────────────────

  // Build sorted project list from tasks for the project filter dropdown.
  // Uses projects referenced on tasks (not the Projects tab data) so the
  // dropdown only shows projects that actually have incomplete tasks.
  const taskProjects = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      for (const p of task.projects || []) {
        if (p.gid && p.name && !map.has(p.gid)) {
          map.set(p.gid, p.name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([gid, name]) => ({ gid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Count of tasks visible after project filter (before search/sort in TaskList)
  const visibleTaskCount = useMemo(() => {
    if (!selectedProjectGid) return tasks.length;
    return tasks.filter(t =>
      (t.projects || []).some(p => p.gid === selectedProjectGid)
    ).length;
  }, [tasks, selectedProjectGid]);

  // Count of projects visible after membership + search filters
  const visibleProjectCount = useMemo(() => {
    let result = projects;
    if (myProjectsOnly && currentUserId) {
      result = result.filter(p =>
        (p.members || []).some(m => m.gid === currentUserId)
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => {
        const name = (p.name || '').toLowerCase();
        const owner = (p.owner?.name || '').toLowerCase();
        return name.includes(q) || owner.includes(q);
      });
    }
    return result.length;
  }, [projects, myProjectsOnly, currentUserId, searchQuery]);

  // Clear project filter if the selected project no longer exists in task data
  useEffect(() => {
    if (selectedProjectGid && !taskProjects.some(p => p.gid === selectedProjectGid)) {
      setSelectedProjectGid('');
    }
  }, [taskProjects, selectedProjectGid]);

  // ── Handlers ────────────────────────────────────────────────

  const handleOpenSettings = useCallback(() => {
    window.electronAPI.openSettings();
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isPolling) return;
    try {
      setIsPolling(true);
      await window.electronAPI.refreshData();
    } catch (err) {
      setIsPolling(false);
      setError(err.message);
    }
  }, [isPolling]);

  const handleMarkSeen = useCallback(async (taskGid, modifiedAt) => {
    await window.electronAPI.setSeenTimestamp(taskGid, modifiedAt);
    setSeenTimestamps(prev => ({ ...prev, [taskGid]: modifiedAt }));
  }, []);

  const handleCompleteTask = useCallback((taskGid) => {
    setTasks(prev => prev.filter(t => t.gid !== taskGid));
  }, []);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="app-container">
      {/* Title Bar / Drag Region */}
      <div className="drag-region">
        <span className="app-title">Panoptisana</span>
        <div className="title-actions">
          <button
            className={`icon-btn ${isPolling ? 'spinning' : ''}`}
            onClick={handleRefresh}
            disabled={isPolling}
            title={isPolling ? 'Refreshing...' : 'Refresh'}
          >
            <Icon path={ICON_PATHS.refresh} size={16} />
          </button>
          <button className="icon-btn" onClick={handleOpenSettings} title="Settings">
            <Icon path={ICON_PATHS.settings} size={16} />
          </button>
          <button className="icon-btn" onClick={() => window.electronAPI.hideWindow()} title="Minimize to tray">
            <Icon path={ICON_PATHS.minimize} size={16} />
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
          <span>Connection issue — data may be stale.</span>
          <button className="error-banner-retry" onClick={handleRefresh} disabled={isPolling}>
            {isPolling ? 'Retrying...' : 'Retry'}
          </button>
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
          <span className="sort-label">Project:</span>
          <select
            className="sort-select project-filter-select"
            value={selectedProjectGid}
            onChange={(e) => setSelectedProjectGid(e.target.value)}
          >
            <option value="">All Projects</option>
            {taskProjects.map(p => (
              <option key={p.gid} value={p.gid}>{p.name}</option>
            ))}
          </select>
          <span className="sort-divider" />
          <span className="sort-label">Sort:</span>
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
            selectedProjectGid={selectedProjectGid}
            seenTimestamps={seenTimestamps}
            onMarkSeen={handleMarkSeen}
            onComplete={handleCompleteTask}
            currentUserId={currentUserId}
            cachedUsers={cachedUsers}
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
          <span className={`status-dot ${isPolling ? 'polling' : isConnected ? 'connected' : 'disconnected'}`} />
          <span>
            {!isConnected
              ? 'Not connected'
              : isPolling
                ? 'Refreshing...'
                : activeTab === 'tasks'
                  ? `${visibleTaskCount}${unfilteredTaskCount != null && unfilteredTaskCount !== visibleTaskCount ? ` of ${unfilteredTaskCount}` : ''} tasks`
                  : `${visibleProjectCount}${unfilteredProjectCount != null && unfilteredProjectCount !== visibleProjectCount ? ` of ${unfilteredProjectCount}` : ''} projects`
            }
          </span>
        </div>
        <span>v{version}</span>
      </div>
    </div>
  );
}
