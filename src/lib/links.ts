import type { D1DatabaseLike } from './db';

export type LinkCategory = 'mine' | 'favorite' | 'resource';

export const LINK_CATEGORIES: readonly LinkCategory[] = ['mine', 'favorite', 'resource'];

export interface LinkRecord {
  id: string;
  title: string;
  url: string;
  description: string;
  category: LinkCategory;
  createdAt: string;
  updatedAt: string;
}

const LINK_COLUMNS = 'id, title, url, description, category, created_at AS createdAt, updated_at AS updatedAt';

export async function getAllLinks(db: D1DatabaseLike | null | undefined): Promise<LinkRecord[]> {
  if (!db) return [];
  const { results } = await db.prepare(`SELECT ${LINK_COLUMNS} FROM links ORDER BY created_at DESC`).all<LinkRecord>();
  return results ?? [];
}

export const LINK_TITLE_MAX = 100;
export const LINK_URL_MAX = 2048;
export const LINK_DESCRIPTION_MAX = 500;

export interface LinkInput {
  title: string;
  url: string;
  description: string;
  category: LinkCategory;
}

export type ParsedLinkInput = { ok: true; value: LinkInput } | { ok: false; error: string };

/** 后台表单输入校验：标题必填、仅 http/https、简介限长。 */
export function parseLinkInput(body: Record<string, unknown>): ParsedLinkInput {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > LINK_TITLE_MAX) return { ok: false, error: `标题必填，且不超过 ${LINK_TITLE_MAX} 字。` };

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || url.length > LINK_URL_MAX) return { ok: false, error: '链接必填。' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: '链接格式无效。' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: '仅支持 http/https 链接。' };
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length > LINK_DESCRIPTION_MAX) return { ok: false, error: `简介不能超过 ${LINK_DESCRIPTION_MAX} 字。` };

  const category = body.category;
  if (category !== 'mine' && category !== 'favorite' && category !== 'resource') {
    return { ok: false, error: '分类无效。' };
  }

  return { ok: true, value: { title, url, description, category } };
}
