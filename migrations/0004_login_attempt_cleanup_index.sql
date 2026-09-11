CREATE INDEX IF NOT EXISTS idx_login_attempts_time
  ON login_attempts(attempted_at);
