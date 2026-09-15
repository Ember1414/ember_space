-- 站点级内容（关于页等）：key 形如 about:zh / about:en，value 为 JSON。
-- 所有者可在后台编辑，公开页请求时读取；未写入时回退到源码默认值。
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
