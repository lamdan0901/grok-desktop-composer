import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import { pathsEqual } from "@/lib/pathUtils";
import { pickProjectFolder } from "@/lib/projectFolder";
import { pushRecentProject } from "@/lib/recentProjects";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Project } from "@/lib/types";

interface ProjectPickerDropdownProps {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onAddProject: (cwd: string) => void;
}

export function ProjectPickerDropdown({
  anchorRef,
  open,
  onClose,
  activeProjectId,
  onSelectProject,
  onAddProject,
}: ProjectPickerDropdownProps) {
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const projects = useWorkspaceStore((s) => s.projects);
  const pinnedPaths = useSettingsStore((s) => s.settings.pinnedProjectPaths);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.cwd.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const position = useMemo(() => {
    const el = anchorRef.current;
    if (!el) return { left: 0, top: 0, width: 280 };
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(rect.width, 280),
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="project-picker"
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
      }}
      role="listbox"
    >
      <div className="project-picker__search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search projects"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="project-picker__list">
        {filtered.map((project) => (
          <ProjectPickerRow
            key={project.id}
            project={project}
            selected={project.id === activeProjectId}
            pinned={pinnedPaths.some((p) => pathsEqual(p, project.cwd))}
            onSelect={() => {
              onSelectProject(project.id);
              onClose();
            }}
          />
        ))}
      </ul>
      <button
        type="button"
        className="project-picker__action"
        onClick={() => {
          void (async () => {
            const cwd = await pickProjectFolder();
            if (!cwd) return;
            onAddProject(cwd);
            onClose();
          })();
        }}
      >
        <Folder size={14} />
        <span>Add new project</span>
        <ChevronRight size={14} className="project-picker__action-arrow" />
      </button>
      <button
        type="button"
        className="project-picker__action"
        onClick={() => {
          onSelectProject(null);
          onClose();
        }}
      >
        <FolderOpen size={14} />
        <span>Don&apos;t work in a project</span>
      </button>
    </div>,
    document.body,
  );
}

function ProjectPickerRow({
  project,
  selected,
  pinned,
  onSelect,
}: {
  project: Project;
  selected: boolean;
  pinned: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`project-picker__row${selected ? " project-picker__row--selected" : ""}`}
        onClick={onSelect}
      >
        <Folder size={14} />
        <span className="project-picker__row-label">{project.name}</span>
        {pinned && <span className="project-picker__pin">Pinned</span>}
        {selected && <Check size={14} className="project-picker__check" />}
      </button>
    </li>
  );
}

export function useRecordProjectOnAdd() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const settings = useSettingsStore((s) => s.settings);
  return (cwd: string) => {
    void updateSettings({
      lastProjectPaths: pushRecentProject(settings.lastProjectPaths, cwd),
    });
  };
}