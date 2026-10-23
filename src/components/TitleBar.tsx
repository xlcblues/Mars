import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Moon, Search, Square, Sun, X } from "lucide-react";
import { applyTheme, getInitialTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { viewLabels } from "../lib/navigation";
import type { ViewId } from "../lib/navigation";

interface TitleBarProps {
  view: ViewId;
}

export function TitleBar({ view }: TitleBarProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [maximized, setMaximized] = useState(false);
  const inTauri = isTauri();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!inTauri) return;
    const win = getCurrentWindow();
    let mounted = true;
    const sync = async () => {
      if (mounted) setMaximized(await win.isMaximized());
    };
    void sync();
    let dispose: (() => void) | undefined;
    void win.onResized(() => void sync()).then((fn) => {
      dispose = fn;
    });
    return () => {
      mounted = false;
      dispose?.();
    };
  }, [inTauri]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const minimize = () => void getCurrentWindow().minimize();
  const toggleMaximize = () => void getCurrentWindow().toggleMaximize();
  const close = () => void getCurrentWindow().close();

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-title" data-tauri-drag-region>
        <span className="titlebar-view">{viewLabels[view]}</span>
        <span className="titlebar-sep" aria-hidden="true" />
        <span className="titlebar-app">Mars</span>
      </div>
      <div className="titlebar-actions">
        <button className="icon-btn" type="button" aria-label="搜索" title="搜索">
          <Search size={16} />
        </button>
        <button
          className="icon-btn"
          type="button"
          aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
          title={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
          onClick={toggleTheme}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        {inTauri && (
          <div className="window-controls">
            <button className="wc-btn" type="button" aria-label="最小化" title="最小化" onClick={minimize}>
              <Minus size={15} />
            </button>
            <button
              className="wc-btn"
              type="button"
              aria-label={maximized ? "还原" : "最大化"}
              title={maximized ? "还原" : "最大化"}
              onClick={toggleMaximize}
            >
              {maximized ? <Copy size={13} /> : <Square size={13} />}
            </button>
            <button className="wc-btn wc-close" type="button" aria-label="关闭" title="关闭" onClick={close}>
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
