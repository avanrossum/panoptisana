// ══════════════════════════════════════════════════════════════════════════════
// FILTER & SORT UTILITIES
// Pure functions for filtering and sorting tasks/projects.
// Extracted from components for testability.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Apply inclusion/exclusion filters to items (tasks or projects).
 * Used by AsanaAPI._applyFilters after fetching from the API.
 *
 * @param {Array} items - Tasks or projects
 * @param {string} type - 'task' or 'project'
 * @param {Object} settings - Filter settings from store
 * @returns {Array} Filtered items
 */
export function applyItemFilters(items, type, settings) {
  const gidList = type === 'task'
    ? (settings.excludedTaskGids || [])
    : (settings.excludedProjectGids || []);
  const excludePatterns = type === 'task'
    ? (settings.excludedTaskPatterns || [])
    : (settings.excludedProjectPatterns || []);
  const includePatterns = type === 'task'
    ? (settings.includedTaskPatterns || [])
    : (settings.includedProjectPatterns || []);

  return items.filter(item => {
    const name = (item.name || '').toLowerCase();

    // Inclusion filter: if any patterns defined, name must match at least one
    if (includePatterns.length > 0) {
      const matchesAny = includePatterns.some(p => p && name.includes(p.toLowerCase()));
      if (!matchesAny) return false;
    }

    // Exclude by GID
    if (gidList.includes(item.gid)) return false;

    // Exclude by name pattern (case-insensitive partial match)
    for (const pattern of excludePatterns) {
      if (pattern && name.includes(pattern.toLowerCase())) return false;
    }

    return true;
  });
}

/**
 * Filter tasks by project and search query, then sort.
 * Mirrors the useMemo logic in TaskList.jsx.
 *
 * @param {Array} tasks - Task list
 * @param {Object} options
 * @param {string} [options.searchQuery] - Search text
 * @param {string} [options.sortBy] - Sort key: 'modified', 'due', 'name', 'assignee', 'created'
 * @param {string} [options.selectedProjectGid] - Filter to single project
 * @returns {Array} Filtered and sorted tasks
 */
export function filterAndSortTasks(tasks, { searchQuery, sortBy, selectedProjectGid } = {}) {
  let result = [...tasks];

  // Filter by project
  if (selectedProjectGid) {
    result = result.filter(t =>
      (t.projects || []).some(p => p.gid === selectedProjectGid)
    );
  }

  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(t => {
      const name = (t.name || '').toLowerCase();
      const assignee = (t.assignee?.name || '').toLowerCase();
      const projectNames = (t.projects || []).map(p => p.name.toLowerCase()).join(' ');
      return name.includes(q) || assignee.includes(q) || projectNames.includes(q);
    });
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy) {
      case 'modified':
        return new Date(b.modified_at || 0) - new Date(a.modified_at || 0);
      case 'due': {
        const aDue = a.due_on || a.due_at || '9999-12-31';
        const bDue = b.due_on || b.due_at || '9999-12-31';
        return new Date(aDue) - new Date(bDue);
      }
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'assignee':
        return (a.assignee?.name || '').localeCompare(b.assignee?.name || '');
      case 'created':
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      default:
        return 0;
    }
  });

  return result;
}

/**
 * Filter projects by membership and search query, sorted by name.
 * Mirrors the useMemo logic in ProjectList.jsx.
 *
 * @param {Array} projects - Project list
 * @param {Object} options
 * @param {string} [options.searchQuery] - Search text
 * @param {boolean} [options.myProjectsOnly] - Filter to current user's projects
 * @param {string} [options.currentUserId] - Current user GID
 * @returns {Array} Filtered and sorted projects
 */
export function filterAndSortProjects(projects, { searchQuery, myProjectsOnly, currentUserId } = {}) {
  let result = [...projects];

  // Filter to only projects the current user is a member of
  if (myProjectsOnly && currentUserId) {
    result = result.filter(p => {
      const memberGids = (p.members || []).map(m => m.gid);
      return memberGids.includes(currentUserId);
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(p => {
      const name = (p.name || '').toLowerCase();
      const owner = (p.owner?.name || '').toLowerCase();
      return name.includes(q) || owner.includes(q);
    });
  }

  // Sort by name
  result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return result;
}
