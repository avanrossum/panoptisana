import { useMemo } from 'react';
import TaskItem from './TaskItem';

export default function TaskList({ tasks, searchQuery, sortBy, selectedProjectGid, seenTimestamps, onMarkSeen, onComplete, currentUserId, cachedUsers }) {
  const filteredAndSorted = useMemo(() => {
    let result = [...tasks];

    // Filter by project
    if (selectedProjectGid) {
      result = result.filter(t =>
        (t.projects || []).some(p => p.gid === selectedProjectGid)
      );
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => {
        const name = (t.name || '').toLowerCase();
        const assignee = (t.assignee?.name || '').toLowerCase();
        const projectNames = (t.projects || []).map(p => p.name.toLowerCase()).join(' ');
        return name.includes(q) || assignee.includes(q) || projectNames.includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'modified':
          return new Date(b.modified_at || 0) - new Date(a.modified_at || 0);
        case 'due': {
          const aDue = a.due_on || a.due_at || '9999-12-31';
          const bDue = b.due_on || b.due_at || '9999-12-31';
          return new Date(aDue) - new Date(bDue);
        }
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'assignee':
          return (a.assignee?.name || '').localeCompare(b.assignee?.name || '');
        case 'created':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, searchQuery, sortBy, selectedProjectGid]);

  if (filteredAndSorted.length === 0 && tasks.length > 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No matching tasks</div>
        <div className="empty-state-text">
          {selectedProjectGid && searchQuery
            ? 'Try a different search term or project.'
            : selectedProjectGid
              ? 'No tasks in this project.'
              : 'Try a different search term.'}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No tasks found</div>
        <div className="empty-state-text">Waiting for data from Asana...</div>
      </div>
    );
  }

  return filteredAndSorted.map(task => (
    <TaskItem
      key={task.gid}
      task={task}
      lastSeenModified={seenTimestamps[task.gid]}
      onMarkSeen={onMarkSeen}
      onComplete={onComplete}
      currentUserId={currentUserId}
      cachedUsers={cachedUsers}
    />
  ));
}
