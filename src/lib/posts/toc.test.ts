import { describe, expect, it } from 'vitest';
import { buildPostToc } from './toc';

describe('post table of contents', () => {
  it('nests level-three headings under the preceding level-two heading', () => {
    expect(buildPostToc([
      { depth: 1, slug: 'title', text: 'Title' },
      { depth: 3, slug: 'orphan', text: 'Orphan' },
      { depth: 2, slug: 'first', text: 'First' },
      { depth: 3, slug: 'child', text: 'Child' },
      { depth: 4, slug: 'deep', text: 'Deep' },
      { depth: 2, slug: 'second', text: 'Second' },
    ])).toEqual([
      { slug: 'first', text: 'First', children: [{ slug: 'child', text: 'Child' }] },
      { slug: 'second', text: 'Second', children: [] },
    ]);
  });
});
