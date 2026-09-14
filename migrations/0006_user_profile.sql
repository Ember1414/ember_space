-- 成员个人资料：头像与个人简介。纯加列，不影响现有数据。
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
