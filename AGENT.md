# AGENT.md - 项目执行规则

## 1. 目的
本文件定义仓库内 AI/人工贡献者必须遵守的执行规则，目标是保证交付稳定、可审计、可持续。

## 2. 事实来源（Source of Truth）
- 产品范围：`PRD.md`
- 功能记录：`docs/features/*.md`
- 功能索引日志：`docs/FEATURE_LOG.md`

当规则冲突时，优先对齐 `PRD.md`，随后同步更新文档。

## 3. 强制规则
- 每个功能实现在合并前必须有文档记录。
- 未满足以下条件不得合并代码：
  - 在 `docs/features/` 下新增一份功能文档
  - 在 `docs/FEATURE_LOG.md` 增加一行记录
- 任何行为/范围变更必须同步更新 `PRD.md`。
- 提交应保持聚焦，并能追溯到具体功能 ID 或任务。

## 4. 环境与依赖安装
所有包安装必须在虚拟环境中完成（Python 侧）。

### 4.1 Windows PowerShell（必需）
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

### 4.2 安装依赖
```powershell
pip install -r requirements.txt
```

若网络较慢，使用清华源：
```powershell
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 4.3 前端依赖（如适用）
- 使用锁文件安装（`npm ci` 或 `pnpm install --frozen-lockfile`）。
- Node 依赖保持项目内安装，非必要不做全局安装。

## 5. 功能交付流程
1. 对照 `PRD.md` 明确功能范围。
2. 按最小权限和本地优先原则实现代码。
3. 完成测试/校验（自动化或手工证据）。
4. 以 `docs/features/TEMPLATE.md` 创建功能文档。
5. 在 `docs/FEATURE_LOG.md` 追加索引条目。
6. 如产品行为或范围变化，同步更新 `PRD.md`。
7. 发起 PR，提供精炼变更说明与验证证据。

## 6. 功能文档规范
文件命名：
- `docs/features/YYYY-MM-DD-feature-slug.md`

必须包含章节：
- 概述
- 需求映射（PRD 章节）
- 设计与实现
- 变更文件
- 测试/验证证据
- 风险与回滚
- 后续事项

## 7. 分支与提交规范
- 分支：`feat/<slug>`、`fix/<slug>`、`docs/<slug>`、`chore/<slug>`
- 提交示例：
  - `feat: add sidebar session index`
  - `fix: handle null conversation id`
  - `docs: add feature record for export markdown`

## 8. PR 检查清单
- [ ] 范围与 `PRD.md` 对齐
- [ ] 代码实现完整
- [ ] 已执行测试/校验（或说明未执行原因）
- [ ] 已新增 `docs/features/*.md`
- [ ] 已更新 `docs/FEATURE_LOG.md`
- [ ] 如有必要，已更新 `PRD.md`
- [ ] 未提交密钥或个人敏感信息

## 9. 质量基线
- 倾向清晰的模块边界与显式类型定义。
- 避免在扩展清单中申请过量权限。
- 本地数据格式应带版本，便于后续迁移。
- 仅在逻辑不直观处补充轻量注释。
