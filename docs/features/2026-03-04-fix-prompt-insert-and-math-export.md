# 修复：提示词插入失败与公式导出乱码

## 1. 元信息
- 功能 ID：FIX-001
- 功能名称：修复提示词无法插入对话框，优化 Markdown 导出公式质量
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A（工作区直接更新）

## 2. 概述
针对用户反馈的两个问题进行修复：  
1) 提示词“插入”在新版 ChatGPT 输入组件上不稳定；  
2) Markdown 导出内容可读性差，公式被渲染文本拆字导致乱码。  
本次改造后，插入逻辑支持 textarea 与 contenteditable 双路径，导出逻辑支持 KaTeX/MathJax 公式还原为 LaTeX，再转换为 Markdown。

## 3. 需求映射
- 对应 PRD 章节：8（FR-05、FR-06）、15（DoD）
- 覆盖的用户场景：
  - 用户点击“插入”后，提示词能进入当前 ChatGPT 输入框。
  - 用户导出的 Markdown 中公式可正确保留为 LaTeX 表达。
- 本次范围：
  - 修复插入策略与事件触发
  - 重构导出提取链路（从纯文本提取改为 DOM->Markdown）
  - 增加公式还原规则（inline/display）
- 本次不包含：
  - 导出模板自定义
  - 批量导出

## 4. 设计
- 关键设计决策：
  - 插入：
    - 多选择器匹配输入框（`#prompt-textarea` + contenteditable）
    - textarea 使用原生 `value` setter + `InputEvent`
    - contenteditable 使用 `execCommand('insertText')` + `InputEvent`
  - 导出：
    - 使用 `turndown` 将 HTML 转 Markdown
    - 导出前扫描 `.katex` / `mjx-container`，从 `annotation` 读取公式源码
    - display 公式包装为 `$$...$$`，inline 公式包装为 `$...$`
- 取舍说明：
  - 仍依赖页面 DOM 结构，后续需随 ChatGPT 前端变化调整。
  - 为提升质量引入新依赖 `turndown`。
- 权限/数据/隐私考虑：
  - 无新增权限，所有数据本地处理。

## 5. 实现
- 主要变更文件：
  - `src/content/App.tsx`
  - `src/content/conversationExport.ts`
  - `package.json`
  - `README.md`
- 核心逻辑：
  - `App.tsx`：
    - `findComposerTarget` 多策略定位输入框
    - `appendToTextarea` / `appendToContentEditable` 双通道插入
  - `conversationExport.ts`：
    - 新增 `turndown` 转换器
    - `replaceMathWithTokens` 还原公式源码
    - `extractMessageMarkdown` 提升导出结构化质量
- 数据模型/存储变更：
  - 无新增存储键
- 配置/Manifest 变更：
  - 无

## 6. 验证
- 自动化测试：
  - `npm run typecheck`
  - `npm run build`
- 手工验证步骤：
  1. 刷新扩展并打开 ChatGPT 会话页
  2. 在提示词库点击“插入”，确认内容进入输入框
  3. 导出包含公式的会话为 Markdown
  4. 检查导出文件中是否保留 `$...$` 与 `$$...$$` 公式
- 测试结果摘要：
  - 类型检查与构建通过，修复链路具备可用性。

## 7. 风险与回滚
- 已知风险：
  - 若 ChatGPT 输入框或消息 DOM 大改，匹配规则可能失效。
- 回滚策略：
  - 回退 `App.tsx` 与 `conversationExport.ts` 到 FEAT-005 版本。

## 8. 后续事项
- 待办项：
  - 增加导出预览（导出前确认）
  - 对代码块、表格、引用做更细粒度导出规则
- 潜在优化：
  - 插入支持“覆盖当前输入/追加输入”切换。

