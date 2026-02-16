// ══════════════════════════════════════════════════════════════════════════════
// DEMO ASANA API
// Drop-in replacement for AsanaAPI that returns fake data with zero network traffic.
// Satisfies the AsanaAPILike interface used by main.ts and ipc-handlers.ts.
// ══════════════════════════════════════════════════════════════════════════════

import type { Store } from './store';
import type {
  AsanaUser, AsanaComment, AsanaWorkspace, VerifyApiKeyResult,
  PollCallback, PollStartedCallback, AsanaAPILike
} from '../shared/types';
import { DEMO_WORKSPACE, DEMO_CURRENT_USER, getDemoUsers, getDemoProjects, getDemoTasks } from './demo-data';

export class DemoAsanaAPI implements AsanaAPILike {
  private _store: Store;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _onUpdate: PollCallback | null = null;
  private _onPollStarted: PollStartedCallback | null = null;

  constructor({ store }: { store: Store }) {
    this._store = store;

    // Seed cached users so the settings window user list works
    this._store.setCachedUsers(getDemoUsers());
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
      });
    }
  }
}
