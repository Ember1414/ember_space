import { describe, expect, it } from 'vitest';
import { createSlug, isPublicStatus, parsePostInput } from './input';

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
  });

  it('creates a stable URL slug for Latin titles', () => {
    expect(createSlug('  Astro + D1: A Guide  ')).toBe('astro-d1-a-guide');
  });
});

