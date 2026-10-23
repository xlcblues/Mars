import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  Clock3,
  FileText,
  Flame,
  NotebookPen,
  Paperclip,
  Pencil,
  Plus,
} from "lucide-react";
import type { DashboardSummary, Project, ProjectOverview, WeekTrendPoint, WorkEntry } from "../../lib/api";
import { api, formatMinutes, todayDateString } from "../../lib/api";
import { EntryModal } from "../../components/EntryModal";

interface TodayViewProps {
  refreshKey: number;
  onQuickRecord: () => void;
}

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

function formatChineseDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${year} 年 ${month} 月 ${day} 日 · ${WEEKDAY_NAMES[date.getDay()]}`;
}

export function TodayView({ refreshKey, onQuickRecord }: TodayViewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trend, setTrend] = useState<WeekTrendPoint[]>([]);
  const [overview, setOverview] = useState<ProjectOverview[]>([]);
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayDateString();
      const [summaryData, entryList, trendData, overviewData, projectList] = await Promise.all([
        api.dashboardSummary(),
        api.listEntries({ startDate: today, endDate: today }),
        api.weekTrend(),
        api.projectOverview(),
        api.listProjects(false),
      ]);
      setSummary(summaryData);
      setEntries(entryList);
      setTrend(trendData);
      setOverview(overviewData);
      setProjects(projectList);
    } catch (err) {
      console.error("加载今日工作台失败", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const today = todayDateString();
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const maxTrend = Math.max(...trend.map((point) => point.minutes), 1);

  const stats = [
    { label: "今日记录", value: summary?.todayEntries ?? 0, unit: "条", icon: NotebookPen },
    {
      label: "今日专注",
      value: summary?.todayMinutes ? formatMinutes(summary.todayMinutes) : "0",
      unit: "",
      icon: Clock3,
    },
    { label: "本周记录", value: summary?.weekEntries ?? 0, unit: "条", icon: CalendarRange },
    { label: "连续记录", value: summary?.streakDays ?? 0, unit: "天", icon: Flame },
  ];

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">{formatChineseDate(today)}</p>
          <h1>今日工作台</h1>
          <p className="page-sub">把今天做过的事留下痕迹，让回顾水到渠成。</p>
        </div>
        <div className="page-actions">
          <button type="button" className="primary-btn" onClick={onQuickRecord}>
            <Plus size={16} strokeWidth={2.2} />
            <span>快速记录</span>
          </button>
          <button type="button" className="secondary-btn">
            <FileText size={16} strokeWidth={1.9} />
            <span>生成日报</span>
          </button>
        </div>
      </div>

      <section className="stats-grid" aria-label="今日概览">
        {stats.map(({ label, value, unit, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon">
              <Icon size={18} strokeWidth={1.9} />
            </div>
            <div className="stat-value">
              <span className="stat-num">{value}</span>
              {unit && <span className="stat-unit">{unit}</span>}
            </div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <div className="today-grid">
        <section className="card entries-card" aria-label="今日记录">
          <div className="card-head">
            <h2>今日记录</h2>
            <span className="card-count">
              {entries.length} 条 · {formatMinutes(totalMinutes)}
            </span>
          </div>
          {entries.length === 0 ? (
            <p className="empty-inline">{loading ? "加载中…" : "今天还没有记录"}</p>
          ) : (
            <div className="entries-list">
              {entries.map((entry) => (
                <article className="entry" key={entry.id}>
                  <div className="entry-time">
                    <span>{entry.startedAt ?? "--:--"}</span>
                    <span className="entry-end">{entry.endedAt ?? "--:--"}</span>
                  </div>
                  <div className="entry-body">
                    <div className="entry-title-row">
                      <h3>{entry.title}</h3>
                      {entry.projectName && (
                        <span className="project-chip">
                          <span
                            className="project-dot"
                            style={{ background: entry.projectColor ?? "#B9BFC7" }}
                          />
                          {entry.projectName}
                        </span>
                      )}
                    </div>
                    {entry.content && <p className="entry-snippet">{entry.content}</p>}
                  </div>
                  <div className="entry-meta">
                    <span className="entry-duration">{formatMinutes(entry.durationMinutes)}</span>
                    {entry.attachmentCount > 0 && (
                      <span className="entry-attach" title={`${entry.attachmentCount} 个附件`}>
                        <Paperclip size={14} strokeWidth={1.9} />
                        <span>{entry.attachmentCount}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      className="ghost-icon-btn"
                      title="编辑"
                      aria-label="编辑记录"
                      onClick={() => setEditing(entry)}
                    >
                      <Pencil size={14} strokeWidth={1.9} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="today-side">
          <section className="card" aria-label="本周趋势">
            <div className="card-head">
              <h2>本周趋势</h2>
              <span className="card-count">
                {formatMinutes(trend.reduce((sum, point) => sum + point.minutes, 0))} / 本周
              </span>
            </div>
            {trend.length === 0 ? (
              <p className="empty-inline">暂无本周数据</p>
            ) : (
              <div className="trend-chart" role="img" aria-label="本周每日专注时长柱状图">
                {trend.map((point) => {
                  const day = new Date(`${point.date}T00:00:00`).getDay();
                  const isToday = point.date === today;
                  return (
                    <div className="trend-col" key={point.date}>
                      <div className="trend-track">
                        <div
                          className={`trend-bar${isToday ? " today" : ""}`}
                          style={{ height: `${Math.max((point.minutes / maxTrend) * 100, 4)}%` }}
                          title={`${point.date} ${formatMinutes(point.minutes)}`}
                        />
                      </div>
                      <span className="trend-label">{WEEKDAY_SHORT[day]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card" aria-label="项目概览">
            <div className="card-head">
              <h2>项目概览</h2>
              <span className="card-count">{overview.length} 个项目</span>
            </div>
            {overview.length === 0 ? (
              <p className="empty-inline">暂无项目数据</p>
            ) : (
              <div className="project-list">
                {overview.map((project) => (
                  <div className="project-row" key={project.id}>
                    <div className="project-main">
                      <span
                        className="project-dot"
                        style={{ background: project.color ?? "var(--accent)" }}
                      />
                      <span className="project-name">{project.name}</span>
                      <span className="project-hours">
                        {formatMinutes(project.todayMinutes)} / 本周 {formatMinutes(project.weekMinutes)}
                      </span>
                    </div>
                    <div className="project-progress">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(project.progress, 100)}%`,
                            background: project.color ?? "var(--accent)",
                          }}
                        />
                      </div>
                      <span className="progress-value">{project.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <EntryModal
          projects={projects}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
