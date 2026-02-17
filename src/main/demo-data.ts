// ══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// Realistic fake Asana data for screenshots and video.
// Activated via PANOPTISANA_DEMO=1 environment variable.
// ══════════════════════════════════════════════════════════════════════════════

import type { AsanaUser, AsanaProject, AsanaTask, AsanaWorkspace } from '../shared/types';


// ── Helpers ──────────────────────────────────────────────────────────────────

/** ISO 8601 timestamp offset from now by the given number of days (negative = past) */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** ISO 8601 date string (YYYY-MM-DD) offset from today */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}


// ── Constants ────────────────────────────────────────────────────────────────

export const DEMO_WORKSPACE: AsanaWorkspace = {
  gid: '1000000000000001',
  name: 'Acme Corp'
};

export const DEMO_CURRENT_USER: AsanaUser = {
  gid: '2000000000000001',
  name: 'Alex Morgan',
  email: 'alex.morgan@acme.co',
  photo: null
};


// ── Users ────────────────────────────────────────────────────────────────────

const DEMO_USERS: AsanaUser[] = [
  DEMO_CURRENT_USER,
  { gid: '2000000000000002', name: 'Jordan Lee', email: 'jordan.lee@acme.co', photo: null },
  { gid: '2000000000000003', name: 'Sam Rivera', email: 'sam.rivera@acme.co', photo: null },
  { gid: '2000000000000004', name: 'Casey Chen', email: 'casey.chen@acme.co', photo: null },
  { gid: '2000000000000005', name: 'Taylor Kim', email: 'taylor.kim@acme.co', photo: null },
  { gid: '2000000000000006', name: 'Morgan Patel', email: 'morgan.patel@acme.co', photo: null },
  { gid: '2000000000000007', name: 'Riley Brooks', email: 'riley.brooks@acme.co', photo: null },
  { gid: '2000000000000008', name: 'Quinn Foster', email: 'quinn.foster@acme.co', photo: null },
];

export function getDemoUsers(): AsanaUser[] {
  return DEMO_USERS;
}


// ── Projects ─────────────────────────────────────────────────────────────────

const DEMO_PROJECTS: AsanaProject[] = [
  {
    gid: '3000000000000001',
    name: 'Product Roadmap',
    archived: false,
    color: 'dark-blue',
    modified_at: daysAgo(0),
    owner: { gid: DEMO_CURRENT_USER.gid, name: DEMO_CURRENT_USER.name },
    members: [{ gid: '2000000000000001' }, { gid: '2000000000000002' }, { gid: '2000000000000003' }],
    current_status: { title: 'On track', color: 'green' },
  },
  {
    gid: '3000000000000002',
    name: 'Engineering Sprint 24',
    archived: false,
    color: 'dark-green',
    modified_at: daysAgo(1),
    owner: { gid: '2000000000000002', name: 'Jordan Lee' },
    members: [{ gid: '2000000000000001' }, { gid: '2000000000000002' }, { gid: '2000000000000004' }, { gid: '2000000000000005' }],
    current_status: { title: 'At risk', color: 'yellow' },
  },
  {
    gid: '3000000000000003',
    name: 'Design System',
    archived: false,
    color: 'dark-purple',
    modified_at: daysAgo(2),
    owner: { gid: '2000000000000003', name: 'Sam Rivera' },
    members: [{ gid: '2000000000000001' }, { gid: '2000000000000003' }, { gid: '2000000000000007' }],
    current_status: { title: 'On track', color: 'green' },
  },
  {
    gid: '3000000000000004',
    name: 'Customer Feedback Tracker',
    archived: false,
    color: 'dark-orange',
    modified_at: daysAgo(3),
    owner: { gid: '2000000000000006', name: 'Morgan Patel' },
    members: [{ gid: '2000000000000006' }, { gid: '2000000000000008' }],
    current_status: null,
  },
  {
    gid: '3000000000000005',
    name: 'Q1 Marketing Campaign',
    archived: false,
    color: 'dark-pink',
    modified_at: daysAgo(1),
    owner: { gid: '2000000000000008', name: 'Quinn Foster' },
    members: [{ gid: '2000000000000001' }, { gid: '2000000000000006' }, { gid: '2000000000000008' }],
    current_status: { title: 'On track', color: 'green' },
  },
  {
    gid: '3000000000000006',
    name: 'Infrastructure & DevOps',
    archived: false,
    color: 'dark-teal',
    modified_at: daysAgo(5),
    owner: { gid: '2000000000000004', name: 'Casey Chen' },
    members: [{ gid: '2000000000000002' }, { gid: '2000000000000004' }],
    current_status: { title: 'Off track', color: 'red' },
  },
  {
    gid: '3000000000000007',
    name: 'Onboarding Revamp',
    archived: false,
    color: 'light-green',
    modified_at: daysAgo(0),
    owner: { gid: DEMO_CURRENT_USER.gid, name: DEMO_CURRENT_USER.name },
    members: [{ gid: '2000000000000001' }, { gid: '2000000000000003' }, { gid: '2000000000000005' }],
    current_status: null,
  },
  {
    gid: '3000000000000008',
    name: 'API v2 Migration',
    archived: false,
    color: 'dark-red',
    modified_at: daysAgo(7),
    owner: { gid: '2000000000000005', name: 'Taylor Kim' },
    members: [{ gid: '2000000000000002' }, { gid: '2000000000000004' }, { gid: '2000000000000005' }],
    current_status: { title: 'At risk', color: 'yellow' },
  },
  {
    gid: '3000000000000009',
    name: 'Mobile App Refresh',
    archived: false,
    color: 'light-blue',
    modified_at: daysAgo(2),
    owner: { gid: '2000000000000007', name: 'Riley Brooks' },
    members: [{ gid: '2000000000000001' }, { gid: '2000000000000003' }, { gid: '2000000000000007' }],
    current_status: { title: 'On track', color: 'green' },
  },
  {
    gid: '3000000000000010',
    name: 'Security Audit 2025',
    archived: false,
    color: 'dark-warm-gray',
    modified_at: daysAgo(10),
    owner: { gid: '2000000000000004', name: 'Casey Chen' },
    members: [{ gid: '2000000000000004' }, { gid: '2000000000000005' }],
    current_status: null,
  },
];

export function getDemoProjects(): AsanaProject[] {
  return DEMO_PROJECTS;
}


// ── Tasks ────────────────────────────────────────────────────────────────────

function proj(gid: string, name: string): { gid: string; name: string } {
  return { gid, name };
}

let _sectionCounter = 0;
function membership(projectGid: string, sectionName: string): { project?: { gid: string }; section?: { gid: string; name: string } } {
  return { project: { gid: projectGid }, section: { gid: `5000000000000${String(++_sectionCounter).padStart(3, '0')}`, name: sectionName } };
}

const DEMO_TASKS: AsanaTask[] = [
  // Product Roadmap tasks
  {
    gid: '4000000000000001', name: 'Define Q2 product priorities', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000001', 'Product Roadmap')],
    memberships: [membership('3000000000000001', 'Planning')],
    due_on: dateOffset(3), due_at: null, created_at: daysAgo(14), modified_at: daysAgo(0), num_subtasks: 4,
  },
  {
    gid: '4000000000000002', name: 'Competitive analysis: pricing tier comparison', completed: false,
    assignee: { gid: '2000000000000006', name: 'Morgan Patel' },
    projects: [proj('3000000000000001', 'Product Roadmap')],
    memberships: [membership('3000000000000001', 'Research')],
    due_on: dateOffset(7), due_at: null, created_at: daysAgo(10), modified_at: daysAgo(2), num_subtasks: 0,
  },
  {
    gid: '4000000000000003', name: 'Write RFC for notification system redesign', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000001', 'Product Roadmap')],
    memberships: [membership('3000000000000001', 'In Progress')],
    due_on: dateOffset(-2), due_at: null, created_at: daysAgo(21), modified_at: daysAgo(1), num_subtasks: 2,
  },

  // Engineering Sprint tasks
  {
    gid: '4000000000000004', name: 'Fix timezone display in notification emails', completed: false,
    assignee: { gid: '2000000000000002', name: 'Jordan Lee' },
    projects: [proj('3000000000000002', 'Engineering Sprint 24')],
    memberships: [membership('3000000000000002', 'In Progress')],
    due_on: dateOffset(1), due_at: null, created_at: daysAgo(5), modified_at: daysAgo(0), num_subtasks: 0,
  },
  {
    gid: '4000000000000005', name: 'Upgrade database connection pooling', completed: false,
    assignee: { gid: '2000000000000004', name: 'Casey Chen' },
    projects: [proj('3000000000000002', 'Engineering Sprint 24')],
    memberships: [membership('3000000000000002', 'To Do')],
    due_on: dateOffset(5), due_at: null, created_at: daysAgo(3), modified_at: daysAgo(1), num_subtasks: 3,
  },
  {
    gid: '4000000000000006', name: 'Review PR #847: Rate limiter middleware', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000002', 'Engineering Sprint 24')],
    memberships: [membership('3000000000000002', 'In Review')],
    due_on: dateOffset(0), due_at: null, created_at: daysAgo(2), modified_at: daysAgo(0), num_subtasks: 0,
  },
  {
    gid: '4000000000000007', name: 'Add retry logic to webhook delivery', completed: false,
    assignee: { gid: '2000000000000005', name: 'Taylor Kim' },
    projects: [proj('3000000000000002', 'Engineering Sprint 24')],
    memberships: [membership('3000000000000002', 'In Progress')],
    due_on: dateOffset(2), due_at: null, created_at: daysAgo(7), modified_at: daysAgo(0), num_subtasks: 1,
  },

  // Design System tasks
  {
    gid: '4000000000000008', name: 'Update color token palette for dark mode', completed: false,
    assignee: { gid: '2000000000000003', name: 'Sam Rivera' },
    projects: [proj('3000000000000003', 'Design System')],
    memberships: [membership('3000000000000003', 'Components')],
    due_on: dateOffset(4), due_at: null, created_at: daysAgo(6), modified_at: daysAgo(1), num_subtasks: 0,
  },
  {
    gid: '4000000000000009', name: 'Create accessible tooltip component', completed: false,
    assignee: { gid: '2000000000000007', name: 'Riley Brooks' },
    projects: [proj('3000000000000003', 'Design System')],
    memberships: [membership('3000000000000003', 'Components')],
    due_on: dateOffset(6), due_at: null, created_at: daysAgo(4), modified_at: daysAgo(2), num_subtasks: 2,
  },
  {
    gid: '4000000000000010', name: 'Audit button variants for WCAG compliance', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000003', 'Design System')],
    memberships: [membership('3000000000000003', 'Backlog')],
    due_on: null, due_at: null, created_at: daysAgo(12), modified_at: daysAgo(5), num_subtasks: 0,
  },

  // Customer Feedback tasks
  {
    gid: '4000000000000011', name: 'Triage feedback from enterprise pilot', completed: false,
    assignee: { gid: '2000000000000006', name: 'Morgan Patel' },
    projects: [proj('3000000000000004', 'Customer Feedback Tracker')],
    memberships: [membership('3000000000000004', 'Inbox')],
    due_on: dateOffset(1), due_at: null, created_at: daysAgo(2), modified_at: daysAgo(0), num_subtasks: 0,
  },
  {
    gid: '4000000000000012', name: 'Synthesize NPS survey results', completed: false,
    assignee: { gid: '2000000000000008', name: 'Quinn Foster' },
    projects: [proj('3000000000000004', 'Customer Feedback Tracker')],
    memberships: [membership('3000000000000004', 'Analysis')],
    due_on: dateOffset(-1), due_at: null, created_at: daysAgo(8), modified_at: daysAgo(3), num_subtasks: 0,
  },

  // Q1 Marketing Campaign tasks
  {
    gid: '4000000000000013', name: 'Draft launch blog post', completed: false,
    assignee: { gid: '2000000000000008', name: 'Quinn Foster' },
    projects: [proj('3000000000000005', 'Q1 Marketing Campaign')],
    memberships: [membership('3000000000000005', 'Content')],
    due_on: dateOffset(5), due_at: null, created_at: daysAgo(4), modified_at: daysAgo(1), num_subtasks: 0,
  },
  {
    gid: '4000000000000014', name: 'Create social media asset kit', completed: false,
    assignee: { gid: '2000000000000003', name: 'Sam Rivera' },
    projects: [proj('3000000000000005', 'Q1 Marketing Campaign')],
    memberships: [membership('3000000000000005', 'Creative')],
    due_on: dateOffset(8), due_at: null, created_at: daysAgo(3), modified_at: daysAgo(0), num_subtasks: 5,
  },
  {
    gid: '4000000000000015', name: 'Coordinate product hunt launch sequence', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000005', 'Q1 Marketing Campaign')],
    memberships: [membership('3000000000000005', 'Planning')],
    due_on: dateOffset(14), due_at: null, created_at: daysAgo(1), modified_at: daysAgo(0), num_subtasks: 3,
  },

  // Infrastructure & DevOps tasks
  {
    gid: '4000000000000016', name: 'Migrate CI pipeline to GitHub Actions', completed: false,
    assignee: { gid: '2000000000000004', name: 'Casey Chen' },
    projects: [proj('3000000000000006', 'Infrastructure & DevOps')],
    memberships: [membership('3000000000000006', 'In Progress')],
    due_on: dateOffset(-3), due_at: null, created_at: daysAgo(15), modified_at: daysAgo(0), num_subtasks: 2,
  },
  {
    gid: '4000000000000017', name: 'Set up staging environment auto-deploy', completed: false,
    assignee: { gid: '2000000000000002', name: 'Jordan Lee' },
    projects: [proj('3000000000000006', 'Infrastructure & DevOps')],
    memberships: [membership('3000000000000006', 'To Do')],
    due_on: dateOffset(10), due_at: null, created_at: daysAgo(6), modified_at: daysAgo(4), num_subtasks: 0,
  },

  // Onboarding Revamp tasks
  {
    gid: '4000000000000018', name: 'Map current onboarding funnel drop-offs', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000007', 'Onboarding Revamp')],
    memberships: [membership('3000000000000007', 'Research')],
    due_on: dateOffset(2), due_at: null, created_at: daysAgo(5), modified_at: daysAgo(0), num_subtasks: 0,
  },
  {
    gid: '4000000000000019', name: 'Prototype interactive walkthrough', completed: false,
    assignee: { gid: '2000000000000003', name: 'Sam Rivera' },
    projects: [proj('3000000000000007', 'Onboarding Revamp')],
    memberships: [membership('3000000000000007', 'Design')],
    due_on: dateOffset(9), due_at: null, created_at: daysAgo(3), modified_at: daysAgo(1), num_subtasks: 0,
  },

  // API v2 Migration tasks
  {
    gid: '4000000000000020', name: 'Document breaking changes for v1 deprecation', completed: false,
    assignee: { gid: '2000000000000005', name: 'Taylor Kim' },
    projects: [proj('3000000000000008', 'API v2 Migration')],
    memberships: [membership('3000000000000008', 'Documentation')],
    due_on: dateOffset(-5), due_at: null, created_at: daysAgo(20), modified_at: daysAgo(2), num_subtasks: 0,
  },
  {
    gid: '4000000000000021', name: 'Build versioned endpoint router', completed: false,
    assignee: { gid: '2000000000000004', name: 'Casey Chen' },
    projects: [proj('3000000000000008', 'API v2 Migration')],
    memberships: [membership('3000000000000008', 'In Progress')],
    due_on: dateOffset(4), due_at: null, created_at: daysAgo(9), modified_at: daysAgo(0), num_subtasks: 4,
  },

  // Mobile App Refresh tasks
  {
    gid: '4000000000000022', name: 'Implement pull-to-refresh on dashboard', completed: false,
    assignee: { gid: '2000000000000007', name: 'Riley Brooks' },
    projects: [proj('3000000000000009', 'Mobile App Refresh')],
    memberships: [membership('3000000000000009', 'Development')],
    due_on: dateOffset(3), due_at: null, created_at: daysAgo(7), modified_at: daysAgo(1), num_subtasks: 0,
  },
  {
    gid: '4000000000000023', name: 'Optimize image loading for slow connections', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000009', 'Mobile App Refresh')],
    memberships: [membership('3000000000000009', 'Performance')],
    due_on: dateOffset(7), due_at: null, created_at: daysAgo(4), modified_at: daysAgo(2), num_subtasks: 1,
  },

  // Security Audit tasks
  {
    gid: '4000000000000024', name: 'Run dependency vulnerability scan', completed: false,
    assignee: { gid: '2000000000000004', name: 'Casey Chen' },
    projects: [proj('3000000000000010', 'Security Audit 2025')],
    memberships: [membership('3000000000000010', 'Automated Checks')],
    due_on: dateOffset(1), due_at: null, created_at: daysAgo(3), modified_at: daysAgo(0), num_subtasks: 0,
  },
  {
    gid: '4000000000000025', name: 'Review API authentication flow for token leaks', completed: false,
    assignee: { gid: '2000000000000005', name: 'Taylor Kim' },
    projects: [proj('3000000000000010', 'Security Audit 2025')],
    memberships: [membership('3000000000000010', 'Manual Review')],
    due_on: dateOffset(6), due_at: null, created_at: daysAgo(8), modified_at: daysAgo(3), num_subtasks: 0,
  },

  // Subtask examples
  {
    gid: '4000000000000026', name: 'Write unit tests for rate limiter', completed: false,
    assignee: { gid: '2000000000000001', name: 'Alex Morgan' },
    projects: [proj('3000000000000002', 'Engineering Sprint 24')],
    memberships: [membership('3000000000000002', 'In Progress')],
    parent: { gid: '4000000000000007', name: 'Add retry logic to webhook delivery' },
    due_on: dateOffset(2), due_at: null, created_at: daysAgo(3), modified_at: daysAgo(0), num_subtasks: 0,
  },
  {
    gid: '4000000000000027', name: 'Update dark mode token values for buttons', completed: false,
    assignee: { gid: '2000000000000003', name: 'Sam Rivera' },
    projects: [proj('3000000000000003', 'Design System'), proj('3000000000000009', 'Mobile App Refresh')],
    memberships: [membership('3000000000000003', 'Components'), membership('3000000000000009', 'Development')],
    parent: { gid: '4000000000000008', name: 'Update color token palette for dark mode' },
    due_on: dateOffset(4), due_at: null, created_at: daysAgo(2), modified_at: daysAgo(0), num_subtasks: 0,
  },
];

export function getDemoTasks(): AsanaTask[] {
  return DEMO_TASKS;
}
