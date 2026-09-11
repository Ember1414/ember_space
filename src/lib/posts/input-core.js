/** @typedef {'draft' | 'published' | 'archived'} PostStatus */

function text(value, max) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized.length <= max ? normalized : null;
}

function optionalText(value, max, error) {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const normalized = text(value, max);
  return normalized === null
    ? { ok: false, error }
    : { ok: true, value: normalized || null };
}

export function createSlug(value) {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
  return slug || `post-${crypto.randomUUID().slice(0, 12)}`;
}

function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function validUpdatedDate(value) {
  if (validCalendarDate(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export function parseExpectedVersion(value) {
  return Number.isSafeInteger(value) && value >= 1 && value < Number.MAX_SAFE_INTEGER
    ? { ok: true, value }
    : { ok: false, error: '文章版本号无效，请刷新后重试。' };
}

export function parsePostInput(input) {
  const title = text(input.title, 180);
  const description = text(input.description, 500);
  const bodyValue = typeof input.body === 'string' ? input.body : input.content;
  const body = typeof bodyValue === 'string' && bodyValue.length <= 500_000 ? bodyValue : null;
  if (!title) return { ok: false, error: '标题不能为空，且不能超过 180 个字符。' };
  if (!description) return { ok: false, error: '摘要不能为空，且不能超过 500 个字符。' };
  if (body === null) return { ok: false, error: '正文格式无效或超过 500,000 个字符。' };

  const requestedSlug = text(input.slug, 100);
  if (input.slug !== undefined && input.slug !== null && requestedSlug === null) {
    return { ok: false, error: 'URL 标识格式无效或超过 100 个字符。' };
  }
  const slug = requestedSlug ? requestedSlug.toLowerCase() : createSlug(title);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: 'URL 标识只能包含小写字母、数字和短横线。' };
  }

  const lang = input.lang ?? 'zh';
  if (lang !== 'zh' && lang !== 'en') return { ok: false, error: '语言必须是 zh 或 en。' };
  const status = input.status ?? 'draft';
  if (status !== 'draft' && status !== 'published' && status !== 'archived') {
    return { ok: false, error: '文章状态无效。' };
  }

  const suppliedPubDate = input.pubDate !== undefined && input.pubDate !== null && input.pubDate !== '';
  const pubDate = text(input.pubDate, 40) || (suppliedPubDate ? '' : new Date().toISOString().slice(0, 10));
  if (!pubDate || !validCalendarDate(pubDate)) return { ok: false, error: '发布日期无效。' };

  const updatedDateResult = optionalText(input.updatedDate, 40, '更新日期格式无效或超过 40 个字符。');
  if (!updatedDateResult.ok) return updatedDateResult;
  if (updatedDateResult.value && !validUpdatedDate(updatedDateResult.value)) {
    return { ok: false, error: '更新日期无效。' };
  }

  if (input.tags !== undefined && !Array.isArray(input.tags)) return { ok: false, error: '标签格式无效。' };
  const tags = [];
  for (const tag of input.tags ?? []) {
    const normalized = text(tag, 40);
    if (normalized === null) return { ok: false, error: '每个标签都必须是字符串，且不能超过 40 个字符。' };
    if (normalized && !tags.includes(normalized)) tags.push(normalized);
  }
  if (tags.length > 12) return { ok: false, error: '标签不能超过 12 个。' };

  const coverResult = optionalText(input.cover, 2048, '封面地址格式无效或超过 2,048 个字符。');
  if (!coverResult.ok) return coverResult;
  if (coverResult.value) {
    try {
      const url = new URL(coverResult.value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
    } catch {
      return { ok: false, error: '封面地址必须是绝对 HTTP 或 HTTPS URL。' };
    }
  }

  const coverAltResult = optionalText(input.coverAlt, 300, '封面替代文本不能超过 300 个字符。');
  if (!coverAltResult.ok) return coverAltResult;
  const seriesResult = optionalText(input.series, 120, '系列名称不能超过 120 个字符。');
  if (!seriesResult.ok) return seriesResult;
  const translationKeyResult = optionalText(input.translationKey, 120, '翻译关联标识不能超过 120 个字符。');
  if (!translationKeyResult.ok) return translationKeyResult;
  if (input.featured !== undefined && typeof input.featured !== 'boolean') {
    return { ok: false, error: '精选状态格式无效。' };
  }

  return {
    ok: true,
    value: {
      slug,
      title,
      description,
      body,
      pubDate,
      updatedDate: updatedDateResult.value,
      tags,
      lang,
      cover: coverResult.value,
      coverAlt: coverAltResult.value,
      featured: input.featured === true,
      series: seriesResult.value,
      translationKey: translationKeyResult.value,
      status,
    },
  };
}

/** @param {PostStatus} status */
export function isPublicStatus(status) {
  return status === 'published';
}
