import { marked, Renderer } from 'marked';
import sanitizeHtml from 'sanitize-html';

export interface MarkdownHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface MarkdownDocument {
  html: string;
  headings: MarkdownHeading[];
}

function inlineText(tokens: unknown[]): string {
  const parts: string[] = [];

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const token = value as Record<string, unknown>;
    if (token.type === 'html') return;
    if (Array.isArray(token.tokens)) {
      token.tokens.forEach(visit);
    } else if (typeof token.text === 'string') {
      parts.push(token.text);
    }
  };

  visit(tokens);
  return parts.join('').replace(/\s+/gu, ' ').trim();
}

function headingSlug(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/gu, '-') || 'section';
}

export function renderMarkdownDocument(markdown: string): MarkdownDocument {
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  const renderer = new Renderer();
  renderer.heading = function heading({ tokens, depth }) {
    const text = inlineText(tokens);
    const baseSlug = headingSlug(text);
    const duplicateIndex = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, duplicateIndex + 1);
    const slug = duplicateIndex === 0 ? baseSlug : `${baseSlug}-${duplicateIndex}`;
    headings.push({ depth, slug, text });
    return `<h${depth} id="${slug}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
  };
  const rendered = marked.parse(markdown ?? '', {
    async: false,
    renderer,
  }) as string;
  const html = sanitizeHtml(rendered, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      code: ['class'],
      '*': ['id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'nofollow noopener noreferrer' },
      }),
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: { ...attribs, loading: attribs.loading ?? 'lazy' },
      }),
    },
  });

  return { html, headings };
}

export function safeMarkdownHtml(markdown: string): string {
  return renderMarkdownDocument(markdown).html;
}
