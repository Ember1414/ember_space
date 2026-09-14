-- 开放 GitHub 登录：新增 reader 角色（仅评论身份，无后台权限）；reader 无密码，密码字段改为可空。
-- SQLite 无法修改 CHECK / NULL 约束，需重建 users 表。
-- 注意：D1 不允许关闭外键检查（PRAGMA foreign_keys = OFF 无效），且 DROP/清空 users 会触发子表的
-- ON DELETE 动作：posts.author_id 和 invites.used_by 会被 SET NULL、sessions 会被 CASCADE 删除、
-- invites.created_by 的 RESTRICT 会直接让操作失败。因此先备份受影响的子表数据，重建后再恢复，零数据丢失。
PRAGMA defer_foreign_keys = ON;

-- 幂等保护：上次失败留下的备份表不阻断重试（D1 单迁移事务回滚，正常不会有残留）
DROP TABLE IF EXISTS migration_backup_posts;
DROP TABLE IF EXISTS migration_backup_invites;
DROP TABLE IF EXISTS migration_backup_sessions;

-- 1. 备份会被 ON DELETE 动作波及的子表数据
CREATE TABLE migration_backup_posts AS SELECT id, author_id FROM posts WHERE author_id IS NOT NULL;
CREATE TABLE migration_backup_invites AS SELECT * FROM invites;
CREATE TABLE migration_backup_sessions AS SELECT * FROM sessions;

-- 2. 新结构就位并拷贝用户数据
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'reader')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  github_id INTEGER
);

INSERT INTO users_new (id, email, display_name, password_hash, password_salt, role, active, created_at, updated_at, avatar_url, bio, github_id)
  SELECT id, email, display_name, password_hash, password_salt, role, active, created_at, updated_at, avatar_url, bio, github_id FROM users;

-- 3. 清空阻断重建的子表（已备份），再清空旧用户表（posts.author_id 在此被 SET NULL，已备份）
DELETE FROM invites;
DELETE FROM sessions;
DELETE FROM users;

-- 4. 替换表（空表 DROP 不触发行级动作；子表 FK 文本按表名解析，rename 后自动指向新表）
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- 5. 恢复子表数据与引用（此时新 users 已就位，外键校验可通过）
INSERT INTO invites SELECT * FROM migration_backup_invites;
INSERT INTO sessions SELECT * FROM migration_backup_sessions;
UPDATE posts SET author_id = (
  SELECT author_id FROM migration_backup_posts WHERE migration_backup_posts.id = posts.id
) WHERE id IN (SELECT id FROM migration_backup_posts);

DROP TABLE migration_backup_posts;
DROP TABLE migration_backup_invites;
DROP TABLE migration_backup_sessions;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github ON users(github_id);
