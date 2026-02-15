import { describe, it, expect } from 'vitest';
import { applyItemFilters, filterAndSortTasks, filterAndSortProjects } from './filters.js';

// ── Test Data ────────────────────────────────────────────────

const makeTasks = () => [
  {
    gid: '1', name: 'Fix login bug', assignee: { name: 'Alice', gid: 'u1' },
    projects: [{ gid: 'p1', name: 'Backend' }],
    modified_at: '2026-02-10T10:00:00Z', due_on: '2026-02-15',
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    gid: '2', name: 'Design homepage', assignee: { name: 'Bob', gid: 'u2' },
    projects: [{ gid: 'p2', name: 'Frontend' }],
    modified_at: '2026-02-12T10:00:00Z', due_on: '2026-02-20',
    created_at: '2026-01-15T00:00:00Z'
  },
  {
    gid: '3', name: 'Write tests', assignee: { name: 'Alice', gid: 'u1' },
    projects: [{ gid: 'p1', name: 'Backend' }],
    modified_at: '2026-02-14T10:00:00Z', due_on: null,
    created_at: '2026-02-01T00:00:00Z'
  },
  {
    gid: '4', name: 'Update README', assignee: null,
    projects: [{ gid: 'p2', name: 'Frontend' }],
    modified_at: '2026-02-08T10:00:00Z', due_on: '2026-02-10',
    created_at: '2026-01-20T00:00:00Z'
  }
];

const makeProjects = () => [
  { gid: 'p1', name: 'Backend', owner: { name: 'Alice' }, members: [{ gid: 'u1' }] },
  { gid: 'p2', name: 'Frontend', owner: { name: 'Bob' }, members: [{ gid: 'u2' }, { gid: 'u1' }] },
  { gid: 'p3', name: 'Design System', owner: { name: 'Carol' }, members: [{ gid: 'u3' }] }
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
      excludedTaskPatterns: ['', null, undefined]
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
    expect(result.every(t => t.projects.some(p => p.gid === 'p1'))).toBe(true);
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
    expect(result[1].assignee.name).toBe('Alice');
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
});
