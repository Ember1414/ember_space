import type { D1DatabaseLike, Role, UserRecord } from './db';

export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 160;

export interface ProfileRecord extends UserRecord {
  avatarUrl: string | null;
  bio: string;
  githubBound: boolean;
}

interface ProfileRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: number;
  avatarUrl: string | null;
  bio: string | null;
  githubId: number | null;
}

function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    active: Boolean(row.active),
    avatarUrl: row.avatarUrl ?? null,
    bio: row.bio ?? '',
    githubBound: row.githubId !== null,
  };
}

/** 资料字段在 0006/0007 migration 中加入；与 session 查询解耦，避免迁移窗口影响登录主流程。 */
export async function getProfile(db: D1DatabaseLike, userId: string): Promise<ProfileRecord | null> {
  const row = await db.prepare(
    `SELECT id, email, display_name AS displayName, role, active,
       avatar_url AS avatarUrl, bio, github_id AS githubId
     FROM users WHERE id = ? LIMIT 1`,
  ).bind(userId).first<ProfileRow>();
  return row ? mapProfile(row) : null;
}

export function validateDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > DISPLAY_NAME_MAX) return null;
  return name;
}

export function validateBio(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const bio = value.trim();
  if (bio.length > BIO_MAX) return null;
  return bio;
}

export async function updateProfile(
  db: D1DatabaseLike,
  userId: string,
  fields: { displayName?: string; bio?: string },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.displayName !== undefined) { sets.push('display_name = ?'); params.push(fields.displayName); }
  if (fields.bio !== undefined) { sets.push('bio = ?'); params.push(fields.bio); }
  if (!sets.length) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString(), userId);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
}

export async function setAvatarUrl(db: D1DatabaseLike, userId: string, avatarUrl: string): Promise<void> {
  await db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?')
    .bind(avatarUrl, new Date().toISOString(), userId)
    .run();
}
