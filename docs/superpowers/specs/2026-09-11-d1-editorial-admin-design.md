# Ember D1 内容后台设计

日期：2026-09-11

## 1. 目标

将 Ember 的文章内容源从构建期 Markdown 迁移到 Cloudflare D1，并在现有视觉体系内提供可直接在线使用的写作后台。文章发布后由 Cloudflare Pages Functions SSR 立即读取，无需提交 Git、打开本地电脑或重新部署。

项目与关于页继续使用 Astro 内容集合。`src/content/posts` 仅用于首次导入、开发回退和人工备份，不再是生产环境文章的权威来源。

## 2. 运行架构

- Astro 使用 `output: server` 和 `@astrojs/cloudflare` 构建 SSR Worker。
- 构建前先移除旧 `dist-pages`，再由 `scripts/build-pages.mjs` 将 Astro 客户端资源与服务端入口组装为 Cloudflare Pages 高级模式工件 `dist-pages/_worker.js`；失败构建不能留下可被误测或误部署的旧工件。
- Pages Functions 通过 `cloudflare:workers` 的 `env.DB` 访问 D1。
- 首页、文章列表、文章详情、标签和 RSS 在请求时查询 `status = 'published'` 的文章。
- 文章搜索通过只查询 `status = 'published'` 的 D1 API 即时返回；项目搜索保持 Pagefind 构建期索引，两类结果由搜索页合并。
- 项目详情保持构建期预渲染，维持现有内容集合和 Pagefind 项目索引。
- Astro sitemap 负责静态页面；`/sitemap-posts.xml` 在请求时生成 D1 文章与标签 URL，并由 sitemap index 引用。
- 生产环境绑定 D1 时，数据库是唯一文章来源。数据库查询失败返回不包含内部错误的 503/明确错误状态；没有 D1 绑定的开发环境才允许回退到源码 Markdown。

## 3. 数据模型

`users` 保存 owner/editor、PBKDF2 摘要、盐和启用状态。`sessions` 只保存随机会话令牌的 SHA-256 摘要、CSRF 令牌和有效期。`invites` 保存一次性邀请令牌摘要、可选目标邮箱、有效期与使用记录。`posts` 保存 Markdown 正文、元数据、作者、draft/published/archived 状态和单调递增的乐观并发版本。`login_attempts` 保存经应用密钥散列的 IP 标识与登录限流窗口。`settings` 保存一次性初始化完成标记。

所有关联使用外键；公开查询按状态、语言和发布日期建立联合索引。标签以 JSON 数组保存，并在输入层限制数量与长度。

## 4. 认证与权限

- 密码使用 Web Crypto PBKDF2-SHA-256、每个账号独立随机盐和 Cloudflare Workers 当前支持上限内的 100,000 次迭代。
- 会话令牌和邀请令牌由 `crypto.getRandomValues()` 生成，D1 中只存 SHA-256 摘要；密钥与 CSRF 值先散列为固定长度，再用运行时恒定时间比较。
- 会话 Cookie 使用 `HttpOnly`、`SameSite=Lax`、生产 HTTPS 下 `Secure`，默认七天过期。
- 后台写请求必须同时通过有效会话、同源 `Origin`/`Referer` 和 `X-CSRF-Token` 校验。
- owner 可以编辑、发布、撤回和删除所有文章，并管理邀请与 editor。
- editor 可以创建文章，只能编辑和发布自己拥有且未被 owner 撤回的文章，不能删除文章或管理成员。
- 账号统一经过 NFKC、去除首尾空白和小写化后保存与登录，避免注册和登录规范化不一致。
- 暂停或恢复 editor 时在同一 D1 batch 中删除其全部旧会话；删除 editor 时文章保留且作者置空。

## 5. 初始化和邀请

`POST /api/auth/setup` 只在 D1 尚无 owner 且没有 `setup_completed` 标记时成功，并要求 Cloudflare Secret `INITIAL_SETUP_KEY`。首次成功写入 owner 和完成标记；后续请求即使仍存在环境变量也不能再次创建 owner。

owner 可生成 1 小时至 30 天有效的一次性 editor 邀请。邀请页收集显示名称、邮箱和密码；接受操作以 D1 原子 batch 同时创建用户并消费邀请，重复、过期或邮箱不匹配均拒绝。

## 6. 后台体验

- `/admin/login/`：账号密码登录和明确的限流/服务错误。
- `/admin/`：文章统计、状态筛选、数据库/会话状态和编辑入口。
- `/admin/posts/new/`、`/admin/posts/:id/`：Markdown 双栏编辑与实时预览；移动端用“编辑/预览”标签切换。
- 编辑器支持标题、slug、摘要、标签、语言、封面、精选、发布日期和状态。
- 停止输入后自动保存草稿；显式发布前切到最终预览，成功后公开查询即时可见。
- 编辑已有文章时先锁定表单直到数据加载完成；保存请求携带已加载的版本号，版本冲突返回 409、保留当前输入并停止自动重试，等待作者刷新后人工合并。
- `/admin/members/`：仅 owner 可列出、暂停、恢复或删除 editor，并生成邀请链接。

## 7. API

- `POST /api/auth/setup`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- `GET|POST /api/posts`、`GET|PATCH|DELETE /api/posts/:id`
- `GET|POST /api/invites`、`POST /api/invites/:token/accept`
- `GET /api/members`、`PATCH|DELETE /api/members/:id`
- `GET /api/search/posts`

文章 PATCH 必须携带 `expectedVersion`，成功后返回递增后的 `version`；过期版本返回 409。API 始终返回 JSON、`Cache-Control: no-store` 和面向用户的错误信息，不回传 SQL、堆栈、令牌摘要或 Cloudflare 内部信息。

## 8. 迁移与部署

迁移位于 `migrations/`。`npm run db:migrate` 和 `npm run content:import` 用于本地验证；带 `:remote` 的对应命令用于生产。导入脚本按原文件名写入 slug，并使用 upsert，重复运行不会创建重复文章；覆盖已有 slug 时同步递增文章版本，使已打开的后台编辑器能够检测冲突。导入与后台 API 复用同一字段校验；封面必须是可公开访问的绝对 HTTP/HTTPS URL，无法在 D1 中保留 Astro 的源码相对图片转换。

GitHub Actions 顺序为安装依赖、运行单元测试和类型检查、构建 `dist-pages`、应用远端 D1 migration、部署 Pages。先验证并完成构建再修改生产数据库，避免明显无效的提交先触发 migration。仓库 Secrets 需要 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`；Pages 项目 Secrets 需要 `INITIAL_SETUP_KEY` 和 `SESSION_SECRET`。

## 9. 验证

单元测试覆盖密码哈希/校验、会话过期、邀请状态、角色权限、文章输入、Markdown 渲染、搜索和 sitemap。集成验证使用隔离 D1 状态，覆盖本地 migration、Pages SSR 工件启动、初始化、登录、邀请一次性消费、editor 权限、草稿不可见、发布后首页/列表/详情/标签/RSS/sitemap 即时可见、owner 撤回与删除、成员暂停后的旧会话失效，以及服务端私有构建路径不可访问。最后运行绑定类型检查、TypeScript、Astro 检查和生产构建。
