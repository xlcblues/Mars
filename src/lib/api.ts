import { Channel, invoke } from "@tauri-apps/api/core";

export interface Project {
  id: number;
  name: string;
  color: string | null;
  status: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface WorkEntry {
  id: number;
  projectId: number | null;
  projectName: string | null;
  projectColor: string | null;
  workDate: string;
  startedAt: string | null;
  endedAt: string | null;
  title: string;
  content: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
  durationMinutes: number;
  attachmentCount: number;
}

export interface WorkEntryInput {
  id?: number | null;
  projectId?: number | null;
  workDate: string;
  startedAt?: string | null;
  endedAt?: string | null;
  title: string;
  content?: string | null;
  tags?: string | null;
}

export interface Attachment {
  id: number;
  entryId: number;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface DashboardSummary {
  todayEntries: number;
  todayMinutes: number;
  weekEntries: number;
  streakDays: number;
}

export interface WeekTrendPoint {
  date: string;
  minutes: number;
}

export interface ProjectOverview {
  id: number;
  name: string;
  color: string | null;
  todayMinutes: number;
  weekMinutes: number;
  progress: number;
}

export interface EntryFilters {
  startDate?: string | null;
  endDate?: string | null;
  projectId?: number | null;
  tag?: string | null;
}

export interface AnalyticsSummary {
  totalMinutes: number;
  entryCount: number;
  activeDays: number;
  avgMinutes: number;
}

export interface DayStatPoint {
  date: string;
  minutes: number;
  entries: number;
}

export interface ProjectShare {
  id: number;
  name: string;
  color: string | null;
  minutes: number;
  percent: number;
}

export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  projectId: number | null;
  tag: string | null;
}

export interface TemplateBlock {
  kind: string;
  title: string | null;
  content: string | null;
}

export interface ReportTemplate {
  id: number;
  name: string;
  templateType: string;
  blocks: TemplateBlock[];
  isDefault: boolean;
  updatedAt: string;
}

export interface ReportTemplateInput {
  id?: number | null;
  name: string;
  templateType: string;
  blocks: TemplateBlock[];
  isDefault?: boolean | null;
}

export interface ReportDayItem {
  date: string;
  title: string;
  content: string | null;
  projectName: string | null;
  minutes: number;
  tags: string | null;
}

export interface ReportProjectItem {
  name: string;
  minutes: number;
  entryCount: number;
}

export interface ReportStats {
  startDate: string;
  endDate: string;
  totalMinutes: number;
  entryCount: number;
  activeDays: number;
}

export interface ReportRender {
  content: string;
  notices: string[];
  stats: ReportStats;
  days: ReportDayItem[];
  projects: ReportProjectItem[];
}

export interface AiConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiChatMessage {
  role: string;
  content: string;
}

export interface AiActionSaveEntry {
  type: "saveEntry";
  entry: WorkEntryInput;
}

export interface AiActionDeleteEntry {
  type: "deleteEntry";
  id: number;
}

export interface AiActionCreateProject {
  type: "createProject";
  name: string;
  color?: string | null;
}

export interface AiActionArchiveProject {
  type: "archiveProject";
  id: number;
}

export type AiAction =
  | AiActionSaveEntry
  | AiActionDeleteEntry
  | AiActionCreateProject
  | AiActionArchiveProject;

export interface AiChatResponse {
  text: string;
  actions: AiAction[];
}

export interface AiApplyResult {
  applied: number;
  message: string;
}

export interface AiStreamEventDelta {
  type: "delta";
  text: string;
}

export interface AiStreamEventDone {
  type: "done";
  actions: AiAction[];
}

export type AiStreamEvent = AiStreamEventDelta | AiStreamEventDone;

export interface AiSessionMeta {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiSession {
  id: number;
  title: string;
  messagesJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiToolLog {
  id: number;
  sessionId: string | null;
  toolName: string;
  argsJson: string | null;
  status: string;
  createdAt: string;
}

export interface LocalDataInfo {
  dataDir: string;
  dbPath: string;
  attachmentsPath: string;
  dbSize: number;
  attachmentCount: number;
  attachmentBytes: number;
}

export interface BackupInfo {
  path: string;
  createdAt: string;
  dbSize: number;
  attachmentCount: number;
  attachmentBytes: number;
}

export interface RestoreInfo {
  message: string;
  backupPath: string;
  restoredAt: string;
}

export const api = {
  listProjects: (includeArchived = false) =>
    invoke<Project[]>("list_projects", { includeArchived }),
  createProject: (name: string, color: string) =>
    invoke<Project>("create_project", { name, color }),
  updateProject: (id: number, name: string, color: string) =>
    invoke<Project>("update_project", { id, name, color }),
  archiveProject: (id: number) => invoke<void>("archive_project", { id }),
  restoreProject: (id: number) => invoke<void>("restore_project", { id }),

  listEntries: (filters: EntryFilters = {}) =>
    invoke<WorkEntry[]>("list_entries", {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      projectId: filters.projectId ?? null,
      tag: filters.tag ?? null,
    }),
  saveEntry: (entry: WorkEntryInput) => invoke<WorkEntry>("save_entry", { entry }),
  deleteEntry: (id: number) => invoke<void>("delete_entry", { id }),

  addAttachment: (entryId: number, filePath: string, fileName: string, mimeType?: string) =>
    invoke<Attachment>("add_attachment", { entryId, filePath, fileName, mimeType }),
  listAttachments: (entryId: number) => invoke<Attachment[]>("list_attachments", { entryId }),
  openAttachment: (id: number) => invoke<void>("open_attachment", { id }),
  deleteAttachment: (id: number) => invoke<void>("delete_attachment", { id }),

  dashboardSummary: () => invoke<DashboardSummary>("dashboard_summary"),
  weekTrend: () => invoke<WeekTrendPoint[]>("week_trend"),
  projectOverview: () => invoke<ProjectOverview[]>("project_overview"),
  weekRange: () => invoke<[string, string]>("week_range"),

  analyticsSummary: (filters: AnalyticsFilters) =>
    invoke<AnalyticsSummary>("analytics_summary", {
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectId: filters.projectId,
      tag: filters.tag,
    }),
  dailyTrend: (filters: AnalyticsFilters) =>
    invoke<DayStatPoint[]>("daily_trend", {
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectId: filters.projectId,
      tag: filters.tag,
    }),
  projectShare: (filters: AnalyticsFilters) =>
    invoke<ProjectShare[]>("project_share", {
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectId: filters.projectId,
      tag: filters.tag,
    }),
  exportAnalytics: (format: "csv" | "json", filters: AnalyticsFilters, targetPath: string) =>
    invoke<string>("export_analytics", {
      format,
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectId: filters.projectId,
      tag: filters.tag,
      targetPath,
    }),

  listReportTemplates: (templateType?: string | null) =>
    invoke<ReportTemplate[]>("list_report_templates", {
      templateType: templateType ?? null,
    }),
  saveReportTemplate: (input: ReportTemplateInput) =>
    invoke<ReportTemplate>("save_report_template", { input }),
  deleteReportTemplate: (id: number) => invoke<void>("delete_report_template", { id }),
  renderReport: (
    reportType: string,
    startDate: string,
    endDate: string,
    templateId: number | null,
  ) =>
    invoke<ReportRender>("render_report", {
      reportType,
      startDate,
      endDate,
      templateId,
    }),
  exportReport: (
    format: "md" | "html" | "pdf",
    reportType: string,
    startDate: string,
    endDate: string,
    templateId: number | null,
    targetPath: string,
    content: string | null,
  ) =>
    invoke<string>("export_report", {
      format,
      reportType,
      startDate,
      endDate,
      templateId,
      targetPath,
      content,
    }),

  localDataInfo: () => invoke<LocalDataInfo>("local_data_info"),
  createBackup: (targetDir: string) =>
    invoke<BackupInfo>("create_backup", { targetDir }),
  restoreBackup: (backupDir: string) =>
    invoke<RestoreInfo>("restore_backup", { backupDir }),

  getAiConfig: () => invoke<AiConfig | null>("get_ai_config"),
  saveAiConfig: (config: AiConfig) => invoke<AiConfig>("save_ai_config", { config }),
  testAiConnection: () => invoke<string>("test_ai_connection"),
  listAiSessions: () => invoke<AiSessionMeta[]>("list_ai_sessions"),
  getAiSession: (id: number) => invoke<AiSession | null>("get_ai_session", { id }),
  saveAiSession: (id: number | null, title: string, messagesJson: string) =>
    invoke<AiSession>("save_ai_session", { id, title, messagesJson }),
  deleteAiSession: (id: number) => invoke<boolean>("delete_ai_session", { id }),
  listAiToolLogs: (limit = 50) => invoke<AiToolLog[]>("list_ai_tool_logs", { limit }),
  aiApplyActions: (sessionId: string | null, actions: AiAction[]) =>
    invoke<AiApplyResult>("ai_apply_actions", { sessionId, actions }),
  aiChatStream: (
    prompt: string,
    history: AiChatMessage[],
    onEvent: (event: AiStreamEvent) => void,
  ) => {
    const channel = new Channel<AiStreamEvent>();
    channel.onmessage = onEvent;
    return invoke<AiChatResponse>("ai_chat_stream", { prompt, history, channel });
  },
  polishReport: (
    reportType: string,
    markdown: string,
    onEvent: (event: AiStreamEvent) => void,
  ) => {
    const channel = new Channel<AiStreamEvent>();
    channel.onmessage = onEvent;
    return invoke<string>("ai_polish_report_stream", { reportType, markdown, channel });
  },
};

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
}

export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentWeekRange(): [string, string] {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [toDateInput(monday), toDateInput(sunday)];
}

export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || path;
}

export function formatFileSize(size: number | null): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
