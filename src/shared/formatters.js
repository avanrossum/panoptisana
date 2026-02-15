// ══════════════════════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// Pure functions for formatting dates, times, and display strings.
// Extracted from components for testability.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Format a due date as a human-readable string.
 * Returns "Today", "Tomorrow", or a short date (e.g. "Jan 15").
 *
 * @param {string|null} dueOn - Due date string (YYYY-MM-DD or ISO datetime)
 * @param {Date} [now] - Reference date (defaults to current date, injectable for testing)
 * @returns {{ text: string, isOverdue: boolean } | null}
 */
export function formatDueDate(dueOn, now = new Date()) {
  if (!dueOn) return null;

  // Date-only strings (YYYY-MM-DD) are parsed as UTC by the Date constructor,
  // but we need local-date comparison. Parse manually to avoid timezone shift.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dueOn);
  const d = dateOnly
    ? new Date(parseInt(dueOn.slice(0, 4)), parseInt(dueOn.slice(5, 7)) - 1, parseInt(dueOn.slice(8, 10)))
    : new Date(dueOn);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const isOverdue = d < today;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let text;
  if (d.getTime() === today.getTime()) {
    text = 'Today';
  } else if (d.getTime() === tomorrow.getTime()) {
    text = 'Tomorrow';
  } else {
    text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { text, isOverdue };
}

/**
 * Format a timestamp as a relative time string.
 * Returns "just now", "5m ago", "2h ago", "3d ago", or a short date.
 *
 * @param {string|null} isoTimestamp - ISO 8601 timestamp
 * @param {Date} [now] - Reference date (injectable for testing)
 * @returns {string} Relative time string, or empty string if no timestamp
 */
export function formatRelativeTime(isoTimestamp, now = new Date()) {
  if (!isoTimestamp) return '';

  const date = new Date(isoTimestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Parse comment text to identify Asana profile links and general URLs.
 * Returns an array of segments: plain text strings and link descriptors.
 *
 * This is the pure logic layer — the React component wraps these segments
 * in <a> tags and click handlers.
 *
 * @param {string} text - Comment text
 * @param {Array} users - Cached workspace users [{ gid, name }]
 * @returns {Array<{ type: 'text'|'profile'|'url', value: string, userName?: string, url?: string }>|null}
 */
export function parseCommentSegments(text, users) {
  if (!text) return null;

  // Build user GID → name lookup
  const userMap = {};
  if (users && users.length > 0) {
    for (const u of users) {
      userMap[u.gid] = u.name;
    }
  }

  // Replace profile links with placeholder tokens
  const profileRegex = /https:\/\/app\.asana\.com\/\d+\/\d+\/profile\/(\d+)/g;
  const profileMatches = [];
  const processed = text.replace(profileRegex, (match, userGid) => {
    const token = `__PROFILE_${profileMatches.length}__`;
    profileMatches.push({ token, userGid, url: match });
    return token;
  });

  // Build split pattern for tokens and remaining URLs
  const allTokens = profileMatches.map(p => p.token);
  const urlRegex = /(https?:\/\/[^\s<]+)/;
  const tokenPattern = allTokens.length > 0
    ? new RegExp(`(${allTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|https?://[^\\s<]+)`)
    : urlRegex;

  const parts = processed.split(tokenPattern);
  const segments = [];

  for (const part of parts) {
    if (!part) continue;

    const profileMatch = profileMatches.find(p => p.token === part);
    if (profileMatch) {
      segments.push({
        type: 'profile',
        value: userMap[profileMatch.userGid] || 'Profile',
        userName: userMap[profileMatch.userGid] || null,
        url: profileMatch.url
      });
    } else if (/^https?:\/\//.test(part)) {
      segments.push({
        type: 'url',
        value: part.length > 50 ? part.substring(0, 50) + '...' : part,
        url: part
      });
    } else {
      segments.push({ type: 'text', value: part });
    }
  }

  return segments;
}
