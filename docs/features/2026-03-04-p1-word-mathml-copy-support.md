# FEAT-027：公式复制支持 Word 直贴渲染（MathML）

## 1. 元信息
- 功能 ID：FEAT-027
- 功能名称：公式复制支持 Word 直贴渲染（MathML）
- 日期：2026-03-04
- 作者：Codex
- 分支：N/A

## 2. 概述
根据用户反馈“需要一键复制 Word 源码并可直接粘贴渲染”，本次在公式工作台与公式收藏中新增“复制 Word”操作。复制时优先写入 MathML 的 `text/html` 与 `text/plain`，以提升在 Microsoft Word 中直接粘贴为可渲染公式的成功率；若当前公式未提取到 MathML，则回退复制 LaTeX 并给出明确提示。

## 3. 需求映射
- 对应 PRD 章节：
  - 6.2（P1：公式复制支持 LaTeX 与 MathML）
- 覆盖的用户场景：
  - 用户希望将网页中的数学公式直接粘贴到 Word 并渲染。
  - 用户仍需保留 LaTeX 复制能力，兼容技术写作工作流。
- 范围说明（In scope / Out of scope）：
  - In scope：
    - 公式项新增“复制 Word”按钮
    - 收藏公式项新增“复制 Word”按钮
    - 剪贴板写入 MathML（HTML + 纯文本双格式）
    - 无 MathML 时回退复制 LaTeX
  - Out of scope：
    - OMML 专用格式转换
    - Word 插件级深度集成

## 4. 设计
- 关键设计决策：
  - 公式采集模型补充 `mathml` 字段（可选），用于 Word 复制。
  - 复制策略优先 `ClipboardItem(text/html + text/plain)`，兼容现代浏览器剪贴板能力。
  - 退化路径：若无 MathML 或 `ClipboardItem` 不可用，自动回退到文本复制并提示。
- 取舍说明：
  - 不直接引入 OMML 转换，降低实现复杂度并避免额外依赖膨胀。
  - 先覆盖 ChatGPT 页面中可直接提取到的 MathML 场景。
- 权限/数据/隐私考虑：
  - 仅本地剪贴板操作，无新增权限和网络请求。

## 5. 实现
- 主要变更文件：
  - `src/content/conversationFormula.ts`
  - `src/content/formulaFavoritesStore.ts`
  - `src/content/App.tsx`
  - `README.md`
  - `PRD.md`
- 核心逻辑：
  - `conversationFormula.ts`：
    - `ConversationFormulaItem`/`ExtractedFormula` 新增 `mathml?: string`
    - 从 KaTeX/MathJax 节点提取 MathML
  - `App.tsx`：
    - 新增 `copyWordMathSource` 复制策略
    - 新增 `copyFormulaWordSource` 回调与状态提示
    - 在公式工作台和公式收藏操作区新增“复制 Word”按钮
  - `formulaFavoritesStore.ts`：
    - 收藏结构新增可选 `mathml` 字段，保持向后兼容
- 数据模型/存储变更：
  - `FormulaFavorite` 新增 `mathml?: string`（可选，不破坏旧数据）。
- 配置/Manifest 变更：
  - 无。

## 6. 验证
- 自动化测试：
  - `npm run typecheck`：通过
  - `npm run build`：通过
- 手工验证步骤：
  1. 在公式工作台点击“复制 Word”。
  2. 打开 Word 直接粘贴，确认公式渲染。
  3. 在收藏列表点击“复制 Word”，重复验证。
  4. 对无 MathML 场景验证回退提示与 LaTeX 复制行为。
- 测试结果摘要：
  - 构建与类型检查通过，Word 复制链路可用。

## 7. 风险与回滚
- 已知风险：
  - Word 对不同来源 MathML 的兼容性可能有差异。
  - 个别场景会回退为 LaTeX 复制（无 MathML 可提取）。
- 回滚策略：
  - 回退 `App.tsx` 的 Word 复制逻辑与 UI 按钮。
  - 回退 `conversationFormula.ts` 的 MathML 提取扩展。
  - 回退收藏结构 `mathml` 字段（可选字段，可平滑忽略）。

## 8. 后续事项
- 待办项：
  - 支持 OMML 复制以提高 Word 兼容上限。
  - 提供“复制格式优先级”设置（TeX / MathML / 双写入）。
- 潜在优化：
  - 在复制结果提示中显示“已使用 MathML / 已回退 LaTeX”标签化提示。
