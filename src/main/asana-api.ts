// ══════════════════════════════════════════════════════════════════════════════
// ASANA API CLIENT
// Handles all communication with the Asana REST API.
// Manages polling, task/project/user fetching, and comment retrieval.
// ══════════════════════════════════════════════════════════════════════════════

import type {
  AsanaTask, AsanaProject, AsanaUser, AsanaComment, AsanaStory, AsanaSection, AsanaField,
  AsanaWorkspace, AsanaAttachment, AsanaDependency, VerifyApiKeyResult, InboxNotification, TaskDetail, AsanaSubtask,
  PollCallback, PollStartedCallback
} from '../shared/types';
import type { Store } from './store';

const BASE_URL = 'https://app.asana.com/api/1.0';
const MAX_RETRIES = 3;
const DEFAULT_MAX_SEARCH_PAGES = 20; // Default safety cap: 2,000 tasks

interface AsanaAPIOptions {
  store: Store;
  getApiKey: () => string | null;
}

interface AsanaResponse<T = unknown> {
  data: T;
  next_page?: { offset: string } | null;
}

interface FetchAllSearchOptions extends RequestInit {
  maxPages?: number;
}

export class AsanaAPI {
  private _store: Store;
  private _getApiKey: () => string | null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _onUpdate: PollCallback | null = null;
  private _onPollStarted: PollStartedCallback | null = null;
  private _usersFetchedThisSession = false;

  constructor({ store, getApiKey }: AsanaAPIOptions) {
    this._store = store;
    this._getApiKey = getApiKey;
  }

  // ── HTTP ────────────────────────────────────────────────────

  private async _fetch<T = unknown>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<AsanaResponse<T>> {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('No API key configured');

    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const response = await fetch(url, { ...options, headers });

    // Handle rate limiting with Retry-After
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
      const waitMs = Math.min(retryAfter, 120) * 1000;
      console.warn(`[asana-api] Rate limited, retrying in ${retryAfter}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this._fetch<T>(endpoint, options, retryCount + 1);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[asana-api] Error:', response.status, body);
      throw new Error(`Asana API ${response.status}: ${body}`);
    }

    return response.json() as Promise<AsanaResponse<T>>;
  }

  // Paginate through all results for a given endpoint
  private async _fetchAll<T>(endpoint: string, options: RequestInit = {}): Promise<T[]> {
    let allData: T[] = [];
    let nextPage: string | null = null;
    const separator = endpoint.includes('?') ? '&' : '?';
    const limit = 100;

    do {
      const pageUrl: string = nextPage
        ? `${endpoint}${separator}offset=${nextPage}&limit=${limit}`
        : `${endpoint}${separator}limit=${limit}`;

      const result: AsanaResponse<T[]> = await this._fetch<T[]>(pageUrl, options);
      allData = allData.concat(result.data || []);
      nextPage = result.next_page?.offset || null;
    } while (nextPage);

    return allData;
  }

  // Paginate through all results for the search endpoint.
  // The search API may not support standard next_page/offset pagination.
  // Falls back to manual pagination via created_at.after when next_page is absent.
  // Requires the endpoint to sort by created_at ascending for stable ordering.
  private async _fetchAllSearch(
    endpoint: string,
    { maxPages = DEFAULT_MAX_SEARCH_PAGES, ...options }: FetchAllSearchOptions = {}
  ): Promise<AsanaTask[]> {
    const allData: AsanaTask[] = [];
    const seenGids = new Set<string>();
    const limit = 100;
    const separator = endpoint.includes('?') ? '&' : '?';
    let offset: string | null = null;
    let afterDate: string | null = null;

    for (let page = 0; page < maxPages; page++) {
      // Build page URL
      let pageUrl = `${endpoint}${separator}limit=${limit}`;
      if (offset) {
        pageUrl += `&offset=${offset}`;
      } else if (afterDate) {
        pageUrl += `&created_at.after=${afterDate}`;
      }

      const result = await this._fetch<AsanaTask[]>(pageUrl, options);
      const pageData = result.data || [];

      // Deduplicate by GID (search results can be unstable across pages)
      for (const item of pageData) {
        if (!seenGids.has(item.gid)) {
          seenGids.add(item.gid);
          allData.push(item);
        }
      }

      // Determine next page strategy
      if (result.next_page?.offset) {
        // Standard pagination available — use it
        offset = result.next_page.offset;
        afterDate = null;
      } else if (pageData.length >= limit) {
        // No next_page but got a full page — paginate manually via created_at
        const lastItem = pageData[pageData.length - 1];
        if (lastItem?.created_at) {
          afterDate = lastItem.created_at;
          offset = null;
        } else {
          break; // No created_at on last item — can't paginate further
        }
      } else {
        break; // Partial page — we've fetched everything
      }
    }

    if (allData.length > 0) {
      const pagesUsed = Math.ceil(allData.length / limit);
      const hitCap = pagesUsed >= maxPages;
      console.log(`[asana-api] Search fetched ${allData.length} tasks across ${pagesUsed} page(s)${hitCap ? ` (hit ${maxPages}-page cap)` : ''}`);
    }

    return allData;
  }

  // ── API Methods ─────────────────────────────────────────────

  async verifyApiKey(): Promise<VerifyApiKeyResult> {
    try {
      const result = await this._fetch<AsanaUser>('/users/me');
      return { valid: true, user: result.data };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  async getWorkspaces(): Promise<AsanaWorkspace[]> {
    const result = await this._fetch<AsanaWorkspace[]>('/workspaces?limit=100');
    return result.data || [];
  }

  async getUsers(workspaceGid: string): Promise<AsanaUser[]> {
    return this._fetchAll<AsanaUser>(`/workspaces/${workspaceGid}/users?opt_fields=name,email,photo.image_60x60`);
  }

  /**
   * Fetch workspace memberships and build a user GID → membership GID map.
   * Asana profile links use the membership GID (not user GID) in the URL path:
   * `https://app.asana.com/1/{workspaceGid}/profile/{membershipGid}`
   */
  async getUserMembershipMap(workspaceGid: string): Promise<Record<string, string>> {
    interface WorkspaceMembership { gid: string; user: { gid: string } }
    const memberships = await this._fetchAll<WorkspaceMembership>(
      `/workspaces/${workspaceGid}/workspace_memberships?opt_fields=user.gid`
    );
    const map: Record<string, string> = {};
    for (const m of memberships) {
      if (m.user?.gid) {
        map[m.user.gid] = m.gid;
      }
    }
    return map;
  }

  async getTasks(workspaceGid: string, assigneeGid: string | null): Promise<AsanaTask[]> {
    const fields = 'name,assignee.name,assignee.gid,completed,due_on,due_at,modified_at,created_at,num_subtasks,parent.name,parent.gid,projects.name,projects.gid,memberships.project.gid,memberships.section.gid,memberships.section.name';
    const assigneeParam = assigneeGid ? `&assignee=${assigneeGid}` : '';
    const settings = this._store.getSettings();
    const maxPages = settings.maxSearchPages || DEFAULT_MAX_SEARCH_PAGES;

    // Asana's search API for incomplete tasks.
    // Sort by created_at ascending for stable manual pagination
    // (created_at is immutable, unlike modified_at). Display sort
    // is handled in the renderer.
    return this._fetchAllSearch(
      `/workspaces/${workspaceGid}/tasks/search?completed=false&opt_fields=${fields}&sort_by=created_at&sort_ascending=true${assigneeParam}`,
      { maxPages }
    );
  }

  async getProjects(workspaceGid: string): Promise<AsanaProject[]> {
    const fields = 'name,archived,color,modified_at,owner.name,members.gid,current_status.title,current_status.color';
    return this._fetchAll<AsanaProject>(`/workspaces/${workspaceGid}/projects?archived=false&opt_fields=${fields}`);
  }

  async completeTask(taskGid: string): Promise<AsanaResponse> {
    return this._fetch(`/tasks/${taskGid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { completed: true } })
    });
  }

  async getProjectSections(projectGid: string): Promise<AsanaSection[]> {
    return this._fetchAll<AsanaSection>(`/projects/${projectGid}/sections?opt_fields=name`);
  }

  async getProjectFields(projectGid: string): Promise<AsanaField[]> {
    const fields = 'custom_fields.name,custom_fields.type';
    const result = await this._fetch<{ custom_fields?: { gid: string; name: string; type: string }[] }[]>(
      `/tasks?project=${projectGid}&opt_fields=${fields}&limit=1`
    );
    const task = Array.isArray(result.data) ? result.data[0] : null;
    if (!task || !task.custom_fields) return [];
    return task.custom_fields.map(cf => ({ gid: cf.gid, name: cf.name, type: cf.type }));
  }

  async getTaskDetail(taskGid: string): Promise<TaskDetail> {
    const fields = 'name,notes,html_notes,completed,assignee.name,assignee.gid,projects.name,projects.gid,memberships.project.gid,memberships.section.gid,memberships.section.name,parent.name,parent.gid,due_on,due_at,created_at,modified_at,num_subtasks';
    const result = await this._fetch<TaskDetail>(`/tasks/${taskGid}?opt_fields=${fields}`);
    return result.data;
  }

  async getSubtasks(taskGid: string): Promise<AsanaSubtask[]> {
    const fields = 'name,completed,assignee.name,assignee.gid,due_on';
    return this._fetchAll<AsanaSubtask>(`/tasks/${taskGid}/subtasks?opt_fields=${fields}`);
  }

  async getTaskAttachments(taskGid: string): Promise<AsanaAttachment[]> {
    const fields = 'name,download_url,view_url,permanent_url,host,resource_subtype,size,created_at';
    return this._fetchAll<AsanaAttachment>(`/tasks/${taskGid}/attachments?opt_fields=${fields}`);
  }

  async getTaskDependencies(taskGid: string): Promise<AsanaDependency[]> {
    const fields = 'name,completed,assignee.name,assignee.gid';
    return this._fetchAll<AsanaDependency>(`/tasks/${taskGid}/dependencies?opt_fields=${fields}`);
  }

  async getTaskDependents(taskGid: string): Promise<AsanaDependency[]> {
    const fields = 'name,completed,assignee.name,assignee.gid';
    return this._fetchAll<AsanaDependency>(`/tasks/${taskGid}/dependents?opt_fields=${fields}`);
  }

  async addComment(taskGid: string, text: string): Promise<AsanaComment> {
    const result = await this._fetch<AsanaComment>(`/tasks/${taskGid}/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { text } })
    });
    return result.data;
  }

  async getTaskComments(taskGid: string): Promise<AsanaComment[]> {
    const fields = 'text,html_text,created_by.name,created_at,type';
    const stories = await this._fetchAll<AsanaComment & { type: string }>(
      `/tasks/${taskGid}/stories?opt_fields=${fields}`
    );
    // Filter to only comments (not system stories)
    return stories.filter(s => s.type === 'comment');
  }

  private static readonly _STORY_FIELDS_EXTENDED = 'text,html_text,created_by.name,created_by.gid,created_at,type,resource_subtype,sticker_name,num_likes';
  private static readonly _STORY_FIELDS_BASE = 'text,html_text,created_by.name,created_by.gid,created_at,type,resource_subtype';
  private _useExtendedStoryFields = true;

  async getTaskStories(taskGid: string): Promise<AsanaStory[]> {
    const fields = this._useExtendedStoryFields
      ? AsanaAPI._STORY_FIELDS_EXTENDED
      : AsanaAPI._STORY_FIELDS_BASE;
    try {
      return await this._fetchAll<AsanaStory>(
        `/tasks/${taskGid}/stories?opt_fields=${fields}`
      );
    } catch (err) {
      // If the extended fields caused a failure, fall back to base fields for this
      // and all future requests in this session
      if (this._useExtendedStoryFields) {
        console.warn('[asana-api] Extended story fields failed, falling back to base fields');
        this._useExtendedStoryFields = false;
        return this._fetchAll<AsanaStory>(
          `/tasks/${taskGid}/stories?opt_fields=${AsanaAPI._STORY_FIELDS_BASE}`
        );
      }
      throw err;
    }
  }

  async fetchInboxNotifications(tasks: AsanaTask[], currentUserId: string | null, limit: number): Promise<InboxNotification[]> {
    // Filter to tasks assigned to the current user (if known)
    let candidateTasks = tasks;
    if (currentUserId) {
      candidateTasks = tasks.filter(t => t.assignee?.gid === currentUserId);
    }

    // Sort by modified_at descending, take top N
    candidateTasks.sort((a, b) => {
      const aTime = a.modified_at ? new Date(a.modified_at).getTime() : 0;
      const bTime = b.modified_at ? new Date(b.modified_at).getTime() : 0;
      return bTime - aTime;
    });
    candidateTasks = candidateTasks.slice(0, limit);

    if (candidateTasks.length === 0) return [];

    // Fetch stories with bounded concurrency (5 at a time)
    const CONCURRENCY = 5;
    const allNotifications: InboxNotification[] = [];

    for (let i = 0; i < candidateTasks.length; i += CONCURRENCY) {
      const batch = candidateTasks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (task) => {
          try {
            const stories = await this.getTaskStories(task.gid);
            return stories
              .filter(s => s.resource_subtype !== 'marked_complete')
              .map(s => ({
                storyGid: s.gid,
                taskGid: task.gid,
                taskName: task.name,
                text: s.text || '',
                createdAt: s.created_at,
                createdBy: s.created_by,
                resourceSubtype: s.resource_subtype,
                stickerName: s.sticker_name ?? undefined,
                numLikes: s.num_likes ?? undefined,
              }));
          } catch (err) {
            console.warn(`[asana-api] Failed to fetch stories for task ${task.gid}:`, (err as Error).message);
            return [];
          }
        })
      );
      for (const notifs of results) {
        allNotifications.push(...notifs);
      }
    }

    // Sort all notifications newest-first
    allNotifications.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return allNotifications;
  }

  // ── Polling ─────────────────────────────────────────────────

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

  /** Public entry point — use this instead of _poll() */
  async refresh(): Promise<void> {
    return this._poll();
  }

  private async _poll(): Promise<void> {
    try {
      const settings = this._store.getSettings();
      if (!settings.apiKeyVerified) return;

      // Notify that polling has started
      if (this._onPollStarted) {
        this._onPollStarted();
      }

      // Get workspace (use first available)
      const workspaces = await this.getWorkspaces();
      if (workspaces.length === 0) return;
      const workspaceGid = workspaces[0].gid;

      // Refresh users + membership map once per app session (handles stale cache
      // from demo mode, team membership changes, etc.)
      if (!this._usersFetchedThisSession) {
        const [users, membershipMap] = await Promise.all([
          this.getUsers(workspaceGid),
          this.getUserMembershipMap(workspaceGid),
        ]);
        this._store.setCachedUsers(users);
        this._store.setUserMembershipMap(membershipMap);
        this._usersFetchedThisSession = true;
      }

      // Determine which users to fetch tasks for
      let tasks: AsanaTask[] = [];
      let unfilteredTaskCount = 0;
      if (settings.showOnlyMyTasks && settings.currentUserId) {
        tasks = await this.getTasks(workspaceGid, settings.currentUserId);
        unfilteredTaskCount = tasks.length;
        // Asana search returns collaborator tasks too — filter to direct assignments only
        tasks = tasks.filter(t => t.assignee && t.assignee.gid === settings.currentUserId);
      } else if (settings.selectedUserIds && settings.selectedUserIds.length > 0) {
        // Fetch tasks for each selected user
        const taskSets = await Promise.all(
          settings.selectedUserIds.map(uid => this.getTasks(workspaceGid, uid))
        );
        // Merge and deduplicate by gid, filter to direct assignments only
        const selectedSet = new Set(settings.selectedUserIds);
        const seen = new Set<string>();
        for (const set of taskSets) {
          for (const task of set) {
            if (!seen.has(task.gid) && task.assignee && selectedSet.has(task.assignee.gid)) {
              seen.add(task.gid);
              tasks.push(task);
            }
          }
        }
        unfilteredTaskCount = tasks.length;
      } else {
        // No user filter - get all incomplete tasks in workspace
        tasks = await this.getTasks(workspaceGid, null);
        unfilteredTaskCount = tasks.length;
      }

      // Fetch projects
      const projects = await this.getProjects(workspaceGid);
      const unfilteredProjectCount = projects.length;

      // Cache unfiltered results — renderer applies exclusion/inclusion filters client-side
      this._store.setCachedTasks(tasks);
      this._store.setCachedProjects(projects);

      // Check for new inbox activity by comparing task modified_at against last inbox open.
      // Zero extra API calls — pure in-memory comparison on tasks we already have.
      const lastInboxOpenedAt = this._store.getLastInboxOpenedAt();
      const inboxUserId = settings.currentUserId || null;
      const candidateTasks = inboxUserId
        ? tasks.filter(t => t.assignee?.gid === inboxUserId)
        : tasks;
      const hasNewInboxActivity = candidateTasks.some(t => {
        if (!t.modified_at) return false;
        return new Date(t.modified_at).getTime() > lastInboxOpenedAt;
      });

      // Send unfiltered data to renderer (it will apply filters locally for instant feedback)
      if (this._onUpdate) {
        this._onUpdate({ tasks, projects, unfilteredTaskCount, unfilteredProjectCount, hasNewInboxActivity, workspaceGid });
      }
    } catch (err) {
      console.error('[asana-api] Poll failed:', (err as Error).message);
      if (this._onUpdate) {
        this._onUpdate({ error: (err as Error).message });
      }
    }
  }
}
