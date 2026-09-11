import type { D1DatabaseLike, Role, UserRecord } from '../db';
import { randomToken, sha256 } from './crypto';

export const SESSION_COOKIE_NAME = 'ember_session';
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface SessionRow {
  sessionId: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  email: string;
  displayName: string;
  role: Role;
  active: number;
}

export interface AuthSession {
  id: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  user: UserRecord;
}

export function isSessionExpired(expiresAt: string, now = new Date()): boolean {
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

export async function createSession(
  db: D1DatabaseLike,
  userId: string,
  now = new Date(),
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
): Promise<{ token: string; session: AuthSession }> {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const csrfToken = randomToken();
  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  await db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, userId, tokenHash, csrfToken, expiresAt, createdAt, createdAt).run();

  const session = await readSession(db, token, now);
  if (!session) throw new Error('Created session could not be read.');
  return { token, session };
}

export async function readSession(db: D1DatabaseLike, token: string | undefined, now = new Date()): Promise<AuthSession | null> {
  if (!token || token.length > 256) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare(
    `SELECT s.id as sessionId, s.user_id as userId, s.token_hash as tokenHash,
      s.csrf_token as csrfToken, s.expires_at as expiresAt,
      u.email, u.display_name as displayName, u.role, u.active
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? LIMIT 1`,
  ).bind(tokenHash).first<SessionRow>();

  if (!row) return null;
  if (!row.active || isSessionExpired(row.expiresAt, now)) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(row.sessionId).run();
    return null;
  }

  return {
    id: row.sessionId,
    tokenHash: row.tokenHash,
    csrfToken: row.csrfToken,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      active: Boolean(row.active),
    },
  };
}

export async function revokeSession(db: D1DatabaseLike, token: string | undefined): Promise<void> {
  if (!token || token.length > 256) return;
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}
