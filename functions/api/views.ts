// Cloudflare Pages Functions — 浏览量统计
// POST /api/views  body: { path: "/posts/xxx/" }  → 浏览量 +1，返回新计数
// GET  /api/views?paths=/posts/a/,/posts/b/       → 批量查询计数（保留给列表页扩展用）
// 存储：KV namespace VIEWS（key 为规范化路径，中英文路由共享同一计数）

type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

interface Env {
  VIEWS?: KV;
}

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** 规范化路径：剥掉 /en 前缀（中英文共享计数）、去掉查询串与锚点 */
function normalize(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.length > 200) return null;
  let p = raw.split('?')[0].split('#')[0];
  if (p === '/en' || p.startsWith('/en/')) p = p.slice(3) || '/';
  return p;
}

export const onRequestPost = async (ctx: { request: Request; env: Env }) => {
  const { request, env } = ctx;
  if (!env.VIEWS) {
    return json({ error: 'KV not configured (VIEWS)' }, 500);
  }

  let path = '';
  try {
    const body = (await request.json()) as { path?: unknown };
    path = typeof body.path === 'string' ? body.path : '';
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  const key = normalize(path);
  if (!key) return json({ error: 'invalid path' }, 400);

  const current = parseInt((await env.VIEWS.get(key)) ?? '0', 10) || 0;
  const next = current + 1;
  await env.VIEWS.put(key, String(next));
  return json({ views: next });
};

export const onRequestGet = async (ctx: { request: Request; env: Env }) => {
  const { request, env } = ctx;
  if (!env.VIEWS) {
    return json({ error: 'KV not configured (VIEWS)' }, 500);
  }

  const raw = ctx.request.url;
  const paths = new URL(raw).searchParams
    .get('paths')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50) ?? [];

  const views: Record<string, number> = {};
  for (const p of paths) {
    const key = normalize(p);
    if (!key) continue;
    views[key] = parseInt((await env.VIEWS.get(key)) ?? '0', 10) || 0;
  }
  return json({ views });
};
