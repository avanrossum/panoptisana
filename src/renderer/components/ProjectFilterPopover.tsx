import { useState, useEffect, useRef } from 'react';

interface ProjectInfo {
  gid: string;
  name: string;
  count: number;
}

interface ProjectFilterPopoverProps {
  projects: ProjectInfo[];
  selectedProjectGids: Set<string> | null;
  onSelectionChange: (selected: Set<string> | null) => void;
  onClose: () => void;
}

export default function ProjectFilterPopover({ projects, selectedProjectGids, onSelectionChange, onClose }: ProjectFilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  // Focus search input on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on click outside (but not on the parent wrapper which contains the toggle button)
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !popoverRef.current?.parentElement?.contains(target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const allSelected = selectedProjectGids === null;
  const allGids = projects.map(p => p.gid);

  const filteredProjects = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  function handleToggle(gid: string) {
    if (allSelected) {
      const next = new Set(allGids);
      next.delete(gid);
      onSelectionChange(next.size === 0 ? null : next);
    } else {
      const next = new Set(selectedProjectGids);
      if (next.has(gid)) {
        next.delete(gid);
      } else {
        next.add(gid);
      }
      if (next.size === allGids.length) {
        onSelectionChange(null);
      } else {
        onSelectionChange(next);
      }
    }
  }

  function isChecked(gid: string): boolean {
    return allSelected || selectedProjectGids!.has(gid);
  }

  return (
    <div className="section-filter-popover project-filter-popover" ref={popoverRef}>
      <div className="section-filter-header">
        <span className="section-filter-title">Projects</span>
        <div className="section-filter-actions">
          <button className="section-filter-action" onClick={() => onSelectionChange(null)}>All</button>
          <button className="section-filter-action" onClick={() => onSelectionChange(new Set())}>None</button>
        </div>
      </div>
      <div className="project-filter-search">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="project-filter-search-input"
        />
      </div>
      <div className="section-filter-list">
        {filteredProjects.map(p => (
          <label key={p.gid} className="section-filter-item">
            <input
              type="checkbox"
              checked={isChecked(p.gid)}
              onChange={() => handleToggle(p.gid)}
            />
            <span className="section-filter-name">{p.name}</span>
            <span className="section-filter-count">{p.count}</span>
          </label>
        ))}
        {filteredProjects.length === 0 && (
          <div className="section-filter-empty">No matching projects</div>
        )}
      </div>
    </div>
  );
}
