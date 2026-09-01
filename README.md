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

## 添加项目展示

在 `src/content/projects/` 下新建 Markdown 文件，frontmatter 参考 `ember-blog.md`：
`name`、`icon`（emoji）、`description`、`url`（可选）、`repo`（可选）、`tags`、`year`、`order`（排序）。

## 部署到 Cloudflare Pages

1. 把代码推送到 GitHub 仓库
2. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → 连接 GitHub 仓库
3. 构建配置：
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 保存并部署，获得 `*.pages.dev` 域名

### 启用邮件订阅（KV）

1. Dashboard → **Storage & Databases** → **KV** → 创建一个 namespace（如 `subscribers`）
2. 进入 Pages 项目 → **Settings** → **Functions** → **KV namespace bindings**
   - 变量名填 `SUBSCRIBERS`，选择刚创建的 namespace
3. 重新部署后，页脚订阅表单即可工作（订阅邮箱存在 KV 中，可在 Dashboard 查看）

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
