# 后台创作体验升级 · 设计文档

日期：2026-09-14
状态：已确认，实施中

## 背景与目标

后台编辑器目前只有纯 Markdown 输入。本次升级覆盖四个需求：

1. 文章中插入图片（上传而非外链）
2. 编辑器工具栏（标题/粗体/斜体等一键插入）
3. 成员个人资料（头像、简介）
4. GitHub OAuth 登录（限已绑定成员）

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 图片存储 | Cloudflare R2（bucket：`ember-images`，binding：`IMAGES`） |
| 图片访问 | 同站路由 `/images/*`，worker 读取 R2 + immutable 缓存 |
| 上传交互 | 粘贴 + 拖拽 + 工具栏按钮，三通道统一上传逻辑 |
| 图片管理 | 仅上传，不做管理界面；key 按 `YYYY/MM/{uuid}.{ext}` 组织 |
| 资料字段 | 头像（前端裁剪 256×256 WebP）、bio、显示名；不含改邮箱/密码 |
| GitHub 登录 | "先绑定后登录"：设置页绑定 → 登录页可用；未绑定的 GitHub 账号拒绝 |
| 评论 | 维持 giscus 自治，与站点认证无关，不改动 |
| 域名 | 用户咨询过 .com 迁移，本次不做 |

## 功能设计

### 1. R2 图片基础设施

- `wrangler.toml`：新增 `[[r2_buckets]]`，binding `IMAGES`，bucket `ember-images`
- `src/lib/images.ts`（纯函数，可单测）：
  - `sniffImageType(bytes)`：magic bytes 白名单校验（PNG/JPEG/GIF/WebP/AVIF），不信客户端 Content-Type
  - `newImageKey(ext)`：生成 `YYYY/MM/{uuid}.{ext}`，客户端不可指定路径
  - 常量：`MAX_IMAGE_BYTES = 5MB`
- `POST /api/images`：需 `authorizeWrite`（owner/editor）+ CSRF；multipart 表单；校验类型与大小；写 R2；返回 `{ url, key }`
- `GET /images/[...key]`：公开只读；校验 key 格式防路径穿越；`cache-control: public, max-age=31536000, immutable`；R2 未命中返回 404

### 2. 编辑器工具栏（AdminEditor.astro）

- 工具栏按钮：H2、H3、粗体、斜体、引用、链接、行内代码、代码块、无序列表、分割线、图片
- 行为：有选中文本则包裹语法，无选中插入模板；光标位置智能落位
- 快捷键：Ctrl+B 粗体、Ctrl+I 斜体、Ctrl+K 链接
- 图片通道统一：粘贴（clipboardData.files）、拖拽（drop）、按钮（input[type=file]）都走同一 `uploadImage(file)`
- 上传中在光标处插 `![上传中…]()` 占位符，成功替换为真实 URL，失败移除并提示
- 不干扰现有自动保存与分栏预览

### 3. 个人资料页（/admin/settings/）

- 字段：头像、显示名、bio
- 头像：前端 Canvas 裁剪方形 + 压缩为 256×256 WebP → 走独立 `POST /api/avatar`（复用 lib/images 校验，key 前缀 `avatars/{userId}/`）→ 更新 users.avatar_url
- 头像即时在后台顶栏生效

### 4. GitHub 登录

- 新列：`users.github_id`（唯一索引，NULL 不参与冲突）
- 设置页「绑定 GitHub」：OAuth 授权 → callback 把 github_id 写入当前用户
- 登录页「使用 GitHub 登录」：callback 按 github_id 查 users，查到发 session（复用现有 session 逻辑），查不到拒绝并提示
- OAuth state 防 CSRF；secrets：`GITHUB_CLIENT_ID`（vars 可放）、`GITHUB_CLIENT_SECRET`（secret）
- 邮箱+密码登录保留不变

### 5. 前台作者卡

- 文章页（DbPostPage）底部：join users 取 `display_name / avatar_url / bio`，渲染作者卡
- 公开查询绝不暴露 email、github_id
- 中英双语文案补 `src/i18n/ui.ts`

## 数据库迁移（零风险）

新增两个 migration，只 `ALTER TABLE ADD COLUMN`，不动现有数据：

```sql
-- 0006_user_profile.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';

-- 0007_user_github.sql
ALTER TABLE users ADD COLUMN github_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github ON users(github_id);
```

先在本地 D1 验证，用户确认后执行 `npm run db:migrate:remote`。

## 安全设计

- 上传仅 owner/editor，复用 `authorizeWrite` + CSRF
- 服务端强制类型白名单 + 5MB 上限
- key 服务端生成，防路径穿越与覆盖
- `/images/*` 只读 GET，key 格式校验
- GitHub OAuth 不创建新用户，仅匹配已绑定成员
- 管理员/文章的现有数据与权限行为不变

## 测试

- vitest：magic bytes 校验、key 生成、大小边界、GitHub 绑定匹配逻辑
- smoke-pages.mjs 增补：登录 → 上传图片 → 文章引用可公开访问；GitHub 未绑定账号被拒

## 用户手动步骤（实施时提醒）

1. `npx wrangler r2 bucket create ember-images`
2. GitHub → Developer settings → New OAuth App，callback：`https://ember-space.pages.dev/api/auth/github/callback`
3. `npx wrangler pages secret put GITHUB_CLIENT_SECRET --project-name=ember-space`
4. 确认本地验证后：`npm run db:migrate:remote`

## 不做的事（YAGNI）

- 图片管理界面（列表/删除/引用检查）
- 改邮箱、改密码入口
- 访客身份系统
- 自定义域名迁移
