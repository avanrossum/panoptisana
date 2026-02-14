import { useMemo, useState, useCallback } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';

// Map Asana project colors to hex values
const PROJECT_COLORS = {
  'dark-pink': '#ea4e9d',
  'dark-green': '#62d26f',
  'dark-blue': '#4186e0',
  'dark-red': '#e8384f',
  'dark-teal': '#4ecbc4',
  'dark-brown': '#d97706',
  'dark-orange': '#fd9a00',
  'dark-purple': '#7c3aed',
  'dark-warm-gray': '#8d8d8d',
  'light-pink': '#f9aaef',
  'light-green': '#b4ec93',
  'light-blue': '#9ee7e3',
  'light-red': '#f19c8e',
  'light-teal': '#a4e3d5',
  'light-brown': '#eec300',
  'light-orange': '#fad47e',
  'light-purple': '#b9a7ff',
  'light-warm-gray': '#c7c7c7',
  'none': '#8890a0'
};

export default function ProjectList({ projects, searchQuery, myProjectsOnly, currentUserId }) {
  const filtered = useMemo(() => {
    let result = [...projects];

    // Filter to only projects the current user is a member of
    if (myProjectsOnly && currentUserId) {
      result = result.filter(p => {
        const memberGids = (p.members || []).map(m => m.gid);
        return memberGids.includes(currentUserId);
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => {
        const name = (p.name || '').toLowerCase();
        const owner = (p.owner?.name || '').toLowerCase();
        return name.includes(q) || owner.includes(q);
      });
    }

    // Sort by name
    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return result;
  }, [projects, searchQuery, myProjectsOnly, currentUserId]);

  if (filtered.length === 0 && projects.length > 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No matching projects</div>
        <div className="empty-state-text">Try a different search term.</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No projects found</div>
        <div className="empty-state-text">Waiting for data from Asana...</div>
      </div>
    );
  }

  return filtered.map(project => (
    <ProjectItem key={project.gid} project={project} />
  ));
}

function ProjectItem({ project }) {
  const [copied, setCopied] = useState(false);

  const handleOpenProject = useCallback(() => {
    const url = `https://app.asana.com/0/${project.gid}`;
    window.electronAPI.openUrl(url);
  }, [project.gid]);

  const handleCopyGid = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(project.gid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [project.gid]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    window.electronAPI.showItemContextMenu({ type: 'project', name: project.name, gid: project.gid });
  }, [project.name, project.gid]);

  const dotColor = PROJECT_COLORS[project.color] || PROJECT_COLORS.none;

  return (
    <div className="project-item" onContextMenu={handleContextMenu}>
      <span className="project-color-dot" style={{ background: dotColor }} />
      <div className="project-item-content">
        <div className="project-item-name">{project.name}</div>
        <div className="project-item-meta">
          {project.owner?.name && <span>{project.owner.name}</span>}
        </div>
      </div>
      <div className="project-item-actions">
        <button className="task-btn primary" onClick={handleOpenProject}>
          Open Project
        </button>
        <button className="task-btn secondary" onClick={handleCopyGid}>
          {copied ? 'Copied!' : 'Copy GID'}
        </button>
      </div>
    </div>
  );
}
