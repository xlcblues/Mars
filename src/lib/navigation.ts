export type ViewId =
  | "today"
  | "projects"
  | "entries"
  | "analytics"
  | "reports"
  | "ai"
  | "settings";

export const viewLabels: Record<ViewId, string> = {
  today: "今日工作台",
  projects: "项目",
  entries: "记录",
  analytics: "分析",
  reports: "日报周报",
  ai: "AI 助手",
  settings: "设置",
};
