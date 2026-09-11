# Ember 余烬 — 个人博客

一个部署在 Cloudflare Pages 上的中英双语个人博客，基于 [Astro](https://astro.build) 构建。站点使用 Cloudflare Pages SSR 提供公开页面和编辑后台，Cloudflare D1 保存文章、用户、邀请与会话数据。界面采用“技术编辑部 + 视觉杂志”的风格，中文是默认语言。

## 功能

- **博客与后台**：在 `/admin/` 使用 Markdown 编辑器写作，支持草稿、发布、撤回、标签、精选内容、按年归档、文章目录、阅读进度、标题锚点、代码复制与相关文章
- **即时发布**：公开首页、文章列表、文章详情、标签页和 RSS 在请求时读取 D1；文章发布后无需提交 Git 或重新部署
- **成员权限**：所有者可管理全部文章、邀请和协作者；编辑者可创建、编辑并发布自己的文章
- **评论系统**：[giscus](https://giscus.app)（基于 GitHub Discussions），主题跟随站点切换
- **项目展示**：详细项目条目与 GitHub 公开仓库合并为统一卡片列表
- **站内搜索**：已发布文章通过 D1 即时检索，项目由 [Pagefind](https://pagefind.app) 提供构建期索引；支持语言与内容类型筛选
- **RSS 与 sitemap**：`/rss.xml` 即时读取中文已发布文章；`/sitemap-index.xml` 合并静态页面与 D1 动态文章/标签 URL
- **深浅主题**：初次访问跟随系统偏好，选择保存在 `localStorage`
- **响应式与无障碍**：移动菜单、跳过导航、键盘焦点、动态状态播报和减少动画偏好

## 本地开发

需要 Node.js 22.12.0 或更高版本。首次启动前安装依赖、建立本地 D1 并导入示例文章：

```sh
npm install
npm run db:migrate
npm run content:import
```

在已被 Git 忽略的 `.dev.vars` 中设置 `INITIAL_SETUP_KEY` 和 `SESSION_SECRET`。请用密码管理器或密码学安全的生成器分别创建两个高熵随机值，只把真实值保存在 `.dev.vars` 和密码管理器中，不要写入源码或提交到 Git。

```dotenv
INITIAL_SETUP_KEY=<本地初始化密钥>
SESSION_SECRET=<独立的本地会话密钥>
```

按照项目约定，以后台模式运行 Astro 开发服务器：

```sh
npx astro dev --background # 默认 http://localhost:4321
npx astro dev status       # 查看后台服务器状态
npx astro dev logs         # 查看开发日志
npx astro dev stop         # 停止后台服务器
```

打开 `http://localhost:4321/admin/setup/` 创建本地所有者账号，然后从 `/admin/login/` 登录。

构建命令先由 Astro 生成 `dist/` 中间产物，再组装 Pages Advanced Mode 工件并为项目等静态页面建立 Pagefind 索引。D1 文章在请求时搜索，不写入构建期索引。可部署目录是 `dist-pages/`，不是 `dist/`：

```sh
npm run build
npx wrangler pages dev dist-pages
```

## 修改关于页

关于页的自我介绍在 **`src/content/about.md`**，直接用 Markdown 编辑（在 GitHub 网页上也能改）。这类源码内容仍需提交并重新部署才会上线。

页面下方的结构化信息（邮箱、GitHub、坐标等）在 `src/consts.ts` 的 `SITE` 中修改。

## 双语（中/EN）

站点是完整双语结构：中文为默认语言（无前缀），英文挂在 `/en/` 前缀下（如 `/en/posts/…`）。

- 界面文案字典：`src/i18n/ui.ts`（新增文案时在此补 `zh` / `en` 两个 key）
- 导航栏有「中 / EN」按钮互切；访问根路径始终进入中文站，不按浏览器语言跳转
- 后台文章的语言字段支持 `zh`（默认）或 `en`；两个语言的列表、标签和搜索结果彼此独立
- 互译文章使用相同的 `translationKey`。只有译文真实存在时，详情页才显示语言入口并输出对应 `hreflang`
- 没有英文文章时，英文列表显示空状态和中文站入口，不把中文原文标记为英文内容
- 关于页英文版：`src/content/about-en.md`

## 写文章

生产环境请从 `/admin/login/` 登录后台，在 `/admin/posts/new/` 新建文章，或从 `/admin/` 打开已有文章。编辑器支持标题、URL 标识、摘要、发布日期、标签、语言、封面地址、精选状态和草稿/发布状态；桌面端左右分栏实时预览，移动端可切换编辑与预览，停止输入后会自动保存草稿。

草稿不会出现在公开页面。发布后，首页、文章列表、文章详情、标签页和 RSS 会立即读取到新内容，不需要 GitHub、本地电脑或手动部署。

`src/content/posts/` 中的 Markdown 仅用于首次导入和源码备份，**生产环境的权威内容源是 D1**。直接修改这些文件不会自动更新线上文章。`npm run content:import:remote` 会按文件名生成 slug，并覆盖 D1 中同 slug 文章的导入字段、递增其并发版本，因此只应在首次初始化或有意恢复备份时执行；已打开同一文章的编辑器会在下次保存时提示版本冲突，不会静默覆盖导入内容。

导入脚本识别的 Markdown 格式如下：

```md
---
title: 文章标题
description: 一句话摘要（列表和 SEO 用）
pubDate: 2026-09-01
updatedDate: 2026-09-08
tags: ['标签1', '标签2']
draft: false
lang: zh
featured: false
series: Astro 实践
translationKey: astro-practice-01
cover: https://example.com/example-cover.webp
coverAlt: 封面内容说明
---

正文从这里开始，使用标准 Markdown 语法。
```

`updatedDate`、`series`、`translationKey`、`cover` 和 `coverAlt` 可以省略；`draft: true` 会导入为草稿，`lang` 只能是 `zh` 或 `en`。D1 无法保留 Astro 对源码相对图片的构建转换，因此 `cover` 必须是可公开访问的绝对 HTTP/HTTPS URL；导入器会明确拒绝 `../../assets/...` 一类相对地址。导入器使用标准 YAML frontmatter，支持普通 YAML 数组、引号和注释，并复用后台 API 的字段长度与格式校验。

## 项目展示

`/projects/` 会把本地维护的详细项目条目与 GitHub 公开仓库（不含 fork）按仓库地址合并去重，统一按最近 push 日期排序并显示为项目卡片。首页会选取代表项目。构建时会尝试从 GitHub API 更新仓库数据。

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

## Cloudflare 部署

当前部署方式是 GitHub Actions 构建后直接上传到 Cloudflare Pages。不要在 Cloudflare Dashboard 为同一个 Pages 项目另外启用 Git 集成，否则会形成两套部署来源。

### 1. 创建 D1 数据库

先登录 Wrangler 并创建生产数据库：

```sh
npx wrangler login
npx wrangler d1 create ember-db
```

创建命令会返回真实的数据库 UUID。把它写入 `wrangler.toml` 的 `database_id`，替换仓库中的 `00000000-0000-0000-0000-000000000000` 占位值。不要继续使用占位 UUID，否则 Pages 无法绑定生产数据库。

### 2. 创建 Pages 项目

如果 `ember-space` 尚不存在，创建一个 Direct Upload Pages 项目：

```sh
npx wrangler pages project create ember-space --production-branch main
```

也可以在 Cloudflare Dashboard 创建 Direct Upload 项目，但项目名必须与 `wrangler.toml` 和工作流中的 `ember-space` 一致，并确认 Production branch 是 `main`。否则工作流固定上传的 `--branch=main` 会成为预览部署，生产域名不会更新。

### 3. 配置生产 Secrets

为 Pages 项目设置两个独立的高熵随机值。以下命令会安全地交互提示输入；只在提示出现后输入真实值，不要把 secret 值作为命令参数、写进 `wrangler.toml` 或源码，也不要提交到 Git：

```sh
npx wrangler pages secret put INITIAL_SETUP_KEY --project-name=ember-space
npx wrangler pages secret put SESSION_SECRET --project-name=ember-space
```

- `INITIAL_SETUP_KEY`：仅用于第一次创建 owner，初始化后不再需要
- `SESSION_SECRET`：用于登录限流等认证安全处理，应长期保密且不要在不同站点间复用

### 4. 执行 migrations 和初始导入

本地 D1：

```sh
npm run db:migrate
npm run content:import
```

生产 D1：

```sh
npm run db:migrate:remote
npm run content:import:remote
```

必须先执行 migration，再导入文章。远端内容导入不是日常部署步骤，也没有放进 GitHub Actions；首次迁移现有文章时执行一次即可。之后应在后台写作，除非确实要用源码备份覆盖同 slug 的 D1 内容。

### 5. 配置 GitHub Actions

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 添加：

- `CLOUDFLARE_API_TOKEN`：创建一个限制到目标 Cloudflare 账号的 API Token，至少授予 **Cloudflare Pages: Edit** 和 **D1: Edit**，以便工作流迁移数据库并部署 Pages
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Dashboard 中显示的账号 ID

只在 GitHub 的 Secret 输入框中填写真实值，不要把 token 放进工作流 YAML、命令行或仓库文件。推送到 `main` 会自动应用尚未执行的远端 migration、构建并部署；工作流也支持手动触发，并在每天北京时间 10:30 运行以刷新 GitHub 仓库数据。

### 6. 构建与部署

GitHub Actions 会自动执行部署。手动部署时使用：

```sh
npm run db:migrate:remote
npm run build
npx wrangler pages deploy dist-pages --project-name=ember-space --branch=main
```

`npm run build` 会把 Pages Advanced Mode 的 `_worker.js`、服务端代码、客户端资源和 Pagefind 索引组装到 `dist-pages/`。部署时必须上传 `dist-pages/`，不要上传 Astro 的 `dist/` 中间目录。

线上地址：https://ember-space.pages.dev

### 7. 首次初始化

首次成功部署后：

1. 打开 `https://ember-space.pages.dev/admin/setup/`
2. 输入生产 `INITIAL_SETUP_KEY`，设置 owner 账号和密码
3. 初始化成功后打开 `/admin/login/` 登录
4. 从 Pages 项目中删除已用过的初始化 secret：

```sh
npx wrangler pages secret delete INITIAL_SETUP_KEY --project-name=ember-space
```

D1 中的 `setup_completed` 标记会让初始化只能成功一次；删除 secret 可以进一步缩小暴露面。保留并妥善管理 `SESSION_SECRET`。

### 部署后验证

- `/admin/login/` 可以登录 owner，错误密码会被拒绝且不会泄露账号状态
- owner 可以在 `/admin/members/` 生成邀请；邀请可使用一次，重复使用或过期后会被拒绝
- 新建并保存草稿后，公开首页、列表和文章 URL 都看不到草稿
- 发布文章后，首页、对应语言的文章列表、文章详情、标签页和 `/rss.xml` 立即更新
- editor 只能编辑和发布自己的文章；owner 可以撤回、删除全部文章并暂停、恢复或删除 editor
- 退出登录后后台写操作失效，未登录访问后台会跳转到登录页
- D1 暂时不可用时，公开页面显示不含内部细节的错误页，后台显示明确的连接或保存错误

部署前也建议在本地执行：

```sh
npm test
npx tsc --noEmit --pretty false
npx wrangler types src/worker-configuration.d.ts --include-runtime=false --check
npx astro check
npm run db:migrate
npm run content:import
npm run build
npm run test:pages
```

`npm run test:pages` 会在操作系统临时目录中创建隔离的 Wrangler 配置、secrets 和 D1 状态，自行启动并停止 Pages。它检查初始化、登录、邀请、权限、草稿、发布、撤回、删除、RSS 以及私有构建路径，并在结束时删除全部测试数据和临时目录。

当前应用在 D1 中按来源 IP 的不可逆摘要限制登录尝试，并使用 Cloudflare Workers 支持上限内的 100,000 次 PBKDF2-SHA-256。面向公网后，建议在 Cloudflare 边缘再叠加 Rate Limiting，并根据攻击面启用 Turnstile 或 MFA。若平台后续允许提高 PBKDF2 成本，应保留摘要中的迭代次数并在用户成功登录时逐步重哈希，避免让已有账号失效。

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
├── migrations/                    # D1 schema migrations
├── scripts/
│   ├── build-pages.mjs            # 组装 dist-pages Pages SSR 工件
│   ├── clean-pages.mjs            # 构建前移除过期的 Pages SSR 工件
│   ├── import-content.mjs         # 将现有 Markdown 导入本地或远端 D1
│   └── smoke-pages.mjs            # 隔离验证 Pages、D1、认证与发布流程
├── src/
│   ├── consts.ts                  # 站点配置（标题、社交、giscus）
│   ├── content.config.ts          # 源码内容集合 schema
│   ├── content/posts/             # 文章初始导入与备份（非生产权威源）
│   ├── content/projects/          # 项目展示（Markdown）
│   ├── components/                # 公开站点与后台组件
│   ├── layouts/                   # 全局布局、SEO 与后台布局
│   ├── lib/                       # D1、认证、权限与文章服务
│   ├── pages/admin/               # 登录、初始化、编辑器与成员管理页面
│   ├── pages/api/                 # 认证、文章、邀请和成员 API
│   ├── pages/                     # 公开首页、文章、项目、标签、搜索与 RSS
│   └── styles/global.css          # 主题变量与全局样式
├── astro.config.mjs               # Astro Cloudflare SSR 配置
└── wrangler.toml                  # Pages、D1 绑定与运行时配置
```
