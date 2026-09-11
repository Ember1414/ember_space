# Ember 余烬 — 个人博客

一个部署在 Cloudflare Pages 上的中英双语个人博客，基于 [Astro](https://astro.build) 构建。界面采用“技术编辑部 + 视觉杂志”的风格，中文是默认语言。

## 功能

- **博客文章**：Markdown 写作，支持精选内容、标签、按年归档、文章目录、阅读进度、标题锚点、代码复制与相关文章
- **评论系统**：[giscus](https://giscus.app)（基于 GitHub Discussions），主题跟随站点切换
- **项目展示**：Markdown 驱动的精选案例与 GitHub 公开仓库列表
- **全文搜索**：[Pagefind](https://pagefind.app) 构建本地索引，支持语言与内容类型筛选
- **RSS 订阅**：`/rss.xml` 只发布中文文章，并生成 sitemap（`/sitemap-index.xml`）
- **深浅主题**：初次访问跟随系统偏好，选择保存在 `localStorage`
- **响应式与无障碍**：移动菜单、跳过导航、键盘焦点、动态状态播报和减少动画偏好

## 本地开发

```sh
npm install
npx astro dev --background # 后台开发服务器，默认 http://localhost:4321
npx astro dev status       # 查看后台服务器状态
npx astro dev logs         # 查看开发日志
npx astro dev stop         # 停止后台服务器
npm run build    # 构建到 dist/ 并生成搜索索引
npm run preview  # 本地预览构建产物（搜索可用）
```

## 修改关于页

关于页的自我介绍在 **`src/content/about.md`**，直接用 Markdown 编辑（在 GitHub 网页上也能改）。
改完推送 + 重新构建部署即可上线。

页面下方的结构化信息（邮箱、GitHub、坐标等）在 `src/consts.ts` 的 `SITE` 中修改。

## 双语（中/EN）

站点是完整双语结构：中文为默认语言（无前缀），英文挂在 `/en/` 前缀下（如 `/en/posts/…`）。

- 界面文案字典：`src/i18n/ui.ts`（新增文案时在此补 `zh` / `en` 两个 key）
- 导航栏有「中 / EN」按钮互切；访问根路径始终进入中文站，不按浏览器语言跳转
- 文章 frontmatter 支持 `lang: zh`（默认）或 `lang: en`；两个语言的列表、标签和搜索结果彼此独立
- 互译文章使用相同的 `translationKey`。只有译文真实存在时，详情页才显示语言入口并输出对应 `hreflang`
- 没有英文文章时，英文列表显示空状态和中文站入口，不把中文原文标记为英文内容
- 关于页英文版：`src/content/about-en.md`

## 写文章

在 `src/content/posts/` 下新建 Markdown 文件：

```md
---
title: 文章标题
description: 一句话摘要（列表和 SEO 用）
pubDate: 2026-09-01
updatedDate: 2026-09-08 # 可选
tags: [标签1, 标签2]
draft: false # true 则不会发布
lang: zh # zh 或 en
featured: false
series: Astro 实践 # 可选
translationKey: astro-practice-01 # 可选，互译文章使用相同值
cover: ../../assets/example-cover.webp # 可选，相对于当前 Markdown
coverAlt: 封面内容说明 # 设置 cover 时必填
---

正文从这里开始，标准 Markdown 语法。
```

## 项目展示

`/projects/` 先展示本地维护的精选案例，再展示 GitHub 公开仓库（不含 fork）。首页也会选取两类内容中的代表项目。构建时会尝试从 GitHub API 更新仓库数据。

你的本地网络可能无法访问 GitHub API，因此有缓存回退机制：

- 在线拉取成功 → 自动更新缓存文件 `src/data/github-repos.json`
- 拉取失败 → 直接使用缓存

刷新仓库列表的方式：在能访问 GitHub API 的网络下重新构建，或直接编辑 `src/data/github-repos.json`（字段与 GitHub API 一致，也可以手动改名字/描述）。

> 提示：在 GitHub 仓库页的 About 里填写 description，会自动显示在项目卡片上。

### 精选项目（可选）

在 `src/content/projects/` 下新建 Markdown 文件：

```md
---
name: 项目名称
description: 项目解决的问题与核心价值
url: https://example.com # 可选，演示或产品地址
repo: https://github.com/user/repo # 可选
tags: [Astro, TypeScript]
year: 2026
order: 1
lang: zh # zh 或 en
featured: true
status: 持续更新 # 可选
role: 设计与开发 # 可选
highlights:
  - 可核实的实现亮点
  - 可核实的兼容性或功能范围
image: ../../assets/project.webp # 可选
imageAlt: 项目截图说明 # 设置 image 时必填
---

正文可以继续说明背景、取舍和实现方式。
```

项目亮点应来自仓库、演示或实际结果，不填写无法验证的指标。英文项目需要独立条目并设置 `lang: en`。

## 部署（GitHub Actions 全自动，已配置好）

推送到 `main` 分支即自动构建部署；**每天北京时间 10:30 定时同步** GitHub 仓库列表；也可在 GitHub 仓库的 Actions 页手动 Run workflow。

前置配置（一次性）：仓库 Settings → Secrets and variables → Actions → 添加 Secret `CLOUDFLARE_API_TOKEN`（在 Cloudflare Dashboard → My Profile → API Tokens 用 "Cloudflare Pages — Edit" 模板创建）。

手动部署（备用）：

```sh
npm run build
npx wrangler pages deploy dist --project-name=ember-space --branch=main
```

线上地址：https://ember-space.pages.dev

> 注意：不要在 Cloudflare Dashboard 再给这个项目连接 GitHub 仓库——同一 Pages 项目只能有一种部署来源，会冲突。

### 启用评论（giscus）

1. 仓库需要是 **public**，并开启 **Settings → Discussions**
2. 安装 [giscus app](https://github.com/apps/giscus)
3. 到 [giscus.app](https://giscus.app) 按向导生成，拿到 `repo`、`repoId`、`category`、`categoryId`
4. 填入 `src/consts.ts` 的 `GISCUS` 配置，重新部署

> 注意：`repoId` / `categoryId` 在 giscus.app 页面底部的生成代码里（`data-repo-id`、`data-category-id`）。

## 上线前必改

`src/consts.ts` 中的站点信息：`url`（改成你的域名，影响 RSS/sitemap/OG）、`author`、`description`、社交链接。

## 目录结构

```
/
├── src/
│   ├── consts.ts                # 站点配置（标题、社交、giscus）
│   ├── content.config.ts        # 内容集合 schema
│   ├── content/posts/           # 博客文章（Markdown）
│   ├── content/projects/        # 项目展示（Markdown）
│   ├── components/              # Header / Footer / PostCard / Giscus 等
│   ├── layouts/BaseLayout.astro # 全局布局与 SEO
│   ├── pages/                   # 路由页面（首页/文章/项目/关于/标签/搜索/RSS）
│   └── styles/global.css        # 主题变量与全局样式
└── astro.config.mjs
```
