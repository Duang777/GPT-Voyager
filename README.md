# GPT Voyager（ChatGPT 网页效率扩展）

GPT Voyager 是一个为 `chatgpt.com` / `chat.openai.com` 提供侧边栏工作台的浏览器扩展。  
它的目标很明确：把会话管理、提示词复用、公式/图表处理、导出与备份放到一个稳定、可复用的工作流里。

## 下载与入口
- 最新版本下载（ZIP）：<https://github.com/Duang777/GPT/releases/latest>
- 项目仓库：<https://github.com/Duang777/GPT>
- 隐私政策：<https://duang777.github.io/GPT/privacy.html>

## 这个扩展解决什么问题
- ChatGPT 会话越来越多，原生列表难以检索和整理。
- 提示词重复输入，变量替换效率低。
- 技术内容（公式、Mermaid）缺少统一提取与导出能力。
- 重要会话和结构化数据缺少稳定的本地归档路径。

## 核心能力
### 会话工作台
- 自动采集可见会话并建立本地索引。
- 按标题 / 会话 ID / 备注搜索。
- 文件夹、标签、星标、备注管理。
- 多选批量操作（批量设文件夹 / 批量加减标签）与撤销。
- 列表支持排序、卡片密度切换与虚拟滚动。

### 提示词库
- 提示词模板增删改查。
- 变量模板填充（`{{变量名}}`）。
- 变量预设保存/套用。
- 模板导入导出与批量导出。

### 技术内容工作台
- 公式工作台：提取公式、复制 LaTeX、复制 Word 可渲染 MathML、定位来源消息。
- Mermaid 工作台：识别图表、预览、收藏、源码/SVG/HTML 导出。

### 导出与备份
- 当前会话导出 Markdown / HTML。
- 时间线节点筛选导出 Markdown / HTML。
- 本地 JSON 备份导出/导入（会话、分类、提示词、收藏、设置）。

## 安装（给使用者）
1. 打开 `Releases` 下载最新 ZIP。  
2. 解压后得到扩展目录（目录内有 `manifest.json`）。  
3. 打开 `chrome://extensions/`。  
4. 开启“开发者模式”。  
5. 点击“加载已解压的扩展程序”，选择解压目录。  
6. 访问 `https://chatgpt.com/`，右侧即可看到 GPT Voyager。

## 版本发布（给维护者）
推荐先用 GitHub Release 分发 ZIP（不依赖 Chrome 商店）：

```powershell
npm run typecheck
npm run build
npm run package:zip
```

执行后会在 `release/` 目录生成 ZIP。  
将 ZIP 上传到 GitHub Release 后，用户即可通过 `releases/latest` 下载。

自动发布已支持：推送 `v*` 标签会自动构建并上传 ZIP 到 GitHub Release。  
详见：`docs/store/AUTO_RELEASE_BY_TAG_ZH-CN.md`

## 本地开发
### 环境
- Node.js 20+
- Chrome / Edge（Manifest V3）

### 安装依赖
```powershell
npm install
```

如果网络较慢（中国大陆）：
```powershell
npm install --registry=https://registry.npmmirror.com
```

### 常用命令
```powershell
npm run dev
npm run typecheck
npm run build
npm run package:zip
```

## 文档
- 功能日志：`docs/FEATURE_LOG.md`
- 需求文档：`PRD.md`
- 分发与上架资料：`docs/store/README.md`
