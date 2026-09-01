# Ember 余烬 — 个人博客

一个部署在 Cloudflare Pages 上的暗色极客风个人博客，基于 [Astro](https://astro.build) 构建。

## 功能

- **博客文章**：Markdown 写作，支持标签分类、文章目录（TOC）、代码高亮（Shiki 双主题）、阅读时长估算
- **评论系统**：[giscus](https://giscus.app)（基于 GitHub Discussions），主题跟随站点切换
- **项目展示**：卡片式作品集页面
- **全文搜索**：[Pagefind](https://pagefind.app)，构建后生成索引，纯浏览器端搜索，支持中文
- **RSS 订阅**：`/rss.xml`，配合 sitemap（`/sitemap-index.xml`）
- **深浅主题**：默认暗色终端风，可一键切换亮色，跟随系统偏好，localStorage 持久化
- **邮件订阅**：Cloudflare Pages Functions + KV 实现，页脚表单提交

## 本地开发

```sh
npm install
npm run dev      # 开发服务器 http://localhost:4321（搜索与订阅 API 不可用）
npm run build    # 构建到 dist/ 并生成搜索索引
npm run preview  # 本地预览构建产物（搜索可用，订阅 API 仅线上有效）
```

## 修改关于页

关于页的自我介绍在 **`src/content/about.md`**，直接用 Markdown 编辑（在 GitHub 网页上也能改）。
改完推送 + 重新构建部署即可上线。

页面下方的结构化信息（邮箱、GitHub、坐标等）在 `src/consts.ts` 的 `SITE` 中修改。

## 写文章

在 `src/content/posts/` 下新建 Markdown 文件：

```md
---
title: 文章标题
description: 一句话摘要（列表和 SEO 用）
pubDate: 2026-09-01
tags: [标签1, 标签2]
draft: false # true 则不会发布
---

正文从这里开始，标准 Markdown 语法。
```

## 项目展示

`/projects/` 页面和首页的项目卡片**自动展示 GitHub 公开仓库**（不含 fork），构建时从 GitHub API 拉取。

你的本地网络可能无法访问 GitHub API，因此有缓存回退机制：

- 在线拉取成功 → 自动更新缓存文件 `src/data/github-repos.json`
- 拉取失败 → 直接使用缓存

刷新仓库列表的方式：在能访问 GitHub API 的网络下重新构建，或直接编辑 `src/data/github-repos.json`（字段与 GitHub API 一致，也可以手动改名字/描述）。

> 提示：在 GitHub 仓库页的 About 里填写 description，会自动显示在项目卡片上。

### 精选项目（可选）

如果想手动置顶展示某些项目（如无 GitHub 仓库的作品），在 `src/content/projects/` 下新建 Markdown 文件，frontmatter 格式：
`name`、`icon`（emoji）、`description`、`url`（可选）、`repo`（可选）、`tags`、`year`、`order`（排序）。
添加后会以「精选项目」区块显示在 GitHub 仓库列表上方。

## 部署（wrangler Direct Upload，已配置好）

本项目使用 Direct Upload 模式部署（`wrangler.toml` 已含 KV 绑定），更新站点只需两条命令：

```sh
npm run build
npx wrangler pages deploy dist --project-name=ember-space --branch=main
```

线上地址：https://ember-space.pages.dev

> 注意：不要在 Cloudflare Dashboard 再给这个项目连接 GitHub 仓库——同一 Pages 项目只能有一种部署来源，会冲突。

### 邮件订阅（KV）

`wrangler.toml` 已声明 `SUBSCRIBERS` KV 绑定，部署时自动生效。查看订阅者：

```sh
npx wrangler kv key list --namespace-id=0f643c099c2e4b6aa129eb7a363d5d64
```

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
├── functions/api/subscribe.ts   # Cloudflare Pages Function（订阅 API）
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
