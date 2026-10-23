# Mars

Mars 是一款面向 Windows 的个人工作记录与日报/周报生成工具。产品定位为本地优先、苹果式极简、适合每日持续使用的个人工作台。

当前仓库已完成品牌规划与 M0 工程骨架，已交付：

- Logo 与品牌资产：`assets/brand/`
- 品牌板：`assets/brand/brand-board.html`
- 设计系统：`design/ui-design-system.md`
- 技术选型与开发流程：`docs/技术选型与开发流程.md`
- Tauri 2 + React + TypeScript 脚手架
- 自定义无边框窗口与标题栏、深浅主题、Mars 品牌 UI 外壳
- Windows 应用图标：`src-tauri/icons/`

技术栈：Tauri 2 + React + TypeScript + Vite + SQLite。

## 开发

```bash
npm install
npm run tauri dev
```

浏览器预览（不含窗口控制按钮）：

```bash
npm run dev
```

## 常用命令

```bash
# 单元测试
npm test

# 构建前端产物
npm run build

# 构建 Windows 安装包
npm run tauri build

# 重新生成应用图标
npm run tauri icon assets/brand/logo-icon-1024.png
```
