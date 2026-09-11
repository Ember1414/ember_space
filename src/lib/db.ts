import { env as cloudflareEnv } from 'cloudflare:workers';
import { renderMarkdownDocument, type MarkdownHeading } from './posts/render';

export interface D1ResultLike<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes?: number; [key: string]: unknown };
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]>;
}

export type Role = 'owner' | 'editor';
export type PostStatus = 'draft' | 'published' | 'archived';

export interface RuntimeEnv {
  DB?: D1DatabaseLike;
  ENVIRONMENT?: string;
  CF_PAGES?: string;
  INITIAL_SETUP_KEY?: string;
  SESSION_SECRET?: string;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  bodyLength: number;
  pubDate: string;
  updatedDate: string | null;
  tags: string[];
  lang: 'zh' | 'en';
  cover: string | null;
  coverAlt: string | null;
  featured: boolean;
  series: string | null;
  translationKey: string | null;
  status: PostStatus;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostRecord extends PostSummary {
  body: string;
  bodyHtml: string;
  headings: MarkdownHeading[];
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
}

type PostSummaryRow = Omit<PostSummary, 'tags' | 'featured'> & {
  tags: string | null;
  featured: number;
};

type PostRow = PostSummaryRow & { body: string };

const asDate = (value: unknown) => (value ? String(value) : new Date().toISOString());

function mapPostSummary(row: PostSummaryRow): PostSummary {
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    featured: Boolean(row.featured),
    bodyLength: Number(row.bodyLength ?? 0),
    pubDate: asDate(row.pubDate),
    updatedDate: row.updatedDate ? String(row.updatedDate) : null,
    cover: row.cover ? String(row.cover) : null,
    coverAlt: row.coverAlt ? String(row.coverAlt) : null,
    translationKey: row.translationKey ? String(row.translationKey) : null,
    series: row.series ? String(row.series) : null,
    status: (row.status ?? 'draft') as PostStatus,
    authorId: row.authorId ? String(row.authorId) : null,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function mapPost(row: PostRow): PostRecord {
  const document = renderMarkdownDocument(row.body);
  return {
    ...mapPostSummary(row),
    body: row.body,
    bodyHtml: document.html,
    headings: document.headings,
  };
}

const POST_SUMMARY_COLUMNS = `id, slug, title, description, length(body) AS bodyLength,
  pub_date AS pubDate, updated_date AS updatedDate, tags, lang, cover, cover_alt AS coverAlt,
  featured, series, translation_key AS translationKey, status, author_id AS authorId,
  created_at AS createdAt, updated_at AS updatedAt`;

const POST_COLUMNS = `id, slug, title, description, body, length(body) AS bodyLength,
  pub_date AS pubDate, updated_date AS updatedDate, tags, lang, cover, cover_alt AS coverAlt,
  featured, series, translation_key AS translationKey, status, author_id AS authorId,
  created_at AS createdAt, updated_at AS updatedAt`;

/** Astro's Cloudflare v14 adapter exposes bindings through cloudflare:workers. */
export function runtimeEnv(_locals?: unknown): RuntimeEnv {
  const configuredEnv: Cloudflare.Env = cloudflareEnv;
  return {
    DB: configuredEnv.DB,
    ENVIRONMENT: configuredEnv.ENVIRONMENT,
    CF_PAGES: configuredEnv.CF_PAGES,
    INITIAL_SETUP_KEY: configuredEnv.INITIAL_SETUP_KEY,
    SESSION_SECRET: configuredEnv.SESSION_SECRET,
  };
}

/** Source Markdown is only a development fallback outside a Pages production runtime. */
export function allowsStaticPostFallback(env: RuntimeEnv | null | undefined): boolean {
  return !env?.DB && env?.ENVIRONMENT !== 'production' && env?.CF_PAGES !== '1';
}

export async function getPublishedPostSummaries(
  env: RuntimeEnv | null | undefined,
  lang?: 'zh' | 'en',
): Promise<PostSummary[] | null> {
  if (!env?.DB) return null;
  const where = lang ? 'WHERE status = ? AND lang = ?' : 'WHERE status = ?';
  const params = lang ? ['published', lang] : ['published'];
  const result = await env.DB.prepare(
    `SELECT ${POST_SUMMARY_COLUMNS} FROM posts ${where} ORDER BY pub_date DESC, created_at DESC`,
  )
    .bind(...params)
    .all<PostSummaryRow>();
  return result.results.map(mapPostSummary);
}

export async function getPublishedPostSummariesByTag(
  env: RuntimeEnv | null | undefined,
  lang: 'zh' | 'en',
  tag: string,
): Promise<PostSummary[] | null> {
  if (!env?.DB) return null;
  const result = await env.DB.prepare(
    `SELECT ${POST_SUMMARY_COLUMNS} FROM posts
      WHERE status = 'published' AND lang = ?
        AND EXISTS (SELECT 1 FROM json_each(posts.tags) WHERE json_each.value = ?)
      ORDER BY pub_date DESC, created_at DESC`,
  ).bind(lang, tag).all<PostSummaryRow>();
  return result.results.map(mapPostSummary);
}

export async function getPublishedTranslationSlug(
  env: RuntimeEnv | null | undefined,
  translationKey: string,
  lang: 'zh' | 'en',
): Promise<string | null> {
  if (!env?.DB || !translationKey) return null;
  const row = await env.DB.prepare(
    `SELECT slug FROM posts
     WHERE status = 'published' AND translation_key = ? AND lang = ?
     ORDER BY pub_date DESC, created_at DESC LIMIT 1`,
  ).bind(translationKey, lang).first<{ slug: string }>();
  return row?.slug ?? null;
}

export async function hasPublishedPostWithTag(
  env: RuntimeEnv | null | undefined,
  lang: 'zh' | 'en',
  tag: string,
): Promise<boolean | null> {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `SELECT 1 AS found FROM posts
     WHERE status = 'published' AND lang = ?
       AND EXISTS (SELECT 1 FROM json_each(posts.tags) WHERE json_each.value = ?)
     LIMIT 1`,
  ).bind(lang, tag).first<{ found: number }>();
  return Boolean(row?.found);
}

export async function getPostBySlug(env: RuntimeEnv | null | undefined, slug: string): Promise<PostRecord | null> {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `SELECT ${POST_COLUMNS} FROM posts WHERE slug = ? AND status = 'published' LIMIT 1`,
  )
    .bind(slug)
    .first<PostRow>();
  return row ? mapPost(row) : null;
}

export async function getPublishedPostBySlug(
  env: RuntimeEnv | null | undefined,
  slug: string,
  lang: 'zh' | 'en',
): Promise<PostRecord | null> {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `SELECT ${POST_COLUMNS} FROM posts WHERE slug = ? AND lang = ? AND status = 'published' LIMIT 1`,
  )
    .bind(slug, lang)
    .first<PostRow>();
  return row ? mapPost(row) : null;
}

export async function getPostById(env: RuntimeEnv | null | undefined, id: string): Promise<PostRecord | null> {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `SELECT ${POST_COLUMNS} FROM posts WHERE id = ? LIMIT 1`,
  )
    .bind(id)
    .first<PostRow>();
  return row ? mapPost(row) : null;
}

export async function countPosts(env: RuntimeEnv | null | undefined): Promise<{ total: number; published: number; drafts: number } | null> {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts FROM posts`,
  ).first<{ total: number; published: number; drafts: number }>();
  return row ? { total: Number(row.total), published: Number(row.published), drafts: Number(row.drafts) } : null;
}
