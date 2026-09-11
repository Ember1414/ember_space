import { marked } from 'marked';
import type { D1DatabaseLike } from './db';

export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 100;
export const SEARCH_DEFAULT_LIMIT = 10;
export const SEARCH_MAX_LIMIT = 20;

export interface PublicPostSearchInput {
  query: string;
  lang: 'zh' | 'en';
  limit: number;
}

export interface PublicPostSearchResult {
  url: string;
  title: string;
  excerpt: string;
  type: 'posts';
  lang: 'zh' | 'en';
}

export type PublicPostSearchInputResult =
  | { ok: true; value: PublicPostSearchInput }
  | { ok: false; error: string };

interface SearchPostRow {
  slug: string;
  title: string;
  excerptSource: string;
}

export function parsePublicPostSearchInput(params: URLSearchParams): PublicPostSearchInputResult {
  const query = (params.get('q') ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const queryLength = Array.from(query).length;
  if (queryLength < SEARCH_QUERY_MIN_LENGTH || queryLength > SEARCH_QUERY_MAX_LENGTH) {
    return {
      ok: false,
      error: `q must contain between ${SEARCH_QUERY_MIN_LENGTH} and ${SEARCH_QUERY_MAX_LENGTH} characters.`,
    };
  }

  const lang = params.get('lang');
  if (lang !== 'zh' && lang !== 'en') {
    return { ok: false, error: 'lang must be zh or en.' };
  }

  const requestedLimit = params.get('limit');
  const limit = requestedLimit === null ? SEARCH_DEFAULT_LIMIT : Number(requestedLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_MAX_LIMIT) {
    return { ok: false, error: `limit must be an integer between 1 and ${SEARCH_MAX_LIMIT}.` };
  }

  return { ok: true, value: { query, lang, limit } };
}

export function escapeLikeTerm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function collectMarkdownText(value: unknown, parts: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMarkdownText(item, parts));
    return;
  }
  if (value === null || typeof value !== 'object') return;

  const token = value as Record<string, unknown>;
  const type = typeof token.type === 'string' ? token.type : '';
  if (type === 'html') return;

  if (type === 'image' || type === 'code' || type === 'codespan') {
    if (typeof token.text === 'string') parts.push(token.text);
    return;
  }

  const childKeys = ['tokens', 'items', 'header', 'rows'];
  let hasChildren = false;
  childKeys.forEach((key) => {
    if (Array.isArray(token[key])) {
      hasChildren = true;
      collectMarkdownText(token[key], parts);
    }
  });

  if (!hasChildren && typeof token.text === 'string') parts.push(token.text);
}

export function markdownSearchText(markdown: string): string {
  const parts: string[] = [];
  collectMarkdownText(marked.lexer(markdown ?? ''), parts);
  return parts.join(' ').replace(/\s+/gu, ' ').trim();
}

function alignedExcerptStart(text: string, desiredStart: number): number {
  if (desiredStart <= 0) return 0;
  const nextSpace = text.indexOf(' ', desiredStart);
  return nextSpace !== -1 && nextSpace - desiredStart <= 24 ? nextSpace + 1 : desiredStart;
}

export function summarizeSearchText(source: string, query: string, maxLength = 180): string {
  const text = markdownSearchText(source);
  const limit = Math.max(40, Math.min(500, Math.floor(maxLength)));
  if (text.length <= limit) return text;

  const matchIndex = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const desiredStart = matchIndex < 0 ? 0 : Math.max(0, matchIndex - Math.floor(limit * 0.35));
  const start = alignedExcerptStart(text, desiredStart);
  const available = limit - (start > 0 ? 3 : 0);
  let end = Math.min(text.length, start + available);
  const lastSpace = text.lastIndexOf(' ', end);
  if (end < text.length && lastSpace > start + Math.floor(available * 0.7)) end = lastSpace;

  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  const bodyLimit = Math.max(1, limit - prefix.length - suffix.length);
  return `${prefix}${text.slice(start, Math.min(end, start + bodyLimit)).trim()}${suffix}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightSearchExcerpt(excerpt: string, query: string): string {
  const needle = query.trim();
  if (!needle) return escapeHtml(excerpt);

  const matcher = new RegExp(escapeRegExp(needle), 'giu');
  let cursor = 0;
  let highlighted = '';
  for (const match of excerpt.matchAll(matcher)) {
    const index = match.index;
    highlighted += escapeHtml(excerpt.slice(cursor, index));
    highlighted += `<mark>${escapeHtml(match[0])}</mark>`;
    cursor = index + match[0].length;
  }
  highlighted += escapeHtml(excerpt.slice(cursor));
  return highlighted;
}

export async function searchPublishedPosts(
  db: D1DatabaseLike,
  input: PublicPostSearchInput,
): Promise<PublicPostSearchResult[]> {
  const escapedTerm = escapeLikeTerm(input.query);
  const pattern = `%${escapedTerm}%`;
  const prefixPattern = `${escapedTerm}%`;
  const rows = await db.prepare(
    `WITH search(term, pattern, prefix_pattern, language) AS (VALUES (?, ?, ?, ?))
     SELECT p.slug, p.title,
       CASE
         WHEN p.description LIKE search.pattern ESCAPE '\\' THEN p.description
         WHEN p.body LIKE search.pattern ESCAPE '\\' THEN substr(
           p.body,
           max(1, instr(lower(p.body), lower(search.term)) - 140),
           420
         )
         ELSE p.description
       END AS excerptSource
     FROM posts p CROSS JOIN search
     WHERE p.status = 'published'
       AND p.lang = search.language
       AND (
         p.title LIKE search.pattern ESCAPE '\\'
         OR p.description LIKE search.pattern ESCAPE '\\'
         OR p.body LIKE search.pattern ESCAPE '\\'
         OR p.tags LIKE search.pattern ESCAPE '\\'
       )
     ORDER BY CASE
       WHEN lower(p.title) = lower(search.term) THEN 0
       WHEN p.title LIKE search.prefix_pattern ESCAPE '\\' THEN 1
       WHEN p.title LIKE search.pattern ESCAPE '\\' THEN 2
       WHEN p.description LIKE search.pattern ESCAPE '\\' THEN 3
       WHEN p.tags LIKE search.pattern ESCAPE '\\' THEN 4
       ELSE 5
     END, p.pub_date DESC, p.created_at DESC
     LIMIT ?`,
  )
    .bind(input.query, pattern, prefixPattern, input.lang, input.limit)
    .all<SearchPostRow>();

  const base = input.lang === 'zh' ? '' : '/en';
  return rows.results.map((row) => {
    const excerpt = summarizeSearchText(row.excerptSource, input.query);
    return {
      url: `${base}/posts/${encodeURIComponent(row.slug)}/`,
      title: row.title,
      excerpt: highlightSearchExcerpt(excerpt, input.query),
      type: 'posts',
      lang: input.lang,
    };
  });
}
