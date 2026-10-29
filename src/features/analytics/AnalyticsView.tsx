import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  NotebookPen,
  X,
} from "lucide-react";
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  DayStatPoint,
  Project,
  ProjectShare,
} from "../../lib/api";
import { api, formatMinutes, todayDateString } from "../../lib/api";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const TREND_WINDOWS = [
  { days: 7, label: "7天" },
  { days: 14, label: "14天" },
  { days: 30, label: "30天" },
  { days: 0, label: "全部" },
];

interface HeatCell {
  date: string;
  minutes: number;
  entries: number;
  inRange: boolean;
}

interface HeatWeek {
  label: string;
  days: HeatCell[];
}

function monthRange(): AnalyticsFilters {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  return {
    startDate: `${year}-${month}-01`,
    endDate: todayDateString(),
    projectId: null,
    tag: null,
  };
}

function normalizeFilters(filters: AnalyticsFilters): AnalyticsFilters {
  return {
    ...filters,
    startDate: filters.startDate || "1970-01-01",
    endDate: filters.endDate || "2099-12-31",
    tag: filters.tag?.trim() ? filters.tag.trim() : null,
  };
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function buildHeatWeeks(points: DayStatPoint[]): HeatWeek[] {
  if (points.length === 0) return [];
  const first = parseDate(points[0].date);
  const last = parseDate(points[points.length - 1].date);
  const byDate = new Map(points.map((point) => [point.date, point]));
  const mondayOffset = (first.getDay() + 6) % 7;
  const weekStart = new Date(first);
  weekStart.setDate(first.getDate() - mondayOffset);
  const cursor = new Date(weekStart);
  const weeks: HeatWeek[] = [];
  while (cursor <= last) {
    const days: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = toDateInput(cursor);
      const point = byDate.get(dateStr);
      days.push({
        date: dateStr,
        minutes: point?.minutes ?? 0,
        entries: point?.entries ?? 0,
        inRange: Boolean(point),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({ label: formatShortDate(days[0].date), days });
  }
  return weeks;
}

function heatColor(intensity: number): string {
  const dark = document.documentElement.dataset.theme === "dark";
  const rgb = dark ? "255,107,61" : "195,69,31";
  const alpha = Math.min(0.08 + intensity * 0.85, 0.95);
  return `rgba(${rgb}, ${alpha})`;
}

export function AnalyticsView() {
  const [filters, setFilters] = useState<AnalyticsFilters>(monthRange);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<DayStatPoint[]>([]);
  const [share, setShare] = useState<ProjectShare[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = normalizeFilters(filters);
      const [summaryData, trendData, shareData] = await Promise.all([
        api.analyticsSummary(payload),
        api.dailyTrend(payload),
        api.projectShare(payload),
      ]);
      setSummary(summaryData);
      setTrend(trendData);
      setShare(shareData);
    } catch (err) {
      console.error("加载分析数据失败", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    api
      .listProjects(false)
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTrend = useMemo(
    () => (trendDays > 0 ? trend.slice(-trendDays) : trend),
    [trend, trendDays],
  );
  const heatWeeks = useMemo(() => buildHeatWeeks(trend), [trend]);
  const heatMax = useMemo(() => Math.max(...trend.map((point) => point.minutes), 1), [trend]);
  const trendMax = useMemo(
    () => Math.max(...visibleTrend.map((point) => point.minutes), 1),
    [visibleTrend],
  );
  const today = todayDateString();

  function setField<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(monthRange());
  }

  const rangeLabel =
    filters.startDate && filters.endDate
      ? `${formatShortDate(filters.startDate)} – ${formatShortDate(filters.endDate)}`
      : "全部时间";

  const stats = [
    {
      label: "专注时长",
      value: summary ? formatMinutes(summary.totalMinutes) : "0",
      icon: Clock3,
    },
    {
      label: "记录条数",
      value: summary ? String(summary.entryCount) : "0",
      icon: NotebookPen,
    },
    {
      label: "活跃天数",
      value: summary ? String(summary.activeDays) : "0",
      icon: CalendarDays,
    },
    {
      label: "日均专注",
      value: summary ? formatMinutes(Math.round(summary.avgMinutes)) : "0",
      icon: Activity,
    },
  ];

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">数据分析</p>
          <h1>分析</h1>
          <p className="page-sub">从时长、趋势与分布里看清时间的去向。</p>
        </div>
      </div>

      <section className="panel filters-panel">
        <div className="filters-bar">
          <label className="filter-field">
            <span>开始日期</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>结束日期</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>项目</span>
            <select
              value={filters.projectId ?? ""}
              onChange={(e) =>
                setField("projectId", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">全部项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>标签</span>
            <input
              type="text"
              placeholder="如：开发、联调"
              value={filters.tag ?? ""}
              onChange={(e) => setField("tag", e.target.value)}
            />
          </label>
          <button type="button" className="text-btn" onClick={resetFilters}>
            <X size={14} strokeWidth={1.9} />
            <span>重置</span>
          </button>
        </div>
      </section>

      <section className="stats-grid" aria-label="分析概览">
        {stats.map(({ label, value, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon">
              <Icon size={18} strokeWidth={1.9} />
            </div>
            <div className="stat-value">
              <span className="stat-num">{value}</span>
            </div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <div className="analytics-grid">
        <section className="card" aria-label="每日趋势">
          <div className="card-head">
            <h2>每日趋势</h2>
            <div className="card-head-tools">
              <div className="trend-period" role="group" aria-label="趋势周期">
                {TREND_WINDOWS.map((window) => (
                  <button
                    type="button"
                    key={window.days}
                    className={`period-btn${trendDays === window.days ? " active" : ""}`}
                    onClick={() => setTrendDays(window.days)}
                  >
                    {window.label}
                  </button>
                ))}
              </div>
              <span className="card-count">{rangeLabel}</span>
            </div>
          </div>
          {visibleTrend.length === 0 ? (
            <p className="empty-inline">{loading ? "加载中…" : "当前条件下没有数据"}</p>
          ) : (
            <div className="analytics-trend-scroll">
              <div className="analytics-trend">
                {visibleTrend.map((point) => (
                  <div
                    className="trend-col"
                    key={point.date}
                    title={`${point.date} · ${formatMinutes(point.minutes)} · ${point.entries} 条`}
                  >
                    <div className="trend-track">
                      <div
                        className={`trend-bar${point.date === today ? " today" : ""}`}
                        style={{
                          height: `${Math.max((point.minutes / trendMax) * 100, point.minutes > 0 ? 8 : 2)}%`,
                        }}
                      />
                    </div>
                    <span className="trend-label">{formatShortDate(point.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card" aria-label="项目占比">
          <div className="card-head">
            <h2>项目占比</h2>
            <span className="card-count">{share.length} 个项目</span>
          </div>
          {share.length === 0 ? (
            <p className="empty-inline">{loading ? "加载中…" : "当前条件下没有项目数据"}</p>
          ) : (
            <div className="project-list">
              {share.map((item) => (
                <div className="project-row" key={item.id}>
                  <div className="project-main">
                    <span
                      className="project-dot"
                      style={{ background: item.color ?? "var(--accent)" }}
                    />
                    <span className="project-name">{item.name}</span>
                    <span className="project-hours">{formatMinutes(item.minutes)}</span>
                  </div>
                  <div className="project-progress">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(item.percent, 100)}%`,
                          background: item.color ?? "var(--accent)",
                        }}
                      />
                    </div>
                    <span className="progress-value">{item.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card heatmap-card" aria-label="专注热力图">
        <div className="card-head">
          <h2>专注热力图</h2>
          <span className="card-count">{heatWeeks.length} 周</span>
        </div>
        {heatWeeks.length === 0 ? (
          <p className="empty-inline">{loading ? "加载中…" : "当前条件下没有可展示的热力图"}</p>
        ) : (
          <div className="heatmap">
            <div className="heatmap-weekdays">
              <span />
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="heatmap-body">
              {heatWeeks.map((week) => (
                <div className="heatmap-week" key={week.label}>
                  <span className="heatmap-week-label">{week.label}</span>
                  <div className="heatmap-cells">
                    {week.days.map((cell) => (
                      <div
                        key={cell.date}
                        className={`heat-cell${cell.minutes > 0 ? " active" : ""}${
                          cell.inRange ? "" : " muted"
                        }`}
                        style={
                          cell.minutes > 0
                            ? { background: heatColor(cell.minutes / heatMax) }
                            : undefined
                        }
                        title={`${cell.date} · ${formatMinutes(cell.minutes)}${
                          cell.entries > 0 ? ` · ${cell.entries} 条` : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="heatmap-legend">
              <span>少</span>
              <span className="legend-swatch low" />
              <span className="legend-swatch mid" />
              <span className="legend-swatch high" />
              <span>多</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
