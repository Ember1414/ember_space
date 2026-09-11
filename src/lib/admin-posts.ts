import type { PostStatus, Role } from './db';

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
  authorId: string | null;
  authorName: string | null;
  authorRole: Role | null;
  createdAt: string;
  updatedAt: string;
}

export const MANAGED_POST_COLUMNS = `p.id, p.slug, p.title, p.description, p.body,
  p.pub_date AS pubDate, p.updated_date AS updatedDate, p.tags, p.lang,
  p.cover, p.cover_alt AS coverAlt, p.featured, p.series,
  p.translation_key AS translationKey, p.status, p.author_id AS authorId,
  u.display_name AS authorName, u.role AS authorRole,
  p.created_at AS createdAt, p.updated_at AS updatedAt`;

export function serializeManagedPost(row: ManagedPostRow) {
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.tags || '[]');
    if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    tags = [];
  }
  return {
    ...row,
    content: row.body,
    tags,
    featured: Boolean(row.featured),
    author: row.authorId ? { id: row.authorId, displayName: row.authorName, role: row.authorRole } : null,
  };
}

