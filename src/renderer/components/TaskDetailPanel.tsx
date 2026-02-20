import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './Icon';
import CommentRenderer from './CommentRenderer';
import DescriptionRenderer from './DescriptionRenderer';
import CommentComposer from './CommentComposer';
import AttachmentGrid from './AttachmentGrid';
import { ICON_PATHS } from '../icons';
import { formatDueDate, formatRelativeTime, buildProjectMemberships } from '../../shared/formatters';
import { useCopyToClipboard, useCopyToClipboardKeyed } from '../../shared/useCopyToClipboard';
import type { AsanaUser, AsanaComment, AsanaSubtask, AsanaAttachment, AsanaDependency, TaskDetail, CompleteTaskResult } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  taskGid: string;
  cachedUsers: AsanaUser[];
  workspaceGid: string | null;
  userMembershipMap: Record<string, string>;
  onClose: () => void;
  onNavigateToTask: (taskGid: string) => void;
  onComplete: (taskGid: string) => void;
}

type CompleteState = 'idle' | 'confirming' | 'completing';

// ── Component ───────────────────────────────────────────────────

export default function TaskDetailPanel({
  taskGid, cachedUsers, workspaceGid, userMembershipMap, onClose, onNavigateToTask, onComplete
}: TaskDetailPanelProps) {
  // Section refs for jump-to navigation
  const detailsRef = useRef<HTMLDivElement>(null);
  const subtasksRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const latestCommentRef = useRef<HTMLDivElement>(null);

  // Data states
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<AsanaComment[] | null>(null);
  const [subtasks, setSubtasks] = useState<AsanaSubtask[] | null>(null);
  const [attachments, setAttachments] = useState<AsanaAttachment[] | null>(null);
  const [dependencies, setDependencies] = useState<AsanaDependency[] | null>(null);
  const [dependents, setDependents] = useState<AsanaDependency[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingSubtasks, setLoadingSubtasks] = useState(true);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  // UI states
  const [completeState, setCompleteState] = useState<CompleteState>('idle');
  const [collapsedComments, setCollapsedComments] = useState<Set<string>>(new Set());
  const [copiedGid, copyGid] = useCopyToClipboard();
  const [copiedName, copyName] = useCopyToClipboard();
  const [copiedUrl, copyUrl] = useCopyToClipboard();
  const [copiedAssigneeGid, copyAssigneeGid] = useCopyToClipboard();
  const [copiedProjectGid, copyProjectGid] = useCopyToClipboardKeyed<string>();
  const [copiedSectionGid, copySectionGid] = useCopyToClipboardKeyed<string>();

  // ── Data Fetching ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    setLoadingDetail(true);
    setLoadingComments(true);
    setLoadingSubtasks(true);
    setLoadingAttachments(true);
    setDetailError(null);
    setDetail(null);
    setComments(null);
    setSubtasks(null);
    setAttachments(null);
    setDependencies(null);
    setDependents(null);
    setCompleteState('idle');
    setCollapsedComments(new Set());

    // Fetch all in parallel
    window.electronAPI.getTaskDetail(taskGid)
      .then(d => { if (!cancelled) { setDetail(d); setLoadingDetail(false); } })
      .catch(err => { if (!cancelled) { setDetailError((err as Error).message); setLoadingDetail(false); } });

    window.electronAPI.getTaskComments(taskGid)
      .then(c => { if (!cancelled) { setComments(c); setLoadingComments(false); } })
      .catch(() => { if (!cancelled) { setComments([]); setLoadingComments(false); } });

    window.electronAPI.getSubtasks(taskGid)
      .then(s => { if (!cancelled) { setSubtasks(s); setLoadingSubtasks(false); } })
      .catch(() => { if (!cancelled) { setSubtasks([]); setLoadingSubtasks(false); } });

    window.electronAPI.getTaskAttachments(taskGid)
      .then(a => { if (!cancelled) { setAttachments(a); setLoadingAttachments(false); } })
      .catch(() => { if (!cancelled) { setAttachments([]); setLoadingAttachments(false); } });

    window.electronAPI.getTaskDependencies(taskGid)
      .then(d => { if (!cancelled) setDependencies(d); })
      .catch(() => { if (!cancelled) setDependencies([]); });

    window.electronAPI.getTaskDependents(taskGid)
      .then(d => { if (!cancelled) setDependents(d); })
      .catch(() => { if (!cancelled) setDependents([]); });

    return () => { cancelled = true; };
  }, [taskGid]);

  // ── Keyboard ───────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Handlers ───────────────────────────────────────────────

  const handleOpenInAsana = useCallback(() => {
    const url = `https://app.asana.com/0/0/${taskGid}/f`;
    window.electronAPI.openUrl(url);
  }, [taskGid]);

  const handleComplete = useCallback(async () => {
    if (completeState === 'idle') {
      setCompleteState('confirming');
      setTimeout(() => {
        setCompleteState(prev => prev === 'confirming' ? 'idle' : prev);
      }, 3000);
      return;
    }
    if (completeState === 'confirming') {
      setCompleteState('completing');
      try {
        const result: CompleteTaskResult = await window.electronAPI.completeTask(taskGid);
        if (result.success) {
          onComplete(taskGid);
          onClose();
        } else {
          console.error('Failed to complete task:', result.error);
          setCompleteState('idle');
        }
      } catch (err) {
        console.error('Failed to complete task:', err);
        setCompleteState('idle');
      }
    }
  }, [completeState, taskGid, onComplete, onClose]);

  const handleCommentAdded = useCallback((comment: AsanaComment) => {
    setComments(prev => prev ? [...prev, comment] : [comment]);
  }, []);

  const toggleCommentCollapse = useCallback((commentGid: string) => {
    setCollapsedComments(prev => {
      const next = new Set(prev);
      if (next.has(commentGid)) {
        next.delete(commentGid);
      } else {
        next.add(commentGid);
      }
      return next;
    });
  }, []);

  // ── Derived Data ───────────────────────────────────────────

  const projectMemberships = detail ? buildProjectMemberships(detail) : [];
  const dueDate = detail?.due_on || detail?.due_at;
  const dueDateInfo = formatDueDate(dueDate || null);
  const modifiedText = detail ? formatRelativeTime(detail.modified_at) : '';

  const completeLabel = completeState === 'confirming'
    ? 'Really?'
    : completeState === 'completing'
      ? 'Completing...'
      : 'Complete';

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="task-detail-overlay">
      {/* Header */}
      <div className="task-detail-header">
        <button className="task-detail-back" onClick={onClose} title="Back">
          <Icon path={ICON_PATHS.arrowLeft} size={18} />
        </button>
        <div className="task-detail-header-title">
          {loadingDetail ? 'Loading...' : detail?.name || 'Task'}
        </div>
        <div className="task-detail-header-actions">
          <button
            className={`task-btn ${completeState === 'confirming' ? 'confirm' : 'complete'}`}
            onClick={handleComplete}
            disabled={completeState === 'completing' || loadingDetail}
          >
            {completeLabel}
          </button>
          <button className="task-btn primary" onClick={handleOpenInAsana}>
            Open in Asana
          </button>
          <button className="task-btn secondary" onClick={() => copyUrl(`https://app.asana.com/0/0/${taskGid}/f`)}>
            {copiedUrl ? 'Copied!' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Jump-to Nav */}
      <div className="task-detail-nav">
        <button
          className="task-detail-nav-btn"
          onClick={() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Details
        </button>
        <button
          className="task-detail-nav-btn"
          onClick={() => subtasksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Subtasks{subtasks && subtasks.length > 0 ? ` (${subtasks.length})` : ''}
        </button>
        <button
          className="task-detail-nav-btn"
          onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          Comments{comments && comments.length > 0 ? ` (${comments.length})` : ''}
        </button>
        <button
          className="task-detail-nav-btn"
          onClick={() => latestCommentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          disabled={!comments || comments.length === 0}
        >
          Latest
        </button>
      </div>

      {/* Body */}
      <div className="task-detail-body">
        {detailError ? (
          <div className="task-detail-error">Failed to load task: {detailError}</div>
        ) : loadingDetail ? (
          <div className="task-detail-loading">Loading task details...</div>
        ) : detail ? (
          <>
            {/* Meta Section */}
            <div ref={detailsRef} className="task-detail-section task-detail-meta">
              {/* Task Name with Copy */}
              <div className="task-detail-name-row">
                <span className="task-detail-task-name">{detail.name}</span>
                <button
                  className="task-inline-copy task-inline-copy-always"
                  onClick={() => copyName(detail.name)}
                  title={copiedName ? 'Copied!' : 'Copy task name'}
                >
                  <Icon path={ICON_PATHS.copy} size={12} />
                </button>
                {copiedName && <span className="task-copied-label">Copied!</span>}
              </div>

              {/* GID with Copy */}
              <div className="task-detail-gid-row">
                <span className="task-detail-gid">{detail.gid}</span>
                <button
                  className="task-inline-copy task-inline-copy-always"
                  onClick={() => copyGid(detail.gid)}
                  title={copiedGid ? 'Copied!' : 'Copy task GID'}
                >
                  <Icon path={ICON_PATHS.copy} size={12} />
                </button>
                {copiedGid && <span className="task-copied-label">Copied!</span>}
              </div>

              {/* Assignee, Due Date, Modified */}
              <div className="task-detail-meta-row">
                {detail.assignee && (
                  <button
                    className="task-item-assignee-btn"
                    onClick={() => { if (detail.assignee?.gid) copyAssigneeGid(detail.assignee.gid); }}
                    title={copiedAssigneeGid ? 'Copied!' : `Copy assignee GID (${detail.assignee.gid})`}
                  >
                    {copiedAssigneeGid ? 'Copied!' : detail.assignee.name}
                  </button>
                )}
                {dueDate && (
                  <span className={`task-item-due ${dueDateInfo?.isOverdue ? 'overdue' : ''}`}>
                    {dueDateInfo?.text}
                  </span>
                )}
                {modifiedText && (
                  <span className="task-item-modified" title={detail.modified_at}>
                    {modifiedText}
                  </span>
                )}
              </div>

              {/* Parent Link */}
              {detail.parent && (
                <div className="task-detail-parent">
                  subtask of{' '}
                  <button
                    className="task-detail-parent-link"
                    onClick={() => onNavigateToTask(detail.parent!.gid)}
                  >
                    {detail.parent.name}
                  </button>
                </div>
              )}

              {/* Project Memberships */}
              {projectMemberships.length > 0 && (
                <div className="task-detail-projects">
                  {projectMemberships.map(pm => (
                    <div key={pm.projectGid} className="task-item-project-row">
                      <span className="task-item-project-name" title={pm.projectName}>
                        {pm.projectName}
                      </span>
                      <button
                        className="task-inline-copy task-inline-copy-always"
                        onClick={() => copyProjectGid(pm.projectGid, pm.projectGid)}
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
                              onClick={() => copySectionGid(pm.sectionGid!, pm.sectionGid!)}
                              title={copiedSectionGid === pm.sectionGid ? 'Copied!' : `Copy section GID (${pm.sectionGid})`}
                            >
                              <Icon path={ICON_PATHS.copy} size={11} />
                            </button>
                          )}
                          {copiedSectionGid === pm.sectionGid && <span className="task-copied-label">Copied!</span>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dependencies */}
              {((dependencies && dependencies.length > 0) || (dependents && dependents.length > 0)) && (
                <div className="task-detail-dependencies">
                  {dependencies && dependencies.length > 0 && (
                    <div className="task-detail-dependency-group">
                      <span className="task-detail-dependency-label">Blocked by</span>
                      {dependencies.map(dep => (
                        <button
                          key={dep.gid}
                          className={`task-detail-subtask-item ${dep.completed ? 'completed' : ''}`}
                          onClick={() => onNavigateToTask(dep.gid)}
                        >
                          <span className={`task-detail-subtask-check ${dep.completed ? 'checked' : ''}`}>
                            {dep.completed ? '\u2713' : '\u25CB'}
                          </span>
                          <span className="task-detail-subtask-name">{dep.name}</span>
                          {dep.assignee && (
                            <span className="task-detail-subtask-assignee">{dep.assignee.name}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {dependents && dependents.length > 0 && (
                    <div className="task-detail-dependency-group">
                      <span className="task-detail-dependency-label">Blocking</span>
                      {dependents.map(dep => (
                        <button
                          key={dep.gid}
                          className={`task-detail-subtask-item ${dep.completed ? 'completed' : ''}`}
                          onClick={() => onNavigateToTask(dep.gid)}
                        >
                          <span className={`task-detail-subtask-check ${dep.completed ? 'checked' : ''}`}>
                            {dep.completed ? '\u2713' : '\u25CB'}
                          </span>
                          <span className="task-detail-subtask-name">{dep.name}</span>
                          {dep.assignee && (
                            <span className="task-detail-subtask-assignee">{dep.assignee.name}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="task-detail-section">
              <div className="task-detail-section-title">Description</div>
              {detail.notes ? (
                <div className="task-detail-description">
                  <DescriptionRenderer text={detail.notes} htmlText={detail.html_notes} users={cachedUsers} membershipMap={userMembershipMap} />
                </div>
              ) : (
                <div className="task-detail-empty">No description</div>
              )}
            </div>

            {/* Attachments Section */}
            {!loadingAttachments && attachments && attachments.length > 0 && (
              <div className="task-detail-section">
                <div className="task-detail-section-title">
                  Attachments
                  <span className="task-detail-section-count">{attachments.length}</span>
                </div>
                <AttachmentGrid attachments={attachments} />
              </div>
            )}

            {/* Subtasks Section */}
            <div ref={subtasksRef} className="task-detail-section">
              <div className="task-detail-section-title">
                Subtasks
                {subtasks && subtasks.length > 0 && (
                  <span className="task-detail-section-count">{subtasks.length}</span>
                )}
              </div>
              {loadingSubtasks ? (
                <div className="task-detail-loading-inline">Loading subtasks...</div>
              ) : subtasks && subtasks.length > 0 ? (
                <div className="task-detail-subtask-list">
                  {subtasks.map(sub => (
                    <button
                      key={sub.gid}
                      className={`task-detail-subtask-item ${sub.completed ? 'completed' : ''}`}
                      onClick={() => onNavigateToTask(sub.gid)}
                    >
                      <span className={`task-detail-subtask-check ${sub.completed ? 'checked' : ''}`}>
                        {sub.completed ? '\u2713' : '\u25CB'}
                      </span>
                      <span className="task-detail-subtask-name">{sub.name}</span>
                      {sub.assignee && (
                        <span className="task-detail-subtask-assignee">{sub.assignee.name}</span>
                      )}
                      {sub.due_on && (
                        <span className="task-detail-subtask-due">
                          {formatDueDate(sub.due_on)?.text}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="task-detail-empty">No subtasks</div>
              )}
            </div>

            {/* Comments Section */}
            <div ref={commentsRef} className="task-detail-section">
              <div className="task-detail-section-title">
                Comments
                {comments && comments.length > 0 && (
                  <span className="task-detail-section-count">{comments.length}</span>
                )}
              </div>
              {loadingComments ? (
                <div className="task-detail-loading-inline">Loading comments...</div>
              ) : comments && comments.length > 0 ? (
                <div className="task-detail-comment-list">
                  {comments.map((comment, i) => {
                    const gid = comment.gid || String(i);
                    const isCollapsed = collapsedComments.has(gid);
                    const isLast = i === comments.length - 1;
                    return (
                      <div key={gid} ref={isLast ? latestCommentRef : undefined} className="comment-item">
                        <div
                          className="comment-item-header"
                          onClick={() => toggleCommentCollapse(gid)}
                        >
                          <span className="comment-author">{comment.created_by?.name || 'Unknown'}</span>
                          <span className="comment-date">
                            {new Date(comment.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}
                          </span>
                          <button
                            className={`comment-collapse-btn ${isCollapsed ? '' : 'expanded'}`}
                            onClick={(e) => { e.stopPropagation(); toggleCommentCollapse(gid); }}
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                          >
                            <Icon path={ICON_PATHS.chevronRight} size={14} />
                          </button>
                        </div>
                        {!isCollapsed && (
                          <div className="comment-text">
                            <CommentRenderer text={comment.text} htmlText={comment.html_text} users={cachedUsers} membershipMap={userMembershipMap} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="task-detail-empty">No comments yet</div>
              )}

              {/* Comment Composer */}
              <CommentComposer
                taskGid={taskGid}
                cachedUsers={cachedUsers}
                workspaceGid={workspaceGid}
                userMembershipMap={userMembershipMap}
                onCommentAdded={handleCommentAdded}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
