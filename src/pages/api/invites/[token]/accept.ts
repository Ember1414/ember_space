import type { APIRoute } from 'astro';
import { normalizeAccount } from '../../../../lib/auth/account';
import { hashPassword, sha256 } from '../../../../lib/auth/crypto';
import { canConsumeInvite } from '../../../../lib/auth/invites';
import { errorResponse, getRuntime, json, readJsonObject, trustedRequestOrigin } from '../../../../lib/auth/http';

export const prerender = false;

interface InviteRow {
  id: string;
  email: string | null;
  role: 'editor';
  expiresAt: string;
  usedAt: string | null;
}

export const POST: APIRoute = async (context) => {
  try {
    const runtime = getRuntime(context);
    if (runtime instanceof Response) return runtime;
    if (!trustedRequestOrigin(context.request)) return errorResponse(403, '请求来源无效。');
    const token = context.params.token ?? '';
    if (!token || token.length > 256) return errorResponse(404, '邀请无效、已使用或已过期。');
    const body = await readJsonObject(context.request);
    if (!body) return errorResponse(400, '请求格式无效。');
    const email = normalizeAccount(body.email);
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return errorResponse(400, '邮箱格式无效。');
    if (displayName.length < 1 || displayName.length > 80) return errorResponse(400, '显示名称长度应为 1 到 80 个字符。');
    if (password.length < 10 || password.length > 256) return errorResponse(400, '密码长度应为 10 到 256 个字符。');

    const tokenHash = await sha256(token);
    const invite = await runtime.db.prepare(
      `SELECT id, invited_email AS email, role, expires_at AS expiresAt, used_at AS usedAt
       FROM invites WHERE token_hash = ? LIMIT 1`,
    ).bind(tokenHash).first<InviteRow>();
    const now = new Date();
    if (!invite || !canConsumeInvite(invite, now)) return errorResponse(410, '邀请无效、已使用或已过期。');
    if (invite.email && normalizeAccount(invite.email) !== email) return errorResponse(403, '请使用邀请指定的邮箱。');

    const id = crypto.randomUUID();
    const timestamp = now.toISOString();
    const digest = await hashPassword(password);
    const [created, consumed] = await runtime.db.batch([
      runtime.db.prepare(
        `INSERT INTO users (id, email, display_name, password_hash, password_salt, role, active, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, 'editor', 1, ?, ? FROM invites
         WHERE id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?`,
      ).bind(id, email, displayName, digest.hash, digest.salt, timestamp, timestamp, invite.id, tokenHash, timestamp),
      runtime.db.prepare(
        `UPDATE invites SET used_at = ?, used_by = ?
         WHERE id = ? AND token_hash = ? AND used_at IS NULL
           AND EXISTS (SELECT 1 FROM users WHERE id = ?)`,
      ).bind(timestamp, id, invite.id, tokenHash, id),
    ]);
    if (Number(created.meta.changes ?? 0) !== 1 || Number(consumed.meta.changes ?? 0) !== 1) {
      return errorResponse(410, '邀请无效、已使用或已过期。');
    }

    return json({ user: { id, username: email, email, displayName, role: 'editor', active: true } }, 201);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint/i.test(error.message)) {
      return errorResponse(409, '该邮箱已经注册。');
    }
    return errorResponse(500, '账号创建失败，请稍后重试。');
  }
};
