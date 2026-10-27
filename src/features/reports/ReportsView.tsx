import { useCallback, useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  Download,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type {
  ReportRender,
  ReportTemplate,
  ReportTemplateInput,
  TemplateBlock,
} from "../../lib/api";
import {
  api,
  currentWeekRange,
  fileNameFromPath,
  formatMinutes,
  todayDateString,
} from "../../lib/api";

type ReportType = "daily" | "weekly";

const BLOCK_OPTIONS: Array<{ kind: string; label: string; hint: string }> = [
  { kind: "summary", label: "概览", hint: "统计时长、条数与有效天数" },
  { kind: "daily_list", label: "工作记录", hint: "按日期列出每条记录" },
  { kind: "project_summary", label: "项目汇总", hint: "按项目聚合时长与条数" },
  { kind: "todo_next", label: "计划与待办", hint: "自定义下一阶段计划" },
];

function defaultBlocks(reportType: ReportType): TemplateBlock[] {
  if (reportType === "weekly") {
    return [
      { kind: "summary", title: "本周概览", content: null },
      { kind: "daily_list", title: "每日记录", content: null },
      { kind: "project_summary", title: "项目汇总", content: null },
      { kind: "todo_next", title: "下周计划", content: "（待补充）" },
    ];
  }
  return [
    { kind: "summary", title: "今日概览", content: null },
    { kind: "daily_list", title: "工作记录", content: null },
    { kind: "project_summary", title: "项目汇总", content: null },
    { kind: "todo_next", title: "明日计划", content: "（待补充）" },
  ];
}

function blockLabel(kind: string): string {
  return BLOCK_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}

export function ReportsView() {
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [startDate, setStartDate] = useState(todayDateString());
  const [endDate, setEndDate] = useState(todayDateString());
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [render, setRender] = useState<ReportRender | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState<"md" | "html" | null>(null);
  const [note, setNote] = useState("");
  const [designerOpen, setDesignerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftBlocks, setDraftBlocks] = useState<TemplateBlock[]>([]);
  const [draftDefault, setDraftDefault] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const reportTypeLabel = reportType === "weekly" ? "周报" : "日报";

  function switchReportType(next: ReportType) {
    setReportType(next);
    if (next === "weekly") {
      const [start, end] = currentWeekRange();
      setStartDate(start);
      setEndDate(end);
    } else {
      setStartDate(todayDateString());
      setEndDate(todayDateString());
    }
  }

  const loadTemplates = useCallback(async (nextType: ReportType) => {
    try {
      const list = await api.listReportTemplates(nextType);
      setTemplates(list);
      const picked = list.find((item) => item.isDefault) ?? list[0];
      setActiveTemplateId(picked?.id ?? null);
      return picked?.id ?? null;
    } catch (err) {
      setNote(`加载模板失败：${String(err)}`);
      return null;
    }
  }, []);

  const doRender = useCallback(
    async (nextType: ReportType, nextStart: string, nextEnd: string, templateId: number | null) => {
      if (!templateId) return;
      setRendering(true);
      try {
        const result = await api.renderReport(nextType, nextStart, nextEnd, templateId);
        setRender(result);
      } catch (err) {
        setNote(`生成失败：${String(err)}`);
      } finally {
        setRendering(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const templateId = await loadTemplates(reportType);
      const start = reportType === "weekly" ? currentWeekRange()[0] : todayDateString();
      const end = reportType === "weekly" ? currentWeekRange()[1] : todayDateString();
      if (!cancelled) {
        setStartDate(start);
        setEndDate(end);
      }
      await doRender(reportType, start, end, templateId);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportType, loadTemplates, doRender]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(""), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  function openNewDesigner() {
    setEditingTemplate(null);
    setDraftName(reportType === "weekly" ? "默认周报" : "默认日报");
    setDraftBlocks(defaultBlocks(reportType));
    setDraftDefault(true);
    setDesignerOpen(true);
    setPaletteOpen(false);
  }

  function openEditDesigner(template: ReportTemplate) {
    setEditingTemplate(template);
    setDraftName(template.name);
    setDraftBlocks(template.blocks.map((block) => ({ ...block })));
    setDraftDefault(template.isDefault);
    setDesignerOpen(true);
    setPaletteOpen(false);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setDraftBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateBlock(index: number, patch: Partial<TemplateBlock>) {
    setDraftBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
  }

  function removeBlock(index: number) {
    setDraftBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlock(kind: string) {
    setDraftBlocks((prev) => [
      ...prev,
      {
        kind,
        title: blockLabel(kind),
        content: kind === "todo_next" ? "（待补充）" : null,
      },
    ]);
    setPaletteOpen(false);
  }

  async function saveDesigner() {
    if (!draftName.trim()) {
      setNote("模板名称不能为空");
      return;
    }
    if (draftBlocks.length === 0) {
      setNote("至少保留一个区块");
      return;
    }
    setSavingTemplate(true);
    const input: ReportTemplateInput = {
      id: editingTemplate?.id ?? null,
      name: draftName,
      templateType: reportType,
      blocks: draftBlocks,
      isDefault: draftDefault,
    };
    try {
      const saved = await api.saveReportTemplate(input);
      await loadTemplates(reportType);
      setActiveTemplateId(saved.id);
      setDesignerOpen(false);
      setNote(editingTemplate ? "模板已更新" : "模板已创建");
    } catch (err) {
      setNote(`保存模板失败：${String(err)}`);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function removeTemplate(template: ReportTemplate) {
    if (!window.confirm(`删除模板「${template.name}」？`)) return;
    try {
      await api.deleteReportTemplate(template.id);
      const list = await api.listReportTemplates(reportType);
      setTemplates(list);
      setActiveTemplateId(list[0]?.id ?? null);
      setNote("模板已删除");
    } catch (err) {
      setNote(`删除模板失败：${String(err)}`);
    }
  }

  async function regenerate() {
    await doRender(reportType, startDate, endDate, activeTemplateId);
  }

  async function exportReport(format: "md" | "html") {
    try {
      const path = await save({
        defaultPath: `mars-${reportType === "weekly" ? "weekly" : "daily"}-${startDate}-${endDate}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!path) return;
      setExporting(format);
      await api.exportReport(format, reportType, startDate, endDate, activeTemplateId, path);
      setNote(`已导出 ${fileNameFromPath(path)}`);
    } catch (err) {
      setNote(`导出失败：${String(err)}`);
    } finally {
      setExporting(null);
    }
  }

  const activeTemplate = useMemo(
    () => templates.find((item) => item.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  const rangeLabel = `${startDate} 至 ${endDate}`;

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">日报周报</p>
          <h1>{reportTypeLabel}</h1>
          <p className="page-sub">把零散记录整理成可分享的日报与周报。</p>
        </div>
        <div className="page-actions">
          {note && <span className="export-note">{note}</span>}
          <button type="button" className="secondary-btn" onClick={() => void exportReport("md")} disabled={exporting !== null || !render}>
            <Download size={16} strokeWidth={1.9} />
            <span>{exporting === "md" ? "导出中" : "导出 Markdown"}</span>
          </button>
          <button type="button" className="secondary-btn" onClick={() => void exportReport("html")} disabled={exporting !== null || !render}>
            <Download size={16} strokeWidth={1.9} />
            <span>{exporting === "html" ? "导出中" : "导出 HTML"}</span>
          </button>
          <button type="button" className="primary-btn" onClick={() => void regenerate()} disabled={rendering || !activeTemplateId}>
            {rendering ? <Loader2 size={16} strokeWidth={1.9} className="spin" /> : <RefreshCw size={16} strokeWidth={1.9} />}
            <span>重新生成</span>
          </button>
        </div>
      </div>

      <section className="panel reports-controls">
        <div className="report-type-switch" role="tablist" aria-label="报告类型">
          <button type="button" role="tab" aria-selected={reportType === "daily"} className={reportType === "daily" ? "active" : ""} onClick={() => switchReportType("daily")}>
            日报
          </button>
          <button type="button" role="tab" aria-selected={reportType === "weekly"} className={reportType === "weekly" ? "active" : ""} onClick={() => switchReportType("weekly")}>
            周报
          </button>
        </div>

        <div className="report-range">
          <label>
            <span>开始日期</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {reportType === "weekly" && (
            <button
              type="button"
              className="text-btn report-week-btn"
              onClick={() => {
                const [start, end] = currentWeekRange();
                setStartDate(start);
                setEndDate(end);
              }}
            >
              <CalendarRange size={14} strokeWidth={1.9} />
              <span>本周</span>
            </button>
          )}
        </div>

        <div className="report-template-select">
          <label>
            <span>使用模板</span>
            <select
              value={activeTemplateId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setActiveTemplateId(id);
                void doRender(reportType, startDate, endDate, id);
              }}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault ? " · 默认" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="template-menu">
            {activeTemplate && (
              <button type="button" className="text-btn" onClick={() => openEditDesigner(activeTemplate)}>
                <LayoutTemplate size={14} strokeWidth={1.9} />
                <span>编辑模板</span>
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={openNewDesigner}>
              <Plus size={15} strokeWidth={1.9} />
              <span>模板设计</span>
            </button>
          </div>
        </div>
      </section>

      <div className="reports-grid">
        <section className="card report-preview">
          <div className="card-head">
            <h2>预览</h2>
            <span className="card-count">{rangeLabel}</span>
          </div>
          {loading ? (
            <p className="empty-inline">加载中…</p>
          ) : !render ? (
            <p className="empty-inline">先创建模板，再生成报告。</p>
          ) : (
            <pre className="report-markdown">{render.content}</pre>
          )}
        </section>

        <div className="report-side">
          <section className="card">
            <div className="card-head">
              <h2>统计</h2>
              <span className="card-count">{render ? `${render.stats.entryCount} 条` : "—"}</span>
            </div>
            {render ? (
              <div className="report-stats">
                <div className="report-stat">
                  <span>专注时长</span>
                  <strong>{formatMinutes(render.stats.totalMinutes)}</strong>
                </div>
                <div className="report-stat">
                  <span>有效天数</span>
                  <strong>{render.stats.activeDays} 天</strong>
                </div>
                <div className="report-stat">
                  <span>项目数</span>
                  <strong>{render.projects.length} 个</strong>
                </div>
              </div>
            ) : (
              <p className="empty-inline">暂无统计</p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>记录提示</h2>
              <span className="card-count">{render ? render.notices.length : 0}</span>
            </div>
            {render && render.notices.length > 0 ? (
              <div className="report-notices">
                {render.notices.map((notice) => (
                  <div className="report-notice" key={notice}>
                    <span />
                    {notice}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-inline">当前范围没有需要提示的内容</p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>项目汇总</h2>
              <span className="card-count">{render ? render.projects.length : 0}</span>
            </div>
            {render && render.projects.length > 0 ? (
              <div className="report-project-list">
                {render.projects.map((project) => (
                  <div className="report-project-row" key={project.name}>
                    <span className="project-dot" />
                    <span className="report-project-name">{project.name}</span>
                    <span className="report-project-meta">
                      {formatMinutes(project.minutes)} · {project.entryCount} 条
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-inline">暂无项目数据</p>
            )}
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>模板库</h2>
          <span className="card-count">{templates.length} 个模板</span>
        </div>
        {templates.length === 0 ? (
          <p className="empty-inline">还没有模板，点击右上角「模板设计」创建第一个。</p>
        ) : (
          <div className="report-template-list">
            {templates.map((template) => (
              <div
                className={`report-template-row${template.id === activeTemplateId ? " active" : ""}`}
                key={template.id}
              >
                <button
                  type="button"
                  className="report-template-main"
                  onClick={() => {
                    setActiveTemplateId(template.id);
                    void doRender(reportType, startDate, endDate, template.id);
                  }}
                >
                  <span className="report-template-name">{template.name}</span>
                  <span className="report-template-meta">
                    {template.isDefault ? "默认 · " : ""}
                    {template.blocks.map((block) => blockLabel(block.kind)).join(" / ")}
                  </span>
                </button>
                <div className="row-actions">
                  <button type="button" className="text-btn" onClick={() => openEditDesigner(template)}>
                    <LayoutTemplate size={14} strokeWidth={1.9} />
                    <span>编辑</span>
                  </button>
                  <button type="button" className="text-btn danger" onClick={() => void removeTemplate(template)}>
                    <Trash2 size={14} strokeWidth={1.9} />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {designerOpen && (
        <div className="modal-backdrop" onMouseDown={() => setDesignerOpen(false)}>
          <div className="modal report-designer" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editingTemplate ? "编辑模板" : "模板设计"}</h2>
                <p>调整区块顺序与内容，保存后即可用于报告生成。</p>
              </div>
              <button type="button" className="ghost-icon-btn" onClick={() => setDesignerOpen(false)}>
                <X size={16} strokeWidth={1.9} />
              </button>
            </div>
            <div className="modal-body">
              <div className="designer-fields">
                <label className="designer-field">
                  <span>模板名称</span>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="如：标准日报"
                  />
                </label>
                <label className="designer-field designer-check">
                  <input
                    type="checkbox"
                    checked={draftDefault}
                    onChange={(e) => setDraftDefault(e.target.checked)}
                  />
                  <span>设为默认模板</span>
                </label>
              </div>

              <div className="designer-blocks">
                {draftBlocks.map((block, index) => (
                  <div className="designer-block" key={`${block.kind}-${index}`}>
                    <div className="designer-block-head">
                      <span className="designer-block-kind">{blockLabel(block.kind)}</span>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="ghost-icon-btn"
                          disabled={index === 0}
                          onClick={() => moveBlock(index, -1)}
                          title="上移"
                        >
                          <ArrowUp size={15} strokeWidth={1.9} />
                        </button>
                        <button
                          type="button"
                          className="ghost-icon-btn"
                          disabled={index === draftBlocks.length - 1}
                          onClick={() => moveBlock(index, 1)}
                          title="下移"
                        >
                          <ArrowDown size={15} strokeWidth={1.9} />
                        </button>
                        <button
                          type="button"
                          className="ghost-icon-btn danger"
                          onClick={() => removeBlock(index)}
                          title="移除"
                        >
                          <Trash2 size={15} strokeWidth={1.9} />
                        </button>
                      </div>
                    </div>
                    <div className="designer-block-body">
                      <label className="designer-field">
                        <span>标题</span>
                        <input
                          type="text"
                          value={block.title ?? ""}
                          onChange={(e) => updateBlock(index, { title: e.target.value })}
                        />
                      </label>
                      {block.kind === "todo_next" && (
                        <label className="designer-field">
                          <span>内容</span>
                          <textarea
                            rows={4}
                            value={block.content ?? ""}
                            onChange={(e) => updateBlock(index, { content: e.target.value })}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="designer-palette">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setPaletteOpen((open) => !open)}
                >
                  <Plus size={15} strokeWidth={1.9} />
                  <span>添加区块</span>
                </button>
                {paletteOpen && (
                  <div className="palette-options">
                    {BLOCK_OPTIONS.map((option) => (
                      <button
                        type="button"
                        className="palette-option"
                        key={option.kind}
                        onClick={() => addBlock(option.kind)}
                      >
                        <span>{option.label}</span>
                        <small>{option.hint}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="secondary-btn" onClick={() => setDesignerOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => void saveDesigner()}
                disabled={savingTemplate}
              >
                {savingTemplate ? <Loader2 size={15} strokeWidth={1.9} className="spin" /> : <Save size={15} strokeWidth={1.9} />}
                <span>保存模板</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
