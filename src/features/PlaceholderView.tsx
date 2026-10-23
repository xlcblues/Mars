import {
  ArrowLeft,
  BarChart3,
  FileText,
  FolderKanban,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { viewLabels } from "../lib/navigation";
import type { ViewId } from "../lib/navigation";

interface PlaceholderViewProps {
  view: ViewId;
  onBackToToday: () => void;
}

const placeholderMeta: Record<Exclude<ViewId, "today">, { icon: LucideIcon; copy: string }> = {
  projects: {
    icon: FolderKanban,
    copy: "把长期目标拆成清晰的项目，按状态跟进。M1 里程碑将交付项目创建、归档与筛选。",
  },
  entries: {
    icon: NotebookPen,
    copy: "按日期沉淀每一条工作记录，支持标签与附件。M1 里程碑将交付完整记录闭环。",
  },
  analytics: {
    icon: BarChart3,
    copy: "从时长、项目占比与趋势中看见时间去向。M2 里程碑将交付可视化分析。",
  },
  reports: {
    icon: FileText,
    copy: "用记录自动生成日报与周报，模板可自定义。M3 里程碑将交付生成与导出。",
  },
  ai: {
    icon: Sparkles,
    copy: "用自然语言查询数据并操作受控功能。M4 里程碑将接入大模型。",
  },
};

export function PlaceholderView({ view, onBackToToday }: PlaceholderViewProps) {
  const meta = placeholderMeta[view as Exclude<ViewId, "today">];
  const Icon = meta.icon;

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">Mars · 路线图</p>
          <h1>{viewLabels[view]}</h1>
        </div>
      </div>

      <div className="empty-card">
        <div className="empty-icon">
          <Icon size={30} strokeWidth={1.6} />
        </div>
        <p className="empty-copy">{meta.copy}</p>
        <button type="button" className="secondary-btn" onClick={onBackToToday}>
          <ArrowLeft size={16} strokeWidth={1.9} />
          <span>回到今日工作台</span>
        </button>
      </div>
    </div>
  );
}
