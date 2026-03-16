import { describe, it, expect } from 'vitest';
import { applyItemFilters, filterAndSortTasks, filterAndSortProjects } from './filters';

import type { AsanaTask, AsanaProject } from './types';

// ── Test Data ────────────────────────────────────────────────

const makeTasks = (): AsanaTask[] => [
  {
    gid: '1', name: 'Fix login bug', completed: false,
    assignee: { name: 'Alice', gid: 'u1' },
    projects: [{ gid: 'p1', name: 'Backend' }],
    memberships: [{ project: { gid: 'p1' }, section: { gid: 's1', name: 'In Progress' } }],
    modified_at: '2026-02-10T10:00:00Z', due_on: '2026-02-15', due_at: null,
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    gid: '2', name: 'Design homepage', completed: false,
    assignee: { name: 'Bob', gid: 'u2' },
    projects: [{ gid: 'p2', name: 'Frontend' }],
    memberships: [{ project: { gid: 'p2' }, section: { gid: 's2', name: 'In Review' } }],
    modified_at: '2026-02-12T10:00:00Z', due_on: '2026-02-20', due_at: null,
    created_at: '2026-01-15T00:00:00Z'
  },
  {
    gid: '3', name: 'Write tests', completed: false,
    assignee: { name: 'Alice', gid: 'u1' },
    projects: [{ gid: 'p1', name: 'Backend' }],
    memberships: [{ project: { gid: 'p1' }, section: { gid: 's3', name: 'To Do' } }],
    modified_at: '2026-02-14T10:00:00Z', due_on: null, due_at: null,
    created_at: '2026-02-01T00:00:00Z'
  },
  {
    gid: '4', name: 'Update README', completed: false,
    assignee: null,
    projects: [{ gid: 'p2', name: 'Frontend' }],
    memberships: [{ project: { gid: 'p2' }, section: { gid: 's2', name: 'In Review' } }],
    modified_at: '2026-02-08T10:00:00Z', due_on: '2026-02-10', due_at: null,
    created_at: '2026-01-20T00:00:00Z'
  }
];

const makeProjects = (): AsanaProject[] => [
  { gid: 'p1', name: 'Backend', archived: false, color: 'dark-blue', modified_at: '2026-02-10T10:00:00Z', owner: { name: 'Alice' }, members: [{ gid: 'u1' }] },
  { gid: 'p2', name: 'Frontend', archived: false, color: 'dark-green', modified_at: '2026-02-12T10:00:00Z', owner: { name: 'Bob' }, members: [{ gid: 'u2' }, { gid: 'u1' }] },
  { gid: 'p3', name: 'Design System', archived: false, color: 'dark-red', modified_at: '2026-02-14T10:00:00Z', owner: { name: 'Carol' }, members: [{ gid: 'u3' }] }
];

// ── applyItemFilters ─────────────────────────────────────────

describe('applyItemFilters', () => {
  it('returns all items when no filters are set', () => {
    const items = makeTasks();
    const result = applyItemFilters(items, 'task', {});
    expect(result).toHaveLength(4);
  });

  it('excludes items by GID', () => {
    const items = makeTasks();
    const result = applyItemFilters(items, 'task', { excludedTaskGids: ['2', '4'] });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.gid)).toEqual(['1', '3']);
  });

  it('excludes items by name pattern (case-insensitive)', () => {
    const items = makeTasks();
    const result = applyItemFilters(items, 'task', { excludedTaskPatterns: ['README'] });
    expect(result).toHaveLength(3);
    expect(result.find(t => t.gid === '4')).toBeUndefined();
  });

  it('applies inclusion filter — items must match at least one pattern', () => {
    const items = makeTasks();
    const result = applyItemFilters(items, 'task', { includedTaskPatterns: ['bug', 'test'] });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.gid)).toEqual(['1', '3']);
  });

  it('applies both inclusion and exclusion filters', () => {
    const items = makeTasks();
    const result = applyItemFilters(items, 'task', {
      includedTaskPatterns: ['bug', 'test'],
      excludedTaskGids: ['1']
    });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('3');
  });

  it('works with project type', () => {
    const items = makeProjects();
    const result = applyItemFilters(items, 'project', {
      excludedProjectPatterns: ['design']
    });
    expect(result).toHaveLength(2);
    expect(result.find(p => p.gid === 'p3')).toBeUndefined();
  });

  it('handles empty pattern strings gracefully', () => {
    const items = makeTasks();
    const result = applyItemFilters(items, 'task', {
      excludedTaskPatterns: ['', null as unknown as string, undefined as unknown as string]
    });
    expect(result).toHaveLength(4);
  });

  it('handles items with no name', () => {
    const items = [{ gid: '99', name: null }];
    const result = applyItemFilters(items, 'task', { excludedTaskPatterns: ['test'] });
    expect(result).toHaveLength(1);
  });
});

// ── filterAndSortTasks ───────────────────────────────────────

describe('filterAndSortTasks', () => {
  it('returns all tasks with no filters', () => {
    const result = filterAndSortTasks(makeTasks());
    expect(result).toHaveLength(4);
  });

  it('filters by project GID', () => {
    const result = filterAndSortTasks(makeTasks(), { selectedProjectGid: 'p1' });
    expect(result).toHaveLength(2);
    expect(result.every(t => t.projects!.some(p => p.gid === 'p1'))).toBe(true);
  });

  it('filters by search query on task name (case-insensitive)', () => {
    const result = filterAndSortTasks(makeTasks(), { searchQuery: 'BUG' });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('1');
  });

  it('filters by search query on assignee name', () => {
    const result = filterAndSortTasks(makeTasks(), { searchQuery: 'alice' });
    expect(result).toHaveLength(2);
  });

  it('filters by search query on project name', () => {
    const result = filterAndSortTasks(makeTasks(), { searchQuery: 'frontend' });
    expect(result).toHaveLength(2);
  });

  it('filters by search query on section name', () => {
    const result = filterAndSortTasks(makeTasks(), { searchQuery: 'in review' });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.gid).sort()).toEqual(['2', '4']);
  });

  // ── Section name filter ─────────────────────────────────────

  it('filters by selected section names', () => {
    const result = filterAndSortTasks(makeTasks(), {
      selectedSectionNames: new Set(['In Review'])
    });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.gid).sort()).toEqual(['2', '4']);
  });

  it('passes all tasks when selectedSectionNames is undefined', () => {
    const result = filterAndSortTasks(makeTasks(), {});
    expect(result).toHaveLength(4);
  });

  it('returns no tasks when selectedSectionNames is empty set', () => {
    const result = filterAndSortTasks(makeTasks(), {
      selectedSectionNames: new Set()
    });
    expect(result).toHaveLength(0); // empty set = match nothing
  });

  it('combines section filter with project filter', () => {
    const result = filterAndSortTasks(makeTasks(), {
      selectedProjectGid: 'p1',
      selectedSectionNames: new Set(['In Progress'])
    });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('1');
  });

  it('combines section filter with search', () => {
    const result = filterAndSortTasks(makeTasks(), {
      selectedSectionNames: new Set(['In Review']),
      searchQuery: 'design'
    });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('2');
  });

  it('handles tasks with no memberships gracefully in section filter', () => {
    const tasks = makeTasks();
    tasks[0].memberships = undefined;
    const result = filterAndSortTasks(tasks, {
      selectedSectionNames: new Set(['In Progress'])
    });
    // Task 1 has no memberships now, so it shouldn't match
    expect(result.find(t => t.gid === '1')).toBeUndefined();
  });

  it('filters by search query on task GID', () => {
    const result = filterAndSortTasks(makeTasks(), { searchQuery: '3' });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('3');
  });

  it('sorts by last modified (newest first)', () => {
    const result = filterAndSortTasks(makeTasks(), { sortBy: 'modified' });
    expect(result[0].gid).toBe('3'); // Feb 14
    expect(result[1].gid).toBe('2'); // Feb 12
  });

  it('sorts by due date (earliest first, missing dates last)', () => {
    const result = filterAndSortTasks(makeTasks(), { sortBy: 'due' });
    expect(result[0].gid).toBe('4'); // Feb 10
    expect(result[result.length - 1].gid).toBe('3'); // no due date
  });

  it('sorts by name (alphabetical)', () => {
    const result = filterAndSortTasks(makeTasks(), { sortBy: 'name' });
    expect(result[0].name).toBe('Design homepage');
    expect(result[1].name).toBe('Fix login bug');
  });

  it('sorts by assignee (alphabetical, missing last)', () => {
    const result = filterAndSortTasks(makeTasks(), { sortBy: 'assignee' });
    // '' (no assignee) sorts first in localeCompare
    expect(result[0].gid).toBe('4'); // no assignee
    expect(result[1].assignee!.name).toBe('Alice');
  });

  it('sorts by created date (newest first)', () => {
    const result = filterAndSortTasks(makeTasks(), { sortBy: 'created' });
    expect(result[0].gid).toBe('3'); // Feb 01
    expect(result[result.length - 1].gid).toBe('1'); // Jan 01
  });

  it('combines project filter and search', () => {
    const result = filterAndSortTasks(makeTasks(), {
      selectedProjectGid: 'p1',
      searchQuery: 'test'
    });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('3');
  });

  it('does not mutate the original array', () => {
    const tasks = makeTasks();
    const original = [...tasks];
    filterAndSortTasks(tasks, { sortBy: 'name' });
    expect(tasks.map(t => t.gid)).toEqual(original.map(t => t.gid));
  });

  // ── Pinned tasks ─────────────────────────────────────────

  it('floats pinned tasks to the top', () => {
    const result = filterAndSortTasks(makeTasks(), {
      sortBy: 'name',
      pinnedGids: ['4']
    });
    expect(result[0].gid).toBe('4');
  });

  it('preserves sort order among pinned tasks', () => {
    const result = filterAndSortTasks(makeTasks(), {
      sortBy: 'name',
      pinnedGids: ['3', '1']  // Write tests, Fix login bug — alphabetically: Fix, Write
    });
    expect(result[0].gid).toBe('1'); // Fix login bug
    expect(result[1].gid).toBe('3'); // Write tests
  });

  it('preserves sort order among unpinned tasks', () => {
    const result = filterAndSortTasks(makeTasks(), {
      sortBy: 'name',
      pinnedGids: ['3']
    });
    // Unpinned sorted by name: Design homepage, Fix login bug, Update README
    expect(result[1].gid).toBe('2'); // Design homepage
    expect(result[2].gid).toBe('1'); // Fix login bug
    expect(result[3].gid).toBe('4'); // Update README
  });

  it('ignores nonexistent pinned GIDs', () => {
    const result = filterAndSortTasks(makeTasks(), {
      sortBy: 'name',
      pinnedGids: ['999', '3']
    });
    expect(result[0].gid).toBe('3');
    expect(result).toHaveLength(4);
  });

  it('treats empty pinnedGids as no-op', () => {
    const withPin = filterAndSortTasks(makeTasks(), { sortBy: 'name', pinnedGids: [] });
    const without = filterAndSortTasks(makeTasks(), { sortBy: 'name' });
    expect(withPin.map(t => t.gid)).toEqual(without.map(t => t.gid));
  });

  it('pinning works with modified sort', () => {
    const result = filterAndSortTasks(makeTasks(), {
      sortBy: 'modified',
      pinnedGids: ['4']  // oldest modified — should float to top
    });
    expect(result[0].gid).toBe('4');
    // Rest sorted by modified desc: 3 (Feb 14), 2 (Feb 12), 1 (Feb 10)
    expect(result[1].gid).toBe('3');
  });
});

// ── filterAndSortProjects ────────────────────────────────────

describe('filterAndSortProjects', () => {
  it('returns all projects with no filters, sorted by name', () => {
    const result = filterAndSortProjects(makeProjects());
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Backend');
    expect(result[1].name).toBe('Design System');
    expect(result[2].name).toBe('Frontend');
  });

  it('filters by membership when myProjectsOnly is true', () => {
    const result = filterAndSortProjects(makeProjects(), {
      myProjectsOnly: true,
      currentUserId: 'u1'
    });
    expect(result).toHaveLength(2);
    expect(result.map(p => p.gid)).toEqual(['p1', 'p2']);
  });

  it('does not filter membership when currentUserId is missing', () => {
    const result = filterAndSortProjects(makeProjects(), {
      myProjectsOnly: true,
      currentUserId: null
    });
    expect(result).toHaveLength(3);
  });

  it('filters by search on project name (case-insensitive)', () => {
    const result = filterAndSortProjects(makeProjects(), { searchQuery: 'DESIGN' });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('p3');
  });

  it('filters by search on owner name', () => {
    const result = filterAndSortProjects(makeProjects(), { searchQuery: 'carol' });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('p3');
  });

  it('filters by search on project GID', () => {
    const result = filterAndSortProjects(makeProjects(), { searchQuery: 'p2' });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('p2');
  });

  it('combines membership filter and search', () => {
    const result = filterAndSortProjects(makeProjects(), {
      myProjectsOnly: true,
      currentUserId: 'u1',
      searchQuery: 'front'
    });
    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('p2');
  });

  it('does not mutate the original array', () => {
    const projects = makeProjects();
    const original = [...projects];
    filterAndSortProjects(projects, { searchQuery: 'x' });
    expect(projects.map(p => p.gid)).toEqual(original.map(p => p.gid));
  });

  // ── Pinned projects ──────────────────────────────────────

  it('floats pinned projects to the top', () => {
    const result = filterAndSortProjects(makeProjects(), {
      pinnedGids: ['p2']
    });
    expect(result[0].gid).toBe('p2'); // Frontend pinned to top
    expect(result[1].gid).toBe('p1'); // Backend (alphabetical)
    expect(result[2].gid).toBe('p3'); // Design System
  });

  it('preserves name sort among pinned projects', () => {
    const result = filterAndSortProjects(makeProjects(), {
      pinnedGids: ['p2', 'p3']  // Frontend + Design System — alpha: Design System first
    });
    expect(result[0].gid).toBe('p3'); // Design System
    expect(result[1].gid).toBe('p2'); // Frontend
    expect(result[2].gid).toBe('p1'); // Backend (unpinned)
  });

  it('ignores nonexistent pinned project GIDs', () => {
    const result = filterAndSortProjects(makeProjects(), {
      pinnedGids: ['p999']
    });
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Backend');
  });

  it('treats empty pinnedGids as no-op', () => {
    const withPin = filterAndSortProjects(makeProjects(), { pinnedGids: [] });
    const without = filterAndSortProjects(makeProjects());
    expect(withPin.map(p => p.gid)).toEqual(without.map(p => p.gid));
  });

  it('pinning works with membership filter', () => {
    const result = filterAndSortProjects(makeProjects(), {
      myProjectsOnly: true,
      currentUserId: 'u1',
      pinnedGids: ['p2']
    });
    expect(result).toHaveLength(2);
    expect(result[0].gid).toBe('p2'); // Frontend pinned
    expect(result[1].gid).toBe('p1'); // Backend
  });
});
