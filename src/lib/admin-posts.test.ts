import { describe, expect, it } from 'vitest';
import type { D1DatabaseLike, D1PreparedStatementLike } from './db';
import { updateManagedPost } from './admin-posts';
import type { PostInput } from './posts/input';

const post: PostInput = {
  slug: 'concurrent-edit',
  title: 'Concurrent edit',
  description: 'The winning update',
  body: '# Body',
  pubDate: '2026-09-11',
  updatedDate: '2026-09-11T12:00:00.000Z',
  tags: ['D1'],
  lang: 'en',
  cover: null,
  coverAlt: null,
  featured: false,
  series: null,
  translationKey: null,
  status: 'published',
};

function fakeDatabase(changes = 1) {
  let query = '';
  let bindings: unknown[] = [];
  const statement: D1PreparedStatementLike = {
    bind(...values) {
      bindings = values;
      return statement;
    },
    async first() {
      return null;
    },
    async all<T>() {
      return { results: [] as T[], success: true, meta: {} };
    },
    async run<T>() {
      return { results: [] as T[], success: true, meta: { changes } };
    },
  };
  const db: D1DatabaseLike = {
    prepare(sql) {
      query = sql;
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return { db, query: () => query, bindings: () => bindings };
}

describe('managed post optimistic updates', () => {
  it('increments an owner update only when the expected version still matches', async () => {
    const fake = fakeDatabase();

    await expect(updateManagedPost(fake.db, post, {
      id: 'post-1',
      expectedVersion: 7,
      now: '2026-09-11T12:00:00.000Z',
      userId: 'owner-1',
      owner: true,
    })).resolves.toBe(true);

    expect(fake.query()).toContain('version = version + 1');
    expect(fake.query()).toContain('WHERE id = ? AND version = ?');
    expect(fake.bindings().slice(-2)).toEqual(['post-1', 7]);
  });

  it('keeps author, post status, and active-editor checks in the atomic update', async () => {
    const fake = fakeDatabase(0);

    await expect(updateManagedPost(fake.db, post, {
      id: 'post-1',
      expectedVersion: 3,
      now: '2026-09-11T12:00:00.000Z',
      userId: 'editor-1',
      owner: false,
    })).resolves.toBe(false);

    expect(fake.query()).toContain('WHERE id = ? AND version = ?');
    expect(fake.query()).toContain('AND author_id = ?');
    expect(fake.query()).toContain("AND status <> 'archived'");
    expect(fake.query()).toContain("role = 'editor' AND active = 1");
    expect(fake.bindings().slice(-4)).toEqual(['post-1', 3, 'editor-1', 'editor-1']);
  });
});
