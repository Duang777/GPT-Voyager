# FEAT-019：点击页面公式直接复制 TeX（可开关）

## 1. 元信息
- 功能 ID：FEAT-019
- 功能名称：支持点击页面公式直接复制 LaTeX
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A（工作区直接更新）

## 2. 概述
在现有“公式工作台”基础上，新增更高效的直接交互：用户可直接点击聊天正文中的公式，即时复制对应 TeX。功能默认开启，并提供设置开关，避免误触。

## 3. 需求映射
- 对应 PRD 章节：6.2（P1 效率增强）、9（交互效率）
- 覆盖的用户场景：
  - 用户浏览对话时遇到目标公式，希望不切换面板、直接复制。
- 本次范围：
  - 正文公式点击识别（KaTeX/MathJax）
  - 复制反馈状态
  - 设置开关控制
- 本次不包含：
  - 双击复制/长按复制手势
  - 复制后自动格式转换

## 4. 设计
- 关键设计决策：
  - 在 `document` 捕获阶段监听点击，命中 `.katex` 或 `mjx-container` 时复制。
  - 新增 `extractFormulaFromTarget`，复用公式提取逻辑，避免分叉实现。
  - 忽略扩展侧边栏区域点击（防止误触发）。
- 取舍说明：
  - 保持“单击即复制”以最大化效率，同时允许用户在设置关闭。
- 权限/数据/隐私考虑：
  - 仅本地处理 DOM 与剪贴板，不外发数据。

## 5. 实现
- 主要变更文件：
  - `src/content/conversationFormula.ts`
  - `src/content/settingsStore.ts`
  - `src/content/App.tsx`
  - `README.md`
- 核心逻辑：
  - `conversationFormula.ts`
    - 新增 `extractFormulaFromTarget`
    - 抽取 `readFromKatexNode/readFromMathJaxNode` 复用读取逻辑
  - `settingsStore.ts`
    - 新增设置字段 `formulaClickCopyEnabled`（默认 `true`）
  - `App.tsx`
    - 新增点击监听 effect：命中公式后复制 TeX 并短暂高亮
    - 设置中心新增“点击页面公式自动复制 TeX”开关
- 数据模型/存储变更：
  - `gpt_voyager_settings_v1` 新增字段：`formulaClickCopyEnabled: boolean`
- 配置/Manifest 变更：
  - 无

## 6. 验证
- 自动化测试：
  - `npm run typecheck`
  - `npm run build`
- 手工验证步骤：
  1. 打开含公式对话，直接点击公式。
  2. 粘贴验证已复制 TeX。
  3. 在设置中关闭该开关后再次点击，确认不再自动复制。
- 测试结果摘要：
  - 类型检查与构建通过，点击复制链路可用。

## 7. 风险与回滚
- 已知风险：
  - 单击复制可能与个别用户的“仅查看”习惯冲突。
- 回滚策略：
  - 关闭设置默认值或回退 `App.tsx` 点击监听逻辑。

## 8. 后续事项
- 待办项：
  - 增加“按住 Alt + 点击才复制”的模式选项。
- 潜在优化：
  - 复制后提供更明显的轻提示（Toast）。
