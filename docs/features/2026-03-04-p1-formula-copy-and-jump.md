# FEAT-018：P1 消息内公式一键复制与定位

## 1. 元信息
- 功能 ID：FEAT-018
- 功能名称：实现公式工作台（筛选、复制 TeX、定位消息）
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A（工作区直接更新）

## 2. 概述
继续按顺序开发，在会话工作台新增“公式工作台”。该模块会从当前会话消息中提取 LaTeX 公式，支持按关键词和行内/块级类型筛选，并提供“复制 TeX”与“定位消息”两项核心操作。

## 3. 需求映射
- 对应 PRD 章节：6.2（P1 增强能力）、9（效率与可维护性）
- 覆盖的用户场景：
  - 用户希望快速复用对话中的公式到文档或代码中。
  - 用户希望从公式反向定位原始消息上下文。
- 本次范围：
  - 公式采集（KaTeX/MathJax）
  - 公式筛选（关键词 + 显示模式）
  - 公式复制与消息定位
- 本次不包含：
  - 公式批量导出
  - 公式收藏持久化

## 4. 设计
- 关键设计决策：
  - 新增独立模块 `conversationFormula.ts`，解耦 `App.tsx`。
  - 采集优先读取 `annotation` 中 TeX 原文，保证复制准确性。
  - 与时间线复用同一会话观察器触发派生数据刷新。
- 取舍说明：
  - 当前以准确提取和快捷操作为主，暂不引入复杂公式渲染预览。
- 权限/数据/隐私考虑：
  - 仅读取页面内 DOM，不新增权限，不外发数据。

## 5. 实现
- 主要变更文件：
  - `src/content/conversationFormula.ts`
  - `src/content/App.tsx`
  - `src/content/index.tsx`
  - `README.md`
- 核心逻辑：
  - `collectConversationFormulaNodes`：采集消息内公式节点，输出 `tex/source/displayMode/messageIndex`。
  - `App.tsx`：
    - 新增状态：`formulaItems`、`formulaQuery`、`formulaDisplayFilter`
    - 新增行为：`copyFormulaTex`、`jumpToFormulaItem`
    - 新增 UI：公式工作台区块、筛选控件、列表操作按钮
  - `index.tsx`：
    - 新增公式列表样式与类型徽标样式（行内/块级）
- 数据模型/存储变更：
  - 无持久化变更（运行时派生数据）
- 配置/Manifest 变更：
  - 无

## 6. 验证
- 自动化测试：
  - `npm run typecheck`
  - `npm run build`
- 手工验证步骤：
  1. 打开包含公式的会话。
  2. 在“公式工作台”查看采集结果，切换“行内/块级”筛选。
  3. 点击“复制 TeX”，粘贴验证内容正确。
  4. 点击“定位消息”，确认页面滚动到对应公式所在消息并高亮。
- 测试结果摘要：
  - 类型检查与构建通过，复制与定位链路可用。

## 7. 风险与回滚
- 已知风险：
  - 若 ChatGPT 未来移除 `annotation`，需要调整提取策略。
- 回滚策略：
  - 回退 `conversationFormula.ts` 与 `App.tsx` 的公式工作台区块。

## 8. 后续事项
- 待办项：
  - 公式收藏与分组。
  - 一键导出当前会话全部公式。
- 潜在优化：
  - 增加公式预览（渲染）与复制格式选项（TeX/MathML）。
