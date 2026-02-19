import { useState, useCallback, type ReactNode } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';
import { formatDueDate, formatRelativeTime, parseCommentSegments } from '../../shared/formatters';
import { useCopyToClipboard, useCopyToClipboardKeyed } from '../../shared/useCopyToClipboard';
import type { AsanaTask, AsanaUser, AsanaComment, CompleteTaskResult } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface TaskItemProps {
  task: AsanaTask;
  lastSeenModified: string | undefined;
  onMarkSeen: (taskGid: string, modifiedAt: string) => void;
  onComplete: (taskGid: string) => void;
  currentUserId: string | null;
  cachedUsers: AsanaUser[];
  isPinned: boolean;
  onTogglePin: (type: 'task' | 'project', gid: string) => void;
}

type CompleteState = 'idle' | 'confirming' | 'completing';

// ── Helpers ─────────────────────────────────────────────────────

interface ProjectMembership {
  projectGid: string;
  projectName: string;
  sectionGid?: string;
  sectionName?: string;
}

/** Build enriched project list by joining projects with memberships. */
function buildProjectMemberships(task: AsanaTask): ProjectMembership[] {
  const sectionMap = new Map<string, { gid?: string; name?: string }>();
  if (task.memberships) {
    for (const m of task.memberships) {
      if (m.project?.gid && m.section) {
        sectionMap.set(m.project.gid, { gid: m.section.gid, name: m.section.name });
      }
    }
  }
  return (task.projects || []).map(p => {
    const sec = sectionMap.get(p.gid);
    return {
      projectGid: p.gid,
      projectName: p.name,
      sectionGid: sec?.gid,
      sectionName: sec?.name,
    };
  });
}

// ── Comment Rendering ───────────────────────────────────────────

/**
 * Render parsed comment segments as React elements.
 * Uses parseCommentSegments (pure logic) and wraps results in JSX.
 */
function renderCommentText(text: string | null | undefined, users: AsanaUser[]): ReactNode {
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
            window.electronAPI.openUrl(seg.url!);
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
            window.electronAPI.openUrl(seg.url!);
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

// ── Component ───────────────────────────────────────────────────

/**
 * Comment highlighting logic:
 * - We track a "lastSeenModified" timestamp per task (stored in the main process store).
 * - If the task's modified_at is newer than lastSeenModified, show highlight.
 * - When the user expands comments, we update lastSeenModified to current modified_at.
 * - If the last comment was authored by the "I am" user, suppress the highlight.
 */
export default function TaskItem({ task, lastSeenModified, onMarkSeen, onComplete, currentUserId, cachedUsers, isPinned, onTogglePin }: TaskItemProps) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comments, setComments] = useState<AsanaComment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [copiedGid, copyGid] = useCopyToClipboard();
  const [copiedName, copyName] = useCopyToClipboard();
  const [copiedUrl, copyUrl] = useCopyToClipboard();
  const [copiedAssigneeGid, copyAssigneeGid] = useCopyToClipboard();
  const [copiedProjectGid, copyProjectGid] = useCopyToClipboardKeyed<string>();
  const [copiedSectionGid, copySectionGid] = useCopyToClipboardKeyed<string>();
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [suppressHighlight, setSuppressHighlight] = useState(false);
  const [completeState, setCompleteState] = useState<CompleteState>('idle');

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
        const result: CompleteTaskResult = await window.electronAPI.completeTask(task.gid);
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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI.showItemContextMenu({ type: 'task', name: task.name, gid: task.gid });
  }, [task.name, task.gid]);

  // Format due date
  const dueDate = task.due_on || task.due_at;
  const dueDateInfo = formatDueDate(dueDate);
  const dueDateText = dueDateInfo?.text || '';
  const isOverdue = dueDateInfo?.isOverdue || false;

  // Build enriched project memberships
  const projectMemberships = buildProjectMemberships(task);

  // Collapsible project logic:
  // - Always show first (primary) project
  // - If exactly 2, show both
  // - If 3+, show first and collapse the rest behind a toggle
  const primaryProject = projectMemberships[0];
  const extraProjects = projectMemberships.slice(1);
  const showAllExtras = extraProjects.length === 1; // auto-show if only one extra
  const hasCollapsedProjects = extraProjects.length > 1;
  const visibleExtras = (showAllExtras || projectsExpanded) ? extraProjects : [];

  // Format modified_at as relative time
  const modifiedText = formatRelativeTime(task.modified_at);

  const completeLabel = completeState === 'confirming'
    ? 'Really?'
    : completeState === 'completing'
      ? 'Completing...'
      : 'Complete';

  /** Render a single project row: project name [copy] / section [copy] */
  const renderProjectRow = (pm: ProjectMembership) => (
    <div key={pm.projectGid} className="task-item-project-row">
      <span className="task-item-project-name" title={pm.projectName}>
        {pm.projectName}
      </span>
      <button
        className="task-inline-copy task-inline-copy-always"
        onClick={(e) => { e.stopPropagation(); copyProjectGid(pm.projectGid, pm.projectGid); }}
        title={copiedProjectGid === pm.projectGid ? 'Copied!' : `Copy project GID (${pm.projectGid})`}
      >
        <Icon path={ICON_PATHS.copy} size={11} />
      </button>
      {copiedProjectGid === pm.projectGid && <span className="task-copied-label">Copied!</span>}
      {pm.sectionName && (
        <>
          <span className="task-item-section-sep">/</span>
          <span className="task-item-section-label" title={pm.sectionName}>
            {pm.sectionName}
          </span>
          {pm.sectionGid && (
            <button
              className="task-inline-copy task-inline-copy-always"
              onClick={(e) => { e.stopPropagation(); copySectionGid(pm.sectionGid!, pm.sectionGid!); }}
              title={copiedSectionGid === pm.sectionGid ? 'Copied!' : `Copy section GID (${pm.sectionGid})`}
            >
              <Icon path={ICON_PATHS.copy} size={11} />
            </button>
          )}
          {copiedSectionGid === pm.sectionGid && <span className="task-copied-label">Copied!</span>}
        </>
      )}
    </div>
  );

  return (
    <div className={`task-item ${isPinned ? 'pinned' : ''} ${hasNewActivity ? 'highlighted' : ''}`} onContextMenu={handleContextMenu}>
      <div className="task-item-header" onClick={handleToggleComments}>
        <div className="task-item-content">
          {/* Task name row with copy button */}
          <div className="task-item-name-row">
            <span className="task-item-name">{task.name}</span>
            <button
              className="task-inline-copy task-inline-copy-always"
              onClick={(e) => { e.stopPropagation(); copyName(task.name); }}
              title={copiedName ? 'Copied!' : 'Copy task name'}
            >
              <Icon path={ICON_PATHS.copy} size={12} />
            </button>
            {copiedName && <span className="task-copied-label">Copied!</span>}
          </div>

          {/* GID row with copy button */}
          <div className="task-item-gid-row">
            <span className="task-item-gid">{task.gid}</span>
            <button
              className="task-inline-copy task-inline-copy-always"
              onClick={(e) => { e.stopPropagation(); copyGid(task.gid); }}
              title={copiedGid ? 'Copied!' : 'Copy task GID'}
            >
              <Icon path={ICON_PATHS.copy} size={12} />
            </button>
            {copiedGid && <span className="task-copied-label">Copied!</span>}
          </div>

          {/* Subtask indicator */}
          {task.parent && (
            <div className="task-item-parent">
              subtask of <span className="task-item-parent-name" title={task.parent.name}>{task.parent.name}</span>
            </div>
          )}

          {/* Meta row: assignee, due date, modified */}
          <div className="task-item-meta">
            {task.assignee && (
              <button
                className="task-item-assignee-btn"
                onClick={(e) => { e.stopPropagation(); if (task.assignee?.gid) copyAssigneeGid(task.assignee.gid); }}
                title={copiedAssigneeGid ? 'Copied!' : `Copy assignee GID (${task.assignee.gid})`}
              >
                {copiedAssigneeGid ? 'Copied!' : task.assignee.name}
              </button>
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

          {/* Projects list with collapsible extras */}
          {primaryProject && (
            <div className="task-item-projects">
              {renderProjectRow(primaryProject)}
              {visibleExtras.map(pm => renderProjectRow(pm))}
              {hasCollapsedProjects && (
                <button
                  className="task-item-projects-toggle"
                  onClick={(e) => { e.stopPropagation(); setProjectsExpanded(!projectsExpanded); }}
                >
                  <span className={`comment-toggle-icon ${projectsExpanded ? 'expanded' : ''}`}>
                    <Icon path={ICON_PATHS.chevronRight} size={10} />
                  </span>
                  {projectsExpanded ? 'Hide' : `+${extraProjects.length} more`}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="task-item-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className={`task-btn pin ${isPinned ? 'active' : ''}`}
            onClick={() => onTogglePin('task', task.gid)}
            title={isPinned ? 'Unpin' : 'Pin to Top'}
          >
            <Icon path={ICON_PATHS.pin} size={12} />
          </button>
          <button
            className={`task-btn ${completeState === 'confirming' ? 'confirm' : 'complete'}`}
            onClick={handleComplete}
            disabled={completeState === 'completing'}
          >
            {completeLabel}
          </button>
          <button className="task-btn primary" onClick={handleOpenTask}>
            Open Task
          </button>
          <button className="task-btn secondary" onClick={() => copyUrl(`https://app.asana.com/0/0/${task.gid}/f`)}>
            {copiedUrl ? 'Copied!' : 'Copy URL'}
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
