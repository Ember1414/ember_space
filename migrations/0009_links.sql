-- 网址收藏栏：站长/编辑在后台维护的网址清单，前台 /links/ 展示。
-- category: mine（我的作品）/ favorite（宝藏网站）/ resource（资料）。
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'favorite' CHECK (category IN ('mine', 'favorite', 'resource')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_links_category ON links(category, created_at DESC);
