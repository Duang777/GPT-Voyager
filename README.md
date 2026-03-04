# GPT Voyager（ChatGPT 网页扩展）

一个面向 ChatGPT 网页端的效率扩展项目。当前版本已实现 `FR-01` + `FR-02` + `FR-03` + `FR-05` + `FR-06` + `FR-07` + `FR-08` + `FR-09`：
- 在 `chatgpt.com` / `chat.openai.com` 注入侧边栏
- 支持收起/展开
- 支持拖拽调整侧边栏宽度并持久化
- 自动采集页面可见会话并构建本地索引
- 支持按标题/ID 搜索并一键打开会话
- 支持文件夹/标签管理、会话归类与分类筛选
- 支持文件夹快速打开视图（按文件夹/未分类一键切换会话列表）
- 支持会话星标与备注（自定义元数据）及联动筛选
- 支持星标会话快捷访问区与一键“仅星标”视图
- 支持会话多选与批量操作（批量设文件夹、批量加/去标签）
- 支持批量操作撤销（可一键撤销上一次批量修改）
- 支持当前会话时间线导航（按角色/关键词筛选并点击定位消息）
- 支持按时间线筛选结果导出节点（Markdown/HTML）
- 支持消息内公式工作台（筛选、复制 TeX、复制 Word 公式 MathML、定位消息）
- 支持公式收藏与别名管理（收藏、改名、定位来源、删除）
- 支持 Mermaid 图表工作台（识别、预览、复制源码、定位消息）
- 支持直接点击页面公式复制 TeX（可在设置中开关）
- 支持提示词片段库（保存、编辑、复制、插入输入框）
- 支持提示词标签分组、标签筛选与关键词搜索
- 支持提示词变量模板（`{{变量名}}`）填写后一键插入
- 支持当前会话导出 Markdown/HTML（包含公式 LaTeX 还原）
- 支持扩展数据导出/导入 JSON 备份（会话索引、分类、提示词、公式收藏、设置）
- 支持设置项（自动扫描、扫描间隔、提示词插入模式、默认导出格式、快捷键、点击公式复制开关）
- 支持分区导航（会话工作台 / 提示词库 / 使用说明 / 设置中心）与白色/米白简约主题
- 支持批量快捷键（`Ctrl/⌘ + Shift + B/N/Z`）和自定义下拉弹层（时间线/公式筛选）
- 会话索引筛选区改为简约模式（默认常用筛选，高级筛选可折叠）
- 优化了控件对齐与间距统一（输入框/按钮/筛选区统一高度）与柔和动效反馈

## 1. 环境要求
- Node.js 20+
- Chrome/Edge（支持 Manifest V3）

## 2. 安装依赖
```powershell
npm install
```

如果网络较慢，可尝试镜像源（示例）：
```powershell
npm install --registry=https://registry.npmmirror.com
```

## 3. 构建
```powershell
npm run build
```

构建产物在 `dist/` 目录。

## 4. 本地调试（Chrome）
1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择项目目录下的 `dist/`
5. 打开 `https://chatgpt.com/` 验证侧边栏

## 5. 开发模式
```powershell
npm run dev
```

`dev` 会监听源码并实时重建。重建后在扩展页点击刷新即可生效。

## 6. 项目结构
```text
src/
  manifest.json            # 扩展清单
  background/index.ts      # Service worker
  content/index.tsx        # 注入入口 + Shadow DOM 挂载
  content/App.tsx          # 侧边栏 UI 与交互
  content/conversationIndex.ts   # 会话采集与索引存储
  content/classificationStore.ts # 分类管理存储
  content/promptLibrary.ts       # 提示词库存储
  content/conversationExport.ts  # 会话导出 Markdown/HTML
  content/conversationTimeline.ts # 会话时间线采集与观察
  content/conversationFormula.ts  # 会话公式采集
  content/conversationMermaid.ts # Mermaid 图表采集
  content/mermaidRender.ts       # Mermaid SVG 渲染
  content/formulaFavoritesStore.ts # 公式收藏与别名存储
  content/settingsStore.ts       # 用户设置存储
  content/dataBackup.ts          # 扩展数据 JSON 备份导出/导入
scripts/
  build.mjs                # esbuild 构建脚本
docs/
  FEATURE_LOG.md           # 功能日志索引
  features/*.md            # 功能实现文档
```
