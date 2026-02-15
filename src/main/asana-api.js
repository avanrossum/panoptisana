// ══════════════════════════════════════════════════════════════════════════════
// ASANA API CLIENT
// Handles all communication with the Asana REST API.
// Manages polling, task/project/user fetching, and comment retrieval.
// ══════════════════════════════════════════════════════════════════════════════

// Inline filter logic (mirrors shared/filters.js — main process is CJS, can't import ESM)
function applyItemFilters(items, type, settings) {
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
    if (includePatterns.length > 0) {
      const matchesAny = includePatterns.some(p => p && name.includes(p.toLowerCase()));
      if (!matchesAny) return false;
    }
    if (gidList.includes(item.gid)) return false;
    for (const pattern of excludePatterns) {
      if (pattern && name.includes(pattern.toLowerCase())) return false;
    }
    return true;
  });
}

const BASE_URL = 'https://app.asana.com/api/1.0';
const MAX_RETRIES = 3;
const DEFAULT_MAX_SEARCH_PAGES = 20; // Default safety cap: 2,000 tasks

class AsanaAPI {
  constructor({ store, getApiKey }) {
    this._store = store;
    this._getApiKey = getApiKey;
    this._pollTimer = null;
    this._onUpdate = null;
  }

  // ── HTTP ────────────────────────────────────────────────────

  async _fetch(endpoint, options = {}, retryCount = 0) {
    const apiKey = this._getApiKey();
    if (!apiKey) throw new Error('No API key configured');

    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });

    // Handle rate limiting with Retry-After
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
      const waitMs = Math.min(retryAfter, 120) * 1000;
      console.warn(`[asana-api] Rate limited, retrying in ${retryAfter}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this._fetch(endpoint, options, retryCount + 1);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[asana-api] Error:', response.status, body);
      throw new Error(`Asana API ${response.status}: ${body}`);
    }

    return response.json();
  }

  // Paginate through all results for a given endpoint
  async _fetchAll(endpoint, options = {}) {
    let allData = [];
    let nextPage = null;
    const separator = endpoint.includes('?') ? '&' : '?';
    const limit = 100;

    do {
      const pageUrl = nextPage
        ? `${endpoint}${separator}offset=${nextPage}&limit=${limit}`
        : `${endpoint}${separator}limit=${limit}`;

      const result = await this._fetch(pageUrl, options);
      allData = allData.concat(result.data || []);
      nextPage = result.next_page?.offset || null;
    } while (nextPage);

    return allData;
  }

  // Paginate through all results for the search endpoint.
  // The search API may not support standard next_page/offset pagination.
  // Falls back to manual pagination via created_at.after when next_page is absent.
  // Requires the endpoint to sort by created_at ascending for stable ordering.
  async _fetchAllSearch(endpoint, { maxPages = DEFAULT_MAX_SEARCH_PAGES, ...options } = {}) {
    const allData = [];
    const seenGids = new Set();
    const limit = 100;
    const separator = endpoint.includes('?') ? '&' : '?';
    let offset = null;
    let afterDate = null;

    for (let page = 0; page < maxPages; page++) {
      // Build page URL
      let pageUrl = `${endpoint}${separator}limit=${limit}`;
      if (offset) {
        pageUrl += `&offset=${offset}`;
      } else if (afterDate) {
        pageUrl += `&created_at.after=${afterDate}`;
      }

      const result = await this._fetch(pageUrl, options);
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

  async verifyApiKey() {
    try {
      const result = await this._fetch('/users/me');
      return { valid: true, user: result.data };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  async getWorkspaces() {
    const result = await this._fetch('/workspaces?limit=100');
    return result.data || [];
  }

  async getUsers(workspaceGid) {
    return this._fetchAll(`/workspaces/${workspaceGid}/users?opt_fields=name,email,photo.image_60x60`);
  }

  async getTasks(workspaceGid, assigneeGid) {
    const fields = 'name,assignee.name,assignee.gid,completed,due_on,due_at,modified_at,created_at,num_subtasks,projects.name,projects.gid,memberships.section.name';
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

  async getProjects(workspaceGid) {
    const fields = 'name,archived,color,modified_at,owner.name,members.gid,current_status.title,current_status.color';
    return this._fetchAll(`/workspaces/${workspaceGid}/projects?archived=false&opt_fields=${fields}`);
  }

  async completeTask(taskGid) {
    return this._fetch(`/tasks/${taskGid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { completed: true } })
    });
  }

  async getTaskComments(taskGid) {
    const fields = 'text,html_text,created_by.name,created_at,type';
    const stories = await this._fetchAll(
      `/tasks/${taskGid}/stories?opt_fields=${fields}`
    );
    // Filter to only comments (not system stories)
    return stories.filter(s => s.type === 'comment');
  }

  // ── Polling ─────────────────────────────────────────────────

  startPolling(intervalMinutes, onUpdate, onPollStarted) {
    this._onUpdate = onUpdate;
    this._onPollStarted = onPollStarted || null;
    this.stopPolling();

    // Fetch immediately
    this._poll();

    // Then poll at interval
    const intervalMs = intervalMinutes * 60 * 1000;
    this._pollTimer = setInterval(() => this._poll(), intervalMs);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  restartPolling(intervalMinutes) {
    if (this._onUpdate) {
      this.startPolling(intervalMinutes, this._onUpdate, this._onPollStarted);
    }
  }

  /** Public entry point — use this instead of _poll() */
  async refresh() {
    return this._poll();
  }

  async _poll() {
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

      // Fetch users if not cached
      const cachedUsers = this._store.getCachedUsers();
      if (cachedUsers.length === 0) {
        const users = await this.getUsers(workspaceGid);
        this._store.setCachedUsers(users);
      }

      // Determine which users to fetch tasks for
      let tasks = [];
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
        const seen = new Set();
        for (const set of taskSets) {
          unfilteredTaskCount += set.length;
          for (const task of set) {
            if (!seen.has(task.gid) && task.assignee && selectedSet.has(task.assignee.gid)) {
              seen.add(task.gid);
              tasks.push(task);
            }
          }
        }
      } else {
        // No user filter - get all incomplete tasks in workspace
        tasks = await this.getTasks(workspaceGid, null);
        unfilteredTaskCount = tasks.length;
      }

      // Apply exclusion/inclusion filters
      tasks = this._applyFilters(tasks, 'task', settings);

      // Fetch projects
      let projects = await this.getProjects(workspaceGid);
      const unfilteredProjectCount = projects.length;
      projects = this._applyFilters(projects, 'project', settings);

      // Cache results
      this._store.setCachedTasks(tasks);
      this._store.setCachedProjects(projects);

      // Notify renderer (include unfiltered counts for status bar)
      if (this._onUpdate) {
        this._onUpdate({ tasks, projects, unfilteredTaskCount, unfilteredProjectCount });
      }
    } catch (err) {
      console.error('[asana-api] Poll failed:', err.message);
      if (this._onUpdate) {
        this._onUpdate({ error: err.message });
      }
    }
  }

  _applyFilters(items, type, settings) {
    return applyItemFilters(items, type, settings);
  }
}

module.exports = { AsanaAPI };
