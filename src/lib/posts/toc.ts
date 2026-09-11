export interface PostHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface PostTocItem {
  slug: string;
  text: string;
  children: Array<{ slug: string; text: string }>;
}

export function buildPostToc(headings: PostHeading[]): PostTocItem[] {
  const toc: PostTocItem[] = [];
  for (const heading of headings) {
    if (heading.depth === 2) {
      toc.push({ slug: heading.slug, text: heading.text, children: [] });
    } else if (heading.depth === 3 && toc.length > 0) {
      toc[toc.length - 1].children.push({ slug: heading.slug, text: heading.text });
    }
  }
  return toc;
}
