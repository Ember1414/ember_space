import type { APIRoute } from 'astro';
import { normalizeAccount } from '../../../lib/auth/account';
import { randomToken, sha256 } from '../../../lib/auth/crypto';
import { authorizeRead, authorizeWrite, errorResponse, json, readJsonObject } from '../../../lib/auth/http';

export const prerender = false;

interface InviteRow {
  id: string;
  email: string | null;
  role: 'editor';
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export const GET: APIRoute = async (context) => {
  try {
    const auth = await authorizeRead(context, 'owner');
    if (auth instanceof Response) return auth;
    const result = await auth.db.prepare(
      `SELECT id, invited_email AS email, role, expires_at AS expiresAt, used_at AS usedAt,
        created_at AS createdAt, created_by AS createdBy
       FROM invites ORDER BY created_at DESC LIMIT 100`,
    ).all<InviteRow>();
    return json({ invites: result.results });
  } catch {
    return errorResponse(500, '邀请列表读取失败。');
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context, 'owner');
    if (auth instanceof Response) return auth;
    const body = await readJsonObject(context.request);
    if (!body) return errorResponse(400, '请求格式无效。');
    const email = normalizeAccount(body.email);
    const expiresIn = Number(body.expiresIn ?? 604_800);
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
      return errorResponse(400, '邀请邮箱格式无效。');
    }
    if (!Number.isSafeInteger(expiresIn) || expiresIn < 3600 || expiresIn > 2_592_000) {
      return errorResponse(400, '邀请有效期应在 1 小时到 30 天之间。');
    }

    const token = randomToken();
    const id = crypto.randomUUID();
    const tokenHash = await sha256(token);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiresIn * 1000).toISOString();
    await auth.db.prepare(
      `INSERT INTO invites (id, token_hash, role, expires_at, created_by, created_at, invited_email)
       VALUES (?, ?, 'editor', ?, ?, ?, ?)`,
    ).bind(id, tokenHash, expiresAt, auth.session.user.id, createdAt.toISOString(), email || null).run();

    const url = new URL(`/admin/invite/${encodeURIComponent(token)}/`, context.request.url).toString();
    return json({
      invite: { id, email: email || null, role: 'editor', expiresAt, usedAt: null, createdAt: createdAt.toISOString() },
      token,
      url,
      inviteUrl: url,
    }, 201);
  } catch {
    return errorResponse(500, '邀请创建失败，请稍后重试。');
  }
};
