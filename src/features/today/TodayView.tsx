import {
  ArrowUpRight,
  CalendarRange,
  Clock3,
  FileText,
  Flame,
  NotebookPen,
  Paperclip,
  Plus,
} from "lucide-react";

interface DemoEntry {
  start: string;
  end: string;
  title: string;
  project: string;
  snippet: string;
  minutes: number;
  attachments: number;
}

interface DemoProject {
  name: string;
  dot: string;
  today: string;
  week: string;
  progress: number;
}

const demoEntries: DemoEntry[] = [
  {
    start: "09:30",
    end: "10:30",
    title: "首页 Hero 区块响应式布局",
    project: "官网改版",
    snippet: "完成首屏与导航的移动端适配，修复 320px 宽度下的折叠菜单问题。",
    minutes: 60,
    attachments: 2,
  },
  {
    start: "11:00",
    end: "11:45",
    title: "梳理日活指标口径",
    project: "数据看板",
    snippet: "对齐日活、留存两套口径，输出数据字典初稿并同步给团队。",
    minutes: 45,
    attachments: 0,
  },
  {
    start: "14:00",
    end: "15:30",
    title: "实现工作记录时间线视图",
    project: "Mars 桌面端",
    snippet: "完成今日工作台左侧记录列表，与本地 SQLite 查询层完成首轮联调。",
    minutes: 90,
    attachments: 1,
  },
];

const demoProjects: DemoProject[] = [
  { name: "Mars 桌面端", dot: "var(--accent)", today: "2.5h", week: "11h", progress: 62 },
  { name: "官网改版", dot: "var(--slate)", today: "1.0h", week: "4h", progress: 35 },
  { name: "数据看板", dot: "var(--success)", today: "0.8h", week: "6h", progress: 48 },
  { name: "团队协作", dot: "var(--warning)", today: "0.2h", week: "2h", progress: 18 },
];

const weekTrend = [
  { label: "一", value: 2.0 },
  { label: "二", value: 4.0 },
  { label: "三", value: 3.5 },
  { label: "四", value: 5.0 },
  { label: "五", value: 4.0 },
  { label: "六", value: 2.0 },
  { label: "日", value: 3.0 },
];

const maxTrend = Math.max(...weekTrend.map((d) => d.value));

const stats = [
  { label: "今日记录", value: "3", unit: "条", icon: NotebookPen },
  { label: "今日专注", value: "4.5", unit: "小时", icon: Clock3 },
  { label: "本周记录", value: "18", unit: "条", icon: CalendarRange },
  { label: "连续记录", value: "6", unit: "天", icon: Flame },
];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
}

export function TodayView() {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">2026 年 10 月 22 日 · 星期四</p>
          <h1>今日工作台</h1>
          <p className="page-sub">把今天做过的事留下痕迹，让回顾水到渠成。</p>
        </div>
        <div className="page-actions">
          <button type="button" className="primary-btn">
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
              <span className="stat-unit">{unit}</span>
            </div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <div className="today-grid">
        <section className="card entries-card" aria-label="今日记录">
          <div className="card-head">
            <h2>今日记录</h2>
            <span className="card-count">3 条 · 3.3h</span>
          </div>
          <div className="entries-list">
            {demoEntries.map((entry) => (
              <article className="entry" key={entry.title}>
                <div className="entry-time">
                  <span>{entry.start}</span>
                  <span className="entry-end">{entry.end}</span>
                </div>
                <div className="entry-body">
                  <div className="entry-title-row">
                    <h3>{entry.title}</h3>
                    <span className="tag">{entry.project}</span>
                  </div>
                  <p className="entry-snippet">{entry.snippet}</p>
                </div>
                <div className="entry-meta">
                  <span className="entry-duration">{formatMinutes(entry.minutes)}</span>
                  {entry.attachments > 0 && (
                    <span className="entry-attach" title={`${entry.attachments} 个附件`}>
                      <Paperclip size={14} strokeWidth={1.9} />
                      <span>{entry.attachments}</span>
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="today-side">
          <section className="card" aria-label="本周趋势">
            <div className="card-head">
              <h2>本周趋势</h2>
              <span className="card-count">合计 23.5h</span>
            </div>
            <div className="trend-chart" role="img" aria-label="本周每日专注时长柱状图，周四最高 5 小时">
              {weekTrend.map((day, index) => (
                <div className="trend-col" key={day.label}>
                  <div className="trend-track">
                    <div
                      className={`trend-bar${index === 6 ? " today" : ""}`}
                      style={{ height: `${(day.value / maxTrend) * 100}%` }}
                      title={`${day.label} ${day.value}h`}
                    />
                  </div>
                  <span className="trend-label">{day.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card" aria-label="项目概览">
            <div className="card-head">
              <h2>项目概览</h2>
              <button type="button" className="ghost-icon-btn" aria-label="查看全部项目" title="查看全部项目">
                <ArrowUpRight size={15} strokeWidth={1.9} />
              </button>
            </div>
            <div className="project-list">
              {demoProjects.map((project) => (
                <div className="project-row" key={project.name}>
                  <div className="project-main">
                    <span className="project-dot" style={{ background: project.dot }} />
                    <span className="project-name">{project.name}</span>
                    <span className="project-hours">{project.today} / 本周 {project.week}</span>
                  </div>
                  <div className="project-progress">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${project.progress}%`, background: project.dot }}
                      />
                    </div>
                    <span className="progress-value">{project.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
