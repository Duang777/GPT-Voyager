# 功能记录

## 1. 元信息
- 功能 ID：FIX-021
- 功能名称：修复 Shadow DOM 事件重定向导致下拉选项无法选择
- 日期：2026-03-05
- 作者：Codex
- 分支：main

## 2. 概述
- 修复时间线/公式/提示词/设置中下拉“展开后无法选中”的共性问题。  
- 根因是窗口级 `pointerdown` 关闭监听在 Shadow DOM 中使用 `target + contains` 判断不稳定，导致组件内点击被误判为外部点击而提前关闭。

## 3. 需求映射
- 对应 PRD 章节：`FR-01 侧边栏`
- 覆盖的用户场景：
  - 用户在任意模块下拉中点击选项，可正常完成选择。
- 范围说明（In scope / Out of scope）：
  - In scope：下拉外部点击判定逻辑。
  - Out of scope：下拉样式与选项数据来源。

## 4. 设计
- 关键设计决策：
  - 外部点击判定优先使用 `event.composedPath()` 检测是否命中组件根节点。
  - 在不支持 `composedPath` 的场景回退到 `contains(target)` 逻辑。
- 取舍说明：
  - 增加少量事件判定复杂度，换取 Shadow DOM 场景下稳定交互。

## 5. 实现
- 主要变更文件：
  - `src/content/App.tsx`
- 核心逻辑：
  - `VoyagerSelect` 的 `onPointerDown` 外部点击关闭判断由单一 `contains(target)` 改为 `composedPath + fallback`。

## 6. 验证
- 自动化测试：
  - `npm run typecheck` 通过。
  - `npm run build` 通过。
- 手工验证步骤：
  1. 在时间线/公式/提示词/设置模块打开下拉。
  2. 点击任一选项，确认值变化且菜单关闭。
  3. 重复多次切换不同选项，确认稳定无误。
- 测试结果摘要：
  - 下拉选项点击恢复正常，跨模块一致。

## 7. 风险与回滚
- 已知风险：
  - 无新增风险。
- 回滚策略：
  - 回滚 `App.tsx` 中 `onPointerDown` 判定逻辑改动。

## 8. 后续事项
- 待办项：
  - 无。
