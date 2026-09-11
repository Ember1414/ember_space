import { describe, expect, it } from 'vitest';
import { createSlug, isPublicStatus, parseExpectedVersion, parsePostInput } from './input';

describe('post input', () => {
  it('normalizes a publishable article', () => {
    const result = parsePostInput({
      title: 'Cloudflare Pages Notes',
      slug: 'cloudflare-pages-notes',
      description: 'A concise description.',
      content: '# Hello',
      tags: ['Astro', 'Astro', 'Cloudflare'],
      lang: 'en',
      status: 'published',
      pubDate: '2026-09-11',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.body).toBe('# Hello');
      expect(result.value.tags).toEqual(['Astro', 'Cloudflare']);
      expect(isPublicStatus(result.value.status)).toBe(true);
    }
  });

  it('keeps drafts outside the public status', () => {
    expect(isPublicStatus('draft')).toBe(false);
    expect(isPublicStatus('archived')).toBe(false);
  });

  it('rejects unsafe cover protocols and invalid slugs', () => {
    const base = { title: 'Post', description: 'Description', body: '', pubDate: '2026-09-11' };
    expect(parsePostInput({ ...base, slug: 'Bad Slug' }).ok).toBe(false);
    expect(parsePostInput({ ...base, slug: 'post', cover: 'javascript:alert(1)' }).ok).toBe(false);
    expect(parsePostInput({ ...base, slug: 'post', cover: '../../assets/cover.webp' }).ok).toBe(false);
  });

  it('rejects metadata that would otherwise be silently discarded', () => {
    const base = { title: 'Post', slug: 'post', description: 'Description', body: '', pubDate: '2026-09-11' };
    expect(parsePostInput({ ...base, tags: ['x'.repeat(41)] }).ok).toBe(false);
    expect(parsePostInput({ ...base, coverAlt: 'x'.repeat(301) }).ok).toBe(false);
    expect(parsePostInput({ ...base, series: 'x'.repeat(121) }).ok).toBe(false);
    expect(parsePostInput({ ...base, translationKey: 'x'.repeat(121) }).ok).toBe(false);
  });

  it('validates calendar dates including leap years', () => {
    const base = { title: 'Post', slug: 'post', description: 'Description', body: '' };
    expect(parsePostInput({ ...base, pubDate: '2026-02-31' }).ok).toBe(false);
    expect(parsePostInput({ ...base, pubDate: '2026-02-29' }).ok).toBe(false);
    expect(parsePostInput({ ...base, pubDate: '2024-02-29' }).ok).toBe(true);
  });

  it('accepts only canonical YYYY-MM-DD publication dates', () => {
    const base = { title: 'Post', slug: 'post', description: 'Description', body: '' };
    expect(parsePostInput({ ...base, pubDate: '2026-09-11T00:00:00.000Z' }).ok).toBe(false);
    expect(parsePostInput({ ...base, pubDate: '2026-09-11T08:00:00+08:00' }).ok).toBe(false);
    expect(parsePostInput({ ...base, pubDate: '2026-09-11Z' }).ok).toBe(false);
    expect(parsePostInput({
      ...base,
      pubDate: '2026-09-11',
      updatedDate: '2026-09-11T12:00:00.000Z',
    }).ok).toBe(true);
  });

  it('requires a positive safely incrementable integer version', () => {
    expect(parseExpectedVersion(1)).toEqual({ ok: true, value: 1 });
    expect(parseExpectedVersion(42)).toEqual({ ok: true, value: 42 });
    expect(parseExpectedVersion(undefined).ok).toBe(false);
    expect(parseExpectedVersion('1').ok).toBe(false);
    expect(parseExpectedVersion(0).ok).toBe(false);
    expect(parseExpectedVersion(1.5).ok).toBe(false);
    expect(parseExpectedVersion(Number.MAX_SAFE_INTEGER).ok).toBe(false);
  });

  it('creates a stable URL slug for Latin titles', () => {
    expect(createSlug('  Astro + D1: A Guide  ')).toBe('astro-d1-a-guide');
  });
});
