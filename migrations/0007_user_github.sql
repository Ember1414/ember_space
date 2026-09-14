-- GitHub OAuth 绑定：github_id 可空，唯一索引约束绑定关系一对一。
ALTER TABLE users ADD COLUMN github_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github ON users(github_id);
