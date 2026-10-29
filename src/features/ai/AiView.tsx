import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { api } from "../../lib/api";
import type {
  AiAction,
  AiChatMessage,
  AiConfig,
  AiSessionMeta,
  AiToolLog,
} from "../../lib/api";

const SUGGESTIONS = [
  "总结本周工作，生成一份周报草稿",
  "分析各项目投入时间与占比",
  "帮我记录今天的工作内容",
];

const PROVIDER_PRESETS = [
  { name: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
];

type ApplyNotice = { ok: boolean; text: string };
type TestResult = { ok: boolean; text: string };

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseMessages(json: string): AiChatMessage[] {
  try {
    const parsed = JSON.parse(json) as AiChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatArgs(raw: string | null): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 1);
  } catch {
    return raw;
  }
}

function renderInline(source: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    if (match.index > last) parts.push(source.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (link) {
        parts.push(
          <a key={key++} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < source.length) parts.push(source.slice(last));
  return parts;
}

function renderMarkdown(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) blocks.push(<h3 key={key++}>{renderInline(heading[2])}</h3>);
      else if (level === 2) blocks.push(<h4 key={key++}>{renderInline(heading[2])}</h4>);
      else blocks.push(<h5 key={key++}>{renderInline(heading[2])}</h5>);
      i += 1;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre key={key++}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(<li key={key++}>{renderInline(lines[i].replace(/^[-*]\s+/, ""))}</li>);
        i += 1;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(<li key={key++}>{renderInline(lines[i].replace(/^\d+\.\s+/, ""))}</li>);
        i += 1;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const paragraph: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={key++}>{renderInline(paragraph.join("\n"))}</p>);
  }
  return blocks;
}

function actionLabel(action: AiAction): string {
  switch (action.type) {
    case "saveEntry": return "保存记录";
    case "deleteEntry": return "删除记录";
    case "createProject": return "创建项目";
    case "archiveProject": return "归档项目";
    default: return "执行操作";
  }
}

function actionDetail(action: AiAction): string {
  switch (action.type) {
    case "saveEntry": {
      const start = action.entry.startedAt ? ` ${action.entry.startedAt} 开始` : "";
      const end = action.entry.endedAt ? ` ${action.entry.endedAt} 结束` : "";
      return `${action.entry.title} · ${action.entry.workDate}${start}${end}`;
    }
    case "deleteEntry": return `删除记录 #${action.id}`;
    case "createProject": return `新建项目 "${action.name}"`;
    case "archiveProject": return `归档项目 #${action.id}`;
    default: return "";
  }
}

function AiView() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<AiConfig>({
    provider: "自定义",
    baseUrl: "",
    model: "",
    apiKey: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [sessions, setSessions] = useState<AiSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pendingActions, setPendingActions] = useState<AiAction[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyNotice, setApplyNotice] = useState<ApplyNotice | null>(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<AiToolLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getAiConfig()
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          setDraftConfig(cfg);
        }
      })
      .catch(() => {});
    api.listAiSessions().then(setSessions).catch(() => {});
    api.listAiToolLogs(50).then(setLogs).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamText, streaming]);

  function refreshSessions() {
    api.listAiSessions().then(setSessions).catch(() => {});
  }

  function refreshLogs() {
    api.listAiToolLogs(50).then(setLogs).catch(() => {});
  }

  function newSession() {
    setActiveSessionId(null);
    setMessages([]);
    setPendingActions([]);
    setStreamText("");
    setError("");
    setApplyNotice(null);
  }

  async function openSession(id: number) {
    try {
      const session = await api.getAiSession(id);
      if (!session) return;
      setActiveSessionId(id);
      setMessages(parseMessages(session.messagesJson));
      setPendingActions([]);
      setStreamText("");
      setError("");
      setApplyNotice(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function deleteSession(id: number) {
    try {
      await api.deleteAiSession(id);
      if (activeSessionId === id) {
        newSession();
      }
      refreshSessions();
    } catch (e) {
      setError(String(e));
    }
  }

  async function sendMessage(raw?: string) {
    const prompt = (raw ?? input).trim();
    if (!prompt || streaming) return;
    if (!config) {
      setError("请先在设置中配置 AI");
      setSettingsOpen(true);
      return;
    }
    const history = messages.map((msg) => ({ role: msg.role, content: msg.content }));
    const userMsg: AiChatMessage = { role: "user", content: prompt };
    const nextWithUser = [...messages, userMsg];
    setMessages(nextWithUser);
    setInput("");
    setStreaming(true);
    setStreamText("");
    setError("");
    setPendingActions([]);
    setApplyNotice(null);
    try {
      const response = await api.aiChatStream(prompt, history, (event) => {
        if (event.type === "delta") {
          setStreamText((text) => text + event.text);
        }
      });
      const assistantMsg: AiChatMessage = { role: "assistant", content: response.text };
      const finalMessages = [...nextWithUser, assistantMsg];
      setMessages(finalMessages);
      setPendingActions(response.actions);
      const title = prompt.length > 24 ? `${prompt.slice(0, 24)}…` : prompt;
      try {
        const session = await api.saveAiSession(
          activeSessionId,
          title,
          JSON.stringify(finalMessages),
        );
        if (activeSessionId === null) {
          setActiveSessionId(session.id);
          refreshSessions();
        } else {
          setSessions((prev) =>
            prev.map((item) =>
              item.id === session.id
                ? { ...item, title: session.title, updatedAt: session.updatedAt }
                : item,
            ),
          );
        }
      } catch {
        // Chat still succeeds even if session persistence fails.
      }
    } catch (e) {
      setMessages(nextWithUser);
      setError(String(e));
    } finally {
      setStreaming(false);
      setStreamText("");
    }
  }

  async function applyActions(actions: AiAction[]) {
    if (applying) return;
    setApplying(true);
    try {
      const result = await api.aiApplyActions(
        activeSessionId === null ? null : String(activeSessionId),
        actions,
      );
      setApplyNotice({ ok: true, text: result.message });
      setPendingActions((prev) => prev.filter((action) => !actions.includes(action)));
    } catch (e) {
      setApplyNotice({ ok: false, text: String(e) });
    } finally {
      setApplying(false);
    }
  }

  function openSettings() {
    setDraftConfig(
      config ?? {
        provider: "自定义",
        baseUrl: "",
        model: "",
        apiKey: "",
      },
    );
    setTestResult(null);
    setSettingsOpen(true);
  }

  async function testConnection() {
    if (!draftConfig.baseUrl || !draftConfig.model) {
      setTestResult({ ok: false, text: "请填写接口地址和模型" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await api.saveAiConfig(draftConfig);
      const message = await api.testAiConnection();
      setConfig(draftConfig);
      setTestResult({ ok: true, text: message });
    } catch (e) {
      setTestResult({ ok: false, text: String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function saveSettings() {
    try {
      const saved = await api.saveAiConfig(draftConfig);
      setConfig(saved);
      setSettingsOpen(false);
      setTestResult(null);
    } catch (e) {
      setTestResult({ ok: false, text: String(e) });
    }
  }

  return (
    <div className="ai-view">
      <header className="ai-head">
        <div>
          <div className="ai-kicker">
            <Sparkles size={15} />
            AI
          </div>
          <h2 className="ai-title">AI 助手</h2>
          <p className="ai-sub">对话式工作记录与报告助手</p>
        </div>
        <div className="ai-head-actions">
          <button className="icon-btn" onClick={openSettings} title="AI 设置" aria-label="AI 设置">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <div className="ai-layout">
        <aside className="ai-panel ai-session-panel">
          <div className="ai-panel-head">
            <span className="ai-panel-title">
              <MessageSquare size={15} />
              会话
            </span>
            <span className="ai-panel-count">{sessions.length}</span>
          </div>
          <button className="ai-new-btn" onClick={newSession}>
            <Plus size={14} />
            新会话
          </button>
          <div className="ai-session-list">
            {sessions.length === 0 ? (
              <div className="ai-empty">暂无会话</div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`ai-session-item${activeSessionId === session.id ? " active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openSession(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openSession(session.id);
                  }}
                >
                  <div className="ai-session-top">
                    <span className="ai-session-title">{session.title || "未命名会话"}</span>
                    <button
                      className="ai-session-delete"
                      type="button"
                      aria-label="删除会话"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="ai-session-meta">{formatTime(session.updatedAt)}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="ai-chat">
          <div className="ai-chat-scroll" ref={scrollRef}>
            {!config && messages.length === 0 && !streaming && (
              <div className="ai-hint">
                <span>尚未配置 AI 服务</span>
                <button type="button" onClick={openSettings}>
                  打开设置
                </button>
              </div>
            )}
            {error && <div className="ai-status-error">{error}</div>}
            {messages.length === 0 && !streaming ? (
              <div className="ai-welcome">
                <div className="ai-welcome-icon">
                  <Sparkles size={22} />
                </div>
                <h3>开始对话</h3>
                <p>让 AI 帮你整理工作记录、分析投入并生成报告。</p>
                <div className="ai-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="ai-suggestion"
                      disabled={streaming}
                      onClick={() => sendMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ai-messages">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`ai-msg ${msg.role === "user" ? "user" : "assistant"}`}
                  >
                    <span className="ai-msg-role">{msg.role === "user" ? "你" : "AI"}</span>
                    {msg.role === "user" ? (
                      <div className="ai-bubble">{msg.content}</div>
                    ) : (
                      <div className="ai-bubble">
                        <div className="ai-markdown">{renderMarkdown(msg.content)}</div>
                      </div>
                    )}
                  </div>
                ))}
                {streaming && (
                  <div className="ai-msg assistant">
                    <span className="ai-msg-role">AI</span>
                    <div className="ai-bubble">
                      {streamText ? (
                        <div className="ai-markdown">{renderMarkdown(streamText)}</div>
                      ) : (
                        <div className="ai-typing">
                          <span className="ai-typing-dot" />
                          <span className="ai-typing-dot" />
                          <span className="ai-typing-dot" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {pendingActions.length > 0 && (
                  <div className="ai-actions">
                    <div className="ai-action-head">
                      <span className="ai-action-title">
                        <Wand2 size={14} />
                        待执行操作
                      </span>
                      {pendingActions.length > 1 && (
                        <button
                          className="ai-action-btn primary"
                          onClick={() => applyActions(pendingActions)}
                          disabled={applying}
                        >
                          <Zap size={14} />
                          全部执行
                        </button>
                      )}
                    </div>
                    {pendingActions.map((action, index) => (
                      <div className="ai-action-card" key={index}>
                        <div className="ai-action-head">
                          <span className="ai-action-title">
                            <Wand2 size={14} />
                            {actionLabel(action)}
                          </span>
                          <button
                            className="ai-action-btn primary"
                            onClick={() => applyActions([action])}
                            disabled={applying}
                          >
                            <Check size={14} />
                            执行
                          </button>
                        </div>
                        <div className="ai-action-detail">{actionDetail(action)}</div>
                      </div>
                    ))}
                    {applyNotice && (
                      <div className={`ai-action-note${applyNotice.ok ? "" : " error"}`}>
                        {applyNotice.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <form
            className="ai-inputbar"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              className="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="描述你想让 AI 处理的工作..."
              rows={2}
              disabled={streaming}
            />
            <button
              className="ai-send-btn"
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="发送"
            >
              <Send size={17} />
            </button>
          </form>
        </section>

        <aside className="ai-panel ai-log-panel">
          <div className="ai-panel-head">
            <span className="ai-panel-title">
              <History size={15} />
              工具日志
            </span>
            <div className="ai-panel-actions">
              <button className="icon-btn" onClick={refreshLogs} title="刷新日志" aria-label="刷新日志">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
          <div className="ai-log-list">
            {logs.length === 0 ? (
              <div className="ai-empty">暂无工具调用记录</div>
            ) : (
              logs.map((log) => (
                <div className="ai-log-item" key={log.id}>
                  <div className="ai-log-head">
                    <span className="ai-log-name">{log.toolName}</span>
                    <span className={`ai-log-status ${log.status}`}>
                      {log.status === "success" ? "成功" : "失败"}
                    </span>
                  </div>
                  <div className="ai-log-time">{formatTime(log.createdAt)}</div>
                  {log.argsJson && <div className="ai-log-args">{formatArgs(log.argsJson)}</div>}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="modal ai-settings-modal">
            <div className="modal-head">
              <div>
                <h2>AI 设置</h2>
                <p>配置模型服务地址与密钥</p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setSettingsOpen(false)}
                aria-label="关闭"
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-field span-2">
                  <span>服务商</span>
                  <div className="ai-provider-grid">
                    {PROVIDER_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className={`ai-provider-btn${draftConfig.provider === preset.name ? " active" : ""}`}
                        onClick={() =>
                          setDraftConfig((draft) => ({
                            ...draft,
                            provider: preset.name,
                            baseUrl: preset.baseUrl,
                            model: preset.model,
                          }))
                        }
                      >
                        {preset.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`ai-provider-btn${draftConfig.provider === "自定义" ? " active" : ""}`}
                      onClick={() =>
                        setDraftConfig((draft) => ({ ...draft, provider: "自定义" }))
                      }
                    >
                      自定义
                    </button>
                  </div>
                </div>
                <div className="form-field span-2">
                  <span>接口地址</span>
                  <input
                    value={draftConfig.baseUrl}
                    onChange={(e) =>
                      setDraftConfig((draft) => ({ ...draft, baseUrl: e.target.value }))
                    }
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="form-field span-2">
                  <span>模型</span>
                  <input
                    value={draftConfig.model}
                    onChange={(e) =>
                      setDraftConfig((draft) => ({ ...draft, model: e.target.value }))
                    }
                    placeholder="gpt-4o-mini"
                  />
                </div>
                <div className="form-field span-2">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={draftConfig.apiKey}
                    onChange={(e) =>
                      setDraftConfig((draft) => ({ ...draft, apiKey: e.target.value }))
                    }
                    placeholder="sk-..."
                  />
                  <span className="ai-key-note">密钥仅保存在本机</span>
                </div>
                {testResult && (
                  <div className={`ai-test-result span-2 ${testResult.ok ? "ok" : "error"}`}>
                    {testResult.text}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button className="secondary-btn" onClick={() => setSettingsOpen(false)} disabled={testing}>
                取消
              </button>
              <button className="secondary-btn" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 size={15} /> : <Zap size={15} />}
                {testing ? "测试中..." : "测试连接"}
              </button>
              <button className="primary-btn" onClick={saveSettings} disabled={testing}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiView;
