import { invoke } from "@tauri-apps/api/core";

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
