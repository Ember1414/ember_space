// Cloudflare Pages Function — POST /api/subscribe
// 需要在 Cloudflare Dashboard 为本项目绑定名为 SUBSCRIBERS 的 KV namespace，
// 绑定路径：Settings -> Functions -> KV namespace bindings。
// 订阅邮箱以 { 邮箱: 订阅时间 } 存入 KV。

type KV = {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
};

interface Env {
  SUBSCRIBERS?: KV;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (data: object, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export const onRequestPost = async (ctx: { request: Request; env: Env }) => {
  const { request, env } = ctx;

  if (!env.SUBSCRIBERS) {
    return json(
      { error: '服务端未配置 KV 存储（SUBSCRIBERS），请在 Cloudflare 后台绑定。' },
      500
    );
  }

  let email = '';
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return json({ error: '请求格式错误。' }, 400);
  }

  if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: '请输入有效的邮箱地址。' }, 400);
  }

  const existing = await env.SUBSCRIBERS.get(email);
  if (existing) {
    return json({ message: '这个邮箱已经订阅过啦。' });
  }

  await env.SUBSCRIBERS.put(email, new Date().toISOString());
  return json({ message: '订阅成功！感谢关注。' });
};
