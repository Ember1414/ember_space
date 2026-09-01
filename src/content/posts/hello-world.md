---
title: '你好，世界：这个博客是如何搭建的'
description: '用 Astro + Cloudflare Pages 从零搭建一个免费的极客风个人博客，完整记录技术选型与部署过程。'
pubDate: 2026-08-30
tags: ['Astro', 'Cloudflare', '建站']
---

欢迎来到我的博客！这是第一篇文章，记录一下这个站点是如何搭建的。

## 技术选型

整个站点基于以下技术栈，全部免费：

| 工具 | 用途 |
| ---- | ---- |
| Astro | 静态站点框架，默认零 JS |
| Cloudflare Pages | 免费托管 + CDN |
| Pagefind | 构建后的静态全文搜索 |
| giscus | 基于 GitHub Discussions 的评论 |

> 静态站点的最大好处：没有服务器要维护，没有数据库要备份，天下太平。

## 为什么选 Astro

Astro 的理念很简单——**内容站点不需要把整个 React 运行时发给用户**。它默认输出纯 HTML，只有在真正需要交互的地方才加载 JS（Islands 架构）。

```ts
// astro.config.mjs
export default defineConfig({
  site: 'https://ember.pages.dev',
  integrations: [sitemap()],
});
```

## 写作流程

文章就是 `src/content/posts/` 目录下的 Markdown 文件，写完推送到 GitHub 即自动发布：

```md
---
title: 文章标题
description: 一句话摘要
pubDate: 2026-08-30
tags: [Astro, Cloudflare]
---

正文从这里开始……
```

## 部署

Cloudflare Pages 连接 GitHub 仓库后，每次 push 自动构建部署。构建命令 `npm run build`，输出目录 `dist`。

接下来我会在完善写作工作流的同时，持续给这个站点添砖加瓦。
