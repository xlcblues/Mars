import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Check,
  FolderKanban,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { Project } from "../../lib/api";
import { api } from "../../lib/api";

const PRESET_COLORS = [
  "#C3451F",
  "#B54A6E",
  "#2E8B8B",
  "#5B7DB1",
  "#6A5B8F",
  "#B58A2E",
  "#3E7C59",
  "#8F5D3F",
];

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [archived, setArchived] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

  const load = useCallback(async () => {
    const [active, all] = await Promise.all([
      api.listProjects(false),
      api.listProjects(true),
    ]);
    setProjects(active);
    setArchived(all.filter((project) => project.status !== "active"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createProject(name.trim(), color);
      setName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: number) {
    await api.archiveProject(id);
    await load();
  }

  async function restore(id: number) {
    await api.restoreProject(id);
    await load();
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    await api.updateProject(editingId, editName.trim(), editColor);
    setEditingId(null);
    await load();
  }

  const list = showArchived ? archived : projects;

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">项目管理</p>
          <h1>项目</h1>
          <p className="page-sub">用颜色区分工作主题，随时归档与恢复。</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className={`secondary-btn${showArchived ? " active" : ""}`}
            onClick={() => setShowArchived((value) => !value)}
          >
            <Archive size={16} strokeWidth={1.9} />
            <span>归档 ({archived.length})</span>
          </button>
        </div>
      </div>

      <section className="panel create-panel">
        <div className="panel-head">
          <h2>
            {showArchived ? (
              <Archive size={15} strokeWidth={1.9} />
            ) : (
              <FolderPlus size={15} strokeWidth={1.9} />
            )}
            {showArchived ? "归档项目" : "新建项目"}
          </h2>
        </div>
        {showArchived ? (
          <div className="project-list">
            {archived.length === 0 && <p className="empty-text">暂无归档项目</p>}
            {archived.map((project) => (
              <div className="project-row" key={project.id}>
                <div className="project-main">
                  <span className="project-dot" style={{ background: project.color ?? "#B9BFC7" }} />
                  <span className="project-name">{project.name}</span>
                  <span className="project-hours">已归档</span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => restore(project.id)}
                    title="恢复项目"
                  >
                    <RotateCcw size={14} strokeWidth={1.9} />
                    <span>恢复</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="create-row">
            <div className="color-picker" aria-label="选择项目颜色">
              {PRESET_COLORS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`swatch${preset === color ? " selected" : ""}`}
                  style={{ background: preset }}
                  onClick={() => setColor(preset)}
                  aria-label={`颜色 ${preset}`}
                />
              ))}
            </div>
            <input
              className="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createProject()}
              placeholder="项目名称"
            />
            <button type="button" className="primary-btn" onClick={createProject} disabled={busy || !name.trim()}>
              <Plus size={16} strokeWidth={2.1} />
              <span>创建项目</span>
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            {showArchived ? (
              <Archive size={15} strokeWidth={1.9} />
            ) : (
              <FolderKanban size={15} strokeWidth={1.9} />
            )}
            {showArchived ? "归档列表" : "全部项目"}
          </h2>
          <span className="card-count">{list.length} 个</span>
        </div>
        <div className="project-list">
          {list.length === 0 && <p className="empty-text">{showArchived ? "暂无归档项目" : "还没有项目，先创建一个"}</p>}
          {list.map((project) => (
            <div className="project-row" key={project.id}>
              {editingId === project.id ? (
                <div className="project-edit">
                  <div className="project-edit-field project-edit-name">
                    <span>项目名称</span>
                    <input
                      className="name-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void saveEdit()}
                      autoFocus
                    />
                  </div>
                  <div className="project-edit-field project-edit-colors">
                    <span>项目颜色</span>
                    <div className="color-picker" aria-label="选择编辑颜色">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          type="button"
                          key={preset}
                          className={`swatch${preset === editColor ? " selected" : ""}`}
                          style={{ background: preset }}
                          onClick={() => setEditColor(preset)}
                          aria-label={`颜色 ${preset}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="project-edit-actions">
                    <button type="button" className="secondary-btn" onClick={() => setEditingId(null)}>
                      <X size={14} strokeWidth={2} />
                      <span>取消</span>
                    </button>
                    <button type="button" className="primary-btn" onClick={saveEdit}>
                      <Check size={14} strokeWidth={2} />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="project-main">
                    <span className="project-dot" style={{ background: project.color ?? "#B9BFC7" }} />
                    <span className="project-name">{project.name}</span>
                    <span className="project-hours">创建于 {project.createdAt.slice(0, 10)}</span>
                  </div>
                  <div className="row-actions">
                    {!showArchived && (
                      <>
                        <button
                          type="button"
                          className="text-btn"
                          title="编辑"
                          onClick={() => {
                            setEditingId(project.id);
                            setEditName(project.name);
                            setEditColor(project.color ?? PRESET_COLORS[0]);
                          }}
                        >
                          <Pencil size={14} strokeWidth={1.9} />
                          <span>编辑</span>
                        </button>
                        <button
                          type="button"
                          className="text-btn"
                          title="归档"
                          onClick={() => archive(project.id)}
                        >
                          <Archive size={14} strokeWidth={1.9} />
                          <span>归档</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="view-badge">
        <FolderOpen size={14} strokeWidth={1.9} />
        <span>{projects.length} 个进行中 · {archived.length} 个已归档</span>
      </div>
    </div>
  );
}
