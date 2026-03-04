# FR-01：扩展脚手架与侧边栏注入实现

## 1. 元信息
- 功能 ID：FEAT-001
- 功能名称：实现 Manifest V3 脚手架与 ChatGPT 侧边栏注入（FR-01）
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A（工作区直接更新）

## 2. 概述
完成扩展工程初始化，并实现首个可运行功能：在 ChatGPT 网页注入可收起侧边栏，支持拖拽调整宽度并持久化状态。产物可直接通过 Chrome 扩展“加载已解压”方式运行。

## 3. 需求映射
- 对应 PRD 章节：6.1（P0）、8（FR-01）、10（技术方案）、15（DoD）
- 覆盖的用户场景：
  - 用户安装后能在 ChatGPT 页面看到扩展侧边栏。
  - 用户可根据习惯收起/展开并调整侧边栏宽度。
- 本次范围：
  - 初始化 Node/TypeScript/React 扩展工程
  - 实现 content script 注入与侧边栏交互
  - 增加 background 最小事件处理
  - 增加构建脚本与 README 使用说明
- 本次不包含：
  - 会话列表索引（FR-02）
  - 分类管理（FR-03）
  - 提示词库（FR-05）

## 4. 设计
- 关键设计决策：
  - 使用 Manifest V3 + `content script` + `background service worker` 的标准结构。
  - 侧边栏挂载在 Shadow DOM，降低对宿主页面样式污染。
  - 面板状态（收起/宽度）保存在 `chrome.storage.local`。
- 取舍说明：
  - 当前 UI 为 MVP 样式，优先保证稳定注入与交互链路。
  - 宽度持久化只存单一值，后续可按会话或页面维度细化。
- 权限/数据/隐私考虑：
  - 权限仅申请 `storage`。
  - host 限定为 `chatgpt.com` 与 `chat.openai.com`。
  - 当前不上传用户数据，符合本地优先原则。

## 5. 实现
- 主要变更文件：
  - `package.json`
  - `tsconfig.json`
  - `scripts/build.mjs`
  - `src/manifest.json`
  - `src/content/index.tsx`
  - `src/content/App.tsx`
  - `src/background/index.ts`
  - `README.md`
- 核心逻辑：
  - `content/index.tsx`：校验域名、创建 Shadow DOM 容器、挂载 React 应用。
  - `content/App.tsx`：侧边栏 UI、收起/展开、拖拽宽度、状态持久化。
  - `background/index.ts`：扩展安装事件与最小消息响应。
  - `scripts/build.mjs`：使用 esbuild 打包 `content` 与 `background`，并输出 `dist/`。
- 数据模型/存储变更：
  - 新增键：`gpt_voyager_panel_state`（`collapsed` + `width`）。
- 配置/Manifest 变更：
  - 新增 `src/manifest.json`，声明 MV3、权限、host 匹配与脚本入口。

## 6. 验证
- 自动化测试：
  - `npm run typecheck`
  - `npm run build`
- 手工验证步骤：
  1. 在 `chrome://extensions/` 加载 `dist/`
  2. 打开 `https://chatgpt.com/`
  3. 验证侧边栏是否出现
  4. 点击“收起”并通过右侧按钮重新展开
  5. 拖拽左边缘调整宽度并刷新页面，确认宽度与收起状态可恢复
- 测试结果摘要：
  - 构建通过、类型检查通过，具备基础可运行性。

## 7. 风险与回滚
- 已知风险：
  - ChatGPT 页面结构变化可能影响挂载时机。
  - React + 打包产物当前未做体积优化。
- 回滚策略：
  - 如出现问题可回退 `src/content/*` 与 `src/manifest.json` 到上一版本。

## 8. 后续事项
- 待办项：
  - FR-02：会话列表抓取与本地索引展示。
  - FR-03：文件夹/标签分类操作。
  - 增加基础 UI 测试或端到端烟测脚本。
- 潜在优化：
  - 按功能拆分包体并做按需加载。
  - 增加配置化主题能力与快捷键入口。

