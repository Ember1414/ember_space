import type { APIRoute } from 'astro';
import type { D1DatabaseLike } from '../../../lib/db';
import { MANAGED_POST_COLUMNS, serializeManagedPost, type ManagedPostRow } from '../../../lib/admin-posts';
import { authorizeRead, authorizeWrite, errorResponse, json, readJsonObject } from '../../../lib/auth/http';
import { canDeletePost, canEditPost, canSetPostStatus } from '../../../lib/auth/policy';
import { parsePostInput } from '../../../lib/posts/input';

export const prerender = false;

async function findPost(db: D1DatabaseLike, id: string): Promise<ManagedPostRow | null> {
  return db.prepare(
    `SELECT ${MANAGED_POST_COLUMNS} FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = ? LIMIT 1`,
  ).bind(id).first<ManagedPostRow>();
}

export const GET: APIRoute = async (context) => {
  try {
    const auth = await authorizeRead(context);
    if (auth instanceof Response) return auth;
    const post = await findPost(auth.db, context.params.id ?? '');
    if (!post) return errorResponse(404, '文章不存在。');
    if (!canEditPost(auth.session.user, post)) return errorResponse(403, '没有读取此草稿的权限。');
    return json({ post: serializeManagedPost(post) });
  } catch {
    return errorResponse(500, '文章读取失败。');
  }
};

export const PATCH: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    const id = context.params.id ?? '';
    const existing = await findPost(auth.db, id);
    if (!existing) return errorResponse(404, '文章不存在。');
    if (!canEditPost(auth.session.user, existing)) return errorResponse(403, '没有编辑此文章的权限。');
    const body = await readJsonObject(context.request);
    if (!body) return errorResponse(400, '请求格式无效。');
    const parsed = parsePostInput({
      title: existing.title,
      slug: existing.slug,
      description: existing.description,
      body: existing.body,
      pubDate: existing.pubDate,
      updatedDate: existing.updatedDate,
      tags: (() => { try { return JSON.parse(existing.tags); } catch { return []; } })(),
      lang: existing.lang,
      cover: existing.cover,
      coverAlt: existing.coverAlt,
      featured: Boolean(existing.featured),
      series: existing.series,
      translationKey: existing.translationKey,
      status: existing.status,
      ...body,
    });
    if (!parsed.ok) return errorResponse(400, parsed.error);
    const post = parsed.value;
    if (!canSetPostStatus(auth.session.user, existing, post.status)) {
      return errorResponse(403, '没有设置此文章状态的权限。');
    }
    const now = new Date().toISOString();
    await auth.db.prepare(
      `UPDATE posts SET slug = ?, title = ?, description = ?, body = ?, pub_date = ?, updated_date = ?,
        tags = ?, lang = ?, cover = ?, cover_alt = ?, featured = ?, series = ?, translation_key = ?,
        status = ?, updated_at = ? WHERE id = ?`,
    ).bind(
      post.slug, post.title, post.description, post.body, post.pubDate, now, JSON.stringify(post.tags),
      post.lang, post.cover, post.coverAlt, post.featured ? 1 : 0, post.series, post.translationKey,
      post.status, now, id,
    ).run();
    return json({ id, post: { id, ...post, content: post.body, authorId: existing.authorId, createdAt: existing.createdAt, updatedAt: now } });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint/i.test(error.message)) return errorResponse(409, 'Slug 已被其他文章使用。');
    return errorResponse(500, '文章保存失败，请稍后重试。');
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    const id = context.params.id ?? '';
    const existing = await findPost(auth.db, id);
    if (!existing) return errorResponse(404, '文章不存在。');
    if (!canDeletePost(auth.session.user, existing)) return errorResponse(403, '只有所有者可以删除文章。');
    await auth.db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch {
    return errorResponse(500, '文章删除失败。');
  }
};
