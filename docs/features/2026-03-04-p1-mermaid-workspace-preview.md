# FEAT-026：P1 Mermaid 图表工作台（识别/预览/定位/复制）

## 1. 元信息
- 功能 ID：FEAT-026
- 功能名称：Mermaid 图表工作台（识别/预览/定位/复制）
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A

## 2. 概述
参考公共仓库 `gemini-voyager` 的图表能力方向，本次为 GPT Voyager 增加 Mermaid 工作台。系统可自动识别当前会话中的 Mermaid 代码块，在侧边栏渲染图表预览，并提供源码复制与消息定位，补齐“公式之外的结构化图表内容”处理能力。

## 3. 需求映射
- 对应 PRD 章节：
  - 6.2（P1：Mermaid 图表工作台）
  - 8（FR-09 图表工作台）
- 覆盖的用户场景：
  - 用户在会话中生成流程图/架构图后，希望直接查看图表而非只看代码。
  - 用户希望快速复制 Mermaid 源码到文档或其他工具。
  - 用户希望从图表列表快速定位到原始消息上下文。
- 范围说明（In scope / Out of scope）：
  - In scope：
    - Mermaid 代码块识别
    - Mermaid SVG 预览渲染
    - Mermaid 源码复制
    - Mermaid 来源消息定位
  - Out of scope：
    - Mermaid 收藏与导出
    - Mermaid 语法自动修复
    - 非 Mermaid 图表 DSL 渲染

## 4. 设计
- 关键设计决策：
  - 新增独立采集模块 `conversationMermaid.ts`，与时间线/公式工作台保持同类结构。
  - 新增渲染模块 `mermaidRender.ts`，统一处理 Mermaid 初始化和 SVG 生成。
  - 渲染失败显示错误占位，不中断整体面板。
  - 图表列表沿用“筛选 + 卡片 + 操作按钮”交互模式，降低学习成本。
- 取舍说明：
  - 先提供本地预览与复制，暂不做收藏、导出和跨会话索引。
  - 采用 Mermaid 官方运行时渲染，换取稳定性和可维护性。
- 权限/数据/隐私考虑：
  - 渲染和提取在本地完成，不引入网络请求。
  - 不新增扩展权限。

## 5. 实现
- 主要变更文件：
  - `src/content/conversationMermaid.ts`（新增）
  - `src/content/mermaidRender.ts`（新增）
  - `src/content/App.tsx`
  - `src/content/index.tsx`
  - `README.md`
  - `PRD.md`
- 核心逻辑：
  - `collectConversationMermaidNodes`：从消息 DOM 采集 Mermaid 代码块及来源消息索引。
  - `renderMermaidSvg`：Mermaid 懒初始化并输出 SVG。
  - App 侧新增状态：
    - `mermaidItems`、`mermaidQuery`、`mermaidStatus`
    - `mermaidSvgById`、`mermaidErrorById`、`mermaidActiveId`
  - 新增 Mermaid 工作台 UI：
    - 刷新图表
    - 搜索过滤
    - 图表预览
    - 复制源码
    - 定位消息
- 数据模型/存储变更：
  - 无持久化字段变更。
- 配置/Manifest 变更：
  - 新增依赖：`mermaid`

## 6. 验证
- 自动化测试：
  - `npm run typecheck`：通过
  - `npm run build`：通过
- 手工验证步骤：
  1. 在会话中生成 Mermaid 代码块（如 `graph TD`）。
  2. 打开 Mermaid 工作台，点击“刷新图表”。
  3. 检查图表是否成功渲染。
  4. 点击“复制源码”，验证剪贴板内容。
  5. 点击“定位消息”，验证页面跳转并高亮到来源消息。
- 测试结果摘要：
  - 功能链路可用，类型检查与构建通过。

## 7. 风险与回滚
- 已知风险：
  - Mermaid 运行时依赖较大，可能提高 content bundle 体积。
  - 个别复杂语法在渲染失败时仅提供错误提示，不自动修复。
- 回滚策略：
  - 回退 `conversationMermaid.ts`、`mermaidRender.ts` 及 `App.tsx` Mermaid UI 片段。
  - 回退 `package.json` 中 `mermaid` 依赖。
  - 回退 `README.md` 与 `PRD.md` 对应描述。

## 8. 后续事项
- 待办项：
  - Mermaid 图表收藏与别名管理。
  - Mermaid 图表导出（SVG/PNG）。
- 潜在优化：
  - 渲染结果缓存，减少重复渲染开销。
  - 支持按会话构建 Mermaid 历史索引。
