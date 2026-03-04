# 修复与增强：公式渲染改进 + HTML 导出

## 1. 元信息
- 功能 ID：FIX-002 / FEAT-006
- 功能名称：修复部分公式渲染问题并新增会话 HTML 导出
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A（工作区直接更新）

## 2. 概述
针对“部分公式仍无法正确渲染”的反馈，进一步增强 Markdown 导出链路：  
1) 将 `\(...\)` / `\[...\]` 规范化为 `$...$` / `$$...$$`；  
2) 对非数学段中的下划线变量名（如 `AN_c`）进行转义，避免被 Markdown 误判为斜体。  
同时新增会话 HTML 导出，保留聊天消息的结构化 HTML，并在导出页注入基础样式与 KaTeX 样式链接。

## 3. 需求映射
- 对应 PRD 章节：8（FR-06）、14（文档治理）、15（DoD）
- 覆盖的用户场景：
  - 导出的公式在常见 Markdown 渲染器中更稳定显示。
  - 用户可导出 HTML 版本用于直接浏览和存档。
- 本次范围：
  - Markdown 公式定界符兼容增强
  - 非数学文本下划线误解析修复
  - 新增 HTML 导出入口
  - PRD 中 FR-06 范围同步更新为 Markdown/HTML
- 本次不包含：
  - 导出模板自定义
  - 批量会话导出

## 4. 设计
- 关键设计决策：
  - 保留现有 KaTeX/MathJax annotation 还原策略，新增定界符标准化。
  - 先保护数学段，再对普通文本执行下划线转义，避免破坏数学语法。
  - HTML 导出优先保留消息原始结构（清理交互节点后输出）。
- 取舍说明：
  - HTML 导出依赖外部 KaTeX CSS CDN，离线环境下公式样式可能退化。
  - Markdown 渲染质量仍取决于目标渲染器的数学支持能力。
- 权限/数据/隐私考虑：
  - 无新增权限，导出文件仍为本地生成与下载。

## 5. 实现
- 主要变更文件：
  - `src/content/conversationExport.ts`
  - `src/content/App.tsx`
  - `README.md`
  - `PRD.md`
- 核心逻辑：
  - `conversationExport.ts`
    - 新增 `normalizeLatexDelimiters`
    - 新增数学段保护与非数学下划线转义
    - 新增 HTML 导出构建器 `buildConversationHtml`
    - 新增 `exportCurrentConversationToHtml`
  - `App.tsx`
    - 导出按钮拆分为“导出 MD / 导出 HTML”
    - 导出状态文案区分格式类型
  - `PRD.md`
    - FR-06 更新为 Markdown/HTML 导出
- 数据模型/存储变更：
  - 无
- 配置/Manifest 变更：
  - 无

## 6. 验证
- 自动化测试：
  - `npm run typecheck`
  - `npm run build`
- 手工验证步骤：
  1. 在会话页点击“导出 MD”，检查包含公式的段落是否更稳定渲染
  2. 点击“导出 HTML”，打开导出文件验证排版与公式显示
  3. 验证普通变量名（如 `AN_c`）不再被错误渲染为斜体
- 测试结果摘要：
  - 类型检查与构建通过，功能链路可用。

## 7. 风险与回滚
- 已知风险：
  - 少数非常规公式表达仍可能依赖手工修正。
  - HTML 导出在无网络环境可能缺失 KaTeX 样式。
- 回滚策略：
  - 回退 `conversationExport.ts` 和 `App.tsx` 到 FIX-001 版本。

## 8. 后续事项
- 待办项：
  - 可选内嵌 KaTeX 样式以支持离线 HTML 完整渲染
  - 增加导出预览模式
- 潜在优化：
  - 导出时提供“仅正文/含元信息”模板切换。

