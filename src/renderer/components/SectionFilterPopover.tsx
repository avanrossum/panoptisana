import { useEffect, useRef } from 'react';

interface SectionInfo {
  name: string;
  count: number;
}

interface SectionFilterPopoverProps {
  sections: SectionInfo[];
  selectedSections: Set<string> | null;
  onSelectionChange: (selected: Set<string> | null) => void;
  onClose: () => void;
}

export default function SectionFilterPopover({ sections, selectedSections, onSelectionChange, onClose }: SectionFilterPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

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
    // Use capture phase so this fires before App's Escape handler
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const allSelected = selectedSections === null;
  const allNames = sections.map(s => s.name);

  function handleToggle(name: string) {
    if (allSelected) {
      // Switching from "all" to "all minus this one"
      const next = new Set(allNames);
      next.delete(name);
      onSelectionChange(next.size === 0 ? null : next);
    } else {
      const next = new Set(selectedSections);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      // If all are now selected, revert to null (no filter)
      if (next.size === allNames.length) {
        onSelectionChange(null);
      } else {
        onSelectionChange(next);
      }
    }
  }

  function isChecked(name: string): boolean {
    return allSelected || selectedSections!.has(name);
  }

  return (
    <div className="section-filter-popover" ref={popoverRef}>
      <div className="section-filter-header">
        <span className="section-filter-title">Sections</span>
        <div className="section-filter-actions">
          <button className="section-filter-action" onClick={() => onSelectionChange(null)}>All</button>
          <button className="section-filter-action" onClick={() => onSelectionChange(new Set())}>None</button>
        </div>
      </div>
      <div className="section-filter-list">
        {sections.map(s => (
          <label key={s.name} className="section-filter-item">
            <input
              type="checkbox"
              checked={isChecked(s.name)}
              onChange={() => handleToggle(s.name)}
            />
            <span className="section-filter-name">{s.name}</span>
            <span className="section-filter-count">{s.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
