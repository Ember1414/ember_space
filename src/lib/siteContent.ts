/** 站点级内容（关于页）：存于 D1 site_content 表，后台可编辑，公开页动态读取。 */
import type { D1DatabaseLike } from './db';

export type SiteLang = 'zh' | 'en';

export interface AboutContent {
  intro: string;
  status: string;
  stack: string;
  location: string;
  email: string;
  github: string;
}

export const ABOUT_KEY_PREFIX = 'about:';
export const ABOUT_INTRO_MAX = 20_000;
export const ABOUT_FIELD_MAX = 200;
export const ABOUT_GITHUB_MAX = 300;

export function aboutKey(lang: SiteLang): string {
  return `${ABOUT_KEY_PREFIX}${lang}`;
}

export interface AboutRecord {
  lang: SiteLang;
  content: AboutContent;
  updatedAt: string;
}

export async function getAboutContent(
  db: D1DatabaseLike | null | undefined,
  lang: SiteLang,
): Promise<AboutContent | null> {
  if (!db) return null;
  // 表尚未迁移（0010）或 D1 暂不可用时回退默认内容，公开页不能因此白屏
  try {
    const row = await db.prepare('SELECT value FROM site_content WHERE key = ? LIMIT 1')
      .bind(aboutKey(lang))
      .first<{ value: string }>();
    if (!row) return null;
    return normalizeAboutContent(JSON.parse(row.value) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getAllAboutContent(
  db: D1DatabaseLike | null | undefined,
): Promise<{ zh: AboutContent | null; en: AboutContent | null }> {
  const [zh, en] = await Promise.all([getAboutContent(db, 'zh'), getAboutContent(db, 'en')]);
  return { zh, en };
}

function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized.length <= max ? normalized : null;
}

/** 校验并规范化表单输入；字段可留空（留空时公开页回退默认值）。 */
export function parseAboutContent(input: Record<string, unknown>): { ok: true; value: AboutContent } | { ok: false; error: string } {
  const intro = text(input.intro, ABOUT_INTRO_MAX);
  if (intro === null) return { ok: false, error: `简介不能超过 ${ABOUT_INTRO_MAX} 个字符。` };
  const status = text(input.status, ABOUT_FIELD_MAX);
  const stack = text(input.stack, ABOUT_FIELD_MAX);
  const location = text(input.location, ABOUT_FIELD_MAX);
  const email = text(input.email, ABOUT_FIELD_MAX);
  const github = text(input.github, ABOUT_GITHUB_MAX);
  if (status === null || stack === null || location === null || email === null || github === null) {
    return { ok: false, error: '字段格式无效或超过长度限制。' };
  }
  return { ok: true, value: { intro, status, stack, location, email, github } };
}

/** 宽容读取：缺失字段回退空字符串，保证旧数据结构升级后仍可渲染。 */
export function normalizeAboutContent(value: Record<string, unknown>): AboutContent {
  const pick = (key: string, max: number): string => {
    const raw = value[key];
    return typeof raw === 'string' && raw.length <= max ? raw : '';
  };
  return {
    intro: pick('intro', ABOUT_INTRO_MAX),
    status: pick('status', ABOUT_FIELD_MAX),
    stack: pick('stack', ABOUT_FIELD_MAX),
    location: pick('location', ABOUT_FIELD_MAX),
    email: pick('email', ABOUT_FIELD_MAX),
    github: pick('github', ABOUT_GITHUB_MAX),
  };
}

export async function setAboutContent(
  db: D1DatabaseLike,
  lang: SiteLang,
  content: AboutContent,
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(aboutKey(lang), JSON.stringify(content), now).run();
}
