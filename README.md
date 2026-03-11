<p align="center">
  <img src="src/icons/icon-128.png" alt="GPT Voyager 图标" width="168" />
</p>

<h1 align="center">GPT Voyager</h1>

<p align="center">ChatGPT 网页增强扩展：会话管理、提示词复用、公式与 Mermaid 处理、导出与备份</p>

<p align="center">
  <a href="https://github.com/Duang777/GPT-Voyager/releases/latest">
    <img alt="Release" src="https://img.shields.io/github/v/release/Duang777/GPT-Voyager?label=release&color=2f7ed8" />
  </a>
  <a href="https://github.com/Duang777/GPT-Voyager/stargazers">
    <img alt="Stars" src="https://img.shields.io/github/stars/Duang777/GPT-Voyager?style=flat&color=4b8b3b" />
  </a>
  <a href="https://github.com/Duang777/GPT-Voyager/issues">
    <img alt="Issues" src="https://img.shields.io/github/issues/Duang777/GPT-Voyager?color=b26600" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/Duang777/GPT-Voyager/releases/latest">最新版本下载（ZIP）</a> ·
  <a href="https://duang777.github.io/GPT-Voyager/">在线网页（前端）</a> ·
  <a href="https://duang777.github.io/GPT-Voyager/privacy.html">隐私政策</a>
</p>

## 项目简介
GPT Voyager 是一个面向 `chatgpt.com` / `chat.openai.com` 的浏览器扩展，提供统一的侧边栏工作台。项目目标是把高频、重复、易丢失的操作沉淀为稳定流程：
- 会话组织与检索
- 提示词模板化复用
- 公式/Mermaid 技术内容提取与导出
- 本地可恢复的数据备份体系

## 为什么选择 GPT Voyager
- 专注高频操作：聚焦“会话整理 + 提示词复用 + 技术内容导出”三大刚需。
- 本地优先：核心数据管理与备份流程基于本地，不依赖外部中转服务。
- 技术内容友好：对公式、Mermaid 图表场景做了专门增强，便于写作与交付。
- 可持续迭代：支持 ZIP 快速分发，适合个人开发与小团队快速发布。

## 功能矩阵
| 模块 | 能力 | 典型场景 |
|---|---|---|
| 会话工作台 | 索引、搜索、文件夹、标签、星标、备注、多选批量操作 | 历史会话快速归档与定位 |
| 性能优化 | 虚拟滚动、密度切换、排序能力 | 大量会话下保持流畅 |
| 提示词库 | 模板管理、变量填充、变量预设、导入导出、批量导出 | 固化高质量提示词流程 |
| 公式工作台 | 页面公式提取、点击公式复制（Word 优先 / LaTeX 回退）、来源定位 | 技术写作与公式复用 |
| Mermaid 工作台 | 图表识别、预览、收藏、源码/SVG/HTML 导出 | 结构化图表复用与文档沉淀 |
| 导出与备份 | 会话 Markdown/HTML 导出、时间线节点导出、JSON 备份恢复 | 交付、归档、迁移 |

## 使用场景
- 研究与学习：按主题管理对话，快速回看关键结论。
- 内容创作：管理提示词模板，提高重复创作效率。
- 技术写作：提取公式与 Mermaid 图，直接用于文档交付。
- 团队协作：导出会话记录，沉淀可复盘的知识资产。

## 30 秒上手
1. 打开 [Releases](https://github.com/Duang777/GPT-Voyager/releases/latest) 下载最新 ZIP。
2. 解压后确认目录中存在 `manifest.json`。
3. 浏览器进入 `chrome://extensions/`。
4. 开启“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择解压目录。
6. 打开 `https://chatgpt.com/`，即可在页面侧边使用 GPT Voyager。

## 在线入口
- 在线网页（前端）：<https://duang777.github.io/GPT-Voyager/>
- 最新 Release（ZIP）：<https://github.com/Duang777/GPT-Voyager/releases/latest>
- 仓库地址：<https://github.com/Duang777/GPT-Voyager>
- 隐私政策：<https://duang777.github.io/GPT-Voyager/privacy.html>

## 本地开发（开发者）
### 环境要求
- Node.js 20+
- Chrome / Edge（Manifest V3）

### 安装依赖
```powershell
npm install
```

网络较慢时可使用镜像源：
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

### 命令说明
| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发监听构建 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 生产构建 |
| `npm run package:zip` | 打包 Release ZIP |

## 发布流程
### 手动发布 ZIP
```powershell
npm run typecheck
npm run build
npm run package:zip
```
执行后在 `release/` 目录生成 ZIP，可上传到 GitHub Release。

### 自动发布 ZIP
仓库已配置 GitHub Actions：推送 `v*` 标签后自动构建并上传 ZIP 到 GitHub Release。
详见：`docs/store/AUTO_RELEASE_BY_TAG_ZH-CN.md`

## 项目结构
```text
GPT-Voyager/
├─ src/                 # 扩展核心源码（UI、逻辑、能力模块）
├─ site/                # 在线网页相关资源
├─ docs/                # 文档与发布说明
├─ scripts/             # 构建、打包、资源处理脚本
├─ assets/              # 图片与素材资源
├─ PRD.md               # 产品需求文档
└─ AGENT.md             # 开发协作规范
```

## 文档索引
- 需求文档：`PRD.md`
- 开发规范：`AGENT.md`
- 功能日志：`docs/FEATURE_LOG.md`
- 分发与上架：`docs/store/README.md`

## 路线图（Roadmap）
- 持续优化会话工作台在大数据量下的交互体验。
- 强化提示词模板的协作与分享能力。
- 提升导出格式与结构化内容兼容性。
- 完善文档、示例与上手引导。

## 贡献指南
欢迎通过 Issue / PR 参与改进：
1. Fork 本仓库并创建功能分支（例如 `feat/xxx`、`fix/xxx`、`docs/xxx`）。
2. 完成开发后运行 `npm run typecheck` 与 `npm run build`。
3. 提交 PR，并在描述中说明改动动机、方案和验证方式。

## 常见问题
### 1. 为什么推荐 ZIP 分发？
无需等待商店审核，用户可直接下载并本地加载，适合快速迭代。

### 2. 公式复制到 Word 是如何工作的？
点击页面公式优先复制可渲染 MathML；若浏览器环境不支持富格式剪贴板，会自动回退到 LaTeX。

### 3. 数据会上传到外部服务器吗？
核心数据管理与备份流程以本地存储为主，详情见隐私政策页面。

### 欢迎提PR
