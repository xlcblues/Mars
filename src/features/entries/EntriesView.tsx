import { useCallback, useEffect, useState } from "react";
import { Check, ListChecks, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Project, WorkEntry } from "../../lib/api";
import { api, currentWeekRange, formatMinutes, todayDateString } from "../../lib/api";
import { EntryModal } from "../../components/EntryModal";

interface EntriesViewProps {
  refreshKey: number;
}

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

interface Filters {
  startDate: string;
  endDate: string;
  projectId: string;
  tag: string;
}

function dateParts(dateStr: string): [number, number, number] {
  const [year, month, day] = dateStr.split("-").map(Number);
  return [year, month, day];
}

export function EntriesView({ refreshKey }: EntriesViewProps) {
  const [weekStart, weekEnd] = currentWeekRange();
  const [filters, setFilters] = useState<Filters>({
    startDate: weekStart,
    endDate: weekEnd,
    projectId: "",
    tag: "",
  });
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listEntries({
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        projectId: filters.projectId ? Number(filters.projectId) : null,
        tag: filters.tag.trim() || null,
      });
      setEntries(list);
    } catch (err) {
      console.error("加载记录失败", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

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
  }, [refreshKey]);

  async function deleteEntry(id: number) {
    try {
      await api.deleteEntry(id);
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      console.error("删除记录失败", err);
    }
  }

  function clearFilters() {
    setFilters({ startDate: "", endDate: "", projectId: "", tag: "" });
  }

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">工作记录</p>
          <h1>记录</h1>
          <p className="page-sub">按日期与项目筛选，把每一天的工作连成一条线。</p>
        </div>
        <div className="page-actions">
          <button type="button" className="primary-btn" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.2} />
            <span>新建记录</span>
          </button>
        </div>
      </div>

      <section className="panel filters-panel">
        <div className="filters-bar">
          <label className="filter-field">
            <span>开始日期</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>
          <label className="filter-field">
            <span>结束日期</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>
          <label className="filter-field">
            <span>项目</span>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
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
              placeholder="如：分析、指标"
              value={filters.tag}
              onChange={(e) => setFilters((prev) => ({ ...prev, tag: e.target.value }))}
            />
          </label>
          <button type="button" className="text-btn" onClick={clearFilters}>
            <X size={14} strokeWidth={1.9} />
            <span>重置</span>
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            <ListChecks size={15} strokeWidth={1.9} />
            记录列表
          </h2>
          <span className="card-count">
            {entries.length} 条 · 合计 {formatMinutes(totalMinutes)}
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="empty-text">{loading ? "加载中…" : "当前筛选条件下没有记录"}</p>
        ) : (
          <div className="entry-list">
            {entries.map((entry) => {
              const [year, month, day] = dateParts(entry.workDate);
              const weekday = WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()];
              return (
                <article className="entry-row" key={entry.id}>
                  <div className="entry-date">
                    <span className="entry-date-day">
                      {month}/{day}
                    </span>
                    <span className="entry-date-week">{weekday}</span>
                  </div>
                  <div className="entry-main">
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
                    {entry.tags && (
                      <div className="tag-row">
                        {entry.tags
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean)
                          .map((tag) => (
                            <span className="tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="entry-info">
                    <span className="entry-time-range">
                      {entry.startedAt ?? "--"} – {entry.endedAt ?? "--"}
                    </span>
                    <span className="entry-duration">{formatMinutes(entry.durationMinutes)}</span>
                    {entry.attachmentCount > 0 && (
                      <span className="entry-attach" title={`${entry.attachmentCount} 个附件`}>
                        <Paperclip size={13} strokeWidth={1.9} />
                        <span>{entry.attachmentCount}</span>
                      </span>
                    )}
                  </div>
                  <div className="row-actions">
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button
                          type="button"
                          className="text-btn danger"
                          onClick={() => void deleteEntry(entry.id)}
                        >
                          <Check size={14} strokeWidth={2} />
                          <span>确认</span>
                        </button>
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          <X size={14} strokeWidth={2} />
                          <span>取消</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="ghost-icon-btn"
                          title="编辑"
                          aria-label="编辑记录"
                          onClick={() => setEditing(entry)}
                        >
                          <Pencil size={14} strokeWidth={1.9} />
                        </button>
                        <button
                          type="button"
                          className="ghost-icon-btn danger"
                          title="删除"
                          aria-label="删除记录"
                          onClick={() => setConfirmDeleteId(entry.id)}
                        >
                          <Trash2 size={14} strokeWidth={1.9} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {creating && (
        <EntryModal
          projects={projects}
          defaultDate={todayDateString()}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
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
