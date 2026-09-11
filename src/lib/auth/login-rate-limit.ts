import type { D1DatabaseLike } from '../db';

export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

interface LoginAttemptReservation {
  ipHash: string;
  email: string;
  attemptedAt: string;
  windowStart: string;
  cleanupBefore: string;
  maximum?: number;
}

export async function failedLoginCount(
  db: D1DatabaseLike,
  ipHash: string,
  windowStart: string,
): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) AS count FROM login_attempts
     WHERE successful = 0 AND attempted_at >= ? AND ip_hash = ?`,
  ).bind(windowStart, ipHash).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

/** Reserves one of the bounded PBKDF2 slots before doing password work. */
export async function reserveLoginAttempt(
  db: D1DatabaseLike,
  attempt: LoginAttemptReservation,
): Promise<number | null> {
  const maximum = attempt.maximum ?? MAX_FAILED_LOGIN_ATTEMPTS;
  const [reserved] = await db.batch([
    db.prepare(
      `INSERT INTO login_attempts (ip_hash, email, attempted_at, successful)
       SELECT ?, ?, ?, 0
       WHERE (
         SELECT COUNT(*) FROM login_attempts
         WHERE successful = 0 AND attempted_at >= ? AND ip_hash = ?
       ) < ?
       RETURNING id`,
    ).bind(
      attempt.ipHash,
      attempt.email,
      attempt.attemptedAt,
      attempt.windowStart,
      attempt.ipHash,
      maximum,
    ),
    db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(attempt.cleanupBefore),
  ]);
  const row = reserved.results[0] as { id?: unknown } | undefined;
  const id = Number(row?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function completeSuccessfulLogin(
  db: D1DatabaseLike,
  input: { attemptId: number; attemptedAt: string },
): Promise<void> {
  await db.batch([
    db.prepare('UPDATE login_attempts SET successful = 1 WHERE id = ?').bind(input.attemptId),
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(input.attemptedAt),
  ]);
}
