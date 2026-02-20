// ══════════════════════════════════════════════════════════════════════════════
// DEMO ASANA API
// Drop-in replacement for AsanaAPI that returns fake data with zero network traffic.
// Satisfies the AsanaAPILike interface used by main.ts and ipc-handlers.ts.
// ══════════════════════════════════════════════════════════════════════════════

import type { Store } from './store';
import type {
  AsanaUser, AsanaComment, AsanaStory, AsanaSection, AsanaField, AsanaWorkspace, AsanaAttachment, AsanaDependency,
  AsanaTask, AsanaSubtask, TaskDetail, VerifyApiKeyResult, InboxNotification,
  PollCallback, PollStartedCallback, AsanaAPILike
} from '../shared/types';
import { DEMO_WORKSPACE, DEMO_CURRENT_USER, getDemoUsers, getDemoProjects, getDemoTasks, getDemoInboxNotifications } from './demo-data';

export class DemoAsanaAPI implements AsanaAPILike {
  private _store: Store;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _onUpdate: PollCallback | null = null;
  private _onPollStarted: PollStartedCallback | null = null;

  constructor({ store }: { store: Store }) {
    this._store = store;

    // Seed cached users so the settings window user list works
    const users = getDemoUsers();
    this._store.setCachedUsers(users);

    // Seed demo membership map (in real mode, user GID ≠ membership GID;
    // for demo, use a predictable offset to simulate this)
    const membershipMap: Record<string, string> = {};
    for (const u of users) {
      membershipMap[u.gid] = `9${u.gid.substring(1)}`; // e.g. 2xxx → 9xxx
    }
    this._store.setUserMembershipMap(membershipMap);
  }

  // ── API Methods (all return fake data) ─────────────────────────

  async verifyApiKey(): Promise<VerifyApiKeyResult> {
    return { valid: true, user: DEMO_CURRENT_USER };
  }

  async getWorkspaces(): Promise<AsanaWorkspace[]> {
    return [DEMO_WORKSPACE];
  }

  async getUsers(_workspaceGid: string): Promise<AsanaUser[]> {
    return getDemoUsers();
  }

  async getTaskDetail(taskGid: string): Promise<TaskDetail> {
    // Find the demo task or return a generic one
    const tasks = getDemoTasks();
    const task = tasks.find(t => t.gid === taskGid);
    return {
      gid: task?.gid || taskGid,
      name: task?.name || 'Demo Task',
      notes: 'This is a demo task description.\n\nThe task detail panel shows the full description, subtasks, and comment history. You can navigate between subtasks and parent tasks, and post new comments with @mentions.\n\nKey features:\n- Full task description\n- Subtask navigation\n- Comment history with profile link resolution\n- Comment composer with @mention support',
      html_notes: undefined,
      completed: task?.completed || false,
      assignee: task?.assignee || null,
      projects: task?.projects,
      memberships: task?.memberships,
      parent: task?.parent,
      due_on: task?.due_on || null,
      due_at: task?.due_at || null,
      created_at: task?.created_at || new Date().toISOString(),
      modified_at: task?.modified_at || new Date().toISOString(),
      num_subtasks: task?.num_subtasks,
    };
  }

  async getTaskDependencies(_taskGid: string): Promise<AsanaDependency[]> {
    return [
      {
        gid: '7200000000000001',
        name: 'Finalize API schema',
        completed: true,
        assignee: { gid: '2000000000000002', name: 'Jordan Lee' },
      },
    ];
  }

  async getTaskDependents(_taskGid: string): Promise<AsanaDependency[]> {
    return [
      {
        gid: '7200000000000002',
        name: 'Deploy to production',
        completed: false,
        assignee: { gid: DEMO_CURRENT_USER.gid, name: DEMO_CURRENT_USER.name },
      },
    ];
  }

  async getTaskAttachments(_taskGid: string): Promise<AsanaAttachment[]> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return [
      {
        gid: '7100000000000001',
        name: 'wireframe-v2.png',
        download_url: 'https://placehold.co/800x600/2a2a2a/888?text=Wireframe+v2',
        view_url: 'https://placehold.co/800x600/2a2a2a/888?text=Wireframe+v2',
        permanent_url: null,
        host: 'asana',
        resource_subtype: 'asana',
        size: 245760,
        created_at: dayAgo.toISOString(),
      },
      {
        gid: '7100000000000002',
        name: 'screenshot-bug.jpg',
        download_url: 'https://placehold.co/400x300/1a1a2e/888?text=Bug+Screenshot',
        view_url: 'https://placehold.co/400x300/1a1a2e/888?text=Bug+Screenshot',
        permanent_url: null,
        host: 'asana',
        resource_subtype: 'asana',
        size: 102400,
        created_at: now.toISOString(),
      },
      {
        gid: '7100000000000003',
        name: 'project-brief.pdf',
        download_url: null,
        view_url: 'https://example.com/project-brief.pdf',
        permanent_url: null,
        host: 'asana',
        resource_subtype: 'asana',
        size: 1048576,
        created_at: dayAgo.toISOString(),
      },
    ];
  }

  async getSubtasks(_taskGid: string): Promise<AsanaSubtask[]> {
    return [
      {
        gid: '6000000000000001',
        name: 'Research existing solutions',
        completed: true,
        assignee: { gid: '2000000000000002', name: 'Jordan Lee' },
        due_on: '2026-02-18',
      },
      {
        gid: '6000000000000002',
        name: 'Draft implementation plan',
        completed: false,
        assignee: { gid: DEMO_CURRENT_USER.gid, name: DEMO_CURRENT_USER.name },
        due_on: '2026-02-20',
      },
      {
        gid: '6000000000000003',
        name: 'Write unit tests',
        completed: false,
        assignee: null,
        due_on: null,
      },
    ];
  }

  async addComment(_taskGid: string, text: string): Promise<AsanaComment> {
    return {
      gid: `9000000000${Date.now()}`,
      text,
      created_at: new Date().toISOString(),
      created_by: { gid: DEMO_CURRENT_USER.gid, name: DEMO_CURRENT_USER.name },
      type: 'comment',
    };
  }

  async getTaskComments(_taskGid: string): Promise<AsanaComment[]> {
    // Return a couple of sample comments for any task
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return [
      {
        gid: '9000000000000001',
        text: 'I pushed an update to the staging branch. Can you take a look when you get a chance?',
        created_at: dayAgo.toISOString(),
        created_by: { gid: '2000000000000002', name: 'Jordan Lee' },
        type: 'comment',
      },
      {
        gid: '9000000000000002',
        text: 'Looks good to me. One small suggestion: let\'s add a loading state for the empty case.',
        created_at: hourAgo.toISOString(),
        created_by: { gid: DEMO_CURRENT_USER.gid, name: DEMO_CURRENT_USER.name },
        type: 'comment',
      },
    ];
  }

  async getTaskStories(_taskGid: string): Promise<AsanaStory[]> {
    // Return a few varied demo stories for any task
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return [
      {
        gid: '9100000000000001',
        text: 'Jordan Lee assigned this task to Alex Morgan',
        created_at: dayAgo.toISOString(),
        created_by: { gid: '2000000000000002', name: 'Jordan Lee' },
        type: 'system',
        resource_subtype: 'assigned',
      },
      {
        gid: '9100000000000002',
        text: 'I pushed an update to the staging branch. Can you take a look?',
        created_at: hourAgo.toISOString(),
        created_by: { gid: '2000000000000002', name: 'Jordan Lee' },
        type: 'comment',
        resource_subtype: 'comment_added',
      },
    ];
  }

  async fetchInboxNotifications(_tasks: AsanaTask[], _currentUserId: string | null, _limit: number): Promise<InboxNotification[]> {
    return getDemoInboxNotifications();
  }

  async getProjectSections(_projectGid: string): Promise<AsanaSection[]> {
    return [
      { gid: '8000000000000001', name: 'Backlog' },
      { gid: '8000000000000002', name: 'In Progress' },
      { gid: '8000000000000003', name: 'In Review' },
      { gid: '8000000000000004', name: 'Done' },
    ];
  }

  async getProjectFields(_projectGid: string): Promise<AsanaField[]> {
    return [
      { gid: '7000000000000001', name: 'Priority', type: 'enum' },
      { gid: '7000000000000002', name: 'Story Points', type: 'number' },
      { gid: '7000000000000003', name: 'Sprint', type: 'enum' },
      { gid: '7000000000000004', name: 'Due Date Override', type: 'date' },
    ];
  }

  async completeTask(_taskGid: string): Promise<{ data: unknown }> {
    // No-op in demo mode — just return success shape
    return { data: { gid: _taskGid, completed: true } };
  }

  // ── Polling ────────────────────────────────────────────────────

  startPolling(intervalMinutes: number, onUpdate: PollCallback, onPollStarted?: PollStartedCallback): void {
    this._onUpdate = onUpdate;
    this._onPollStarted = onPollStarted || null;
    this.stopPolling();

    // Fetch immediately
    this._poll();

    // Then poll at interval
    const intervalMs = intervalMinutes * 60 * 1000;
    this._pollTimer = setInterval(() => this._poll(), intervalMs);
  }

  stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  restartPolling(intervalMinutes: number): void {
    if (this._onUpdate) {
      this.startPolling(intervalMinutes, this._onUpdate, this._onPollStarted || undefined);
    }
  }

  async refresh(): Promise<void> {
    return this._poll();
  }

  private _poll(): void {
    if (this._onPollStarted) {
      this._onPollStarted();
    }

    const tasks = getDemoTasks();
    const projects = getDemoProjects();

    // Cache in store so IPC handlers (get-tasks, get-projects) return data
    this._store.setCachedTasks(tasks);
    this._store.setCachedProjects(projects);

    if (this._onUpdate) {
      this._onUpdate({
        tasks,
        projects,
        unfilteredTaskCount: tasks.length,
        unfilteredProjectCount: projects.length,
        hasNewInboxActivity: true,
        workspaceGid: DEMO_WORKSPACE.gid,
      });
    }
  }
}
