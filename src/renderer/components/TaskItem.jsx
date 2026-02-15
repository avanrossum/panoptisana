import { useState, useCallback } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';
import { formatDueDate, formatRelativeTime, parseCommentSegments } from '../../shared/formatters';

/**
 * Render parsed comment segments as React elements.
 * Uses parseCommentSegments (pure logic) and wraps results in JSX.
 */
function renderCommentText(text, users) {
  const segments = parseCommentSegments(text, users);
  if (!segments) return null;

  return segments.map((seg, i) => {
    if (seg.type === 'profile') {
      return (
        <a
          key={i}
          className="comment-link comment-profile-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI.openUrl(seg.url);
          }}
          title="Open profile in Asana"
        >
          [{seg.value}]
        </a>
      );
    } else if (seg.type === 'url') {
      return (
        <a
          key={i}
          className="comment-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI.openUrl(seg.url);
          }}
          title={seg.url}
        >
          {seg.value}
        </a>
      );
    } else {
      return seg.value;
    }
  });
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
  const dueDateInfo = formatDueDate(dueDate);
  const dueDateText = dueDateInfo?.text || '';
  const isOverdue = dueDateInfo?.isOverdue || false;

  const projectName = task.projects?.[0]?.name;
  const sectionName = task.memberships?.[0]?.section?.name;

  // Format modified_at as relative time
  const modifiedText = formatRelativeTime(task.modified_at);

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
                <div className="comment-text">{renderCommentText(comment.text, cachedUsers)}</div>
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
