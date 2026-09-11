import type { PostStatus } from '../db';

export interface PostInput {
  slug: string;
  title: string;
  description: string;
  body: string;
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
}

export type PostInputResult = { ok: true; value: PostInput } | { ok: false; error: string };

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized.length <= max ? normalized : null;
}

export function createSlug(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
  return slug || `post-${crypto.randomUUID().slice(0, 12)}`;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(value) && Number.isFinite(Date.parse(value));
}

export function parsePostInput(input: Record<string, unknown>): PostInputResult {
  const title = text(input.title, 180);
  const description = text(input.description, 500);
  const bodyValue = typeof input.body === 'string' ? input.body : input.content;
  const body = typeof bodyValue === 'string' && bodyValue.length <= 500_000 ? bodyValue : null;
  if (!title) return { ok: false, error: '标题不能为空，且不能超过 180 个字符。' };
  if (!description) return { ok: false, error: '摘要不能为空，且不能超过 500 个字符。' };
  if (body === null) return { ok: false, error: '正文格式无效或超过 500,000 个字符。' };

  const requestedSlug = text(input.slug, 100) ?? '';
  const slug = requestedSlug ? requestedSlug.toLowerCase() : createSlug(title);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: 'URL 标识只能包含小写字母、数字和短横线。' };
  }

  const lang = input.lang ?? 'zh';
  if (lang !== 'zh' && lang !== 'en') return { ok: false, error: '语言必须是 zh 或 en。' };
  const status = input.status ?? 'draft';
  if (status !== 'draft' && status !== 'published' && status !== 'archived') {
    return { ok: false, error: '文章状态无效。' };
  }

  const pubDate = text(input.pubDate, 40) || new Date().toISOString().slice(0, 10);
  if (!validDate(pubDate)) return { ok: false, error: '发布日期无效。' };
  const updatedDate = text(input.updatedDate, 40);
  if (updatedDate && !validDate(updatedDate)) return { ok: false, error: '更新日期无效。' };

  if (input.tags !== undefined && !Array.isArray(input.tags)) return { ok: false, error: '标签格式无效。' };
  const tags = [...new Set((input.tags as unknown[] | undefined ?? []).map((tag) => text(tag, 40)).filter((tag): tag is string => Boolean(tag)))];
  if (tags.length > 12) return { ok: false, error: '标签不能超过 12 个。' };

  const coverText = text(input.cover, 2048);
  if (input.cover && !coverText) return { ok: false, error: '封面地址无效。' };
  if (coverText) {
    try {
      const url = new URL(coverText);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
    } catch {
      return { ok: false, error: '封面地址必须是 HTTP 或 HTTPS URL。' };
    }
  }

  return {
    ok: true,
    value: {
      slug,
      title,
      description,
      body,
      pubDate,
      updatedDate: updatedDate || null,
      tags,
      lang,
      cover: coverText || null,
      coverAlt: text(input.coverAlt, 300) || null,
      featured: input.featured === true,
      series: text(input.series, 120) || null,
      translationKey: text(input.translationKey, 120) || null,
      status,
    },
  };
}

export function isPublicStatus(status: PostStatus): boolean {
  return status === 'published';
}

