import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import TaskList from './components/TaskList';
import ProjectList from './components/ProjectList';
import InboxDrawer from './components/InboxDrawer';
import ProjectDetailPanel from './components/ProjectDetailPanel';
import TaskDetailPanel from './components/TaskDetailPanel';
import SectionFilterPopover from './components/SectionFilterPopover';
import ProjectFilterPopover from './components/ProjectFilterPopover';
import Icon from './components/Icon';
import { ICON_PATHS } from './icons';
import { applyTheme } from '../shared/applyTheme';
import { useThemeListener } from '../shared/useThemeListener';
import { applyItemFilters } from '../shared/filters';
import './styles/components.css';
import type { AsanaTask, AsanaProject, AsanaUser, SortBy, PollDataPacket, MaskedSettings, Settings } from '../shared/types';

// ══════════════════════════════════════════════════════════════════════════════
// APP - Main renderer root component
// ══════════════════════════════════════════════════════════════════════════════

type TabId = 'tasks' | 'projects';

/** Filter-relevant fields from Settings, used to re-filter cached data client-side */
interface FilterSettings {
  excludedTaskGids: string[];
  excludedTaskPatterns: string[];
  excludedProjectGids: string[];
  excludedProjectPatterns: string[];
  includedTaskPatterns: string[];
  includedProjectPatterns: string[];
  pinnedTaskGids: string[];
  pinnedProjectGids: string[];
}

const EMPTY_FILTER_SETTINGS: FilterSettings = {
  excludedTaskGids: [],
  excludedTaskPatterns: [],
  excludedProjectGids: [],
  excludedProjectPatterns: [],
  includedTaskPatterns: [],
  includedProjectPatterns: [],
  pinnedTaskGids: [],
  pinnedProjectGids: [],
};

/** Extract filter-relevant fields from full settings */
function extractFilterSettings(settings: MaskedSettings | Settings): FilterSettings {
  return {
    excludedTaskGids: settings.excludedTaskGids || [],
    excludedTaskPatterns: settings.excludedTaskPatterns || [],
    excludedProjectGids: settings.excludedProjectGids || [],
    excludedProjectPatterns: settings.excludedProjectPatterns || [],
    includedTaskPatterns: settings.includedTaskPatterns || [],
    includedProjectPatterns: settings.includedProjectPatterns || [],
    pinnedTaskGids: settings.pinnedTaskGids || [],
    pinnedProjectGids: settings.pinnedProjectGids || [],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('modified');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [unfilteredTaskCount, setUnfilteredTaskCount] = useState<number | null>(null);
  const [unfilteredProjectCount, setUnfilteredProjectCount] = useState<number | null>(null);
  const [version, setVersion] = useState('');
  const [seenTimestamps, setSeenTimestamps] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cachedUsers, setCachedUsers] = useState<AsanaUser[]>([]);
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [selectedProjectGids, setSelectedProjectGids] = useState<Set<string> | null>(null);
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(EMPTY_FILTER_SETTINGS);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxSlideDirection, setInboxSlideDirection] = useState<'left' | 'right'>('right');
  const [hasNewInboxActivity, setHasNewInboxActivity] = useState(false);
  const [workspaceGid, setWorkspaceGid] = useState<string | null>(null);
  const [userMembershipMap, setUserMembershipMap] = useState<Record<string, string>>({});
  const [taskDetailStack, setTaskDetailStack] = useState<string[]>([]);
  const [projectDetailStack, setProjectDetailStack] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<string> | null>(null);
  const [sectionFilterOpen, setSectionFilterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const settings = await window.electronAPI.getSettings();

        applyTheme(settings);

        setIsConnected(!!settings.apiKeyVerified);
        setFilterSettings(extractFilterSettings(settings));

        // Load cached data
        const [cachedTasks, cachedProjects, seen, ver, users, membershipMap] = await Promise.all([
          window.electronAPI.getTasks(),
          window.electronAPI.getProjects(),
          window.electronAPI.getSeenTimestamps(),
          window.electronAPI.getVersion(),
          window.electronAPI.getUsers(),
          window.electronAPI.getUserMembershipMap()
        ]);

        setTasks(cachedTasks || []);
        setProjects(cachedProjects || []);
        setSeenTimestamps(seen || {});
        setCachedUsers(users || []);
        setUserMembershipMap(membershipMap || {});

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
    const unsubData = window.electronAPI.onDataUpdate((data: PollDataPacket) => {
      setIsPolling(false);
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      if (data.tasks) setTasks(data.tasks);
      if (data.projects) setProjects(data.projects);
      if (data.unfilteredTaskCount !== null && data.unfilteredTaskCount !== undefined) setUnfilteredTaskCount(data.unfilteredTaskCount);
      if (data.unfilteredProjectCount !== null && data.unfilteredProjectCount !== undefined) setUnfilteredProjectCount(data.unfilteredProjectCount);
      if (data.hasNewInboxActivity !== undefined) setHasNewInboxActivity(data.hasNewInboxActivity);
      if (data.workspaceGid) setWorkspaceGid(data.workspaceGid);
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

  // ── Settings Updates ──────────────────────────────────────────
  // Listen for settings changes from main process (e.g. context menu exclude,
  // settings window close). Re-applies client-side filters instantly without re-polling.

  useEffect(() => {
    const unsub = window.electronAPI.onSettingsChanged((settings: MaskedSettings) => {
      setFilterSettings(extractFilterSettings(settings));
      if (settings.currentUserId) {
        setCurrentUserId(settings.currentUserId);
      }
    });
    return unsub;
  }, []);

  // ── Theme Events ────────────────────────────────────────────

  useThemeListener(window.electronAPI);

  // ── Keyboard Shortcut ───────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // Cmd/Ctrl+I to toggle inbox
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        if (inboxOpen) {
          setInboxOpen(false);
        } else {
          window.electronAPI.getSlideDirection().then(dir => {
            setInboxSlideDirection(dir);
            setInboxOpen(true);
          });
        }
      }
      // Escape: close task detail first, then project detail, then inbox
      if (e.key === 'Escape') {
        if (taskDetailStack.length > 0) {
          setTaskDetailStack(prev => prev.length > 1 ? prev.slice(0, -1) : []);
        } else if (projectDetailStack.length > 0) {
          setProjectDetailStack(prev => prev.length > 1 ? prev.slice(0, -1) : []);
        } else if (inboxOpen) {
          setInboxOpen(false);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inboxOpen, taskDetailStack, projectDetailStack]);

  // ── Derived Data ───────────────────────────────────────────

  // Apply exclusion/inclusion filters client-side for instant feedback
  const filteredTasks = useMemo(() =>
    applyItemFilters(tasks, 'task', filterSettings) as AsanaTask[],
    [tasks, filterSettings]
  );

  const filteredProjects = useMemo(() =>
    applyItemFilters(projects, 'project', filterSettings) as AsanaProject[],
    [projects, filterSettings]
  );

  // Set of non-archived project GIDs — used to exclude archived projects from the
  // task-based project popover. The cached `projects` array is fetched with archived=false,
  // but tasks can still reference archived projects via their projects[] array.
  const activeProjectGids = useMemo(() =>
    new Set(projects.map(p => p.gid)),
    [projects]
  );

  // Build sorted project list with task counts from filtered tasks for the project filter popover.
  // Uses projects referenced on tasks (not the Projects tab data) so the
  // filter only shows projects that actually have incomplete tasks.
  // Excludes archived projects by checking against the active projects set.
  const taskProjects = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const task of filteredTasks) {
      for (const p of task.projects || []) {
        if (p.gid && p.name && activeProjectGids.has(p.gid)) {
          const existing = map.get(p.gid);
          if (existing) {
            existing.count++;
          } else {
            map.set(p.gid, { name: p.name, count: 1 });
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([gid, { name, count }]) => ({ gid, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTasks, activeProjectGids]);

  // Count of tasks visible after project + section filters (before search/sort in TaskList)
  const visibleTaskCount = useMemo(() => {
    let pool = filteredTasks;
    if (selectedProjectGids !== null) {
      if (selectedProjectGids.size === 0) {
        return 0;
      }
      pool = pool.filter(t =>
        (t.projects || []).some(p => selectedProjectGids.has(p.gid))
      );
    }
    if (selectedSections !== null) {
      if (selectedSections.size === 0) {
        return 0;
      }
      pool = pool.filter(t => {
        const sections = (t.memberships || []).map(m => m.section?.name).filter(Boolean) as string[];
        return sections.some(name => selectedSections.has(name));
      });
    }
    return pool.length;
  }, [filteredTasks, selectedProjectGids, selectedSections]);

  // Count of projects visible after membership + search filters
  const visibleProjectCount = useMemo(() => {
    let result = filteredProjects;
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
  }, [filteredProjects, myProjectsOnly, currentUserId, searchQuery]);

  // Derive unique section names with counts from tasks (after project filter, before section filter)
  const availableSections = useMemo(() => {
    let pool = filteredTasks;
    if (selectedProjectGids !== null) {
      if (selectedProjectGids.size === 0) return [];
      pool = pool.filter(t =>
        (t.projects || []).some(p => selectedProjectGids.has(p.gid))
      );
    }
    const counts = new Map<string, number>();
    for (const task of pool) {
      for (const m of task.memberships || []) {
        const name = m.section?.name;
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTasks, selectedProjectGids]);

  // Reset section filter when project selection changes
  useEffect(() => {
    setSelectedSections(null);
    setSectionFilterOpen(false);
  }, [selectedProjectGids]);

  // Prune stale project GIDs from selection when projects disappear from task data
  useEffect(() => {
    if (selectedProjectGids === null) return;
    const availableGids = new Set(taskProjects.map(p => p.gid));
    const pruned = new Set([...selectedProjectGids].filter(gid => availableGids.has(gid)));
    if (pruned.size !== selectedProjectGids.size) {
      setSelectedProjectGids(pruned.size === 0 ? null : pruned);
    }
  }, [taskProjects, selectedProjectGids]);

  // Prune stale pinned GIDs that no longer exist in live data
  useEffect(() => {
    if (tasks.length === 0 && projects.length === 0) return;

    const taskGidSet = new Set(tasks.map(t => t.gid));
    const projectGidSet = new Set(projects.map(p => p.gid));

    const prunedTaskPins = filterSettings.pinnedTaskGids.filter(gid => taskGidSet.has(gid));
    const prunedProjectPins = filterSettings.pinnedProjectGids.filter(gid => projectGidSet.has(gid));

    const taskPinsChanged = prunedTaskPins.length !== filterSettings.pinnedTaskGids.length;
    const projectPinsChanged = prunedProjectPins.length !== filterSettings.pinnedProjectGids.length;

    if (taskPinsChanged || projectPinsChanged) {
      const updates: Partial<FilterSettings> = {};
      if (taskPinsChanged) updates.pinnedTaskGids = prunedTaskPins;
      if (projectPinsChanged) updates.pinnedProjectGids = prunedProjectPins;

      setFilterSettings(prev => ({ ...prev, ...updates }));
      window.electronAPI.setSettings(updates);
    }
  }, [tasks, projects, filterSettings.pinnedTaskGids, filterSettings.pinnedProjectGids]);

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
      setError((err as Error).message);
    }
  }, [isPolling]);

  const handleCompleteTask = useCallback((taskGid: string) => {
    setTasks(prev => prev.filter(t => t.gid !== taskGid));
    setUnfilteredTaskCount(prev => prev !== null && prev !== undefined ? prev - 1 : prev);
  }, []);

  const handleTogglePin = useCallback((type: 'task' | 'project', gid: string) => {
    const key = type === 'task' ? 'pinnedTaskGids' : 'pinnedProjectGids';
    setFilterSettings(prev => {
      const current = prev[key];
      const updated = current.includes(gid)
        ? current.filter(g => g !== gid)
        : [...current, gid];
      // Persist to settings (async, fire-and-forget)
      window.electronAPI.setSettings({ [key]: updated });
      return { ...prev, [key]: updated };
    });
  }, []);

  const handleOpenInbox = useCallback(async () => {
    const dir = await window.electronAPI.getSlideDirection();
    setInboxSlideDirection(dir);
    setInboxOpen(true);
    // Clear the notification dot optimistically and persist the timestamp
    setHasNewInboxActivity(false);
    window.electronAPI.markInboxOpened();
  }, []);

  const handleCloseInbox = useCallback(() => {
    setInboxOpen(false);
  }, []);

  const handleOpenTaskDetail = useCallback((taskGid: string) => {
    setTaskDetailStack([taskGid]);
    setInboxOpen(false);
    // Mark the task as seen
    const task = tasks.find(t => t.gid === taskGid);
    if (task?.modified_at) {
      window.electronAPI.setSeenTimestamp(taskGid, task.modified_at);
      setSeenTimestamps(prev => ({ ...prev, [taskGid]: task.modified_at }));
    }
  }, [tasks]);

  const handleCloseTaskDetail = useCallback(() => {
    setTaskDetailStack(prev => prev.length > 1 ? prev.slice(0, -1) : []);
  }, []);

  const handleNavigateToTask = useCallback((taskGid: string) => {
    setTaskDetailStack(prev => [...prev, taskGid]);
  }, []);

  const handleOpenProjectDetail = useCallback((projectGid: string) => {
    setProjectDetailStack([projectGid]);
  }, []);

  const handleCloseProjectDetail = useCallback(() => {
    setProjectDetailStack(prev => prev.length > 1 ? prev.slice(0, -1) : []);
  }, []);

  // When navigating to a task from the project detail panel, open task detail on top
  const handleProjectNavigateToTask = useCallback((taskGid: string) => {
    setTaskDetailStack(prev => [...prev, taskGid]);
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
          <button className="icon-btn inbox-btn" onClick={handleOpenInbox} title="Inbox (Cmd+I)">
            <Icon path={ICON_PATHS.inbox} size={16} />
            {hasNewInboxActivity && <span className="inbox-dot" />}
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
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
              title="Clear search"
            >
              <Icon path={ICON_PATHS.close} size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Sort / Filter Bar */}
      {activeTab === 'tasks' && (
        <div className="sort-bar">
          <div className="project-filter-wrapper">
            <button
              className={`icon-btn section-filter-btn ${selectedProjectGids !== null ? 'active' : ''}`}
              onClick={() => setProjectFilterOpen(prev => !prev)}
              title="Filter by project"
            >
              <Icon path={ICON_PATHS.folder} size={14} />
              {selectedProjectGids !== null && <span className="section-filter-dot" />}
            </button>
            {projectFilterOpen && (
              <ProjectFilterPopover
                projects={taskProjects}
                selectedProjectGids={selectedProjectGids}
                onSelectionChange={setSelectedProjectGids}
                onClose={() => setProjectFilterOpen(false)}
              />
            )}
          </div>
          <span className="sort-divider" />
          <span className="sort-label">Sort:</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="modified">Last Modified</option>
            <option value="due">Due Date</option>
            <option value="name">Name</option>
            <option value="assignee">Assignee</option>
            <option value="created">Created</option>
          </select>
          {availableSections.length > 0 && (
            <>
              <span className="sort-divider" />
              <div className="section-filter-wrapper">
                <button
                  className={`icon-btn section-filter-btn ${selectedSections !== null ? 'active' : ''}`}
                  onClick={() => setSectionFilterOpen(prev => !prev)}
                  title="Filter by section"
                >
                  <Icon path={ICON_PATHS.filter} size={14} />
                  {selectedSections !== null && <span className="section-filter-dot" />}
                </button>
                {sectionFilterOpen && (
                  <SectionFilterPopover
                    sections={availableSections}
                    selectedSections={selectedSections}
                    onSelectionChange={setSelectedSections}
                    onClose={() => setSectionFilterOpen(false)}
                  />
                )}
              </div>
            </>
          )}
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
            tasks={filteredTasks}
            searchQuery={searchQuery}
            sortBy={sortBy}
            selectedProjectGids={selectedProjectGids}
            selectedSectionNames={selectedSections}
            seenTimestamps={seenTimestamps}
            onComplete={handleCompleteTask}
            pinnedGids={filterSettings.pinnedTaskGids}
            onTogglePin={handleTogglePin}
            onOpenDetail={handleOpenTaskDetail}
          />
        ) : (
          <ProjectList
            projects={filteredProjects}
            searchQuery={searchQuery}
            myProjectsOnly={myProjectsOnly}
            currentUserId={currentUserId}
            pinnedGids={filterSettings.pinnedProjectGids}
            onTogglePin={handleTogglePin}
            onOpenDetail={handleOpenProjectDetail}
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
                  ? `${visibleTaskCount}${unfilteredTaskCount !== null && unfilteredTaskCount !== undefined && unfilteredTaskCount !== visibleTaskCount ? ` of ${unfilteredTaskCount}` : ''} tasks`
                  : `${visibleProjectCount}${unfilteredProjectCount !== null && unfilteredProjectCount !== undefined && unfilteredProjectCount !== visibleProjectCount ? ` of ${unfilteredProjectCount}` : ''} projects`
            }
          </span>
        </div>
        <span>v{version}</span>
      </div>

      {/* Inbox Drawer */}
      <InboxDrawer
        isOpen={inboxOpen}
        onClose={handleCloseInbox}
        slideDirection={inboxSlideDirection}
        currentUserId={currentUserId}
        onOpenTaskDetail={handleOpenTaskDetail}
      />

      {/* Project Detail Panel (rendered before Task Detail so tasks overlay projects) */}
      {projectDetailStack.length > 0 && (
        <ProjectDetailPanel
          projectGid={projectDetailStack[projectDetailStack.length - 1]}
          onClose={handleCloseProjectDetail}
          onNavigateToTask={handleProjectNavigateToTask}
          onTogglePin={handleTogglePin}
          isPinned={filterSettings.pinnedProjectGids.includes(
            projectDetailStack[projectDetailStack.length - 1]
          )}
        />
      )}

      {/* Task Detail Panel */}
      {taskDetailStack.length > 0 && (
        <TaskDetailPanel
          taskGid={taskDetailStack[taskDetailStack.length - 1]}
          cachedUsers={cachedUsers}
          workspaceGid={workspaceGid}
          userMembershipMap={userMembershipMap}
          onClose={handleCloseTaskDetail}
          onNavigateToTask={handleNavigateToTask}
          onComplete={handleCompleteTask}
        />
      )}
    </div>
  );
}
