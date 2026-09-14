import type { APIRoute } from 'astro';
import {
  MANAGED_POST_SUMMARY_COLUMNS,
  serializeManagedPostSummary,
  type ManagedPostSummaryRow,
} from '../../../lib/admin-posts';
import {
  authorizeRead,
  authorizeWrite,
  errorResponse,
  json,
  POST_JSON_BODY_LIMIT_BYTES,
  readJsonObject,
} from '../../../lib/auth/http';
import { canCreatePost, canSetPostStatus } from '../../../lib/auth/policy';
import { parsePostInput } from '../../../lib/posts/input';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const auth = await authorizeRead(context);
    if (auth instanceof Response) return auth;
    if (auth.session.user.role === 'reader') return errorResponse(403, '没有访问后台内容的权限。');
    const owner = auth.session.user.role === 'owner';
    const result = auth.db.prepare(
      `SELECT ${MANAGED_POST_SUMMARY_COLUMNS} FROM posts p LEFT JOIN users u ON u.id = p.author_id
       ${owner ? '' : 'WHERE p.author_id = ?'} ORDER BY p.updated_at DESC`,
    );
    const rows = owner
      ? await result.all<ManagedPostSummaryRow>()
      : await result.bind(auth.session.user.id).all<ManagedPostSummaryRow>();
    return json({ posts: rows.results.map(serializeManagedPostSummary) });
  } catch {
    return errorResponse(500, '文章列表读取失败。');
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    if (!canCreatePost(auth.session.user)) return errorResponse(403, '没有新建文章的权限。');
    const body = await readJsonObject(context.request, POST_JSON_BODY_LIMIT_BYTES);
    if (!body) return errorResponse(400, '请求格式无效。');
    const parsed = parsePostInput(body);
    if (!parsed.ok) return errorResponse(400, parsed.error);
    const post = parsed.value;
    if (!canSetPostStatus(auth.session.user, { authorId: auth.session.user.id, status: 'draft' }, post.status)) {
      return errorResponse(403, '没有设置此文章状态的权限。');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const created = await auth.db.prepare(
      `INSERT INTO posts (id, slug, title, description, body, pub_date, updated_date, tags, lang,
        cover, cover_alt, featured, series, translation_key, status, author_id, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM users WHERE id = ? AND active = 1 AND role IN ('owner', 'editor')
       )`,
    ).bind(
      id, post.slug, post.title, post.description, post.body, post.pubDate, null,
      JSON.stringify(post.tags), post.lang, post.cover, post.coverAlt, post.featured ? 1 : 0,
      post.series, post.translationKey, post.status, auth.session.user.id, now, now,
      auth.session.user.id,
    ).run();
    if (Number(created.meta.changes ?? 0) !== 1) {
      return errorResponse(409, '账号状态或权限已变更，请重新登录。');
    }
    return json({
      id,
      post: {
        id,
        ...post,
        version: 1,
        updatedDate: null,
        content: post.body,
        authorId: auth.session.user.id,
        createdAt: now,
        updatedAt: now,
      },
    }, 201);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint/i.test(error.message)) return errorResponse(409, 'Slug 已被其他文章使用。');
    return errorResponse(500, '文章保存失败，请稍后重试。');
  }
};
