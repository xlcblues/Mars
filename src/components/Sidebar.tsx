import {
  BarChart3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  NotebookPen,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoMark } from "./LogoMark";
import { viewLabels } from "../lib/navigation";
import type { ViewId } from "../lib/navigation";

interface SidebarProps {
  active: ViewId;
  onSelect: (view: ViewId) => void;
  onQuickRecord: () => void;
}

const navItems: Array<{ id: ViewId; icon: LucideIcon }> = [
  { id: "today", icon: LayoutDashboard },
  { id: "projects", icon: FolderKanban },
  { id: "entries", icon: NotebookPen },
  { id: "analytics", icon: BarChart3 },
  { id: "reports", icon: FileText },
  { id: "ai", icon: Sparkles },
  { id: "settings", icon: Settings },
];

export function Sidebar({ active, onSelect, onQuickRecord }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <LogoMark size={26} />
        </span>
        <span className="brand-name">Mars</span>
      </div>

      <nav className="nav" aria-label="主导航">
        {navItems.map(({ id, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              className={`nav-item${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(id)}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{viewLabels[id]}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="primary-btn record-btn" onClick={onQuickRecord}>
          <Plus size={16} strokeWidth={2.2} />
          <span>快速记录</span>
        </button>
        <div className="sidebar-meta">
          <span className="meta-dot" aria-hidden="true" />
          <span>本地优先 · v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
