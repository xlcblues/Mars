import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  DatabaseBackup,
  Download,
  FolderOpen,
  History,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import type { BackupInfo, LocalDataInfo, RestoreInfo } from "../../lib/api";
import { api, formatFileSize } from "../../lib/api";
import {
  FALLBACK_VERSION,
  type UpdaterState,
} from "../../lib/updater";

interface SettingsViewProps {
  onRestored: () => void;
  updaterState: UpdaterState;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
}

type Busy = "backup" | "restore" | null;

export function SettingsView({
  onRestored,
  updaterState,
  onCheckUpdate,
  onInstallUpdate,
}: SettingsViewProps) {
  const [info, setInfo] = useState<LocalDataInfo | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupInfo | null>(null);
  const [lastRestore, setLastRestore] = useState<RestoreInfo | null>(null);
  const currentVersion = updaterState.currentVersion ?? FALLBACK_VERSION;
  const updateBusy =
    updaterState.status === "checking" ||
    updaterState.status === "downloading" ||
    updaterState.status === "installing";
  let updateStatusText = "未检查";
  if (updaterState.status === "checking") {
    updateStatusText = "正在检查更新…";
  } else if (updaterState.status === "latest") {
    updateStatusText = "已是最新版本";
  } else if (updaterState.status === "available") {
    updateStatusText = `发现新版本 v${updaterState.version ?? ""}`;
  } else if (updaterState.status === "downloading") {
    updateStatusText =
      updaterState.progress && updaterState.progress > 0
        ? `已下载 ${updaterState.progress}%`
        : `正在下载 v${updaterState.version ?? ""}`;
  } else if (updaterState.status === "installing") {
    updateStatusText = "正在安装，完成后自动重启";
  } else if (updaterState.status === "error") {
    updateStatusText =
      updaterState.message === "unsupported"
        ? "当前环境不支持在线更新"
        : "检查更新失败";
  }

  const loadInfo = useCallback(async () => {
    try {
      setInfo(await api.localDataInfo());
    } catch (err) {
      setNotice({ kind: "error", text: String(err) });
    }
  }, []);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  async function pickDirectory(title: string): Promise<string | null> {
    const selected = await open({ directory: true, title });
    if (Array.isArray(selected)) return selected[0] ?? null;
    return selected;
  }

  async function handleBackup() {
    try {
      const targetDir = await pickDirectory("选择备份保存位置");
      if (!targetDir) return;
      setBusy("backup");
      const result = await api.createBackup(targetDir);
      setLastBackup(result);
      setNotice({ kind: "success", text: `备份完成：${result.path}` });
      await loadInfo();
    } catch (err) {
      setNotice({ kind: "error", text: String(err) });
    } finally {
      setBusy(null);
    }
  }

  async function chooseRestore() {
    try {
      const backupDir = await pickDirectory("选择 Mars 备份文件夹");
      if (!backupDir) return;
      setPendingRestore(backupDir);
      setNotice(null);
    } catch (err) {
      setNotice({ kind: "error", text: String(err) });
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    setBusy("restore");
    try {
      const result = await api.restoreBackup(pendingRestore);
      setLastRestore(result);
      setPendingRestore(null);
      setNotice({ kind: "success", text: "恢复完成，当前页面数据已刷新" });
      await loadInfo();
      onRestored();
    } catch (err) {
      setNotice({ kind: "error", text: String(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <p className="page-kicker">数据与维护</p>
          <h1>设置</h1>
          <p className="page-sub">管理本地数据、备份与恢复。</p>
        </div>
      </div>

      {notice && (
        <div className={`settings-notice ${notice.kind}`} role="status">
          {notice.kind === "success" ? (
            <CheckCircle2 size={16} strokeWidth={1.9} />
          ) : (
            <AlertTriangle size={16} strokeWidth={1.9} />
          )}
          <span>{notice.text}</span>
          <button
            type="button"
            className="ghost-icon-btn"
            aria-label="关闭提示"
            title="关闭提示"
            onClick={() => setNotice(null)}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      <section className="panel settings-panel">
        <div className="panel-head">
          <h2>
            <Database size={16} strokeWidth={1.9} />
            本地数据
          </h2>
          <span className="card-count">
            {info ? `${info.attachmentCount} 个附件` : "读取中"}
          </span>
        </div>
        <div className="settings-body">
          <div className="settings-data-list">
            <div className="settings-data-item">
              <span className="settings-data-label">数据库</span>
              <span className="settings-data-value">
                {info ? formatFileSize(info.dbSize) : "—"}
              </span>
            </div>
            <div className="settings-data-item">
              <span className="settings-data-label">附件</span>
              <span className="settings-data-value">
                {info ? formatFileSize(info.attachmentBytes) : "—"}
              </span>
            </div>
          </div>
          <div className="path-list">
            <div className="path-row">
              <span>数据目录</span>
              <code>{info?.dataDir ?? "—"}</code>
            </div>
            <div className="path-row">
              <span>数据库</span>
              <code>{info?.dbPath ?? "—"}</code>
            </div>
            <div className="path-row">
              <span>附件目录</span>
              <code>{info?.attachmentsPath ?? "—"}</code>
            </div>
          </div>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-head">
          <h2>
            <DatabaseBackup size={16} strokeWidth={1.9} />
            备份
          </h2>
          <div className="settings-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={handleBackup}
              disabled={busy !== null}
            >
              {busy === "backup" ? (
                <Loader2 size={16} strokeWidth={2} className="spin" />
              ) : (
                <FolderOpen size={16} strokeWidth={1.9} />
              )}
              <span>创建备份</span>
            </button>
          </div>
        </div>
        <div className="settings-body">
          {lastBackup ? (
            <div className="result-row">
              <CheckCircle2 size={16} strokeWidth={1.9} />
              <div>
                <p>{lastBackup.path}</p>
                <span>
                  {formatFileSize(lastBackup.dbSize)} · {lastBackup.attachmentCount} 个附件 ·{" "}
                  {lastBackup.createdAt.slice(0, 19).replace("T", " ")}
                </span>
              </div>
            </div>
          ) : (
            <p className="settings-copy">选择保存位置后生成完整数据快照。</p>
          )}
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-head">
          <h2>
            <History size={16} strokeWidth={1.9} />
            恢复
          </h2>
          <div className="settings-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={chooseRestore}
              disabled={busy !== null}
            >
              <FolderOpen size={16} strokeWidth={1.9} />
              <span>选择备份</span>
            </button>
          </div>
        </div>
        <div className="settings-body">
          {pendingRestore ? (
            <div className="restore-confirm">
              <div className="restore-confirm-main">
                <AlertTriangle size={16} strokeWidth={1.9} />
                <span>{pendingRestore}</span>
              </div>
              <div className="settings-actions">
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setPendingRestore(null)}
                  disabled={busy === "restore"}
                >
                  <X size={14} strokeWidth={2} />
                  <span>取消</span>
                </button>
                <button
                  type="button"
                  className="primary-btn danger-confirm"
                  onClick={confirmRestore}
                  disabled={busy === "restore"}
                >
                  {busy === "restore" ? (
                    <Loader2 size={16} strokeWidth={2} className="spin" />
                  ) : (
                    <RotateCcw size={16} strokeWidth={1.9} />
                  )}
                  <span>确认恢复</span>
                </button>
              </div>
            </div>
          ) : lastRestore ? (
            <div className="result-row">
              <CheckCircle2 size={16} strokeWidth={1.9} />
              <div>
                <p>{lastRestore.message}</p>
                <span>恢复前数据已保存至 {lastRestore.backupPath}</span>
              </div>
            </div>
          ) : (
            <p className="settings-copy">恢复会替换当前数据库与附件。</p>
          )}
        </div>
      </section>

      <section className="panel settings-panel about-panel">
        <div className="panel-head">
          <h2>
            <Info size={16} strokeWidth={1.9} />
            关于与更新
          </h2>
          <span className="card-count">Mars v{currentVersion}</span>
        </div>
        <div className="settings-body">
          <div className="about-meta">
            <div className="about-meta-item">
              <span>当前版本</span>
              <strong>v{currentVersion}</strong>
            </div>
            <div className="about-meta-item">
              <span>更新状态</span>
              <strong
                className={
                  updaterState.status === "error" ? "about-status-error" : ""
                }
              >
                {updateStatusText}
              </strong>
            </div>
          </div>
          {updaterState.status === "available" && updaterState.body ? (
            <p className="about-update-notes">{updaterState.body}</p>
          ) : null}
          {updaterState.status === "downloading" ? (
            <div
              className={`about-update-progress${
                updaterState.progress ? "" : " indeterminate"
              }`}
            >
              <span style={{ width: `${updaterState.progress ?? 38}%` }} />
            </div>
          ) : null}
          {updaterState.status === "error" &&
          updaterState.message !== "unsupported" ? (
            <p className="about-update-error">{updaterState.message}</p>
          ) : null}
          <div className="settings-actions about-update-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={updateBusy}
              onClick={onCheckUpdate}
            >
              {updaterState.status === "checking" ? (
                <Loader2 size={16} strokeWidth={2} className="spin" />
              ) : (
                <RefreshCw size={16} strokeWidth={1.9} />
              )}
              <span>
                {updaterState.status === "checking" ? "检查中" : "检查更新"}
              </span>
            </button>
            {updaterState.status === "available" ? (
              <button
                type="button"
                className="primary-btn"
                disabled={updateBusy}
                onClick={onInstallUpdate}
              >
                <Download size={16} strokeWidth={1.9} />
                <span>下载并安装</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
