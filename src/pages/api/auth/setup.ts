import type { APIRoute } from 'astro';
import { normalizeAccount } from '../../../lib/auth/account';
import { constantTimeEqual, hashPassword } from '../../../lib/auth/crypto';
import { errorResponse, getRuntime, json, readJsonObject, trustedRequestOrigin } from '../../../lib/auth/http';

export const prerender = false;

function validAccount(value: string): boolean {
  return value.length >= 3 && value.length <= 254 && !/[\u0000-\u001f\u007f]/.test(value);
}

export const POST: APIRoute = async (context) => {
  try {
    const runtime = getRuntime(context);
    if (runtime instanceof Response) return runtime;
    if (!trustedRequestOrigin(context.request)) return errorResponse(403, '请求来源无效。');
    if (!runtime.env.INITIAL_SETUP_KEY) return errorResponse(503, '初始化密钥尚未配置。');

    const body = await readJsonObject(context.request);
    if (!body) return errorResponse(400, '请求格式无效。');
    const setupKey = typeof body.setupKey === 'string' ? body.setupKey : '';
    const username = normalizeAccount(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : username;

    if (setupKey.length < 16 || setupKey.length > 512 || runtime.env.INITIAL_SETUP_KEY.length > 512
      || !await constantTimeEqual(setupKey, runtime.env.INITIAL_SETUP_KEY)) {
      return errorResponse(403, '初始化密钥无效。');
    }
    if (!validAccount(username)) return errorResponse(400, '账号长度应为 3 到 254 个字符。');
    if (displayName.length < 1 || displayName.length > 80) return errorResponse(400, '显示名称长度应为 1 到 80 个字符。');
    if (password.length < 10 || password.length > 256) return errorResponse(400, '密码长度应为 10 到 256 个字符。');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const digest = await hashPassword(password);
    const [created] = await runtime.db.batch([
      runtime.db.prepare(
        `INSERT INTO users (id, email, display_name, password_hash, password_salt, role, active, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, 'owner', 1, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
           AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'setup_completed')`,
      ).bind(id, username, displayName, digest.hash, digest.salt, now, now),
      runtime.db.prepare(
        `INSERT OR IGNORE INTO settings (key, value, updated_at)
         SELECT 'setup_completed', 'true', ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'owner')`,
      ).bind(now, id),
    ]);

    if (Number(created.meta.changes ?? 0) !== 1) return errorResponse(409, '站点已经完成初始化。');
    return json({ user: { id, username, email: username, displayName, role: 'owner', active: true } }, 201);
  } catch (error) {
    const diagnostic = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: 'UnknownError', message: String(error) };
    console.error(JSON.stringify({
      event: 'owner_setup_failed',
      error: diagnostic,
    }));
    return errorResponse(500, '初始化失败，请稍后重试。');
  }
};
