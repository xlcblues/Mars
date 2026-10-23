import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  ExternalLink,
  Paperclip,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Attachment, Project, WorkEntry, WorkEntryInput } from "../lib/api";
import { api, fileNameFromPath, formatFileSize, todayDateString } from "../lib/api";

interface EntryModalProps {
  projects: Project[];
  entry?: WorkEntry | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (entry: WorkEntry) => void;
}

interface FormState {
  title: string;
  projectId: string;
  workDate: string;
  startedAt: string;
  endedAt: string;
  content: string;
  tags: string;
}

function formFromEntry(entry?: WorkEntry | null, defaultDate?: string): FormState {
  return {
    title: entry?.title ?? "",
    projectId: entry?.projectId != null ? String(entry.projectId) : "",
    workDate: entry?.workDate ?? defaultDate ?? todayDateString(),
    startedAt: entry?.startedAt ?? "",
    endedAt: entry?.endedAt ?? "",
    content: entry?.content ?? "",
    tags: entry?.tags ?? "",
  };
}

export function EntryModal({ projects, entry, defaultDate, onClose, onSaved }: EntryModalProps) {
  const [form, setForm] = useState<FormState>(() => formFromEntry(entry, defaultDate));
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const entryIdRef = useRef<number | null>(entry?.id ?? null);

  useEffect(() => {
    setForm(formFromEntry(entry, defaultDate));
    entryIdRef.current = entry?.id ?? null;
  }, [entry, defaultDate]);

  useEffect(() => {
    if (!entry?.id) return;
    api
      .listAttachments(entry.id)
      .then(setAttachments)
      .catch((err) => setError(String(err)));
  }, [entry?.id]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebviewWindow()
      .onDragDropEvent((event: any) => {
        if (event?.type === "drop" && Array.isArray(event.paths)) {
          void uploadPaths(event.paths);
          setDragging(false);
        } else if (event?.type === "enter" || event?.type === "over") {
          setDragging(true);
        } else if (event?.type === "leave") {
          setDragging(false);
        }
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadPaths(paths: string[]) {
    const currentId = entryIdRef.current;
    if (!currentId) {
      setPendingPaths((prev) => [...prev, ...paths]);
      return;
    }
    for (const path of paths) {
      await api.addAttachment(currentId, path, fileNameFromPath(path));
    }
    const list = await api.listAttachments(currentId);
    setAttachments(list);
  }

  async function pickFiles() {
    try {
      const selected = await open({ multiple: true });
      const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
      if (paths.length > 0) await uploadPaths(paths);
    } catch (err) {
      setError(String(err));
    }
  }

  async function submit() {
    if (!form.title.trim()) {
      setError("请填写记录标题");
      return;
    }
    if (!form.workDate) {
      setError("请选择日期");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: WorkEntryInput = {
        id: entry?.id ?? null,
        projectId: form.projectId ? Number(form.projectId) : null,
        workDate: form.workDate,
        startedAt: form.startedAt || null,
        endedAt: form.endedAt || null,
        title: form.title.trim(),
        content: form.content.trim() || null,
        tags: form.tags.trim() || null,
      };
      const saved = await api.saveEntry(payload);
      entryIdRef.current = saved.id;
      if (pendingPaths.length > 0) {
        await uploadPaths(pendingPaths);
        setPendingPaths([]);
      }
      setSaving(false);
      onSaved(saved);
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`modal${dragging ? " dragging" : ""}`}>
        <div className="modal-head">
          <div>
            <h2>{entry ? "编辑记录" : "快速记录"}</h2>
            <p>标题、项目与时间可留空项；附件支持直接拖入窗口。</p>
          </div>
          <button type="button" className="ghost-icon-btn" onClick={onClose} aria-label="关闭" title="关闭">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <label className="form-field span-2">
              <span>标题</span>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="例如：完成日报模板设计"
              />
            </label>

            <label className="form-field">
              <span>项目</span>
              <select value={form.projectId} onChange={(e) => setField("projectId", e.target.value)}>
                <option value="">未指定</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>日期</span>
              <input
                type="date"
                value={form.workDate}
                onChange={(e) => setField("workDate", e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>开始</span>
              <input
                type="time"
                value={form.startedAt}
                onChange={(e) => setField("startedAt", e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>结束</span>
              <input
                type="time"
                value={form.endedAt}
                onChange={(e) => setField("endedAt", e.target.value)}
              />
            </label>

            <label className="form-field span-2">
              <span>内容</span>
              <textarea
                rows={4}
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
                placeholder="做了什么、进展如何、下一步计划"
              />
            </label>

            <label className="form-field span-2">
              <span>标签</span>
              <input
                value={form.tags}
                onChange={(e) => setField("tags", e.target.value)}
                placeholder="逗号分隔，例如：开发,联调"
              />
            </label>
          </div>

          <div className="attachment-zone">
            <div className="attachment-zone-head">
              <span>附件</span>
              <button type="button" className="text-btn" onClick={pickFiles}>
                <Upload size={14} strokeWidth={1.9} />
                <span>选择文件</span>
              </button>
            </div>
            {attachments.length === 0 && pendingPaths.length === 0 ? (
              <p className="attachment-hint">
                <Paperclip size={14} strokeWidth={1.9} />
                <span>将文件拖入窗口即可保存</span>
              </p>
            ) : (
              <div className="attachment-list">
                {attachments.map((attachment) => (
                  <div className="attachment-row" key={attachment.id}>
                    <Paperclip size={14} strokeWidth={1.9} />
                    <span className="attachment-name" title={attachment.fileName}>
                      {attachment.fileName}
                    </span>
                    <span className="attachment-size">{formatFileSize(attachment.sizeBytes)}</span>
                    <button
                      type="button"
                      className="ghost-icon-btn"
                      title="打开"
                      aria-label="打开附件"
                      onClick={() => api.openAttachment(attachment.id)}
                    >
                      <ExternalLink size={14} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      className="ghost-icon-btn danger"
                      title="删除"
                      aria-label="删除附件"
                      onClick={async () => {
                        await api.deleteAttachment(attachment.id);
                        const list = await api.listAttachments(attachment.entryId);
                        setAttachments(list);
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.9} />
                    </button>
                  </div>
                ))}
                {pendingPaths.map((path) => (
                  <div className="attachment-row pending" key={path}>
                    <Paperclip size={14} strokeWidth={1.9} />
                    <span className="attachment-name">{fileNameFromPath(path)}</span>
                    <span className="attachment-size">保存后上传</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-foot">
          {error && <span className="form-error">{error}</span>}
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-btn" onClick={submit} disabled={saving}>
            <Save size={15} strokeWidth={2.1} />
            <span>{saving ? "保存中" : "保存记录"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
