// ══════════════════════════════════════════════════════════════════════════════
// FILTER & SORT UTILITIES
// Pure functions for filtering and sorting tasks/projects.
// Extracted from components for testability.
// ══════════════════════════════════════════════════════════════════════════════

import type { AsanaTask, AsanaProject, ItemFilterType, Settings, SortBy } from './types';

/** Minimal item shape required by applyItemFilters */
interface FilterableItem {
  gid: string;
  name: string | null;
}

interface TaskFilterOptions {
  searchQuery?: string;
  sortBy?: SortBy;
  selectedProjectGid?: string;
}

interface ProjectFilterOptions {
  searchQuery?: string;
  myProjectsOnly?: boolean;
  currentUserId?: string | null;
}

/**
 * Apply inclusion/exclusion filters to items (tasks or projects).
 * Used client-side in the renderer for instant filter feedback.
 */
export function applyItemFilters(
  items: FilterableItem[],
  type: ItemFilterType,
  settings: Partial<Settings>
): FilterableItem[] {
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
 */
export function filterAndSortTasks(
  tasks: AsanaTask[],
  { searchQuery, sortBy, selectedProjectGid }: TaskFilterOptions = {}
): AsanaTask[] {
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
        return new Date(b.modified_at || 0).getTime() - new Date(a.modified_at || 0).getTime();
      case 'due': {
        const aDue = a.due_on || a.due_at || '9999-12-31';
        const bDue = b.due_on || b.due_at || '9999-12-31';
        return new Date(aDue).getTime() - new Date(bDue).getTime();
      }
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'assignee':
        return (a.assignee?.name || '').localeCompare(b.assignee?.name || '');
      case 'created':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default:
        return 0;
    }
  });

  return result;
}

/**
 * Filter projects by membership and search query, sorted by name.
 */
export function filterAndSortProjects(
  projects: AsanaProject[],
  { searchQuery, myProjectsOnly, currentUserId }: ProjectFilterOptions = {}
): AsanaProject[] {
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
