# FEAT-049：PDF 导出 + 账户隔离模式 + 引用回复

## 1. 元信息
- 功能 ID：FEAT-049
- 功能名称：PDF 导出 + 账户隔离模式 + 引用回复
- 日期：2026-03-05
- 作者：Codex
- 分支：main

## 2. 概述
本次实现三项高收益能力：
- 当前会话导出 PDF（含图片）。
- 账户隔离模式（按 ChatGPT 账号维度隔离本地数据作用域）。
- 页面选中文本后一键“引用回复”插入对话框。

## 3. 需求映射
- 对应需求：
  - PDF 导出用于交付与归档。
  - 账号隔离避免多账号数据混淆。
  - 引用回复提升写作与审阅效率。
- 覆盖场景：
  1. 用户导出会话给他人，要求图片保留。
  2. 一个浏览器中切换多个 ChatGPT 账号，数据不串。
  3. 用户阅读长文时选中段落直接带引用回复。

## 4. 实现
- 主要变更文件：
  - `src/content/conversationExport.ts`
  - `src/content/App.tsx`
  - `src/content/settingsStore.ts`
  - `src/content/storageScope.ts`
  - `src/content/accountScope.ts`
  - `src/content/conversationIndex.ts`
  - `src/content/classificationStore.ts`
  - `src/content/promptLibrary.ts`
  - `src/content/formulaFavoritesStore.ts`
  - `src/content/mermaidFavoritesStore.ts`
  - `src/content/timelineAnnotationsStore.ts`
  - `PRD.md`
  - `docs/FEATURE_LOG.md`

### 4.1 PDF 导出（含图片）
- 在会话导出模块新增 `exportCurrentConversationToPdf`。
- 方案：复用 HTML 导出内容，构建打印友好文档并自动触发 `window.print()`，由浏览器“另存为 PDF”。
- 导出面板新增 `导出 PDF` 按钮。
- 图片保留：导出 HTML 中增加 `img` 样式约束，确保打印排版可控。

### 4.2 账户隔离模式
- 新增存储作用域工具：`storageScope.ts`。
  - 规则：`base_key__scope`。
  - 全局作用域保留原 key，兼容历史数据。
- 各数据存储模块新增按作用域加载/保存：
  - 会话索引、分类、提示词、公式收藏、Mermaid 收藏、时间线标注。
- App 中根据设置计算 `activeStorageScope`，并在作用域切换时重载数据。
- 设置页新增：
  - 账户隔离模式开关。
  - 手动作用域输入（可选）。
  - 自动识别账号信息展示（来源 + 当前作用域）。
- 新增账号识别模块：`accountScope.ts`（`__NEXT_DATA__` / DOM / localStorage 多源检测，失败回退 `guest`）。

### 4.3 引用回复（Quote Reply）
- 新增“选中文本 -> 引用回复”流程：
  - 页面选中非扩展区域文本后，显示浮动按钮“引用回复”。
  - 点击后以 Markdown 引用格式插入输入框（追加模式）。
- 设置页新增开关：`quoteReplyEnabled`。
- 引用格式：每行前缀 `> `，末尾补空行，便于继续输入回复内容。

## 5. PRD 同步
- 已更新 `PRD.md`：
  - P1 增加 PDF 导出、账户隔离模式、引用回复。
  - FR-06 增加 PDF 导出说明。
  - FR-07 增加账户隔离设置项。
  - 新增 FR-11 引用回复。

## 6. 验证
- 自动化：
  - `npm run typecheck` 通过。
  - `npm run build` 通过。
- 手工验证：
  1. 会话页点击“导出 PDF”，弹出打印窗口，可保存为 PDF，图片可见。
  2. 设置中开启账户隔离并切换作用域，数据列表按作用域变化。
  3. 页面选中文本后出现“引用回复”，点击后内容插入输入框。

## 7. 风险与回滚
- 已知风险：
  - PDF 导出依赖浏览器打印能力，可能受弹窗策略影响。
  - 自动账号识别受 ChatGPT 页面结构影响，已提供手动作用域兜底。
- 回滚策略：
  - 回退上述变更文件到本次提交前版本。
