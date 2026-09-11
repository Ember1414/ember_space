import type { D1DatabaseLike, PostStatus, Role } from './db';
import type { PostInput } from './posts/input';

export interface ManagedPostRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  pubDate: string;
  updatedDate: string | null;
  tags: string;
  lang: 'zh' | 'en';
  cover: string | null;
  coverAlt: string | null;
  featured: number;
  series: string | null;
  translationKey: string | null;
  status: PostStatus;
  version: number;
  authorId: string | null;
  authorName: string | null;
  authorRole: Role | null;
  createdAt: string;
  updatedAt: string;
}

export type ManagedPostSummaryRow = Omit<ManagedPostRow, 'body'>;

export const MANAGED_POST_COLUMNS = `p.id, p.slug, p.title, p.description, p.body,
  p.pub_date AS pubDate, p.updated_date AS updatedDate, p.tags, p.lang,
  p.cover, p.cover_alt AS coverAlt, p.featured, p.series,
  p.translation_key AS translationKey, p.status, p.version, p.author_id AS authorId,
  u.display_name AS authorName, u.role AS authorRole,
  p.created_at AS createdAt, p.updated_at AS updatedAt`;

export const MANAGED_POST_SUMMARY_COLUMNS = `p.id, p.slug, p.title, p.description,
  p.pub_date AS pubDate, p.updated_date AS updatedDate, p.tags, p.lang,
  p.cover, p.cover_alt AS coverAlt, p.featured, p.series,
  p.translation_key AS translationKey, p.status, p.version, p.author_id AS authorId,
  u.display_name AS authorName, u.role AS authorRole,
  p.created_at AS createdAt, p.updated_at AS updatedAt`;

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function serializeShared(row: ManagedPostRow | ManagedPostSummaryRow) {
  return {
    ...row,
    version: Number(row.version),
    tags: parseTags(row.tags),
    featured: Boolean(row.featured),
    author: row.authorId ? { id: row.authorId, displayName: row.authorName, role: row.authorRole } : null,
  };
}

export function serializeManagedPost(row: ManagedPostRow) {
  return {
    ...serializeShared(row),
    content: row.body,
  };
}

export function serializeManagedPostSummary(row: ManagedPostSummaryRow) {
  return serializeShared(row);
}

export interface ManagedPostUpdateOptions {
  id: string;
  expectedVersion: number;
  now: string;
  userId: string;
  owner: boolean;
}

export async function updateManagedPost(
  db: D1DatabaseLike,
  post: PostInput,
  options: ManagedPostUpdateOptions,
): Promise<boolean> {
  const updated = await db.prepare(
    `UPDATE posts SET slug = ?, title = ?, description = ?, body = ?, pub_date = ?, updated_date = ?,
      tags = ?, lang = ?, cover = ?, cover_alt = ?, featured = ?, series = ?, translation_key = ?,
      status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?${options.owner ? '' : `
        AND author_id = ? AND status <> 'archived'
        AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'editor' AND active = 1)`}`,
  ).bind(
    post.slug, post.title, post.description, post.body, post.pubDate, options.now, JSON.stringify(post.tags),
    post.lang, post.cover, post.coverAlt, post.featured ? 1 : 0, post.series, post.translationKey,
    post.status, options.now, options.id, options.expectedVersion,
    ...(options.owner ? [] : [options.userId, options.userId]),
  ).run();
  return Number(updated.meta.changes ?? 0) === 1;
}
