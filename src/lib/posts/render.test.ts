import { describe, expect, it } from 'vitest';
import { renderMarkdownDocument, safeMarkdownHtml } from './render';

describe('safe Markdown rendering', () => {
  it('renders ordinary Markdown', () => {
    expect(safeMarkdownHtml('## Heading\n\n**Strong**')).toContain('<strong>Strong</strong>');
  });

  it('removes executable HTML and unsafe URLs', () => {
    const html = safeMarkdownHtml('<script>alert(1)</script>\n\n[bad](javascript:alert(1))');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  it('adds isolation attributes to links', () => {
    expect(safeMarkdownHtml('[site](https://example.com)')).toContain('rel="nofollow noopener noreferrer"');
  });

  it('assigns stable, unique heading ids and returns plain-text heading metadata', () => {
    const document = renderMarkdownDocument('## Hello **world**\n\n### 中文标题\n\n## Hello world');

    expect(document.html).toContain('<h2 id="hello-world">Hello <strong>world</strong></h2>');
    expect(document.html).toContain('<h3 id="中文标题">中文标题</h3>');
    expect(document.html).toContain('<h2 id="hello-world-1">Hello world</h2>');
    expect(document.headings).toEqual([
      { depth: 2, slug: 'hello-world', text: 'Hello world' },
      { depth: 3, slug: '中文标题', text: '中文标题' },
      { depth: 2, slug: 'hello-world-1', text: 'Hello world' },
    ]);
  });

  it('does not retain executable markup inside headings', () => {
    const document = renderMarkdownDocument('## Safe <script>alert(1)</script> title');

    expect(document.html).not.toContain('<script');
    expect(document.html).not.toContain('alert(1)');
    expect(document.headings[0]).toMatchObject({ depth: 2, text: 'Safe alert(1) title' });
    expect(document.headings[0].slug).toMatch(/^[\p{Letter}\p{Number}\p{Mark}-]+$/u);
    expect(document.headings[0].text).not.toContain('<script');
  });
});
