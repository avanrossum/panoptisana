import { useState, useCallback } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';

/**
 * Parse Asana comment text to replace profile links with display names
 * and make other URLs clickable.
 *
 * Profile links: https://app.asana.com/0/.../.../profile/USER_GID
 * General URLs: https://... or http://...
 *
 * @param {string} text - Comment text
 * @param {Array} users - Cached workspace users [{ gid, name }]
 */
function parseCommentText(text, users) {
  if (!text) return null;

  // Build a quick lookup map for user GID → name
  const userMap = {};
  if (users && users.length > 0) {
    for (const u of users) {
      userMap[u.gid] = u.name;
    }
  }

  // Regex for Asana profile links — capture the URL and user GID
  const profileRegex = /https:\/\/app\.asana\.com\/\d+\/\d+\/profile\/(\d+)/g;
  // Regex for general URLs (must come after profile replacement)
  const urlRegex = /(https?:\/\/[^\s<]+)/g;

  // First pass: replace profile links with a placeholder token
  const profileMatches = [];
  let processed = text.replace(profileRegex, (match, userGid) => {
    const token = `__PROFILE_${profileMatches.length}__`;
    profileMatches.push({ token, userGid, url: match });
    return token;
  });

  // Second pass: split on URLs and profile tokens to build React elements
  const allTokens = profileMatches.map(p => p.token);
  const tokenPattern = allTokens.length > 0
    ? new RegExp(`(${allTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|https?://[^\\s<]+)`)
    : urlRegex;

  const parts = processed.split(tokenPattern);
  const elements = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Check if this part is a profile token
    const profileMatch = profileMatches.find(p => p.token === part);
    if (profileMatch) {
      const userName = userMap[profileMatch.userGid] || 'Profile';
      elements.push(
        <a
          key={i}
          className="comment-link comment-profile-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI.openUrl(profileMatch.url);
          }}
          title="Open profile in Asana"
        >
          [{userName}]
        </a>
      );
    } else if (/^https?:\/\//.test(part)) {
      elements.push(
        <a
          key={i}
          className="comment-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI.openUrl(part);
          }}
          title={part}
        >
          {part.length > 50 ? part.substring(0, 50) + '...' : part}
        </a>
      );
    } else {
      elements.push(part);
    }
  }

  return elements;
}

/**
 * Comment highlighting logic:
 * - We track a "lastSeenModified" timestamp per task (stored in the main process store).
 * - If the task's modified_at is newer than lastSeenModified, show highlight.
 * - When the user expands comments, we update lastSeenModified to current modified_at.
 * - If the last comment was authored by the "I am" user, suppress the highlight.
 */
export default function TaskItem({ task, lastSeenModified, onMarkSeen, onComplete, currentUserId, cachedUsers }) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comments, setComments] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suppressHighlight, setSuppressHighlight] = useState(false);
  const [completeState, setCompleteState] = useState('idle'); // idle | confirming | completing

  // Determine if task has been modified since last comment view
  const taskModified = task.modified_at ? new Date(task.modified_at).getTime() : 0;
  const seenTime = lastSeenModified ? new Date(lastSeenModified).getTime() : 0;
  const hasNewActivity = lastSeenModified !== undefined && taskModified > seenTime && !suppressHighlight;

  const handleToggleComments = useCallback(async () => {
    if (!commentsExpanded) {
      setLoadingComments(true);
      try {
        const result = await window.electronAPI.getTaskComments(task.gid);
        setComments(result);

        // Check if the last comment is from the current user
        const lastComment = result.length > 0 ? result[result.length - 1] : null;
        const isMyComment = lastComment && currentUserId &&
          lastComment.created_by?.gid === currentUserId;

        if (isMyComment) {
          setSuppressHighlight(true);
        }

        // Mark as seen with current modified_at
        onMarkSeen(task.gid, task.modified_at);
      } catch (err) {
        console.error('Failed to load comments:', err);
        setComments([]);
      }
      setLoadingComments(false);
    }
    setCommentsExpanded(!commentsExpanded);
  }, [commentsExpanded, task.gid, task.modified_at, onMarkSeen, currentUserId]);

  const handleOpenTask = useCallback(() => {
    const url = `https://app.asana.com/0/0/${task.gid}/f`;
    window.electronAPI.openUrl(url);
  }, [task.gid]);

  const handleCopyGid = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(task.gid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [task.gid]);

  const handleComplete = useCallback(async () => {
    if (completeState === 'idle') {
      setCompleteState('confirming');
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => {
        setCompleteState(prev => prev === 'confirming' ? 'idle' : prev);
      }, 3000);
      return;
    }
    if (completeState === 'confirming') {
      setCompleteState('completing');
      try {
        const result = await window.electronAPI.completeTask(task.gid);
        if (result.success) {
          onComplete(task.gid);
        } else {
          console.error('Failed to complete task:', result.error);
          setCompleteState('idle');
        }
      } catch (err) {
        console.error('Failed to complete task:', err);
        setCompleteState('idle');
      }
    }
  }, [completeState, task.gid, onComplete]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    window.electronAPI.showItemContextMenu({ type: 'task', name: task.name, gid: task.gid });
  }, [task.name, task.gid]);

  // Format due date
  const dueDate = task.due_on || task.due_at;
  let dueDateText = '';
  let isOverdue = false;
  if (dueDate) {
    const d = new Date(dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    isOverdue = d < now;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.getTime() === today.getTime()) {
      dueDateText = 'Today';
    } else if (d.getTime() === tomorrow.getTime()) {
      dueDateText = 'Tomorrow';
    } else {
      dueDateText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  const projectName = task.projects?.[0]?.name;
  const sectionName = task.memberships?.[0]?.section?.name;

  // Format modified_at as relative time or short date
  let modifiedText = '';
  if (task.modified_at) {
    const modDate = new Date(task.modified_at);
    const now = new Date();
    const diffMs = now - modDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      modifiedText = 'just now';
    } else if (diffMins < 60) {
      modifiedText = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      modifiedText = `${diffHours}h ago`;
    } else if (diffDays < 7) {
      modifiedText = `${diffDays}d ago`;
    } else {
      modifiedText = modDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  const completeLabel = completeState === 'confirming'
    ? 'Really?'
    : completeState === 'completing'
      ? 'Completing...'
      : 'Complete';

  return (
    <div className={`task-item ${hasNewActivity ? 'highlighted' : ''}`} onContextMenu={handleContextMenu}>
      <div className="task-item-header" onClick={handleToggleComments}>
        <div className="task-item-content">
          <div className="task-item-name">{task.name}</div>
          <div className="task-item-meta">
            {task.assignee && (
              <span className="task-item-assignee">{task.assignee.name}</span>
            )}
            {dueDate && (
              <span className={`task-item-due ${isOverdue ? 'overdue' : ''}`}>
                {dueDateText}
              </span>
            )}
            {modifiedText && (
              <span className="task-item-modified" title={task.modified_at}>
                {modifiedText}
              </span>
            )}
          </div>
          {projectName && (
            <div className="task-item-meta-secondary">
              <span className="task-item-project" title={projectName}>
                {sectionName ? `${projectName} / ${sectionName}` : projectName}
              </span>
            </div>
          )}
        </div>
        <div className="task-item-actions" onClick={(e) => e.stopPropagation()}>
          <button className="task-btn primary" onClick={handleOpenTask}>
            Open Task
          </button>
          <button className="task-btn secondary" onClick={handleCopyGid}>
            {copied ? 'Copied!' : 'Copy GID'}
          </button>
          <button
            className={`task-btn ${completeState === 'confirming' ? 'confirm' : 'complete'}`}
            onClick={handleComplete}
            disabled={completeState === 'completing'}
          >
            {completeLabel}
          </button>
        </div>
      </div>

      {/* Comment toggle */}
      <button className="comment-toggle" onClick={handleToggleComments}>
        <span className={`comment-toggle-icon ${commentsExpanded ? 'expanded' : ''}`}>
          <Icon path={ICON_PATHS.chevronRight} size={12} />
        </span>
        <Icon path={ICON_PATHS.comment} size={12} />
        <span>Comments</span>
        {hasNewActivity && <span className="comment-badge">New</span>}
      </button>

      {/* Comments section */}
      {commentsExpanded && (
        <div className="comments-section">
          {loadingComments ? (
            <div className="comments-loading">Loading comments...</div>
          ) : comments && comments.length > 0 ? (
            comments.slice(-5).map((comment, i) => (
              <div key={comment.gid || i} className="comment-item">
                <span className="comment-author">{comment.created_by?.name || 'Unknown'}</span>
                <span className="comment-date">
                  {new Date(comment.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  })}
                </span>
                <div className="comment-text">{parseCommentText(comment.text, cachedUsers)}</div>
              </div>
            ))
          ) : (
            <div className="comments-loading">No comments yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
