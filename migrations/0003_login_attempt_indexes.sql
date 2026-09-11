DROP INDEX IF EXISTS idx_login_attempts_lookup;

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
  ON login_attempts(ip_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts(email, attempted_at);
