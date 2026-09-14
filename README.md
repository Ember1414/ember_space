# Ember 余烬

一个中英双语的极客风个人博客，采用「技术编辑部 + 视觉杂志」的界面风格。文章在网页后台用 Markdown 写作，发布后全站（首页、列表、标签页、RSS、站内搜索）即时更新，无需重新构建或部署。

## 功能

- **在线写作后台**：Markdown 编辑器支持实时预览、草稿自动保存、版本冲突保护、工具栏与图片上传
- **成员与权限**：所有者 / 编辑者 / 读者三种角色；所有者可管理成员与邀请，编辑者管理自己的文章
- **账号体系**：账号密码登录 + GitHub OAuth 一键登录，支持头像与显示名设置
- **网址收藏栏**：我的作品 / 宝藏网站 / 资料三类收藏，后台维护、前台展示
- **即时发布**：公开页面请求时读取数据库，发布即生效
- **站内搜索**：文章为数据库即时检索，静态页面由 Pagefind 提供构建期索引
- **RSS 与 sitemap**、深浅双主题、中英双语路由（中文默认，英文挂 `/en/` 前缀）、响应式与无障碍支持

## 技术栈

- [Astro](https://astro.build)（SSR）+ TypeScript
- [Cloudflare Pages](https://developers.cloudflare.com/pages/) + [D1](https://developers.cloudflare.com/d1/)（SQLite 数据库）+ [KV](https://developers.cloudflare.com/kv/)（图片存储）
- [GitHub Actions](https://github.com/features/actions) CI/CD（测试、类型检查、冒烟测试、部署）
- [Pagefind](https://pagefind.app)（静态页搜索索引）、[giscus](https://giscus.app)（评论，基于 GitHub Discussions）
- 原生 Web Components 风格的渐进增强脚本，无重型前端框架

## 开源协议

[MIT](./LICENSE)
