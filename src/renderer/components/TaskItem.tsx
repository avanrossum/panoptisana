import { useState, useCallback } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';
import { formatDueDate, formatRelativeTime, buildProjectMemberships, type ProjectMembership } from '../../shared/formatters';
import { useCopyToClipboard, useCopyToClipboardKeyed } from '../../shared/useCopyToClipboard';
import type { AsanaTask, CompleteTaskResult } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface TaskItemProps {
  task: AsanaTask;
  lastSeenModified: string | undefined;
  onComplete: (taskGid: string) => void;
  isPinned: boolean;
  onTogglePin: (type: 'task' | 'project', gid: string) => void;
  onOpenDetail: (taskGid: string) => void;
}

type CompleteState = 'idle' | 'confirming' | 'completing';

// ── Component ───────────────────────────────────────────────────

export default function TaskItem({ task, lastSeenModified, onComplete, isPinned, onTogglePin, onOpenDetail }: TaskItemProps) {
  const [copiedGid, copyGid] = useCopyToClipboard();
  const [copiedName, copyName] = useCopyToClipboard();
  const [copiedUrl, copyUrl] = useCopyToClipboard();
  const [copiedAssigneeGid, copyAssigneeGid] = useCopyToClipboard();
  const [copiedProjectGid, copyProjectGid] = useCopyToClipboardKeyed<string>();
  const [copiedSectionGid, copySectionGid] = useCopyToClipboardKeyed<string>();
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [completeState, setCompleteState] = useState<CompleteState>('idle');

  // Determine if task has been modified since last seen
  const taskModified = task.modified_at ? new Date(task.modified_at).getTime() : 0;
  const seenTime = lastSeenModified ? new Date(lastSeenModified).getTime() : 0;
  const hasNewActivity = lastSeenModified !== undefined && taskModified > seenTime;

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
      <div className="task-item-header" onClick={() => onOpenDetail(task.gid)}>
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
            className="task-btn view"
            onClick={() => onOpenDetail(task.gid)}
            title="View task details"
          >
            <Icon path={ICON_PATHS.eye} size={12} />
            <span>View</span>
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
    </div>
  );
}
