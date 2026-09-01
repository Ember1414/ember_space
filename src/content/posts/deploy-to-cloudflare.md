---
title: '把博客部署到 Cloudflare Pages'
description: '从 GitHub 仓库到全球 CDN，15 分钟内让博客上线，附带自定义域名与 Pages Functions 的配置笔记。'
pubDate: 2026-07-20
tags: ['Cloudflare', 'DevOps']
---

Cloudflare Pages 对个人项目非常慷慨：无限带宽、每月 500 次构建、自带全球 CDN。

## 部署流程

1. 把代码推到 GitHub 仓库
2. Cloudflare Dashboard → Workers & Pages → 创建 Pages 项目 → 连接仓库
3. 构建命令填 `npm run build`，输出目录填 `dist`
4. 保存后首次构建完成，获得 `*.pages.dev` 域名

## 自定义域名

在项目的 Custom domains 里添加自己的域名，Cloudflare 会自动处理证书，DNS 记录一条 CNAME 搞定。

## Pages Functions

邮件订阅这类小后端用 Pages Functions 实现：仓库里的 `functions/` 目录会自动变成 API 路由，比如 `functions/api/subscribe.ts` 就是 `POST /api/subscribe`。

订阅邮箱存储用 Cloudflare KV，免费额度每天 10 万次读、1000 次写，个人博客绰绰有余。
