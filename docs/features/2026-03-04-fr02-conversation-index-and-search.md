# FR-02：会话索引与搜索展示

## 1. 元信息
- 功能 ID：FEAT-002
- 功能名称：实现页面可见会话采集、本地索引去重与搜索展示（FR-02）
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A（工作区直接更新）

## 2. 概述
在侧边栏中实现会话索引能力：自动采集 ChatGPT 页面可见会话链接，按会话 ID 去重后合并到本地索引，并提供关键词搜索与一键打开会话操作。

## 3. 需求映射
- 对应 PRD 章节：6.1（P0）、8（FR-02）、10（技术方案）、15（DoD）
- 覆盖的用户场景：
  - 用户希望快速检索目标会话并打开。
  - 用户希望已有会话在页面刷新后仍可被索引。
- 本次范围：
  - 新增会话采集器（基于 DOM 可见链接）
  - 新增本地索引存储与合并去重
  - 新增侧边栏搜索与会话列表交互
  - 新增手动“重新扫描”入口
- 本次不包含：
  - 文件夹/标签分类（FR-03）
  - 提示词库（FR-05）
  - 导出能力（FR-06）

## 4. 设计
- 关键设计决策：
  - 采集规则：扫描页面可见 `a[href]`，仅保留 `/c/<id>` 会话链接。
  - 去重规则：使用 `id` 作为主键，`url` 标准化为 `origin + /c/<id>`。
  - 可靠性策略：`MutationObserver + popstate + visibilitychange + 定时兜底扫描`。
  - 存储策略：索引写入 `chrome.storage.local`，键名为 `gpt_voyager_conversation_index_v1`。
- 取舍说明：
  - 当前按“可见会话”采集，不直接请求内部 API，兼容性更高但信息字段有限。
  - 时间戳采用 `lastSeenAt`（采集时间），后续可扩展真实会话更新时间。
- 权限/数据/隐私考虑：
  - 仅使用本地 `storage` 权限，无外发请求。
  - 索引数据默认保存在浏览器本地。

## 5. 实现
- 主要变更文件：
  - `src/content/conversationIndex.ts`
  - `src/content/App.tsx`
  - `src/content/index.tsx`
  - `README.md`
- 核心逻辑：
  - `collectVisibleConversations`：提取可见会话并生成结构化条目。
  - `mergeConversationIndex`：按 `id` 合并，保留更优标题并更新 `lastSeenAt`。
  - `observeConversationList`：监听页面变化并触发重建索引。
  - `App`：搜索过滤、列表渲染、打开会话、手动扫描、索引持久化。
- 数据模型/存储变更：
  - 新增本地键：`gpt_voyager_conversation_index_v1`
  - 条目结构：`{ id, url, title, lastSeenAt }`
- 配置/Manifest 变更：
  - 无新增权限，沿用现有 `storage`。

## 6. 验证
- 自动化测试：
  - `npm run typecheck`
  - `npm run build`
- 手工验证步骤：
  1. 在 `chrome://extensions/` 刷新已加载的 `dist/` 扩展
  2. 打开 `https://chatgpt.com/`，确保左侧存在会话列表
  3. 检查侧边栏“会话索引”中的计数是否增长
  4. 输入关键词，确认列表实时过滤
  5. 点击某条会话，确认页面跳转到目标会话
  6. 刷新页面后，确认“已索引”数量可保留
- 测试结果摘要：
  - 类型检查通过，构建通过，基础手工路径可用。

## 7. 风险与回滚
- 已知风险：
  - 若 ChatGPT DOM 结构变化，会影响可见会话采集稳定性。
  - 当前会话标题依赖 DOM 文本，可能出现“未命名会话”占比偏高。
- 回滚策略：
  - 回退 `src/content/conversationIndex.ts` 与 `src/content/App.tsx` 到 FEAT-001 版本。

## 8. 后续事项
- 待办项：
  - FR-03：基于本地索引增加文件夹/标签分类。
  - FR-06：从当前会话页面抓取正文并导出 Markdown。
  - 增加对移动布局下隐藏侧栏的采集兜底。
- 潜在优化：
  - 为索引添加版本迁移与大小控制策略。
  - 增加“仅显示当前可见会话”视图切换。

